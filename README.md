# Neuropsychological Assessment Toolkit — Prototype

Plain HTML/CSS/JavaScript, no build step, no frameworks, no CDNs.
**Two deployment modes behind one API:** copy the folder onto the
tablet and open `index.html` for the offline single-tablet mode
(localStorage), or deploy the same folder to **Cloudflare Workers +
D1** (serverless SQLite) for a shared, multi-device deployment — see
**DEPLOYMENT.md**. The backend is chosen automatically from the page
protocol; nothing in the front end changes.

## Where the five tests are

Open `index.html`, log in, tap **+ New assessment**. That takes you
through: **test selection** (checkboxes for all five tests + Practice
Mode) → **participant intake** → **consent capture** → the **test
runner**, which administers whichever tests you picked, one item at a
time, in order → a scored **summary** screen at the end.

Each test's content and scoring live in their own pair of files:

| Test | Editable content | Scoring logic |
|---|---|---|
| MoCA | `data/moca-content.js` | `js/tests/moca.js` |
| RQCST | `data/rqcst-content.js` | `js/tests/rqcst.js` |
| Rey Complex Figure | `data/rey-content.js` | `js/tests/rey.js` |
| Trail-Making Test | `data/tmt-content.js` | `js/tests/tmt.js` |
| BSI-18 | `data/bsi18-content.js` | `js/tests/bsi18.js` |

All five run on one shared renderer, `js/tests/engine.js` — it turns a
plain array of item objects (see the schema at the top of that file)
into UI, timers, auto-save and auto-advance, so none of the five test
files above contain any rendering code themselves.

## Full folder structure

```
neuropsych-app/
├── index.html            Every screen, as hidden <section data-view="...">
├── css/styles.css         Design tokens + components; no web fonts, no CDN
├── js/
│   ├── storage.js         Two swappable backends (localStorage / Worker+D1 API), one DB.* API
│   ├── auth.js            PIN login, role helpers
│   ├── router.js          Shows/hides screens, role-gates routes
│   ├── app.js             Login, dashboards, users, participants, intake, consent
│   ├── test-flow.js       Test selection → runs each chosen test → scored summary
│   ├── backup-ui.js       File/Blob handling for the backup screen
│   └── tests/
│       ├── engine.js       Shared item renderer used by all five tests
│       └── moca.js, rqcst.js, rey.js, tmt.js, bsi18.js   Scoring logic only
├── data/
│   └── moca-content.js, rqcst-content.js, rey-content.js,
│       tmt-content.js, bsi18-content.js                  REAL test content (see each file's header)
├── assets/test-images/    Stimulus images extracted from the source .docx documents
│   └── contact-sheet.html Open this in a browser to VERIFY the image mappings
├── worker.js              Cloudflare Worker: the /api/* backend (D1 + auth + roles)
├── schema.sql             D1 (SQLite) schema for the Worker backend
├── wrangler.toml          Workers config: static assets + D1 binding
├── package.json           wrangler devDependency + npm scripts (dev/deploy)
├── DEPLOYMENT.md          Full hosting walkthrough (Node, GitHub, D1, deploy)
└── lib/                   (empty — reserved if you later want a vendored PDF library)
```

**Why content is JavaScript, not JSON:** the offline/no-CDN requirement
means this has to run from a plain `file://` URL with no local server.
Chrome (and most browsers) block `fetch()`/`XHR` reads of local files
from a `file://` page, so a JSON file loaded that way would silently
fail on the actual tablet even though it might work in some desktop
testing setups. Plain `<script src="data/moca-content.js">` tags have
no such restriction. Practically, this changes nothing about editing
the content — every file is still a plain, readable array of objects —
it just means each one starts with `var SomethingContent = {` instead
of bare `{`.

## What's implemented

- **Users & roles.** PIN login for admin/examiner, forced PIN change on
  first login (default admin PIN `1234`). Admin manages users and sees
  everything; examiners see only their own participants and records.
- **Participants & consent.** Code-only intake (no names, enforced by
  the form), informed consent on an HTML5 canvas signature pad with no
  clear/undo, and "withdraw consent," which **permanently and
  irreversibly erases** the participant and every session tied to them.
- **Assessment workflow.** Examiner picks tests first, then enters
  participant details, matching the spec's ordering. Each item
  auto-saves on answer; timers (verbal fluency, TMT, the Rey 3-minute
  gap) start on their own with no button tap needed. Skipping any item,
  or pausing the whole session, requires a typed reason, which is
  written to the audit log.
