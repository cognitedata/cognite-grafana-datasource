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
    // Nothing to preview until a stream is known
    expect(html).not.toContain('records-request-preview');
  });

  it('renders the list controls once a view is selected', () => {
    const html = renderTab({ ...defaultRecordsQuery, view: selectedView });
    expect(html).toContain('Columns');
    expect(html).toContain('Sort by');
    expect(html).toContain('Limit');
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

  it('names the read window and the property filters distinctly', () => {
    const html = renderTab({ ...defaultRecordsQuery, view: selectedView });
    // "filter" must not name both stages, or the two sections read as duplicates
    expect(html).toContain('Time window');
    expect(html).not.toContain('Time filter');
    expect(html).toContain('Filters');
  });

  it('offers the request preview as a modal trigger, not an inline panel', () => {
    const html = renderTab({ ...defaultRecordsQuery, view: selectedView });
    expect(html).toContain('Request preview');
    expect(html).toContain('records-open-request-preview');
    // The body only mounts once the modal is opened, so it never costs editor height
    expect(html).not.toContain('records-request-preview"');
  });

  it('labels the empty sort state with an explicit action', () => {
    const html = renderTab({ ...defaultRecordsQuery, view: selectedView });
    expect(html).toContain('Add sort');
  });

});
