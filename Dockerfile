FROM grafana/grafana:5.2.3
# Copy the plugin into the grafana plugin folder
COPY ./dist /cognite-grafana-datasource

COPY ./run-cdp.sh /run-cdp.sh

ENTRYPOINT ["/run-cdp.sh"]
