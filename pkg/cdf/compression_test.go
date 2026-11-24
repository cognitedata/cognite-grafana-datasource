package cdf

import (
	"bytes"
	"compress/gzip"
	"context"
	"encoding/json"
	"errors"
	"io"
	"net/http"
	"strings"
	"testing"
)

func gzipBytes(t *testing.T, raw []byte) []byte {
	t.Helper()
	var out bytes.Buffer
	writer := gzip.NewWriter(&out)
	if _, err := writer.Write(raw); err != nil {
		t.Fatal(err)
	}
	if err := writer.Close(); err != nil {
		t.Fatal(err)
	}
	return out.Bytes()
}

func TestBoundedGzipResponses(t *testing.T) {
	plain := []byte(`{"items":[]}`)
	packed := gzipBytes(t, plain)
	corrupt := append([]byte(nil), packed...)
	corrupt[len(corrupt)-5] ^= 0xff
	for _, tc := range []struct {
		name, encoding     string
		body               []byte
		limit              int64
		uncompressed, fail bool
	}{
		{"identity", "", plain, 128, false, false},
		{"gzip", "gzip", packed, 128, false, false},
		{"transport decoded", "gzip", plain, 128, true, false},
		{"unsupported", "br", plain, 128, false, true},
		{"invalid", "gzip", plain, 128, false, true},
		{"truncated", "gzip", packed[:len(packed)-4], 128, false, true},
		{"checksum", "gzip", corrupt, 128, false, true},
		{"decompression limit", "gzip", gzipBytes(t, bytes.Repeat([]byte("x"), 4096)), 128, false, true},
		{"identity limit", "", bytes.Repeat([]byte("x"), 129), 128, false, true},
		{"gzip wire limit", "gzip", packed, int64(len(plain)), false, true},
	} {
		t.Run(tc.name, func(t *testing.T) {
			res := &http.Response{Body: io.NopCloser(bytes.NewReader(tc.body)), Header: http.Header{"Content-Encoding": {tc.encoding}}, Uncompressed: tc.uncompressed}
			got, err := readResponse(res, tc.limit)
			if errors.Is(err, errResponseTooLarge) != strings.Contains(tc.name, "limit") {
				t.Fatalf("wrong size classification: %v", err)
			}
			if (err != nil) != tc.fail {
				t.Fatalf("unexpected decode result: %v", err)
			}
			if !tc.fail && !bytes.Equal(got, plain) {
				t.Fatalf("decoded payload differs")
			}
		})
	}
}

func TestGzipRequestsReplayAndDecodeErrors(t *testing.T) {
	calls := 0
	var first []byte
	client, _ := testClient(t, func(w http.ResponseWriter, r *http.Request) {
		calls++
		if r.Header.Get("Accept-Encoding") != "gzip" || r.Header.Get("Accept") != "application/json" || r.Header.Get("Content-Encoding") != "gzip" {
			t.Error("missing gzip negotiation")
		}
		raw, _ := io.ReadAll(r.Body)
		if calls == 1 {
			first = raw
		} else if !bytes.Equal(first, raw) {
			t.Error("retry changed compressed bytes")
		}
		reader, err := gzip.NewReader(bytes.NewReader(raw))
		if err != nil {
			t.Error(err)
			return
		}
		defer reader.Close()
		var body map[string]string
		if err := json.NewDecoder(reader).Decode(&body); err != nil || body["filter"] != strings.Repeat("abc", 1000) {
			t.Error("request did not preserve JSON")
		}
		w.Header().Set("Content-Encoding", "gzip")
		w.Header().Set("Content-Type", "application/json")
		if calls == 1 {
			w.WriteHeader(503)
			_, _ = w.Write(gzipBytes(t, []byte(`{"error":{"message":"retry"}}`)))
			return
		}
		_, _ = w.Write(gzipBytes(t, []byte(`{"ok":true}`)))
	}, false)
	var result map[string]bool
	if err := client.Do(context.Background(), "Bearer test", http.MethodPost, "/models/instances/list", nil, map[string]string{"filter": strings.Repeat("abc", 1000)}, &result); err != nil {
		t.Fatal(err)
	}
	if calls != 2 || !result["ok"] {
		t.Fatal("retry/decode failed")
	}
	for _, raw := range [][]byte{nil, []byte(`{"limit":1}`)} {
		got, compressed, err := compressRequest(raw)
		if err != nil || compressed || !bytes.Equal(raw, got) {
			t.Fatal("small payload changed")
		}
	}
}

func TestGzipOAuthToken(t *testing.T) {
	client, _ := testClient(t, func(w http.ResponseWriter, r *http.Request) {
		if r.Header.Get("Accept-Encoding") != "gzip" {
			t.Error("missing gzip negotiation")
		}
		w.Header().Set("Content-Encoding", "gzip")
		w.Header().Set("Content-Type", "application/json")
		if r.URL.Path == "/token" {
			_, _ = w.Write(gzipBytes(t, []byte(`{"access_token":"token","expires_in":3600}`)))
			return
		}
		if r.Header.Get("Authorization") != "Bearer token" {
			t.Error("missing OAuth token")
		}
		_, _ = w.Write(gzipBytes(t, []byte(`{"items":[]}`)))
	}, true)
	var output map[string]any
	if err := client.Do(context.Background(), "", http.MethodGet, "/models/spaces", nil, nil, &output); err != nil {
		t.Fatal(err)
	}
}

func TestGzipReplayAfterTokenRefresh(t *testing.T) {
	var tokens, calls int
	var first []byte
	client, _ := testClient(t, func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path == "/token" {
			tokens++
			_, _ = w.Write([]byte(`{"access_token":"token","expires_in":3600}`))
			return
		}
		calls++
		raw, err := io.ReadAll(r.Body)
		if err != nil || r.Header.Get("Content-Encoding") != "gzip" || r.Header.Get("Content-Type") != "application/json" {
			t.Error("expected a gzipped JSON request")
		}
		if calls == 1 {
			first = raw
			w.WriteHeader(http.StatusUnauthorized)
		} else if !bytes.Equal(raw, first) {
			t.Error("token refresh changed the request body")
		}
	}, true)
	err := client.Do(t.Context(), "", http.MethodPost, "/models/views/list", nil, strings.Repeat("v", 2048), nil)
	if err != nil || tokens != 2 || calls != 2 {
		t.Fatalf("tokens=%d calls=%d err=%v", tokens, calls, err)
	}
}

func TestCompressedCDFError(t *testing.T) {
	client, _ := testClient(t, func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Encoding", "gzip")
		w.Header().Set("x-request-id", "request-42")
		w.WriteHeader(http.StatusForbidden)
		_, _ = w.Write(gzipBytes(t, []byte(`{"error":{"message":"denied for Bearer private-token"}}`)))
	}, false)
	err := client.Do(t.Context(), "Bearer private-token", http.MethodGet, "/models/views", nil, nil, nil)
	var apiErr *Error
	if !errors.As(err, &apiErr) || apiErr.Status != http.StatusForbidden || apiErr.RequestID != "request-42" || apiErr.Message != "denied for [redacted]" {
		t.Fatalf("unexpected CDF error: %v", err)
	}
}
func TestUnsupportedEncodingChain(t *testing.T) {
	for _, values := range [][]string{{"gzip", "br"}, {"gzip, br"}} {
		res := &http.Response{Header: http.Header{"Content-Encoding": values}, Body: io.NopCloser(bytes.NewReader(nil))}
		if _, err := readResponse(res, 128); err == nil || err.Error() != "Unsupported CDF response content encoding" {
			t.Errorf("%v: %v", values, err)
		}
	}
}
