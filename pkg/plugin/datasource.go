package plugin

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"

	"github.com/cognitedata/cognite-grafana-datasource/pkg/cdf"
	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana-plugin-sdk-go/backend/httpclient"
	"github.com/grafana/grafana-plugin-sdk-go/backend/instancemgmt"
)

var (
	_ backend.QueryDataHandler      = (*Datasource)(nil)
	_ backend.CheckHealthHandler    = (*Datasource)(nil)
	_ backend.CallResourceHandler   = (*Datasource)(nil)
	_ instancemgmt.InstanceDisposer = (*Datasource)(nil)
)

type Datasource struct {
	client   *cdf.Client
	settings cdf.Settings
	// Incomplete provisioning must still allow the frontend editor to open.
	configErr error
}

func NewDatasource(ctx context.Context, settings backend.DataSourceInstanceSettings) (instancemgmt.Instance, error) {
	config, err := cdf.ParseSettings(settings.JSONData)
	if err != nil {
		return &Datasource{configErr: err}, nil
	}
	opts, err := settings.HTTPClientOptions(ctx)
	if err != nil {
		return nil, errors.New("Could not configure Grafana HTTP transport")
	}
	// Authorization is selected explicitly per request. Never forward a user's
	// Authorization header to the service-principal token endpoint.
	opts.ForwardHTTPHeaders = false
	transport, err := httpclient.New(opts)
	if err != nil {
		return nil, errors.New("Could not create Grafana HTTP transport")
	}
	client, err := cdf.NewClient(config, settings.DecryptedSecureJSONData["oauthClientSecret"], transport)
	if err != nil {
		transport.CloseIdleConnections()
		return &Datasource{configErr: err}, nil
	}
	return &Datasource{
		client:   client,
		settings: config,
	}, nil
}

func (d *Datasource) Dispose() {
	if d.client != nil {
		d.client.Close()
	}
}

func (d *Datasource) CheckHealth(ctx context.Context, req *backend.CheckHealthRequest) (*backend.CheckHealthResult, error) {
	if d.configErr != nil {
		return &backend.CheckHealthResult{Status: backend.HealthStatusError, Message: d.configErr.Error()}, nil
	}
	var result struct {
		Projects []struct {
			Name string `json:"projectUrlName"`
		} `json:"projects"`
	}
	if err := d.client.Inspect(ctx, req.GetHTTPHeader(backend.OAuthIdentityTokenHeaderName), &result); err != nil {
		var cdfErr *cdf.Error
		if errors.As(err, &cdfErr) && (cdfErr.Status == http.StatusUnauthorized || cdfErr.Status == http.StatusForbidden) {
			return &backend.CheckHealthResult{Status: backend.HealthStatusError, Message: "Your Cognite credentials are invalid"}, nil
		}
		return &backend.CheckHealthResult{Status: backend.HealthStatusError, Message: err.Error()}, nil
	}
	for _, project := range result.Projects {
		if project.Name == *d.settings.Project {
			return &backend.CheckHealthResult{Status: backend.HealthStatusOk, Message: "Your Cognite credentials are valid"}, nil
		}
	}
	return &backend.CheckHealthResult{Status: backend.HealthStatusError, Message: fmt.Sprintf("Cannot access '%s' project", *d.settings.Project)}, nil
}

type Query struct {
	Tab  string `json:"tab"`
	Hide bool   `json:"hide"`
}

func (d *Datasource) QueryData(ctx context.Context, req *backend.QueryDataRequest) (*backend.QueryDataResponse, error) {
	response := backend.NewQueryDataResponse()
	for _, q := range req.Queries {
		response.Responses[q.RefID] = d.query(ctx, q)
	}
	return response, nil
}

func (*Datasource) query(ctx context.Context, q backend.DataQuery) backend.DataResponse {
	if err := ctx.Err(); err != nil {
		return errorResponse(err)
	}
	if len(q.JSON) > maxQueryPayloadBytes {
		return backend.ErrDataResponse(http.StatusRequestEntityTooLarge, "Query payload exceeds 1 MiB")
	}
	var model *Query
	if len(q.JSON) > 0 {
		if err := json.Unmarshal(q.JSON, &model); err != nil || model == nil {
			return backend.ErrDataResponse(http.StatusBadRequest, "Invalid Cognite query JSON")
		}
		if model.Hide {
			return backend.DataResponse{}
		}
	}
	return backend.ErrDataResponse(backend.StatusNotImplemented, "Backend querying is not supported yet")
}
