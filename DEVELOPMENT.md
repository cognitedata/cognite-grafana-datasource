## Developing

The easiest way to work on this datasource is by using [docker compose](./docker-compose.yaml) approach. 
First, run the connector:

```
yarn dev
```

And then use another terminal to build backend and run Grafana in docker:

```
yarn server
```

This will start Grafana on `localhost:2999`, anf you will have to manually add the Cognite datasource to Grafana once you log in.
If you prefer the server to bootstrap the connection to Cognite Data Fusion automatically, you need to set the following environment variables:

```
export CLIENT_ID="..." # Application (client) ID
export CLIENT_SECRET="..." # Client secret
export COGNITE_HOST="..." # e.g. api.cognitedata.com
export COGNITE_PROJECT="..." # e.g. publicdata
export TOKEN_URL="", e.g. "https://login.microsoftonline.com/{tenant}/oauth2/v2.0/token"
```

## Building frontend

`yarn` followed by `yarn build` should work on systems with a shell.

For debugging and development, use `yarn dev`, and for testing use `yarn test`.

## Building backend separately
Build backend for Linux (arm64) with:
```bash
mage -v build:linuxARM64
```
or (amd64) with:
```bash
mage -v build:linux
```

## Without Docker

If you are running Grafana natively, you need to build backend and frontend parts of the plugin and link the folder to Grafana's plugin directory.

Run this command to create a symbolic link
in `data/plugins` that points to this directory:

```shell
cd /path/to/grafana/data/plugins
ln -s /path/to/cognite-grafana-datasource cognitedata-datasource
```
