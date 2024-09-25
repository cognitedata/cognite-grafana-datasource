package plugin

import (
	"context"
	"net/http"
	"net/url"

	"golang.org/x/oauth2"
	"golang.org/x/oauth2/clientcredentials"

	"github.com/cognitedata/cognite-grafana-datasource/pkg/models"
)

func ApplyOAuthClientCredentials(ctx context.Context, httpClient *http.Client, settings models.PluginSettings) *http.Client {
	if IsOAuthCredentialsConfigured(settings) {
		oauthConfig := clientcredentials.Config{
			ClientID:       settings.OAuthClientId,
			ClientSecret:   settings.Secrets.OAuthClientSecret,
			TokenURL:       settings.OAuthTokenUrl,
			Scopes:         []string{ settings.OauthScope },
			EndpointParams: url.Values{},
			AuthStyle:      oauth2.AuthStyleAutoDetect,
		}
		ctx := context.WithValue(context.Background(), oauth2.HTTPClient, httpClient)
		httpClient = oauthConfig.Client(ctx)
	}
	return httpClient
}

func IsOAuthCredentialsConfigured(settings models.PluginSettings) bool {
	return settings.OAuthClientCreds && settings.OAuthClientId != "" && settings.Secrets.OAuthClientSecret != "" && settings.OAuthTokenUrl != ""
}
