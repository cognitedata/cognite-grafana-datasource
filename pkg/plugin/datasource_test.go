package plugin

import (
	"context"
	"fmt"
	"testing"
	"time"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
)

func TestQueryData(t *testing.T) {
	ds := Datasource{}

	resp, err := ds.QueryData(
		context.Background(),
		&backend.QueryDataRequest{
			Queries: []backend.DataQuery{
				{
					RefID: "A",
					// 30 days ago to now
					TimeRange: backend.TimeRange{
						From: time.Now().AddDate(0, 0, -30),
						To:   time.Now(),
					},
					JSON: []byte("{\"queryText\": \"dogfooding_test:timeseries\"}"),
				},
			},
		},
	)
	if err != nil {
		t.Error(err)
	}

	if len(resp.Responses) != 1 {
		t.Fatal("QueryData must return a response")
	}

	var stringTable, _ = resp.Responses["A"].Frames[0].StringTable(10, 10)

	t.Log(fmt.Printf("%+v\n", stringTable))

	// print(resp1)
}

func TestQueryDataWith0Dps(t *testing.T) {
	ds := Datasource{}

	resp, err := ds.QueryData(
		context.Background(),
		&backend.QueryDataRequest{
			Queries: []backend.DataQuery{
				{
					RefID: "A",
					TimeRange: backend.TimeRange{
						From: time.Now(),
						To:   time.Now().Add(time.Minute),
					},
					JSON: []byte("{\"queryText\": \"dogfooding_test:timeseries\"}"),
				},
			},
		},
	)
	if err != nil {
		t.Error(err)
	}

	if len(resp.Responses) != 1 {
		t.Fatal("QueryData must return a response")
	}

	var stringTable, _ = resp.Responses["A"].Frames[0].StringTable(10, 10)

	t.Log(fmt.Printf("%+v\n", stringTable))

	// print(resp1)
}
