package plugin

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"regexp"
	"strconv"
	"strings"
	"time"

	// "time"

	"io"
	"net/http"

	"github.com/cognitedata/cognite-grafana-datasource/pkg/models"
	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana-plugin-sdk-go/backend/instancemgmt"
	"github.com/grafana/grafana-plugin-sdk-go/backend/log"
	"github.com/grafana/grafana-plugin-sdk-go/data"
	"github.com/jmespath-community/go-jmespath"
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
	ExternalId     string `json:"externalId,omitempty"`
	Version        string `json:"version,omitempty"`
	Space          string `json:"space,omitempty"`
	GraphQlQuery   string `json:"graphQlQuery,omitempty"`
	PostProcessing string `json:"postProcessing,omitempty"`
}

type queryModel struct {
	// Add fields if you need to pass specific parameters
	DataModelsQuery DataModelsQuery `json:"dataModellingV2Query,omitempty"`
}

type ErrorResponse struct {
	Message string `json:"message"`
	Code    int    `json:"code"`
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

		placeholder := fmt.Sprintf("$%s", key) // Example: $__from
		query = strings.ReplaceAll(query, placeholder, fmt.Sprintf("%v", value))
	}
	return query
}

// ColumnInfo represents information about a column in the data frame
type ColumnInfo struct {
	Name   string
	Values interface{} // This will be a typed slice like []*float64, []*string, etc.
}

// convertToDataFrame converts the transformed data to a Grafana data frame with improved handling
func (d *Datasource) convertToDataFrame(responseData interface{}, refID string) (*data.Frame, error) {
	// Handle different data structures
	switch v := responseData.(type) {
	case []interface{}:
		// Handle array of objects
		return d.convertArrayToDataFrame(v, refID)
	case map[string]interface{}:
		// Handle map structure - look for arrays within it
		return d.convertMapToDataFrame(v, refID)
	default:
		// Handle simple values - create a single column frame
		return d.createSimpleFrame(v, refID)
	}
}

// convertMapToDataFrame converts a map to a data frame by extracting arrays
func (d *Datasource) convertMapToDataFrame(dataMap map[string]interface{}, refID string) (*data.Frame, error) {
	// Look for arrays in the map structure
	arrays := d.findArraysInMap(dataMap)

	if len(arrays) == 0 {
		// No arrays found, create a simple key-value frame
		return d.createKeyValueFrame(dataMap, refID)
	}

	// Use the first array found for the main data frame
	firstArray := arrays[0]
	return d.convertArrayToDataFrame(firstArray, refID)
}

// findArraysInMap recursively finds arrays in a map structure
func (d *Datasource) findArraysInMap(dataMap map[string]interface{}) [][]interface{} {
	var arrays [][]interface{}

	for _, value := range dataMap {
		switch v := value.(type) {
		case []interface{}:
			arrays = append(arrays, v)
		case map[string]interface{}:
			// Recursively search nested maps
			nestedArrays := d.findArraysInMap(v)
			arrays = append(arrays, nestedArrays...)
		}
	}

	return arrays
}

// convertArrayToDataFrame converts an array of objects to a data frame
func (d *Datasource) convertArrayToDataFrame(dataArray []interface{}, refID string) (*data.Frame, error) {
	if len(dataArray) == 0 {
		return data.NewFrame(refID), nil
	}

	// Analyze the structure to determine columns
	columns := d.analyzeStructure(dataArray)

	// Create the data frame
	frame := data.NewFrame(refID)

	// Add fields for each column
	for _, col := range columns {
		field := data.NewField(col.Name, nil, col.Values)
		frame.Fields = append(frame.Fields, field)
	}

	return frame, nil
}

// analyzeStructure analyzes an array of objects to determine column structure
func (d *Datasource) analyzeStructure(dataArray []interface{}) []ColumnInfo {
	if len(dataArray) == 0 {
		return nil
	}

	// Check if this is a GraphQL edges pattern (array of objects with 'node' property)
	if d.isGraphQLEdgesPattern(dataArray) {
		return d.analyzeGraphQLEdgesStructure(dataArray)
	}

	// Get all possible column names from all objects
	columnNames := make(map[string]bool)
	for _, item := range dataArray {
		if obj, ok := item.(map[string]interface{}); ok {
			for key := range obj {
				columnNames[key] = true
			}
		}
	}

	// Create columns with proper types
	var columns []ColumnInfo
	for colName := range columnNames {
		// Collect all values for this column
		values := make([]interface{}, len(dataArray))
		for i, item := range dataArray {
			if obj, ok := item.(map[string]interface{}); ok {
				values[i] = obj[colName]
			}
		}

		// Determine the best type for this column
		typedValues := d.convertToTypedSlice(values)
		columns = append(columns, ColumnInfo{
			Name:   colName,
			Values: typedValues,
		})
	}

	return columns
}

