package plugin

import (
	"bytes"
	"context"
	"net/http"
	"testing"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
)

func TestUnsupportedQueries(t *testing.T) {
	instance, err := NewDatasource(t.Context(), backend.DataSourceInstanceSettings{})
	if err != nil {
		t.Fatal(err)
	}
	queries := []backend.DataQuery{{RefID: "A"}, {RefID: "B"}}
	response, err := instance.(backend.QueryDataHandler).QueryData(t.Context(), &backend.QueryDataRequest{Queries: queries})
	if err != nil {
		t.Fatal(err)
	}
	if got, want := len(response.Responses), len(queries); got != want {
		t.Fatalf("got %d responses, want %d", got, want)
	}
	for _, query := range queries {
		result := response.Responses[query.RefID]
		if result.Status != backend.StatusNotImplemented || result.Error == nil {
			t.Errorf("query %s: expected an unsupported query error, got %+v", query.RefID, result)
		}
	}
}

func TestQueryBoundary(t *testing.T) {
	ds := &Datasource{}
	queries := []backend.DataQuery{
		{RefID: "invalid", JSON: []byte("{")}, {RefID: "hidden", JSON: []byte(`{"hide":true}`)},
		{RefID: "large", JSON: bytes.Repeat([]byte("x"), maxQueryPayloadBytes+1)},
		{RefID: "visible", JSON: []byte(`{"tab":"Data Models"}`)},
	}
	result, err := ds.QueryData(t.Context(), &backend.QueryDataRequest{Queries: queries})
	if err != nil {
		t.Fatal(err)
	}
	for ref, status := range map[string]backend.Status{"invalid": 400, "large": 413, "visible": 501} {
		if result.Responses[ref].Status != status {
			t.Errorf("%s: %+v", ref, result.Responses[ref])
		}
	}
	if hidden, ok := result.Responses["hidden"]; !ok || hidden.Error != nil || len(hidden.Frames) != 0 {
		t.Fatalf("unexpected hidden result: %+v", hidden)
	}
	if got := errorResponse(context.DeadlineExceeded).Status; got != http.StatusGatewayTimeout {
		t.Errorf("timeout status %d", got)
	}
	ctx, cancel := context.WithCancel(t.Context())
	cancel()
	result, err = ds.QueryData(ctx, &backend.QueryDataRequest{Queries: queries})
	if err != nil || result.Responses["visible"].Status != 499 {
		t.Fatalf("cancellation: %v %v", result, err)
	}
}

func TestFrontendProvisioning(t *testing.T) {
	for _, raw := range []string{`{"defaultProject":"old","clusterUrl":"legacy.example"}`, `{}`} {
		instance, err := NewDatasource(t.Context(), backend.DataSourceInstanceSettings{JSONData: []byte(raw)})
		if err != nil {
			t.Fatal(err)
		}
		ds := instance.(*Datasource)
		defer ds.Dispose()
		if raw == "{}" {
			health, err := ds.CheckHealth(t.Context(), &backend.CheckHealthRequest{})
			if err != nil || health.Status != backend.HealthStatusError {
				t.Fatalf("incomplete settings: %v %v", health, err)
			}
		} else if ds.client == nil || *ds.settings.Project != "old" {
			t.Fatal("legacy frontend settings did not initialize")
		}
	}
}
