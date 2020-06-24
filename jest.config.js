module.exports = {
  roots: ["<rootDir>/src"],
  transform: {
    "^.+\\.tsx?$": "ts-jest"
  },
  testEnvironment: "node",
  testRegex: "(/spec/.*|(\\.|/)(test|spec))\\.tsx?$",
  moduleFileExtensions: ["ts", "tsx", "js", "jsx", "json", "node"],
  moduleNameMapper: {
    "grafana/app/core/core": "<rootDir>/src/__mocks__/grafana/app/core/core.ts"
  },
  collectCoverageFrom: ["src/**/{!(grammar),}.ts"]
};
