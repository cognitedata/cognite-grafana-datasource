package plugin

import (
	"context"
	"encoding/json"
	"os"
	"testing"

	"github.com/cognitedata/cognite-grafana-datasource/pkg/models"
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
	oAuthClientId := os.Getenv("CLIENT_ID")
	oAuthClientSecret := os.Getenv("CLIENT_SECRET")
	cogniteHost := os.Getenv("COGNITE_HOST")
	cogniteProject := os.Getenv("COGNITE_PROJECT")
	oAuthTokenUrl := os.Getenv("TOKEN_URL")
	oauthScope := "https://" + cogniteHost + "/.default"

	pluginSettings := models.PluginSettings{
		ClusterUrl: cogniteHost,
		CogniteProject: cogniteProject,
		OauthPassThru: false,
		OAuthClientId: oAuthClientId,
		OAuthTokenUrl: oAuthTokenUrl,
		OauthScope: oauthScope,
		OAuthClientCreds: true,
	}

	settings := backend.DataSourceInstanceSettings{
		JSONData: marshalJson(t, pluginSettings),
		DecryptedSecureJSONData: map[string]string{
			"oauthClientSecret": oAuthClientSecret,
		},
	}

	pluginContext := backend.PluginContext{
		OrgID: 1,
		DataSourceInstanceSettings: &settings,
	}

	ds := Datasource{}

	query := queryModel{
		DataModelsQuery: DataModelsQuery{
			ExternalId: "test_dm",
			Version: "1",
			Space: "test_space",
			GraphQlQuery: "query{}",
			PostProcessing: "",
		},
	}

	resp, err := ds.QueryData(
		context.Background(),
		&backend.QueryDataRequest{
			PluginContext: pluginContext,
			Queries: []backend.DataQuery{
				{
					RefID: "A",
					JSON: marshalJson(t, query),
				},
			},
		},
	)

	assert.Nil(t, err)
	assert.NotNil(t, resp)
	assert.Equal(t, 1, len(resp.Responses))
	for refID := range resp.Responses {
		assert.Equal(t, "A", refID)
		assert.NotNil(t, resp.Responses[refID].Error)
		assert.Equal(t, "API errors:\n- Could not find data model with space=test_space, externalId=test_dm and version=1", resp.Responses[refID].Error.Error())
	}
}