// isGraphQLEdgesPattern checks if the array follows GraphQL edges pattern
func (d *Datasource) isGraphQLEdgesPattern(dataArray []interface{}) bool {
	if len(dataArray) == 0 {
		return false
	}

	// Check if most items have a 'node' property
	nodeCount := 0
	for _, item := range dataArray {
		if obj, ok := item.(map[string]interface{}); ok {
			if _, hasNode := obj["node"]; hasNode {
				nodeCount++
			}
		}
	}

	// Consider it edges pattern if more than 50% of items have 'node' property
	return nodeCount > len(dataArray)/2
}

// analyzeGraphQLEdgesStructure analyzes GraphQL edges structure and extracts node properties
func (d *Datasource) analyzeGraphQLEdgesStructure(dataArray []interface{}) []ColumnInfo {
	// Extract all node objects
	nodeArray := make([]interface{}, 0, len(dataArray))
	for _, item := range dataArray {
		if obj, ok := item.(map[string]interface{}); ok {
			if node, hasNode := obj["node"]; hasNode && node != nil {
				nodeArray = append(nodeArray, node)
			}
		}
	}

	if len(nodeArray) == 0 {
		// Fallback to regular analysis if no nodes found
		return d.analyzeRegularStructure(dataArray)
	}

	// Analyze the node objects to determine column structure
	return d.analyzeRegularStructure(nodeArray)
}

// analyzeRegularStructure analyzes regular object structure (extracted from original analyzeStructure)
func (d *Datasource) analyzeRegularStructure(dataArray []interface{}) []ColumnInfo {
	if len(dataArray) == 0 {
		return nil
	}

	// Get all possible column names from all objects
	columnNames := make(map[string]bool)
	for _, item := range dataArray {
		if obj, ok := item.(map[string]interface{}); ok {
			for key := range obj {
				columnNames[key] = true
			}
		}
	}

	// Create columns with proper types
	var columns []ColumnInfo
	for colName := range columnNames {
		// Collect all values for this column
		values := make([]interface{}, len(dataArray))
		for i, item := range dataArray {
			if obj, ok := item.(map[string]interface{}); ok {
				values[i] = obj[colName]
			}
		}

		// Determine the best type for this column with field name hints
		typedValues := d.convertToTypedSliceWithHints(values, colName)
		columns = append(columns, ColumnInfo{
			Name:   colName,
			Values: typedValues,
		})
	}

	return columns
}

// convertToTypedSlice converts a slice of interface{} to a properly typed slice
func (d *Datasource) convertToTypedSlice(values []interface{}) interface{} {
	if len(values) == 0 {
		return []*string{}
	}

	// Determine the predominant type
	typeCount := make(map[string]int)
	for _, val := range values {
		if val == nil {
			continue
		}

		// Check for datetime patterns first
		if d.isDateTime(val) {
			typeCount["datetime"]++
		} else {
			switch val.(type) {
			case float64, int, int64, float32:
				typeCount["number"]++
			case bool:
				typeCount["boolean"]++
			case string:
				typeCount["string"]++
			default:
				typeCount["string"]++ // Default to string for complex types
			}
		}
	}

	// Find the most common type
	maxCount := 0
	bestType := "string"
	for t, count := range typeCount {
		if count > maxCount {
			maxCount = count
			bestType = t
		}
	}

	// Convert to the appropriate typed slice
	switch bestType {
	case "datetime":
		result := make([]*time.Time, len(values))
		for i, val := range values {
			if val == nil {
				result[i] = nil
			} else {
				if timeVal, ok := d.convertToDateTime(val); ok {
					result[i] = &timeVal
				} else {
					result[i] = nil
				}
			}
		}
		return result
	case "number":
		result := make([]*float64, len(values))
		for i, val := range values {
			if val == nil {
				result[i] = nil
			} else {
				if num, ok := d.convertToFloat64(val); ok {
					result[i] = &num
				} else {
					result[i] = nil
				}
			}
		}
		return result
	case "boolean":
		result := make([]*bool, len(values))
		for i, val := range values {
			if val == nil {
				result[i] = nil
			} else if boolVal, ok := val.(bool); ok {
				result[i] = &boolVal
			} else {
				result[i] = nil
			}
		}
		return result
	default: // string
		result := make([]*string, len(values))
		for i, val := range values {
			if val == nil {
				result[i] = nil
			} else {
				strVal := fmt.Sprintf("%v", val)
				result[i] = &strVal
			}
		}
		return result
	}
}

