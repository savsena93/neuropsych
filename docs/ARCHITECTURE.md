# Architecture

## Runtime boundary

The project intentionally remains a no-build static application. `index.html` loads scripts in dependency order, so it works from `file://` on an offline tablet and over `http(s)` through the Cloudflare Worker.

## Directory responsibilities

```text
index.html                 Static application shell and screen markup
css/                       Shared visual system and print styles
js/core/                   Platform services: storage, auth, and routing
js/assessment/             Application orchestration and backup UI
js/tests/                  Shared item engine and test scoring modules
data/tests/                Declarative item definitions and prompts
assets/test-images/        Local stimulus assets and verification contact sheet
docs/                      Source documents, operator manual, and project records
lib/                       Vendored browser libraries loaded without a CDN
worker.js                  Cloudflare API entrypoint
db/schema.sql              D1 schema
wrangler.toml              Worker, assets, and D1 configuration
```

## Dependency direction

```text
index.html
  -> js/core/*
  -> data/tests/*
  -> js/tests/engine.js + js/tests/<test>.js
  -> lib/jspdf.umd.min.js
  -> js/assessment/*
```

The content modules are loaded before scoring modules because they publish the test definitions consumed by the scoring code. The assessment layer calls the shared `DB`, `Auth`, `Router`, `Tests`, and `ItemEngine` globals; core services do not depend on UI markup.

## Backend boundary

`js/core/storage.js` exposes one promise-based `DB.*` API. It selects:

- `localStorage` for `file://` offline mode;
- the `/api/*` Cloudflare Worker and D1 backend for `http(s)` mode.

`worker.js` and `wrangler.toml` are intentionally kept at the repository root because Wrangler uses them as deployment entrypoints. `db/schema.sql` is deployment configuration, not a browser module.

## Test extension pattern

To add or revise a test:

1. Add or edit `data/tests/<key>-content.js` for item definitions, prompts, stimuli, timing, and examiner visibility.
2. Add or edit `js/tests/<key>.js` for scoring and interpretation.
3. Add the test module to `window.Tests` in the scoring file if needed.
4. Add its content and scoring scripts to `index.html` in the existing order.
5. Put local stimuli under `assets/test-images/<test>/` and verify them in `contact-sheet.html`.

The shared `js/tests/engine.js` should be changed only when the interaction pattern is genuinely shared by multiple tests.

## Deployment rule

Cloudflare Workers Builds deploys the repository root with `npx wrangler deploy`. Do not move `worker.js` or `wrangler.toml` into browser source directories. Keep the D1 schema under `db/` and source PDFs/DOCX files under `docs/`; `.assetsignore` excludes them from the hosted static asset upload.
