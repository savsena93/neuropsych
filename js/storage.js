/**
 * storage.js
 * -----------------------------------------------------------------------
 * Single source of truth for all persisted data in the app. Every caller
 * in the rest of the app talks to the DB.* functions and never to the
 * backends directly.
 *
 * TWO SWAPPABLE BACKENDS, ONE API:
 *   - LocalBackend (localStorage): used when the app runs from a plain
 *     file:// URL — the offline single-tablet deployment. Synchronous.
 *   - ApiBackend (fetch against the Cloudflare Worker + D1 SQLite
 *     database in worker.js): used automatically whenever the app is
 *     served over http(s). Sessions, participants and users are then
 *     shared across every device pointing at the same deployment.
 *
 * The backend is chosen at load time from the page protocol, so the same
 * folder keeps working copied onto the tablet (file://) AND hosted.
 *
 * Every DB.* function returns a PROMISE in both modes (local results are
 * wrapped in Promise.resolve) so callers are uniform. Errors — including
 * the local backend's synchronous throws — surface as promise rejections.
 *
 * Data model (all keys prefixed npa_ = "neuropsych assessment"):
 *   npa_settings      -> { initialized, appVersion }
 *   npa_users         -> [ { id, role: 'admin'|'examiner', name, pin, createdAt } ]
 *   npa_participants  -> [ { code, accessPin, assignedTests, age, sex, education, referral, dateEnrolled,
 *                            consent: { signedAt, signatureDataUrl, withdrawn, withdrawnAt },
 *                            createdBy, createdAt } ]
 *   npa_sessions      -> [ { id, participantCode, examinerId, testsSelected,
 *                            status, practiceMode, startedAt, completedAt,
 *                            responses, scores, pauses, deleted, deleteReason } ]
 *   npa_auditLog      -> [ { id, timestamp, actorId, actorRole, action,
 *                            targetType, targetId, reason, details } ]
 *
 * Login note: PINs are obfuscated with a simple non-cryptographic
 * checksum (see hashPin below), not a real cryptographic hash. The same
 * checksum runs server-side in worker.js so backup export/import stays
 * interoperable between the two backends. That is fine for a feasibility
 * prototype, but it must NOT be treated as secure storage if this code is
 * ever adapted for a real clinical deployment with sensitive data at stake.
 */

