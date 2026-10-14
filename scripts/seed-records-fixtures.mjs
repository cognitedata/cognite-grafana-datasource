/**
 * Seeds the Records fixtures that tests/records.spec.ts reads.
 *
 * Run once, by hand: `node scripts/seed-records-fixtures.mjs` with the
 * grafana-plugin-test credentials in .env (CLIENT_ID, CLIENT_SECRET, TOKEN_URL,
 * COGNITE_HOST, COGNITE_PROJECT). CI never runs it.
 *
 * The project allows three streams, so the records go to the shared immutable
 * stream powerbi-connector-ci-archive (the Power BI connector's CI fixtures live
 * there too, in their own space). Immutable records are write-once: writing an
 * externalId again adds a second version, so the script refuses to write when
 * the space already holds records. Do not update or delete the seeded records.
 *
 * Every record is written and occurs on the same UTC day, so a dashboard pinned
 * to that day covers both the lastUpdatedTime window the stream requires and
 * the occurredAt axis of a time histogram.
 */
import dotenv from 'dotenv';

dotenv.config({ override: true });

const STREAM = 'powerbi-connector-ci-archive';
const SPACE = 'grafana-records-fixtures';
const CONTAINER = 'GrafanaE2eRecord';
const VIEW = { space: SPACE, externalId: 'GrafanaE2eRecord', version: 'v1' };
const RECORD_COUNT = 12;
const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;

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

const textProperty = { type: { type: 'text' }, nullable: false };

const containerDefinition = {
  space: SPACE,
  externalId: CONTAINER,
  usedFor: 'record',
  properties: {
    name: textProperty,
    site: textProperty,
    severity: { type: { type: 'int64' }, nullable: false },
    temperature: { type: { type: 'float64', unit: { externalId: 'temperature:deg_c' } }, nullable: false },
    active: { type: { type: 'boolean' }, nullable: false },
    occurredAt: { type: { type: 'timestamp' }, nullable: false },
  },
};

const viewDefinition = {
  ...VIEW,
  streamId: [STREAM],
  properties: Object.fromEntries(
    Object.keys(containerDefinition.properties).map((property) => [
      property,
      {
        container: { type: 'container', space: SPACE, externalId: CONTAINER },
        containerPropertyIdentifier: property,
      },
    ])
  ),
};

/**
 * Record i (0-based) occurs at day + i hours. Sites alternate north/south and
 * temperature is 10 + i, so north averages 15 °C and south 16 °C.
 */
function records(dayStartMs) {
  return Array.from({ length: RECORD_COUNT }, (_, i) => ({
    space: SPACE,
    externalId: `e2e-rec-${String(i + 1).padStart(2, '0')}`,
    sources: [
      {
        source: { type: 'container', space: SPACE, externalId: CONTAINER },
        properties: {
          name: `E2E record ${i + 1}`,
          site: i % 2 === 0 ? 'north' : 'south',
          severity: (i % 3) + 1,
          temperature: 10 + i,
          active: i % 4 !== 3,
          occurredAt: new Date(dayStartMs + i * HOUR_MS).toISOString(),
        },
      },
    ],
  }));
}

async function main() {
  const cdf = client(await getToken());

  await cdf('POST', '/models/spaces', { items: [{ space: SPACE, name: 'Grafana records e2e fixtures' }] });

  const containers = await cdf('POST', '/models/containers/byids', {
    items: [{ space: SPACE, externalId: CONTAINER }],
  });
  if (containers.items.length === 0) {
    await cdf('POST', '/models/containers', { items: [containerDefinition] });
    console.log(`Created container ${SPACE}:${CONTAINER}`);
  }

  const views = await cdf('POST', '/models/views/byids', { items: [VIEW] });
  if (views.items.length === 0) {
    await cdf('POST', '/models/views', { items: [viewDefinition] });
    console.log(`Created view ${VIEW.space}:${VIEW.externalId}/${VIEW.version}`);
  }

  // The stream caps a lastUpdatedTime window at 365 days, which also bounds how
  // far back this check can see.
  const now = Date.now();
  const existing = await cdf('POST', `/streams/${STREAM}/records/aggregate`, {
    lastUpdatedTime: { gte: now - 364 * DAY_MS, lte: now },
    filter: { equals: { property: ['space'], value: SPACE } },
    aggregates: { count: { count: {} } },
  });
  if (existing.aggregates.count.count > 0) {
    console.log(`${STREAM} already holds ${existing.aggregates.count.count} records in ${SPACE}; not writing.`);
    return;
  }

  const dayStartMs = Math.floor(now / DAY_MS) * DAY_MS;
  await cdf('POST', `/streams/${STREAM}/records`, { items: records(dayStartMs) });
  console.log(`Wrote ${RECORD_COUNT} records on ${new Date(dayStartMs).toISOString().slice(0, 10)} (UTC).`);
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
