# Neuropsychological Assessment Toolkit
## User and Operator Manual

This manual describes the normal workflow for the PSYC 728 assessment prototype. Use the hosted Worker deployment when an examiner and examinee use different devices. `file://` mode is intended for one offline tablet and cannot share live monitoring across devices.

## 1. Roles

### Administrator

The administrator manages staff accounts, participants, assessment records, audit activity, backups, and deployment data.

### Examiner

The examiner selects tests, creates participant assignments, observes the assessment, reads examiner-only scripts, scores examiner-scored items, pauses or stops sessions, and downloads reports.

### Examinee

The examinee signs in with the participant code and participant PIN, reviews informed consent, signs consent, completes assigned items, and sees no scores or grades.

## 2. First-time setup

1. Open the deployed Worker URL.
2. Sign in as Administrator with the initial PIN `1234`.
3. Change the PIN when prompted.
4. Open **Users** and create at least one Examiner account.
5. Confirm the D1 database is initialized before enrolling participants.

Do not use a plain static HTTP server for the hosted workflow. The app selects its API backend whenever it is opened over `http(s)`.

## 3. Create an assessment assignment

1. Sign in as Administrator or Examiner.
2. Select **New assessment**.
3. Select one or more tests.
4. Create a participant code. Do not enter the participant's name as the code.
5. Create and securely provide the participant PIN.
6. Enter the required demographic and referral fields.
7. Give the participant the code and PIN through the approved local process.

The selected tests are stored on the participant assignment and are used when the examinee signs in.

## 4. Consent and assessment start

1. The participant signs in with the participant code and PIN.
2. Read the informed-consent screen together.
3. The participant confirms understanding and signs in the signature area.
4. The participant selects **Begin assessment** only after consent is recorded.
5. The examiner remains available throughout the assessment.

If consent is not signed, the assessment session must not start. If consent is withdrawn, the participant and associated sessions are erased by the withdrawal workflow.

## 5. During testing

The examinee sees only the participant-facing prompt, response control, drawing canvas, or stimulus required for the current item. Examiner-only scripts show a neutral instruction to the examinee while the examiner sees the administration text.

The examiner may:

- score examiner-scored items;
- skip an item only after recording a reason;
- pause the session with a reason;
- stop the session with a reason;
- open the live drawing view for supported hosted sessions.

The examinee cannot skip items, pause the session, stop the session, or view scores.

### Drawing and timed tasks

- Drawing responses are saved automatically when the item is completed.
- Rey copy, immediate recall, and delayed recall are separate phases.
- Rey copy shows the figure; recall phases do not.
- TMT and MoCA trail tasks require continuous stylus contact and record timing/errors according to the configured test item.
- The examiner should not coach, reveal scoring, or expose later test phases.

## 6. Pause, resume, and stop

Use **Pause** when the assessment should continue later. A paused session remains resumable and keeps saved responses.

Use **Stop** when the assessment should end without completion. A stop reason is required. Stopped sessions remain recorded and are not resumable.

If the browser closes or the device loses connectivity, sign in again. An incomplete session is offered on the resume screen and continues at the first unanswered item.

## 7. Completion and reports

When all selected tests are finished, the session is marked `completed` and receives a completion timestamp.

Administrators and examiners can open the completed record and use **View report** or **Download PDF report**. Reports contain:

- participant code;
- selected tests;
- scores and interpretations;
- recorded answers;
- examiner points;
- drawing snapshots;
- available timing and error data.

Examinees receive only a neutral completion message and cannot open the report.

## 8. Backups

1. Sign in as Administrator.
2. Open **Backup**.
3. Export the JSON backup to secure storage.
4. On the destination deployment, choose **Import backup**.
5. Use merge to preserve existing destination data or replace only when intentionally adopting the backup as the destination dataset.

Treat backups as sensitive assessment data. Do not email them or place them in a public repository.

## 9. Cloudflare deployment

The repository uses Cloudflare Workers Builds, not GitHub Actions.

### Manual deployment

```powershell
npm install
npx wrangler login
npx wrangler d1 execute DB --file=schema.sql --remote
npx wrangler secret put AUTH_SECRET
npx wrangler deploy
```

### Automatic deployment from GitHub

1. Open Cloudflare **Workers & Pages**.
2. Select the deployed `neuropsych-app` Worker.
3. Open **Settings > Builds > Connect**.
4. Authorize GitHub and select `savsena93/neuropsych`.
5. Select `main` as the production branch.
6. Set the build command to `npx wrangler deploy`.
7. Use the repository root as the project directory and save.

A push to `main` then triggers a Cloudflare build and deployment. Review the build log before using the new version with participants.

## 10. Stimulus asset rules

Use item-specific assets only. Never assign a full test sheet or a multi-stimulus composite to an individual item when it would reveal unrelated material.

The MoCA v8.1 naming items use the isolated files in `assets/test-images/moca/`:

- `naming-1.png` — lion;
- `naming-2.png` — rhinoceros;
- `naming-3.png` — camel.

The RQCST naming items use isolated crops in `assets/test-images/rqcst/naming-1.png` through `naming-5.png`. The five unusual-view items use the five source-ordered single-object images following the naming composite. The spatial-orientation items use row composites in `assets/test-images/rqcst/spatial-43.png` through `spatial-47.png`, each containing its target and A-E choices.

## 11. Troubleshooting

- **Database locked:** stop other Wrangler processes using the same `--persist-to` directory, then start one server.
- **Participant cannot sign in:** verify the exact participant code and PIN; the PIN is case-sensitive if a nonnumeric code was used.
- **No resume option:** confirm the session is `in_progress` or `paused`; completed and stopped sessions are not resumable.
- **No live drawing:** use the hosted Worker/API deployment for cross-device monitoring; local `file://` mode stores state only in that browser.
- **Missing stimulus:** confirm the referenced path is under `assets/test-images/` and verify it in `contact-sheet.html` before changing a test definition.

## 12. Research and clinical-use boundary

This is an academic feasibility prototype. Assessment materials, scoring, permissions, data protection, and clinical use must be reviewed against the applicable instrument owners' requirements before clinical deployment. See `AUTHORIZATION.md` for the project authorization record.
