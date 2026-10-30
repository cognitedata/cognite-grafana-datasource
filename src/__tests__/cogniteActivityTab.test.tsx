import React from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { CogniteActivityTab } from '../components/cogniteActivityTab';
import { CogniteActivityTabQuery, defaultCogniteActivityTabQuery, defaultQuery } from '../types';
import { getMockedDataSource } from '../test_utils';

jest.mock('@grafana/runtime');

const VIEW_PROPERTIES: Record<string, { type: { type: string; list?: boolean } }> = {
  externalId: { type: { type: 'text' } },
  description: { type: { type: 'text' } },
  startTime: { type: { type: 'timestamp' } },
  endTime: { type: { type: 'timestamp' } },
  status: { type: { type: 'text' } },
  tags: { type: { type: 'text', list: true } },
};

/** The tab on a saved query, with CDF answering the view's properties and one space. */
const renderTab = async (patch: Partial<CogniteActivityTabQuery> = {}) => {
  const fetcher = {
    fetch: jest.fn().mockImplementation(async ({ url }) => ({
      status: 200,
      data: {
        items: url.endsWith('/models/views/byids')
          ? [{ properties: VIEW_PROPERTIES }]
          : url.endsWith('/models/spaces')
            ? [{ space: 'sp' }]
            : [],
      },
    })),
  };
  const onQueryChange = jest.fn();
  // Mounting loads the spaces and the view's properties; let both land.
  await act(async () => {
    render(
      <CogniteActivityTab
        query={{ ...defaultQuery, refId: 'A', cogniteActivityTabQuery: { ...defaultCogniteActivityTabQuery, ...patch } } as any}
        onQueryChange={onQueryChange}
        connector={getMockedDataSource(fetcher).connector}
      />
    );
  });
  return onQueryChange;
};

const checked = (name: string) => (screen.getByRole('radio', { name }) as HTMLInputElement).checked;

/** The activity tab query the last change carried. */
const lastTabQuery = (onQueryChange: jest.Mock): CogniteActivityTabQuery =>
  onQueryChange.mock.calls[onQueryChange.mock.calls.length - 1][0].cogniteActivityTabQuery;

describe('CogniteActivityTab', () => {
  it('opens on the active activities, related to assets, sorted by startTime', async () => {
    await renderTab();
    expect(checked('Active in time range')).toBe(true);
    expect(checked('Assets')).toBe(true);
    expect(screen.getAllByText('startTime').length).toBeGreaterThan(0);
    expect(screen.getByText('ascending')).toBeTruthy();
    expect(document.getElementById('activity-columns-A')).not.toBeNull();
  });

  it('All shows every activity, saved as Active only off', async () => {
    const onQueryChange = await renderTab();
    fireEvent.click(screen.getByRole('radio', { name: 'All' }));
    expect(lastTabQuery(onQueryChange).activeOnly).toBe(false);
  });

  it('opens on All for a query that turned Active only off', async () => {
    await renderTab({ activeOnly: false });
    expect(checked('All')).toBe(true);
  });

  it('changing what the activities relate to clears the instances and their view', async () => {
    const onQueryChange = await renderTab({
      assetInstances: [{ space: 'sp', externalId: 'pump', name: 'Pump' }],
      instanceView: { space: 'cdf_cdm', externalId: 'CogniteAsset', version: 'v1' },
    });
    fireEvent.click(screen.getByRole('radio', { name: 'Equipment' }));
    expect(lastTabQuery(onQueryChange)).toEqual(
      expect.objectContaining({ resourceType: 'CogniteEquipment', instanceView: undefined, assetInstances: [] })
    );
  });

  it('adds a second sort key, and no third', async () => {
    const onQueryChange = await renderTab();
    fireEvent.click(screen.getByTestId('activity-add-sort'));
    expect(lastTabQuery(onQueryChange).sort).toEqual([
      { property: 'startTime', order: 'asc' },
      { property: 'startTime', order: 'asc' },
    ]);
  });

  it('offers no third sort key, and removes one', async () => {
    const onQueryChange = await renderTab({
      sort: [
        { property: 'startTime', order: 'asc' },
        { property: 'endTime', order: 'desc' },
      ],
    });
    expect(screen.queryByTestId('activity-add-sort')).toBeNull();
    fireEvent.click(screen.getByTestId('activity-remove-sort-0'));
    expect(lastTabQuery(onQueryChange).sort).toEqual([{ property: 'endTime', order: 'desc' }]);
  });

  it('badges each sort property with its type, as the Records tab does', async () => {
    await renderTab();
    // startTime is a timestamp: the selected value carries the TIME token.
    expect(screen.getAllByText('TIME').length).toBeGreaterThan(0);
  });

  it('keeps a saved column the view no longer has, so it can be removed', async () => {
    await renderTab({ columns: ['startTime', 'legacyField'] });
    expect(screen.getByText('legacyField')).toBeTruthy();
  });

  it('offers the view properties as columns, keeping the saved ones', async () => {
    const onQueryChange = await renderTab();
    const input = document.getElementById('activity-columns-A')!;
    await waitFor(() => {
      fireEvent.keyDown(input, { key: 'ArrowDown' });
      expect(screen.getByText('status')).toBeTruthy();
    });
    fireEvent.click(screen.getByText('status'));
    expect(lastTabQuery(onQueryChange).columns).toEqual(['status']);
  });

  it('starts on every property, and lists the instance properties last, marked', async () => {
    await renderTab();
    expect(screen.getByText('all properties')).toBeTruthy();
    fireEvent.keyDown(document.getElementById('activity-columns-A')!, { key: 'ArrowDown' });
    // Each option reads badge, name, marker, then its description.
    const labels = screen.getAllByRole('option').map((option) => option.textContent);
    expect(labels.slice(-4)).toEqual([
      'TEXTspaceinstancetext · instance property',
      'TEXTexternalIdinstancetext · instance property',
      'TIMEcreatedTimeinstancetimestamp · instance property',
      'TIMElastUpdatedTimeinstancetimestamp · instance property',
    ]);
    expect(labels[0]).toBe('TEXTexternalIdtext');
  });

  it('says a query saved with every column removed shows the related instances only', async () => {
    await renderTab({ columns: [] });
    expect(screen.getByText('related instances only')).toBeTruthy();
  });

  it('shows the legacy columns for a query saved before they could be chosen', async () => {
    await renderTab({ columns: undefined });
    expect(screen.getByText('description')).toBeTruthy();
    expect(screen.queryByText('all properties')).toBeNull();
  });
});
