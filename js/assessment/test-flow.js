/**
 * js/assessment/test-flow.js
 * -----------------------------------------------------------------------
 * Owns everything between "examiner taps + New assessment" and "session
 * summary screen": test selection, handing off to participant intake +
 * consent (already in app.js), creating the DB.session, running each
 * selected test module through ItemEngine in sequence, session-level
 * pause/resume, and building the final scored summary + print/PDF.
 *
 * PDF export note: rather than vendoring a PDF-generation library (which
 * the offline/no-CDN constraint means shipping and maintaining a local
 * copy of), the summary screen uses the browser's native print dialog
 * with a print-only stylesheet (see css/styles.css, @media print). On
 * Android Chrome this dialog includes "Save as PDF" as a destination, so
 * the requirement is met with zero extra dependencies. If a bundled
 * jsPDF is specifically required instead, that can be layered on later
 * without touching the scoring logic below.
 */

var TestFlow = (function () {
  'use strict';

  var ALL_TESTS = [
    { key: 'MoCA', label: 'MoCA — Montreal Cognitive Assessment' },
    { key: 'RQCST', label: 'RQCST' },
    { key: 'Rey', label: 'Rey Complex Figure Test' },
    { key: 'TMT', label: 'Trail-Making Test' },
    { key: 'BSI18', label: 'BSI-18' }
  ];

  var selectedKeys = [];
  var practiceMode = false;
  var originalSelection = [];
  var runQueue = [];
  var currentSession = null;
  var currentRunner = null;
  var preparedParticipantCode = null;
  var currentReport = null;

  // ---- test selection screen ------------------------------------------

  function wireTestSelection() {
    var checklist = document.getElementById('testSelectionChecklist');
    ALL_TESTS.forEach(function (t) {
      var label = document.createElement('label');
      label.className = 'checkbox-row';
      var input = document.createElement('input');
      input.type = 'checkbox';
      input.value = t.key;
      input.className = 'test-selection-checkbox';
      var span = document.createElement('span');
      span.textContent = t.label;
      label.appendChild(input);
      label.appendChild(span);
      checklist.appendChild(label);
    });

    document.getElementById('testSelectionForm').addEventListener('submit', function (e) {
      e.preventDefault();
      var checked = Array.prototype.slice.call(document.querySelectorAll('.test-selection-checkbox:checked'))
        .map(function (el) { return el.value; });
      var error = document.getElementById('testSelectionError');
      if (checked.length === 0) {
        error.textContent = 'Select at least one test.';
        error.className = 'banner banner--error';
        error.hidden = false;
        return;
      }
      error.hidden = true;
      selectedKeys = checked;
      practiceMode = document.getElementById('practiceModeToggle').checked;
      Router.navigate('participantIntake');
    });
  }

  function resetSelectionForm() {
    document.querySelectorAll('.test-selection-checkbox').forEach(function (el) { el.checked = false; });
    document.getElementById('practiceModeToggle').checked = false;
  }

  function setAssignedTests(keys) {
    selectedKeys = (keys || []).slice();
    originalSelection = selectedKeys.slice();
  }

  function getSelectedKeys() { return selectedKeys.slice(); }

  function setPreparedParticipantCode(participantCode) {
    preparedParticipantCode = participantCode || null;
  }

  function showAssessmentReady(participantCode) {
    setPreparedParticipantCode(participantCode);
    if (Auth.isExaminee()) {
      Router.navigate('assessmentReady');
      return;
    }
    Router.navigate(Auth.isAdmin() ? 'adminDashboard' : 'examinerDashboard');
  }

  function startPreparedAssessment() {
    var participantCode = preparedParticipantCode;
    if (!participantCode) {
      var currentUser = Auth.getCurrentUser();
      if (currentUser && currentUser.examineeParticipant) {
        participantCode = currentUser.examineeParticipant.code;
      }
    }
    if (!participantCode) {
      throw new Error('No participant code is available for this assessment.');
    }
    return startAfterConsent(participantCode);
  }

  // ---- called by app.js once consent has been recorded -----------------

  function startAfterConsent(participantCode) {
    var actor = Auth.getCurrentUser();
    // DB.createSession returns a Promise in both modes (see storage.js) —
    // await it so currentSession is the real session record rather than
    // a promise, and so the runner only starts once the session exists.
    return DB.createSession(actor, {
      participantCode: participantCode,
      testsSelected: selectedKeys,
      practiceMode: practiceMode,
      examinerId: actor && actor.role === 'examinee' && actor.examineeParticipant
        ? actor.examineeParticipant.createdBy : undefined
    }).then(function (session) {
      currentSession = session;
      originalSelection = selectedKeys.slice();
      runQueue = selectedKeys.slice();
      Router.navigate('testRunner');
      setPracticeBanner('practiceBanner', practiceMode);
      runNextTest();
    });
  }

  function setPracticeBanner(id, on) {
    var el = document.getElementById(id);
    el.hidden = !on;
  }

  // ---- running the sequence of test modules ----------------------------

  function runNextTest() {
    var container = document.getElementById('testRunnerContainer');
    if (runQueue.length === 0) {
      finalizeSession();
      return;
    }
    var key = runQueue.shift();
    var testModule = window.Tests[key];
    document.getElementById('testRunnerTitle').textContent =
      testModule.name + ' (' + (originalSelection.length - runQueue.length) + ' of ' + originalSelection.length + ')';
    // Resume support (SRS): items that already have a saved response are
    // skipped, so an interrupted test continues at the first unanswered
    // item. For a fresh session the map is empty and the test starts
    // from the top — same code path either way.
    var answered = (currentSession && currentSession.responses && currentSession.responses[key]) || {};
    currentRunner = ItemEngine.run(container, testModule, currentSession.id, Auth.getCurrentUser(), function () {
      runNextTest();
    }, { answeredItemIds: answered });
  }

  // ---- resume of interrupted sessions (SRS) ------------------------------

  var resumeList = [];

  function setResumeList(sessions) { resumeList = sessions || []; }
  function getResumeList() { return resumeList; }

  function getCurrentSession() { return currentSession; }

  // Continue an interrupted session: tests whose items all have saved
  // responses are skipped; the first partly-answered test resumes at its
  // first unanswered item; a session with nothing left finalizes instead.
  function resumeSession(session) {
    currentSession = session;
    selectedKeys = (session.testsSelected || []).slice();
    originalSelection = selectedKeys.slice();
    runQueue = remainingTests(session);
    var continueSession = function () {
      Router.navigate('testRunner');
      setPracticeBanner('practiceBanner', !!session.practiceMode);
      runNextTest();
    };
    if (session.status === 'paused' && typeof DB.resumeSession === 'function') {
      DB.resumeSession(Auth.getCurrentUser(), session.id).then(continueSession);
    } else {
      continueSession();
    }
  }

  function remainingTests(session) {
    var remaining = [];
    (session.testsSelected || []).forEach(function (key) {
      var module = window.Tests[key];
      if (!module) return;
      var responses = (session.responses && session.responses[key]) || {};
      var allAnswered = module.items.every(function (it) { return !!responses[it.id]; });
      if (!allAnswered) remaining.push(key);
    });
    return remaining;
  }

  function wirePauseControls() {
    document.getElementById('pauseSessionBtn').addEventListener('click', function () {
      AppDialogs.requestReason('Pause assessment', 'The timer will pause until the examiner resumes the session.', function (reason) {
        if (currentRunner) currentRunner.pauseSession(reason);
        document.getElementById('pauseOverlay').hidden = false;
      });
    });
    document.getElementById('resumeSessionBtn').addEventListener('click', function () {
      if (currentRunner) currentRunner.resumeSession();
      document.getElementById('pauseOverlay').hidden = true;
    });
    document.getElementById('stopSessionBtn').addEventListener('click', function () {
      AppDialogs.requestReason('Stop assessment', 'Stopped assessments remain recorded and cannot be resumed.', function (reason) {
        if (!currentSession) return;
        DB.stopSession(Auth.getCurrentUser(), currentSession.id, reason).then(function () {
          Router.navigate(Auth.isAdmin() ? 'adminDashboard' : 'examinerDashboard');
        }).catch(function (err) {
          window.alert(err.message || 'Unable to stop the assessment.');
        });
      });
    });
  }

  // ---- summary / scoring -------------------------------------------

  function finalizeSession() {
    var actor = Auth.getCurrentUser();
    // DB.getSession / getParticipant / completeSession all return Promises
    // in both modes (see storage.js) — chain on them so scoring reads the
    // real saved responses and the summary only shows after completion.
    return DB.getSession(currentSession.id).then(function (session) {
      return DB.getParticipant(session.participantCode).then(function (participant) {
        var scores = {};
        originalSelection.forEach(function (key) {
          var testModule = window.Tests[key];
          var responses = (session.responses && session.responses[key]) || {};
          scores[key] = testModule.score(responses, { participant: participant, session: session });
        });
        return DB.completeSession(actor, currentSession.id, scores).then(function () {
          renderSummary(session.participantCode, scores, session.practiceMode, session.responses || {});
          Router.navigate('sessionSummary');
        });
      });
    });
  }

  function renderSummary(participantCode, scores, isPractice, allResponses) {
    currentReport = {
      participantCode: participantCode,
      scores: scores,
      isPractice: isPractice,
      responses: allResponses
    };
    document.getElementById('summaryParticipantCode').textContent = participantCode;
    setPracticeBanner('practiceBannerSummary', isPractice);

    var container = document.getElementById('summaryTestBlocks');
    container.innerHTML = '';

    // SRS: the examinee must never see their grades. When an examinee
    // completed the session, show only a neutral hand-back message —
    // the scored report and the printed PDF stay with the examiner.
    var printBtn = document.getElementById('printReportBtn');
    var downloadBtn = document.getElementById('downloadReportBtn');
    var summaryLogoutBtn = document.getElementById('summaryLogoutBtn');
    if (summaryLogoutBtn) summaryLogoutBtn.hidden = Auth.isExaminee();
    if (Auth.isExaminee()) {
      var donePanel = document.createElement('div');
      donePanel.className = 'panel summary-block';
      var doneH = document.createElement('h3');
      doneH.textContent = 'Assessment finished';
      donePanel.appendChild(doneH);
      var doneP = document.createElement('p');
      doneP.textContent = 'Thank you. Please hand the device back to your examiner.';
      donePanel.appendChild(doneP);
      container.appendChild(donePanel);
      if (printBtn) printBtn.hidden = true;
      if (downloadBtn) downloadBtn.hidden = true;
      return;
    }
    if (printBtn) printBtn.hidden = false;
    if (downloadBtn) downloadBtn.hidden = false;

    originalSelection.forEach(function (key) {
      var result = scores[key];
      var testModule = window.Tests[key];
      var testResponses = allResponses[key] || {};
      var block = document.createElement('div');
      block.className = 'panel summary-block';

      var h3 = document.createElement('h3');
      h3.textContent = testModule.name;
      block.appendChild(h3);

      var scoreLine = document.createElement('p');
      scoreLine.className = 'summary-block__score';
      if (typeof result.raw === 'number' && typeof result.max === 'number' && result.max !== null) {
        scoreLine.textContent = 'Score: ' + result.raw + ' / ' + result.max;
      } else if (result.partA && result.partB) {
        scoreLine.textContent = 'Part A: ' + (result.partA.timeSeconds !== null ? result.partA.timeSeconds + 's' : 'skipped') +
          '  ·  Part B: ' + (result.partB.timeSeconds !== null ? result.partB.timeSeconds + 's' : 'skipped');
      } else if (typeof result.raw === 'number') {
        scoreLine.textContent = 'Score: ' + result.raw;
      } else {
        scoreLine.textContent = 'No score available.';
      }
      block.appendChild(scoreLine);

      var interp = document.createElement('p');
      interp.className = 'summary-block__interpretation hint';
      interp.textContent = result.interpretation || '';
      block.appendChild(interp);

      // Per-item answers + points, so the printed report shows every
      // answer and grade for this participant, not just the totals (SRS).
      var answers = document.createElement('ul');
      answers.className = 'summary-answers';
      (testModule.items || []).forEach(function (it) {
        var r = testResponses[it.id];
        var li = document.createElement('li');
        var pts = r && typeof r.points === 'number' ? r.points : 0;
        li.textContent = (it.section ? it.section + ' — ' : '') + it.id + ': ' +
          responseSummaryText(it, r) + ' [' + pts + ' pt]';
        answers.appendChild(li);
      });
      block.appendChild(answers);

      // Show the participant's actual drawing(s) for any drawing-type item
      // in this test — this is generic (works for MoCA's visuospatial
      // item, both Rey phases, and TMT's two parts) rather than hardcoded
      // to any one test, since it just reads each test's own item list.
      (testModule.items || []).forEach(function (item) {
        if (item.type !== 'drawing' && item.type !== 'trail') return;
        var response = testResponses[item.id];
        if (!response || !response.drawingDataUrl) return;

        var figure = document.createElement('figure');
        figure.className = 'summary-drawing';

        var img = document.createElement('img');
        img.className = 'summary-drawing__image';
        img.src = response.drawingDataUrl;
        img.alt = (item.section || item.id) + ' — participant drawing';
        figure.appendChild(img);

        var caption = document.createElement('figcaption');
        caption.className = 'summary-drawing__caption';
        caption.textContent = (item.section || item.id) +
          (typeof response.elapsedSeconds === 'number' ? ' — ' + response.elapsedSeconds + 's' : '') +
          (typeof response.errors === 'number' ? ' — ' + response.errors + ' error(s)' : '');
        figure.appendChild(caption);

        block.appendChild(figure);
      });

      container.appendChild(block);
    });
  }

  function viewSessionReport(session) {
    originalSelection = (session.testsSelected || []).slice();
    renderSummary(session.participantCode, session.scores || {}, session.practiceMode, session.responses || {});
    Router.navigate('sessionSummary');
  }

  // Compact one-line description of one saved response, used by the
  // per-item answers list in the report.
  function responseSummaryText(item, r) {
    if (!r) return 'not answered';
    if (r.skipped) return 'skipped';
    switch (item.type) {
      case 'choice': {
        var opt = (item.options || []).filter(function (o) { return o.value === r.value; })[0];
        return opt ? opt.label : String(r.value);
      }
      case 'scale5': {
        var labels = item.scaleLabels || [];
        return r.value + ' — ' + (labels[r.value] || '');
      }
      case 'drawing':
        return r.drawingDataUrl
          ? 'drawing captured' + (typeof r.elapsedSeconds === 'number' ? ' — ' + r.elapsedSeconds + 's' : '')
          : 'no drawing';
      case 'trail':
        return 'trail completed in ' + (typeof r.elapsedSeconds === 'number' ? r.elapsedSeconds + 's' : '?') +
          ' with ' + (r.errors || 0) + ' error(s)';
      case 'timedFluency':
        return (r.value || 0) + ' valid response(s) in ' + (item.timerSeconds || 60) + 's';
      case 'tally':
        return String(r.value);
      case 'countdownGate':
        return 'waited';
      default:
        return (r.value === null || r.value === undefined) ? '(blank)' : String(r.value);
    }
  }

  function wireSummaryControls() {
    document.getElementById('printReportBtn').addEventListener('click', function () {
      window.print();
    });
    document.getElementById('downloadReportBtn').addEventListener('click', downloadPdfReport);
    document.getElementById('summaryFinishBtn').addEventListener('click', function () {
      resetSelectionForm();
      selectedKeys = [];
      practiceMode = false;
      // Examinees have no dashboard — leaving the summary means handing
      // the tablet back, i.e. logging out (SRS: no access to the app or
      // grades beyond the test-taking flow).
      if (Auth.isExaminee()) {
        Auth.logout();
        Router.navigate('login');
        return;
      }
      Router.navigate(Auth.isAdmin() ? 'adminDashboard' : 'examinerDashboard');
    });
    document.getElementById('summaryLogoutBtn').addEventListener('click', function () {
      Auth.logout();
      Router.navigate('login');
    });
    document.getElementById('runnerLogoutBtn').addEventListener('click', function () {
      Auth.logout();
      Router.navigate('login');
    });
  }

  function downloadPdfReport() {
    if (!currentReport || !window.jspdf || !window.jspdf.jsPDF) return;
    var pdf = new window.jspdf.jsPDF({ unit: 'pt', format: 'a4' });
    var margin = 42;
    var width = 595 - margin * 2;
    var y = 48;

    function write(text, size, bold) {
      pdf.setFont('helvetica', bold ? 'bold' : 'normal');
      pdf.setFontSize(size || 9);
      var lines = pdf.splitTextToSize(String(text), width);
      lines.forEach(function (line) {
        if (y > 790) { pdf.addPage(); y = 48; }
        pdf.text(line, margin, y);
        y += (size || 9) + 4;
      });
    }

    write('Neuropsychological Assessment Toolkit', 16, true);
    write('Assessment report | Participant: ' + currentReport.participantCode, 11, true);
    if (currentReport.isPractice) write('PRACTICE MODE', 10, true);
    y += 8;

    originalSelection.forEach(function (key) {
      var module = window.Tests[key];
      var result = currentReport.scores[key] || {};
      var responses = currentReport.responses[key] || {};
      if (y > 730) { pdf.addPage(); y = 48; }
      write(module.name, 13, true);
      if (typeof result.raw === 'number' && typeof result.max === 'number') {
        write('Score: ' + result.raw + ' / ' + result.max, 10, true);
      } else if (result.partA && result.partB) {
        write('Part A: ' + (result.partA.timeSeconds === null ? 'not completed' : result.partA.timeSeconds + ' seconds') +
          ' | Part B: ' + (result.partB.timeSeconds === null ? 'not completed' : result.partB.timeSeconds + ' seconds'), 10, true);
      }
      if (result.interpretation) write(result.interpretation, 9, false);
      (module.items || []).forEach(function (item) {
        var response = responses[item.id];
        write(item.id + ': ' + responseSummaryText(item, response) +
          ' | points: ' + (response && typeof response.points === 'number' ? response.points : 0), 8, false);
        if (response && response.drawingDataUrl) {
          if (y > 610) { pdf.addPage(); y = 48; }
          try {
            pdf.addImage(response.drawingDataUrl, 'PNG', margin, y, 220, 130, undefined, 'FAST');
            y += 142;
          } catch (e) {}
        }
      });
      y += 12;
    });
    pdf.save('assessment-' + currentReport.participantCode + '.pdf');
  }

  function init() {
    wireTestSelection();
    wirePauseControls();
    wireSummaryControls();
  }

  return {
    init: init,
    startAfterConsent: startAfterConsent,
    resetSelectionForm: resetSelectionForm,
    resumeSession: resumeSession,
    setResumeList: setResumeList,
    getResumeList: getResumeList,
    getCurrentSession: getCurrentSession,
    viewSessionReport: viewSessionReport,
    setAssignedTests: setAssignedTests,
    getSelectedKeys: getSelectedKeys,
    setPreparedParticipantCode: setPreparedParticipantCode,
    showAssessmentReady: showAssessmentReady,
    startPreparedAssessment: startPreparedAssessment
  };
})();
