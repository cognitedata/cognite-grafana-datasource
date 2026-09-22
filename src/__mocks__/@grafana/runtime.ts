export const getBackendSrv = () =>
  ({
    fetch: jest.fn(),
  } as any);

// Instance references
const ASSET_REF = '{"space":"paper_mill","externalId":"ASSET_PM_AREA"}';
const ASSET_REF_2 = '{"space":"paper_mill","externalId":"ASSET_BL_AREA"}';

const variables = [
  { name: 'AssetVariable', current: { text: 'asset1', value: 123 } },
  { name: 'TimeseriesVariable', current: { text: 'timeseries1', value: 'Timeseries1' } },
  { name: 'MultiValue', current: { text: 'asset2', value: [123, 456] } },
  { name: 'Type', current: { text: 'type', value: '"type_or_subtype"' } },
  { name: 'AssetRef', current: { text: '60-PM', value: ASSET_REF } },
  { name: 'AssetRefs', current: { text: '60-PM + 40-BL', value: [ASSET_REF, ASSET_REF_2] } },
  // "All" selected: Grafana stores only the sentinel, the values sit in `options`.
  {
    name: 'AssetRefsAll',
    current: { text: 'All', value: ['$__all'] },
    options: [
      { text: 'All', value: '$__all', selected: true },
      { text: '60-PM', value: ASSET_REF, selected: false },
      { text: '40-BL', value: ASSET_REF_2, selected: false },
    ],
  },
  // "All" with a custom value, which Grafana pastes in verbatim.
  {
    name: 'AssetRefsCustomAll',
    current: { text: 'All', value: '$__all' },
    allValue: '*',
    options: [
      { text: 'All', value: '$__all', selected: true },
      { text: '60-PM', value: ASSET_REF, selected: false },
    ],
  },
];

export const getTemplateSrv = () =>
  ({
    variables,
    getVariables: () => variables,
    replace: jest.fn((q, options, format) => {
      let query = q;
      variables.forEach(({ name, current }) => {
        // Multi-value variables are joined the way Grafana joins them for the format
        // in play. Default stays comma-joined to match what callers already expect.
        const render = (fmt?: string) => {
          if (!Array.isArray(current.value)) {
            return String(current.value);
          }
          return fmt === 'json'
            ? JSON.stringify(current.value)
            : current.value.join(',');
        };
        const varSyntax1 = new RegExp(`\\[\\[${name}\\]\\]`, 'g');
        const varSyntax2 = new RegExp(`\\$${name}(?![A-Za-z0-9_])`, 'g');
        const varSyntax3 = new RegExp(
          `\\$\\{${name}:(json|csv|glob|regex|pipe|distributed|lucene|percentencode|singlequote|doublequote|sqlstring)}`,
          'g'
        );
        query = query.replace(varSyntax1, () => render(format));
        query = query.replace(varSyntax2, () => render(format));
        query = query.replace(varSyntax3, (_m, inlineFormat) => render(inlineFormat));
      });
      return query;
    }),
  } as any);

export class DataSourceWithBackend<TQuery, TOptions> {
  query() {
    throw new Error('This is a backend method. Write the Golang or e2e tests for the backend-related code.');
  }
}
