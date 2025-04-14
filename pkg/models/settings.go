package models

import (
	"encoding/json"
	"fmt"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
)

type PluginSettings struct {
	Path    string                `json:"path"`
	Secrets *SecretPluginSettings `json:"-"`
	
	// these two are the same
	ClusterUrl		string		`json:"clusterUrl,omitempty"`
	CogniteApiUrl 		 string          `json:"cogniteApiUrl,omitempty"`

	// these two are the same
	CogniteProject		string		`json:"cogniteProject,omitempty"`
	DefaultProject		string		`json:"defaultProject,omitempty"`

	OauthPassThru		bool		`json:"oauthPassThru,omitempty"`
	OAuthClientCreds       bool      `json:"oauthClientCreds,omitempty"`
	OAuthClientId		string		`json:"oauthClientId,omitempty"`
	OAuthTokenUrl		string		`json:"oauthTokenUrl,omitempty"`
	OauthScope		string		`json:"oauthScope,omitempty"`
}

type SecretPluginSettings struct {
	OAuthClientSecret string `json:"oauthClientSecret"`
}

func LoadPluginSettings(source backend.DataSourceInstanceSettings) (*PluginSettings, error) {
	settings := PluginSettings{}
	err := json.Unmarshal(source.JSONData, &settings)
	if err != nil {
		return nil, fmt.Errorf("could not unmarshal PluginSettings json: %w", err)
	}

	settings.Secrets = loadSecretPluginSettings(source.DecryptedSecureJSONData)

	return &settings, nil
}

func loadSecretPluginSettings(source map[string]string) *SecretPluginSettings {
	return &SecretPluginSettings{
		OAuthClientSecret: source["oauthClientSecret"],
	}
}
