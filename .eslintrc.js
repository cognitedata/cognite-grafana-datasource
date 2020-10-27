/*
👋 Hi! This file was autogenerated by tslint-to-eslint-config.
https://github.com/typescript-eslint/tslint-to-eslint-config

It represents the closest reasonable ESLint configuration to this
project's original TSLint configuration.

We recommend eventually switching this configuration to extend from
the recommended rulesets in typescript-eslint.
https://github.com/typescript-eslint/tslint-to-eslint-config/blob/master/docs/FAQs.md

Happy linting! 💖
*/
module.exports = {
    "env": {
        "browser": true,
        "node": true
    },
    "parser": "@typescript-eslint/parser",
    "parserOptions": {
        "project": "tsconfig.json",
        "sourceType": "module"
    },
    "extends": [
        'airbnb-typescript',
        "plugin:@typescript-eslint/recommended",
        "plugin:react/recommended",
        "plugin:import/recommended",
        "prettier/react",
        "prettier/@typescript-eslint",
        "plugin:prettier/recommended",
    ],
    "plugins": [
        "@typescript-eslint",
        "react",
        "import",
        "prettier",
    ],
    "settings": {
        "react": {
            "version": "detect"
        }
    },
    "rules": {
        "@typescript-eslint/explicit-module-boundary-types": "off",
        "@typescript-eslint/no-inferrable-types": "off",
        "@typescript-eslint/no-explicit-any": "off",
        "@typescript-eslint/no-non-null-assertion": "off",
        "@typescript-eslint/ban-ts-comment": "off",
        "@typescript-eslint/no-unused-vars": "off",
        // Allow referencing functions/vars that are defined below in the same file
        "@typescript-eslint/no-use-before-define" : "off",
        "react/prop-types": "off",
        "prettier/prettier": ["error", {"endOfLine":"auto"}],
        "import/no-cycle": "off",
        // Disable "prefer default export" since we don't use default exports
        "import/prefer-default-export": "off",
        // FIXME: Should we use this rule? It looks like "no-extraneous-dependencies" complains about deps that may be provided by grafana toolkit. (deps that aren't defined in package.json)
        "import/no-extraneous-dependencies": "off",
        // FIXME: Should we enforce blank lines between class members? It makes code a tad bit more readable. If not, set this to "off"
        "@typescript-eslint/lines-between-class-members": "off",
        "@typescript-eslint/no-shadow": "off",
        "@typescript-eslint/no-throw-literal": "off",
        "prefer-promise-reject-errors": "off"
    },
    //"ignorePatterns":["*/**/grammar.ts", "src/__tests__/**", "node_modules/**", "/src/parser/**"]
};
