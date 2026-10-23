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
    "scripts/.venv/**",
  ],
},
...grafanaConfig,
{
  rules: {
    "react/prop-types": "off",
    "react-hooks/set-state-in-effect": "off",
    "react-hooks/preserve-manual-memoization": "off",
    "react-hooks/immutability": "off",
    "react-hooks/refs": "off",
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
  files: ["./tests/**/*"],
  rules: {
    "react-hooks/rules-of-hooks": "off",
  },
}];