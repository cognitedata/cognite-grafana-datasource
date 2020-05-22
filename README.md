# Cognite Data Source for Grafana

[Grafana](https://grafana.com/) datasource for [Cognite Data Fusion](https://cognite.com/).

---

## Features

- Easily create graphs with timeseries from Cognite Data Fusion
- Perform custom queries to filter for specific timeseries
- Use variables to create templated dashboards
- Add event annotations to graphs
- Apply custom functions to timeseries

## Installation

#### Via Grafana Plugin Store

The easiest way to install this plugin is to go to [https://grafana.com/plugins/cognitedata-datasource/installation](https://grafana.com/plugins/cognitedata-datasource/installation), and follow the installation instructions there.

#### Docker

The official image is hosted on Docker Hub as
[cognite/grafana-cdp](https://hub.docker.com/r/cognite/grafana-cdp/)

To run it, first create a Docker volume to store your dashboards
and settings.

`docker volume create grafana-storage`

Run the Docker image using this volume:

`docker run -d --name grafana -p 3000:3000 -v grafana-storage:/var/lib/grafana cognite/grafana-cdp`

Now you can access Grafana at http://localhost:3000

Standard username/password for logging in is admin/admin. See
[http://docs.grafana.org/installation/docker/](http://docs.grafana.org/installation/docker/) for configuration details.

For more help with Docker, see the [step-by-step guide](./instructions.md).

## Adding the Data Source

To set up CDF, do the following:

- Go to "Configuration" click Data Sources, then Add data source, and choose Cognite Data Fusion.
- Give the data source a name, provide the name of the project and your API key.
- Hit "Save & Test"

![Configuring Data Source](https://raw.githubusercontent.com/cognitedata/cognite-grafana-datasource/master/images/img1.png)

You're now ready to start using the datasource!

To make a chart, click on the plus sign on the left sidebar and select Dashboard here. Click on `Add panel` do add a new chart.
You need to specify datasource for the chart. To do this, select one of the available datasources from the dropdown list below chart.

By default, it refers to default datasource in Grafana instance.   

## Usage

There are three ways to get timeseries into Grafana:

#### Select Timeseries

If you only want to see the data from one specific timeseries.

- Simply start typing the name of the desired timeseries and then select it from the dropdown list.
- Aggregation and granularity can be specified using corresponding fields (by default aggregation set to `avarage` and granularity calculated based on the time interval displayed)
- You can also set a custom label and use the format `{{property}}` to pull data from the timeseries. E.g. `{{name}} - {{description}}`

![Select Timeseries](https://raw.githubusercontent.com/cognitedata/cognite-grafana-datasource/master/images/img2.png)

#### Select Timeseries from Asset

If you want to get a few timeseries associated with an asset

- Choose an asset to pull timeseries associated to it. 'Include Subassets' switcher can be used to get timeseries related to subassets.
- Aggregation, granularity and labels can be modified in the same way as in Timeseries tab.

![Select Timeseries from Asset](https://raw.githubusercontent.com/cognitedata/cognite-grafana-datasource/master/images/img3.png)

##### Custom Query

If you want more fine-grained control on timeseries fetching. This tab allows combination of timeseries (arithmetic operations, special functions, etc.). Synthetic timeseries (STS) have special syntax described below.

**Define query**

To request timeseries you should specify a query with the parameters inside, for instance:
```
ts{id=123}
```
Query above requests for the timeseries using `id` equals `123`. You can request timeseries with `id`, `externalId` or timeseries filters, which you can find in 
[CDF documentation](https://docs.cognite.com/api/v1/#operation/listTimeSeries). 

![Custom Query](https://raw.githubusercontent.com/cognitedata/cognite-grafana-datasource/master/images/img4.png)

There are several property types that can be specified with STS:

- `string` or `number`: `ts{id=123}` or `ts{externalId="external_123"}`
- `array`: `ts{assetIds=[123, 456]}`
- `object`: `ts{metadata={key1="value1", key2="value2"}}`

To create complex STS you might need combination of types above in a single query:
```
ts{name="test", assetSubtreeIds=[{id=123}, {externalId="external_123"}]}
```

**Filtering**

Synthetic timeseries (STS) query also supports filtering based on timeseries properties which applies as logical `AND`. For instance,
if you want to filter timeseries which: 
- belongs to asset with `id` equals `123`
- `name` starts with `"Begin"`
- `name` doesn't end with `"end"`
- `name` doesn't equal `"Begin query"`

query will be:
```
ts{assetIds=[123], name=~"Begin.*", name!~".*end", name!="Begin query"}
```

As you might notice, query above contain 4 types of equality:
- `=` - strict equality. It uses to specify parameters for timeseries request to CDF
- `=!` - strict inequality. It uses to filter fetched timeseries by the property, which doesn't equal to the provided string
- `=~` – regexp equality. It uses to filter fetched timeseries by the property, that matches provided regexp
- `!~` - regexp inequality. It uses to filter fetched timeseries by the property, that doesn't match provided regexp

It can be used even for metadata filtering:
```
ts{externalIdPrefix="test", metadata={key1="value1", key2=~"value2.*"}}
```
Query above requests for timeseries with:
- `externalIdPrefix` equals `"test"`
- `metadata.key1` equals `"value1"`
- `metadata.key2` starts with `"value2"`

**Aggregation and granularity**

Aggregation and granularity can be specified for each timeseries using corresponded dropdowns in UI. Default values for them are the same as in a previous tabs.
Let's assume, that aggregation is set to `avarege` and granularity equals `1h`. Then all queries in the tab request datapoints with the selected aggregation and granularity.

But STS query syntax allows us to define aggregation and granularity to each timeseries separately:
```
ts{name="test", aggregate="interpolation", granularity="30m"}
```
Query above overrides values of aggregation and granularity which is set in UI

**Arithmetic operations**

You're also allowed to apply arithmetic operations for timeseries to combine them. For instance:
```
ts{id=123} + ts{externalId="test"}
```
Result of the query above is a single plot where datapoints are summed values of each timeseries. Another example:
```
ts{name~="test1.*"} + ts{id=123}
```
This is another situation, where query `ts{name~="test1.*"}` can return more than 1 timeseries, but let's assume that it returns 3 timeseries with ids `111`, `222` and `333`.
Then, result of the query above is 3 plots, which are combination of summed timeseries values returned by first and second expression in the query. Result plots actually represent queries below:
- `ts{id=111} + ts{id=123}`
- `ts{id=222} + ts{id=123}`
- `ts{id=333} + ts{id=123}`

**Functions**
STS supports a bunch of functions, that can be applied on timeseries:
- trigonometric: `sin(ts{})`, `cos(ts{})`, `pi()`
- variable-length functions: `max(ts{}, ...)`, `min(ts{}, ...)`, `avg(ts{}, ...)`    
- special: `ln(ts{})`, `pow(ts{}, exponent)`, `sqrt(ts{})`, `exp(ts{})`, `abs(ts{})`   
- `on_error(ts{}, default)` – for handling errors like overflow or division by zero
- `map(expression, [list of strings to map from], [list of values to map to], default)` - function, that allows tto work with string timeseries

`on_error()` function allows chart rendering even if some exception appears. It handles errors like:
- `BAD_DOMAIN` - If bad input ranges are provided. E.g. division by zero, or sqrt of negative number
- `OVERFLOW` - If result is more than 10^100 in absolute value
If any of these are encountered, instead of returning a value for that timestamp, we will return an error field with an error message.
To avoid these, you can wrap the (sub)expression in the on_error() function:
```
on_error(1/TS{externalId='canBeZero'}, 0)
```

`map()` function can handle timeseries with string values, i.e. converts strings to doubles. 
As an example, assume that the time series "stringstate" can have values `"OPEN"` or `"CLOSED"`. Then you can convert it to a number with:
```
map(TS{externalId='stringstate'}, ['OPEN', 'CLOSED'], [1, 0], -1)
```
`"OPEN"` is mapped to 1, `"CLOSED"` to 0, and everything else to -1

Aggregates on string timeseries is not supported rigth now, not even interpolation. All string time series are considered step timeseries

## Templating / Variables

In order to perform templating, we enable the use of variables via `$Variable` or `[[Variable]]`.

- To add variables, go to your dashboard's settings, and then select "Variables" from the right side.
- Make sure the "Type" is set to "Query", and then set your Cognite Data Source as the Data Source.
- You can then specify the query to pull assets from CDF, and also filter on these assets.

![Variable Query](https://raw.githubusercontent.com/cognitedata/cognite-grafana-datasource/master/images/img7.png)

![Variable as root asset](https://raw.githubusercontent.com/cognitedata/cognite-grafana-datasource/master/images/img8.png)

## Annotations / Events

Events from CDF can also be shown in Grafana via annotations.

- To add annotations, go to your dashboard's settings, and then select "Annotations" from the right side.
- Choose your Cognite Data Source as the Data Source.
- You can then specify the query to pull events from CDF, and also filter on these events.

![Annotation Query](https://raw.githubusercontent.com/cognitedata/cognite-grafana-datasource/master/images/img5.png)

![Annotation Labels](https://raw.githubusercontent.com/cognitedata/cognite-grafana-datasource/master/images/img6.png)

### Feedback

If you find any bugs, or have any suggestions, please [create a new issue](https://github.com/cognitedata/cognite-grafana-datasource/issues/new).

&nbsp;

&nbsp;

&nbsp;

&nbsp;

---

#### Developing

The easiest way to work on this datasource is to create a symbolic link
in `data/plugins` that points to this directory.

```shell
cd /path/to/grafana/data/plugins
ln -s /path/to/cognite-grafana-datasource cognitedata-datasource
```

#### Building

`yarn` followed by `yarn build` should work on systems with a shell.

For debugging and development, use `yarn dev`, and for testing use `yarn test`.
