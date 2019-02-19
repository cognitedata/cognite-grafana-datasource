# Cognite Data Source for Grafana

[Grafana](https://grafana.com/) datasource for the [Cognite Data Platform](https://cognite.com/).

---

## Features

- Easily create graphs with timeseries from the Cognite Data Platform
- Perform custom queries to filter for specific timeseries
- Use variables to create templated dashboards
- Add event annotations to graphs
- Apply custom functions to timeseries

## Installation

#### Via Grafana Plugin Store

The easiest way to install this plugin is to go to [https://grafana.com/plugins/cognite-datasource](https://grafana.com/plugins/cognite-datasource), and follow the installation instructions there.

#### Docker

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

For more help with Docker, see the [step-by-step guide](./instructions.md).

## Adding the Data Source

To set up CDP, do the following:

- Go to "Configuration" click Data Sources, then Add data source, and choose Cognite Data Platform.
- Give the data source a name, provide the name of the project and your API key.
- Hit "Save & Test"

![Configuring Data Source](https://raw.githubusercontent.com/cognitedata/cognite-grafana-datasource/beta-release/images/img1.png)

You're now ready to start using the datasource!

To make a chart, click on Dashboard, and choose Graph under "Add". Click on "Panel Title" and choose Edit.
Under "Metric", choose your data source

## Usage

There are three ways to get timeseries into Grafana:

##### Select Timeseries

If you only want to see the data from one specific timeseries.

- Simply start typing the name of the desired timeseries and then select it from the dropdown.
- Choose your desired aggregation, and add a granularity if desired (otherwise one will be selected for you based on the time interval displayed).
- You can also set a custom label and use the format `{{property}}` to pull data from the timeseries. E.g. `{{name}} - {{description}}`

![Select Timeseries](https://raw.githubusercontent.com/cognitedata/cognite-grafana-datasource/beta-release/images/img2.png)

##### Select Timeseries from Asset

If you want to get a few timeseries associated with an asset

- First choose an asset to pull timeseries from - this asset will act as a root asset. Choose 'Include Subassets' to also get timeseries from all subassets.
- Select timeseries from the list
- Set your desired aggregation, as well as a granularity and custom label if desired.

![Select Timeseries from Asset](https://raw.githubusercontent.com/cognitedata/cognite-grafana-datasource/beta-release/images/img3.png)

##### Custom Query

If you want more fine-grained control.

- First select an asset (with/without subassets) to pull timeseries from, or use a template variable with `$Variable` or `[[Variable]]`.
- Then filter on these timeseries. Click on the help icon for more details about the syntax.
- If you want to apply custom functions to the timeseries (e.g. for unit conversions), you can specify a function by adding `function=` to your query.

![Custom Query](https://raw.githubusercontent.com/cognitedata/cognite-grafana-datasource/beta-release/images/img4.png)

## Templating / Variables

In order to perform templating, we enable the use of variables via `$Variable` or `[[Variable]]`.

- To add variables, go to your dashboard's settings, and then select "Variables" from the right side.
- Make sure the "Type" is set to "Query", and then set your Cognite Data Source as the Data Source.
- You can then specify the query to pull assets from CDP, and also filter on these assets.

![Variable Query](https://raw.githubusercontent.com/cognitedata/cognite-grafana-datasource/beta-release/images/img7.png)

![Variable as root asset](https://raw.githubusercontent.com/cognitedata/cognite-grafana-datasource/beta-release/images/img8.png)

## Annotations / Events

Events from CDP can also be shown in Grafana via annotations.

- To add annotations, go to your dashboard's settings, and then select "Annotations" from the right side.
- Choose your Cognite Data Source as the Data Source.
- You can then specify the query to pull events from CDP, and also filter on these events.

![Annotation Query](https://raw.githubusercontent.com/cognitedata/cognite-grafana-datasource/beta-release/images/img5.png)

![Annotation Labels](https://raw.githubusercontent.com/cognitedata/cognite-grafana-datasource/beta-release/images/img6.png)

### Feedback

If you find any bugs, or have any suggestions, please [create a new issue](https://github.com/cognitedata/cognite-grafana-datasource/issues/new).

&nbsp;

&nbsp;

&nbsp;

&nbsp;

---

#### Developing

The easiest way to work on this datasource is to create a symbolic link
in `data/plugins` that points to this directory.

```shell
cd /path/to/grafana/data/plugins
ln -s /path/to/cognite-grafana-datasource cognite-datasource
```

#### Building

`yarn` followed by `yarn build` should work on systems with a shell.

For debugging and development, use `yarn dev`, and for testing use `yarn test`.

---

#### Changelog

##### v0.0.1 (beta)

- First version.
