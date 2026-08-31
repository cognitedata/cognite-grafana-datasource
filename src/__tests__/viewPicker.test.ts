import { InvolvedView } from '../types/dms';
import {
  encodeViewRef,
  parseViewRef,
  toViewOptions,
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