var DB = (function () {
  'use strict';

  // ---- shared helpers (used by both backends) ---------------------------

  var KEYS = {
    settings: 'npa_settings',
    users: 'npa_users',
    participants: 'npa_participants',
    sessions: 'npa_sessions',
    auditLog: 'npa_auditLog',
    live: 'npa_live'
  };

  function nextId(prefix) {
    return prefix + '_' + Date.now().toString(36) + '_' + Math.floor(Math.random() * 1e6).toString(36);
  }

  function nowIso() {
    return new Date().toISOString();
  }

  // Very simple, deliberately non-cryptographic checksum — see file header.
  function hashPin(pin) {
    var str = String(pin);
    var hash = 0;
    for (var i = 0; i < str.length; i++) {
      hash = (hash * 31 + str.charCodeAt(i)) >>> 0;
    }
    return 'h' + hash.toString(36);
  }

  // =======================================================================
  // LOCAL BACKEND — localStorage, synchronous internals
  // =======================================================================

  var LocalBackend = (function () {

    function readRaw(key, fallback) {
      var raw = localStorage.getItem(key);
      if (raw === null) return fallback;
      try {
        return JSON.parse(raw);
      } catch (e) {
        console.error('DB: corrupt data for key', key, e);
        return fallback;
      }
    }

    function writeRaw(key, value) {
      try {
        localStorage.setItem(key, JSON.stringify(value));
        return true;
      } catch (e) {
        // Most likely quota exceeded. Surface this so the UI can warn the
        // examiner instead of silently losing a response.
        console.error('DB: write failed for key', key, e);
        return false;
      }
    }

    // ---- audit log ----------------------------------------------------

    function audit(actor, action, targetType, targetId, reason, details) {
      var log = readRaw(KEYS.auditLog, []);
      log.push({
        id: nextId('audit'),
        timestamp: nowIso(),
        actorId: actor ? actor.id : null,
        actorRole: actor ? actor.role : null,
        action: action,
        targetType: targetType,
        targetId: targetId,
        reason: reason || null,
        details: details || null
      });
      writeRaw(KEYS.auditLog, log);
    }

    function getAuditLog() {
      return readRaw(KEYS.auditLog, []);
    }

    // ---- settings / first-run --------------------------------------------

    function getSettings() {
      return readRaw(KEYS.settings, { initialized: false, appVersion: '0.1.0-prototype' });
    }

    function setSettings(patch) {
      var current = getSettings();
      var merged = Object.assign({}, current, patch);
      writeRaw(KEYS.settings, merged);
      return merged;
    }

    function initIfNeeded() {
      var settings = getSettings();
      if (settings.initialized) return { firstRun: false };

      var users = readRaw(KEYS.users, []);
      var defaultPin = '1234';
      if (users.length === 0) {
        users.push({
          id: nextId('user'),
          role: 'admin',
          name: 'Administrator',
          pin: hashPin(defaultPin),
          mustChangePin: true,
          createdAt: nowIso()
        });
        writeRaw(KEYS.users, users);
      }
      setSettings({ initialized: true, appVersion: '0.1.0-prototype' });
      audit(null, 'system_init', 'settings', null, null, { defaultAdminPin: defaultPin });
      return { firstRun: true, defaultAdminPin: defaultPin };
    }

    // ---- users -------------------------------------------------------

    function listUsers() {
      return readRaw(KEYS.users, []);
    }

    function findUserByPin(pin, role) {
      var h = hashPin(pin);
      var users = listUsers();
      for (var i = 0; i < users.length; i++) {
        if (users[i].pin === h && (!role || users[i].role === role)) return users[i];
      }
      return null;
    }

    function findUserById(id) {
      var users = listUsers();
      for (var i = 0; i < users.length; i++) {
        if (users[i].id === id) return users[i];
      }
      return null;
    }

    // credentials: { role, pin } for staff, { role: 'examinee', code } for
    // examinees. Role must match the PIN's role when a role is selected.
    function loginUser(credentials) {
      if (!credentials || !credentials.role) {
        return { ok: false, error: 'Choose a role to log in.' };
      }
      if (credentials.role === 'examinee') {
        var code = (credentials.code || '').trim();
        var accessPin = (credentials.pin || '').trim();
        if (!code) return { ok: false, error: 'Enter your participant code.' };
        if (!accessPin) return { ok: false, error: 'Enter your participant PIN.' };
        var p = getParticipant(code);
        if (!p) {
          return { ok: false, error: 'No participant found with that code. Ask your examiner to check it.' };
        }
        if (p.accessPin && p.accessPin !== hashPin(accessPin)) {
          return { ok: false, error: 'Incorrect participant PIN.' };
        }
        return {
          ok: true,
          user: {
            id: 'examinee:' + p.code,
            role: 'examinee',
            name: 'Participant ' + p.code,
            examineeParticipant: p
          }
        };
      }
      var user = findUserByPin(credentials.pin, credentials.role);
      if (!user) {
        // Distinguish "no accounts of this role exist yet" from "wrong
        // PIN" — on first run only the administrator exists, so someone
        // picking Examiner should be told to have an account created
        // rather than left guessing at a PIN.
        var roleExists = listUsers().some(function (u) { return u.role === credentials.role; });
        if (!roleExists) {
          return {
            ok: false,
            error: 'No ' + (credentials.role === 'admin' ? 'administrator' : 'examiner') +
              ' accounts exist yet. The administrator must create one under Admin -> Users first.'
          };
        }
        return { ok: false, error: 'Incorrect PIN.' };
      }
      return { ok: true, user: user };
    }

    function createUser(actor, data) {
      var users = listUsers();
      var user = {
        id: nextId('user'),
        role: data.role,
        name: data.name,
        pin: hashPin(data.pin),
        mustChangePin: false,
        createdAt: nowIso()
      };
      users.push(user);
      writeRaw(KEYS.users, users);
      audit(actor, 'user_create', 'user', user.id, null, { role: user.role, name: user.name });
      return user;
    }

    function setUserPin(actor, userId, newPin) {
      var users = listUsers();
      var found = null;
      for (var i = 0; i < users.length; i++) {
        if (users[i].id === userId) {
          users[i].pin = hashPin(newPin);
          users[i].mustChangePin = false;
          found = users[i];
        }
      }
      writeRaw(KEYS.users, users);
      if (found) audit(actor, 'user_pin_change', 'user', userId, null, null);
      return found;
    }

    function deleteUser(actor, userId, reason) {
      if (actor && actor.id === userId) throw new Error('You cannot delete the account you are currently using.');
      var users = listUsers();
      var primaryAdmin = users.filter(function (u) { return u.role === 'admin'; })
        .sort(function (a, b) { return String(a.createdAt).localeCompare(String(b.createdAt)); })[0];
      if (primaryAdmin && primaryAdmin.id === userId) throw new Error('The primary administrator account cannot be deleted.');
      var remaining = users.filter(function (u) { return u.id !== userId; });
      var removed = users.length !== remaining.length;
      writeRaw(KEYS.users, remaining);
      if (removed) audit(actor, 'user_delete', 'user', userId, reason, null);
      return removed;
    }

    // ---- participants --------------------------------------------------

    function listParticipants() {
      return readRaw(KEYS.participants, []);
    }

    function getParticipant(code) {
      var list = listParticipants();
      for (var i = 0; i < list.length; i++) {
        if (list[i].code === code) return list[i];
      }
      return null;
    }

    function createParticipant(actor, data) {
      var list = listParticipants();
      if (getParticipant(data.code)) {
        throw new Error('A participant with code "' + data.code + '" already exists.');
      }
      var record = {
        code: data.code,
        age: data.age,
        sex: data.sex,
        education: data.education,
        referral: data.referral,
        accessPin: hashPin(data.accessPin || data.code),
        assignedTests: (data.assignedTests || []).slice(),
        dateEnrolled: data.dateEnrolled || nowIso(),
        consent: {
          signedAt: null,
          signatureDataUrl: null,
          withdrawn: false,
          withdrawnAt: null
        },
        createdBy: actor ? actor.id : null,
        createdAt: nowIso()
      };
      list.push(record);
      writeRaw(KEYS.participants, list);
      audit(actor, 'participant_create', 'participant', record.code, null, null);
      return Object.assign({}, record, { issuedPin: data.accessPin || data.code });
    }

    function recordConsent(actor, code, signatureDataUrl) {
      var list = listParticipants();
      var found = null;
      for (var i = 0; i < list.length; i++) {
        if (list[i].code === code) {
          list[i].consent.signedAt = nowIso();
          list[i].consent.signatureDataUrl = signatureDataUrl;
          found = list[i];
        }
      }
      writeRaw(KEYS.participants, list);
      if (found) audit(actor, 'consent_signed', 'participant', code, null, null);
      return found;
    }

    // Withdrawing consent PERMANENTLY deletes the participant record and
    // every session tied to that participant code. This is destructive by
    // design and cannot be undone from within the app.
    function withdrawConsentAndErase(actor, code, reason) {
      var participants = listParticipants().filter(function (p) { return p.code !== code; });
      writeRaw(KEYS.participants, participants);

      var sessions = readRaw(KEYS.sessions, []);
      var remainingSessions = sessions.filter(function (s) { return s.participantCode !== code; });
      writeRaw(KEYS.sessions, remainingSessions);

      audit(actor, 'consent_withdrawn_erasure', 'participant', code, reason,
        { sessionsErased: sessions.length - remainingSessions.length });
      return true;
    }

    // ---- sessions (assessment records) ---------------------------------

    function listSessions() {
      return readRaw(KEYS.sessions, []);
    }

    function listSessionsForExaminer(examinerId) {
      return listSessions().filter(function (s) { return s.examinerId === examinerId && !s.deleted; });
    }

    function getSession(id) {
      var list = listSessions();
      for (var i = 0; i < list.length; i++) {
        if (list[i].id === id) return list[i];
      }
      return null;
    }

    function createSession(actor, data) {
      var list = listSessions();
      var participant = data.participantCode ? getParticipant(data.participantCode) : null;
      var assignedTests = actor && actor.role === 'examinee' && participant
        ? (participant.assignedTests || []) : (data.testsSelected || []);
      var session = {
        id: nextId('session'),
        participantCode: data.participantCode,
        // data.examinerId overrides the actor — used when an examinee logs
        // in and takes the test: the session is attributed to the examiner
        // who enrolled the participant.
        examinerId: data.examinerId !== undefined ? data.examinerId : (actor ? actor.id : null),
        testsSelected: assignedTests,
        status: 'in_progress',
        practiceMode: !!data.practiceMode,
        startedAt: nowIso(),
        completedAt: null,
        responses: {},
        scores: {},
        pauses: [],
        deleted: false,
        deleteReason: null
      };
      list.push(session);
      writeRaw(KEYS.sessions, list);
      audit(actor, 'session_create', 'session', session.id, null,
        { participantCode: session.participantCode, practiceMode: session.practiceMode });
      return session;
    }

    // Auto-save: called after every single response. Intentionally quiet
    // (no audit entry per keystroke) so the audit log stays readable —
    // only session-level events are audited.
    function saveSessionResponse(sessionId, testKey, itemKey, value) {
      var list = listSessions();
      var found = null;
      for (var i = 0; i < list.length; i++) {
        if (list[i].id === sessionId) {
          if (!list[i].responses[testKey]) list[i].responses[testKey] = {};
          list[i].responses[testKey][itemKey] = value;
          found = list[i];
        }
      }
      writeRaw(KEYS.sessions, list);
      return found;
    }

    function logPause(actor, sessionId, reason, type) {
      var list = listSessions();
      var found = null;
      for (var i = 0; i < list.length; i++) {
        if (list[i].id === sessionId) {
          list[i].pauses.push({ type: type || 'pause', reason: reason, timestamp: nowIso() });
          found = list[i];
        }
      }
      writeRaw(KEYS.sessions, list);
      if (found) audit(actor, 'session_' + (type || 'pause'), 'session', sessionId, reason, null);
      return found;
    }

    function pauseSession(actor, sessionId, reason) {
      var found = logPause(actor, sessionId, reason, 'pause');
      if (found) {
        found.status = 'paused';
        writeRaw(KEYS.sessions, listSessions());
      }
      return found;
    }

    function resumeSession(actor, sessionId) {
      var list = listSessions();
      var found = null;
      list.forEach(function (session) {
        if (session.id === sessionId && session.status === 'paused') {
          session.status = 'in_progress';
          found = session;
        }
      });
      writeRaw(KEYS.sessions, list);
      if (found) audit(actor, 'session_resume', 'session', sessionId, null, null);
      return found;
    }

    function completeSession(actor, sessionId, scores) {
      var list = listSessions();
      var found = null;
      for (var i = 0; i < list.length; i++) {
        if (list[i].id === sessionId) {
          list[i].status = 'completed';
          list[i].completedAt = nowIso();
          if (scores) list[i].scores = scores;
          found = list[i];
        }
      }
      writeRaw(KEYS.sessions, list);
      if (found) audit(actor, 'session_complete', 'session', sessionId, null, null);
      return found;
    }

    function stopSession(actor, sessionId, reason) {
      var list = listSessions();
      var found = null;
      for (var i = 0; i < list.length; i++) {
        if (list[i].id === sessionId && list[i].status === 'in_progress') {
          list[i].status = 'stopped';
          list[i].stoppedAt = nowIso();
          list[i].stopReason = reason;
          list[i].pauses.push({ type: 'stop', reason: reason, timestamp: list[i].stoppedAt });
          found = list[i];
        }
      }
      writeRaw(KEYS.sessions, list);
      if (found) audit(actor, 'session_stop', 'session', sessionId, reason, null);
      return found;
    }

    function deleteSession(actor, sessionId, reason) {
      var list = listSessions();
      var found = null;
      for (var i = 0; i < list.length; i++) {
        if (list[i].id === sessionId) {
          list[i].deleted = true;
          list[i].deleteReason = reason;
          found = list[i];
        }
      }
      writeRaw(KEYS.sessions, list);
      if (found) audit(actor, 'session_delete', 'session', sessionId, reason, null);
      return found;
    }

    // ---- full backup / restore (USB export via JSON file) ---------------

    function exportAll() {
      return {
        exportedAt: nowIso(),
        appVersion: getSettings().appVersion,
        settings: getSettings(),
        users: listUsers(),
        participants: listParticipants(),
        sessions: listSessions(),
        auditLog: getAuditLog()
      };
    }

    // mode: 'replace' wipes existing data first; 'merge' appends anything
    // whose id/code is not already present (existing records win on clash).
    function importAll(actor, payload, mode) {
      if (!payload || typeof payload !== 'object') {
        throw new Error('Invalid backup file.');
      }
      mode = mode || 'merge';

      if (mode === 'replace') {
        writeRaw(KEYS.users, payload.users || []);
        writeRaw(KEYS.participants, payload.participants || []);
        writeRaw(KEYS.sessions, payload.sessions || []);
      } else {
        mergeByKey(KEYS.users, payload.users || [], 'id');
        mergeByKey(KEYS.participants, payload.participants || [], 'code');
        mergeByKey(KEYS.sessions, payload.sessions || [], 'id');
      }

      audit(actor, 'data_import', 'settings', null, null, { mode: mode, source: payload.exportedAt || null });
      return true;
    }

    function mergeByKey(key, incoming, idField) {
      var existing = readRaw(key, []);
      var existingIds = {};
      existing.forEach(function (item) { existingIds[item[idField]] = true; });
      incoming.forEach(function (item) {
        if (!existingIds[item[idField]]) existing.push(item);
      });
      writeRaw(key, existing);
    }

    // ---- live drawing state (examiner's real-time view, SRS) ------------
    // Written by the test runner as the participant draws; read by the
    // examiner's Live view. Kept separate from session responses so the
    // permanent record only ever holds the finished drawing snapshots —
    // just the latest live snapshot per session is retained.

    function saveLiveDrawing(sessionId, testKey, itemId, dataUrl) {
      var live = readRaw(KEYS.live, {});
      live[sessionId] = {
        testKey: testKey,
        itemId: itemId,
        dataUrl: dataUrl,
        updatedAt: nowIso()
      };
      writeRaw(KEYS.live, live);
      return true;
    }

    function getLiveDrawing(sessionId) {
      var live = readRaw(KEYS.live, {});
      return live[sessionId] || null;
    }

    return {
      initIfNeeded: initIfNeeded,
      getSettings: getSettings,
      setSettings: setSettings,
      getAuditLog: getAuditLog,
      listUsers: listUsers,
      findUserByPin: findUserByPin,
      findUserById: findUserById,
      loginUser: loginUser,
      createUser: createUser,
      setUserPin: setUserPin,
      deleteUser: deleteUser,
      listParticipants: listParticipants,
      getParticipant: getParticipant,
      createParticipant: createParticipant,
      recordConsent: recordConsent,
      withdrawConsentAndErase: withdrawConsentAndErase,
      listSessions: listSessions,
      listSessionsForExaminer: listSessionsForExaminer,
      getSession: getSession,
      createSession: createSession,
      saveSessionResponse: saveSessionResponse,
      saveLiveDrawing: saveLiveDrawing,
      getLiveDrawing: getLiveDrawing,
      logPause: logPause,
      pauseSession: pauseSession,
      resumeSession: resumeSession,
      completeSession: completeSession,
      stopSession: stopSession,
      deleteSession: deleteSession,
      exportAll: exportAll,
      importAll: importAll
    };
  })();

  // =======================================================================
  // REMOTE BACKEND — fetch against the Worker + D1 API (see worker.js)
  // =======================================================================

  var ApiBackend = (function () {

    var apiToken = null;
    try { apiToken = localStorage.getItem('npa_token'); } catch (e) {}

    function request(method, path, body) {
      var opts = { method: method, headers: {} };
      if (apiToken) opts.headers['Authorization'] = 'Bearer ' + apiToken;
      if (body !== undefined) {
        opts.headers['Content-Type'] = 'application/json';
        opts.body = JSON.stringify(body);
      }
      return fetch(path, opts).then(function (res) {
        return res.json().catch(function () { return null; }).then(function (data) {
          if (!res.ok) {
            throw new Error((data && data.error) || ('Request failed (' + res.status + ')'));
          }
          return data;
        });
      });
    }

    function loginUser(credentials) {
      return request('POST', '/api/login', {
        role: credentials.role, pin: credentials.pin, code: credentials.code
      }).then(function (data) {
        apiToken = data.token;
        return { ok: true, user: data.user, token: data.token };
      }).catch(function (e) {
        return { ok: false, error: e.message };
      });
    }

    function initIfNeeded() {
      return request('GET', '/api/bootstrap').then(function (d) {
        return { firstRun: !!d.firstRun, defaultAdminPin: d.defaultAdminPin };
      });
    }

    function getSettings() {
      return request('GET', '/api/settings').then(function (d) { return d.settings; });
    }

    function setSettings(patch) {
      return request('POST', '/api/settings', { patch: patch }).then(function (d) { return d.settings; });
    }

    function getAuditLog() {
      return request('GET', '/api/audit').then(function (d) { return d.log; });
    }

    function listUsers() {
      return request('GET', '/api/users').then(function (d) { return d.users; });
    }

    function createUser(actor, data) {
      return request('POST', '/api/users', { name: data.name, role: data.role, pin: data.pin })
        .then(function (d) { return d.user; });
    }

    // The client only ever changes its own PIN.
    function setUserPin(actor, userId, newPin) {
      return request('POST', '/api/change-pin', { newPin: newPin })
        .then(function (d) { return d.user; });
    }

    function deleteUser(actor, userId, reason) {
      return request('DELETE', '/api/users/' + encodeURIComponent(userId), { reason: reason })
        .then(function (d) { return !!d.ok; });
    }

    function listParticipants() {
      return request('GET', '/api/participants').then(function (d) { return d.participants; });
    }

    function getParticipant(code) {
      return request('GET', '/api/participants/' + encodeURIComponent(code))
        .then(function (d) { return d.participant; });
    }

    function createParticipant(actor, data) {
      return request('POST', '/api/participants', {
        code: data.code, age: data.age, sex: data.sex, education: data.education,
        referral: data.referral, dateEnrolled: data.dateEnrolled,
        accessPin: data.accessPin, assignedTests: data.assignedTests
      }).then(function (d) { return d.participant; });
    }

    function recordConsent(actor, code, signatureDataUrl) {
      return request('POST', '/api/participants/' + encodeURIComponent(code) + '/consent',
        { signatureDataUrl: signatureDataUrl }).then(function (d) { return d.participant; });
    }

    function withdrawConsentAndErase(actor, code, reason) {
      return request('POST', '/api/participants/' + encodeURIComponent(code) + '/withdraw',
        { reason: reason }).then(function () { return true; });
    }

    function listSessions() {
      return request('GET', '/api/sessions').then(function (d) { return d.sessions; });
    }

    // The server filters by the logged-in examiner; kept for interface parity.
    function listSessionsForExaminer(examinerId) {
      return listSessions();
    }

    function getSession(id) {
      return request('GET', '/api/sessions/' + encodeURIComponent(id))
        .then(function (d) { return d.session; });
    }

    function createSession(actor, data) {
      return request('POST', '/api/sessions', {
        participantCode: data.participantCode, testsSelected: data.testsSelected,
        practiceMode: data.practiceMode, examinerId: data.examinerId
      }).then(function (d) { return d.session; });
    }

    function saveSessionResponse(sessionId, testKey, itemKey, value) {
      return request('PATCH', '/api/sessions/' + encodeURIComponent(sessionId) + '/response',
        { testKey: testKey, itemKey: itemKey, value: value }).then(function (d) { return d.session || null; });
    }

    function logPause(actor, sessionId, reason, type) {
      return request('POST', '/api/sessions/' + encodeURIComponent(sessionId) + '/pause',
        { reason: reason, type: type }).then(function (d) { return d.session || null; });
    }

    function pauseSession(actor, sessionId, reason) {
      return request('POST', '/api/sessions/' + encodeURIComponent(sessionId) + '/pause',
        { reason: reason, type: 'pause' }).then(function (d) { return d.session || null; });
    }

    function resumeSession(actor, sessionId) {
      return request('POST', '/api/sessions/' + encodeURIComponent(sessionId) + '/resume')
        .then(function (d) { return d.session || null; });
    }

    function completeSession(actor, sessionId, scores) {
      return request('POST', '/api/sessions/' + encodeURIComponent(sessionId) + '/complete',
        { scores: scores }).then(function (d) { return d.session; });
    }

    function stopSession(actor, sessionId, reason) {
      return request('POST', '/api/sessions/' + encodeURIComponent(sessionId) + '/stop',
        { reason: reason }).then(function (d) { return d.session; });
    }

    function deleteSession(actor, sessionId, reason) {
      return request('DELETE', '/api/sessions/' + encodeURIComponent(sessionId), { reason: reason })
        .then(function (d) { return d.session || null; });
    }

    function exportAll() {
      return request('GET', '/api/export');
    }

    function importAll(actor, payload, mode) {
      if (!payload || typeof payload !== 'object') {
        throw new Error('Invalid backup file.');
      }
      return request('POST', '/api/import', { payload: payload, mode: mode || 'merge' })
        .then(function () { return true; });
    }

    function saveLiveDrawing(sessionId, testKey, itemId, dataUrl) {
      return request('POST', '/api/sessions/' + encodeURIComponent(sessionId) + '/live',
        { testKey: testKey, itemId: itemId, dataUrl: dataUrl }).then(function () { return true; });
    }

    function getLiveDrawing(sessionId) {
      return request('GET', '/api/sessions/' + encodeURIComponent(sessionId) + '/live')
        .then(function (d) { return d.live || null; });
    }

    return {
      loginUser: loginUser,
      initIfNeeded: initIfNeeded,
      getSettings: getSettings,
      setSettings: setSettings,
      getAuditLog: getAuditLog,
      listUsers: listUsers,
      createUser: createUser,
      setUserPin: setUserPin,
      deleteUser: deleteUser,
      listParticipants: listParticipants,
      getParticipant: getParticipant,
      createParticipant: createParticipant,
      recordConsent: recordConsent,
      withdrawConsentAndErase: withdrawConsentAndErase,
      listSessions: listSessions,
      listSessionsForExaminer: listSessionsForExaminer,
      getSession: getSession,
      createSession: createSession,
      saveSessionResponse: saveSessionResponse,
      saveLiveDrawing: saveLiveDrawing,
      getLiveDrawing: getLiveDrawing,
      logPause: logPause,
      pauseSession: pauseSession,
      resumeSession: resumeSession,
      completeSession: completeSession,
      stopSession: stopSession,
      deleteSession: deleteSession,
      exportAll: exportAll,
      importAll: importAll
    };
  })();

  // =======================================================================
  // PUBLIC API — every function returns a Promise in both modes
  // =======================================================================

  var remote = (location.protocol === 'http:' || location.protocol === 'https:');
  var backend = remote ? ApiBackend : LocalBackend;

  function call(method) {
    var args = Array.prototype.slice.call(arguments, 1);
    return new Promise(function (resolve, reject) {
      var result;
      try {
        result = backend[method].apply(null, args);
      } catch (e) {
        reject(e);
        return;
      }
      // Promise.resolve unwraps the remote backend's promises and wraps
      // the local backend's synchronous values alike.
      resolve(result);
    });
  }

  return {
    KEYS: KEYS,
    nowIso: nowIso,
    hashPin: hashPin,
    isRemote: function () { return remote; },
    loginUser: function (c) { return call('loginUser', c); },
    initIfNeeded: function () { return call('initIfNeeded'); },
    getSettings: function () { return call('getSettings'); },
    setSettings: function (patch) { return call('setSettings', patch); },
    getAuditLog: function () { return call('getAuditLog'); },
    listUsers: function () { return call('listUsers'); },
    createUser: function (actor, data) { return call('createUser', actor, data); },
    setUserPin: function (actor, userId, newPin) { return call('setUserPin', actor, userId, newPin); },
    deleteUser: function (actor, userId, reason) { return call('deleteUser', actor, userId, reason); },
    listParticipants: function () { return call('listParticipants'); },
    getParticipant: function (code) { return call('getParticipant', code); },
    createParticipant: function (actor, data) { return call('createParticipant', actor, data); },
    recordConsent: function (actor, code, signatureDataUrl) { return call('recordConsent', actor, code, signatureDataUrl); },
    withdrawConsentAndErase: function (actor, code, reason) { return call('withdrawConsentAndErase', actor, code, reason); },
    listSessions: function () { return call('listSessions'); },
    listSessionsForExaminer: function (examinerId) { return call('listSessionsForExaminer', examinerId); },
    getSession: function (id) { return call('getSession', id); },
    createSession: function (actor, data) { return call('createSession', actor, data); },
    saveSessionResponse: function (sessionId, testKey, itemKey, value) { return call('saveSessionResponse', sessionId, testKey, itemKey, value); },
    saveLiveDrawing: function (sessionId, testKey, itemId, dataUrl) { return call('saveLiveDrawing', sessionId, testKey, itemId, dataUrl); },
    getLiveDrawing: function (sessionId) { return call('getLiveDrawing', sessionId); },
    logPause: function (actor, sessionId, reason, type) { return call('logPause', actor, sessionId, reason, type); },
    pauseSession: function (actor, sessionId, reason) { return call('pauseSession', actor, sessionId, reason); },
    resumeSession: function (actor, sessionId) { return call('resumeSession', actor, sessionId); },
    completeSession: function (actor, sessionId, scores) { return call('completeSession', actor, sessionId, scores); },
    deleteSession: function (actor, sessionId, reason) { return call('deleteSession', actor, sessionId, reason); },
    exportAll: function () { return call('exportAll'); },
    importAll: function (actor, payload, mode) { return call('importAll', actor, payload, mode); }
  };
})();