// isDateTime checks if a value appears to be a datetime
func (d *Datasource) isDateTime(val interface{}) bool {
	strVal, ok := val.(string)
	if !ok {
		return false
	}

	// Check for common datetime patterns
	datetimePatterns := []string{
		// ISO 8601 patterns
		`^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?Z?$`,              // 2025-01-21T12:33:54.045Z
		`^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?[+-]\d{2}:\d{2}$`, // 2025-01-21T12:33:54.045+01:00
		`^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?$`,                // 2025-01-21T12:33:54.045
		// Common field name patterns
	}

	for _, pattern := range datetimePatterns {
		if matched, _ := regexp.MatchString(pattern, strVal); matched {
			return true
		}
	}

	return false
}

// isDateTimeField checks if a field name suggests it contains datetime data
func (d *Datasource) isDateTimeField(fieldName string) bool {
	lowerField := strings.ToLower(fieldName)

	// Common datetime field patterns
	datetimeFields := []string{
		"time", "date", "created", "updated", "modified", "timestamp",
		"createdtime", "updatedtime", "modifiedtime", "createdat", "updatedat",
		"lastupdated", "lastmodified", "lastaccessed", "expiry", "expires",
	}

	for _, pattern := range datetimeFields {
		if strings.Contains(lowerField, pattern) {
			return true
		}
	}

	return false
}

// convertToDateTime converts various datetime formats to time.Time
func (d *Datasource) convertToDateTime(val interface{}) (time.Time, bool) {
	strVal, ok := val.(string)
	if !ok {
		return time.Time{}, false
	}

	// Try common datetime formats
	formats := []string{
		time.RFC3339,                  // 2025-01-21T12:33:54Z
		time.RFC3339Nano,              // 2025-01-21T12:33:54.045Z
		"2006-01-02T15:04:05.000Z",    // 2025-01-21T12:33:54.045Z
		"2006-01-02T15:04:05.000000Z", // 2025-01-21T12:33:54.045123Z
		"2006-01-02T15:04:05",         // 2025-01-21T12:33:54
		"2006-01-02T15:04:05.000",     // 2025-01-21T12:33:54.045
		"2006-01-02T15:04:05.000000",  // 2025-01-21T12:33:54.045123
		"2006-01-02 15:04:05",         // 2025-01-21 12:33:54
		"2006-01-02",                  // 2025-01-21
	}

	for _, format := range formats {
		if t, err := time.Parse(format, strVal); err == nil {
			log.DefaultLogger.Debug("Successfully converted datetime", "value", strVal, "format", format, "parsed", t.Format(time.RFC3339))
			return t, true
		}
	}

	log.DefaultLogger.Debug("Failed to convert datetime", "value", strVal)
	return time.Time{}, false
}

// convertToFloat64 converts various numeric types to float64
func (d *Datasource) convertToFloat64(val interface{}) (float64, bool) {
	switch v := val.(type) {
	case float64:
		return v, true
	case float32:
		return float64(v), true
	case int:
		return float64(v), true
	case int64:
		return float64(v), true
	case string:
		if f, err := strconv.ParseFloat(v, 64); err == nil {
			return f, true
		}
	}
	return 0, false
}

// createKeyValueFrame creates a simple key-value frame from a map
func (d *Datasource) createKeyValueFrame(dataMap map[string]interface{}, refID string) (*data.Frame, error) {
	frame := data.NewFrame(refID)

	keys := make([]*string, 0, len(dataMap))
	values := make([]*string, 0, len(dataMap))

	for key, value := range dataMap {
		keys = append(keys, &key)
		valueStr := fmt.Sprintf("%v", value)
		values = append(values, &valueStr)
	}

	frame.Fields = append(frame.Fields, data.NewField("key", nil, keys))
	frame.Fields = append(frame.Fields, data.NewField("value", nil, values))

	return frame, nil
}

