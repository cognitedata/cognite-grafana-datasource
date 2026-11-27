package plugin

import (
	"context"
	"errors"
	"net/http"
	"strings"

	"github.com/cognitedata/cognite-grafana-datasource/pkg/cdf"
)

const unitsSpace = "cdf_cdm_units"

// CogniteUnit mirrors the TypeScript CogniteUnit metadata shape.
type CogniteUnit struct {
	Space           string  `json:"space"`
	ExternalID      string  `json:"externalId"`
	Name            string  `json:"name,omitempty"`
	Description     string  `json:"description,omitempty"`
	Symbol          *string `json:"symbol,omitempty"`
	Quantity        string  `json:"quantity,omitempty"`
	Source          string  `json:"source,omitempty"`
	SourceReference string  `json:"sourceReference,omitempty"`
}

var errEmptyUnitCatalog = errors.New("empty unit catalog")

func (d *Datasource) getCogniteUnitIndex(ctx context.Context, auth string) (map[string]CogniteUnit, error) {
	key := d.client.CacheKey(auth, "cognite_units_v1")
	index, err := cdf.GetOrLoadJSON(ctx, d.cache, key, metadataTTL, func(ctx context.Context) (map[string]CogniteUnit, error) {
		units, err := d.fetchCogniteUnits(ctx, auth)
		if err != nil {
			return nil, err
		}
		// Empty catalogs can be transient. Allow the next lookup to retry.
		if len(units) == 0 {
			return nil, errEmptyUnitCatalog
		}
		index := make(map[string]CogniteUnit, len(units))
		for _, unit := range units {
			index[unit.ExternalID] = unit
		}
		return index, nil
	})
	if errors.Is(err, errEmptyUnitCatalog) {
		return nil, nil
	}
	return index, err
}

func (d *Datasource) fetchCogniteUnits(ctx context.Context, auth string) ([]CogniteUnit, error) {
	reqBody := map[string]any{
		"sources": dmsViewSources(View{
			Space:      "cdf_cdm",
			ExternalID: "CogniteUnit",
			Version:    "v1",
		}),
		"instanceType": "node",
		"limit":        5000,
		"filter": map[string]any{
			"equals": map[string]any{
				"property": []string{"node", "space"},
				"value":    unitsSpace,
			},
		},
	}

	instances, err := cdf.FetchAndPaginate[dmsInstance](ctx, d.client, auth, http.MethodPost, "/models/instances/list", nil, reqBody, 5000)
	if err != nil {
		return nil, err
	}

	units := make([]CogniteUnit, 0, len(instances))
	for _, inst := range instances {
		unitProps := inst.Properties["cdf_cdm"]["CogniteUnit/v1"]
		name := stringProp(unitProps["name"])
		if name == "" {
			name = inst.ExternalID
		}
		unit := CogniteUnit{
			Space:           inst.Space,
			ExternalID:      inst.ExternalID,
			Name:            name,
			Description:     stringProp(unitProps["description"]),
			Quantity:        stringProp(unitProps["quantity"]),
			Source:          stringProp(unitProps["source"]),
			SourceReference: stringProp(unitProps["sourceReference"]),
		}
		if symbol, ok := unitProps["symbol"].(string); ok {
			unit.Symbol = &symbol
		}
		units = append(units, unit)
	}
	return units, nil
}

func resolveEffectiveUnit(ctx context.Context, d *Datasource, auth string, storageUnit any, targetUnit string) (*CogniteUnit, error) {
	var storageExternalID, storageSpace string
	if m, ok := storageUnit.(map[string]any); ok {
		storageExternalID = stringProp(m["externalId"])
		storageSpace = stringProp(m["space"])
	}
	externalID := targetUnit
	if externalID == "" {
		externalID = storageExternalID
	}
	if externalID == "" {
		return nil, nil
	}

	idx, err := d.getCogniteUnitIndex(ctx, auth)
	if err != nil {
		return nil, err
	}
	if resolved, ok := idx[externalID]; ok {
		return &resolved, nil
	}

	space := unitsSpace
	if targetUnit == "" && storageSpace != "" {
		space = storageSpace
	}
	return &CogniteUnit{
		Space:      space,
		ExternalID: externalID,
		Name:       externalID,
	}, nil
}

func unitSymbol(unitExternalID string, index map[string]CogniteUnit) string {
	if unitExternalID == "" {
		return ""
	}
	if u := index[unitExternalID]; u.Symbol != nil {
		return *u.Symbol
	}
	parts := strings.Split(unitExternalID, ":")
	return parts[len(parts)-1]
}

func withUnitSuffix(name, unitExternalID string, index map[string]CogniteUnit) string {
	sym := unitSymbol(unitExternalID, index)
	if sym == "" {
		return name
	}
	return name + " (" + sym + ")"
}

func stringProp(v any) string {
	s, _ := v.(string)
	return s
}
