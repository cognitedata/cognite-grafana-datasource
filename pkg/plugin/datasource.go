package plugin

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	// "time"
	"errors"
	"io"
    "net/http"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana-plugin-sdk-go/backend/instancemgmt"
	"github.com/grafana/grafana-plugin-sdk-go/data"
	"github.com/cognitedata/cognite-grafana-datasource/pkg/models"
	"github.com/grafana/grafana-plugin-sdk-go/backend/log"
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

// QueryData handles multiple queries and returns multiple responses.
// req contains the queries []DataQuery (where each query contains RefID as a unique identifier).
// The QueryDataResponse contains a map of RefID to the response for each query, and each response
// contains Frames ([]*Frame).
func (d *Datasource) QueryData(ctx context.Context, req *backend.QueryDataRequest) (*backend.QueryDataResponse, error) {
	// create response struct
	response := backend.NewQueryDataResponse()

	log.DefaultLogger.Info("request", req)

	// loop over queries and execute them individually.
	for _, q := range req.Queries {
		res := d.query(ctx, req.PluginContext, q)

		// save the response in a hashmap
		// based on with RefID as identifier
		response.Responses[q.RefID] = res
	}

	return response, nil
}

type queryModel struct {
    // Add fields if you need to pass specific parameters
    QueryText string `json:"queryText,omitempty"`
	RootSelector string `json:"rootSelector,omitempty"`
}

var gqlendpoint = "https://westeurope-1.cognitedata.com/api/v1/projects/cognite-simulator-integration/userapis/spaces/shower-mixer/datamodels/ShowerMixer/versions/1/graphql"
var auth = "Bearer ..."


func (d *Datasource) query(_ context.Context, pCtx backend.PluginContext, query backend.DataQuery) backend.DataResponse {
    var response backend.DataResponse

    //Unmarshal the JSON into a generic map[string]interface{}
    var queryParameters queryModel
    err := json.Unmarshal(query.JSON, &queryParameters)
    if err != nil {
        return backend.ErrDataResponse(backend.StatusBadRequest, fmt.Sprintf("json unmarshal: %v", err.Error()))
    }

    // Create the GraphQL request payload
    payload := map[string]string{
        "query": queryParameters.QueryText,
    }
    jsonPayload, err := json.Marshal(payload)
    if err != nil {
        return backend.ErrDataResponse(backend.StatusInternal, fmt.Sprintf("json marshal: %v", err.Error()))
    }

    // Make the HTTP POST request to the GraphQL endpoint
    req, err := http.NewRequest("POST", gqlendpoint, bytes.NewBuffer(jsonPayload))
    if err != nil {
        return backend.ErrDataResponse(backend.StatusInternal, fmt.Sprintf("http request creation: %v", err.Error()))
    }

    // Set headers (e.g., authorization)
    req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", auth)

    // Perform the HTTP request
    client := &http.Client{}
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
    log.DefaultLogger.Info(fmt.Sprintf("raw GraphQL response: %s", string(body)))

    // Unmarshal the raw JSON into the expected structure
    var gqlResponse struct {
        Data map[string]interface{} `json:"data"`
    }
    if err := json.Unmarshal(body, &gqlResponse); err != nil {
        return backend.ErrDataResponse(backend.StatusInternal, fmt.Sprintf("json unmarshal: %v", err.Error()))
    }

    // Log the unmarshalled response for inspection
    log.DefaultLogger.Info(fmt.Sprintf("unmarshalled GraphQL response: %v", gqlResponse.Data))

    // Create a data frame response based on the result
    frame := data.NewFrame("response")

	log.DefaultLogger.Info(fmt.Sprintf("gpl result: %v", gqlResponse))

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
		RootSelector: queryParameters.RootSelector,
		Columns:      columns,
	})

	if err != nil {
		if errors.Is(err, jsonframer.ErrInvalidRootSelector) || errors.Is(err, jsonframer.ErrInvalidJSONContent) || errors.Is(err, jsonframer.ErrEvaluatingJSONata) {
			return backend.ErrDataResponse(backend.StatusInternal, fmt.Sprintf("error converting json data to frame: %w", err))
		}
		return backend.ErrDataResponse(backend.StatusInternal, fmt.Sprintf("error converting json data to frame: %w", err))
	}
	if newFrame != nil {
		frame.Fields = append(frame.Fields, newFrame.Fields...)
	}
	// // Add the frame to the response
    response.Frames = append(response.Frames, frame)

    return response
}

// CheckHealth handles health checks sent from Grafana to the plugin.
// The main use case for these health checks is the test button on the
// datasource configuration page which allows users to verify that
// a datasource is working as expected.
func (d *Datasource) CheckHealth(_ context.Context, req *backend.CheckHealthRequest) (*backend.CheckHealthResult, error) {
	res := &backend.CheckHealthResult{}
	config, err := models.LoadPluginSettings(*req.PluginContext.DataSourceInstanceSettings)

	if err != nil {
		res.Status = backend.HealthStatusError
		res.Message = "Unable to load settings"
		return res, nil
	}

	if config.Secrets.ApiKey == "" {
		res.Status = backend.HealthStatusError
		res.Message = "API key is missing"
		return res, nil
	}

	return &backend.CheckHealthResult{
		Status:  backend.HealthStatusOk,
		Message: "Data source is working",
	}, nil
}
