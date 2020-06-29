# Cognite Data Source for Grafana

[Grafana](https://grafana.com/) datasource for [Cognite Data Fusion](https://cognite.com/).

---

## Features

- Easily create graphs with timeseries from Cognite Data Fusion
- Perform custom queries to filter for specific timeseries
- Use variables to create templated dashboards
- Add event annotations to graphs
- Apply custom functions to timeseries

### Quick Start

For a quick start on how to start using the Cognite Data Fusion plugin with Grafana, check out the videos we have published!

[Part 1](https://www.youtube.com/watch?v=wdrJuE1KXUM): Introduction to setting up Grafana with the Cognite Data Source plugin and how to display timeseries.

[Part 2](https://www.youtube.com/watch?v=JvpPzAT5wDQ): More advanced guide on custom querying, templating, and using other panels.

## Installation

#### Via Grafana Plugin Store

The easiest way to install this plugin is to go to [https://grafana.com/plugins/cognitedata-datasource/installation](https://grafana.com/plugins/cognitedata-datasource/installation), and follow the installation instructions there.

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
[http://docs.grafana.org/installation/docker/](http://docs.grafana.org/installation/docker/) for configuration details.

For more help with Docker, see the [step-by-step guide](./instructions.md).

## Adding the Data Source

To set up CDF, do the following:

- Go to "Configuration" click Data Sources, then Add data source, and choose Cognite Data Fusion.
- Give the data source a name, provide the name of the project and your API key.
- Hit "Save & Test"

![Configuring Data Source](https://raw.githubusercontent.com/cognitedata/cognite-grafana-datasource/master/images/img1.png)

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

![Select Timeseries](https://raw.githubusercontent.com/cognitedata/cognite-grafana-datasource/master/images/img2.png)

##### Select Timeseries from Asset

If you want to get a few timeseries associated with an asset

- First choose an asset to pull timeseries from - this asset will act as a root asset. Choose 'Include Subassets' to also get timeseries from all subassets.
- Select timeseries from the list
- Set your desired aggregation, as well as a granularity and custom label if desired.

![Select Timeseries from Asset](https://raw.githubusercontent.com/cognitedata/cognite-grafana-datasource/master/images/img3.png)

##### Custom Query

If you want more fine-grained control.

- To reference a specific timeseries, use  `ts{id=ID}`, `ts{externalId=EXTERNAL_ID}` or `ts{id=ID, aggregate=AGGREGATE, granularity=GRANULARITY}`.
*Example*: `ts{id=12345678}`
- You can use various filters and template variables.
*Example*: `ts{assetIds=[$asset], metadata={key1=~'.*test.*'}, isStep=true}`
- If you want to apply custom functions to the timeseries (e.g. for unit conversions), simply add your functions around `ts{}`.
*For example*: `(ts{name=~'Test.*', aggregate='average'} + 10) / 5` 
    - Click on the info icon next to the text box to see more examples

![Custom Query](https://raw.githubusercontent.com/cognitedata/cognite-grafana-datasource/master/images/img4.png)

## Templating / Variables

In order to perform templating, we enable the use of variables via `$Variable` or `[[Variable]]`.

- To add variables, go to your dashboard's settings, and then select "Variables" from the right side.
- Make sure the "Type" is set to "Query", and then set your Cognite Data Source as the Data Source.
- You can then specify the query to pull assets from CDF, and also filter on these assets.

![Variable Query](https://raw.githubusercontent.com/cognitedata/cognite-grafana-datasource/master/images/img7.png)

![Variable as root asset](https://raw.githubusercontent.com/cognitedata/cognite-grafana-datasource/master/images/img8.png)

## Annotations / Events

Events from CDF can also be shown in Grafana via annotations.

- To add annotations, go to your dashboard's settings, and then select "Annotations" from the right side.
- Choose your Cognite Data Source as the Data Source.
- You can then specify the query to pull events from CDF, and also filter on these events.

![Annotation Query](https://raw.githubusercontent.com/cognitedata/cognite-grafana-datasource/master/images/img5.png)

![Annotation Labels](https://raw.githubusercontent.com/cognitedata/cognite-grafana-datasource/master/images/img6.png)

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
ln -s /path/to/cognite-grafana-datasource cognitedata-datasource
```

#### Building

`yarn` followed by `yarn build` should work on systems with a shell.

For debugging and development, use `yarn dev`, and for testing use `yarn test`.
