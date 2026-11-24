package main

import (
	"os"

	"github.com/cognitedata/cognite-grafana-datasource/pkg/plugin"
	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana-plugin-sdk-go/backend/datasource"
)

func main() {
	if err := datasource.Manage("cognitedata-datasource", plugin.NewDatasource, datasource.ManageOpts{}); err != nil {
		backend.Logger.Error("Backend stopped", "error", err)
		os.Exit(1)
	}
}
