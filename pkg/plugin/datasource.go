package plugin

import (
	"context"
	"fmt"
	"log"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana-plugin-sdk-go/backend/instancemgmt"
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

	fmt.Println("\nhere 1")
	response := backend.NewQueryDataResponse()

	log.Default().Printf("QueryDataRequest: %v", req)

	// // loop over queries and execute them individually.
	// for _, q := range req.Queries {
	// 	res := d.query(ctx, req.PluginContext, q)

	// 	// save the response in a hashmap
	// 	// based on with RefID as identifier
	// 	response.Responses[q.RefID] = res
	// }

	return response, nil
}

// type queryModel struct {
// 	QueryText string `json:"queryText"`
// 	Constant  string `json:"constant"`
// }

// func generatePoints(startTime time.Time, endTime time.Time, sectionLength time.Duration) []time.Time {
// 	var points []time.Time

// 	currentTime := startTime
// 	for currentTime.Before(endTime) || currentTime.Equal(endTime) {
// 		points = append(points, currentTime)
// 		currentTime = currentTime.Add(sectionLength)
// 	}

// 	return points
// }

// // if interval is less than 1 minute = "xs" where x is the number of seconds
// // if interval less than 1-59 minutes = "xm" where x is the number of minutes
// // if interval less than 1-23 hours = "xh" where x is the number of hours
// // anything else round up to number of days xd
// // minimum number is 5 seconds
// func intervalToGranularity(interval time.Duration) string {
// 	var seconds = interval.Seconds()
// 	if seconds < 5 {
// 		return "5s"
// 	}
// 	var minutes = interval.Minutes()
// 	if minutes < 1 {
// 		return fmt.Sprintf("%ds", int(interval.Seconds()))
// 	}
// 	if minutes < 60 {
// 		return fmt.Sprintf("%dm", int(minutes))
// 	}
// 	var hours = interval.Hours()
// 	if hours < 24 {
// 		return fmt.Sprintf("%dh", int(hours))
// 	}
// 	var days = interval.Hours() / 24
// 	return fmt.Sprintf("%dd", int(days))
// }

// func loadCDFDataPoints(tsExternalId string, timeRange backend.TimeRange, interval time.Duration) *data.Frame {
// 	// Read client credentials from environment variables
// 	clientID := os.Getenv("CLIENT_ID")
// 	clientSecret := os.Getenv("CLIENT_SECRET")
// 	tenantID := os.Getenv("TENANT_ID")
// 	baseURL := os.Getenv("CDF_CLUSTER")
// 	project := os.Getenv("CDF_PROJECT")

// 	scopes := []string{
// 		fmt.Sprintf("%s/.default", baseURL),
// 		"offline_access",
// 		"openid",
// 		"profile",
// 	}

// 	fmt.Println("\nCreate the cred from the secret")
// 	var cred, err = confidential.NewCredFromSecret(clientSecret)
// 	if err != nil {
// 		log.Fatalf("Error creating cred from secret: %v", err)
// 	}

// 	fmt.Println("\nPrepare the confidential client")
// 	authorityURI := fmt.Sprintf("https://login.microsoftonline.com/%s", tenantID)
// 	confidentialClient, err := confidential.New(authorityURI, clientID, cred)
// 	if err != nil {
// 		log.Fatalf("Error creating confidential client: %v", err)
// 	}

// 	fmt.Println("\nGet the token")
// 	// Get a token for the app itself
// 	result, err := confidentialClient.AcquireTokenSilent(context.TODO(), scopes)
// 	if err != nil {
// 		// cache miss, authenticate with another AcquireToken... method
// 		result, err = confidentialClient.AcquireTokenByCredential(context.TODO(), scopes)
// 		if err != nil {
// 			log.Fatalf("Error acquiring token: %v", err)
// 		}
// 	}
// 	accessToken := result.AccessToken

// 	// let's try a more reasonable number of data points
// 	fmt.Println("\n### Data Points (for plotting)")
// 	fmt.Println(strconv.FormatInt(timeRange.From.UnixMilli(), 10))

// 	var granularity = intervalToGranularity(interval)

