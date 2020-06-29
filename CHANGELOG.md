# Releases

This article documents the ongoing improvements we're making to the **Cognite Data Source for Grafana**.

## 2.0.0 - June 29, 2020

### General improvements

- A new query language inspired by PromQL and compatible with synthetic time series in CDF. [Learn more](https://docs.cognite.com/cdf/dashboards/guides/grafana/timeseries.html#custom-queries).
- Support for all filtering capabilities available in [CDF API v1](https://docs.cognite.com/api/v1/) for the respective resource types (assets, events, times series).
- Any future **filtering** capabilities added to CDF API v1 will be **automatically supported** by the data source (filters are passed directly to CDF).
- Query expressions resulting in errors now **displays error messages** in the UI.
- Regular expressions filtering can be used as part of the **Query** expression. The **Filter** field has been removed.
- Supports CDF [API v1](https://docs.cognite.com/dev/API_versioning.html#current-api-versions), with no dependency to older API versions.
- [New documentation section](https://docs.cognite.com/cdf/dashboards/guides/grafana/getting_started.html) for the connector, covering installation and administration, upgrades, feature documentation and getting started information.
- Compatibility with Grafana 7.0. Learn more about the new capabilities [here](https://grafana.com/blog/2020/05/18/grafana-v7.0-released-new-plugin-architecture-visualizations-transformations-native-trace-support-and-more/?isource=hp).

### Time series and custom queries

- You can now access time series that don't have the `legacyName` attribute populated with the data source.
- Setting `Root Asset` in the **Custom query** tab is no longer required. This filter has been removed from the UI and is now available as part of a custom query expression. For example: `ts{rootAssetIds=[12335453, 3455566]}`.
- Custom query aggregation requests are less likely to trigger rate limiting in CDF API.
- Functions:
  - Support for **string time series** through the new `map` function allows you to convert string values to numeric values which can then be plotted by Grafana. For example: `map(ts{externalId='pump_29'}, ['OPEN', 'CLOSED'], [1, 0], -1)`.
  - Use the `on_error` function to gain control over query calculations resolving with errors, such as division by 0. The function allows you to set a default value for individual data points that resolved with errors. Without the `on_error` function, the chart shows empty space in those places. Example: `on_error(1/ts{externalId='canBeZero'}, 0)`.
  - Variable length functions: `max(x1, x2, ...)`, `min(...)`, `avg(...)`.
  - The `power` function has been renamed to `pow`.
  - These functions are no longer supported: `acos`, `asin`, `atan`, `ceil`, `celing`, `cot`, `degrees`, `floor`, `log`, `log2`, `log10`, `radians`, `sign`, `tan`, `atan2`, `mod`, `truncate`, `rand`, `crc32`, `conv`, `div`.
- These aggregates are no longer supported by custom queries: `max`, `min`, `count`, `sum`, `continuousVariance`, `discreteVariance`, `totalVariation`.
- Short names for aggregation functions are no longer supported. Use full names instead: `average`, `interpolation`, `stepInterpolation`.
- The `timeseries{options}` function has been renamed to `ts{options}`.
- Filtering:
  - New options:`isString=false`, `externalId='my_id'`, `id=123`, `externalIdPrefix='my_'`
  - Relate to asset tree with: `assetSubtreeIds=[{id=754173880412890},{externalId="23-TE-96148"}]`, `assetIds=[123, 234]`, `assetExternalIds=['pump_1', 'pump_2']`, `rootAssetIds=[123, 234]`
  - New range filters for create and updated time: `createdTime={min=0, max= 1593018651}`, `lastUpdatedTime={min=1493018651, max= 1593018651}`
  - Select time series based on dataSet membership: `dataSetIds=[{externalId='Prediction Model A'},{id=123}]`
  - `path` is no longer supported
  - See the full list of [supported filters](https://docs.cognite.com/api/v1/#operation/listTimeSeries) for the `ts{}` expression.

### Annotations

- New filters: `assetExternalIds`, `rootAssetIds`, `dataSetIds`, `externalIdPrefix`, `source`.
- Find active events in range with the `activeAtTime` filter. If `endTime` is null, the event is active from `startTime` onwards. The `activeAtTime` filter will match all events that are active at some point from `min` to `max`. Example: `activeAtTime={min=1591018651, max= 1593018651}`.
- `description` supports only regular expression operators `=~`, `!~`, and `!=`.
- `minStartTime`/`maxStartTime` has been replaced by the `startTime={min=0, max= 1593018651}` filter.
- `minEndTime`/`maxEndTime` has been replaced by the `endTime={min=0, max= 1593018651}` filter, enabling you to also filter for events without the `endTime` set: `endTime={isNull=true}`.
- `minCreatedTime`/`maxCreatedTime` has been replaced by the `createdTime={min=0, max= 1593018651}` filter.
- `minLastUpdatedTime`/`maxLastUpdatedTime` has been replaced by the `lastUpdatedTime={min=0, max= 1593018651}` filter.
- `assetSubtrees` has been replaced by the `assetSubtreeIds=[{id=754173880412890},{externalId="23-TE-96148"}]` filter which introduces support for `Id`/`ExternalId` input.
- These filters are no longer supported: `sort`, `dir`, `limit`, `offset`, `sourceId`.
- See the full list of [supported filters](https://docs.cognite.com/api/v1/#operation/advancedListEvents) for the `events{}` expression.

### Templating

- New filters: `parentIds`, `parentExternalIds`, `rootIds`, `dataSetIds`, `externalIdPrefix`, `root`.
- The `description` field supports only regular expression operators `=~`, `!~`, and `!=`.
- Select assets based on **label**: `labels={contains={externalId="pump"}}`, `labels={containsAny=[{externalId="pump_type_A"},{externalId="pump_type_B"}]}`, `labels={containsAll=[{externalId="pump"},{externalId="rust_detected"}]}`
- `assetSubtrees` replaced by the `assetSubtreeIds=[{id=754173880412890},{externalId="23-TE-96148"}]` filter which introduces support for `Id`/`ExternalId` inputs.
- `minCreatedTime`/`maxCreatedTime` has been replaced by the `createdTime={min=0, max= 1593018651}` filter.
- `minLastUpdatedTime`/`maxLastUpdatedTime` has been replaced by the `lastUpdatedTime={min=1592222651, max= 1593018651}` filters.
- These options are no longer supported: `query`, `sort`, `dir`, `offset`, `boostname`, `path`, `depth`, `sourceId`.
- See the full list of [supported filters](https://docs.cognite.com/api/v1/#operation/listAssets) for the `assets{}` expression.

### Other

The **Cognite Data Source for Grafana 2.0.0** is compatible with CDF [API v1](https://docs.cognite.com/dev/API_versioning.html#current-api-versions).

Cognite Data Source for **Grafana 2.0.0 is not backward compatible** with dashboards created using older versions of the connector.
Follow the steps in the [**upgrade guide**](https://docs.cognite.com/cdf/dashboards/guides/grafana/upgrade.html) to upgrade your existing installation.

## 1.0.1 - May 27, 2019

- Rename Cognite Data Platform to Cognite Data Fusion.
- Allowing for templating variables to be used anywhere in custom queries.
- Allowing for the base url to be modified when adding a new data source.

### Other

The **Cognite Data Source for Grafana 1.0.1** is compatible with CDF [API 0.5](https://docs.cognite.com/dev/API_versioning.html#current-api-versions).

## 1.0.0 - March 26, 2019

- Fixing templating so that repeated panels/rows work properly.
- Changing checkboxes to Grafana checkboxes and adding **Select All** option.
- Fixing data source configuration to verify the project name.
- **Breaking change**: `function=` inside of `timeseries{ ... }` no longer works for custom queries. Instead, functions are now applied outside of `timeseries{}[]` such as:
  - `(timeseries{description=~".*TEMP.*"}[avg] - 32) * 5/9`
  - `sum(timeseries{name=~".*VALUE"}[count,1d])`
  - `max(timeseries{metadata.on="True"}[count,5m]) - min(timeseries{metadata.on="True"}[count,5m])`

### Other

The **Cognite Data Source for Grafana 1.0.0** is compatible with CDF [API 0.5](https://docs.cognite.com/dev/API_versioning.html#current-api-versions)

