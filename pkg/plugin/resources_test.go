package plugin

import (
	"encoding/json"
	"fmt"
	"net/http"
	"reflect"
	"strings"
	"testing"

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
	if calls != 1 {
		t.Fatalf("upstream calls=%d, want 1", calls)
	}
}
