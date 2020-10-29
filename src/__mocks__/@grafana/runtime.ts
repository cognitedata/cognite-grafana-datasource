export const getBackendSrv = () =>
  ({
    datasourceRequest: jest.fn(),
  } as any);

const variables = [
  { name: 'AssetVariable', current: { text: 'asset1', value: 123 } },
  { name: 'TimeseriesVariable', current: { text: 'timeseries1', value: 'Timeseries1' } },
  { name: 'MultiValue', current: { text: 'asset2', value: [123, 456] } },
  { name: 'Type', current: { text: 'type', value: '"type_or_subtype"' } },
];

export const getTemplateSrv = () =>
  ({
    variables,
    replace: jest.fn((q, options) => {
      let query = q;
      variables.forEach(({ name, current }) => {
        const varSyntax1 = new RegExp(`\\[\\[${name}\\]\\]`, 'g');
        const varSyntax2 = new RegExp(`\\$${name}`, 'g');
        const varSyntax3 = new RegExp(
          `\\$\\{${name}:(json|csv|glob|regex|pipe|distributed|lucene|percentencode|singlequote|doublequote|sqlstring)}`,
          'g'
        );
        query = query.replace(varSyntax1, current.value);
        query = query.replace(varSyntax2, current.value);
        query = query.replace(varSyntax3, current.value);
      });
      return query;
    }),
  } as any);

export const SystemJS = {
  load: async (module) => {
    return module === 'app/core/app_events' ? AppEvents : new Error('mo mock');
  },
};

const AppEvents = {
  emit: jest.fn(),
  on: jest.fn(),
  off: jest.fn(),
};
