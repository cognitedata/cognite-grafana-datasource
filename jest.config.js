// force timezone to UTC to allow tests to work regardless of local timezone
// generally used by snapshots, but can affect specific tests
process.env.TZ = 'UTC';

const { grafanaESModules, nodeModulesToTransform } = require('./.config/jest/utils');

module.exports = {
  // Jest configuration provided by Grafana scaffolding
  ...require('./.config/jest.config'),
  // @grafana/plugin-ui ships an ESM-only nested uuid@14, and the GraphQL language
  // service used for query autocomplete pulls in ESM-only vscode-languageserver-types.
  transformIgnorePatterns: [
    nodeModulesToTransform([
      ...grafanaESModules,
      '@grafana/plugin-ui',
      'vscode-languageserver-types',
    ]),
  ],
};
