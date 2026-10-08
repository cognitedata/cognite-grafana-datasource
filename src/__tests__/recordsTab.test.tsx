import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { RecordsTab } from '../components/recordsTab';
import { Connector } from '../connector';
import { CogniteQuery, defaultRecordsQuery, RecordsQuery, Tab } from '../types';

/**
 * Server-render smoke tests: they exercise the whole component tree and the
 * request-preview memo, but not effects such as the view fetch. Behaviour that
 * depends on those lives in recordsTab.interaction.test.tsx.
 */
const connector = {
  fetchItems: jest.fn().mockResolvedValue([]),
  fetchData: jest.fn().mockResolvedValue({ data: {} }),
} as unknown as Connector;

const selectedView = {
  space: 'alarm_schema',
  externalId: 'AlarmEvent',
  version: 'v1',
  streamId: 'alarms_live',
};

const renderTab = (recordsQuery: RecordsQuery) =>
  renderToStaticMarkup(
    <RecordsTab
      query={{ refId: 'A', tab: Tab.Records, recordsQuery } as unknown as CogniteQuery}
      onQueryChange={jest.fn()}
      connector={connector}
    />
  );

describe('RecordsTab', () => {
  it('renders with no view selected', () => {
    const html = renderTab(defaultRecordsQuery);
    expect(html).toContain('Record view');
    expect(html).toContain('Query type');
    // Nothing to preview until a stream is known
    expect(html).not.toContain('records-request-preview');
  });

  it('renders list mode controls once a view is selected', () => {
    const html = renderTab({ ...defaultRecordsQuery, view: selectedView, mode: 'list' });
    expect(html).toContain('Columns');
    expect(html).toContain('Sort by');
    expect(html).toContain('Limit');
    expect(html).not.toContain('Group by');
    expect(html).not.toContain('Compute');
  });

  it('renders aggregate mode controls instead of list controls', () => {
    const html = renderTab({
      ...defaultRecordsQuery,
      view: selectedView,
      mode: 'aggregate',
      buckets: [{ kind: 'timeHistogram', property: 'timestamp', interval: '1h' }],
      metrics: [{ name: 'alarmCount', function: 'count' }],
    });
    expect(html).toContain('Group by');
    expect(html).toContain('Compute');
    expect(html).not.toContain('Columns');
    expect(html).not.toContain('Sort by');
  });

  it('renders every filter row shape without crashing', () => {
    const html = renderTab({
      ...defaultRecordsQuery,
      view: selectedView,
      filters: [
        { property: 'severity', propertyType: 'enum', operator: 'in', values: ['HIGH'] },
        { property: 'value', propertyType: 'float64', operator: 'range', gte: '1', lte: '2' },
        { property: 'message', propertyType: 'text', operator: 'prefix', value: 'Over' },
        { property: 'acknowledged', propertyType: 'boolean', operator: 'equals', value: 'false' },
        { property: 'source', propertyType: 'text', operator: 'exists' },
        { property: 'asset', propertyType: 'direct', operator: 'equals', value: 's:pump-1' },
      ],
    });
    expect(html).toContain('Filters');
  });

  it('renders the custom time window editor with resolved bounds', () => {
    const html = renderTab({
      ...defaultRecordsQuery,
      view: selectedView,
      timeFilterMode: 'custom',
      timeFilterFrom: '2026-08-01T00:00:00Z',
      timeFilterTo: '2026-08-08T00:00:00Z',
    });
    expect(html).toContain('Window bounds');
    // Both bounds resolve, so the editor previews the window it will request
    expect(html).toContain('2026-08-01T00:00:00.000Z');
    expect(html).toContain('2026-08-08T00:00:00.000Z');
  });

  it('flags an unusable time expression inline', () => {
    const html = renderTab({
      ...defaultRecordsQuery,
      view: selectedView,
      timeFilterMode: 'custom',
      timeFilterFrom: '{{nope}}',
      timeFilterTo: '{{endTime}}',
    });
    expect(html).toContain('Unknown variable');
  });

  it('hides the window bounds editor unless the mode is custom', () => {
    const html = renderTab({ ...defaultRecordsQuery, view: selectedView });
    // The mode selector is always shown; only its bounds row is conditional
    expect(html).toContain('Time window');
    expect(html).not.toContain('Window bounds');
  });

  it('names the read window and the property filters distinctly', () => {
    const html = renderTab({ ...defaultRecordsQuery, view: selectedView });
    // "filter" must not name both stages, or the two sections read as duplicates
    expect(html).toContain('Time window');
    expect(html).not.toContain('Time filter');
    expect(html).toContain('Filters');
  });

  it('hides unit conversion for a view with no unit-bearing properties', () => {
    // The stub view declares no units, so the section must not appear at all
    const html = renderTab({ ...defaultRecordsQuery, view: selectedView });
    expect(html).not.toContain('Storage units');
  });

  it('offers the request preview as a modal trigger, not an inline panel', () => {
    const html = renderTab({ ...defaultRecordsQuery, view: selectedView });
    expect(html).toContain('Request preview');
    expect(html).toContain('records-open-request-preview');
    // The body only mounts once the modal is opened, so it never costs editor height
    expect(html).not.toContain('records-request-preview"');
  });

  it('labels the empty sort state with an explicit action', () => {
    const html = renderTab({ ...defaultRecordsQuery, view: selectedView, mode: 'list' });
    expect(html).toContain('Add sort');
  });

  it('renders bucket reorder buttons and API-primitive gutter hints', () => {
    const html = renderTab({
      ...defaultRecordsQuery,
      view: selectedView,
      mode: 'aggregate',
      buckets: [
        { kind: 'timeHistogram', property: 'timestamp', interval: '1h' },
        { kind: 'uniqueValues', property: 'severity', size: 10 },
      ],
      metrics: [{ name: 'alarmCount', function: 'avg', property: 'value' }],
    });
    expect(html).toContain('Move bucket 1 up');
    expect(html).toContain('Move bucket 2 down');
    expect(html).toContain('records-bucket-hint-0');
    expect(html).toContain('timeHistogram');
    expect(html).toContain('uniqueValues');
    // Metric gutter hint names the aggregate primitive
    expect(html).toContain('records-metric-hint-0');
  });

  it('names the derived result shape in aggregate mode', () => {
    const timeseries = renderTab({
      ...defaultRecordsQuery,
      view: selectedView,
      mode: 'aggregate',
      buckets: [
        { kind: 'timeHistogram', property: 'timestamp', interval: '1h' },
        { kind: 'uniqueValues', property: 'severity', size: 10 },
      ],
      metrics: [{ name: 'count', function: 'count' }],
    });
    expect(timeseries).toContain('Time series · one series per severity');

    const table = renderTab({
      ...defaultRecordsQuery,
      view: selectedView,
      mode: 'aggregate',
      buckets: [{ kind: 'uniqueValues', property: 'severity', size: 10 }],
      metrics: [{ name: 'count', function: 'count' }],
    });
    expect(table).toContain('Table · grouped by severity');

    const single = renderTab({
      ...defaultRecordsQuery,
      view: selectedView,
      mode: 'aggregate',
      buckets: [],
      metrics: [{ name: 'count', function: 'count' }],
    });
    expect(single).toContain('Single row');
  });

  it('shows a validation error for a reserved metric name', () => {
    const html = renderTab({
      ...defaultRecordsQuery,
      view: selectedView,
      mode: 'aggregate',
      metrics: [{ name: '_count', function: 'count' }],
    });
    expect(html).toContain('reserved by the API');
  });
});
