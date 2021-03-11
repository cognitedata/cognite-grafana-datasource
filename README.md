# Cognite Data Source for Grafana

[Grafana](https://grafana.com/) datasource for [Cognite Data Fusion](https://cognite.com/).

---

## Features

- Easily create graphs with timeseries from Cognite Data Fusion
- Perform custom queries to filter for specific timeseries
- Use variables to create templated dashboards
- Add event annotations to graphs
- Apply custom functions to timeseries

![Select Timeseries](https://raw.githubusercontent.com/cognitedata/cognite-grafana-datasource/release-v2/images/readme/image2.png)


## Installation

The easiest way to install this plugin is to follow the installation instructions on [this page](https://grafana.com/grafana/plugins/cognitedata-datasource/?tab=installation).
 
## Documentation

To learn more about the connector please visit our [documentation](https://docs.cognite.com/cdf/dashboards/guides/grafana/getting_started.html)

## Feedback

If you find any bugs, or have any suggestions, please [visit support portal](https://support.cognite.com/).

---

## Developing

The easiest way to work on this datasource is to create a symbolic link
in `data/plugins` that points to this directory.

```shell
cd /path/to/grafana/data/plugins
ln -s /path/to/cognite-grafana-datasource cognitedata-datasource
```

## Building

`yarn` followed by `yarn build` should work on systems with a shell.

For debugging and development, use `yarn dev:watch`, and for testing use `yarn test`.

## Docker

The Grafana image is also hosted on Docker Hub as
[cognite/grafana-cdf](https://hub.docker.com/r/cognite/grafana-cdf/) or [cognite/grafana-cdf-dev](https://hub.docker.com/r/cognite/grafana-cdf-dev/) and bundled with a Cognite Data Source. You may use it for development and testing purposes only.

To run it, first create a Docker volume to store your dashboards
and settings.

`docker volume create grafana-storage`

Run the Docker image using this volume:

`docker run -d --name grafana -p 3000:3000 -v grafana-storage:/var/lib/grafana cognite/grafana-cdf`

Now you can access Grafana at http://localhost:3000

Standard username/password for logging in is admin/admin. See
[http://docs.grafana.org/installation/docker/](http://docs.grafana.org/installation/docker/) for configuration details.

For more help with Docker, see the [step-by-step guide](https://github.com/cognitedata/cognite-grafana-datasource/blob/master/instructions.md).
