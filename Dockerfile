FROM grafana/grafana:10.2.0
# Copy the plugin into the grafana plugin folder
COPY ./dist /cognite-grafana-datasource

COPY ./run-cdp.sh /run-cdp.sh

ENTRYPOINT ["/run-cdp.sh"]
