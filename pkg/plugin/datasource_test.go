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
	oAuthClientId := os.Getenv("AZURE_CLIENT_ID")
	oAuthClientSecret := os.Getenv("AZURE_CLIENT_SECRET")
	oAuthTenant := os.Getenv("AZURE_TENANT")
	cogniteHost := os.Getenv("COGNITE_HOST")
	cogniteProject := os.Getenv("COGNITE_PROJECT")
	oAuthTokenUrl := "https://login.microsoftonline.com/" + oAuthTenant + "/oauth2/token"
	oauthScope := "https://" + cogniteHost + "/.default"

	pluginSettings := models.PluginSettings{
		ClusterUrl: cogniteHost,
		CogniteProject: cogniteProject,
		OauthPassThru: false,
		OAuthClientId: oAuthClientId,
		OAuthTokenUrl: oAuthTokenUrl,
		OauthScope: oauthScope,
		OAuthClientCreds: true,
		Secrets: &models.SecretPluginSettings{
			OAuthClientSecret: oAuthClientSecret,
		},
	}

	settings := backend.DataSourceInstanceSettings{
		JSONData: marshalJson(t, pluginSettings),
		DecryptedSecureJSONData: map[string]string{},
	}

	pluginContext := backend.PluginContext{
		OrgID: 1,
		DataSourceInstanceSettings: &settings,
	}

	ds := Datasource{}

	query := queryModel{
		DataModelsQuery: DataModelsQuery{
			ExternalId: "externalId",
			Version: "version",
			Space: "space",
			GraphQlQuery: "graphQlQuery",
			PostProcessing: "postProcessing",
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
	}
	// assert.Equal(t, 1, len(resp.Responses["A"].Frames))
}
