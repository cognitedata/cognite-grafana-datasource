package cdf

import (
	"encoding/json"
	"errors"
	"net/url"
	"strings"
)

// Settings uses the same names and precedence as the existing proxy routes.
// Credentials are deliberately not part of the serialized settings model.
type Settings struct {
	APIHost           string  `json:"cogniteApiUrl"`
	ClusterHost       string  `json:"clusterUrl"`
	Project           *string `json:"cogniteProject"`
	DefaultProject    string  `json:"defaultProject"`
	PassThrough       bool    `json:"oauthPassThru"`
	ClientCredentials bool    `json:"oauthClientCreds"`
	TokenURL          string  `json:"oauthTokenUrl"`
	ClientID          string  `json:"oauthClientId"`
	Scope             string  `json:"oauthScope"`
	Execution         string  `json:"queryExecution"`
}

func ParseSettings(raw []byte) (Settings, error) {
	var s Settings
	if err := json.Unmarshal(raw, &s); err != nil {
		return s, errors.New("Invalid data source settings JSON")
	}
	return s.normalized()
}

func (s Settings) normalized() (Settings, error) {
	if s.Execution != "" && s.Execution != "frontend" && s.Execution != "backend" {
		return s, errors.New("Unknown query execution mode")
	}
	if s.APIHost == "" {
		s.APIHost = s.ClusterHost
	}
	if s.APIHost == "" {
		s.APIHost = "api.cognitedata.com"
	}
	if _, err := hostURL(s.APIHost); err != nil {
		return s, err
	}
	if s.Project == nil {
		s.Project = &s.DefaultProject
	}
	if strings.TrimSpace(*s.Project) == "" {
		return s, errors.New("CDF project is required")
	}
	if *s.Project == "." || *s.Project == ".." || strings.Contains(*s.Project, "/") {
		return s, errors.New("Invalid CDF project name")
	}
	if s.ClientCredentials && !s.PassThrough {
		u, err := url.Parse(s.TokenURL)
		if err != nil || u.Scheme != "https" || u.Hostname() == "" || u.User != nil || u.Fragment != "" {
			return s, errors.New("OAuth token URL must be an absolute HTTPS URL without embedded credentials")
		}
		if s.ClientID == "" {
			return s, errors.New("OAuth client ID is required")
		}
	}
	return s, nil
}

func hostURL(host string) (*url.URL, error) {
	// Configuration accepts a bare host, as the frontend normalizes schemes away.
	u, err := url.Parse("https://" + host)
	if err != nil || u.Hostname() == "" || u.User != nil || u.Path != "" || u.RawQuery != "" || u.Fragment != "" || strings.Contains(host, "://") {
		return nil, errors.New("CDF cluster must be a hostname without a scheme, path, or credentials")
	}
	return u, nil
}
