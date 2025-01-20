package plugin

import (
	"context"
	"encoding/json"
	"testing"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func marshalJson(t *testing.T, v interface{}) []byte {
	t.Helper()
	data, err := json.Marshal(v)
	require.Nil(t, err)
	return data
}

func TestQueryData(t *testing.T) {
	settings := backend.DataSourceInstanceSettings{
	}

	pluginContext := backend.PluginContext{
		OrgID: 1,
		DataSourceInstanceSettings: &settings,
	}

	ds := Datasource{}

	resp, err := ds.QueryData(
		context.Background(),
		&backend.QueryDataRequest{
			PluginContext: pluginContext,
			Queries: []backend.DataQuery{
				{
					RefID: "A",
				},
			},
		},
	)

	assert.Nil(t, err)
	assert.NotNil(t, resp)
	assert.Equal(t, 0, len(resp.Responses))
}
