/**
 * app.js
 * -----------------------------------------------------------------------
 * Bootstraps the app: registers every route with Router, wires up all
 * the DOM event handlers for the screens that exist in Phase 1
 * (login, both dashboards, user management, participant intake +
 * consent capture, audit log, backup/restore).
 *
 * The assessment runner, scoring, reports and Practice Mode are loaded
 * from the shared test-flow and test modules after this shell boots.
 */

(function () {
  'use strict';

  document.addEventListener('DOMContentLoaded', function () {
    DB.initIfNeeded().then(function (initResult) {
      if (initResult.firstRun) {
        console.info('First run: default admin PIN is', initResult.defaultAdminPin, '(you will be asked to change it on first login).');
      }

      registerRoutes();
      wireLogin();
      wireAdminShell();
      wireExaminerShell();
      wireParticipantIntake();
      wireConsentCapture();
      wireChangePin();
      wireGenericBackButtons();
      wireResumeScreen();
      wireLiveView();
      TestFlow.init();

      var restoredUser = Auth.getCurrentUser();
      if (restoredUser) {
        routeToDashboard(restoredUser);
      } else {
        Router.navigate('login');
      }
    });
  });

  // ---- routing table ----------------------------------------------------

  function registerRoutes() {
    Router.register('login', {});

    Router.register('changePin', { roles: ['admin', 'examiner'] });

    Router.register('adminDashboard', {
      roles: ['admin'],
      onEnter: renderAdminDashboard
    });
    Router.register('adminUsers', {
      roles: ['admin'],
      onEnter: renderAdminUsers
    });
    Router.register('adminParticipants', {
      roles: ['admin'],
      onEnter: function () { renderParticipantsTable(document.getElementById('adminParticipantsTable'), true); }
    });
    Router.register('adminSessions', {
      roles: ['admin'],
      onEnter: renderAdminSessions
    });
    Router.register('adminAuditLog', {
      roles: ['admin'],
      onEnter: renderAuditLog
    });
    Router.register('adminBackup', { roles: ['admin'] });

    Router.register('examinerDashboard', {
      roles: ['examiner'],
      onEnter: renderExaminerDashboard
    });
    Router.register('testSelection', {
      roles: ['admin', 'examiner', 'examinee'],
      onEnter: TestFlow.resetSelectionForm
    });
    Router.register('participantIntake', {
      roles: ['admin', 'examiner'],
      onEnter: function () { intakeSubmitted = false; }
    });
    Router.register('consentCapture', {
      roles: ['admin', 'examiner', 'examinee'],
      onEnter: prepareConsentCanvas
    });
    Router.register('testRunner', {
      roles: ['admin', 'examiner', 'examinee'],
      onEnter: configureRunnerControls
    });
    Router.register('sessionSummary', { roles: ['admin', 'examiner', 'examinee'] });

    // SRS: incomplete tests resume on the next login. Both examinees (their
    // own participant code) and staff can land here and continue.
    Router.register('resumeSession', {
      roles: ['admin', 'examiner', 'examinee'],
      onEnter: renderResumeScreen
    });
    // SRS: examiner watches the participant draw in real time.
    Router.register('liveView', {
      roles: ['admin', 'examiner'],
      onEnter: startLiveView
    });
  }

  // ---- shared helpers -----------------------------------------------

  function byId(id) { return document.getElementById(id); }

  function fmtDate(iso) {
    if (!iso) return 'Not available';
    var d = new Date(iso);
    return d.toLocaleDateString() + ' ' + d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }

  function clearChildren(el) {
    while (el.firstChild) el.removeChild(el.firstChild);
  }

  function renderEmptyRow(tbody, colspan, message) {
    var row = document.createElement('tr');
    var cell = document.createElement('td');
    cell.className = 'empty-state';
    cell.colSpan = colspan;
    cell.textContent = message;
    row.appendChild(cell);
    tbody.appendChild(row);
  }

  function showBanner(el, message, kind) {
    el.textContent = message;
    el.className = 'banner banner--' + (kind || 'info');
    el.hidden = !message;
  }

  function requestReason(title, message, callback) {
    var dialog = byId('reasonDialog');
    var input = byId('reasonDialogInput');
    var error = byId('reasonDialogError');
    byId('reasonDialogTitle').textContent = title;
    byId('reasonDialogMessage').textContent = message;
    input.value = '';
    error.hidden = true;
    dialog.hidden = false;
    input.focus();

    function close() {
      dialog.hidden = true;
      byId('reasonDialogCancel').removeEventListener('click', cancel);
      byId('reasonDialogSubmit').removeEventListener('click', submit);
    }
    function cancel() { close(); }
    function submit() {
      var reason = input.value.trim();
      if (!reason) {
        error.textContent = 'Enter a reason to continue.';
        error.hidden = false;
        input.focus();
        return;
      }
      close();
      callback(reason);
    }
    byId('reasonDialogCancel').addEventListener('click', cancel);
    byId('reasonDialogSubmit').addEventListener('click', submit);
  }

  function requestConfirm(title, message, callback) {
    var dialog = byId('reasonDialog');
    var input = byId('reasonDialogInput');
    var error = byId('reasonDialogError');
    byId('reasonDialogTitle').textContent = title;
    byId('reasonDialogMessage').textContent = message;
    input.hidden = true;
    error.hidden = true;
    byId('reasonDialogSubmit').textContent = 'Continue';
    dialog.hidden = false;
    function close() {
      dialog.hidden = true;
      input.hidden = false;
      byId('reasonDialogCancel').removeEventListener('click', cancel);
      byId('reasonDialogSubmit').removeEventListener('click', submit);
    }
    function cancel() { close(); callback(false); }
    function submit() { close(); callback(true); }
    byId('reasonDialogCancel').addEventListener('click', cancel);
    byId('reasonDialogSubmit').addEventListener('click', submit);
    byId('reasonDialogCancel').focus();
  }

  window.AppDialogs = {
    requestReason: requestReason,
    requestConfirm: requestConfirm
  };

  // ---- login / change PIN --------------------------------------------

  function wireLogin() {
    var form = byId('loginForm');
    var roleSelect = byId('loginRole');
    var pinInput = byId('loginPin');
    var codeInput = byId('loginCode');
    var pinField = byId('loginPinField');
    var codeField = byId('loginCodeField');
    var error = byId('loginError');

    // Staff (admin/examiner) log in with a PIN; examinees log in with the
    // participant code their examiner created at intake.
    roleSelect.addEventListener('change', function () {
      var examinee = roleSelect.value === 'examinee';
      pinField.hidden = examinee;
      codeField.hidden = !examinee;
    });

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var credentials = {
        role: roleSelect.value,
        pin: pinInput.value.trim(),
        code: codeInput.value.trim()
      };
      if (credentials.role !== 'examinee' && !credentials.pin) {
        showBanner(error, 'Enter your PIN.', 'error');
        return;
      }
      if (credentials.role === 'examinee' && !credentials.code) {
        showBanner(error, 'Enter the participant code your examiner gave you.', 'error');
        return;
      }
      Auth.login(credentials).then(function (result) {
        pinInput.value = '';
        codeInput.value = '';
        if (!result.ok) {
          showBanner(error, result.error, 'error');
          return;
        }
        showBanner(error, '', 'error');
        var user = result.user;
        if (user.mustChangePin) {
          Router.navigate('changePin');
          return;
        }
        routeToDashboard(user);
      });
    });
  }

  function routeToDashboard(user) {
    if (user.role === 'admin') {
      Router.navigate('adminDashboard');
    } else if (user.role === 'examiner') {
      Router.navigate('examinerDashboard');
    } else {
      startExamineeFlow(user);
    }
  }

  // Examinees get no dashboard: straight into their test-taking flow —
  // consent first if it hasn't been signed yet, otherwise test selection.
  // The examiner (present with the participant, per spec) works through
  // those screens; the examinee cannot reach any other part of the app.
  //
  // SRS: incomplete tests must resume on the next login — so before
  // anything else, an examinee with an unfinished session is offered to
  // continue it rather than start over.
  function startExamineeFlow(user) {
    var p = user.examineeParticipant;
    if (!p) {
      Auth.logout();
      Router.navigate('login');
      return;
    }
    pendingParticipantCode = p.code;
    DB.listSessions().then(function (sessions) {
      var mine = sessions.filter(function (s) {
        return s.participantCode === p.code && s.status === 'in_progress' && !s.deleted;
      });
      if (mine.length > 0) {
        TestFlow.setResumeList(mine);
        Router.navigate('resumeSession');
        return;
      }
      if (p.consent && p.consent.signedAt) {
        Router.navigate('testSelection');
      } else {
        Router.navigate('consentCapture');
      }
    });
  }

  function routeHome() {
    if (Auth.isExaminee()) {
      // Examinees have no dashboard — leaving any of their screens means
      // logging out and handing the tablet back to the examiner.
      logout();
      return;
    }
    Router.navigate(Auth.isAdmin() ? 'adminDashboard' : 'examinerDashboard');
  }

  function configureRunnerControls() {
    var pauseButton = byId('pauseSessionBtn');
    var stopButton = byId('stopSessionBtn');
    var logoutButton = byId('runnerLogoutBtn');
    if (pauseButton) pauseButton.hidden = Auth.isExaminee();
    if (stopButton) stopButton.hidden = Auth.isExaminee();
    if (logoutButton) logoutButton.hidden = Auth.isExaminee();
  }

  function wireChangePin() {
    var form = byId('changePinForm');
    var error = byId('changePinError');
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var pin1 = byId('newPin').value.trim();
      var pin2 = byId('confirmPin').value.trim();
      if (pin1.length < 4) {
        showBanner(error, 'PIN must be at least 4 digits.', 'error');
        return;
      }
      if (pin1 !== pin2) {
        showBanner(error, 'PINs do not match.', 'error');
        return;
      }
      var user = Auth.getCurrentUser();
      DB.setUserPin(user, user.id, pin1).then(function () {
        form.reset();
        showBanner(error, '', 'error');
        routeToDashboard(user);
      });
    });
  }

  function logout() {
    Auth.logout();
    Router.navigate('login');
  }

  // Buttons marked data-nav-back just return to whichever dashboard
  // matches the current role — used by screens reachable from either
  // the admin or the examiner shell.
  function wireGenericBackButtons() {
    document.querySelectorAll('[data-nav-back]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        Router.navigate(Auth.isAdmin() ? 'adminDashboard' : 'examinerDashboard');
      });
    });
  }

  // ---- admin shell ----------------------------------------------------

  function wireAdminShell() {
    byId('adminLogoutBtn').addEventListener('click', logout);
    document.querySelectorAll('.admin-logout-btn').forEach(function (btn) {
      btn.addEventListener('click', logout);
    });
    document.querySelectorAll('[data-nav]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        Router.navigate(btn.getAttribute('data-nav'));
      });
    });
    document.querySelectorAll('[data-scroll-to]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var target = byId(btn.getAttribute('data-scroll-to'));
        if (target) target.scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
    });

    byId('addUserForm').addEventListener('submit', function (e) {
      e.preventDefault();
      var name = byId('newUserName').value.trim();
      var role = byId('newUserRole').value;
      var pin = byId('newUserPin').value.trim();
      var error = byId('addUserError');
      if (!name || pin.length < 4) {
        showBanner(error, 'Enter a name and a PIN of at least 4 digits.', 'error');
        return;
      }
      // DB.* returns a Promise in both modes (see storage.js) — await it
      // so the table re-renders only after the user actually exists, and
      // so network failures surface as a banner instead of vanishing.
      DB.createUser(Auth.getCurrentUser(), { name: name, role: role, pin: pin }).then(function () {
        e.target.reset();
        showBanner(error, '', 'error');
        return renderAdminUsers();
      }).catch(function (err) {
        showBanner(error, err.message, 'error');
      });
    });
  }

  function renderAdminDashboard() {
    return Promise.all([
      DB.listUsers(),
      DB.listParticipants(),
      DB.listSessions()
    ]).then(function (results) {
      byId('statUsers').textContent = results[0].length;
      byId('statParticipants').textContent = results[1].length;
      byId('statSessions').textContent = results[2].filter(function (s) { return !s.deleted; }).length;
    });
  }

  function renderAdminUsers() {
    return DB.listUsers().then(function (users) {
      var tbody = byId('usersTableBody');
      clearChildren(tbody);
      if (!users.length) {
        renderEmptyRow(tbody, 4, 'No staff accounts have been added.');
        return;
      }
      var primaryAdmin = users.filter(function (u) { return u.role === 'admin'; })
        .sort(function (a, b) { return String(a.createdAt).localeCompare(String(b.createdAt)); })[0];
      users.forEach(function (user) {
        var tr = document.createElement('tr');

        var tdName = document.createElement('td');
        tdName.textContent = user.name;
        tr.appendChild(tdName);

        var tdRole = document.createElement('td');
        tdRole.textContent = user.role;
        tr.appendChild(tdRole);

        var tdCreated = document.createElement('td');
        tdCreated.textContent = fmtDate(user.createdAt);
        tr.appendChild(tdCreated);

        var tdActions = document.createElement('td');
        if (primaryAdmin && user.id === primaryAdmin.id) {
          var protectedLabel = document.createElement('span');
          protectedLabel.className = 'status-label status-label--protected';
          protectedLabel.textContent = 'Protected';
          tdActions.appendChild(protectedLabel);
        } else {
          var delBtn = document.createElement('button');
          delBtn.className = 'btn btn--danger btn--small';
          delBtn.textContent = 'Delete';
          delBtn.addEventListener('click', function () { promptDeleteUser(user); });
          tdActions.appendChild(delBtn);
        }
        tr.appendChild(tdActions);

        tbody.appendChild(tr);
      });
    });
  }

  function promptDeleteUser(user) {
    requestReason('Delete user', 'This will remove "' + user.name + '" from staff access.', function (reason) {
      DB.deleteUser(Auth.getCurrentUser(), user.id, reason).then(function () {
        return renderAdminUsers();
      }).catch(function (err) {
        showBanner(byId('addUserError'), err.message || 'The user could not be deleted.', 'error');
      });
    });
  }

  function renderAdminSessions() {
    return Promise.all([
      DB.listUsers(),
      DB.listSessions()
    ]).then(function (results) {
      var tbody = byId('adminSessionsTableBody');
      clearChildren(tbody);
      if (!results[1].length) {
        renderEmptyRow(tbody, 7, 'No assessment records yet.');
        return;
      }
      var userName = {};
      results[0].forEach(function (u) { userName[u.id] = u.name; });

      results[1].forEach(function (session) {
        var tr = document.createElement('tr');
        if (session.deleted) tr.className = 'row--deleted';

        [
          session.participantCode,
          userName[session.examinerId] || 'Not assigned',
          (session.testsSelected || []).join(', ') || 'None selected',
          session.practiceMode ? 'Practice' : 'Real',
          session.status,
          fmtDate(session.startedAt)
        ].forEach(function (val) {
          var td = document.createElement('td');
          td.textContent = val;
          tr.appendChild(td);
        });

        var tdActions = document.createElement('td');
        if (!session.deleted) {
          if (session.status === 'completed') {
            var reportBtn = document.createElement('button');
            reportBtn.className = 'btn btn--secondary btn--small';
            reportBtn.textContent = 'View report';
            reportBtn.addEventListener('click', function () { TestFlow.viewSessionReport(session); });
            tdActions.appendChild(reportBtn);
          }
          var delBtn = document.createElement('button');
          delBtn.className = 'btn btn--danger btn--small';
          delBtn.textContent = 'Delete';
          delBtn.addEventListener('click', function () { promptDeleteSession(session); });
          tdActions.appendChild(delBtn);
        } else {
          tdActions.textContent = 'Deleted (' + session.deleteReason + ')';
        }
        tr.appendChild(tdActions);

        tbody.appendChild(tr);
      });
    });
  }

  function promptDeleteSession(session) {
    requestReason('Delete assessment record', 'This removes the selected record from normal views.', function (reason) {
      DB.deleteSession(Auth.getCurrentUser(), session.id, reason).then(function () {
        return renderAdminSessions();
      }).catch(function (err) {
        showBanner(byId('addUserError'), err.message || 'The record could not be deleted.', 'error');
      });
    });
  }

  function renderAuditLog() {
    return DB.getAuditLog().then(function (log) {
      var tbody = byId('auditLogTableBody');
      clearChildren(tbody);
      if (!log.length) {
        renderEmptyRow(tbody, 5, 'No audit activity has been recorded.');
        return;
      }
      log.slice().reverse().forEach(function (entry) {
        var tr = document.createElement('tr');
        [
          fmtDate(entry.timestamp),
          entry.actorRole || 'system',
          entry.action,
          entry.targetType + (entry.targetId ? ' · ' + entry.targetId : ''),
          entry.reason || 'No reason recorded'
        ].forEach(function (val) {
          var td = document.createElement('td');
          td.textContent = val;
          tr.appendChild(td);
        });
        tbody.appendChild(tr);
      });
    });
  }

  // ---- participants table (shared by admin + examiner views) ---------

  function renderParticipantsTable(tbody, showAll) {
    return DB.listParticipants().then(function (all) {
      clearChildren(tbody);
      var user = Auth.getCurrentUser();
      var list = all;
      if (!showAll) {
        list = list.filter(function (p) { return p.createdBy === user.id; });
      }
      if (!list.length) {
        renderEmptyRow(tbody, 7, showAll ? 'No participants have been enrolled.' : 'You have no participants yet.');
        return;
      }
      list.forEach(function (p) {
        var tr = document.createElement('tr');
        [
          p.code,
          p.age,
          p.sex,
          p.education,
          p.consent.signedAt ? 'Signed ' + fmtDate(p.consent.signedAt) : 'Not signed',
          fmtDate(p.dateEnrolled)
        ].forEach(function (val) {
          var td = document.createElement('td');
          td.textContent = val;
          tr.appendChild(td);
        });

        var tdActions = document.createElement('td');
        var withdrawBtn = document.createElement('button');
        withdrawBtn.className = 'btn btn--danger btn--small';
        withdrawBtn.textContent = 'Withdraw consent';
        withdrawBtn.addEventListener('click', function () { promptWithdrawConsent(p, tbody, showAll); });
        tdActions.appendChild(withdrawBtn);
        tr.appendChild(tdActions);

        tbody.appendChild(tr);
      });
    });
  }

  function promptWithdrawConsent(participant, tbody, showAll) {
    requestConfirm('Withdraw consent', 'This permanently erases participant ' + participant.code + ' and its assessment records.', function () {
      requestReason('Reason for withdrawal', 'Record why consent was withdrawn.', function (reason) {
        DB.withdrawConsentAndErase(Auth.getCurrentUser(), participant.code, reason).then(function () {
          return renderParticipantsTable(tbody, showAll);
        });
      });
    });
  }

  // ---- examiner shell -------------------------------------------------

  function wireExaminerShell() {
    byId('examinerLogoutBtn').addEventListener('click', logout);
    byId('newAssessmentBtn').addEventListener('click', function () {
      Router.navigate('testSelection');
    });
  }

  function renderExaminerDashboard() {
    return Promise.all([
      DB.listParticipants(),
      DB.listSessionsForExaminer(Auth.getCurrentUser().id)
    ]).then(function (results) {
      renderParticipantsTable(byId('examinerParticipantsTable'), false);
      var tbody = byId('examinerSessionsTableBody');
      clearChildren(tbody);
      if (!results[1].length) {
        renderEmptyRow(tbody, 6, 'No assessment records yet.');
        return;
      }
      results[1].forEach(function (session) {
        var tr = document.createElement('tr');
        [
          session.participantCode,
          (session.testsSelected || []).join(', ') || 'None selected',
          session.practiceMode ? 'Practice' : 'Real',
          session.status,
          fmtDate(session.startedAt)
        ].forEach(function (val) {
          var td = document.createElement('td');
          td.textContent = val;
          tr.appendChild(td);
        });

        // SRS: interrupted sessions resume; examiners watch in-progress
        // assessments draw in real time.
        var tdActions = document.createElement('td');
        if (session.status === 'in_progress') {
          var resumeBtn = document.createElement('button');
          resumeBtn.className = 'btn btn--secondary btn--small';
          resumeBtn.textContent = 'Resume';
          resumeBtn.addEventListener('click', function () { TestFlow.resumeSession(session); });
          tdActions.appendChild(resumeBtn);

          var watchBtn = document.createElement('button');
          watchBtn.className = 'btn btn--ghost btn--small';
          watchBtn.textContent = 'Watch live';
          watchBtn.addEventListener('click', function () { Router.navigate('liveView', { sessionId: session.id }); });
          tdActions.appendChild(watchBtn);
        } else if (session.status === 'completed') {
          var reportBtn = document.createElement('button');
          reportBtn.className = 'btn btn--secondary btn--small';
          reportBtn.textContent = 'View report';
          reportBtn.addEventListener('click', function () { TestFlow.viewSessionReport(session); });
          tdActions.appendChild(reportBtn);
        } else {
          tdActions.textContent = 'No actions';
        }
        tr.appendChild(tdActions);

        tbody.appendChild(tr);
      });
    });
  }

  // ---- resume of interrupted sessions (SRS) ------------------------------

  function renderResumeScreen() {
    var tbody = byId('resumeSessionsTableBody');
    clearChildren(tbody);
    var sessions = TestFlow.getResumeList();
    if (!sessions.length) {
      renderEmptyRow(tbody, 4, 'There are no incomplete assessments to resume.');
      return;
    }
    sessions.forEach(function (session) {
      var tr = document.createElement('tr');
      [
        session.participantCode,
        (session.testsSelected || []).join(', ') || 'None selected',
        fmtDate(session.startedAt)
      ].forEach(function (val) {
        var td = document.createElement('td');
        td.textContent = val;
        tr.appendChild(td);
      });
      var tdActions = document.createElement('td');
      var resumeBtn = document.createElement('button');
      resumeBtn.className = 'btn btn--primary btn--small';
      resumeBtn.textContent = 'Resume';
      resumeBtn.addEventListener('click', function () { TestFlow.resumeSession(session); });
      tdActions.appendChild(resumeBtn);
      tr.appendChild(tdActions);
      tbody.appendChild(tr);
    });
  }

  function wireResumeScreen() {
    byId('resumeLeaveBtn').addEventListener('click', function () {
      if (Auth.isExaminee()) {
        logout();
      } else {
        Router.navigate(Auth.isAdmin() ? 'adminDashboard' : 'examinerDashboard');
      }
    });
    byId('startNewAssessmentBtn').addEventListener('click', function () {
      Router.navigate('testSelection');
    });
  }

  // ---- examiner live view (SRS: watch the participant draw) ---------------

  var livePollTimer = null;

  function startLiveView() {
    var params = Router.getParams();
    var sessionId = params && params.sessionId;
    var img = byId('liveViewImage');
    var meta = byId('liveViewMeta');
    if (!sessionId) {
      Router.navigate(Auth.isAdmin() ? 'adminDashboard' : 'examinerDashboard');
      return;
    }
    stopLiveView();

    function tick() {
      DB.getLiveDrawing(sessionId).then(function (live) {
        if (!live) {
          meta.textContent = 'Waiting for the participant to start drawing\u2026';
          img.removeAttribute('src');
          return;
        }
        meta.textContent = 'Drawing: ' + (live.testKey || 'Not identified') + ' | ' + (live.itemId || 'Not identified') +
          ' (updated ' + fmtDate(live.updatedAt) + ')';
        if (img.getAttribute('src') !== live.dataUrl) img.setAttribute('src', live.dataUrl);
      }).catch(function () {
        meta.textContent = 'Could not reach the live stream \u2014 retrying\u2026';
      });
    }

    tick();
    livePollTimer = setInterval(tick, 1500);
  }

  function stopLiveView() {
    if (livePollTimer) { clearInterval(livePollTimer); livePollTimer = null; }
  }

  function wireLiveView() {
    byId('liveViewBackBtn').addEventListener('click', function () {
      stopLiveView();
      Router.navigate(Auth.isAdmin() ? 'adminDashboard' : 'examinerDashboard');
    });
  }

  // ---- participant intake + consent -----------------------------------

  var pendingParticipantCode = null;

  // "Submitted" latches, not simple busy flags: they must survive past a
  // single handler invocation returning, because the risk they guard
  // against is a genuine double-tap on a tablet (two separate, fully
  // synchronous event dispatches back to back) creating two DB records
  // from one intended action — a plain try/finally busy flag would have
  // already reset by the time a second, distinct dispatch arrives.
  var intakeSubmitted = false;
  var consentSubmitted = false;

  function wireParticipantIntake() {
    var form = byId('intakeForm');
    var error = byId('intakeError');
    byId('intakeCancelBtn').addEventListener('click', function () {
      Router.navigate(Auth.isAdmin() ? 'adminDashboard' : 'examinerDashboard');
    });

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      if (intakeSubmitted) return;
      var data = {
        code: byId('intakeCode').value.trim(),
        age: byId('intakeAge').value.trim(),
        sex: byId('intakeSex').value,
        education: byId('intakeEducation').value.trim(),
        referral: byId('intakeReferral').value.trim(),
        dateEnrolled: DB.nowIso()
      };
      if (!data.code) {
        showBanner(error, 'A participant code is required. Do not enter a name.', 'error');
        return;
      }
      // Latch synchronously, before the write — the whole point of the
      // latch (see the comment at its declaration) is to survive past
      // this handler returning, which matters on the hosted backend
      // where the write is a network round-trip and a second rapid tap
      // would otherwise arrive while the first is still in flight.
      // Reset in the catch so a failure allows a retry.
      intakeSubmitted = true;
      // DB.* returns a Promise in both modes (see storage.js) — chain on
      // it so a rejection (e.g. duplicate code, network failure) surfaces
      // as a banner instead of vanishing as an unhandled rejection, and
      // so navigation only happens after the participant actually exists.
      DB.createParticipant(Auth.getCurrentUser(), data).then(function () {
        showBanner(error, '', 'error');
        pendingParticipantCode = data.code;
        form.reset();
        Router.navigate('consentCapture');
      }).catch(function (err) {
        intakeSubmitted = false;
        showBanner(error, err.message, 'error');
      });
    });
  }

  var signaturePad = null;

  function wireConsentCapture() {
    byId('clearIsDisabledNotice'); // no-op, canvas intentionally has no clear/undo (see spec)

    byId('consentBackBtn').addEventListener('click', function () {
      Router.navigate(Auth.isAdmin() ? 'adminDashboard' : 'examinerDashboard');
    });

    byId('consentSubmitBtn').addEventListener('click', function () {
      if (consentSubmitted) return;
      var error = byId('consentError');
      var checkbox = byId('consentUnderstoodCheckbox');
      if (!checkbox.checked) {
        showBanner(error, 'The participant must confirm they understand before signing can be recorded.', 'error');
        return;
      }
      if (!signaturePad || !signaturePad.hasSignature()) {
        showBanner(error, 'A signature is required on the canvas above.', 'error');
        return;
      }
      consentSubmitted = true;
      var dataUrl = signaturePad.toDataUrl();
      var code = pendingParticipantCode;
      // Consent must be recorded BEFORE the session starts (startAfterConsent
      // creates it) — chain on the write so a failure surfaces as a banner
      // and allows a retry, instead of silently creating an unsanctioned
      // session with no consent on record.
      DB.recordConsent(Auth.getCurrentUser(), code, dataUrl).then(function () {
        showBanner(error, '', 'error');
        pendingParticipantCode = null;
        return TestFlow.startAfterConsent(code);
      }).catch(function (err) {
        showBanner(error, err.message, 'error');
        consentSubmitted = false;
      });
    });
  }

  function prepareConsentCanvas() {
    consentSubmitted = false;
    byId('consentUnderstoodCheckbox').checked = false;
    byId('consentParticipantCode').textContent = pendingParticipantCode || 'Not assigned';
    signaturePad = createSignaturePad(byId('consentCanvas'));
  }

  // Minimal signature capture. Deliberately offers NO clear/undo control,
  // per spec, so a signature in progress cannot be erased and re-attempted
  // by anyone other than by refusing consent outright.
  function createSignaturePad(canvas) {
    var ctx = canvas.getContext('2d');
    var drawing = false;
    var touched = false;
    var last = null;

    function resize() {
      var ratio = window.devicePixelRatio || 1;
      var rect = canvas.getBoundingClientRect();
      canvas.width = rect.width * ratio;
      canvas.height = rect.height * ratio;
      ctx.scale(ratio, ratio);
      ctx.lineWidth = 2.5;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.strokeStyle = '#1B2124';
    }
    resize();

    function pointFromEvent(evt) {
      var rect = canvas.getBoundingClientRect();
      var point = evt.touches ? evt.touches[0] : evt;
      return { x: point.clientX - rect.left, y: point.clientY - rect.top };
    }

    function start(evt) {
      evt.preventDefault();
      drawing = true;
      touched = true;
      last = pointFromEvent(evt);
    }

    function move(evt) {
      if (!drawing) return;
      evt.preventDefault();
      var p = pointFromEvent(evt);
      ctx.beginPath();
      ctx.moveTo(last.x, last.y);
      ctx.lineTo(p.x, p.y);
      ctx.stroke();
      last = p;
    }

    function end(evt) {
      if (evt) evt.preventDefault();
      drawing = false;
    }

    canvas.addEventListener('mousedown', start);
    canvas.addEventListener('mousemove', move);
    window.addEventListener('mouseup', end);
    canvas.addEventListener('touchstart', start, { passive: false });
    canvas.addEventListener('touchmove', move, { passive: false });
    canvas.addEventListener('touchend', end, { passive: false });

    return {
      hasSignature: function () { return touched; },
      toDataUrl: function () { return canvas.toDataURL('image/png'); }
    };
  }
})();
