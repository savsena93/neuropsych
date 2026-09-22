# Handoff

## Continue from another account

The current implementation is on GitHub at:

`https://github.com/savsena93/neuropsych.git`

The active branch is `main`. Clone it and install dependencies:

```powershell
git clone https://github.com/savsena93/neuropsych.git
cd neuropsych
npm install
```

Start local development:

```powershell
npm run db:init:local
npm run dev
```

Open `http://127.0.0.1:8787`.

## Current implementation checkpoint

The latest checkpoint includes:

- Participant PIN assignment during examiner preparation
- Examinee-only consent and explicit Begin assessment screen
- Examiner-side live monitoring and session controls
- Local bundled jsPDF support for generated reports
- Rey/TMT timing data in reports
- Cropped MoCA naming stimuli under `assets/test-images/moca/`
- Refreshed assessment and authenticated-workspace UI
- Responsive table shells and empty states
- Primary administrator protection and in-app confirmation dialogs

## Important continuation notes

- Do not run multiple Wrangler dev servers against the same persistence directory at the same time. This can lock local D1 and cause SQLite disk I/O errors.
- Local D1 state is outside Git at `../.wrangler-neuropsych`; it is not transferred by cloning. Reinitialize it with `npm run db:init:local` when starting a fresh checkout.
- Browser/localStorage data is also device-specific. Use the administrator Backup export/import flow to move local data.
- The app is intentionally vanilla JavaScript and remains `file://` compatible. Do not introduce a build framework without revisiting the offline requirement.
- Before deployment, run syntax checks and manually verify the participant flow, examiner live view, pause/resume/stop, PDF report, and stimulus mappings.
- Stimulus mapping: MoCA naming and all RQCST visual blocks now use item-specific local assets, including row composites for spatial orientation items 43-47.
- Operator documentation: see `docs/USER_MANUAL.md` for participant setup, consent, test administration, reports, backup, troubleshooting, and Cloudflare Workers Builds.
- Session control: stopped assessments may now be stopped from either `in_progress` or `paused` state in both the local and Worker backends.

## Git workflow

```powershell
git pull origin main
# make changes
git add .
git commit -m "Describe the change"
git push origin main
```

The GitHub account used for the new session needs access to `savsena93/neuropsych` or the repository must be transferred/shared with that account. GitHub authentication is separate from the AI/Copilot account.
