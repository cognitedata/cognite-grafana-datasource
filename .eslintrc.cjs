const stylisticTs = require('@stylistic/eslint-plugin-ts');
const grafanaConfig = require("@grafana/eslint-config/flat");

module.exports = [{
  ignores: [".github", ".yarn", "**/build/", "**/compiled/", "**/dist/", "**/.config/", ".eslintrc.*", ".prettierrc.*"],
},
grafanaConfig, {
  rules: {
    "react/prop-types": "off",
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