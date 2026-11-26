## Developing

AI agents and contributors should follow [AGENTS.md](./AGENTS.md) for Grafana **marketplace validation** rules (styling, TypeScript, and release checks).

### Prerequisites
- [Node.js](https://nodejs.org/en/download/) 24.5 or newer (required for `yarn sign` / `@grafana/sign-plugin`; use `.nvmrc` with nvm)
- [Yarn](https://yarnpkg.com/getting-started/install)
- [Docker](https://docs.docker.com/get-docker/)
- [Go](https://go.dev/doc/install) with automatic toolchain selection enabled for the version pinned in [go.mod](./go.mod)

The easiest way to work on this datasource is by using [docker compose](./docker-compose.yaml) approach. 
First, run the connector:

```
yarn dev
```

In another terminal, build the Go backend before starting Grafana:

```sh
go run github.com/magefile/mage -v build:linux     # Docker on amd64
# For Docker on arm64 use build:linuxARM64 instead.
```

Start Grafana in Docker:

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

The datasources provisioned from `provisioning/datasources/datasources.yml` are re-applied from the file on every startup, with the values from `.env` substituted in. Edits made to them in the UI only last until the next launch; everything else in the volume is left alone. After changing credentials, project or cluster in `.env`, recreate the container so it picks up the new environment:

```
yarn docker-recreate
```

(or `yarn server`, which does the same). There is no need to wipe the volume. The entries deliberately have no `version` field: with one, Grafana skips the file whenever the stored version is higher, and every UI save raises it, so the datasources silently keep their old values.

Also note the volume does not survive a Docker Desktop reinstall or factory reset — export any dashboard you cannot afford to lose, or add it to provisioning.

> ⚠️ The volume's `grafana.db` holds datasource credentials and session cookies. Never export, copy or attach it anywhere (and if you have a `./grafana-data/` folder left over from the earlier bind-mount setup, treat it the same way — it is gitignored, and safe to delete once migrated).

## Building frontend

`yarn` followed by `yarn build` should work on systems with a shell. The repository is on yarn 1, and `.yarnrc` sets `ignore-engines` because `@grafana/plugin-ui` declares a yarn 4 engine.

For debugging and development, use `yarn dev`, and for testing use `yarn test`.

## Building and testing the Go backend

Run from the repository root on macOS or Linux:

```sh
go vet ./pkg/...
go test -race ./pkg/...
go run github.com/magefile/mage -v buildAll
```

The build places six executables in `dist/` for Linux (amd64, arm64, arm),
macOS (amd64, arm64) and Windows (amd64). For a native Grafana instance, use
the executable matching its host. Panel queries continue to use the frontend
while backend query support is under development.

### Comparing backend and frontend frames

The Go and Jest tests share frame fixtures in `testdata/backend-parity/`. To compare
a fresh Go SDK export with the frontend frame in the same shell, run:

```sh
export CDF_PARITY_EXPORT_DIR="$(mktemp -d)"
go test -count=1 ./pkg/plugin -run TestRuntimeFrameParity
yarn jest --runInBand --runTestsByPath src/__tests__/backendFrameParity.test.ts
unset CDF_PARITY_EXPORT_DIR
```

## Without Docker

If you are running Grafana natively, you need to build the plugin and link the folder to Grafana's plugin directory.

Run this command to create a symbolic link
in `data/plugins` that points to this directory:

```shell
cd /path/to/grafana/data/plugins
ln -s /path/to/cognite-grafana-datasource cognitedata-datasource
```
