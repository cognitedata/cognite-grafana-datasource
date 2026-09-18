import { interpolateGraphqlLabel } from '../cdf/graphqlLabel';

describe('interpolateGraphqlLabel', () => {
  const series = { name: 'TI-5443', externalId: 'EVE-TI-5443', space: 'cdm-test' };

  it('substitutes a field of the series', () => {
    expect(interpolateGraphqlLabel('{{name}}', series)).toBe('TI-5443');
  });

  it('combines fields with surrounding text', () => {
    expect(interpolateGraphqlLabel('{{name}} ({{space}})', series)).toBe('TI-5443 (cdm-test)');
  });

  it('tolerates whitespace inside the braces', () => {
    expect(interpolateGraphqlLabel('{{ externalId }}', series)).toBe('EVE-TI-5443');
  });

  it('resolves a dotted path', () => {
    expect(interpolateGraphqlLabel('{{unit.symbol}}', { unit: { symbol: 'degC' } })).toBe('degC');
  });

  it('falls back to the row when the series does not carry the field', () => {
    // A query reaching a time series through a relation can still label by the
    // asset it hangs off.
    const row = { name: 'Feed pump', externalId: 'PUMP_1' };
    expect(interpolateGraphqlLabel('{{externalId}} on {{name}}', { externalId: 'TS_1' }, row)).toBe(
      'TS_1 on Feed pump'
    );
  });

  it('prefers the series over the row for a field both carry', () => {
    expect(interpolateGraphqlLabel('{{name}}', series, { name: 'Feed pump' })).toBe('TI-5443');
  });

  it('returns nothing for an empty template, so the caller keeps its default', () => {
    expect(interpolateGraphqlLabel('', series)).toBe('');
  });

  // The unresolved-token rules below mirror the Time Series tab's labels
  // (interpolateCogniteTimeSeriesInstanceLabel), via the shared renderLabelToken.

  it('shows a field the response does not carry as :field, like the Time Series tab', () => {
    expect(interpolateGraphqlLabel('{{nope}}', series)).toBe(':nope');
  });

  it('keeps literal text around an unresolved token', () => {
    expect(interpolateGraphqlLabel('series {{nope}}', series)).toBe('series :nope');
  });

  it('shows a carried-but-null field as null', () => {
    expect(interpolateGraphqlLabel('{{description}}', { description: null })).toBe('null');
  });

  it('shows a dotted path through a null link as :path', () => {
    expect(interpolateGraphqlLabel('{{unit.symbol}}', { unit: null })).toBe(':unit.symbol');
  });

  it('serializes an object-valued field instead of [object Object]', () => {
    // A bare {{unit}} shows the property bag, so the available {{unit.<prop>}}
    // paths are discoverable from the label itself -- same as the Time Series tab.
    expect(interpolateGraphqlLabel('{{unit}}', { unit: { symbol: 'degC' } })).toBe(
      '{"symbol":"degC"}'
    );
  });
});
