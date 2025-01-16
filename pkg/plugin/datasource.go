package plugin

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"strings"

	// "time"
	"errors"
	"io"
	"net/http"

	"github.com/cognitedata/cognite-grafana-datasource/pkg/models"
	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana-plugin-sdk-go/backend/instancemgmt"
	"github.com/grafana/grafana-plugin-sdk-go/backend/log"
	"github.com/grafana/grafana-plugin-sdk-go/data"
	"github.com/grafana/infinity-libs/lib/go/jsonframer"
)

// Make sure Datasource implements required interfaces. This is important to do
// since otherwise we will only get a not implemented error response from plugin in
// runtime. In this example datasource instance implements backend.QueryDataHandler,
// backend.CheckHealthHandler interfaces. Plugin should not implement all these
// interfaces - only those which are required for a particular task.
var (
	_ backend.QueryDataHandler      = (*Datasource)(nil)
	_ backend.CheckHealthHandler    = (*Datasource)(nil)
	_ instancemgmt.InstanceDisposer = (*Datasource)(nil)
)

// NewDatasource creates a new datasource instance.
func NewDatasource(_ context.Context, _ backend.DataSourceInstanceSettings) (instancemgmt.Instance, error) {
	return &Datasource{}, nil
}

// Datasource is an example datasource which can respond to data queries, reports
// its health and has streaming skills.
type Datasource struct{}

// Dispose here tells plugin SDK that plugin wants to clean up resources when a new instance
// created. As soon as datasource settings change detected by SDK old datasource instance will
// be disposed and a new one will be created using NewSampleDatasource factory function.
func (d *Datasource) Dispose() {
	// Clean up datasource instance resources.
}


func GetProjectURL(ctx context.Context, settings models.PluginSettings, query queryModel, includeSect bool) (string, error) {
	var cluster string
	if settings.CogniteApiUrl != "" {
		cluster = settings.CogniteApiUrl
	} else {
		cluster = settings.ClusterUrl
	}
	var project string
	if settings.CogniteProject != "" {
		project = settings.CogniteProject
	} else {
		project = settings.DefaultProject
	}
	
	clusterUrl := fmt.Sprintf("https://%s", cluster)
	projectUrl := fmt.Sprintf("%s/api/v1/projects/%s", clusterUrl, project)

	log.DefaultLogger.Debug(fmt.Sprintf("projectUrl: %s", projectUrl))

	return projectUrl, nil
	
}

func GetRequest(ctx context.Context, settings models.PluginSettings, body io.Reader, query queryModel, requestHeaders map[string]string, includeSect bool, queryUrl string) (req *http.Request, err error) {
	req, err = http.NewRequestWithContext(ctx, http.MethodPost, queryUrl, body)
	// req = ApplyAcceptHeader(query, settings, req, includeSect)
	// req = ApplyContentTypeHeader(query, settings, req, includeSect)
	req = ApplyForwardedOAuthIdentity(requestHeaders, settings, req, includeSect)
	return req, err
}

// QueryData handles multiple queries and returns multiple responses.
// req contains the queries []DataQuery (where each query contains RefID as a unique identifier).
// The QueryDataResponse contains a map of RefID to the response for each query, and each response
// contains Frames ([]*Frame).
func (d *Datasource) QueryData(ctx context.Context, req *backend.QueryDataRequest) (*backend.QueryDataResponse, error) {
	// create response struct
	response := backend.NewQueryDataResponse()

	// log.DefaultLogger.Debug("Request", req)

	if req.PluginContext.DataSourceInstanceSettings == nil {
		return nil, fmt.Errorf("data source instance settings are not set")
	}

	settings, err := models.LoadPluginSettings(*req.PluginContext.DataSourceInstanceSettings)
	if err != nil {
		return nil, err
	}

	client := &http.Client{}
	client = ApplyOAuthClientCredentials(ctx, client, *settings)

	projectUrl, err := GetProjectURL(ctx, *settings, queryModel{}, true)
	headers := req.Headers

	// loop over queries and execute them individually.
	for _, q := range req.Queries {
		res := d.query(ctx, *settings, *client, headers, projectUrl, q)

		// save the response in a hashmap
		// based on with RefID as identifier
		response.Responses[q.RefID] = res
	}

	return response, nil
}

