# Cognite Data Source for Grafana

[Grafana](https://grafana.com/) datasource for [Cognite Data Fusion](https://cognite.com/).

---
![Select Timeseries](https://raw.githubusercontent.com/cognitedata/cognite-grafana-datasource/docs/dashboard-development/images/readme/image2.png)

## Features

- Easily create graphs with timeseries from Cognite Data Fusion
- Perform custom queries to filter for specific timeseries
- Use variables to create templated dashboards
- Add event annotations to graphs
- Apply custom functions to timeseries

## Installation

#### Via Grafana Plugin Store

The easiest way to install this plugin is to go to [https://grafana.com/plugins/cognitedata-datasource/installation](https://grafana.com/plugins/cognitedata-datasource/installation), and follow the installation instructions there.

#### Docker

The official image is hosted on Docker Hub as
[cognite/grafana-cdf](https://hub.docker.com/r/cognite/grafana-cdf/)

To run it, first create a Docker volume to store your dashboards
and settings.

`docker volume create grafana-storage`

Run the Docker image using this volume:

`docker run -d --name grafana -p 3000:3000 -v grafana-storage:/var/lib/grafana cognite/grafana-cdf`

Now you can access Grafana at http://localhost:3000

Standard username/password for logging in is admin/admin. See
[http://docs.grafana.org/installation/docker/](http://docs.grafana.org/installation/docker/) for configuration details.

For more help with Docker, see the [step-by-step guide](./instructions.md).

## Adding the Data Source

To set up CDF, do the following:

- Go to `Configuration` click `Data Sources`, then `Add data source`, and choose `Cognite Data Fusion`.
- Give the data source a name, provide the name of the project and your API key.
- Hit `Save & Test`

![Configuring Data Source](https://raw.githubusercontent.com/cognitedata/cognite-grafana-datasource/docs/dashboard-development/images/readme/image1.png)

You're now ready to start using the datasource!

To make a chart, click on the plus sign on the left sidebar and select `Dashboard` here. Click on `Add panel` do add a new chart.
You need to specify datasource for the chart. To do this, select one of the available datasources from the dropdown list below chart.

By default, it refers to default datasource in Grafana instance.   

## Documentation

To learn more about the connector please visit our [documentation portal](https://docs.cognite.com/cdf/dashboards/guides/grafana/getting_started.html)


### Feedback

If you find any bugs, or have any suggestions, please [visit support portal](https://support.cognite.com/).

---

#### Developing

The easiest way to work on this datasource is to create a symbolic link
in `data/plugins` that points to this directory.

```shell
cd /path/to/grafana/data/plugins
ln -s /path/to/cognite-grafana-datasource cognitedata-datasource
```

#### Building

`yarn` followed by `yarn build` should work on systems with a shell.

For debugging and development, use `yarn dev:watch`, and for testing use `yarn test`.
