package plugin

import (
	"compress/gzip"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/cognitedata/cognite-grafana-datasource/pkg/cdf"
)

func newTestDatasource(t *testing.T, handler http.HandlerFunc) *Datasource {
	t.Helper()
	server := httptest.NewTLSServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Header.Get("Content-Encoding") == "gzip" {
			reader, err := gzip.NewReader(r.Body)
			if err != nil {
				t.Error(err)
				w.WriteHeader(400)
				return
			}
			defer reader.Close()
			r.Body = reader
		}
		w.Header().Set("Content-Type", "application/json")
		handler(w, r)
	}))
	t.Cleanup(server.Close)
	project := "test-project"
	settings := cdf.Settings{
		APIHost:     strings.TrimPrefix(server.URL, "https://"),
		Project:     &project,
		PassThrough: true,
	}
	client, err := cdf.NewClient(settings, "", server.Client())
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(client.Close)
	return &Datasource{
		client:   client,
		settings: settings,
	}
}
