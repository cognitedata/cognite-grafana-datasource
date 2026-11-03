import { getLabelsForTarget } from '../cdf/client';
import { Connector } from '../connector';
import { QueryTarget, Tab } from '../types';

const VIEW = { space: 'cdf_cdm', externalId: 'CogniteTimeSeries', version: 'v1' };

const unitInstance = (externalId: string, symbol: string) => ({
  instanceType: 'node',
  space: 'cdf_cdm_units',
  externalId,
  properties: { cdf_cdm: { 'CogniteUnit/v1': { name: externalId, symbol, quantity: 'Temperature' } } },
});

/** Answers the unit catalog and the picked series' instance. */
const connector = () =>
  ({
    fetchAndPaginate: jest.fn().mockResolvedValue([
      unitInstance('temperature:deg_c', '°C'),
      unitInstance('temperature:deg_f', '°F'),
    ]),
    fetchItems: jest.fn().mockResolvedValue([
      {
        space: 'sp',
        externalId: 'temp',
        properties: {
          cdf_cdm: { 'CogniteTimeSeries/v1': { name: 'Temp', unit: { space: 'cdf_cdm_units', externalId: 'temperature:deg_c' } } },
        },
      },
    ]),
  }) as unknown as Connector;

const target = (label: string, variable: Record<string, unknown>) =>
  ({
    refId: 'A',
    tab: Tab.SyntheticTimeSeries,
    label,
    cdmSyntheticQuery: { version: 2, view: VIEW, variables: [variable], expression: 'A' },
  }) as unknown as QueryTarget;

describe('Synthetic time series labels', () => {
  it('reads a property of the unit a picked time series is stored in', async () => {
    const labels = await getLabelsForTarget(
      target('{{A.name}} ({{A.unit.symbol}})', { name: 'A', mode: 'instance', instance: { space: 'sp', externalId: 'temp' } }),
      [{ expression: 'ts{}' } as any],
      connector(),
      [{ A: { space: 'sp', externalId: 'temp', name: 'Temp' } }]
    );
    expect(labels).toEqual(['Temp (°C)']);
  });

  it('reads the target unit when the variable converts to one', async () => {
    const labels = await getLabelsForTarget(
      target('{{A.unit.symbol}}', {
        name: 'A',
        mode: 'instance',
        instance: { space: 'sp', externalId: 'temp' },
        targetUnit: 'temperature:deg_f',
      }),
      [{ expression: 'ts{}' } as any],
      connector(),
      [{ A: { space: 'sp', externalId: 'temp', name: 'Temp' } }]
    );
    expect(labels).toEqual(['°F']);
  });

  it('reads the unit of each time series a filter matches', async () => {
    const labels = await getLabelsForTarget(
      target('{{A.unit.symbol}}', { name: 'A', mode: 'filter', filter: "type='numeric'" }),
      [{ expression: 'ts{}' } as any],
      connector(),
      [{ A: { space: 'sp', externalId: 'x', unit: { space: 'cdf_cdm_units', externalId: 'temperature:deg_f' } } }]
    );
    expect(labels).toEqual(['°F']);
  });
});
