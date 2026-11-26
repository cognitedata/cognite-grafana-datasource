package plugin

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"reflect"
	"strings"
	"testing"

	"github.com/cognitedata/cognite-grafana-datasource/pkg/cdf"
	"github.com/grafana/grafana-plugin-sdk-go/backend"
)

type captureResourceSender struct {
	resp *backend.CallResourceResponse
}

func (s *captureResourceSender) Send(resp *backend.CallResourceResponse) error {
	s.resp = resp
	return nil
}

func TestModelVersionResource(t *testing.T) {
	calls := 0
	ds := newTestDatasource(t, func(w http.ResponseWriter, r *http.Request) {
		calls++
		if r.URL.Path != "/api/v1/projects/test-project/dml/graphql" || r.Method != "POST" || r.Header.Get("Authorization") != "Bearer editor" {
			t.Error("incorrect outbound request")
		}
		var payload struct {
			Query     string
			Variables map[string]string
		}
		if err := json.NewDecoder(r.Body).Decode(&payload); err != nil || payload.Query != modelVersionsQuery || !reflect.DeepEqual(payload.Variables, map[string]string{"space": "s", "externalId": "m"}) {
			t.Errorf("unexpected model lookup: %+v (%v)", payload, err)
		}
		fmt.Fprint(w, `{"data":{"items":[]}}`)
	})
	for _, tc := range []struct {
		method, path, body string
		status             int
	}{
		{"POST", "graphql/dml", `{"data":{"query":"{other}","variables":{"space":"s","externalId":"m","extra":"unused"}}}`, 200},
		{"POST", "graphql/dml", `{"data":"{\"query\":\"{other}\",\"variables\":{\"space\":\"s\",\"externalId\":\"m\"}}"}`, 200},
		{"POST", "graphql/dml", `{"data":"{\"query\":\"mutation { write }\",\"variables\":{\"space\":\"s\",\"externalId\":\"m\"}}"}`, 400},
		{"POST", "graphql/dml", `{"data":"{"}`, 400},
		{"GET", "graphql/dml", "", 405},
		{"POST", "graphql/dml", strings.Repeat("x", maxQueryPayloadBytes+1), 413},
		{"POST", "graphql/dml", "{", 400},
		{"POST", "graphql/dml", `{"query":"{ other }","variables":{"space":"s"}}`, 400},
		{"POST", "../graphql/dml", "{}", 400},
		{"POST", "graphql/query", "{}", 404},
	} {
		req := &backend.CallResourceRequest{Method: tc.method, Path: tc.path, Body: []byte(tc.body)}
		req.SetHTTPHeader(backend.OAuthIdentityTokenHeaderName, "Bearer editor")
		sender := &captureResourceSender{}
		if err := ds.CallResource(t.Context(), req, sender); err != nil || sender.resp == nil || sender.resp.Status != tc.status {
			t.Fatalf("%s %s: %+v, %v", tc.method, tc.path, sender.resp, err)
		}
	}
	for _, query := range []string{"mutation { write }", "subscription { change }", "query A {x} query B {y}", "query A {x} mutation B {y}", "fragment F on X {name}"} {
		raw, _ := json.Marshal(map[string]any{"query": query, "variables": map[string]string{"space": "s", "externalId": "m"}})
		sender := &captureResourceSender{}
		err := ds.CallResource(t.Context(), &backend.CallResourceRequest{Method: "POST", Path: "graphql/dml", Body: raw}, sender)
		if err != nil || sender.resp.Status != 400 {
			t.Fatalf("expected rejected operation: %+v %v", sender.resp, err)
		}
	}
	if calls != 2 {
		t.Fatalf("upstream calls=%d, want 2", calls)
	}
}

func TestResourceErrorClassification(t *testing.T) {
	for _, tc := range []struct {
		err     error
		status  int
		message string
	}{
		{errors.New("private diagnostic"), 500, "Internal data source error"},
		{&cdf.Error{Status: 307, Message: "redirect"}, 502, "Unexpected CDF response status"},
		{&cdf.Error{Status: 403, Message: "denied"}, 403, "denied"},
		{&cdf.Error{Status: 503, Message: "unavailable"}, 503, "unavailable"},
		{context.Canceled, 499, "context canceled"},
		{context.DeadlineExceeded, 504, "context deadline exceeded"},
	} {
		sender := &captureResourceSender{}
		if err := sendErrorResource(sender, tc.err); err != nil {
			t.Fatal(err)
		}
		var body struct{ Message string }
		if err := json.Unmarshal(sender.resp.Body, &body); err != nil || sender.resp.Status != tc.status || body.Message != tc.message {
			t.Errorf("got %d %q for %v", sender.resp.Status, sender.resp.Body, tc.err)
		}
	}
}
