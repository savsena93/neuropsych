/**
 * js/tests/tmt.js
 * -----------------------------------------------------------------------
 * SCORING LOGIC. TMT is a timed test, not a point-scored one — the
 * outcome is completion time (seconds) and error count per part. There
 * is no universal pass/fail cutoff; normative comparisons depend heavily
 * on age and education. `interpretation` below is a generic placeholder
 * only — replace with a real normative lookup table if you have one.
 */

window.Tests = window.Tests || {};

window.Tests.TMT = (function () {
  'use strict';

  function partResult(response) {
    if (!response || response.skipped) return { completed: false, timeSeconds: null, errors: null };
    return {
      completed: true,
      timeSeconds: typeof response.elapsedSeconds === 'number' ? response.elapsedSeconds : null,
      errors: typeof response.errors === 'number' ? response.errors : 0
    };
  }

  function score(responses) {
    var a = partResult(responses.part_a);
    var b = partResult(responses.part_b);
    return {
      testKey: 'TMT',
      raw: b.timeSeconds,
      max: null,
      partA: a,
      partB: b,
      bMinusA: (a.timeSeconds !== null && b.timeSeconds !== null) ? (b.timeSeconds - a.timeSeconds) : null,
      interpretation: interpret(a, b)
    };
  }

  function interpret(a, b) {
    if (!a.completed || !b.completed) {
      return 'One or both parts were skipped \u2014 no interpretation available.';
    }
    var notes = [];
    notes.push('Part A: ' + a.timeSeconds + 's, ' + a.errors + ' error(s).');
    notes.push('Part B: ' + b.timeSeconds + 's, ' + b.errors + ' error(s).');
    // Rule-of-thumb reference points from the source TMT document
    // (Corrigan & Hinkeldey norms summary): Trail A average 29s /
    // deficient > 78s; Trail B average 75s / deficient > 273s. Age and
    // education norms should still be applied for a real interpretation.
    if (a.timeSeconds > 78) {
      notes.push('Part A is above the "> 78s" rule-of-thumb deficient threshold.');
    } else if (a.timeSeconds > 29) {
      notes.push('Part A is slower than the 29s average but below the > 78s deficient threshold.');
    } else {
      notes.push('Part A is at or faster than the 29s average.');
    }
    if (b.timeSeconds > 273) {
      notes.push('Part B is above the "> 273s" rule-of-thumb deficient threshold.');
    } else if (b.timeSeconds > 75) {
      notes.push('Part B is slower than the 75s average but below the > 273s deficient threshold.');
    } else {
      notes.push('Part B is at or faster than the 75s average.');
    }
    notes.push('Rule-of-thumb thresholds only \u2014 compare against age/education-adjusted normative data before drawing any conclusion.');
    return notes.join(' ');
  }

  return {
    key: 'TMT',
    name: TMTContent.name,
    items: TMTContent.items,
    score: score,
    interpret: interpret
  };
})();
