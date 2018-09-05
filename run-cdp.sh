#!/bin/bash -e

mkdir -p /var/lib/grafana/plugins/cognite-grafana-datasource
cp -r /cognite-grafana-datasource /var/lib/grafana/plugins/cognite-grafana-datasource/dist

/run.sh
