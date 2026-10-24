/**
 * Seeds the Core Data Model fixtures that tests/syntheticTimeSeries.spec.ts
 * reads: two assets, each with two numeric time series related to it through
 * `assets`, so a filter on a dashboard variable of asset instance ids has
 * something to match.
 *
 * Run by hand: `node scripts/seed-synthetic-time-series-fixtures.mjs` with the
 * grafana-plugin-test credentials in .env (CLIENT_ID, CLIENT_SECRET, TOKEN_URL,
 * COGNITE_HOST, COGNITE_PROJECT). CI never runs it. Every write is an upsert and
 * the data points sit on one fixed day, so running it again changes nothing.
 */
import dotenv from 'dotenv';

dotenv.config({ override: true });

const SPACE = 'grafana-ts-fixtures';
const UNITS_SPACE = 'cdf_cdm_units';
const ASSET_VIEW = { type: 'view', space: 'cdf_cdm', externalId: 'CogniteAsset', version: 'v1' };
const TIME_SERIES_VIEW = { type: 'view', space: 'cdf_cdm', externalId: 'CogniteTimeSeries', version: 'v1' };
/** The UTC day the data points cover; the e2e dashboard is pinned to it. */
const FIXTURE_DAY = '2026-10-22';
const HOUR_MS = 60 * 60 * 1000;

const { CLIENT_ID, CLIENT_SECRET, TOKEN_URL, COGNITE_HOST, COGNITE_PROJECT } = process.env;
const BASE = `https://${COGNITE_HOST}/api/v1/projects/${COGNITE_PROJECT}`;

async function getToken() {
  const response = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'client_credentials',
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
      scope: `https://${COGNITE_HOST}/.default`,
    }),
  });
  if (!response.ok) {
    throw new Error(`Token request failed: ${response.status} ${await response.text()}`);
  }
  return (await response.json()).access_token;
}

function client(token) {
  return async (method, path, body) => {
    const response = await fetch(`${BASE}${path}`, {
      method,
      headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const text = await response.text();
    if (!response.ok) {
      throw new Error(`${method} ${path} failed: ${response.status} ${text}`);
    }
    return text ? JSON.parse(text) : {};
  };
}

const ASSETS = [
  { externalId: 'ts-expr-asset-north', name: 'TS expression north', description: 'Time series expression e2e asset' },
  { externalId: 'ts-expr-asset-south', name: 'TS expression south', description: 'Time series expression e2e asset' },
];

/** Hour h of the day reads base + h * step, so the series stay apart and their averages are known. */
const TIME_SERIES = [
  { externalId: 'ts-expr-north-temp', asset: 'ts-expr-asset-north', unit: 'temperature:deg_c', base: 10, step: 0.5 },
  {
    externalId: 'ts-expr-north-flow',
    asset: 'ts-expr-asset-north',
    unit: 'volume_flow_rate:m3-per-hr',
    base: 100,
    step: 1,
  },
  { externalId: 'ts-expr-south-temp', asset: 'ts-expr-asset-south', unit: 'temperature:deg_c', base: 20, step: 0.5 },
  {
    externalId: 'ts-expr-south-flow',
    asset: 'ts-expr-asset-south',
    unit: 'volume_flow_rate:m3-per-hr',
    base: 200,
    step: 1,
  },
];

const assetNodes = ASSETS.map(({ externalId, name, description }) => ({
  instanceType: 'node',
  space: SPACE,
  externalId,
  sources: [{ source: ASSET_VIEW, properties: { name, description } }],
}));

const timeSeriesNodes = TIME_SERIES.map(({ externalId, asset, unit }) => ({
  instanceType: 'node',
  space: SPACE,
  externalId,
  sources: [
    {
      source: TIME_SERIES_VIEW,
      properties: {
        name: externalId,
        description: 'Time series expression e2e series',
        type: 'numeric',
        isStep: false,
        unit: { space: UNITS_SPACE, externalId: unit },
        assets: [{ space: SPACE, externalId: asset }],
      },
    },
  ],
}));

function datapoints(dayStartMs) {
  return TIME_SERIES.map(({ externalId, base, step }) => ({
    instanceId: { space: SPACE, externalId },
    datapoints: Array.from({ length: 24 }, (_, hour) => ({
      timestamp: dayStartMs + hour * HOUR_MS,
      value: base + hour * step,
    })),
  }));
}

/** A fresh CDM time series takes a moment to accept data points. */
async function insertDatapointsWithRetry(cdf, items, attempts = 10) {
  for (let attempt = 1; ; attempt++) {
    try {
      await cdf('POST', '/timeseries/data', { items });
      return;
    } catch (error) {
      if (attempt >= attempts) {
        throw error;
      }
      await new Promise((resolve) => setTimeout(resolve, 3000));
    }
  }
}

async function main() {
  const cdf = client(await getToken());

  await cdf('POST', '/models/spaces', { items: [{ space: SPACE, name: SPACE }] });
  await cdf('POST', '/models/instances', { items: assetNodes });
  console.log(`Upserted ${assetNodes.length} assets in ${SPACE}`);
  await cdf('POST', '/models/instances', { items: timeSeriesNodes });
  console.log(`Upserted ${timeSeriesNodes.length} time series in ${SPACE}`);

  const dayStartMs = Date.parse(`${FIXTURE_DAY}T00:00:00Z`);
  await insertDatapointsWithRetry(cdf, datapoints(dayStartMs));
  console.log(`Wrote 24 hourly data points per series on ${FIXTURE_DAY} (UTC).`);
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
