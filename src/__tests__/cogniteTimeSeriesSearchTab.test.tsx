import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { CogniteTimeSeriesSearchTab } from '../components/cogniteTimeSeriesSearchTab';
import { defaultQuery } from '../types';
import { getMockedDataSource } from '../test_utils';

jest.mock('@grafana/runtime');

/** The tab on a saved query, with CDF answering that the series has `type`. */
const renderTab = (type: string, aggregation: string) => {
  const fetcher = {
    fetch: jest.fn().mockImplementation(async ({ url }) => ({
      status: 200,
      data: {
        items: url.endsWith('/models/instances/byids')
          ? [{ space: 'sp', externalId: 'ts', properties: { cdf_cdm: { 'CogniteTimeSeries/v1': { type } } } }]
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
    const onQueryChange = renderTab('state', 'interpolation');
    // Let the type lookup answer before checking nothing was changed.
    await waitFor(() => expect(onQueryChange.lookedUp()).toBe(true));
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(onQueryChange).not.toHaveBeenCalledWith(expect.objectContaining({ aggregation: expect.anything() }));
  });

  it('shows the selected series type as a chip', async () => {
    renderTab('state', 'interpolation');
    expect((await screen.findByTestId('cognite-timeseries-type-A')).textContent).toBe('state');
  });

  it('places the label last, below the aggregation and gap filling rows', async () => {
    const onQueryChange = renderTab('numeric', 'average');
    await waitFor(() => expect(onQueryChange.lookedUp()).toBe(true));
    // Below aggregation, granularity and gap filling: the last field of the editor.
    const inputs = Array.from(document.querySelectorAll('input'));
    expect(inputs[inputs.length - 1].id).toBe('label-A');
  });
});
