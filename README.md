# Cognite Data Source for Grafana

[Grafana](https://grafana.com/) datasource for [Cognite Data Fusion](https://cognite.com/).

---

## Features

- Plot time series from the Core Data Model, by search or through a GraphQL query on a data model
- Query activities, and records from streams
- Use variables to create templated dashboards, from GraphQL queries or asset queries
- Add event annotations to graphs
- Apply custom functions to timeseries

> **Asset-centric features are deprecated.** CDF retires the asset-centric APIs on December 31, 2027. The time series search, time series from asset, custom query, events and relationships tabs, asset variables and event annotations run on those APIs. Use the Core Data Model tabs instead. See [Deprecated and retired features](https://docs.cognite.com/cdf/deprecated).

![Select Timeseries](https://raw.githubusercontent.com/cognitedata/cognite-grafana-datasource/release-v2/images/readme/image2.png)

## Installation

The easiest way to install this plugin is to follow the installation instructions on [this page](https://grafana.com/grafana/plugins/cognitedata-datasource/?tab=installation).

## Documentation

To learn more about the connector please visit our [documentation](https://docs.cognite.com/cdf/dashboards/guides/grafana/getting_started).

## Feedback

If you find any bugs, or have any suggestions, please [visit support portal](https://cognite.zendesk.com/hc/en-us).


## Development

See [here](https://github.com/cognitedata/cognite-grafana-datasource/blob/master/DEVELOPMENT.md).
