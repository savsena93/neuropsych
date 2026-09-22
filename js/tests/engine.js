/**
 * js/tests/engine.js
 * -----------------------------------------------------------------------
 * ItemEngine renders ONE assessment item at a time from a declarative
 * item list, and is shared by all five test modules. Nothing in here
 * knows about MoCA vs BSI-18 vs TMT specifically — each module just
 * describes its items using the schema below, and the engine turns
 * that into UI, timers, auto-save, and auto-advance.
 *
 * ITEM SCHEMA (see data/*-content.js for real examples):
 * {
 *   id: 'unique_item_id',
 *   section: 'Domain / part label shown above the prompt',
 *   type: 'info' | 'choice' | 'passfail' | 'text' | 'number' |
 *         'scale5' | 'timedFluency' | 'tally' | 'drawing' | 'trail' |
 *         'countdownGate',
 *   prompt: 'Instruction/question text',
 *   examinerOnly: optional, true -> SRS rule: when an EXAMINEE is taking
 *                the test only the domain label is shown, never the
 *                prompt (it is read aloud by the examiner). Staff roles
 *                always see the prompt; on shared screens the examiner
 *                has a "show script" reveal control.
 *   stimulusImage: optional — relative path to a real, local image file
 *                  (e.g. 'assets/test-images/moca/image1.png') shown above
 *                  the prompt. Use this for actual licensed stimuli; keep the
 *                  app offline-safe by only ever using local relative
 *                  paths, never a remote URL,
 *   stimulusNote: optional — text shown in a dashed box, either standing
 *                 in for an image you haven't added yet, or as a caption
 *                 alongside stimulusImage,
 *   nodes: for type 'trail' ONLY — ordered array of targets
 *          [{ label, xFrac, yFrac }, ...] where array order IS the
 *          required connection order and fractions are of canvas
 *          width/height. Start and end nodes get marker rings.
 *   autoAdvance: for type 'trail' — record + advance automatically when
 *                the end node is reached (practice parts use this);
 *                default false = examiner confirms with the Finish button.
 *   points: max points this item is worth (0 if not scored),
 *   examinerScored: true -> engine shows a 0..points dropdown the examiner
 *                    fills in (clinical judgement); false -> engine scores
 *                    automatically by comparing the response to `correct`,
 *   correct: expected value, only used when examinerScored is false,
 *   options: [{ value, label }] for 'choice' / 'passfail',
 *   timerSeconds: countdown length for 'timedFluency' / 'countdownGate',
 *   allowSkip: default true — false hides the per-item skip control
 *              (used for the mandatory consent-style items, if any)
 * }
 *
 * Every item, regardless of type, ends up saved via
 * DB.saveSessionResponse(sessionId, testKey, item.id, responseRecord)
 * where responseRecord is at minimum { value, points, skipped, timestamp }.
 */

