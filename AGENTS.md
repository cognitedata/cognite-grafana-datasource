# Agent and contributor instructions

Guidance for humans and coding agents working in this repository, including **Grafana marketplace plugin validation** rules that block publication when violated.

## Grafana marketplace code rules

Grafana’s automated review scans the submitted plugin bundle. Treat these as hard requirements for any change under `src/`.

### Styling: no direct CSS imports

- **Do not** `import '*.css'` (or `.scss`) from application code under `src/`.
- **Do not** use Emotion `<Global />` or other global CSS injection.
- **Do** use Grafana’s styling stack: `@emotion/css` with `useStyles2` from `@grafana/ui`, and `cx` when combining classes.
- Reuse or extend shared styles in [`src/components/common/editorChromeStyles.tsx`](src/components/common/editorChromeStyles.tsx) for tab suffix chips, query help panels, relationships layout, and monospace query inputs.
- For inline help keywords and editor messages, use [`src/components/common/Styled.tsx`](src/components/common/Styled.tsx) (`Keyword`, `FormattedMessage`).
- Prefer theme tokens (`GrafanaTheme2`) for new UI where they fit; keep fixed contrast colors when the design calls for it (e.g. tab suffix chips).

### Legacy Grafana CSS class names

- **Do not** use deprecated global Grafana form class names on DOM nodes.
- **Do not** include the literal substring formed by joining `gf` and `form` with a hyphen in source comments, strings, or tests—the marketplace linter matches it textually.

### TypeScript: no error suppression in shipped code

- **Do not** add `// @ts-ignore` or `// @ts-expect-error` in `src/`.
- **Nearley-generated parsers**: run `yarn build-parser`. The final step runs [`scripts/patch-nearley-grammar.mjs`](scripts/patch-nearley-grammar.mjs), which strips nearley’s `@ts-ignore` header from every generated file under `src/parser/`. New `.ne` outputs only need to be wired into the `build-parser` script in `package.json`; the patch script discovers generated files automatically.

## Before a marketplace release

1. `yarn typecheck`
2. `yarn lint`
3. `yarn test:ci`
4. `yarn build` (production bundle is what Grafana reviews)
5. After merging release work, follow [`.github/workflows/release.yml`](.github/workflows/release.yml) / internal process to sign and resubmit on [Grafana My Plugins](https://grafana.com/orgs).

## Conventions (short)

- Match existing patterns in nearby files; minimize diff scope.
- Use `@grafana/ui` and `@grafana/plugin-ui` field and layout components.
- Do not commit secrets (`.env`, tokens). Docker provisioning uses `.env` locally only.

For local setup and Docker, see [DEVELOPMENT.md](DEVELOPMENT.md).
