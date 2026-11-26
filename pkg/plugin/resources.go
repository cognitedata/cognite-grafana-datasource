package plugin

import (
	"context"
	"encoding/json"
	"net/http"
	"strings"
	"time"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
)

func sendJSONResource(sender backend.CallResourceResponseSender, status int, payload any) error {
	body, err := json.Marshal(payload)
	if err != nil {
		return sender.Send(&backend.CallResourceResponse{
			Status: http.StatusInternalServerError,
			Headers: map[string][]string{
				"Content-Type": {"application/json"},
			},
			Body: []byte(`{"message":"Failed to encode resource response"}`),
		})
	}
	return sender.Send(&backend.CallResourceResponse{
		Status: status,
		Headers: map[string][]string{
			"Content-Type": {"application/json"},
		},
		Body: body,
	})
}

func sendErrorResource(sender backend.CallResourceResponseSender, err error) error {
	result := errorResponse(err)
	return sendJSONResource(sender, int(result.Status), map[string]string{
		"message": result.Error.Error(),
	})
}

func (d *Datasource) CallResource(ctx context.Context, req *backend.CallResourceRequest, sender backend.CallResourceResponseSender) error {
	ctx, cancel := context.WithTimeout(ctx, 2*time.Minute)
	defer cancel()
	if req.Method != http.MethodPost {
		return sendJSONResource(sender, http.StatusMethodNotAllowed, map[string]string{"message": "Resource requests require POST"})
	}
	if len(req.Body) > maxQueryPayloadBytes {
		return sendJSONResource(sender, http.StatusRequestEntityTooLarge, map[string]string{"message": "Resource payload exceeds 1 MiB"})
	}
	path := strings.TrimPrefix(strings.TrimSpace(req.Path), "/")
	if path == "" || strings.Contains(path, "..") || strings.Contains(path, "\\") {
		return sendJSONResource(sender, http.StatusBadRequest, map[string]string{
			"message": "Invalid resource path",
		})
	}

	if path != "graphql/dml" {
		return sendJSONResource(sender, http.StatusNotFound, map[string]string{"message": "Unknown resource path"})
	}
	var envelope struct {
		Data json.RawMessage `json:"data"`
	}
	if err := json.Unmarshal(req.Body, &envelope); err != nil {
		return sendJSONResource(sender, http.StatusBadRequest, map[string]string{"message": "Invalid JSON resource payload"})
	}
	raw := envelope.Data
	if raw == nil {
		raw = req.Body
	} else if len(raw) > 0 && raw[0] == '"' {
		// The frontend editor serializes the GraphQL payload before wrapping it in data.
		var serialized string
		if err := json.Unmarshal(raw, &serialized); err != nil {
			return sendJSONResource(sender, http.StatusBadRequest, map[string]string{"message": "Invalid serialized GraphQL payload"})
		}
		raw = json.RawMessage(serialized)
	}
	body, err := modelVersionsBody(raw)
	if err != nil {
		return sendJSONResource(sender, http.StatusBadRequest, map[string]string{"message": err.Error()})
	}
	if d.configErr != nil {
		return sendJSONResource(sender, http.StatusBadRequest, map[string]string{"message": d.configErr.Error()})
	}
	var result json.RawMessage
	auth := req.GetHTTPHeader(backend.OAuthIdentityTokenHeaderName)
	if err := d.client.Do(ctx, auth, http.MethodPost, "/dml/graphql", nil, body, &result); err != nil {
		return sendErrorResource(sender, err)
	}
	return sendJSONResource(sender, http.StatusOK, result)
}
