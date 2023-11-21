## Developing

The easiest way to work on this datasource is by using [docker compose](./docker-compose.yaml) approach. 
First, run the connector:

```
yarn dev
```
And then use another terminal to run the docker

```
yarn server
```

Alternatively, you to create a symbolic link
in `data/plugins` that points to this directory and run Grafana instance separately.

```shell
cd /path/to/grafana/data/plugins
ln -s /path/to/cognite-grafana-datasource cognitedata-datasource
```

## Building

`yarn` followed by `yarn build` should work on systems with a shell.

For debugging and development, use `yarn dev`, and for testing use `yarn test`.
