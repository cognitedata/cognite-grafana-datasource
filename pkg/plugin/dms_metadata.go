package plugin

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"sort"
	"time"

	"github.com/cognitedata/cognite-grafana-datasource/pkg/cdf"
)

const metadataTTL = 61 * time.Minute

type View struct {
	Space      string `json:"space"`
	ExternalID string `json:"externalId"`
	Version    string `json:"version"`
}

type InstanceID struct {
	Space      string `json:"space"`
	ExternalID string `json:"externalId"`
}

type dmsInstance struct {
	InstanceID
	Properties map[string]map[string]map[string]any `json:"properties"`
}

type orderedViewDef struct {
	View
	Name          string
	PropertyNames []string
	Properties    map[string]any
}

func (d *Datasource) fetchOrderedDMSView(ctx context.Context, auth string, view View) (*orderedViewDef, error) {
	key := cdf.CacheKey(auth, "dms_view", view.Space, view.ExternalID, view.Version)
	return cdf.GetOrLoadJSON(ctx, d.cache, key, metadataTTL, func(ctx context.Context) (*orderedViewDef, error) {
		body := map[string]any{"items": []View{view}, "includeInheritedProperties": true}
		var resp cdf.CursorResponse[struct {
			Name       string          `json:"name"`
			Properties json.RawMessage `json:"properties"`
		}]
		if err := d.client.Do(ctx, auth, http.MethodPost, "/models/views/byids", nil, body, &resp); err != nil || len(resp.Items) == 0 {
			return nil, err
		}
		item := resp.Items[0]
		result := &orderedViewDef{View: view, Name: item.Name}
		if len(item.Properties) == 0 {
			return result, nil
		}
		value, err := decodeOrderedJSON(item.Properties)
		if err != nil {
			return nil, err
		}
		obj, ok := value.(*orderedObj)
		if !ok {
			return nil, fmt.Errorf("expected an object for DMS view properties")
		}
		result.PropertyNames = obj.Keys
		result.Properties = orderedToPlainMap(obj).(map[string]any)
		return result, nil
	})
}

func dmsViewSources(view View) []any {
	return []any{map[string]any{"source": struct {
		View
		Type string `json:"type"`
	}{view, "view"}}}
}

func (d *Datasource) fetchDMSInstance(ctx context.Context, auth string, view View, id InstanceID) (*dmsInstance, error) {
	key := cdf.CacheKey(auth, "dms_instance", view.Space, view.ExternalID, view.Version, id.Space, id.ExternalID)
	return cdf.GetOrLoadJSON(ctx, d.cache, key, metadataTTL, func(ctx context.Context) (*dmsInstance, error) {
		body := map[string]any{"sources": dmsViewSources(view), "includeTyping": false, "items": []any{map[string]string{"instanceType": "node", "space": id.Space, "externalId": id.ExternalID}}}
		items, err := cdf.FetchItems[dmsInstance](ctx, d.client, auth, http.MethodPost, "/models/instances/byids", nil, body)
		if err != nil || len(items) == 0 {
			return nil, err
		}
		return &items[0], nil
	})
}

type StateSetEntry struct {
	NumericValue float64 `json:"numericValue"`
	StringValue  string  `json:"stringValue"`
	Description  string  `json:"description,omitempty"`
}

func (d *Datasource) getStateSet(ctx context.Context, auth string, id InstanceID) ([]StateSetEntry, error) {
	view := View{"cdf_cdm", "CogniteStateSet", "v1"}
	inst, err := d.fetchDMSInstance(ctx, auth, view, id)
	if err != nil || inst == nil {
		return nil, err
	}
	states, _ := inst.Properties[view.Space][view.ExternalID+"/"+view.Version]["states"].([]any)
	var entries []StateSetEntry
	for _, raw := range states {
		m, _ := raw.(map[string]any)
		n, hasNumber := m["numericValue"].(json.Number)
		label, hasLabel := m["stringValue"].(string)
		if !hasNumber || !hasLabel {
			continue
		}
		value, err := n.Float64()
		if err != nil {
			continue
		}
		desc, _ := m["description"].(string)
		entries = append(entries, StateSetEntry{value, label, desc})
	}
	sort.SliceStable(entries, func(i, j int) bool { return entries[i].NumericValue < entries[j].NumericValue })
	return entries, nil
}
