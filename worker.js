/**
 * worker.js
 * -----------------------------------------------------------------------
 * Cloudflare Workers + D1 (serverless SQLite) backend for the toolkit.
 * This is the server half of the two-backend design in js/storage.js:
 * the ApiBackend there calls exactly the /api/* endpoints below whenever
 * the app is served over http(s), so deploying this Worker together with
 * a D1 database turns the single-tablet prototype into a shared,
 * multi-device app — while the same folder keeps working copied onto the
 * tablet (file://, LocalBackend) with no server at all.
 *
 * Routing model: the static assets in this folder (index.html, css/,
 * js/, data/, assets/) are served directly by the Workers assets layer;
 * only paths that are handled by this script (see run_worker_first in
 * wrangler.toml) reach the code below. No changes to the front end are
 * needed to switch between the two modes — the page protocol decides.
 *
 * Auth: /api/login returns a short HMAC-signed token (payload.signature,
 * both base64url) that every other endpoint expects as a Bearer header.
 * Workers are stateless between isolates, so the signing secret comes
 * from the AUTH_SECRET variable when set (wrangler secret put
 * AUTH_SECRET) and otherwise is auto-generated once and stored inside
 * D1 — which keeps secrets out of the repository. Tokens expire after
 * 24 hours as a backstop; the client keeps the token in memory only, so
 * every page reload re-logins anyway.
 *
 * Parity notes:
 *   - hashPin is the same deliberately non-cryptographic checksum as the
 *     client's (see the header of js/storage.js) so backup export/import
 *     stays interoperable between the two backends. Fine for a
 *     feasibility prototype, but it must NOT be treated as secure
 *     storage if this is ever adapted for a real clinical deployment.
 *   - Login mirrors the client's local backend exactly, including the
 *     "no accounts of this role exist yet" distinction from "wrong PIN".
 *   - Stored rows use snake_case columns and are mapped back to the
 *     exact camelCase shapes the client expects, so the same UI code
 *     runs unchanged against either backend.
 */

var TOKEN_TTL_MS = 24 * 60 * 60 * 1000;

// ---- small helpers -----------------------------------------------------

function json(data, status) {
  return new Response(JSON.stringify(data), {
    status: status || 200,
    headers: { 'Content-Type': 'application/json' }
  });
}

function fail(status, message) {
  return json({ error: message }, status);
}

function nowIso() {
  return new Date().toISOString();
}

function nextId(prefix) {
  return prefix + '_' + Date.now().toString(36) + '_' + Math.floor(Math.random() * 1e6).toString(36);
}

// Same checksum as the client (js/storage.js) — keep the two in lockstep.
function hashPin(pin) {
  var str = String(pin);
  var hash = 0;
  for (var i = 0; i < str.length; i++) {
    hash = (hash * 31 + str.charCodeAt(i)) >>> 0;
  }
  return 'h' + hash.toString(36);
}

async function readJson(request) {
  try {
    return await request.json();
  } catch (e) {
    return null;
  }
}

// ---- base64url + HMAC token signing / verification ----------------------

