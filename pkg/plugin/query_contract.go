package plugin

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"

	"github.com/cognitedata/cognite-grafana-datasource/pkg/cdf"
	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/vektah/gqlparser/v2/ast"
	"github.com/vektah/gqlparser/v2/parser"
)

const maxQueryPayloadBytes = 1 << 20

// Parse operations rather than scanning text: comments, fragments and string
// literals must not change which operations can be executed with shared credentials.
func validateReadOnlyGraphQL(query string) error {
	if len(query) > maxQueryPayloadBytes {
		return errors.New("GraphQL query exceeds 1 MiB")
	}
	doc, err := parser.ParseQueryWithTokenLimit(&ast.Source{Input: query}, 10000)
	if err != nil {
		return errors.New("Invalid GraphQL query")
	}
	if len(doc.Operations) != 1 || doc.Operations[0].Operation != ast.Query {
		return errors.New("Exactly one read-only GraphQL query operation is supported")
	}
	return nil
}

const modelVersionsQuery = `query getDataModelVersionsById($space: String!, $externalId: String!) {
 graphQlDmlVersionsById(space: $space, externalId: $externalId) {
  items { space externalId version name description graphQlDml createdTime lastUpdatedTime }
 }
}`

// Keep the existing editor envelope compatible, but never execute caller-supplied DML.
func modelVersionsBody(raw json.RawMessage) (any, error) {
	var request struct {
		Query     string         `json:"query"`
		Variables map[string]any `json:"variables"`
	}
	if err := json.Unmarshal(raw, &request); err != nil {
		return nil, errors.New("Invalid GraphQL payload")
	}
	if err := validateReadOnlyGraphQL(request.Query); err != nil {
		return nil, err
	}
	space, _ := request.Variables["space"].(string)
	externalID, _ := request.Variables["externalId"].(string)
	if space == "" || externalID == "" {
		return nil, errors.New("Model version lookup requires space and externalId")
	}
	return map[string]any{"query": modelVersionsQuery, "variables": map[string]string{"space": space, "externalId": externalID}}, nil
}

func errorStatus(err error) int {
	if errors.Is(err, context.DeadlineExceeded) {
		return http.StatusGatewayTimeout
	}
	if errors.Is(err, context.Canceled) {
		return 499
	}
	var downstream *cdf.Error
	if errors.As(err, &downstream) && downstream.Status >= 400 && downstream.Status <= 599 {
		backend.Logger.Debug("CDF request failed", "status", downstream.Status, "requestID", downstream.RequestID)
		return downstream.Status
	}
	return http.StatusBadRequest
}

func errorResponse(err error) backend.DataResponse {
	status := errorStatus(err)
	response := backend.ErrDataResponse(backend.Status(status), err.Error())
	var downstream *cdf.Error
	if errors.As(err, &downstream) {
		response.ErrorSource = backend.ErrorSourceDownstream
	}
	return response
}
