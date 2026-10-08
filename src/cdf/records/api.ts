/** Reads record views, streams and unit systems from CDF. */
import { Connector } from '../../connector';
import { CacheTime } from '../../constants';
import { HttpMethod } from '../../types';
import { UnitSystem, RecordViewDefinition, StreamDefinition } from '../../types/records';

// ---------------------------------------------------------------------------
// Fetching
// ---------------------------------------------------------------------------

export function fetchRecordViews(
  connector: Connector,
  limit = 1000
): Promise<RecordViewDefinition[]> {
  return connector.fetchItems<RecordViewDefinition>({
    method: HttpMethod.GET,
    path: '/models/views',
    data: undefined,
    params: {
      usedFor: 'record',
      includeGlobal: true,
      allVersions: false,
      limit,
    },
    cacheTime: CacheTime.ResourceByIds,
  });
}

export async function fetchStream(
  connector: Connector,
  streamId: string
): Promise<StreamDefinition> {
  const { data } = await connector.fetchData<{ data: StreamDefinition }>({
    method: HttpMethod.GET,
    path: `/streams/${encodeURIComponent(streamId)}`,
    data: undefined,
    cacheTime: CacheTime.ResourceByIds,
  });
  return data;
}

/**
 * Unit systems the project knows about (Default, Imperial, ...). Each carries the
 * unit it maps every quantity to, which is what makes a system a one-click
 * alternative to naming a target unit per property.
 */
export async function fetchUnitSystems(
  connector: Connector
): Promise<UnitSystem[]> {
  try {
    return await connector.fetchItems<UnitSystem>({
      method: HttpMethod.GET,
      path: '/units/systems',
      data: undefined,
      cacheTime: CacheTime.Units,
    });
  } catch (error) {
    // The picker simply hides when the catalog is unavailable.
    console.warn('Failed to load unit systems', error);
    return [];
  }
}
