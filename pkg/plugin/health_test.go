package plugin

import (
	"context"
	"encoding/json"
	"net/http"
	"testing"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
)

func TestCheckHealth(t *testing.T) {
	t.Run("valid project", func(t *testing.T) {
		ds := newTestDatasource(t, func(w http.ResponseWriter, r *http.Request) {
			if r.Header.Get("Authorization") != "Bearer test-token" {
				t.Error("missing request identity")
			}
			if r.URL.Path != "/api/v1/token/inspect" {
				t.Errorf("unexpected path: %s", r.URL.Path)
			}
			_ = json.NewEncoder(w).Encode(map[string]any{
				"projects": []map[string]any{{"projectUrlName": "other"}, {"projectUrlName": "test-project"}},
			})
		})
		req := &backend.CheckHealthRequest{}
		req.SetHTTPHeader(backend.OAuthIdentityTokenHeaderName, "Bearer test-token")
		res, err := ds.CheckHealth(t.Context(), req)
		if err != nil {
			t.Fatal(err)
		}
		if res.Status != backend.HealthStatusOk || res.Message != "Your Cognite credentials are valid" {
			t.Fatalf("unexpected result: %+v", res)
		}
	})

	t.Run("unauthorized 401 and 403 map to invalid credentials message", func(t *testing.T) {
		for _, status := range []int{http.StatusUnauthorized, http.StatusForbidden} {
			ds := newTestDatasource(t, func(w http.ResponseWriter, r *http.Request) {
				w.WriteHeader(status)
				_ = json.NewEncoder(w).Encode(map[string]any{
					"error": map[string]any{"code": status, "message": "Token expired or forbidden"},
				})
			})
			res, err := ds.CheckHealth(context.Background(), &backend.CheckHealthRequest{
				Headers: map[string]string{"Authorization": "Bearer expired"},
			})
			if err != nil {
				t.Fatal(err)
			}
			if res.Status != backend.HealthStatusError || res.Message != "Your Cognite credentials are invalid" {
				t.Fatalf("status %d expected invalid credentials, got %+v", status, res)
			}
		}
	})

	t.Run("project missing from inspect response", func(t *testing.T) {
		ds := newTestDatasource(t, func(w http.ResponseWriter, r *http.Request) {
			_ = json.NewEncoder(w).Encode(map[string]any{
				"projects": []map[string]any{{"projectUrlName": "another-project"}},
			})
		})
		res, err := ds.CheckHealth(context.Background(), &backend.CheckHealthRequest{
			Headers: map[string]string{"Authorization": "Bearer valid"},
		})
		if err != nil {
			t.Fatal(err)
		}
		if res.Status != backend.HealthStatusError || res.Message != "Cannot access 'test-project' project" {
			t.Fatalf("unexpected result: %+v", res)
		}
	})
}