// 	fmt.Println("\n### Granularity")
// 	fmt.Println(granularity)

// 	var items = []dto.DataPointsQueryItem{
// 		{
// 			ExternalId:  tsExternalId,
// 			Start:       strconv.FormatInt(timeRange.From.UnixMilli(), 10),
// 			End:         strconv.FormatInt(timeRange.To.UnixMilli(), 10),
// 			Aggregates:  []string{"average"},
// 			Granularity: granularity,
// 			Limit:       10000,
// 		},
// 	}
// 	var start = time.Now()
// 	var dataPoints, err2 = api.RetrieveData(
// 		project,
// 		accessToken,
// 		baseURL,
// 		&items,
// 		nil, nil, nil, nil, nil, nil, nil,
// 	)
// 	var elapsed = time.Since(start)
// 	if err2 != nil {
// 		fmt.Println("Error:", err2)
// 	}

// 	if len(dataPoints.Items) == 0 {
// 		fmt.Println("Data Points Count:", 0)
// 		return data.NewFrame("response")
// 	}

// 	var dps = dataPoints.Items[0]

// 	if dps.DatapointType == nil {
// 		fmt.Println("Data Points Count:", 0)
// 		return data.NewFrame("response")
// 	}

// 	aggregateDatapointsType := dps.DatapointType.(*dto.DataPointListItem_AggregateDatapoints)
// 	aggregateDatapoints := aggregateDatapointsType.AggregateDatapoints.Datapoints
// 	values := make([]float64, 0, len(aggregateDatapoints))
// 	timestamps := make([]time.Time, 0, len(aggregateDatapoints))
// 	for _, datapoint := range aggregateDatapoints {
// 		if datapoint != nil {
// 			values = append(values, datapoint.Average)
// 			timestamp := time.Unix(0, datapoint.Timestamp*int64(time.Millisecond))
// 			timestamps = append(timestamps, timestamp)
// 		}
// 	}
// 	fmt.Println("Data Points Count:", len(values))
// 	fmt.Printf("Time taken: %s\n", elapsed)

// 	var frame = data.NewFrame(dps.ExternalId)

// 	// add fields.
// 	frame.Fields = append(frame.Fields,
// 		data.NewField("time", nil, timestamps),
// 		data.NewField("average", nil, values),
// 	)

// 	// RETURN
// 	return frame
// }

// func (d *Datasource) query(_ context.Context, pCtx backend.PluginContext, query backend.DataQuery) backend.DataResponse {
// 	var response backend.DataResponse

// 	fmt.Println("\nhere")

// 	// Unmarshal the JSON into our queryModel.
// 	var qm queryModel

// 	err := json.Unmarshal(query.JSON, &qm)
// 	if err != nil {
// 		return backend.ErrDataResponse(backend.StatusBadRequest, fmt.Sprintf("json unmarshal: %v", err.Error()))
// 	}

// 	fmt.Println("\nhere query text")
// 	fmt.Println(fmt.Sprintf("query text %s", qm.QueryText))
// 	// fmt.Println(qm.constant)

// 	// create data frame response.
// 	// For an overview on data frames and how grafana handles them:
// 	// https://grafana.com/developers/plugin-tools/introduction/data-frames

// 	frame := loadCDFDataPoints(qm.QueryText, query.TimeRange, query.Interval)

// 	fmt.Println("\nloaded")

// 	// add the frames to the response.
// 	response.Frames = append(response.Frames, frame)

// 	fmt.Println("\returning")

// 	return response
// }

// CheckHealth handles health checks sent from Grafana to the plugin.
// The main use case for these health checks is the test button on the
// datasource configuration page which allows users to verify that
// a datasource is working as expected.
func (d *Datasource) CheckHealth(_ context.Context, req *backend.CheckHealthRequest) (*backend.CheckHealthResult, error) {
	var status = backend.HealthStatusOk
	var message = "Data source is working"

	// if rand.Int()%2 == 0 {
	// 	status = backend.HealthStatusError
	// 	message = "randomized error"
	// }

	return &backend.CheckHealthResult{
		Status:  status,
		Message: message,
	}, nil
}