- **The five tests — real content**, transcribed from the source
  documents (see each content file's header for what came from where):
  - **MoCA v8.1** — full 30-point scale: interactive alternating trail
    (1-A-2-B-…-E), cube copy, clock, naming, examiner-only verbal
    script items, vigilance error-tally rule, serial 7s, fluency,
    abstraction, delayed recall + MIS cue scoring, orientation,
    education bonus (+1 if ≤12 yrs), 26 cutoff.
  - **RQCST** — all 50 items with the printed form's scoring: 13
    auto-scored vocabulary/similarity/analogy items, the 10-trial
    new-learning sentence rule, spatial neglect drawn programmatically,
    and the Summary of Scores (Orientation /12, Verbal /44,
    Visual-Spatial /34, Global /90).
  - **Rey Complex Figure** — three phases per the SRS (copy → 3-min
    gate → immediate recall → 3-min gate → delayed recall), figure shown
    only in copy, drawing clock starts at the FIRST stroke, scored with
    the 18-element Osterrieth key (0/0.5/1/2 per element, /36 per
    phase) + retention ratio.
  - **TMT** — practice trails then real Parts A (1–25) and B
    (1–13, A–L) as interactive trails: connect without lifting the
    stylus, connected nodes change colour, lifting early or touching a
    wrong node counts as an error without stopping the clock, and
    completion time + errors are recorded against the document's
    thresholds (A: 29s avg / >78s deficient; B: 75s / >273s).
  - **BSI-18** — the official 18 statements with the correct
    interleaved subscale key (SOM 1,4,7,10,13,16 · DEP 2,5,8,11,14,17 ·
    ANX 3,6,9,12,15,18), scored as subscale totals, GSI and PST.
- **SRS rule: examiner-only prompts.** Items the examinee must not see
  (word lists, digit sequences, sentences, mental arithmetic) declare
  `examinerOnly` — when an examinee takes the test, only the domain
  label is shown; the examiner reads the script aloud and has a "show
  script" reveal control.
- **SRS rule: no grades for examinees.** When an examinee finishes a
  session, the summary shows only a hand-back message — scores, the
  per-item answers list, and the print/PDF report stay with the
  examiner/admin.
- **SRS rule: resumable sessions.** In-progress sessions survive the
  app closing: examinees are offered them on next login, examiners get
  Resume + Watch live buttons in their dashboard, and the runner
  continues at the first unanswered item.
- **SRS rule: real-time examiner view.** While the participant draws,
  the canvas pushes throttled snapshots (~1/sec) and the examiner's
  **Watch live** screen shows the drawing updating in real time —
  same-device or hosted (via the `/api/sessions/:id/live` endpoint).
- **Scoring & reports.** Automatic scoring for objective items
  (including MoCA fluency/vigilance conversions and the RQCST trial
  rule), examiner-judgement dropdowns for subjective ones, and a
  per-test screening interpretation on the summary screen using each
  instrument's published cutoffs/thresholds (MoCA 26; TMT 29/78s and
  75/273s; Rey retention; BSI-18 raw/GSI/PST with a clinician note —
  T-score norms are deliberately left to the interpreting
  professional). The printed **PDF report** shows the participant code
  at the top, every per-test section with **every answer and its
  points**, and the participant's actual drawings with their times.
  It uses the browser's own print dialog against a print-only
  stylesheet (`@media print` in `css/styles.css`) — Chrome's "Save as
  PDF" print destination satisfies the requirement with zero extra
  dependencies to vendor or maintain offline. If you specifically need
  a jsPDF-generated file instead of a print-to-PDF one, that can be
  added later in `lib/` without touching any scoring code.
- **Data management.** Full audit trail; admin-only record deletion
  (reason required); JSON export/import for USB backup, with a choice
  between merging and fully replacing existing data on import.
- **Practice Mode.** A persistent banner is shown throughout the test
  runner and summary screens; practice sessions are stored with
  `practiceMode: true` so they're visually distinguishable in the admin
  records view, but they are still real localStorage records (see
  "Known limitations" below).

## Design decisions worth knowing about

- **No web fonts / no CDNs**, flat panels instead of shadows, minimal
  `border-radius` — all chosen for a 1GHz CPU and a `file://`-only
  offline tablet. See the comment block at the top of `css/styles.css`.
- **PIN hashing is intentionally simple, not cryptographic** (see the
  comment at the top of `storage.js`). Fine for a local prototype with
  no network exposure; revisit before any real deployment.
- **Double-tap guards.** While testing, I found that a genuine
  double-tap on the consent "Record consent" button — an entirely
  realistic risk on a touchscreen tablet under time pressure — would
  create two session records from one action, with the second
  overwriting the first mid-flight. `js/app.js` now latches both the
  intake and consent submit handlers so a second, rapid tap is silently
  ignored rather than creating a corrupt second record. I'd recommend
  the same pattern for any other one-shot action you add later.
- **Every `DB.*` call returns a Promise in both backends** (see
  `js/storage.js`) — the hosted backend is inherently async, so the UI
  must chain on results rather than read them synchronously. Every
  caller in `app.js`, `test-flow.js`, `engine.js` and `backup-ui.js`
  now does, and one-shot actions (intake, consent) latch synchronously
  before the write so a rapid double-tap still can't create two records
  while the first is in flight over the network. Role checks are also
  enforced server-side in `worker.js` (admin-only endpoints, examiners
  scoped to their own participants/sessions).
- **RQCST** is the full 50-item Mate-Kole et al. protocol from the
  source form, including the Summary of Scores categories — see the
  header of `data/rqcst-content.js`.
- **Rey scoring** uses the full 18-element Osterrieth key (0/0.5/1/2
  per element, /36 per phase) via one examiner-scored item per phase,
  with the element list spelled out in the prompt for on-screen
  scoring; the MIS-style cue logic lives in the MoCA module instead.
