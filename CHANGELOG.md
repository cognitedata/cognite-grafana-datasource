#### Changelog

##### v1.0.1

- Renaming Cognite Data Platform to Cognite Data Fusion
- Allowing for templating variables to be used anywhere in custom queries
    - This is useful for `Text box` variables, for example: `timeseries{}$Variable` will allow for a user to set `$Variable` to ` * 1000` or `[avg,1d]`
- Allowing for the base url to be modified when adding a new datasource

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
