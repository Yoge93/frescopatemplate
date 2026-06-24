# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

AEM Edge Delivery Services (EDS) boilerplate — a headless CMS reference implementation called "Frescopa". Content is authored in AEM (`author.aem.cloud`), delivered serverlessly via Helix CDN. No build step for JS/CSS; everything runs as ES6 modules in the browser.

## Commands

```bash
# Lint JavaScript and JSON
npm run lint:js

# Lint CSS
npm run lint:css

# Lint both
npm run lint

# Build component JSON (after editing models/**/*.json)
npm run build:json
```

There is no `dev` server — content is served directly from Helix CDN. Preview and live URLs are:
- Preview: `https://main--refdemoeds--aemxsc.aem.page/`
- Live: `https://main--refdemoeds--aemxsc.aem.live/`

## Architecture

### Block Decorator Pattern

Every component lives in `blocks/{name}/` and follows this contract:

```
blocks/accordion/
├── accordion.js      ← default export `decorate(block)` transforms DOM
├── accordion.css     ← scoped CSS, classes follow .{name}-{element}
└── _accordion.json   ← XWalk model/definition/filters merged at build time
```

Helix auto-imports and calls `decorate(block)` — no registration needed. The `block` argument is a plain `<div>` containing HTML table rows from the authored content. Decorators convert that flat structure into semantic DOM.

**Critical:** Always call `moveInstrumentation(fromEl, toEl)` from `scripts/aem.js` when replacing or wrapping authored elements, to preserve `data-aue-*` attributes needed by the AEM editor.

### JSON Build Pipeline

`models/` contains source JSON files:
- `_component-models.json` → merged → `component-models.json`
- `_component-definition.json` → merged → `component-definition.json`
- `_component-filters.json` → merged → `component-filters.json`

Run `npm run build:json` after any change to `models/` or a block's `_{name}.json`. These generated files drive the AEM authoring UI (XWalk plugin).

### Theming

CSS variables are set globally in `styles/styles.css`. Per-brand overrides live in `styles/industry-specific/{theme-name}/`. Active theme class (e.g., `frescopa-theme`) is set on `<body>`. Key variables: `--brand-theme-color`, `--brand-text-color`, `--nav-background-color`, `--main-accent-color`.

### Key Scripts

| File | Role |
|------|------|
| `scripts/aem.js` | Core Helix utilities: `loadHeader`, `decorateBlocks`, `createOptimizedPicture`, `moveInstrumentation` |
| `scripts/scripts.js` | Main init, `moveInstrumentation()`, `isAuthorEnvironment()` |
| `scripts/utils.js` | `getSiteName()`, `PATH_PREFIX`, language helpers, AEM path normalization |
| `scripts/dom-helpers.js` | DOM element factories (`div`, `picture`, `img`, etc.) |
| `scripts/ffetch.js` | Cached `fetch` wrapper for JSON data |
| `scripts/editor-support.js` | Re-decoration on AEM patch/update events (author mode only) |
| `scripts/blockTemplate.js` | `patternDecorate()` for template-driven blocks |

### Content Paths

Content root is `/content/frescopa/language-masters/{lang}/`. `paths.json` maps AEM content paths to URL paths. Always update `paths.json` when adding new content trees or config endpoints.

### Forms Block

`blocks/form/` is a full sub-framework: validation rules in `rules/`, field components in `components/`, external integrations (Marketo, etc.) in `integrations/`, submission logic in `submit.js`. Treat it as a standalone app when modifying form behavior.

## Code Conventions

- **Import extensions required:** `import { x } from '../../scripts/aem.js'` — `.js` extension is mandatory (ESLint enforces).
- **CSS class naming:** kebab-case, scoped to block name: `.accordion-item-label`, `.cards-card-body`.
- **Underscore prefix:** JSON schema files (`_accordion.json`) are source files; unprefixed JSON files are generated outputs — never edit generated files directly.
- **Line endings:** LF (Unix). ESLint enforces `linebreak-style: unix`.
- **Indentation:** 2 spaces for JS/JSON, 4 spaces for CSS (see `.editorconfig`).
- **No `param-reassign` restriction on props** — modifying `block` children directly is acceptable.
