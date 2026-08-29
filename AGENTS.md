# Repository Guidelines

## Project Structure & Module Organization

This repository is a Hugo theme. Templates live in `layouts/`, with reusable components under `layouts/partials/` and renderers under `layouts/shortcodes/` and `layouts/_markup/`. Tailwind source and browser JavaScript are in `assets/`; Hugo compiles `assets/css/main.css`. Static files are copied from `static/`. `exampleSite/` is the validation fixture. The TypeScript toolchain lives in `tools/src/`, while its installable npm bin is generated in `dist/`. Typst article bundles contain `index.md`, `main.typ`, and ignored output under `generated/typst/`.

## Build, Test, and Development Commands

- `npm ci` installs the locked CLI, Typst, Tailwind, and test dependencies.
- `npm run dev` compiles Typst and serves `exampleSite/` through Hugo.
- `npm run build` performs the production Typst, Hugo, and Tailwind build.
- `npm run check` validates posts and builds into a temporary directory.
- `npm test` runs Vitest; `npm exec -- piatto --help` lists content-management commands.

## Coding Style & Naming Conventions

Follow the edited file. Hugo templates use two-space indentation and lowercase, hyphenated filenames such as `render-image.html`. TypeScript uses four spaces, semicolons, single quotes, strict types, and `camelCase`; avoid shell command strings and keep path operations cross-platform. Keep Tailwind classes discoverable through templates or `assets/css/main.css`. Add local Material Symbols through `layouts/partials/material-icon.html`; do not introduce icon fonts. Name article bundles `exampleSite/content/articles/<slug>/index.md`; Typst uses `main.typ` and optional `typst.css`.

## Testing Guidelines

Add Vitest unit or integration coverage for tool changes. Before submitting, run `npm test`, `npm run check`, and `npm run build`; inspect visual changes through `npm run dev` in light, dark, and narrow layouts. Do not commit `hugo_stats.json`, `coverage/`, or `generated/typst/`. Commit `dist/` whenever TypeScript CLI sources change.

## Commit & Pull Request Guidelines

Recent history favors short, imperative subjects with prefixes such as `feat:`, `fix:`, `style:`, `doc:`, `chore:`, `ci:`, and `typst:`. Keep each commit focused. Pull requests should explain the user-visible change, list validation commands, link relevant issues, and include before/after screenshots for visual changes. Note any Hugo-version, configuration, or generated-asset impact.
