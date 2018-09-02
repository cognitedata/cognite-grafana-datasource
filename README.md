# cognite-grafana-datasource

[Grafana](https://grafana.com/) datasource for the
[Cognite Data Platform](https://cognite.com/).

## Building

`yarn` followed by `yarn build` should work on systems with a shell.

## Run with docker

Building the image will build the plugin and copy it into the grafana/plugins folder.

`$ docker build -t cognite-grafana .`

`$ docker run -d --name grafana -p 3000:3000 cognite-grafana`

Now you can access it at http://localhost:3000

Standard username/password for logging in is admin/admin. See http://docs.grafana.org/installation/docker/ for configuration details.

## Developing

The easiest way to work on this datasource is to create a symbolic link
in `data/plugins` that points to this directory.

```shell
cd /path/to/grafana/data/plugins
ln -s /path/to/cognite-grafana-datasource cognitedata-platform-datasource
```
