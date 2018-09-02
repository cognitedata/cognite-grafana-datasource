# cognite-grafana-datasource

[Grafana](https://grafana.com/) datasource for the
[Cognite Data Platform](https://cognite.com/).

## Building

`yarn` followed by `yarn build` should work on systems with a shell.

## Developing

The easiest way to work on this datasource is to create a symbolic link
in `data/plugins` that points to this directory.

```shell
cd /path/to/grafana/data/plugins
ln -s /path/to/cognite-grafana-datasource cognitedata-platform-datasource
```
