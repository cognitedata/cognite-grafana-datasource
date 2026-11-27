package plugin

import (
	"fmt"
	"net/http"
	"testing"
)

func TestInstanceLabelsAcrossCacheHits(t *testing.T) {
	calls := 0
	ds := newTestDatasource(t, func(w http.ResponseWriter, r *http.Request) {
		calls++
		fmt.Fprint(w, `{"items":[{"properties":{"s":{"V/1":{"aliases":["first","second"],"metadata":{"z":"<x>","a":[{"y":2,"b":1}]},"decimal":1.0,"exponent":1e3,"small":0.0000001,"large":9007199254740993}}}}]}`)
	})
	for i := 0; i < 2; i++ {
		inst, err := ds.fetchDMSInstance(t.Context(), "Bearer a", View{"s", "V", "1"}, InstanceID{"s", "id"})
		if err != nil || inst == nil {
			t.Fatalf("instance: %v %v", inst, err)
		}
		label := "{{\u00a0aliases.0\u2029}} {{aliases.2}} {{metadata}} {{decimal}} {{exponent}} {{small}} {{large}}"
		got := interpolateCogniteTimeSeriesInstanceLabel(label, inst.Properties["s"]["V/1"], nil)
		want := `first :aliases.2 {"z":"<x>","a":[{"y":2,"b":1}]} 1 1000 1e-7 9007199254740993`
		if got != want {
			t.Fatalf("lookup %d: got %q, want %q", i, got, want)
		}
	}
	if calls != 1 {
		t.Fatalf("got %d CDF requests", calls)
	}
	if !labelReferencesProp("{{\ufeffunit.symbol\u2003}}", "unit") || withoutStateToken("{{\u00a0state\u00a0}}") != ":state" {
		t.Error("Unicode whitespace in unit or state token")
	}
}

func TestOptionalUnitLabelFields(t *testing.T) {
	ds := newTestDatasource(t, func(w http.ResponseWriter, r *http.Request) {
		fmt.Fprint(w, `{"items":[{"space":"cdf_cdm_units","externalId":"u","properties":{"cdf_cdm":{"CogniteUnit/v1":{"description":"","quantity":"","source":""}}}}]}`)
	})
	u, err := resolveEffectiveUnit(t.Context(), ds, "Bearer a", nil, "u")
	if err != nil || u == nil {
		t.Fatalf("unit: %v %v", u, err)
	}
	got := interpolateCogniteTimeSeriesInstanceLabel("{{unit.description}}|{{unit.quantity}}|{{unit.source}}|{{unit.sourceReference}}", map[string]any{"unit": u}, nil)
	if got != "|||:unit.sourceReference" {
		t.Errorf("unit label = %q", got)
	}
}
