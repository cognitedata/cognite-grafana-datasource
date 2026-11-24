package cdf

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"math/rand/v2"
	"net/http"
	"net/url"
	"strconv"
	"strings"
	"time"

	"github.com/grafana/grafana-plugin-sdk-go/build/buildinfo"
)

const maxResponseBytes = 32 << 20

type Client struct {
	http     *http.Client
	base     *url.URL
	settings Settings
	secret   string
	version  string
	tokenMu  chan struct{}
	token    string
	expires  time.Time
	slots    chan struct{}
}

type Error struct {
	Status    int
	Message   string
	RequestID string
}

func (e *Error) Error() string { return e.Message }

func NewClient(s Settings, secret string, transport *http.Client) (*Client, error) {
	if transport == nil {
		return nil, errors.New("CDF HTTP client is required")
	}
	s, err := s.normalized()
	if err != nil {
		return nil, err
	}
	base, err := hostURL(s.APIHost)
	if err != nil {
		return nil, err
	}
	if s.ClientCredentials && !s.PassThrough && secret == "" {
		return nil, errors.New("OAuth client secret is required")
	}
	copyClient := *transport
	if copyClient.Timeout == 0 {
		copyClient.Timeout = 60 * time.Second
	}
	copyClient.CheckRedirect = func(_ *http.Request, _ []*http.Request) error { return http.ErrUseLastResponse }
	version := "dev"
	if info, err := buildinfo.GetBuildInfo.GetInfo(); err == nil && info.Version != "" {
		version = info.Version
	}
	return &Client{
		http: &copyClient, base: base, settings: s, secret: secret, version: version,
		tokenMu: make(chan struct{}, 1),
		slots:   make(chan struct{}, 8),
	}, nil
}

func (c *Client) Close() { c.http.CloseIdleConnections() }

// A forwarded identity is supplied per operation, never stored on the instance.
func (c *Client) authorization(ctx context.Context, forwarded string) (string, error) {
	if c.settings.PassThrough || !c.settings.ClientCredentials {
		if strings.TrimSpace(forwarded) == "" {
			return "", &Error{Status: 401, Message: "Forwarded OAuth identity is missing. Sign in with OAuth; unattended queries require a client-credentials data source."}
		}
		return forwarded, nil
	}
	select {
	case c.tokenMu <- struct{}{}:
	case <-ctx.Done():
		return "", ctx.Err()
	}
	defer func() { <-c.tokenMu }()
	if c.token != "" && time.Now().Add(30*time.Second).Before(c.expires) {
		return "Bearer " + c.token, nil
	}
	values := url.Values{"grant_type": {"client_credentials"}, "client_id": {c.settings.ClientID}, "client_secret": {c.secret}, "scope": {c.settings.Scope}}
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, c.settings.TokenURL, strings.NewReader(values.Encode()))
	if err != nil {
		return "", errors.New("Invalid OAuth token URL")
	}
	req.Header.Set("Content-Type", "application/x-www-form-urlencoded")
	req.Header.Set("Accept-Encoding", "gzip")
	res, err := c.http.Do(req)
	if err != nil {
		if ctx.Err() != nil {
			return "", ctx.Err()
		}
		if errors.Is(err, context.DeadlineExceeded) {
			return "", context.DeadlineExceeded
		}
		return "", &Error{Status: http.StatusBadGateway, Message: "OAuth token request failed"}
	}
	data, readErr := readResponse(res, 1<<20)
	if readErr != nil {
		if ctx.Err() != nil {
			return "", ctx.Err()
		}
		return "", &Error{Status: http.StatusBadGateway, Message: "Could not decode OAuth response"}
	}
	if res.StatusCode != http.StatusOK {
		return "", &Error{Status: res.StatusCode, Message: fmt.Sprintf("OAuth token request failed (HTTP %d)", res.StatusCode)}
	}
	var token struct {
		AccessToken string `json:"access_token"`
		ExpiresIn   int    `json:"expires_in"`
	}
	if err := json.NewDecoder(bytes.NewReader(data)).Decode(&token); err != nil || token.AccessToken == "" {
		return "", &Error{Status: http.StatusBadGateway, Message: "OAuth server returned an invalid token response"}
	}
	if token.ExpiresIn <= 0 {
		token.ExpiresIn = 60
	}
	c.token, c.expires = token.AccessToken, time.Now().Add(time.Duration(token.ExpiresIn)*time.Second)
	return "Bearer " + c.token, nil
}

func (c *Client) invalidate(ctx context.Context, auth string) {
	select {
	case c.tokenMu <- struct{}{}:
	case <-ctx.Done():
		return
	}
	defer func() { <-c.tokenMu }()
	if auth == "Bearer "+c.token {
		c.token = ""
	}
}

// Do only performs read operations selected by a query executor or resource handler.
// The path is relative to the configured project; caller input cannot change host.
func (c *Client) Do(ctx context.Context, forwarded, method, path string, query url.Values, body any, output any) error {
	return c.request(ctx, forwarded, method, "/api/v1/projects/"+url.PathEscape(*c.settings.Project)+path, query, body, output)
}

