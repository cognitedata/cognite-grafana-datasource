# cognite-grafana-datasource

[Grafana](https://grafana.com/) datasource for the
[Cognite Data Platform](https://cognite.com/).

## Detailed instructions

For detailed instructions, see the [step-by-step guide](./instructions.md).

## Run with Docker

The official image is hosted on Docker Hub as
[cognite/grafana-cdp](https://hub.docker.com/r/cognite/grafana-cdp/)

To run it, first create a Docker volume to store your dashboards
and settings.

`docker volume create grafana-storage`

Run the Docker image using this volume:

`docker run -d --name grafana -p 3000:3000 -v grafana-storage:/var/lib/grafana cognite/grafana-cdp`

Now you can access Grafana at http://localhost:3000

Standard username/password for logging in is admin/admin. See
http://docs.grafana.org/installation/docker/ for configuration details.

Click "Add data source" and choose "Cognite Data Platform" as the type
to get started.

## Building

`yarn` followed by `yarn build` should work on systems with a shell.

## Building with Docker

Building the image will build the plugin and copy it into the grafana/plugins folder.

`$ docker build -t cognite-grafana .`

## Developing

The easiest way to work on this datasource is to create a symbolic link
in `data/plugins` that points to this directory.

```shell
cd /path/to/grafana/data/plugins
ln -s /path/to/cognite-grafana-datasource cognitedata-platform-datasource
```
