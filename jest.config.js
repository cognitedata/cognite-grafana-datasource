module.exports = {
  roots: ["<rootDir>/src"],
  transform: {
    "^.+\\.tsx?$": "ts-jest"
  },
  testEnvironment: "node",
  testRegex: "(/spec/.*|(\\.|/)(test|spec))\\.tsx?$",
  moduleFileExtensions: ["d.ts", "ts", "tsx", "js", "jsx", "json", "node"]
  // moduleNameMapper: {
  //   // "app/core/utils/datemath": "<rootDir>/src/spec/__mocks__/datemath.mock.ts"
  // }
};