func (c *Client) Inspect(ctx context.Context, forwarded string, output any) error {
	return c.request(ctx, forwarded, http.MethodGet, "/api/v1/token/inspect", nil, nil, output)
}

func (c *Client) request(ctx context.Context, forwarded, method, path string, query url.Values, body any, output any) error {
	select {
	case c.slots <- struct{}{}:
		defer func() { <-c.slots }()
	case <-ctx.Done():
		return ctx.Err()
	}
	payload, err := json.Marshal(body)
	if err != nil {
		return errors.New("Could not encode CDF request")
	}
	if body == nil {
		payload = nil
	}
	payload, compressed, err := compressRequest(payload)
	if err != nil {
		return errors.New("Could not compress CDF request")
	}
	ref, err := url.Parse(path)
	if err != nil || !strings.HasPrefix(path, "/api/v1/") || ref.IsAbs() || ref.Host != "" || ref.RawQuery != "" || ref.Fragment != "" {
		return errors.New("Invalid CDF operation path")
	}
	for _, segment := range strings.Split(ref.Path, "/") {
		if segment == "." || segment == ".." {
			return errors.New("Invalid CDF operation path")
		}
	}
	target := c.base.ResolveReference(ref)
	target.RawQuery = query.Encode()
	refreshed := false
	for attempt := 0; attempt < 4; attempt++ {
		auth, err := c.authorization(ctx, forwarded)
		if err != nil {
			return err
		}
		req, err := http.NewRequestWithContext(ctx, method, target.String(), bytes.NewReader(payload))
		if err != nil {
			return errors.New("Could not construct CDF request")
		}
		req.Header.Set("Authorization", auth)
		req.Header.Set("Content-Type", "application/json")
		req.Header.Set("Accept", "application/json")
		req.Header.Set("Accept-Encoding", "gzip")
		if compressed {
			req.Header.Set("Content-Encoding", "gzip")
		}
		req.Header.Set("x-cdp-sdk", "CogniteGrafanaDatasource:"+c.version)
		req.Header.Set("x-cdp-app", "Cognite Grafana Datasource")
		res, err := c.http.Do(req)
		if err != nil {
			if ctx.Err() != nil {
				return ctx.Err()
			}
			if errors.Is(err, context.DeadlineExceeded) {
				return context.DeadlineExceeded
			}
			return &Error{Status: http.StatusBadGateway, Message: "CDF request failed; check cluster connectivity and TLS configuration"}
		}
		data, readErr := readResponse(res, maxResponseBytes)
		if readErr != nil {
			if ctx.Err() != nil {
				return ctx.Err()
			}
			return &Error{Status: http.StatusBadGateway, Message: readErr.Error()}
		}
		if res.StatusCode >= 200 && res.StatusCode < 300 {
			if output == nil {
				return nil
			}
			decoder := json.NewDecoder(bytes.NewReader(data))
			decoder.UseNumber()
			if err := decoder.Decode(output); err != nil {
				return &Error{Status: http.StatusBadGateway, Message: "CDF returned an invalid JSON response"}
			}
			return nil
		}
		if res.StatusCode == 401 && c.settings.ClientCredentials && !c.settings.PassThrough && !refreshed && attempt < 3 {
			c.invalidate(ctx, auth)
			refreshed = true
			continue
		}
		transient := res.StatusCode == 429 || res.StatusCode == 502 || res.StatusCode == 503 || res.StatusCode == 504
		if transient && attempt < 3 {
			delay := time.Duration(200*(1<<attempt)+rand.IntN(100)) * time.Millisecond
			if seconds, e := strconv.Atoi(res.Header.Get("Retry-After")); e == nil && seconds > 0 {
				if seconds > 30 {
					return &Error{Status: res.StatusCode, Message: "CDF requested a retry beyond this query's retry budget"}
				}
				delay = time.Duration(seconds) * time.Second
			} else if at, e := http.ParseTime(res.Header.Get("Retry-After")); e == nil && time.Until(at) > delay {
				delay = time.Until(at)
			}
			if delay > 30*time.Second {
				return &Error{Status: res.StatusCode, Message: "CDF requested a retry beyond this query's retry budget"}
			}
			timer := time.NewTimer(delay)
			select {
			case <-timer.C:
			case <-ctx.Done():
				timer.Stop()
				return ctx.Err()
			}
			continue
		}
		var envelope struct {
			Error struct {
				Message string `json:"message"`
			} `json:"error"`
		}
		_ = json.Unmarshal(data, &envelope)
		message := envelope.Error.Message
		if message == "" {
			message = fmt.Sprintf("CDF request failed (HTTP %d)", res.StatusCode)
		}
		for _, sensitive := range []string{auth, strings.TrimPrefix(auth, "Bearer "), c.secret} {
			if sensitive != "" {
				message = strings.ReplaceAll(message, sensitive, "[redacted]")
			}
		}
		return &Error{Status: res.StatusCode, Message: message, RequestID: res.Header.Get("x-request-id")}
	}
	return errors.New("CDF retry budget exhausted")
}