var ItemEngine = (function () {
  'use strict';

  // Runs a single test module against a container element. Calls
  // onTestComplete({ scores, autoScore, examinerAdjustments }) once every
  // item has been answered or skipped.
  //
  // resumeState (optional, set by TestFlow when resuming an in-progress
  // session): { answeredItemIds: { id: responseRecord } } — the engine
  // starts at the first item without a saved response, so an interrupted
  // assessment continues exactly where it left off (SRS: incomplete tests
  // must be resumable on the next login).
  function run(container, testModule, sessionId, actor, onTestComplete, resumeState) {
    var items = testModule.items;
    var answered = resumeState && resumeState.answeredItemIds ? resumeState.answeredItemIds : null;
    var index = firstUnansweredIndex(items, answered);
    var activeTimer = null;
    var paused = false;

    renderCurrentItem();

    function firstUnansweredIndex(list, answeredMap) {
      if (!answeredMap) return 0;
      for (var i = 0; i < list.length; i++) {
        if (!answeredMap[list[i].id]) return i;
      }
      return list.length;
    }

    function renderCurrentItem() {
      clearActiveTimer();
      container.innerHTML = '';

      if (index >= items.length) {
        finishTest();
        return;
      }

      var item = items[index];
      var frame = buildFrame(item, items.length, index);
      container.appendChild(frame.root);

      switch (item.type) {
        case 'info': renderInfo(item, frame); break;
        case 'choice': renderChoice(item, frame); break;
        case 'passfail': renderPassFail(item, frame); break;
        case 'text': renderText(item, frame); break;
        case 'number': renderNumber(item, frame); break;
        case 'scale5': renderScale5(item, frame); break;
        case 'timedFluency': renderTimedFluency(item, frame); break;
        case 'tally': renderTally(item, frame); break;
        case 'drawing': renderDrawing(item, frame, { extraControls: item.extraControls }); break;
        case 'trail': renderTrail(item, frame); break;
        case 'countdownGate': renderCountdownGate(item, frame); break;
        default:
          frame.body.textContent = 'Unknown item type: ' + item.type;
      }
    }

    // ---- shared chrome: section label, prompt, stimulus note, skip/pause ---

    function buildFrame(item, total, i) {
      var root = document.createElement('div');
      root.className = 'item-frame';

      var progress = document.createElement('div');
      progress.className = 'item-frame__progress';
      progress.textContent = testModule.name + ' — item ' + (i + 1) + ' of ' + total;
      root.appendChild(progress);

      if (item.section) {
        var section = document.createElement('div');
        section.className = 'item-frame__section';
        section.textContent = item.section;
        root.appendChild(section);
      }

      // SRS rule: items the examinee must NOT see (word lists read aloud,
      // sentences to repeat, mental arithmetic, examiner-tallied tasks)
      // declare `examinerOnly: true`. When an examinee is taking the
      // test, only the domain label is shown — never the prompt — plus a
      // staff-only reveal control so the examiner can still read the
      // script off the screen. Examiners/admins see the prompt normally.
      if (item.examinerOnly && actor && actor.role === 'examinee') {
        var blind = document.createElement('p');
        blind.className = 'item-frame__prompt';
        blind.textContent = 'Follow your examiner\u2019s spoken instructions for this part.';
        root.appendChild(blind);
      } else {
        var prompt = document.createElement('p');
        prompt.className = 'item-frame__prompt';
        prompt.textContent = item.prompt;
        root.appendChild(prompt);
      }

      var stimulusImages = item.stimulusImages || (item.stimulusImage ? [item.stimulusImage] : []);
      stimulusImages.forEach(function (stimulusImage, imageIndex) {
        var img = document.createElement('img');
        img.className = 'stimulus-image';
        img.src = stimulusImage;
        img.alt = item.stimulusImageAlt || (item.section || 'Stimulus image') + ' ' + (imageIndex + 1);
        root.appendChild(img);
      });

      if (item.stimulusNote) {
        var stim = document.createElement('div');
        stim.className = 'stimulus-placeholder';
        stim.textContent = item.stimulusNote;
        root.appendChild(stim);
      }

      var body = document.createElement('div');
      body.className = 'item-frame__body';
      root.appendChild(body);

      var footer = document.createElement('div');
      footer.className = 'item-frame__footer';
      root.appendChild(footer);

      if (item.allowSkip !== false && (!actor || actor.role !== 'examinee')) {
        var skipBtn = document.createElement('button');
        skipBtn.type = 'button';
        skipBtn.className = 'btn btn--ghost btn--small';
        skipBtn.textContent = 'Skip item (reason required)';
        skipBtn.addEventListener('click', function () { skipCurrentItem(item); });
        footer.appendChild(skipBtn);
      }

      if (index > 0 && actor && actor.role !== 'examinee') {
        var backBtn = document.createElement('button');
        backBtn.type = 'button';
        backBtn.className = 'btn btn--ghost btn--small';
        backBtn.textContent = 'Back';
        backBtn.addEventListener('click', function () {
          index -= 1;
          renderCurrentItem();
        });
        footer.insertBefore(backBtn, footer.firstChild);
      }

      return { root: root, body: body, footer: footer };
    }

    function skipCurrentItem(item) {
      AppDialogs.requestReason('Skip item', 'Record why item "' + item.id + '" is being skipped.', function (reason) {
        DB.logPause(actor, sessionId, reason, 'skip');
        saveResponse(item, { value: null, points: 0, skipped: true, reason: reason });
        advance();
      });
    }

    function addNextButton(frame, item, getResponse, label) {
      var btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'btn btn--primary';
      btn.textContent = label || 'Next';
      btn.addEventListener('click', function () {
        saveResponse(item, getResponse());
        advance();
      });
      frame.footer.appendChild(btn);
      return btn;
    }

    function saveResponse(item, partialRecord) {
      var record = Object.assign({
        value: null, points: 0, skipped: false, timestamp: DB.nowIso()
      }, partialRecord);
      DB.saveSessionResponse(sessionId, testModule.key, item.id, record);
    }

    function advance() {
      index += 1;
      renderCurrentItem();
    }

    function clearActiveTimer() {
      if (activeTimer) { clearInterval(activeTimer); activeTimer = null; }
    }

    // ---- per-type renderers ------------------------------------------

    function renderInfo(item, frame) {
      addNextButton(frame, item, function () {
        return { value: 'acknowledged', points: 0 };
      }, 'Continue');
    }

    function renderChoice(item, frame) {
      item.options.forEach(function (opt) {
        var btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'btn btn--secondary btn--block choice-btn';
        btn.textContent = opt.label;
        btn.addEventListener('click', function () {
          var correct = !item.examinerScored && opt.value === item.correct;
          var points = item.examinerScored ? null : (correct ? item.points : 0);
          if (item.examinerScored) {
            promptExaminerPoints(item, function (pts) {
              saveResponse(item, { value: opt.value, points: pts });
              advance();
            });
          } else {
            saveResponse(item, { value: opt.value, points: points });
            advance();
          }
        });
        frame.body.appendChild(btn);
      });
    }

    // Pass/Fail is itself the examiner's clinical judgement — tapping one
    // of the two buttons IS the scoring decision, so (unlike renderChoice)
    // this never opens a second "how many points" prompt on top of it.
    function renderPassFail(item, frame) {
      var options = item.options || [
        { value: 'pass', label: 'Pass', points: item.points },
        { value: 'fail', label: 'Fail', points: 0 }
      ];
      options.forEach(function (opt) {
        var btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'btn btn--secondary btn--block choice-btn';
        btn.textContent = opt.label;
        btn.addEventListener('click', function () {
          var points = typeof opt.points === 'number' ? opt.points : (opt.value === 'pass' ? item.points : 0);
          saveResponse(item, { value: opt.value, points: points });
          advance();
        });
        frame.body.appendChild(btn);
      });
    }

    function renderText(item, frame) {
      var input = document.createElement('textarea');
      input.className = 'field__input field__input--textarea';
      input.rows = 2;
      input.setAttribute('aria-label', item.prompt);
      frame.body.appendChild(input);
      attachExaminerScoreIfNeeded(item, frame);
      addNextButton(frame, item, function () {
        return withExaminerPoints(item, frame, { value: input.value });
      });
    }

    function renderNumber(item, frame) {
      var input = document.createElement('input');
      input.type = 'number';
      input.className = 'field__input';
      frame.body.appendChild(input);
      attachExaminerScoreIfNeeded(item, frame);
      addNextButton(frame, item, function () {
        var val = input.value === '' ? null : Number(input.value);
        var points = item.examinerScored ? readExaminerPoints(frame) :
          (val === item.correct ? item.points : 0);
        return { value: val, points: points };
      });
    }

    function renderScale5(item, frame) {
      var labels = item.scaleLabels || ['0', '1', '2', '3', '4'];
      var row = document.createElement('div');
      row.className = 'scale5-row';
      labels.forEach(function (label, val) {
        var btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'btn btn--secondary scale5-btn';
        btn.textContent = val + ' — ' + label;
        btn.addEventListener('click', function () {
          saveResponse(item, { value: val, points: val });
          advance();
        });
        row.appendChild(btn);
      });
      frame.body.appendChild(row);
    }

    // Timed word-generation task (verbal fluency style). Counts taps of
    // "Valid response" as the participant names items aloud; the examiner
    // taps once per acceptable response. Auto-ends at 0 with no user input.
    function renderTimedFluency(item, frame) {
      var seconds = item.timerSeconds || 60;
      var count = 0;
      var display = document.createElement('div');
      display.className = 'timer-display';
      frame.body.appendChild(display);

      var counterLabel = document.createElement('div');
      counterLabel.className = 'tally-count';
      counterLabel.textContent = 'Valid responses: 0';
      frame.body.appendChild(counterLabel);

      var tapBtn = document.createElement('button');
      tapBtn.type = 'button';
      tapBtn.className = 'btn btn--primary btn--large';
      tapBtn.textContent = 'Tap for each valid response';
      tapBtn.addEventListener('click', function () {
        count += 1;
        counterLabel.textContent = 'Valid responses: ' + count;
      });
      frame.body.appendChild(tapBtn);

      var remaining = seconds;
      display.textContent = formatClock(remaining);
      activeTimer = setInterval(function () {
        if (paused) return;
        remaining -= 1;
        display.textContent = formatClock(Math.max(remaining, 0));
        if (remaining <= 0) {
          clearActiveTimer();
          tapBtn.disabled = true;
          saveResponse(item, { value: count, points: count });
          advance();
        }
      }, 1000);
    }

    // Simple increment/decrement tally — used for MoCA-style vigilance or
    // error counts that don't need a canvas.
    function renderTally(item, frame) {
      var count = 0;
      var display = document.createElement('div');
      display.className = 'tally-count';
      display.textContent = String(count);
      frame.body.appendChild(display);

      var row = document.createElement('div');
      row.className = 'button-row';
      var minus = document.createElement('button');
      minus.type = 'button';
      minus.className = 'btn btn--secondary';
      minus.textContent = '−1';
      minus.addEventListener('click', function () { count = Math.max(0, count - 1); display.textContent = String(count); });
      var plus = document.createElement('button');
      plus.type = 'button';
      plus.className = 'btn btn--secondary';
      plus.textContent = '+1';
      plus.addEventListener('click', function () { count += 1; display.textContent = String(count); });
      row.appendChild(minus);
      row.appendChild(plus);
      frame.body.appendChild(row);

      addNextButton(frame, item, function () {
        return { value: count, points: item.examinerScored ? null : Math.min(count, item.points) };
      });
    }

    // Drawing canvas — used for MoCA visuospatial items, TMT trails, and
    // the Rey figure copy/recall. NO clear/undo control, per spec.
    // `config` lets a caller (e.g. the TMT module) add extra controls like
    // an error counter, and read back both the drawing and any such state.
    function renderDrawing(item, frame, config) {
      config = config || {};
      var wrap = document.createElement('div');
      wrap.className = 'signature-frame drawing-frame';
      var canvas = document.createElement('canvas');
      canvas.className = 'signature-canvas';
      wrap.appendChild(canvas);
      frame.body.appendChild(wrap);

      var pad = createDrawingPad(canvas, {
        // SRS: the examiner must be able to watch the drawing in real
        // time — push throttled snapshots as strokes land.
        onStroke: function (dataUrl) {
          startElapsedTimer();
          liveUpdate(item, dataUrl);
        }
      });
      if (typeof item.background === 'function') {
        // Pre-renders a non-interactive reference layer (e.g. placeholder
        // numbered/lettered targets for a trail-making item) before the
        // participant's own strokes go on top of it.
        item.background(pad.ctx, canvas);
      }

      var timerHandle = null;
      var elapsedSeconds = 0;
      var timerStarted = false;
      var display = null;
      // SRS: drawing phases are timed "from the time the person started
      // drawing till they finish" — the clock starts at the FIRST stroke,
      // not when the item appears, so the participant can study the
      // figure for as long as they like before starting.
      function startElapsedTimer() {
        if (timerStarted || !item.showsTimer) return;
        timerStarted = true;
        display = document.createElement('div');
        display.className = 'timer-display';
        display.textContent = formatClock(0);
        frame.body.insertBefore(display, wrap);
        timerHandle = setInterval(function () {
          if (paused) return;
          elapsedSeconds += 1;
          display.textContent = formatClock(elapsedSeconds);
        }, 1000);
        activeTimer = timerHandle;
      }

      var extra = config.extraControls ? config.extraControls(frame, pad) : null;

      addNextButton(frame, item, function () {
        clearActiveTimer();
        var points = item.examinerScored ? readExaminerPoints(frame) : (pad.hasDrawing() ? item.points : 0);
        var record = {
          value: pad.hasDrawing() ? 'drawing_captured' : 'no_drawing',
          drawingDataUrl: pad.toDataUrl(),
          elapsedSeconds: item.showsTimer ? elapsedSeconds : undefined,
          points: points
        };
        if (extra && extra.collect) Object.assign(record, extra.collect());
        return record;
      }, item.doneLabel || 'Done');

      attachExaminerScoreIfNeeded(item, frame);
    }

    // A hard wait screen (e.g. Rey's 3-minute gap between copy and delayed
    // recall). Counts down on its own; the only way past it early is the
    // per-item Skip control above, which logs a mandatory reason.
    function renderCountdownGate(item, frame) {
      var seconds = item.timerSeconds || 180;
      var display = document.createElement('div');
      display.className = 'timer-display timer-display--large';
      frame.body.appendChild(display);
      display.textContent = formatClock(seconds);

      activeTimer = setInterval(function () {
        if (paused) return;
        seconds -= 1;
        display.textContent = formatClock(Math.max(seconds, 0));
        if (seconds <= 0) {
          clearActiveTimer();
          saveResponse(item, { value: 'waited', points: 0 });
          advance();
        }
      }, 1000);
    }

    // ---- live drawing stream (examiner's real-time view, SRS) -----------
    // Throttled snapshot pushes while the participant draws; the examiner
    // Live view polls DB.getLiveDrawing(). Guarded so older content with
    // no live support still runs if the backend predates it.
    var liveLastPushAt = 0;

    function liveUpdate(item, dataUrl, force) {
      var now = Date.now();
      if (!force && now - liveLastPushAt < 900) return;
      liveLastPushAt = now;
      if (typeof DB.saveLiveDrawing === 'function') {
        DB.saveLiveDrawing(sessionId, testModule.key, item.id, dataUrl);
      }
    }

    // ---- interactive trail item (SRS: TMT + MoCA alternating trail) ------
    // The participant draws node-to-node in the exact order of item.nodes,
    // WITHOUT lifting the stylus. Connected nodes are filled differently
    // from unreached ones; the start and end nodes are marked. Touching a
    // wrong node or lifting before the end node counts as an error but
    // never stops the clock, which runs from the first touch to the final
    // node. item.autoAdvance: true records + advances on completion;
    // otherwise the examiner confirms via the Finish button.
    function renderTrail(item, frame) {
      var nodes = item.nodes || [];

      var display = document.createElement('div');
      display.className = 'timer-display';
      display.textContent = formatClock(0);
      frame.body.appendChild(display);

      var statusLabel = document.createElement('div');
      statusLabel.className = 'tally-count';
      frame.body.appendChild(statusLabel);

      var wrap = document.createElement('div');
      wrap.className = 'signature-frame drawing-frame';
      var canvas = document.createElement('canvas');
      canvas.className = 'signature-canvas trail-canvas';
      canvas.style.touchAction = 'none';
      wrap.appendChild(canvas);
      frame.body.appendChild(wrap);

      var errorsLabel = document.createElement('div');
      errorsLabel.className = 'tally-count tally-count--inline';
      errorsLabel.textContent = 'Errors: 0';
      var manualErrBtn = document.createElement('button');
      manualErrBtn.type = 'button';
      manualErrBtn.className = 'btn btn--secondary btn--small';
      manualErrBtn.textContent = 'Examiner: mark error';
      manualErrBtn.hidden = !actor || actor.role === 'examinee';
      errorsLabel.hidden = !actor || actor.role === 'examinee';
      var errRow = document.createElement('div');
      errRow.className = 'button-row';
      errRow.appendChild(manualErrBtn);
      errRow.appendChild(errorsLabel);
      frame.body.appendChild(errRow);

      var ctx = canvas.getContext('2d');
      var rect = null, radius = 18;
      var state = { nextIndex: 0, errors: 0, startedAt: null, elapsed: 0, finished: false, active: false, hasError: false };
      var wrongNode = null;
      var freeformPoints = [];
      var lastPoint = null;

      function sizeCanvas() {
        var dpr = window.devicePixelRatio || 1;
        rect = canvas.getBoundingClientRect();
        canvas.width = rect.width * dpr;
        canvas.height = rect.height * dpr;
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        radius = Math.max(14, Math.min(26, Math.min(rect.width, rect.height) * 0.05));
      }

      function nodeXY(n) {
        return { x: n.xFrac * rect.width, y: n.yFrac * rect.height };
      }

      function pointFromEvent(evt) {
        var r = canvas.getBoundingClientRect();
        var p = evt.touches ? evt.touches[0] : evt;
        return { x: p.clientX - r.left, y: p.clientY - r.top };
      }

      function redraw() {
        ctx.clearRect(0, 0, rect.width, rect.height);
        if (freeformPoints.length > 1) {
          ctx.lineWidth = 3;
          ctx.strokeStyle = '#1B2124';
          ctx.beginPath();
          ctx.moveTo(freeformPoints[0].x, freeformPoints[0].y);
          for (var i = 1; i < freeformPoints.length; i++) {
            ctx.lineTo(freeformPoints[i].x, freeformPoints[i].y);
          }
          ctx.stroke();
        }

        nodes.forEach(function (n, idx) {
          var p = nodeXY(n);
          var done = idx < state.nextIndex;
          ctx.beginPath();
          ctx.arc(p.x, p.y, radius, 0, Math.PI * 2);
          if (done) {
            ctx.fillStyle = '#2E7D32';
            ctx.fill();
            ctx.strokeStyle = '#1B5E20';
          } else {
            ctx.fillStyle = '#FFFFFF';
            ctx.fill();
            ctx.strokeStyle = '#5B6664';
          }
          ctx.lineWidth = (idx === 0 || idx === nodes.length - 1) ? 3 : 1.5;
          ctx.stroke();
          if (idx === 0 && nodes.length > 1) {
            ctx.beginPath();
            ctx.arc(p.x, p.y, radius + 4, 0, Math.PI * 2);
            ctx.stroke();
          }
          if (idx === nodes.length - 1 && nodes.length > 1) {
            ctx.beginPath();
            ctx.setLineDash([5, 4]);
            ctx.arc(p.x, p.y, radius + 4, 0, Math.PI * 2);
            ctx.stroke();
            ctx.setLineDash([]);
          }
          ctx.fillStyle = done ? '#FFFFFF' : '#1B2124';
          ctx.font = '700 16px sans-serif';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(n.label, p.x, p.y);
        });
        ctx.lineWidth = 2.5;
      }

      function hitIndex(clientX, clientY) {
        var r = canvas.getBoundingClientRect();
        var x = clientX - r.left;
        var y = clientY - r.top;
        var reach = radius + 6;
        for (var i = 0; i < nodes.length; i++) {
          var p = nodeXY(nodes[i]);
          if ((x - p.x) * (x - p.x) + (y - p.y) * (y - p.y) <= reach * reach) return i;
        }
        return -1;
      }

      function startTimer() {
        if (state.startedAt) return;
        state.startedAt = Date.now();
        activeTimer = setInterval(function () {
          if (paused) return;
          state.elapsed = Math.round((Date.now() - state.startedAt) / 1000);
          display.textContent = formatClock(state.elapsed);
        }, 250);
      }

      function nextLabel() {
        return state.nextIndex < nodes.length ? nodes[state.nextIndex].label : 'end';
      }

      function addError(reason) {
        state.errors += 1;
        errorsLabel.textContent = 'Errors: ' + state.errors;
      }

      function finishTrail() {
        state.finished = true;
        state.active = false;
        if (activeTimer) { clearInterval(activeTimer); activeTimer = null; }
        state.elapsed = Math.round((Date.now() - state.startedAt) / 1000);
        display.textContent = formatClock(state.elapsed);
        statusLabel.textContent = 'Trail complete in ' + state.elapsed + 's with ' + state.errors + ' error(s).';
        redraw();
        liveUpdate(item, canvas.toDataURL('image/png'), true);
        doneBtn.disabled = false;
        if (item.autoAdvance) recordAndAdvance();
      }

      var doneBtn = document.createElement('button');
      doneBtn.type = 'button';
      doneBtn.className = 'btn btn--primary btn--large';
      doneBtn.textContent = item.doneLabel || 'Finished';
      doneBtn.disabled = true;
      doneBtn.addEventListener('click', recordAndAdvance);
      frame.footer.appendChild(doneBtn);

      function recordAndAdvance() {
        if (!state.finished) return;
        saveResponse(item, {
          value: 'completed',
          elapsedSeconds: state.elapsed,
          errors: state.errors,
          drawingDataUrl: canvas.toDataURL('image/png'),
          points: item.examinerScored ? readExaminerPoints(frame)
            : (item.points || 0) * (state.errors === 0 ? 1 : 0)
        });
        advance();
      }

      function onDown(evt) {
        if (state.finished) return;
        evt.preventDefault();
        startTimer();
        state.active = true;
        var p = pointFromEvent(evt);
        lastPoint = p;
        freeformPoints.push(p);
        onMove(evt);
      }

      function onMove(evt) {
        if (!state.active || state.finished) return;
        evt.preventDefault();
        var p = pointFromEvent(evt);
        freeformPoints.push(p);
        lastPoint = p;

        var idx = hitIndex(evt.clientX, evt.clientY);
        if (idx === state.nextIndex) {
          wrongNode = null;
          state.nextIndex += 1;
          liveUpdate(item, canvas.toDataURL('image/png'));
          if (state.nextIndex >= nodes.length) finishTrail();
        } else if (idx !== -1 && idx < state.nextIndex) {
          wrongNode = null;
        } else if (idx !== -1) {
          if (wrongNode !== idx) {
            wrongNode = idx;
            state.hasError = true;
          }
        }
        redraw();
      }

      function onUp() {
        if (state.active && !state.finished) {
          if (state.nextIndex < nodes.length || state.hasError) {
            state.errors += 1;
            errorsLabel.textContent = 'Errors: ' + state.errors;
            state.nextIndex = 0;
            state.hasError = false;
            freeformPoints = [];
            redraw();
          }
        }
        state.active = false;
      }

      manualErrBtn.addEventListener('click', function () { addError('examiner-marked'); });
      canvas.addEventListener('pointerdown', onDown);
      canvas.addEventListener('pointermove', onMove);
      window.addEventListener('pointerup', onUp);

      statusLabel.textContent = nodes.length
        ? 'Start at ' + nodes[0].label + ' and draw to each target in order, finishing at ' +
          nodes[nodes.length - 1].label + ', without lifting the stylus.'
        : 'No trail targets configured for this item.';

      sizeCanvas();
      redraw();

      attachExaminerScoreIfNeeded(item, frame);
    }

    // ---- examiner clinical-judgement scoring (dropdown) ------------------

    function attachExaminerScoreIfNeeded(item, frame) {
      if (!item.examinerScored || (actor && actor.role === 'examinee')) return;
      var label = document.createElement('label');
      label.className = 'field examiner-score-field';
      var span = document.createElement('span');
      span.className = 'field__label';
      span.textContent = 'Examiner score (clinical judgement)';
      label.appendChild(span);
      var select = document.createElement('select');
      select.className = 'field__input examiner-score-select';
      for (var p = 0; p <= item.points; p++) {
        var option = document.createElement('option');
        option.value = String(p);
        option.textContent = p + (p === 1 ? ' point' : ' points');
        select.appendChild(option);
      }
      label.appendChild(select);
      frame.body.appendChild(label);
    }

    function readExaminerPoints(frame) {
      var select = frame.body.querySelector('.examiner-score-select');
      return select ? Number(select.value) : 0;
    }

    function withExaminerPoints(item, frame, record) {
      record.points = item.examinerScored ? readExaminerPoints(frame) : record.points;
      return record;
    }

    function promptExaminerPoints(item, callback) {
      // Used only by renderChoice for examiner-scored multiple-choice items
      // (rare — most examiner-scored items are text/drawing). Reuses the
      // same 0..max prompt pattern via a tiny inline dropdown dialog.
      AppDialogs.requestReason('Examiner score', 'Enter a score from 0 to ' + item.points + '.', function (value) {
        var n = Math.max(0, Math.min(item.points, Number(value) || 0));
        callback(n);
      });
    }

    // ---- pause (session-level, separate from per-item skip) -------------

    function pauseSession(reason) {
      paused = true;
      if (typeof DB.pauseSession === 'function') DB.pauseSession(actor, sessionId, reason);
      else DB.logPause(actor, sessionId, reason, 'pause');
    }

    function resumeSession() {
      paused = false;
      if (typeof DB.resumeSession === 'function') DB.resumeSession(actor, sessionId);
    }

    function finishTest() {
      // DB.getSession returns a Promise in both modes (see storage.js) —
      // chain on it so the auto-score is computed from the real saved
      // responses rather than from a promise object.
      DB.getSession(sessionId).then(function (session) {
        var responses = (session.responses && session.responses[testModule.key]) || {};
        var autoScore = 0;
        Object.keys(responses).forEach(function (key) {
          var r = responses[key];
          if (typeof r.points === 'number') autoScore += r.points;
        });
        onTestComplete({ testKey: testModule.key, rawScore: autoScore, responses: responses });
      });
    }

    return {
      pauseSession: pauseSession,
      resumeSession: resumeSession
    };
  }

  function formatClock(totalSeconds) {
    var m = Math.floor(totalSeconds / 60);
    var s = totalSeconds % 60;
    return (m < 10 ? '0' : '') + m + ':' + (s < 10 ? '0' : '') + s;
  }

  // Shared drawing pad — identical contract to the one used for the
  // consent signature, duplicated here (rather than imported) so this
  // file has no load-order dependency on app.js's consent-only copy.
  // options.onStroke(dataUrl) fires throttled (max ~1 snapshot/900ms)
  // while the participant draws, for the examiner's live view.
  function createDrawingPad(canvas, options) {
    var ctx = canvas.getContext('2d');
    var drawing = false;
    var touched = false;
    var last = null;
    var lastLivePush = 0;

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
      // Fire immediately on the first stroke so the elapsed timer and the
      // live view react to the very first contact, not the first throttled
      // move event.
      if (options && typeof options.onStroke === 'function') {
        var now = Date.now();
        if (now - lastLivePush > 900) {
          lastLivePush = now;
          options.onStroke(canvas.toDataURL('image/png'));
        }
      }
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
      if (options && typeof options.onStroke === 'function') {
        var now = Date.now();
        if (now - lastLivePush > 900) {
          lastLivePush = now;
          options.onStroke(canvas.toDataURL('image/png'));
        }
      }
    }
    function end(evt) { if (evt) evt.preventDefault(); drawing = false; }

    canvas.addEventListener('mousedown', start);
    canvas.addEventListener('mousemove', move);
    window.addEventListener('mouseup', end);
    canvas.addEventListener('touchstart', start, { passive: false });
    canvas.addEventListener('touchmove', move, { passive: false });
    canvas.addEventListener('touchend', end, { passive: false });

    return {
      hasDrawing: function () { return touched; },
      toDataUrl: function () { return canvas.toDataURL('image/png'); },
      ctx: ctx
    };
  }

  return {
    run: run,
    formatClock: formatClock,
    createDrawingPad: createDrawingPad
  };
})();