function bytesToBase64url(bytes) {
  var binary = '';
  for (var i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function base64urlToBytes(str) {
  var b64 = String(str).replace(/-/g, '+').replace(/_/g, '/');
  while (b64.length % 4) b64 += '=';
  var binary = atob(b64);
  var bytes = new Uint8Array(binary.length);
  for (var i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

async function hmacSign(dataStr, secret) {
  var key = await crypto.subtle.importKey(
    'raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
  );
  var sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(dataStr));
  return bytesToBase64url(new Uint8Array(sig));
}

async function hmacVerify(dataStr, sigB64url, secret) {
  var key = await crypto.subtle.importKey(
    'raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['verify']
  );
  return await crypto.subtle.verify('HMAC', key, base64urlToBytes(sigB64url), new TextEncoder().encode(dataStr));
}

// Secret: env.AUTH_SECRET if set, otherwise generated once and stored in
// the settings table (never committed to the repository).
async function getSecret(env) {
  if (env.AUTH_SECRET) return env.AUTH_SECRET;
  var row = await env.DB.prepare("SELECT value FROM settings WHERE key = 'auth_secret'").first();
  if (row) return row.value;
  var bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  var generated = bytesToBase64url(bytes);
  await env.DB.prepare("INSERT INTO settings (key, value) VALUES ('auth_secret', ?)")
    .bind(generated).run();
  return generated;
}

async function issueToken(user, secret) {
  var payload = { uid: user.id, role: user.role, exp: Date.now() + TOKEN_TTL_MS };
  var body = bytesToBase64url(new TextEncoder().encode(JSON.stringify(payload)));
  return body + '.' + (await hmacSign(body, secret));
}

async function verifyToken(token, secret) {
  // Fully defensive: a malformed token (bad base64, wrong signature
  // length) makes atob/subtle.verify throw rather than return false —
  // any throw means "not a valid token" and must surface as a 401, not
  // a 500.
  try {
    var parts = String(token).split('.');
    if (parts.length !== 2) return null;
    var ok = await hmacVerify(parts[0], parts[1], secret);
    if (!ok) return null;
    var payload = JSON.parse(new TextDecoder().decode(base64urlToBytes(parts[0])));
    if (!payload || !payload.uid || !payload.role) return null;
    if (typeof payload.exp !== 'number' || Date.now() > payload.exp) return null;
    return payload;
  } catch (e) {
    return null;
  }
}

async function authenticate(request, env) {
  var header = request.headers.get('Authorization') || '';
  if (header.indexOf('Bearer ') !== 0) return null;
  return verifyToken(header.slice(7), await getSecret(env));
}

// ---- row <-> client-shape mappers ---------------------------------------

function userFromRow(r) {
  return {
    id: r.id,
    role: r.role,
    name: r.name,
    pin: r.pin,
    mustChangePin: !!r.must_change_pin,
    createdAt: r.created_at
  };
}

function participantFromRow(r) {
  return {
    code: r.code,
    accessPin: r.participant_pin || null,
    assignedTests: JSON.parse(r.assigned_tests || '[]'),
    age: r.age,
    sex: r.sex,
    education: r.education,
    referral: r.referral,
    dateEnrolled: r.date_enrolled,
    consent: JSON.parse(r.consent),
    createdBy: r.created_by,
    createdAt: r.created_at
  };
}

function sessionFromRow(r) {
  return {
    id: r.id,
    participantCode: r.participant_code,
    examinerId: r.examiner_id,
    testsSelected: JSON.parse(r.tests_selected),
    status: r.status,
    practiceMode: !!r.practice_mode,
    startedAt: r.started_at,
    completedAt: r.completed_at,
    responses: JSON.parse(r.responses),
    scores: JSON.parse(r.scores),
    pauses: JSON.parse(r.pauses),
    deleted: !!r.deleted,
    deleteReason: r.delete_reason
  };
}

function auditFromRow(r) {
  return {
    id: r.id,
    timestamp: r.timestamp,
    actorId: r.actor_id,
    actorRole: r.actor_role,
    action: r.action,
    targetType: r.target_type,
    targetId: r.target_id,
    reason: r.reason,
    details: r.details ? JSON.parse(r.details) : null
  };
}

// ---- audit log -----------------------------------------------------------

async function audit(env, actor, action, targetType, targetId, reason, details) {
  await env.DB.prepare(
    'INSERT INTO audit_log (id, timestamp, actor_id, actor_role, action, target_type, target_id, reason, details) ' +
    'VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)'
  ).bind(
    nextId('audit'), nowIso(), actor ? actor.id : null, actor ? actor.role : null,
    action, targetType, targetId, reason || null, details ? JSON.stringify(details) : null
  ).run();
}

// ---- shared insert statements (used by create + import) ------------------

function insertUserStmt(env, u) {
  return env.DB.prepare(
    'INSERT INTO users (id, role, name, pin, must_change_pin, created_at) VALUES (?, ?, ?, ?, ?, ?)'
  ).bind(u.id, u.role, u.name, u.pin, u.mustChangePin ? 1 : 0, u.createdAt || nowIso());
}

function emptyConsent() {
  return { signedAt: null, signatureDataUrl: null, withdrawn: false, withdrawnAt: null };
}

function insertParticipantStmt(env, p) {
  return env.DB.prepare(
    'INSERT INTO participants (code, participant_pin, assigned_tests, age, sex, education, referral, date_enrolled, consent, created_by, created_at) ' +
    'VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
  ).bind(
    p.code,
    p.accessPin || null,
    JSON.stringify(p.assignedTests || []),
    p.age !== undefined ? p.age : null,
    p.sex !== undefined ? p.sex : null,
    p.education !== undefined ? p.education : null,
    p.referral !== undefined ? p.referral : null,
    p.dateEnrolled || nowIso(),
    JSON.stringify(p.consent || emptyConsent()),
    p.createdBy !== undefined ? p.createdBy : null,
    p.createdAt || nowIso()
  );
}

function insertSessionStmt(env, s) {
  return env.DB.prepare(
    'INSERT INTO sessions (id, participant_code, examiner_id, tests_selected, status, practice_mode, ' +
    'started_at, completed_at, responses, scores, pauses, deleted, delete_reason) ' +
    'VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
  ).bind(
    s.id,
    s.participantCode,
    s.examinerId !== undefined ? s.examinerId : null,
    JSON.stringify(s.testsSelected || []),
    s.status || 'in_progress',
    s.practiceMode ? 1 : 0,
    s.startedAt || nowIso(),
    s.completedAt || null,
    JSON.stringify(s.responses || {}),
    JSON.stringify(s.scores || {}),
    JSON.stringify(s.pauses || []),
    s.deleted ? 1 : 0,
    s.deleteReason || null
  );
}

// ---- endpoint handlers ---------------------------------------------------

// POST /api/login — same rules as the client's LocalBackend.loginUser,
// including the "no accounts of this role exist yet" error so someone
// picking Examiner on a fresh install is told what to do.
async function handleLogin(request, env) {
  var body = await readJson(request);
  if (!body || !body.role) return fail(400, 'Choose a role to log in.');

  if (body.role === 'examinee') {
    var code = (body.code || '').trim();
    if (!code) return fail(400, 'Enter your participant code.');
    if (!body.pin) return fail(400, 'Enter your participant PIN.');
    var prow = await env.DB.prepare('SELECT * FROM participants WHERE code = ?').bind(code).first();
    if (!prow) {
      return fail(401, 'No participant found with that code. Ask your examiner to check it.');
    }
    var participant = participantFromRow(prow);
    if (participant.accessPin && participant.accessPin !== hashPin(body.pin)) {
      return fail(401, 'Incorrect participant PIN.');
    }
    var examinee = {
      id: 'examinee:' + code,
      role: 'examinee',
      name: 'Participant ' + code,
      examineeParticipant: participant
    };
    var secret0 = await getSecret(env);
    return json({ token: await issueToken(examinee, secret0), user: examinee });
  }

  var urow = await env.DB.prepare('SELECT * FROM users WHERE pin = ? AND role = ?')
    .bind(hashPin(body.pin), body.role).first();
  if (!urow) {
    var count = await env.DB.prepare('SELECT COUNT(*) AS n FROM users WHERE role = ?').bind(body.role).first();
    if (!count || count.n === 0) {
      return fail(401, 'No ' + (body.role === 'admin' ? 'administrator' : 'examiner') +
        ' accounts exist yet. The administrator must create one under Admin -> Users first.');
    }
    return fail(401, 'Incorrect PIN.');
  }
  var staff = userFromRow(urow);
  var secret = await getSecret(env);
  return json({ token: await issueToken(staff, secret), user: staff });
}

// GET /api/bootstrap — called at app startup before any login. Creates
// the default administrator (PIN 1234, forced change on first login)
// exactly like the local backend's first run. The conditional INSERT is
// race-safe against two devices booting the fresh deployment at once.
async function handleBootstrap(env) {
  try { await env.DB.prepare('ALTER TABLE participants ADD COLUMN participant_pin TEXT').run(); } catch (e) {}
  try { await env.DB.prepare("ALTER TABLE participants ADD COLUMN assigned_tests TEXT NOT NULL DEFAULT '[]'").run(); } catch (e) {}
  var defaultPin = '1234';
  var result = await env.DB.prepare(
    'INSERT INTO users (id, role, name, pin, must_change_pin, created_at) ' +
    'SELECT ?, ?, ?, ?, 1, ? WHERE NOT EXISTS (SELECT 1 FROM users)'
  ).bind(nextId('user'), 'admin', 'Administrator', hashPin(defaultPin), nowIso()).run();
  var inserted = result.meta && result.meta.changes > 0;
  if (inserted) {
    await audit(env, null, 'system_init', 'settings', null, null, { defaultAdminPin: defaultPin });
    return json({ firstRun: true, defaultAdminPin: defaultPin });
  }
  return json({ firstRun: false });
}

// GET /api/settings — only initialized/appVersion are exposed; the
// auth_secret row (if any) deliberately never leaves the server.
async function readSettings(env) {
  var rows = await env.DB.prepare("SELECT key, value FROM settings WHERE key IN ('initialized', 'appVersion')").all();
  var out = { initialized: false, appVersion: '0.1.0-prototype' };
  (rows.results || []).forEach(function (r) {
    if (r.key === 'initialized') out.initialized = r.value === 'true';
    if (r.key === 'appVersion') out.appVersion = r.value;
  });
  return out;
}

async function handleGetSettings(env) {
  return json({ settings: await readSettings(env) });
}

// POST /api/settings {patch} — admin only.
async function handleSetSettings(request, env, actor) {
  if (actor.role !== 'admin') return fail(403, 'Administrator access required.');
  var body = await readJson(request);
  var patch = body && body.patch;
  if (!patch || typeof patch !== 'object') return fail(400, 'Invalid settings patch.');
  var stmts = [];
  Object.keys(patch).forEach(function (key) {
    stmts.push(
      env.DB.prepare(
        'INSERT INTO settings (key, value) VALUES (?, ?) ' +
        'ON CONFLICT(key) DO UPDATE SET value = excluded.value'
      ).bind(key, String(patch[key]))
    );
  });
  if (stmts.length) await env.DB.batch(stmts);
  return json({ settings: await readSettings(env) });
}

// GET /api/audit — admin only.
async function handleAuditList(env, actor) {
  if (actor.role !== 'admin') return fail(403, 'Administrator access required.');
  var rows = await env.DB.prepare('SELECT * FROM audit_log ORDER BY rowid').all();
  return json({ log: (rows.results || []).map(auditFromRow) });
}

// GET /api/users — admin only.
async function handleListUsers(env, actor) {
  if (actor.role !== 'admin') return fail(403, 'Administrator access required.');
  var rows = await env.DB.prepare('SELECT * FROM users ORDER BY rowid').all();
  return json({ users: (rows.results || []).map(userFromRow) });
}

// POST /api/users {name, role, pin} — admin only.
async function handleCreateUser(request, env, actor) {
  if (actor.role !== 'admin') return fail(403, 'Administrator access required.');
  var body = await readJson(request);
  if (!body || !body.name || !body.role || !body.pin) {
    return fail(400, 'Name, role and PIN are required.');
  }
  if (body.role !== 'admin' && body.role !== 'examiner') {
    return fail(400, 'Role must be admin or examiner.');
  }
  var user = {
    id: nextId('user'),
    role: body.role,
    name: body.name,
    pin: hashPin(body.pin),
    mustChangePin: false,
    createdAt: nowIso()
  };
  await insertUserStmt(env, user).run();
  await audit(env, actor, 'user_create', 'user', user.id, null, { role: user.role, name: user.name });
  return json({ user: user });
}

// DELETE /api/users/:id {reason} — admin only. Sessions that referenced
// the deleted examiner keep their examinerId, same as the local backend.
async function handleDeleteUser(request, env, actor, userId) {
  if (actor.role !== 'admin') return fail(403, 'Administrator access required.');
  if (actor.id === userId) return fail(400, 'You cannot delete the account you are currently using.');
  var primary = await env.DB.prepare("SELECT id FROM users WHERE role = 'admin' ORDER BY created_at, id LIMIT 1").first();
  if (primary && primary.id === userId) return fail(400, 'The primary administrator account cannot be deleted.');
  var body = await readJson(request);
  var result = await env.DB.prepare('DELETE FROM users WHERE id = ?').bind(userId).run();
  if (result.meta && result.meta.changes > 0) {
    await audit(env, actor, 'user_delete', 'user', userId, (body && body.reason) || null, null);
  }
  return json({ ok: true });
}

// POST /api/change-pin {newPin} — staff only; a user only ever changes
// their own PIN (the id comes from the token, not the body).
async function handleChangePin(request, env, actor) {
  if (actor.role === 'examinee') return fail(403, 'Examinees have no PIN to change.');
  var body = await readJson(request);
  if (!body || !body.newPin) return fail(400, 'Enter a new PIN.');
  var result = await env.DB.prepare('UPDATE users SET pin = ?, must_change_pin = 0 WHERE id = ?')
    .bind(hashPin(body.newPin), actor.id).run();
  if (!result.meta || result.meta.changes === 0) return fail(404, 'Account not found.');
  await audit(env, actor, 'user_pin_change', 'user', actor.id, null, null);
  var row = await env.DB.prepare('SELECT * FROM users WHERE id = ?').bind(actor.id).first();
  return json({ user: userFromRow(row) });
}

// GET /api/participants — admin sees all; examiners only the
// participants they enrolled (createdBy), which is also what the UI
// filters for, so both see exactly what they should.
async function handleListParticipants(env, actor) {
  var rows;
  if (actor.role === 'admin') {
    rows = await env.DB.prepare('SELECT * FROM participants ORDER BY rowid').all();
  } else if (actor.role === 'examiner') {
    rows = await env.DB.prepare('SELECT * FROM participants WHERE created_by = ? ORDER BY rowid')
      .bind(actor.id).all();
  } else {
    return fail(403, 'Examinees cannot list participants.');
  }
  return json({ participants: (rows.results || []).map(participantFromRow) });
}

// POST /api/participants — staff only.
async function handleCreateParticipant(request, env, actor) {
  if (actor.role === 'examinee') return fail(403, 'Examinees cannot create participants.');
  var body = await readJson(request);
  if (!body || !body.code) return fail(400, 'A participant code is required.');
  var existing = await env.DB.prepare('SELECT code FROM participants WHERE code = ?').bind(body.code).first();
  if (existing) {
    return fail(400, 'A participant with code "' + body.code + '" already exists.');
  }
  var record = {
    code: body.code,
    accessPin: hashPin(body.accessPin || body.code),
    assignedTests: body.assignedTests || [],
    age: body.age !== undefined ? body.age : null,
    sex: body.sex !== undefined ? body.sex : null,
    education: body.education !== undefined ? body.education : null,
    referral: body.referral !== undefined ? body.referral : null,
    dateEnrolled: body.dateEnrolled || nowIso(),
    consent: emptyConsent(),
    createdBy: actor.id,
    createdAt: nowIso()
  };
  await insertParticipantStmt(env, record).run();
  await audit(env, actor, 'participant_create', 'participant', record.code, null, null);
  return json({ participant: Object.assign({}, record, { issuedPin: body.accessPin || body.code }) });
}

// GET /api/participants/:code — admins any participant; examiners only
// their own; examinees only their own code.
async function handleGetParticipant(env, actor, code) {
  var row = await env.DB.prepare('SELECT * FROM participants WHERE code = ?').bind(code).first();
  if (!row) return fail(404, 'Participant not found.');
  var participant = participantFromRow(row);
  if (actor.role === 'examiner' && participant.createdBy !== actor.id) {
    return fail(403, 'Not your participant.');
  }
  if (actor.role === 'examinee' && ('examinee:' + participant.code) !== actor.id) {
    return fail(403, 'Not your participant.');
  }
  return json({ participant: participant });
}

// POST /api/participants/:code/consent {signatureDataUrl} — any
// authenticated role, matching the local backend (the consent screen is
// worked through by whoever is with the participant).
async function handleConsent(request, env, actor, code) {
  var row = await env.DB.prepare('SELECT * FROM participants WHERE code = ?').bind(code).first();
  if (!row) return fail(404, 'Participant not found.');
  var body = await readJson(request);
  var participant = participantFromRow(row);
  participant.consent.signedAt = nowIso();
  participant.consent.signatureDataUrl = body ? body.signatureDataUrl : null;
  await env.DB.prepare('UPDATE participants SET consent = ? WHERE code = ?')
    .bind(JSON.stringify(participant.consent), code).run();
  await audit(env, actor, 'consent_signed', 'participant', code, null, null);
  return json({ participant: participant });
}

// POST /api/participants/:code/withdraw {reason} — permanently deletes
// the participant and every session tied to them, same as the local
// backend. Destructive by design and not undoable from within the app.
async function handleWithdraw(request, env, actor, code) {
  var row = await env.DB.prepare('SELECT code FROM participants WHERE code = ?').bind(code).first();
  if (!row) return fail(404, 'Participant not found.');
  var before = await env.DB.prepare('SELECT id FROM sessions WHERE participant_code = ?').bind(code).all();
  await env.DB.batch([
    env.DB.prepare('DELETE FROM participants WHERE code = ?').bind(code),
    env.DB.prepare('DELETE FROM sessions WHERE participant_code = ?').bind(code)
  ]);
  var body = await readJson(request);
  await audit(env, actor, 'consent_withdrawn_erasure', 'participant', code,
    (body && body.reason) || null, { sessionsErased: (before.results || []).length });
  return json({ ok: true });
}

// GET /api/sessions — admin: everything (including deleted, which the UI
// shows struck through); examiner: their own non-deleted sessions;
// examinee: the non-deleted sessions tied to their participant code
// (so a future resume feature can find them).
async function handleListSessions(env, actor) {
  var rows;
  if (actor.role === 'admin') {
    rows = await env.DB.prepare('SELECT * FROM sessions ORDER BY rowid').all();
  } else if (actor.role === 'examiner') {
    rows = await env.DB.prepare('SELECT * FROM sessions WHERE examiner_id = ? AND deleted = 0 ORDER BY rowid')
      .bind(actor.id).all();
  } else {
    rows = await env.DB.prepare('SELECT * FROM sessions WHERE participant_code = ? AND deleted = 0 ORDER BY rowid')
      .bind(String(actor.id).replace(/^examinee:/, '')).all();
  }
  return json({ sessions: (rows.results || []).map(sessionFromRow) });
}

// POST /api/sessions — any authenticated role. body.examinerId overrides
// the actor — used when an examinee takes the test, attributing the
// session to the examiner who enrolled the participant.
async function handleCreateSession(request, env, actor) {
  var body = await readJson(request);
  var participantRow = body && body.participantCode
    ? await env.DB.prepare('SELECT * FROM participants WHERE code = ?').bind(body.participantCode).first() : null;
  if (!participantRow) return fail(400, 'Participant assignment not found.');
  var participant = participantFromRow(participantRow);
  if (actor.role === 'examinee' && participant.code !== String(actor.id).replace(/^examinee:/, '')) {
    return fail(403, 'Not your participant assignment.');
  }
  var session = {
    id: nextId('session'),
    participantCode: body ? body.participantCode : null,
    examinerId: body && body.examinerId !== undefined && body.examinerId !== null
      ? body.examinerId
      : actor.id,
    testsSelected: actor.role === 'examinee' ? participant.assignedTests : ((body && body.testsSelected) || []),
    status: 'in_progress',
    practiceMode: !!(body && body.practiceMode),
    startedAt: nowIso(),
    completedAt: null,
    responses: {},
    scores: {},
    pauses: [],
    deleted: false,
    deleteReason: null
  };
  await insertSessionStmt(env, session).run();
  await audit(env, actor, 'session_create', 'session', session.id, null,
    { participantCode: session.participantCode, practiceMode: session.practiceMode });
  return json({ session: session });
}

// Ownership check shared by the per-session endpoints: admins see
// everything, examiners their own sessions, examinees their own
// participant's sessions.
async function loadSessionForActor(env, actor, sessionId) {
  var row = await env.DB.prepare('SELECT * FROM sessions WHERE id = ?').bind(sessionId).first();
  if (!row) return { error: fail(404, 'Session not found.') };
  var session = sessionFromRow(row);
  if (actor.role === 'admin') return { session: session };
  if (actor.role === 'examiner' && session.examinerId === actor.id) return { session: session };
  if (actor.role === 'examinee' && session.participantCode === String(actor.id).replace(/^examinee:/, '')) {
    return { session: session };
  }
  return { error: fail(403, 'Not your session.') };
}

// GET /api/sessions/:id
async function handleGetSession(env, actor, sessionId) {
  var found = await loadSessionForActor(env, actor, sessionId);
  if (found.error) return found.error;
  return json({ session: found.session });
}

// PATCH /api/sessions/:id/response {testKey, itemKey, value} — the
// auto-save path. Intentionally quiet (no audit entry per keystroke,
// same as the local backend) so the audit log stays readable.
async function handleSaveResponse(request, env, actor, sessionId) {
  var found = await loadSessionForActor(env, actor, sessionId);
  if (found.error) return found.error;
  var body = await readJson(request);
  if (!body || !body.testKey || !body.itemKey) {
    return fail(400, 'testKey and itemKey are required.');
  }
  var session = found.session;
  if (!session.responses[body.testKey]) session.responses[body.testKey] = {};
  session.responses[body.testKey][body.itemKey] = body.value !== undefined ? body.value : null;
  await env.DB.prepare('UPDATE sessions SET responses = ? WHERE id = ?')
    .bind(JSON.stringify(session.responses), sessionId).run();
  return json({ session: session });
}

// POST /api/sessions/:id/pause {reason, type} — action is
// "session_<type>" ("pause" or "abort"), same as the local backend.
async function handlePause(request, env, actor, sessionId) {
  var found = await loadSessionForActor(env, actor, sessionId);
  if (found.error) return found.error;
  var body = await readJson(request);
  var type = body && body.type ? body.type : 'pause';
  var entry = { type: type, reason: body ? body.reason : null, timestamp: nowIso() };
  found.session.pauses.push(entry);
  if (type === 'pause') {
    found.session.status = 'paused';
    await env.DB.prepare('UPDATE sessions SET status = ?, pauses = ? WHERE id = ?')
      .bind(found.session.status, JSON.stringify(found.session.pauses), sessionId).run();
  } else {
    await env.DB.prepare('UPDATE sessions SET pauses = ? WHERE id = ?')
      .bind(JSON.stringify(found.session.pauses), sessionId).run();
  }
  await audit(env, actor, 'session_' + type, 'session', sessionId, entry.reason, null);
  return json({ session: found.session });
}

// POST /api/sessions/:id/resume — resume a session paused by staff.
async function handleResume(env, actor, sessionId) {
  var found = await loadSessionForActor(env, actor, sessionId);
  if (found.error) return found.error;
  if (found.session.status !== 'paused') return fail(400, 'Only a paused session can be resumed.');
  found.session.status = 'in_progress';
  await env.DB.prepare('UPDATE sessions SET status = ? WHERE id = ?').bind('in_progress', sessionId).run();
  await audit(env, actor, 'session_resume', 'session', sessionId, null, null);
  return json({ session: found.session });
}

// POST /api/sessions/:id/complete {scores}
async function handleComplete(request, env, actor, sessionId) {
  var found = await loadSessionForActor(env, actor, sessionId);
  if (found.error) return found.error;
  var body = await readJson(request);
  found.session.status = 'completed';
  found.session.completedAt = nowIso();
  if (body && body.scores) found.session.scores = body.scores;
  await env.DB.prepare('UPDATE sessions SET status = ?, completed_at = ?, scores = ? WHERE id = ?')
    .bind(found.session.status, found.session.completedAt, JSON.stringify(found.session.scores), sessionId).run();
  await audit(env, actor, 'session_complete', 'session', sessionId, null, null);
  return json({ session: found.session });
}

// POST /api/sessions/:id/stop {reason} — stop an in-progress assessment
// without deleting its saved answers. Stopped sessions are not resumable.
async function handleStop(request, env, actor, sessionId) {
  var found = await loadSessionForActor(env, actor, sessionId);
  if (found.error) return found.error;
  if (found.session.status !== 'in_progress') return fail(400, 'Only an in-progress session can be stopped.');
  var body = await readJson(request);
  if (!body || !body.reason || !String(body.reason).trim()) return fail(400, 'A reason is required to stop a session.');
  found.session.status = 'stopped';
  found.session.stoppedAt = nowIso();
  found.session.stopReason = String(body.reason).trim();
  found.session.pauses.push({ type: 'stop', reason: found.session.stopReason, timestamp: found.session.stoppedAt });
  await env.DB.prepare('UPDATE sessions SET status = ?, pauses = ? WHERE id = ?')
    .bind(found.session.status, JSON.stringify(found.session.pauses), sessionId).run();
  await audit(env, actor, 'session_stop', 'session', sessionId, found.session.stopReason, null);
  return json({ session: found.session });
}

// DELETE /api/sessions/:id {reason} — admin-only soft delete (the record
// stays with a deleted flag so the admin view can show it struck
// through), matching the local backend.
async function handleDeleteSession(request, env, actor, sessionId) {
  if (actor.role !== 'admin') return fail(403, 'Administrator access required.');
  var row = await env.DB.prepare('SELECT * FROM sessions WHERE id = ?').bind(sessionId).first();
  if (!row) return fail(404, 'Session not found.');
  var body = await readJson(request);
  var session = sessionFromRow(row);
  session.deleted = true;
  session.deleteReason = body ? body.reason : null;
  await env.DB.prepare('UPDATE sessions SET deleted = 1, delete_reason = ? WHERE id = ?')
    .bind(session.deleteReason, sessionId).run();
  await audit(env, actor, 'session_delete', 'session', sessionId, session.deleteReason, null);
  return json({ session: session });
}

// POST/GET /api/sessions/:id/live — the examiner's real-time view of the
// participant's drawing (SRS). The runner POSTs throttled canvas snapshots
// while the participant draws; the examiner Live view polls the GET. Only
// the latest snapshot per session is kept — the permanent session record
// still receives only the finished drawing.
async function handleSaveLiveDrawing(request, env, actor, sessionId) {
  var found = await loadSessionForActor(env, actor, sessionId);
  if (found.error) return found.error;
  var body = await readJson(request);
  if (!body || !body.dataUrl) return fail(400, 'dataUrl is required.');
  await env.DB.prepare(
    'INSERT INTO live_state (session_id, test_key, item_id, image_url, updated_at) VALUES (?, ?, ?, ?, ?) ' +
    'ON CONFLICT(session_id) DO UPDATE SET test_key = excluded.test_key, item_id = excluded.item_id, ' +
    'image_url = excluded.image_url, updated_at = excluded.updated_at'
  ).bind(sessionId, body.testKey || null, body.itemId || null, body.dataUrl, nowIso()).run();
  return json({ ok: true });
}

async function handleGetLiveDrawing(env, actor, sessionId) {
  var found = await loadSessionForActor(env, actor, sessionId);
  if (found.error) return found.error;
  var row = await env.DB.prepare('SELECT * FROM live_state WHERE session_id = ?').bind(sessionId).first();
  if (!row) return json({ live: null });
  return json({
    live: {
      testKey: row.test_key,
      itemId: row.item_id,
      dataUrl: row.image_url,
      updatedAt: row.updated_at
    }
  });
}

// GET /api/export — admin only. Same shape as the local backend's
// exportAll, so a JSON backup moves losslessly in either direction
// between a tablet (file://) and this hosted deployment.
async function handleExport(env, actor) {
  if (actor.role !== 'admin') return fail(403, 'Administrator access required.');
  var settings = await readSettings(env);
  var users = await env.DB.prepare('SELECT * FROM users ORDER BY rowid').all();
  var participants = await env.DB.prepare('SELECT * FROM participants ORDER BY rowid').all();
  var sessions = await env.DB.prepare('SELECT * FROM sessions ORDER BY rowid').all();
  var log = await env.DB.prepare('SELECT * FROM audit_log ORDER BY rowid').all();
  return json({
    exportedAt: nowIso(),
    appVersion: settings.appVersion,
    settings: settings,
    users: (users.results || []).map(userFromRow),
    participants: (participants.results || []).map(participantFromRow),
    sessions: (sessions.results || []).map(sessionFromRow),
    auditLog: (log.results || []).map(auditFromRow)
  });
}

// POST /api/import {payload, mode} — admin only. mode 'replace' wipes
// existing users/participants/sessions first; 'merge' appends anything
// whose id/code is not already present (existing records win on clash) —
// the exact rules of the local backend, so a backup file behaves the
// same on either side.
async function handleImport(request, env, actor) {
  if (actor.role !== 'admin') return fail(403, 'Administrator access required.');
  var body = await readJson(request);
  if (!body || !body.payload || typeof body.payload !== 'object') {
    return fail(400, 'Invalid backup file.');
  }
  var payload = body.payload;
  var mode = body.mode || 'merge';

  if (mode === 'replace') {
    await env.DB.batch([
      env.DB.prepare('DELETE FROM users'),
      env.DB.prepare('DELETE FROM participants'),
      env.DB.prepare('DELETE FROM sessions')
    ]);
  }

  var stmts = [];
  var haveUser = {};
  var haveParticipant = {};
  var haveSession = {};

  if (mode === 'merge') {
    var existingUsers = await env.DB.prepare('SELECT id FROM users').all();
    (existingUsers.results || []).forEach(function (r) { haveUser[r.id] = true; });
    var existingParticipants = await env.DB.prepare('SELECT code FROM participants').all();
    (existingParticipants.results || []).forEach(function (r) { haveParticipant[r.code] = true; });
    var existingSessions = await env.DB.prepare('SELECT id FROM sessions').all();
    (existingSessions.results || []).forEach(function (r) { haveSession[r.id] = true; });
  }

  (payload.users || []).forEach(function (u) {
    if (u && u.id && (mode === 'replace' || !haveUser[u.id])) {
      stmts.push(insertUserStmt(env, u));
    }
  });
  (payload.participants || []).forEach(function (p) {
    if (p && p.code && (mode === 'replace' || !haveParticipant[p.code])) {
      stmts.push(insertParticipantStmt(env, p));
    }
  });
  (payload.sessions || []).forEach(function (s) {
    if (s && s.id && (mode === 'replace' || !haveSession[s.id])) {
      stmts.push(insertSessionStmt(env, s));
    }
  });

  if (stmts.length) await env.DB.batch(stmts);
  await audit(env, actor, 'data_import', 'settings', null, null,
    { mode: mode, source: payload.exportedAt || null });
  return json({ ok: true });
}

// ---- router ---------------------------------------------------------------

export default {
  async fetch(request, env) {
    var url = new URL(request.url);
    var segs = url.pathname.split('/').filter(Boolean);
    var method = request.method;

    try {
      // Unauthenticated endpoints (called before any login exists).
      if (segs[0] === 'api' && segs[1] === 'login' && segs.length === 2 && method === 'POST') {
        return await handleLogin(request, env);
      }
      if (segs[0] === 'api' && segs[1] === 'bootstrap' && segs.length === 2 && method === 'GET') {
        return await handleBootstrap(env);
      }

      // The assets layer serves everything that is not /api/* (see
      // run_worker_first in wrangler.toml); if a stray non-API request
      // ever reaches this script anyway, say so plainly.
      if (segs[0] !== 'api') return fail(404, 'Not found.');

      // Everything below requires a valid token.
      var payload = await authenticate(request, env);
      if (!payload) return fail(401, 'Not logged in.');
      var actor = { id: payload.uid, role: payload.role };

      if (segs[1] === 'settings' && segs.length === 2 && method === 'GET') {
        return await handleGetSettings(env);
      }
      if (segs[1] === 'settings' && segs.length === 2 && method === 'POST') {
        return await handleSetSettings(request, env, actor);
      }
      if (segs[1] === 'audit' && segs.length === 2 && method === 'GET') {
        return await handleAuditList(env, actor);
      }

      if (segs[1] === 'users') {
        if (segs.length === 2 && method === 'GET') return await handleListUsers(env, actor);
        if (segs.length === 2 && method === 'POST') return await handleCreateUser(request, env, actor);
        if (segs.length === 3 && method === 'DELETE') {
          return await handleDeleteUser(request, env, actor, decodeURIComponent(segs[2]));
        }
      }

      if (segs[1] === 'change-pin' && segs.length === 2 && method === 'POST') {
        return await handleChangePin(request, env, actor);
      }

      if (segs[1] === 'participants') {
        var code = segs.length >= 3 ? decodeURIComponent(segs[2]) : null;
        if (segs.length === 2 && method === 'GET') return await handleListParticipants(env, actor);
        if (segs.length === 2 && method === 'POST') return await handleCreateParticipant(request, env, actor);
        if (segs.length === 3 && method === 'GET') return await handleGetParticipant(env, actor, code);
        if (segs.length === 4 && segs[3] === 'consent' && method === 'POST') {
          return await handleConsent(request, env, actor, code);
        }
        if (segs.length === 4 && segs[3] === 'withdraw' && method === 'POST') {
          return await handleWithdraw(request, env, actor, code);
        }
      }

      if (segs[1] === 'sessions') {
        var sid = segs.length >= 3 ? decodeURIComponent(segs[2]) : null;
        if (segs.length === 2 && method === 'GET') return await handleListSessions(env, actor);
        if (segs.length === 2 && method === 'POST') return await handleCreateSession(request, env, actor);
        if (segs.length === 3 && method === 'GET') return await handleGetSession(env, actor, sid);
        if (segs.length === 4 && segs[3] === 'response' && method === 'PATCH') {
          return await handleSaveResponse(request, env, actor, sid);
        }
        if (segs.length === 4 && segs[3] === 'live' && method === 'POST') {
          return await handleSaveLiveDrawing(request, env, actor, sid);
        }
        if (segs.length === 4 && segs[3] === 'live' && method === 'GET') {
          return await handleGetLiveDrawing(env, actor, sid);
        }
        if (segs.length === 4 && segs[3] === 'pause' && method === 'POST') {
          return await handlePause(request, env, actor, sid);
        }
        if (segs.length === 4 && segs[3] === 'resume' && method === 'POST') {
          return await handleResume(env, actor, sid);
        }
        if (segs.length === 4 && segs[3] === 'complete' && method === 'POST') {
          return await handleComplete(request, env, actor, sid);
        }
        if (segs.length === 4 && segs[3] === 'stop' && method === 'POST') {
          return await handleStop(request, env, actor, sid);
        }
        if (segs.length === 3 && method === 'DELETE') {
          return await handleDeleteSession(request, env, actor, sid);
        }
      }

      if (segs[1] === 'export' && segs.length === 2 && method === 'GET') {
        return await handleExport(env, actor);
      }
      if (segs[1] === 'import' && segs.length === 2 && method === 'POST') {
        return await handleImport(request, env, actor);
      }

      return fail(404, 'Not found.');
    } catch (e) {
      return fail(500, (e && e.message) || 'Server error.');
    }
  }
};
