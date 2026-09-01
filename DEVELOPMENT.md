## Developing

### Prerequisites
- [Node.js](https://nodejs.org/en/download/)
- [Yarn](https://yarnpkg.com/getting-started/install)
- [Docker](https://docs.docker.com/get-docker/)
- [Go](https://golang.org/doc/install)
- [Mage](https://magefile.org/)

The easiest way to work on this datasource is by using [docker compose](./docker-compose.yaml) approach. 
First, run the connector:

```
yarn dev
```

And then use another terminal to build backend and run Grafana in docker:

```
yarn server
```

This will start Grafana on `localhost:2999`, and you will have to manually add the Cognite datasource to Grafana once you log in.
If you prefer the server to bootstrap the connection to Cognite Data Fusion automatically (via the provisioned datasources in [provisioning/datasources/datasources.yml](./provisioning/datasources/datasources.yml)), create a `.env` file at the repo root — docker compose loads it automatically — with the following keys:

```
CLIENT_ID="..." # Application (client) ID
CLIENT_SECRET="..." # Client secret
COGNITE_HOST="..." # bare host, no scheme — e.g. api.cognitedata.com
COGNITE_PROJECT="..." # e.g. publicdata
TOKEN_URL="..." # e.g. https://login.microsoftonline.com/{tenant}/oauth2/v2.0/token
```

(The same variables exported in your shell also work and take precedence over `.env`.)

### Persistence

Grafana's state (manually added datasources, dashboards saved in the UI, users, preferences) is stored in a named Docker volume (`grafana-data`), so it survives `yarn server` re-runs and container recreation. Living outside the repository, it also cannot end up in a commit, and there are no root-owned files in your working tree. To reset Grafana to a clean, freshly-provisioned state:

```
docker compose down -v
```

Note that the datasources provisioned from `provisioning/datasources/datasources.yml` are re-applied on every startup, so changes made to them in the UI are overwritten on the next launch. Also note the volume does not survive a Docker Desktop reinstall or factory reset — export any dashboard you cannot afford to lose, or add it to provisioning.

> ⚠️ The volume's `grafana.db` holds datasource credentials and session cookies. Never export, copy or attach it anywhere (and if you have a `./grafana-data/` folder left over from the earlier bind-mount setup, treat it the same way — it is gitignored, and safe to delete once migrated).

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
