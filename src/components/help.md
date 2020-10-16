Format: `ts{options}`

Options are of the form: `PROPERTY COMPARATOR VALUE`

Comparator can be either

- `=>` (strict equality)

- `!=` (strict inequality)

- `>=~` (regex equality)

- `!~` (regex inequality)


If you want to reference a specific timeseries, use
`ts{id=ID}`, or `ts{id=ID, aggregate=AGGREGATE, granularity=GRANULARITY}`

**Example:**

```
sum(ts{metadata{type="TEMP"}}) - ts{id=12345678}`
```

Templated variables can also be used with `$variable`.

**Example:**
```
ts{assetIds=[$asset], metadata={key1=~'.*test.*'}, isStep=1, granularity='12h', aggregate='average}
```
In case of multi-value variable, return value can be formatted. To format variable value use `${variable:[formatter]}`.

**Example:**
```
ts{assetIds=[${asset:csv}], granularity='12h', aggregate='average'}`
```
Check [Grafana documentation](https://grafana.com/docs/grafana/latest/reference/templating/#advanced-formatting-options)
to get list of available formatters.

Synthetic timeseries functions can also be applied on one or multiple timeseries.

**Example:**
```
(ts{"{name=~'.*temp.*', aggregate='average'} - 32) * 5/9 ts{} + sin(ts{granularity='24h', aggregate='average'})
```

Variable length functions (sum, max, min, avg) can also be applied to all filtered timeseries.

**Examples:**
```
sum(ts{metadata={type="TEMP"}})
```
↪ yields one timeseries that is the sum of all temperature timeseries

```
max(ts{aggregate='average'}) - min(ts{aggregate='average'})
```
↪ yields the range of the timeseries aggregated by averages

```
pow(ts{} - avg(ts{}), 2)
```
↪ yields the squared deviation of each timeseries from the average

There is a support for some advanced functions, like `round`, `on_error` and `map`. The documentation on how to use
them can be found on [docs.cognite.com](https://docs.cognite.com/dev/concepts/resource_types/timeseries.html#synthetic-time-series").

To learn more about the querying capabilities of Cognite Data Source for Grafana, please visit
our [documentation](href="https://docs.cognite.com/cdf/dashboards/guides/grafana/getting_started.html).