package plugin

import (
	"context"
	"log"
	"net/http"
	"net/url"

	"golang.org/x/oauth2"
	"golang.org/x/oauth2/clientcredentials"

	"github.com/cognitedata/cognite-grafana-datasource/pkg/models"
)

const dummyHeader = "xxxxxxxx"

const (
	headerKeyAccept        = "Accept"
	headerKeyContentType   = "Content-Type"
	headerKeyAuthorization = "Authorization"
	headerKeyIdToken       = "X-ID-Token"
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

func ApplyForwardedOAuthIdentity(requestHeaders map[string]string, settings models.PluginSettings, req *http.Request, includeSect bool) *http.Request {
	log.Printf("Forwarding OAuth identity: %v", settings.OauthPassThru)
	if settings.OauthPassThru {
		authHeader := dummyHeader
		token := dummyHeader
		if includeSect {
			authHeader = requestHeaders[headerKeyAuthorization]
			token = requestHeaders[headerKeyIdToken]
		}
		req.Header.Add(headerKeyAuthorization, authHeader)
		if requestHeaders[headerKeyIdToken] != "" {
			req.Header.Add(headerKeyIdToken, token)
		}
	}
	return req
}