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
- Legacy files under `src/css/` are not imported by production code; do not wire them back in. Prefer theme tokens (`GrafanaTheme2`) over hard-coded colors when adding new UI.

### Legacy Grafana CSS class names

- **Do not** use `gf-form*` (or other deprecated global Grafana class names) on DOM nodes.
- **Do not** include the literal substring `gf-form` in source comments or strings—the marketplace linter matches it textually (including in documentation comments).

### TypeScript: no error suppression in shipped code

- **Do not** add `// @ts-ignore` or `// @ts-expect-error` in `src/` (except where upstream/generated tooling absolutely requires it and Grafana accepts an exception—there is none here today).
- **Nearley-generated parsers** (`src/parser/**/grammar.ts`, `src/parser/dms/*.ts` from `.ne` files): regenerate with `yarn build-parser`, which runs [`scripts/patch-nearley-grammar.mjs`](scripts/patch-nearley-grammar.mjs) to satisfy unused-symbol checks (`void id`) without `@ts-ignore`. If you add a new `.ne` → `.ts` output, append that path to the patch script and to the `build-parser` script in `package.json`.

### README and public links

- Keep customer-facing links in `README.md` pointing to resources customers can open (e.g. Cognite Docs, Zendesk support).
- Automated link checkers may report **403** on Zendesk; that is often a crawler limitation, not a broken link for users. Do not replace support URLs solely to appease the bot unless product asks you to.

## Before a marketplace release

1. `yarn typecheck`
2. `yarn lint`
3. `yarn test:ci`
4. `yarn build` (production bundle is what Grafana reviews)
5. After merging release work, follow [`.github/workflows/release.yml`](.github/workflows/release.yml) / internal process to sign and resubmit on [Grafana My Plugins](https://grafana.com/orgs).

## Conventions (short)

- Match existing patterns in nearby files; minimize diff scope.
- Use `@grafana/ui` field and layout components instead of bespoke HTML styled like Grafana 7.
- Do not commit secrets (`.env`, tokens). Docker provisioning uses `.env` locally only.

For local setup and Docker, see [DEVELOPMENT.md](DEVELOPMENT.md).
