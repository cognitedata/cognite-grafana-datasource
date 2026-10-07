import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { RecordsTab } from '../components/recordsTab';
import { Connector } from '../connector';
import { CogniteQuery, defaultRecordsQuery, RecordsQuery, Tab } from '../types';
import { RecordViewDefinition } from '../types/records';

jest.mock('@grafana/ui', () => ({
  ...jest.requireActual('@grafana/ui'),
  // Monaco does not resolve under jest; the stand-in shows the text it is given.
  CodeEditor: ({ value }: { value: string }) => <pre data-testid="code-editor">{value}</pre>,
}));

/** Two views exposing the same property name with different types and containers. */
const ALARMS: RecordViewDefinition = {
  space: 'alarm_schema',
  externalId: 'AlarmEvent',
  version: 'v1',
  usedFor: 'record',
  streamId: ['alarms_live'],
  properties: {
    severity: {
      type: { type: 'enum', list: false } as any,
      container: { type: 'container', space: 'alarm_schema', externalId: 'alarm_common' },
      containerPropertyIdentifier: 'severity',
    },
    pressure: {
      type: { type: 'float64', list: false } as any,
      container: { type: 'container', space: 'alarm_schema', externalId: 'alarm_common' },
      containerPropertyIdentifier: 'pressure',
    },
  },
};

const READINGS: RecordViewDefinition = {
  space: 'reading_schema',
  externalId: 'Reading',
  version: 'v1',
  usedFor: 'record',
  streamId: ['readings_live'],
  properties: {
    // Same name, different type and a different container.
    severity: {
      type: { type: 'int64', list: false } as any,
      container: { type: 'container', space: 'reading_schema', externalId: 'reading_common' },
      containerPropertyIdentifier: 'level',
    },
  },
};

const makeConnector = () =>
  ({
    fetchItems: jest.fn().mockImplementation(({ path }: { path: string }) =>
      Promise.resolve(path === '/models/views' ? [ALARMS, READINGS] : [])
    ),
    fetchData: jest.fn().mockResolvedValue({ data: {} }),
  } as unknown as Connector);

const renderTab = async (recordsQuery: RecordsQuery) => {
  const onQueryChange = jest.fn();
  render(
    <RecordsTab
      query={{ refId: 'A', tab: Tab.Records, recordsQuery } as unknown as CogniteQuery}
      onQueryChange={onQueryChange}
      connector={makeConnector()}
    />
  );
  return onQueryChange;
};

/**
 * Picks a record view by its visible label. Grafana's Select does not associate its
 * label with the inner input, so the combobox is found by role -- the view picker is
 * the first one in the header row.
 */
const chooseView = async (label: RegExp) => {
  const combobox = screen.getAllByRole('combobox')[0];
  fireEvent.focus(combobox);
  fireEvent.keyDown(combobox, { key: 'ArrowDown', code: 'ArrowDown' });
  // The option list arrives from an effect, so it may not be there on first look.
  const option = await screen.findByText(label);
  fireEvent.click(option);
};

const selectedAlarms = {
  space: 'alarm_schema',
  externalId: 'AlarmEvent',
  version: 'v1',
  streamId: 'alarms_live',
};

describe('RecordsTab view switching', () => {
  it('re-resolves a filter type that means something different in the new view', async () => {
    // `severity` is an enum here and an int64 there; keeping the cached type would
    // coerce the value with the wrong one.
    const onQueryChange = await renderTab({
      ...defaultRecordsQuery,
      view: selectedAlarms,
      filters: [
        { property: 'severity', propertyType: 'enum', operator: 'equals', value: 'HIGH' },
      ],
    });

    await chooseView(/Reading/);

    await waitFor(() => expect(onQueryChange).toHaveBeenCalled());
    const { recordsQuery } = onQueryChange.mock.calls[0][0];
    expect(recordsQuery.filters).toHaveLength(1);
    expect(recordsQuery.filters[0].propertyType).toBe('int64');
    // The old enum member is meaningless against the new property.
    expect(recordsQuery.filters[0].value).toBeUndefined();
  });

  it('re-resolves a sort row onto the new view container', async () => {
    const onQueryChange = await renderTab({
      ...defaultRecordsQuery,
      view: selectedAlarms,
      sort: [
        {
          property: 'severity',
          direction: 'asc',
          containerSpace: 'alarm_schema',
          containerExternalId: 'alarm_common',
          containerPropertyIdentifier: 'severity',
        },
      ],
    });

    await chooseView(/Reading/);

    await waitFor(() => expect(onQueryChange).toHaveBeenCalled());
    const { recordsQuery } = onQueryChange.mock.calls[0][0];
    expect(recordsQuery.sort[0]).toMatchObject({
      containerSpace: 'reading_schema',
      containerExternalId: 'reading_common',
      containerPropertyIdentifier: 'level',
    });
  });

  it('drops rows whose property the new view does not expose at all', async () => {
    const onQueryChange = await renderTab({
      ...defaultRecordsQuery,
      view: selectedAlarms,
      filters: [
        { property: 'pressure', propertyType: 'float64', operator: 'equals', value: '1' },
      ],
      columns: ['pressure'],
    });

    await chooseView(/Reading/);

    await waitFor(() => expect(onQueryChange).toHaveBeenCalled());
    const { recordsQuery } = onQueryChange.mock.calls[0][0];
    expect(recordsQuery.filters).toEqual([]);
    expect(recordsQuery.columns).toEqual([]);
  });
});

describe('RecordsTab request preview', () => {
  it('shows the body sent to CDF, with dashboard variables filled in', async () => {
    const recordsQuery: RecordsQuery = {
      ...defaultRecordsQuery,
      view: selectedAlarms,
      filters: [{ property: 'severity', propertyType: 'enum', operator: 'equals', value: '$level' }],
    };
    // Stands in for the datasource's interpolation
    const interpolate = (query: RecordsQuery): RecordsQuery => ({
      ...query,
      filters: query.filters.map((row) => ({ ...row, value: row.value === '$level' ? 'HIGH' : row.value })),
    });
    render(
      <RecordsTab
        query={{ refId: 'A', tab: Tab.Records, recordsQuery } as unknown as CogniteQuery}
        onQueryChange={jest.fn()}
        connector={makeConnector()}
        interpolate={interpolate}
      />
    );
    fireEvent.click(await screen.findByTestId('records-open-request-preview'));
    const body = JSON.parse((await screen.findByTestId('code-editor')).textContent ?? '{}');
    expect(body.filter).toEqual({
      equals: { property: ['alarm_schema', 'AlarmEvent/v1', 'severity'], value: 'HIGH' },
    });
  });
});
