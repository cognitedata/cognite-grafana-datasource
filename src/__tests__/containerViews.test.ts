import { getMockedDataSource } from '../test_utils';
import { fetchCogniteAssetViews, fetchContainerViews } from '../cdf/client';
import { Connector } from '../connector';
import { InvolvedView } from '../types/dms';

jest.mock('@grafana/runtime');

const VIEWS: InvolvedView[] = [
  { space: 'cdf_cdm', externalId: 'CogniteAsset', version: 'v1' },
  { space: 'my_space', externalId: 'MyAsset', version: '3' },
];

const inspectResponse = (involvedViews: InvolvedView[]) => ({
  data: {
    items: [{ space: 'cdf_cdm', externalId: 'CogniteAsset', inspectionResults: { involvedViews } }],
  },
  status: 200,
});

describe('fetchContainerViews', () => {
  let fetcher: { fetch: jest.Mock };
  let connector: Connector;

  beforeEach(() => {
    fetcher = { fetch: jest.fn() };
    connector = (getMockedDataSource(fetcher) as any).connector as Connector;
  });

  it('asks for every version, so older views stay selectable', async () => {
    fetcher.fetch.mockResolvedValue(inspectResponse(VIEWS));

    await expect(fetchContainerViews(connector, 'CogniteAsset')).resolves.toEqual(VIEWS);
    expect(fetcher.fetch).toHaveBeenCalledWith(
      expect.objectContaining({
        method: 'POST',
        data: {
          items: [{ space: 'cdf_cdm', externalId: 'CogniteAsset' }],
          // No totalInvolvedViewCount: it is a count we never read
          inspectionOperations: { involvedViews: { allVersions: true } },
        },
      })
    );
  });

  it('yields nothing when the container has no views', async () => {
    fetcher.fetch.mockResolvedValue(inspectResponse([]));
    await expect(fetchContainerViews(connector, 'CogniteAsset')).resolves.toEqual([]);
  });

  it('yields nothing when the response carries no items', async () => {
    fetcher.fetch.mockResolvedValue({ data: { items: [] }, status: 200 });
    await expect(fetchContainerViews(connector, 'CogniteAsset')).resolves.toEqual([]);
  });

  it('throws, so a picker can report the failure to the user', async () => {
    fetcher.fetch.mockRejectedValue(new Error('API Error'));
    await expect(fetchContainerViews(connector, 'CogniteAsset')).rejects.toThrow('API Error');
  });

  it('is swallowed by the named wrappers, which answer with no views', async () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
    fetcher.fetch.mockRejectedValue(new Error('API Error'));

    await expect(fetchCogniteAssetViews(connector)).resolves.toEqual([]);
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });
});
