package plugin

import (
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
	for _, query := range queries {
		result := response.Responses[query.RefID]
		if result.Status != backend.StatusNotImplemented || result.Error == nil {
			t.Errorf("query %s: expected an unsupported query error, got %+v", query.RefID, result)
		}
	}
}
