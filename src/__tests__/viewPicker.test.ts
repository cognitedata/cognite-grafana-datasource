import { renderHook, waitFor } from '@testing-library/react';
import { InvolvedView } from '../types/dms';
import { Connector } from '../connector';
import {
  encodeViewRef,
  parseViewRef,
  toViewOptions,
  useContainerViews,
  viewDescription,
  viewLabel,
} from '../components/common/ViewPicker';

const VIEW: InvolvedView = { space: 'cdf_cdm', externalId: 'CogniteTimeSeries', version: 'v1' };
const CUSTOM: InvolvedView = { space: 'my_space', externalId: 'MyTimeSeries', version: '3' };

describe('view formatting', () => {
  it('labels a view the same way in every tab', () => {
    expect(viewLabel(VIEW)).toBe('CogniteTimeSeries (cdf_cdm) v1');
    expect(viewDescription(VIEW)).toBe('Space: cdf_cdm, Version: v1');
  });
});

describe('encodeViewRef / parseViewRef', () => {
  it('round-trips a view triple', () => {
    expect(parseViewRef(encodeViewRef(CUSTOM))).toEqual(CUSTOM);
  });

  it('encodes as the readable colon form', () => {
    // View externalIds cannot contain colons, unlike instance externalIds
    expect(encodeViewRef(VIEW)).toBe('cdf_cdm:CogniteTimeSeries:v1');
  });

  it('rejects anything that is not a full triple', () => {
    expect(parseViewRef('')).toBeNull();
    expect(parseViewRef('cdf_cdm')).toBeNull();
    expect(parseViewRef('cdf_cdm:CogniteTimeSeries')).toBeNull();
    expect(parseViewRef('a:b:c:d')).toBeNull();
    expect(parseViewRef('a::c')).toBeNull();
    expect(parseViewRef(undefined as any)).toBeNull();
  });
});

describe('toViewOptions', () => {
  it('builds options keyed by the encoded triple', () => {
    const [option] = toViewOptions([CUSTOM]);
    expect(option).toEqual({
      label: 'MyTimeSeries (my_space) 3',
      value: 'my_space:MyTimeSeries:3',
      description: 'Space: my_space, Version: 3',
    });
  });

  it('matches a stored triple against its option by encoded value', () => {
    const options = toViewOptions([VIEW, CUSTOM]);
    // The component selects by this equality, so persisted flattened triples keep working
    expect(options.find((o) => o.value === encodeViewRef({ ...CUSTOM }))!.label).toBe(
      'MyTimeSeries (my_space) 3'
    );
  });

  it('copes with no views', () => {
    expect(toViewOptions([])).toEqual([]);
    expect(toViewOptions(undefined as any)).toEqual([]);
  });
});

describe('useContainerViews', () => {
  const inspectResponse = (involvedViews: InvolvedView[]) => ({
    data: {
      items: [
        {
          space: 'cdf_cdm',
          externalId: 'CogniteTimeSeries',
          inspectionResults: { involvedViews },
        },
      ],
    },
  });

  const mockConnector = (fetchData: jest.Mock): Connector => ({ fetchData } as any);

  it('loads the views for a container and maps them to options', async () => {
    const fetchData = jest.fn().mockResolvedValue(inspectResponse([VIEW, CUSTOM]));
    const connector = mockConnector(fetchData);
    const { result } = renderHook(() => useContainerViews(connector, 'CogniteTimeSeries'));

    expect(result.current.loading).toBe(true);
    await waitFor(() => expect(result.current.loaded).toBe(true));

    expect(result.current.loading).toBe(false);
    expect(result.current.error).toBeNull();
    expect(result.current.views).toEqual([VIEW, CUSTOM]);
    expect(result.current.options.map((o) => o.value)).toEqual([
      'cdf_cdm:CogniteTimeSeries:v1',
      'my_space:MyTimeSeries:3',
    ]);
  });

  it("clears the previous container's views while the next fetch is in flight", async () => {
    let resolveSecond!: (value: unknown) => void;
    const fetchData = jest
      .fn()
      .mockResolvedValueOnce(inspectResponse([VIEW]))
      .mockImplementationOnce(() => new Promise((resolve) => { resolveSecond = resolve; }));
    const connector = mockConnector(fetchData);

    const { result, rerender } = renderHook(
      ({ container }: { container: string }) => useContainerViews(connector, container),
      { initialProps: { container: 'CogniteAsset' } }
    );
    await waitFor(() => expect(result.current.loaded).toBe(true));
    expect(result.current.options).toHaveLength(1);

    rerender({ container: 'CogniteEquipment' });
    // Regression: the old container's views used to stay listed and selectable here
    expect(result.current.views).toEqual([]);
    expect(result.current.options).toEqual([]);
    expect(result.current.loading).toBe(true);
    expect(result.current.loaded).toBe(false);

    resolveSecond(inspectResponse([CUSTOM]));
    await waitFor(() => expect(result.current.views).toEqual([CUSTOM]));
  });

  it('surfaces a load failure as an error naming the container, with no views', async () => {
    const fetchData = jest.fn().mockRejectedValue(new Error('API Error'));
    const connector = mockConnector(fetchData);
    const { result } = renderHook(() => useContainerViews(connector, 'CogniteActivity'));

    await waitFor(() => expect(result.current.error).not.toBeNull());
    expect(result.current.error).toContain('CogniteActivity');
    expect(result.current.views).toEqual([]);
    expect(result.current.loaded).toBe(false);
    expect(result.current.loading).toBe(false);
  });

  it('clears the error once a later load succeeds', async () => {
    const fetchData = jest
      .fn()
      .mockRejectedValueOnce(new Error('API Error'))
      .mockResolvedValueOnce(inspectResponse([VIEW]));
    const connector = mockConnector(fetchData);

    const { result, rerender } = renderHook(
      ({ container }: { container: string }) => useContainerViews(connector, container),
      { initialProps: { container: 'CogniteActivity' } }
    );
    await waitFor(() => expect(result.current.error).toContain('CogniteActivity'));

    rerender({ container: 'CogniteAsset' });
    // Regression: a failure used to stick on the caller's Alert forever
    expect(result.current.error).toBeNull();
    await waitFor(() => expect(result.current.loaded).toBe(true));
    expect(result.current.views).toEqual([VIEW]);
    expect(result.current.error).toBeNull();
  });
});
