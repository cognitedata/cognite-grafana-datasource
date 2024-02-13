# Releases

This article documents the ongoing improvements we're making to the **Cognite
Data Source for Grafana**.

## 4.1.1 - February 14th, 2024

### Bug fixes

- Fixed an issue with the custum query where floats with more than 7 digits after decimal point where not supported

## 4.1.0 - February 7th, 2024

### Features

- Added new time series property `unitExternalId`
- Added support to filter time series by `unitExternalId` and `unitQuantity` in
  custom queries
- Added support to query data points with unit conversion in custom queries
- Small UI improvement to the query field in the custom query tab

### Bug fixes

- Patched plugin dependencies to fix deprecation errors

## 4.0.1 - November 7th, 2023

### Bug fixes

- Patched regressions introduced after the migration to React:
  - Events table `activeAtTime` filter is now working as before
  - Annotations filters are applied correctly as before
  - Added back hints and examples for annotation query
- Multiple dependencies have been updated to fix security vulnerabilities

## 4.0.0 - October 12th, 2023

### Features

- Migrate Annotation editor from Angular to React
- Bumped minimum Grafana version requirement to v10
- Events are returned in dataframe format

## 3.1.0 - May 10th, 2023

### Features

- Added support for the new version of CDF Data Models (GraphQL)
- Added an option to sort Events table

## 3.0.1 - April 3rd, 2023

- Patched plugin dependencies
- Fixed the wording for the CDF host paramether in the plugin configuration

## 3.0.0 - November 21st, 2022

- The connector dependencies has been updated and the connector now requires
  Grafana v8 or later.
