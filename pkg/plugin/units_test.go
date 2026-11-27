package plugin

import (
	"encoding/json"
	"fmt"
	"net/http"
	"testing"
)

func TestUnitCatalogAndLabels(t *testing.T) {
	calls := 0
	ds := newTestDatasource(t, func(w http.ResponseWriter, r *http.Request) {
		calls++
		var body struct {
			Cursor       string
			InstanceType string
			Sources      []struct {
				Source struct {
					View
					Type string
				}
			}
			Filter struct {
				Equals struct {
					Property []string
					Value    string
				}
			}
		}
		if err := json.NewDecoder(r.Body).Decode(&body); err != nil || r.Method != "POST" || r.URL.Path != "/api/v1/projects/test-project/models/instances/list" || body.InstanceType != "node" || len(body.Sources) != 1 || body.Sources[0].Source.View != (View{"cdf_cdm", "CogniteUnit", "v1"}) || body.Filter.Equals.Value != unitsSpace {
			t.Errorf("unit lookup: %+v (%v)", body, err)
		}
		if body.Cursor == "" {
			fmt.Fprint(w, `{"items":[{"space":"cdf_cdm_units","externalId":"unit:none","properties":{"cdf_cdm":{"CogniteUnit/v1":{"symbol":""}}}}],"nextCursor":"second"}`)
		} else if body.Cursor == "second" {
			fmt.Fprint(w, `{"items":[{"space":"cdf_cdm_units","externalId":"volume:m3","properties":{"cdf_cdm":{"CogniteUnit/v1":{"symbol":"m\u00b3","name":"volume"}}}}]}`)
		} else {
			t.Errorf("unexpected cursor %q", body.Cursor)
		}
	})
	ctx := t.Context()
	ref := map[string]any{"space": "custom", "externalId": "unknown"}
	if u, err := resolveEffectiveUnit(ctx, ds, "Bearer a", nil, ""); u != nil || err != nil || calls != 0 {
		t.Fatalf("empty ref: %v %v", u, err)
	}
	u, err := resolveEffectiveUnit(ctx, ds, "Bearer a", ref, "volume:m3")
	if err != nil || u == nil {
		t.Fatalf("target unit: %v %v", u, err)
	}
	props := map[string]any{"unit": u, "reading": json.Number("9007199254740993"), "flag": false}
	label := interpolateCogniteTimeSeriesInstanceLabel("{{ unit.symbol }} {{unit}} {{reading}} {{flag}} {{absent}} {{missing}} {{unit.bad}} {{state}}", props, []string{"absent"})
	want := "m\u00b3 " + `{"space":"cdf_cdm_units","externalId":"volume:m3","name":"volume","symbol":"` + "m\u00b3" + `"} 9007199254740993 false null :missing :unit.bad {{state}}`
	if label != want {
		t.Errorf("label = %q, want %q", label, want)
	}
	u, err = resolveEffectiveUnit(ctx, ds, "Bearer a", ref, "")
	if err != nil || u == nil || u.Space != "custom" || u.Name != "unknown" {
		t.Fatalf("fallback: %v %v", u, err)
	}
	idx, err := ds.getCogniteUnitIndex(ctx, " Bearer a ")
	if err != nil || calls != 2 {
		t.Fatalf("catalog cache: calls=%d err=%v", calls, err)
	}
	if withUnitSuffix("flow", "unit:none", idx) != "flow" || withUnitSuffix("flow", "custom:l", idx) != "flow (l)" {
		t.Error("unexpected unit suffix")
	}
	if _, err := ds.getCogniteUnitIndex(ctx, "Bearer b"); err != nil || calls != 4 {
		t.Errorf("identity isolation: calls=%d err=%v", calls, err)
	}
}

func TestEmptyCatalogIsRetried(t *testing.T) {
	calls := 0
	ds := newTestDatasource(t, func(w http.ResponseWriter, r *http.Request) { calls++; fmt.Fprint(w, `{"items":[]}`) })
	for i := 0; i < 2; i++ {
		u, err := resolveEffectiveUnit(t.Context(), ds, "Bearer a", nil, "unknown")
		if err != nil || u == nil || u.Space != unitsSpace || u.ExternalID != "unknown" {
			t.Fatalf("empty catalog fallback: %v %v", u, err)
		}
	}
	if calls != 2 {
		t.Fatalf("expected empty catalog retry, got %d calls", calls)
	}
}
