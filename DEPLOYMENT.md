# Deploying to Cloudflare Workers + D1

The app has **two swappable backends behind one API** (see the header of
`js/storage.js`):

| Mode | When | Database | Sessions shared across devices |
|---|---|---|---|
| `file://` (LocalBackend) | App opened directly from the folder — the offline single-tablet deployment | Browser localStorage | No (per-tablet) |
| `http(s)` (ApiBackend) | App served by the deployed Worker | **D1 — Cloudflare's serverless SQLite** | Yes |

The backend is chosen automatically from the page protocol — no
configuration in the front end changes. This folder is the complete
deployment: `worker.js` (the API), `schema.sql` (the D1 schema), and
`wrangler.toml` (the Workers config that serves the static app files
and wires the D1 database).

> **One gotcha:** because an `http(s)` page always uses the API backend,
> serving the folder with a plain static server (e.g.
> `python -m http.server`) will *not* work — every screen would fail to
> reach `/api/*`. For local testing use `npm run dev` (a real Worker +
> locally-emulated D1), or open `index.html` directly for the
> `file://` mode.

## Prerequisites

- **Node.js LTS** — needed only for the `wrangler` deployment tool; the
  app itself never runs on Node. (Already installed on the development
  machine used to build this: Node 24 LTS.)
- **A Cloudflare account** — the free tier is enough (Workers free plan
  and D1's free tier both cover a feasibility prototype many times
  over).
- **A GitHub repo** (recommended, not required) — push this folder
  there first if you want CI deploys or version history. Note the
  `.gitignore` already excludes `node_modules/` and `.wrangler/`.

## One-time setup

Run these from this folder:

```sh
# 1. install wrangler (the Cloudflare CLI)
npm install

# 2. log in (opens a browser window)
npx wrangler login

# 3. create the D1 database and copy the database_id it prints
npx wrangler d1 create neuropsych-db
```

Paste the printed `database_id` into `wrangler.toml`, replacing
`REPLACE_WITH_YOUR_D1_DATABASE_ID`:

```toml
[[d1_databases]]
binding = "DB"
database_name = "neuropsych-db"
database_id = "the-id-wrangler-printed"
```

Then apply the schema and deploy:

```sh
# 4. create the tables (locally-emulated D1 first, then the real one)
npx wrangler d1 execute DB --file=schema.sql --local
npx wrangler d1 execute DB --file=schema.sql --remote

# 5. deploy
npx wrangler deploy
```

`wrangler deploy` prints the live URL (typically
`https://neuropsych-app.<your-subdomain>.workers.dev`). Open it, log in
as **Administrator** with the default PIN **1234** (you'll be forced to
change it), create an examiner under **Admin → Users**, and log in as
that examiner — every device pointing at the same URL now shares the
same participants, sessions and records in D1.

## Connecting GitHub to Cloudflare (optional)

Two ways to make every push auto-deploy; pick one:

1. **Workers Builds (recommended — no secrets to manage).** In the
   Cloudflare dashboard: **Workers & Pages → neuropsych-app → Settings
   → Build → Connect** a Git repository. Cloudflare clones the repo,
   runs `npx wrangler deploy` on every push to the production branch,
   and shows build logs. No GitHub Actions, no API tokens.

2. **GitHub Actions.** Create a Cloudflare API token (dashboard → My
   Profile → API Tokens → "Edit Cloudflare Workers" template), then add
   `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID` as repository
   secrets and use a workflow like:

   ```yaml
   # .github/workflows/deploy.yml
   on:
     push:
       branches: [main]
   jobs:
     deploy:
       runs-on: ubuntu-latest
       steps:
         - uses: actions/checkout@v4
         - uses: cloudflare/wrangler-action@v3
           with:
             apiToken: ${{ secrets.CLOUDFLARE_API_TOKEN }}
             accountId: ${{ secrets.CLOUDFLARE_ACCOUNT_ID }}
             command: deploy
   ```

## Local development and testing

- `npm run dev` — serves the app at `http://localhost:8787` with a real
  Workers runtime and a **locally-emulated D1** (stored under
  `.wrangler/`). All data stays on your machine; re-running
  `npx wrangler d1 execute DB --file=schema.sql --local` resets it.
- Opening `index.html` directly (double-click, `file://`) runs the
  standalone localStorage mode — the offline tablet behaviour.

## Moving existing tablet data to the hosted deployment

Data created in `file://` mode lives in the tablet's browser
localStorage and does not automatically appear in D1. To move it: log
in as admin on the tablet, **Admin → Backup → Export backup (.json)**,
then on the hosted deployment log in as admin, **Admin → Backup** and
import that file (choose **replace** to adopt the tablet's data as-is,
or **merge** to add anything not already present). The export format is
identical in both backends, so nothing is lost or translated.

## Security notes

- **Token signing secret:** auto-generated once and stored inside D1 so
  no secret is committed to the repo. For a hardened deployment, set
  your own with `npx wrangler secret put AUTH_SECRET` (the worker uses
  it when present). Login tokens are HMAC-signed, expire after 24
  hours, and are safely persisted in `localStorage` across page reloads.
- **PIN hashing is intentionally simple, not cryptographic** (same
  checksum as the client — see `js/storage.js`). Fine for a feasibility
  prototype; revisit before any real clinical deployment with sensitive
  data at stake.
- Role checks are enforced **server-side** in `worker.js` (admin-only
  endpoints, examiners scoped to their own participants/sessions), so
  the sharing model doesn't depend on the client behaving.