- [Flexible Data Modelling](https://hub.cognite.com/groups/flexible-data-modeling-early-adopter-208)
  is now added as a preview feature. You need enable it on the data source
  settings. The plugin will visualize tables and time series which has been
  modelled in Cognite's new Flexible Data Model
- [Extraction Pipelines](https://docs.cognite.com/cdf/integration/guides/interfaces/about_integrations)
  is added as a preview feature. You can now see the latest status of your
  extraction pipelines and runs inside Grafana.
- Advanced filtering of events now also supports aggregates.
- Variables created with an asset-query can now return `externalId` and `name`
  as value in addition to `id`. This is useful when using a variable inside FDM
  graphQl query.

## 2.6.0 - August 4th, 2022

### Kubernetes grafana operator support

- The connector now supports being used with the Kubernetes
  [Grafana operator](https://github.com/grafana-operator/grafana-operator) as
  the
  [GrafanaDataSource CRD](https://github.com/grafana-operator/grafana-operator/blob/master/documentation/datasources.md).
  In the operator you specify the Cognite project in `defaultProject` parameter
  and the API URL as the `clusterUrl` parameter. In the operator you can specify
  a data source using the syntax below:

```
datasources:
  - access: proxy
    editable: false
    isDefault: true
    jsonData:
      clusterUrl: westeurope-1.cognitedata.com # other examples are api.cognitedata.com, az-eastus-1.cognitedata.com etc
      defaultProject: <cdf-project>
      oauthPassThru: true
    name: CDF
    type: cognitedata-datasource
name: cdf.yaml
```

### Advanced filter support for events (alpha)

- Advanced filtering support for events have been added as separate input box in
  the events tab. Enable this in the data source settings.
- [API documentation](https://pr-ark-codegen-1444.specs.preview.cogniteapp.com/v1.json.html#operation/advancedListEvents)

### Relationships updates

- All drop downs in the relationships tab are now sorted and searchable

## 2.5.0 - June 1, 2022

### Relationships support

- The connector now supports the CDF relationships resource type. Read more
  about relationships at
  [Relationships documentation](https://docs.cognite.com/dev/concepts/resource_types/relationships).
- With relationships support you can now fetch time series based on
  relationships in the "Time series from asset" tab. Relationships can be
  filtered on data set, labels and active relationships based on the time filter
  selected in Grafana.
- A new relationships tab has been added which can be used to utilize Grafana's
  Node Graph visualization plugin, or a new (alpha) custom visualization plugin
  which can be found at
  [cognite-grafana-relationships-visualization](https://github.com/cognitedata/cognite-grafana-relationships-visualization)

### Templates support (preview)

- A new templates tab has been added which support the CDF templates feature
  (preview). Enable this in the data source settings.
- Using templates with Grafana will allow you to dynamically scale your
  dashboards when adding equipment.
- Documentation: https://docs.cognite.com/dev/concepts/resource_types/templates

## 2.4.0 - August 20, 2021

### Features

- OAuth 2.0 client credentials grant flow to authenticate and authorize against
  CDF.

## 2.3.0 - June 1, 2021

### Features

- Ability to link variables so that the value of one variable can be used as an
  input to another.

## 2.2.0 - April 6, 2021

### Features

- Tabular representation of events data.
- Event annotation query shows unfinished events by default.
- Support for OAuth authentication with CDF.
- Option to fetch only the latest data point for the time series.

## 2.1.1 - November 23, 2020

### Bug fixes:

- Support variables in `time series by asset` query. In version 2.1.0
  `$variable` used as an `Asset tag` worked for earlier created dashboards, but
  it was impossible to create a new panel with the same capability.

## 2.1.0 - November 19, 2020

- The data source requires Grafana version `7.0.6` or above.
- Time series are now saved to dashboards by their `externalId` where possible.
  This allows you to switch between CDF projects that contain time series with
  matching `externalIds`.
- Support for
  [synthetic time series alignment](https://docs.cognite.com/dev/concepts/resource_types/synthetic_timeseries.html#alignment).
- Rewrote data source GUI to React.
- Updated CDF logo to match light/dark theme.

## 2.0.1 - August 25, 2020

### Bug fixes:

- **\[Custom query\]** Option to display legend label as a plain text instead of
  expression

  Example for query: `ts{id=1} + ts{id=2} + 1`:

  - User label `custom name` results in `custom name` label. (No specific
    timeseries referenced in the label)
  - User label `{{name}}` results in `timeseries_name_1 + timeseries_name_2 + 1`
    label. (This works the same way as before)
- **\[Custom query\]** Improved error handling
  - HTTP 500 errors messages are visible from the GUI
- **\[Custom query\]** Default granularity falls back to 1 second if shorter
  value is provided
  - Previously, selecting a time span less than 10 minutes resulted in a HTTP
    400 error.

## 2.0.0 - June 29, 2020

### General improvements

- A new query language inspired by PromQL and compatible with synthetic time
  series in CDF.
  [Learn more](https://docs.cognite.com/cdf/dashboards/guides/grafana/timeseries.html#custom-queries).
- Support for all filtering capabilities available in
  [CDF API v1](https://docs.cognite.com/api/v1/) for the respective resource
  types (assets, events, times series).
- Any future **filtering** capabilities added to CDF API v1 will be
  **automatically supported** by the data source (filters are passed directly to
  CDF).
- Query expressions resulting in errors now **displays error messages** in the
  UI.
- Regular expressions filtering can be used as part of the **Query** expression.
  The **Filter** field has been removed.
- Supports CDF
  [API v1](https://docs.cognite.com/dev/API_versioning.html#current-api-versions),
  with no dependency to older API versions.
- [New documentation section](https://docs.cognite.com/cdf/dashboards/guides/grafana/getting_started.html)
  for the connector, covering installation and administration, upgrades, feature
  documentation and getting started information.
- Compatibility with Grafana 7.0. Learn more about the new capabilities
  [here](https://grafana.com/blog/2020/05/18/grafana-v7.0-released-new-plugin-architecture-visualizations-transformations-native-trace-support-and-more/?isource=hp).

### Time series and custom queries

- You can now access time series that don't have the `legacyName` attribute
  populated with the data source.
- Setting `Root Asset` in the **Custom query** tab is no longer required. This
  filter has been removed from the UI and is now available as part of a custom
  query expression. For example: `ts{rootAssetIds=[12335453, 3455566]}`.
- Custom query aggregation requests are less likely to trigger rate limiting in
  CDF API.
- Functions:
  - Support for **string time series** through the new `map` function allows you
    to convert string values to numeric values which can then be plotted by
    Grafana. For example:
    `map(ts{externalId='pump_29'}, ['OPEN', 'CLOSED'], [1, 0], -1)`.
  - Use the `on_error` function to gain control over query calculations
    resolving with errors, such as division by 0. The function allows you to set
    a default value for individual data points that resolved with errors.
    Without the `on_error` function, the chart shows empty space in those
    places. Example: `on_error(1/ts{externalId='canBeZero'}, 0)`.
  - Variable length functions: `max(x1, x2, ...)`, `min(...)`, `avg(...)`.
  - The `power` function has been renamed to `pow`.
  - These functions are no longer supported: `acos`, `asin`, `atan`, `ceil`,
    `celing`, `cot`, `degrees`, `floor`, `log`, `log2`, `log10`, `radians`,
    `sign`, `tan`, `atan2`, `mod`, `truncate`, `rand`, `crc32`, `conv`, `div`.
- These aggregates are no longer supported by custom queries: `max`, `min`,
  `count`, `sum`, `continuousVariance`, `discreteVariance`, `totalVariation`.
- Short names for aggregation functions are no longer supported. Use full names
  instead: `average`, `interpolation`, `stepInterpolation`.
- The `timeseries{options}` function has been renamed to `ts{options}`.
- Filtering:
  - New options:`isString=false`, `externalId='my_id'`, `id=123`,
    `externalIdPrefix='my_'`
  - Relate to asset tree with:
    `assetSubtreeIds=[{id=754173880412890},{externalId="23-TE-96148"}]`,
    `assetIds=[123, 234]`, `assetExternalIds=['pump_1', 'pump_2']`,
    `rootAssetIds=[123, 234]`
  - New range filters for create and updated time:
    `createdTime={min=0, max= 1593018651}`,
    `lastUpdatedTime={min=1493018651, max= 1593018651}`
  - Select time series based on dataSet membership:
    `dataSetIds=[{externalId='Prediction Model A'},{id=123}]`
  - `path` is no longer supported
  - See the full list of
    [supported filters](https://docs.cognite.com/api/v1/#operation/listTimeSeries)
    for the `ts{}` expression.

### Annotations

- New filters: `assetExternalIds`, `rootAssetIds`, `dataSetIds`,
  `externalIdPrefix`, `source`.
- Find active events in range with the `activeAtTime` filter. If `endTime` is
  null, the event is active from `startTime` onwards. The `activeAtTime` filter
  will match all events that are active at some point from `min` to `max`.
  Example: `activeAtTime={min=1591018651, max= 1593018651}`.
- `description` supports only regular expression operators `=~`, `!~`, and `!=`.
- `minStartTime`/`maxStartTime` has been replaced by the
  `startTime={min=0, max= 1593018651}` filter.
- `minEndTime`/`maxEndTime` has been replaced by the
  `endTime={min=0, max= 1593018651}` filter, enabling you to also filter for
  events without the `endTime` set: `endTime={isNull=true}`.
- `minCreatedTime`/`maxCreatedTime` has been replaced by the
  `createdTime={min=0, max= 1593018651}` filter.
- `minLastUpdatedTime`/`maxLastUpdatedTime` has been replaced by the
  `lastUpdatedTime={min=0, max= 1593018651}` filter.
- `assetSubtrees` has been replaced by the
  `assetSubtreeIds=[{id=754173880412890},{externalId="23-TE-96148"}]` filter
  which introduces support for `Id`/`ExternalId` input.
- These filters are no longer supported: `sort`, `dir`, `limit`, `offset`,
  `sourceId`.
- See the full list of
  [supported filters](https://docs.cognite.com/api/v1/#operation/advancedListEvents)
  for the `events{}` expression.

### Templating

- New filters: `parentIds`, `parentExternalIds`, `rootIds`, `dataSetIds`,
  `externalIdPrefix`, `root`.
- The `description` field supports only regular expression operators `=~`, `!~`,
  and `!=`.
- Select assets based on **label**: `labels={contains={externalId="pump"}}`,
  `labels={containsAny=[{externalId="pump_type_A"},{externalId="pump_type_B"}]}`,
  `labels={containsAll=[{externalId="pump"},{externalId="rust_detected"}]}`
- `assetSubtrees` replaced by the
  `assetSubtreeIds=[{id=754173880412890},{externalId="23-TE-96148"}]` filter
  which introduces support for `Id`/`ExternalId` inputs.
- `minCreatedTime`/`maxCreatedTime` has been replaced by the
  `createdTime={min=0, max= 1593018651}` filter.
- `minLastUpdatedTime`/`maxLastUpdatedTime` has been replaced by the
  `lastUpdatedTime={min=1592222651, max= 1593018651}` filters.
- These options are no longer supported: `query`, `sort`, `dir`, `offset`,
  `boostname`, `path`, `depth`, `sourceId`.
- See the full list of
  [supported filters](https://docs.cognite.com/api/v1/#operation/listAssets) for
  the `assets{}` expression.

### Other

The **Cognite Data Source for Grafana 2.0.0** is compatible with CDF
[API v1](https://docs.cognite.com/dev/API_versioning.html#current-api-versions).

Cognite Data Source for **Grafana 2.0.0 is not backward compatible** with
dashboards created using older versions of the connector. Follow the steps in
the
[**upgrade guide**](https://docs.cognite.com/cdf/dashboards/guides/grafana/upgrade.html)
to upgrade your existing installation.

## 1.0.1 - May 27, 2019

- Rename Cognite Data Platform to Cognite Data Fusion.
- Allowing for templating variables to be used anywhere in custom queries.
- Allowing for the base url to be modified when adding a new data source.

### Other

The **Cognite Data Source for Grafana 1.0.1** is compatible with CDF
[API 0.5](https://docs.cognite.com/dev/API_versioning.html#current-api-versions).

## 1.0.0 - March 26, 2019

- Fixing templating so that repeated panels/rows work properly.
- Changing checkboxes to Grafana checkboxes and adding **Select All** option.
- Fixing data source configuration to verify the project name.
- **Breaking change**: `function=` inside of `timeseries{ ... }` no longer works
  for custom queries. Instead, functions are now applied outside of
  `timeseries{}[]` such as:
  - `(timeseries{description=~".*TEMP.*"}[avg] - 32) * 5/9`
  - `sum(timeseries{name=~".*VALUE"}[count,1d])`
  - `max(timeseries{metadata.on="True"}[count,5m]) - min(timeseries{metadata.on="True"}[count,5m])`

### Other

The **Cognite Data Source for Grafana 1.0.0** is compatible with CDF
[API 0.5](https://docs.cognite.com/dev/API_versioning.html#current-api-versions)
