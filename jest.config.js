const standard = require('@grafana/toolkit/src/config/jest.plugin.config');

// This process will use the same config that `yarn test` is using
module.exports = standard.jestConfig();
