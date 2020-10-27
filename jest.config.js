const standard = require('@grafana/toolkit/src/config/jest.plugin.config');

// This process will use the same config that `yarn test` is using
const jestConfig = standard.jestConfig();
jestConfig.testPathIgnorePatterns = ["<rootDir>/src/__tests__/utils.ts"]

module.exports = jestConfig;
