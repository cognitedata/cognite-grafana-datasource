package plugin

import (
	"encoding/json"
	"fmt"
	"net/http"
	"reflect"
	"testing"
)

func TestOrderedViewMetadata(t *testing.T) {
	calls := 0
	ds := newTestDatasource(t, func(w http.ResponseWriter, r *http.Request) {
		calls++
		var body struct {
			Items                      []View
			IncludeInheritedProperties bool
		}
		if err := json.NewDecoder(r.Body).Decode(&body); err != nil || len(body.Items) != 1 || !body.IncludeInheritedProperties || r.Method != "POST" || r.URL.Path != "/api/v1/projects/test-project/models/views/byids" {
			t.Errorf("invalid view lookup: %+v (%v)", body, err)
		}
		fmt.Fprint(w, `{"items":[{"name":"test","properties":{"z":{"value":9007199254740993},"\u03bb":null,"a":[]}}]}`)
	})
	view := View{"s", "v", "1"}
	for _, auth := range []string{"Bearer a", "Bearer a", "Bearer b"} {
		got, err := ds.fetchOrderedDMSView(t.Context(), auth, view)
		if err != nil || got == nil {
			t.Fatalf("view: %v, %v", got, err)
		}
		want := map[string]any{"z": map[string]any{"value": json.Number("9007199254740993")}, "\u03bb": nil, "a": []any{}}
		if !reflect.DeepEqual(got.PropertyNames, []string{"z", "\u03bb", "a"}) || !reflect.DeepEqual(got.Properties, want) {
			t.Errorf("view = %+v", got)
		}
		delete(got.Properties, "z")
	}
	if calls != 2 {
		t.Fatalf("expected one lookup per identity, got %d", calls)
	}
	view.Version = "2"
	if _, err := ds.fetchOrderedDMSView(t.Context(), "Bearer a", view); err != nil || calls != 3 {
		t.Errorf("version lookup: calls=%d err=%v", calls, err)
	}
}

func TestStateSetMetadata(t *testing.T) {
	calls := 0
	ds := newTestDatasource(t, func(w http.ResponseWriter, r *http.Request) {
		calls++
		var body struct {
			Items []struct {
				InstanceID
				InstanceType string
			}
			Sources []struct {
				Source struct {
					View
					Type string
				}
			}
		}
		if err := json.NewDecoder(r.Body).Decode(&body); err != nil || r.URL.Path != "/api/v1/projects/test-project/models/instances/byids" || len(body.Items) != 1 || body.Items[0].InstanceType != "node" || len(body.Sources) != 1 || body.Sources[0].Source.View != (View{"cdf_cdm", "CogniteStateSet", "v1"}) || body.Sources[0].Source.Type != "view" {
			t.Errorf("invalid state lookup: %+v (%v)", body, err)
		}
		fmt.Fprint(w, `{"items":[{"space":"s","externalId":"x","properties":{"cdf_cdm":{"CogniteStateSet/v1":{"states":[{"numericValue":2,"stringValue":"two"},{"numericValue":null,"stringValue":"invalid"},{"numericValue":0,"stringValue":"zero","description":"first"}]}}}}]}`)
	})
	for i := 0; i < 2; i++ {
		states, err := ds.getStateSet(t.Context(), "Bearer user", InstanceID{"s", "x"})
		if err != nil || !reflect.DeepEqual(states, []StateSetEntry{{0, "zero", "first"}, {2, "two", ""}}) {
			t.Fatalf("states: %+v (%v)", states, err)
		}
	}
	if calls != 1 {
		t.Errorf("instance fetched %d times", calls)
	}
}
