import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { CogniteTimeSeriesSearchTab } from '../components/cogniteTimeSeriesSearchTab';
import { defaultQuery } from '../types';
import { getMockedDataSource } from '../test_utils';

jest.mock('@grafana/runtime');

/** The tab on a saved query, with CDF answering that the series has `type` and `unit`. */
const renderTab = (type: string, aggregation: string, extra: Record<string, unknown> = {}, unit?: string) => {
  const fetcher = {
    fetch: jest.fn().mockImplementation(async ({ url }) => ({
      status: 200,
      data: {
        items: url.endsWith('/models/instances/byids')
          ? [{ space: 'sp', externalId: 'ts', properties: { cdf_cdm: { 'CogniteTimeSeries/v1': { type, ...(unit ? { unit: { space: 'cdf_cdm_units', externalId: unit } } : {}) } } } }]
          : [],
      },
    })),
  };
  const onQueryChange = jest.fn();
  render(
    <CogniteTimeSeriesSearchTab
      query={
        {
          ...defaultQuery,
          refId: 'A',
          aggregation,
          ...extra,
          cogniteTimeSeries: {
            space: 'cdf_cdm',
            externalId: 'CogniteTimeSeries',
            version: 'v1',
            instanceId: { space: 'sp', externalId: 'ts' },
          },
        } as any
      }
      onQueryChange={onQueryChange}
      connector={getMockedDataSource(fetcher).connector}
    />
  );
  const lookedUp = () =>
    fetcher.fetch.mock.calls.some(([{ url }]: any[]) => url.endsWith('/models/instances/byids'));
  return Object.assign(onQueryChange, { lookedUp });
};

describe('CogniteTimeSeriesSearchTab aggregation by series type', () => {
  it('resets an aggregation a string series does not have to raw values', async () => {
    const onQueryChange = renderTab('string', 'average');
    await waitFor(() => expect(onQueryChange).toHaveBeenCalledWith({ aggregation: 'none' }));
  });

  it('resets a state aggregation to average on a numeric series', async () => {
    const onQueryChange = renderTab('numeric', 'stateDuration');
    await waitFor(() => expect(onQueryChange).toHaveBeenCalledWith({ aggregation: 'average' }));
  });

  it('keeps an aggregation the series type accepts', async () => {
    const onQueryChange = renderTab('string', 'none');
    // The chip renders once the type lookup has answered; the reset effect has run by then.
    await screen.findByTestId('cognite-timeseries-type-A');
    expect(onQueryChange).not.toHaveBeenCalledWith(expect.objectContaining({ aggregation: expect.anything() }));
  });

  it('shows the selected series type as a chip', async () => {
    renderTab('string', 'none');
    expect((await screen.findByTestId('cognite-timeseries-type-A')).textContent).toBe('string');
  });

  it('places the label last, below the aggregation and gap filling rows', async () => {
    const onQueryChange = renderTab('numeric', 'average');
    await waitFor(() => expect(onQueryChange.lookedUp()).toBe(true));
    // Below aggregation, granularity and gap filling: the last field of the editor.
    const inputs = Array.from(document.querySelectorAll('input'));
    expect(inputs[inputs.length - 1].id).toBe('label-A');
  });

  it('offers a target unit to a numeric series with a unit only', async () => {
    renderTab('numeric', 'average', {}, 'temperature:deg_c');
    await screen.findByTestId('cognite-timeseries-type-A');
    await waitFor(() => expect(document.getElementById('target-unit-A')).not.toBeNull());
  });

  it('offers no target unit to a string series, which the request never converts', async () => {
    const onQueryChange = renderTab('string', 'none', {}, 'temperature:deg_c');
    await waitFor(() => expect(onQueryChange.lookedUp()).toBe(true));
    await screen.findByTestId('cognite-timeseries-type-A');
    expect(document.getElementById('target-unit-A')).toBeNull();
  });

  it('shows the activity view and times only while the overlay is on', async () => {
    const onQueryChange = renderTab('numeric', 'average');
    await screen.findByTestId('cognite-timeseries-type-A');
    expect(document.getElementById('activity-view-A')).toBeNull();
    expect(screen.queryByRole('radio', { name: 'Scheduled' })).toBeNull();
    fireEvent.click(document.getElementById('overlay-activities-A')!);
    expect(onQueryChange).toHaveBeenCalledWith({
      cogniteActivityQuery: expect.objectContaining({ enabled: true, externalId: 'CogniteActivity' }),
    });
  });

  it('draws scheduled times when Times is set to Scheduled', async () => {
    const onQueryChange = renderTab('numeric', 'average', {
      cogniteActivityQuery: { enabled: true, space: 'cdf_cdm', externalId: 'CogniteActivity', version: 'v1', useScheduledTime: false },
    });
    await screen.findByTestId('cognite-timeseries-type-A');
    expect(document.getElementById('activity-view-A')).not.toBeNull();
    fireEvent.click(screen.getByRole('radio', { name: 'Scheduled' }));
    expect(onQueryChange).toHaveBeenCalledWith({
      cogniteActivityQuery: expect.objectContaining({ enabled: true, useScheduledTime: true }),
    });
  });

  it('opens on Latest and offers no aggregation there', async () => {
    renderTab('numeric', 'average', { latestValue: true });
    await screen.findByTestId('cognite-timeseries-type-A');
    expect((screen.getByRole('radio', { name: 'Latest' }) as HTMLInputElement).checked).toBe(true);
    expect(document.getElementById('aggregation-A')).toBeNull();
    expect(document.getElementById('label-A')).not.toBeNull();
  });

  it('commits the label on blur, since every change runs the query', async () => {
    const onQueryChange = renderTab('numeric', 'average');
    await screen.findByTestId('cognite-timeseries-type-A');
    const input = document.getElementById('label-A') as HTMLInputElement;
    fireEvent.change(input, { target: { value: '{{name}}' } });
    expect(onQueryChange).not.toHaveBeenCalledWith({ label: '{{name}}' });
    fireEvent.blur(input);
    expect(onQueryChange).toHaveBeenCalledWith({ label: '{{name}}' });
  });
});
