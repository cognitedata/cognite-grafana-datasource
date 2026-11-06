const stylisticTs = require('@stylistic/eslint-plugin-ts');
const grafanaConfig = require("@grafana/eslint-config/flat");

module.exports = [{
  ignores: [
    ".github", 
    ".yarn", 
    "**/dist/", 
    "**/.config/", 
    ".eslintrc.*", 
    ".prettierrc.*",
    "test-results/",
    "playwright-report/",
  ],
},
...grafanaConfig,
{
  rules: {
    "react/prop-types": "off",
    "react-hooks/set-state-in-effect": "warn",
    "react-hooks/preserve-manual-memoization": "warn",
    "react-hooks/refs": "warn",
  },
},
{
  files: ["src/**/*.{ts,tsx}"],
  plugins: {
    '@stylistic/ts': stylisticTs
  },
  languageOptions: {
    ecmaVersion: 5,
    sourceType: "script",
    parserOptions: {
      project: "./tsconfig.json",
    },
  },
  rules: {
    "no-redeclare": ["warn", {
      builtinGlobals: true
    }],
  },
},
{
  // A failure reaches the user, in the query response or at the field that failed,
  // never only the browser console.
  files: ["src/**/*.{ts,tsx}"],
  ignores: ["src/**/__tests__/**", "src/**/*.test.{ts,tsx}", "src/**/*.spec.{ts,tsx}"],
  rules: {
    "no-console": "error",
  },
},
{
  files: ["./tests/**/*"],
  rules: {
    "react-hooks/rules-of-hooks": "off",
  },
}];