package plugin

import (
	"context"
	"testing"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/stretchr/testify/assert"
)

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