- **BSI-18** uses the official interleaved subscale key; raw totals,
  GSI and PST are reported and T-score interpretation is explicitly
  deferred to the clinician.
- **Verbal stimuli are hidden from examinees** (`examinerOnly` items)
  per the SRS: the screen shows only the domain label for anything the
  examiner reads aloud — memory word lists, digit sequences, the
  vigilance letter string, sentences, arithmetic, RQCST orientation
  questions and the new-learning sentence.

## Testing performed

Everything below was run against the actual files in this folder (not
just read over), using Node for the storage/scoring/Worker layers and a
headless DOM (jsdom) for the click-through UI flows:

- **Scoring + content suite (44 checks)**: MoCA point totals (exactly
  30), education bonus, fluency (≥11) and vigilance (≤1 error)
  conversions, MIS computation excluded from /30; RQCST 50-item
  structure, all 13 auto-scored keys, Verbal /44 + Visual /34 +
  Orientation /12 = Global /90, and the trial-1→10 / >10→0 new-learning
  rule; Rey 3-phase structure, 18-element /36 scoring, retention ratio
  and its divide-by-zero guard; TMT node layouts (1–25, 1–A…12-L-13),
  timing/error recording and threshold interpretation; BSI-18
  interleaved subscale key, GSI and PST.
- **Worker API suite (54 checks)**: the full hosted flow — bootstrap,
  admin PIN change, examiner creation/login, participants, consent,
  examinee sessions with examiner attribution, response auto-save,
  pause/complete/delete, role scoping (admin vs examiner vs examinee),
  export/import between two deployments, hashPin parity with the
  client, malformed-token handling, and the live-drawing endpoints
  (snapshot upsert, examiner-only read, stranger blocked).
- **jsdom UI click-through (19 checks)**: login → forced PIN change →
  examiner creation → examiner login → dashboards → role gating →
  test selection → intake double-tap guard (exactly one participant) →
  duplicate-code rejection.
- **Not automatable here** (needs a touchscreen): trail interaction
  (no-lift drawing, error-on-lift, colour changes), the live view
  updating on a second device, and print-to-PDF output — these are on
  the manual checklist below.

## Known limitations / good next steps

- **VERIFY THE EXTRACTED IMAGES** (one-time, ~5 minutes): open
  `assets/test-images/contact-sheet.html` and check the mappings noted
  at the top — especially (a) that `rey/image1.jpg` is the actual
  complex figure, (b) the RQCST figure rows (items 14, 18, 25–29,
  38–42, 43–47 — best-guess paths are in place and marked VERIFY in
  the content files), and (c) the TMT worksheet files. Fix any wrong
  `stimulusImage` paths in `data/*-content.js`. The MoCA naming animals
  still need cropping out of the scanned full sheet (see the header of
  `data/moca-content.js`) so the memory words aren't leaked.
- Trail node coordinates approximate the printed worksheets — they're
  plain editable fractions if you want the exact validated positions.
- Practice Mode sessions are flagged (`practiceMode: true`) but still
  live in the same sessions table as real ones — they show up in the
  admin records view (marked "Practice") rather than being kept fully
  separate. If you need them truly invisible to the real record set,
  filter or store them separately.
- Canceling out of participant intake or consent doesn't reset the test
  selection you made; starting a new assessment from scratch resets it.

## SRS compliance summary

| SRS requirement | Status |
|---|---|
| Five tests, electronic version (PSYC 728 project) | Implemented with real content from the source documents |
| Text input + tablet/stylus drawing stored | Yes — free-text/number items + no-undo canvas; drawings saved to the session record and shown in the report |
| Examinee has no access to grades after tests | Yes — examinee summary shows only a hand-back message; scores/report are examiner/admin only |
| Examiner selects which tests are taken | Yes — test selection step before intake |
| Answers + grades compiled into one downloadable PDF per participant | Yes — summary print view: participant code at top, per-test sections with every answer + points, drawings with timings |
| Incomplete tests stored and resumed on next login | Yes — resume screen for examinees, Resume button for examiners, continues at the first unanswered item |
| Completed tests marked completed | Yes — `status: 'completed'` + `completedAt` on finish |
| Questions the examinee must not see show only the domain | Yes — `examinerOnly` items across MoCA/RQCST/Rey |
| TMT: one succession without lifting, start/end markers, connected colour change, lift = error, practice parts, timing recorded | Yes — interactive `trail` item type |
| Rey: timed drawing (start→finish), copy untimed/no countdown, immediate after 3 min, delayed after 3 min, figure only in copy, no hint between phases | Yes — three phases, first-stroke timers, gates hide their purpose from the examinee |
| Examiner sees drawings in real time | Yes — Watch live polling view (local or hosted) |
| RQCST: questions extracted per domain, asked separately | Yes — 50 items across 17 domains |
| BSI-18: self-report selections | Yes — 0–4 scale items |
| Pushed to Cloudflare Workers | Yes — `DEPLOYMENT.md` walkthrough (Worker + D1 + static assets + GitHub options) |
