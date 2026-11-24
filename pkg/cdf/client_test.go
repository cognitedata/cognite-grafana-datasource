package cdf

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"strings"
	"sync"
	"sync/atomic"
	"testing"
	"time"
)

func testClient(t *testing.T, handler http.HandlerFunc, credentials bool) (*Client, *httptest.Server) {
	t.Helper()
	server := httptest.NewTLSServer(handler)
	t.Cleanup(server.Close)
	project := "test-project"
	settings := Settings{APIHost: strings.TrimPrefix(server.URL, "https://"), Project: &project, PassThrough: !credentials, ClientCredentials: credentials, TokenURL: server.URL + "/token", ClientID: "test-id"}
	client, err := NewClient(settings, "test-secret", server.Client())
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(client.Close)
	return client, server
}

func TestSettingsCompatibility(t *testing.T) {
	for _, tc := range []struct {
		raw, host, project string
		invalid            bool
	}{
		{`{"defaultProject":"old","clusterUrl":"cluster.example"}`, "cluster.example", "old", false},
		{`{"cogniteProject":"new","defaultProject":"old","cogniteApiUrl":"new.example","clusterUrl":"old.example"}`, "new.example", "new", false},
		{`{"cogniteProject":"","defaultProject":"old"}`, "", "", true},
		{`{"cogniteProject":"x","cogniteApiUrl":"host/path"}`, "", "", true},
		{`{"cogniteProject":"../other"}`, "", "", true},
		{`{"cogniteProject":"x","oauthClientCreds":true,"oauthTokenUrl":"http://identity.example/token","oauthClientId":"id"}`, "", "", true},
		{`{"cogniteProject":"x","queryExecution":"typo"}`, "", "", true},
		{`{"cogniteProject":"x"}`, "api.cognitedata.com", "x", false},
	} {
		t.Run(tc.raw, func(t *testing.T) {
			s, err := ParseSettings([]byte(tc.raw))
			if tc.invalid {
				if err == nil {
					t.Fatal("expected rejection")
				}
				return
			}
			if err != nil || s.APIHost != tc.host || *s.Project != tc.project {
				t.Fatalf("unexpected settings: %v %v", s, err)
			}
		})
	}
}

func TestClientCredentialsCacheAndRefresh(t *testing.T) {
	var tokens atomic.Int32
	var rejectFirst atomic.Bool
	client, _ := testClient(t, func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path == "/token" {
			if r.Header.Get("Authorization") != "" {
				t.Error("user authorization leaked to token endpoint")
			}
			_ = r.ParseForm()
			if r.Form.Has("scope") {
				t.Error("empty scope sent")
			}
			if r.Form.Get("client_secret") != "test-secret" {
				t.Error("missing client secret")
			}
			n := tokens.Add(1)
			_ = json.NewEncoder(w).Encode(map[string]any{"access_token": "token-" + string(rune('0'+n)), "expires_in": 3600})
			return
		}
		if r.URL.Path != "/api/v1/projects/test-project/models/instances/list" {
			t.Errorf("unexpected path %s", r.URL.Path)
		}
		if rejectFirst.Load() && r.Header.Get("Authorization") == "Bearer token-1" {
			w.WriteHeader(401)
			return
		}
		_, _ = w.Write([]byte(`{"items":[]}`))
	}, true)
	var wg sync.WaitGroup
	for range 12 {
		wg.Add(1)
		go func() {
			defer wg.Done()
			var output any
			if err := client.Do(context.Background(), "Bearer user-must-not-be-used", "POST", "/models/instances/list", nil, map[string]any{}, &output); err != nil {
				t.Error(err)
			}
		}()
	}
	wg.Wait()
	if tokens.Load() != 1 {
		t.Fatalf("got %d token requests", tokens.Load())
	}
	rejectFirst.Store(true)
	var output any
	if err := client.Do(context.Background(), "", "POST", "/models/instances/list", nil, nil, &output); err != nil {
		t.Fatal(err)
	}
	if tokens.Load() != 2 {
		t.Fatalf("refresh not performed: %d", tokens.Load())
	}
}

func TestForwardedIdentityIsolationAndMissingToken(t *testing.T) {
	var calls atomic.Int32
	client, _ := testClient(t, func(w http.ResponseWriter, r *http.Request) {
		calls.Add(1)
		_ = json.NewEncoder(w).Encode(map[string]string{"identity": r.Header.Get("Authorization")})
	}, false)
	var wg sync.WaitGroup
	for _, identity := range []string{"Bearer alice", "Bearer bob"} {
		wg.Add(1)
		go func(auth string) {
			defer wg.Done()
			var result map[string]string
			if err := client.Do(context.Background(), auth, "GET", "/models/views", nil, nil, &result); err != nil {
				t.Error(err)
			}
			if result["identity"] != auth {
				t.Error("identity crossed requests")
			}
		}(identity)
	}
	wg.Wait()
	var output any
	if err := client.Do(context.Background(), "", "GET", "/models/views", nil, nil, &output); err == nil {
		t.Fatal("missing identity accepted")
	}
	if calls.Load() != 2 {
		t.Fatal("missing identity reached CDF")
	}
}