type DataModelsQuery struct {
	ExternalId string `json:"externalId,omitempty"`
	Version string `json:"version,omitempty"`
	Space string `json:"space,omitempty"`
	GraphQlQuery string `json:"graphQlQuery,omitempty"`
	PostProcessing string `json:"postProcessing,omitempty"`
}

type queryModel struct {
    // Add fields if you need to pass specific parameters
	DataModelsQuery DataModelsQuery `json:"dataModellingV2Query,omitempty"`
}

type ErrorResponse struct {
	Message string `json:"message"`
	Code int `json:"code"`
}

type ErrorItemResult struct {
	Message string `json:"message"`
}

// InterpolateVariables replaces variables in the query string with actual values from ScopedVars
func InterpolateVariables(query string, scopedVars map[string]interface{}) string {
    // Iterate through all scopedVars and replace them in the query
    for key, val := range scopedVars {
        valueMap, ok := val.(map[string]interface{})
        if !ok {
            continue
        }

        value, exists := valueMap["value"]
        if !exists {
            continue
        }

        placeholder := fmt.Sprintf("$%s", key)  // Example: $__from
        query = strings.ReplaceAll(query, placeholder, fmt.Sprintf("%v", value))
    }
    return query
}


func (d *Datasource) query(ctx context.Context, settings models.PluginSettings, client http.Client, headers map[string]string, projectUrl string, query backend.DataQuery) backend.DataResponse {
    var response backend.DataResponse

    //Unmarshal the JSON into a generic map[string]interface{}
    var queryParameters queryModel
    err := json.Unmarshal(query.JSON, &queryParameters)
    if err != nil {
        return backend.ErrDataResponse(backend.StatusBadRequest, fmt.Sprintf("json unmarshal: %v", err.Error()))
    }
		
	scopedVars := map[string]interface{}{
		
		"__from": map[string]interface{}{
			// timestamp in milliseconds
			"value": query.TimeRange.From.UnixMilli(),
		},
		"__to": map[string]interface{}{
			"value": query.TimeRange.To.UnixMilli(),
		},
	}

	interpolatedQuery := InterpolateVariables(queryParameters.DataModelsQuery.GraphQlQuery, scopedVars)

	log.DefaultLogger.Debug(fmt.Sprintf("Interpolated Query: %s", interpolatedQuery))

    // Create the GraphQL request payload
    payload := map[string]string{
        "query": interpolatedQuery,
    }
    jsonPayload, err := json.Marshal(payload)
    if err != nil {
        return backend.ErrDataResponse(backend.StatusInternal, fmt.Sprintf("json marshal: %v", err.Error()))
    }
	
	dataModelsQuery	:= queryParameters.DataModelsQuery
	gqlEndpoint := fmt.Sprintf("%s/userapis/spaces/%s/datamodels/%s/versions/%s/graphql", projectUrl, dataModelsQuery.Space, dataModelsQuery.ExternalId, dataModelsQuery.Version)

    // Make the HTTP POST request to the GraphQL endpoint
	req, err := GetRequest(ctx, settings, bytes.NewBuffer(jsonPayload), queryParameters, headers, true, gqlEndpoint)
    if err != nil {
        return backend.ErrDataResponse(backend.StatusInternal, fmt.Sprintf("http request creation: %v", err.Error()))
    }

    // Set headers
    req.Header.Set("Content-Type", "application/json")

    // Perform the HTTP request
    resp, err := client.Do(req)
    if err != nil {
        return backend.ErrDataResponse(backend.StatusInternal, fmt.Sprintf("http request: %v", err.Error()))
    }
    defer resp.Body.Close()

    // Read the raw response body
    body, err := io.ReadAll(resp.Body)
    if err != nil {
        return backend.ErrDataResponse(backend.StatusInternal, fmt.Sprintf("read response body: %v", err.Error()))
    }

    // Log the raw response for inspection
    log.DefaultLogger.Debug(fmt.Sprintf("Raw GraphQL response: %s", string(body)))

    // Unmarshal the raw JSON into the expected structure
    var gqlResponse struct {
        Data *map[string]interface{} `json:"data,omitempty"`
		Errors *[]ErrorItemResult `json:"errors,omitempty"`
		Error *ErrorResponse `json:"error,omitempty"`
    }
    if err := json.Unmarshal(body, &gqlResponse); err != nil {
        return backend.ErrDataResponse(backend.StatusInternal, fmt.Sprintf("json unmarshal: %v", err.Error()))
    }

	if gqlResponse.Error != nil {
		log.DefaultLogger.Error(fmt.Sprintf("Error Response: %v", gqlResponse.Error))
		return backend.ErrDataResponse(backend.StatusInternal, fmt.Sprintf("API error: %v", gqlResponse.Error.Message))
	}

	if gqlResponse.Errors != nil {
		allErrors := "API errors:"
		for _, e := range *gqlResponse.Errors {
			allErrors += fmt.Sprintf("\n- %v", e.Message)
		}
		return backend.ErrDataResponse(backend.StatusInternal, allErrors)
	}

	if gqlResponse.Data == nil {
		return backend.ErrDataResponse(backend.StatusInternal, fmt.Sprintf("no data in response"))
	}

    // Log the unmarshalled response for inspection
    log.DefaultLogger.Debug(fmt.Sprintf("Unmarshalled GraphQL response: %v", gqlResponse.Data))

    // Create a data frame response based on the result
    frame := data.NewFrame("response")

	log.DefaultLogger.Debug(fmt.Sprintf("GQL result: %v", gqlResponse))

	columns := []jsonframer.ColumnSelector{
		// jsonframer.ColumnSelector{
		// 	Selector:  "data",
		// 	Alias:     "data",
		// 	Type:      "string",
		//     TimeFormat: "",
		// },
	}
	// for _, c := range query.Columns {
	// 	columns = append(columns, jsonframer.ColumnSelector{
	// 		Selector:   c.Selector,
	// 		Alias:      c.Text,
	// 		Type:       c.Type,
	// 		TimeFormat: c.TimeStampFormat,
	// 	})
	// }
	stringData, _ := json.Marshal(gqlResponse.Data)

	newFrame, err := jsonframer.ToFrame(string(stringData), jsonframer.FramerOptions{
		FrameName:    query.RefID,
		RootSelector: queryParameters.DataModelsQuery.PostProcessing,
		Columns:      columns,
	})

	if err != nil {
		if errors.Is(err, jsonframer.ErrInvalidRootSelector) || errors.Is(err, jsonframer.ErrInvalidJSONContent) || errors.Is(err, jsonframer.ErrEvaluatingJSONata) {
			return backend.ErrDataResponse(backend.StatusInternal, fmt.Sprintf("error converting json data to frame: %v", err))
		}
		return backend.ErrDataResponse(backend.StatusInternal, fmt.Sprintf("error converting json data to frame: %v", err))
	}
	if newFrame != nil {
		frame.Fields = append(frame.Fields, newFrame.Fields...)
	}
	// Add the frame to the response
    response.Frames = append(response.Frames, frame)

    return response
}

// CheckHealth handles health checks sent from Grafana to the plugin.
// The main use case for these health checks is the test button on the
// datasource configuration page which allows users to verify that
// a datasource is working as expected.
func (d *Datasource) CheckHealth(_ context.Context, req *backend.CheckHealthRequest) (*backend.CheckHealthResult, error) {
	res := &backend.CheckHealthResult{}
	_, err := models.LoadPluginSettings(*req.PluginContext.DataSourceInstanceSettings)

	if err != nil {
		res.Status = backend.HealthStatusError
		res.Message = "Unable to load settings"
		return res, nil
	}

	return &backend.CheckHealthResult{
		Status:  backend.HealthStatusOk,
		Message: "Data source is working",
	}, nil
}
