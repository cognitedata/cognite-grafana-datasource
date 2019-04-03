#### Changelog

##### v1.0.0

- Fixing templating so that repeated panels/rows work properly
- Changing checkboxes to grafana checkboxes and adding 'Select All' option
- Fixing data source configuration to verify the project name
- Breaking Changes: `function= ` inside of `timeseries{ ... }` no longer works for custom queries
    - Instead, functions are now applied outside of `timeseries{}[]` such as:
    - `(timeseries{description=~".*TEMP.*"}[avg] - 32) * 5/9`
    - `sum(timeseries{name=~".*VALUE"}[count,1d])`
    - `max(timeseries{metadata.on="True"}[count,5m]) - min(timeseries{metadata.on="True"}[count,5m])`

##### v0.0.1 (beta)

- First version.