// createSimpleFrame creates a frame with a single value
func (d *Datasource) createSimpleFrame(value interface{}, refID string) (*data.Frame, error) {
	frame := data.NewFrame(refID)

	valueStr := fmt.Sprintf("%v", value)
	frame.Fields = append(frame.Fields, data.NewField("value", nil, []*string{&valueStr}))

	return frame, nil
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

	dataModelsQuery := queryParameters.DataModelsQuery
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
		Data   *map[string]interface{} `json:"data,omitempty"`
		Errors *[]ErrorItemResult      `json:"errors,omitempty"`
		Error  *ErrorResponse          `json:"error,omitempty"`
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

	postProcessingExpr := queryParameters.DataModelsQuery.PostProcessing
	data := *gqlResponse.Data

	log.DefaultLogger.Debug(fmt.Sprintf("Post Processing Expression: %v", postProcessingExpr))

	var transformedRes interface{}

	// Handle empty post-processing expression
	if strings.TrimSpace(postProcessingExpr) == "" {
		log.DefaultLogger.Debug("Empty post-processing expression, using raw data")
		transformedRes = data
	} else {
		var err error
		transformedRes, err = jmespath.Search(postProcessingExpr, data)
		if err != nil {
			return backend.ErrDataResponse(backend.StatusInternal, fmt.Sprintf("error transforming JSON response: %v", err))
		}
	}

	log.DefaultLogger.Debug(fmt.Sprintf("Transformed Result: %v", transformedRes))

	// Use the improved data frame conversion
	newFrame, err := d.convertToDataFrame(transformedRes, query.RefID)
	if err != nil {
		return backend.ErrDataResponse(backend.StatusInternal, fmt.Sprintf("error converting data to frame: %v", err))
	}

	// Use the new frame directly
	frame = newFrame
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

// convertToTypedSliceWithHints converts a slice with field name hints for better type detection
func (d *Datasource) convertToTypedSliceWithHints(values []interface{}, fieldName string) interface{} {
	if len(values) == 0 {
		return []*string{}
	}

	// Determine the predominant type
	typeCount := make(map[string]int)
	for _, val := range values {
		if val == nil {
			continue
		}

		// Check for datetime patterns first, including field name hints
		if d.isDateTime(val) || d.isDateTimeField(fieldName) {
			typeCount["datetime"]++
		} else {
			switch val.(type) {
			case float64, int, int64, float32:
				typeCount["number"]++
			case bool:
				typeCount["boolean"]++
			case string:
				typeCount["string"]++
			default:
				typeCount["string"]++ // Default to string for complex types
			}
		}
	}

	// Find the most common type
	maxCount := 0
	bestType := "string"
	for t, count := range typeCount {
		if count > maxCount {
			maxCount = count
			bestType = t
		}
	}

	// Special handling: if field name suggests datetime and we have string values, try datetime conversion
	if d.isDateTimeField(fieldName) && bestType == "string" {
		// Check if any values can be converted to datetime
		canConvertCount := 0
		for _, val := range values {
			if val != nil {
				if _, ok := d.convertToDateTime(val); ok {
					canConvertCount++
				}
			}
		}
		// If more than 50% can be converted, treat as datetime
		if canConvertCount > len(values)/2 {
			bestType = "datetime"
		}
	}

	// Convert to the appropriate typed slice
	switch bestType {
	case "datetime":
		result := make([]*time.Time, len(values))
		for i, val := range values {
			if val == nil {
				result[i] = nil
			} else {
				if timeVal, ok := d.convertToDateTime(val); ok {
					result[i] = &timeVal
				} else {
					result[i] = nil
				}
			}
		}
		return result
	case "number":
		result := make([]*float64, len(values))
		for i, val := range values {
			if val == nil {
				result[i] = nil
			} else {
				if num, ok := d.convertToFloat64(val); ok {
					result[i] = &num
				} else {
					result[i] = nil
				}
			}
		}
		return result
	case "boolean":
		result := make([]*bool, len(values))
		for i, val := range values {
			if val == nil {
				result[i] = nil
			} else if boolVal, ok := val.(bool); ok {
				result[i] = &boolVal
			} else {
				result[i] = nil
			}
		}
		return result
	default: // string
		result := make([]*string, len(values))
		for i, val := range values {
			if val == nil {
				result[i] = nil
			} else {
				strVal := fmt.Sprintf("%v", val)
				result[i] = &strVal
			}
		}
		return result
	}
}