func TestRetryCancellationAndSecretRedaction(t *testing.T) {
	var calls atomic.Int32
	client, _ := testClient(t, func(w http.ResponseWriter, r *http.Request) {
		calls.Add(1)
		w.Header().Set("Retry-After", "1")
		w.WriteHeader(429)
		_, _ = w.Write([]byte(`{"error":{"message":"Bearer private-token test-secret"}}`))
	}, false)
	ctx, cancel := context.WithTimeout(context.Background(), 50*time.Millisecond)
	defer cancel()
	var output any
	if err := client.Do(ctx, "Bearer private-token", "GET", "/models/views", nil, nil, &output); err != context.DeadlineExceeded {
		t.Fatalf("expected cancellation, got %v", err)
	}
	if calls.Load() != 1 {
		t.Fatal("cancellation did not stop retry")
	}
	client2, _ := testClient(t, func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(403)
		_, _ = w.Write([]byte(`{"error":{"message":"Bearer private-token test-secret"}}`))
	}, false)
	err := client2.Do(context.Background(), "Bearer private-token", "GET", "/models/views", nil, nil, &output)
	if err == nil || strings.Contains(err.Error(), "private-token") || strings.Contains(err.Error(), "test-secret") {
		t.Fatalf("unsafe error: %v", err)
	}
}

func TestRedirectAndTraversalAreRejected(t *testing.T) {
	var leaked atomic.Bool
	other := httptest.NewTLSServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) { leaked.Store(true) }))
	defer other.Close()
	client, _ := testClient(t, func(w http.ResponseWriter, r *http.Request) { http.Redirect(w, r, other.URL, 302) }, false)
	var output any
	if err := client.Do(context.Background(), "Bearer alice", "GET", "/models/views", nil, nil, &output); err == nil {
		t.Fatal("redirect accepted")
	}
	if leaked.Load() {
		t.Fatal("followed cross-origin redirect")
	}
	if err := client.Do(context.Background(), "Bearer alice", "GET", "/../token/inspect", nil, nil, &output); err == nil {
		t.Fatal("traversal accepted")
	}
}

func TestTokenWaitHonorsCancellation(t *testing.T) {
	started := make(chan struct{})
	release := make(chan struct{})
	client, _ := testClient(t, func(w http.ResponseWriter, r *http.Request) {
		close(started)
		<-release
		_, _ = w.Write([]byte(`{"access_token":"token","expires_in":3600}`))
	}, true)
	first := make(chan error, 1)
	go func() { _, err := client.authorization(context.Background(), ""); first <- err }()
	<-started
	ctx, cancel := context.WithCancel(context.Background())
	cancel()
	second := make(chan error, 1)
	go func() { _, err := client.authorization(ctx, ""); second <- err }()
	select {
	case err := <-second:
		if !errors.Is(err, context.Canceled) {
			t.Errorf("%v", err)
		}
	case <-time.After(time.Second):
		t.Error("canceled request waited for refresh")
	}
	close(release)
	<-first
}
func TestConfiguredHTTPTimeoutIsPreserved(t *testing.T) {
	p := "p"
	c, err := NewClient(Settings{APIHost: "example.com", Project: &p}, "", &http.Client{Timeout: 17 * time.Second})
	if err != nil || c.http.Timeout != 17*time.Second {
		t.Fatalf("%v %v", c, err)
	}
}
func TestInvalidOperationBeforeConcurrencyWait(t *testing.T) {
	client, _ := testClient(t, func(http.ResponseWriter, *http.Request) { t.Error("invalid operation reached server") }, false)
	for range cap(client.slots) {
		client.slots <- struct{}{}
	}
	ctx, cancel := context.WithCancel(t.Context())
	cancel()
	for _, path := range []string{"-other/views", "/models/views?", "/../token"} {
		if err := client.Do(ctx, "Bearer t", "GET", path, nil, nil, nil); err == nil || errors.Is(err, context.Canceled) {
			t.Errorf("expected path validation for %q; got %v", path, err)
		}
	}
	if _, err := hostURL("example.com?"); err == nil {
		t.Fatal("accepted trailing query delimiter")
	}
}

func TestForwardedCredentialAndMissingItems(t *testing.T) {
	client, _ := testClient(t, func(w http.ResponseWriter, r *http.Request) {
		if r.Header.Get("Authorization") != "bearer private-token" || r.Header.Get("Content-Type") != "" || r.ContentLength != 0 {
			t.Error("unexpected GET headers or body")
		}
		w.WriteHeader(404)
		_, _ = w.Write([]byte(`{"error":{"message":"denied private-token","missing":[{ "externalId": "missing" },{"id":42}]}}`))
	}, false)
	err := client.Do(t.Context(), "  bearer private-token  ", "GET", "/models/views", nil, nil, nil)
	if err == nil || err.Error() != `denied [redacted] Missing: {"externalId":"missing"}, {"id":42}` {
		t.Fatalf("unexpected error: %v", err)
	}
}

func TestResponseBodyTimeout(t *testing.T) {
	for _, oauth := range []bool{false, true} {
		client, _ := testClient(t, func(w http.ResponseWriter, r *http.Request) {
			w.Header().Set("Content-Encoding", "gzip")
			w.WriteHeader(200)
			w.(http.Flusher).Flush()
			<-r.Context().Done()
		}, oauth)
		client.http.Timeout = 200 * time.Millisecond
		if err := client.Do(t.Context(), "Bearer test", "GET", "/models/views", nil, nil, nil); !errors.Is(err, context.DeadlineExceeded) {
			t.Errorf("oauth=%v: expected timeout, got %v", oauth, err)
		}
	}
}
