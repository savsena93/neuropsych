/**
 * js/tests/rey.js
 * -----------------------------------------------------------------------
 * SCORING LOGIC for the three-phase Rey Complex Figure Test. Reads the
 * examiner-entered 18-element Osterrieth totals (0-36 per phase) from
 * the copy_scoring / immediate_scoring / delayed_scoring items, and
 * reports all three phases plus a retention ratio (delayed / copy),
 * which is a protocol-independent index of visual memory retention
 * relative to the participant's own copying accuracy.
 */

window.Tests = window.Tests || {};

window.Tests.Rey = (function () {
  'use strict';

  var MAX = 36;

  function phaseScore(responses, id) {
    var r = responses[id];
    if (!r || r.skipped) return null;
    return typeof r.points === 'number' ? Math.max(0, Math.min(MAX, r.points)) : null;
  }

  function score(responses) {
    var copyScore = phaseScore(responses, 'copy_scoring');
    var immediateScore = phaseScore(responses, 'immediate_scoring');
    var delayedScore = phaseScore(responses, 'delayed_scoring');

    var retentionRatio = (copyScore && copyScore > 0 && delayedScore !== null)
      ? Math.round((delayedScore / copyScore) * 100)
      : null;

    return {
      testKey: 'Rey',
      raw: copyScore,
      max: MAX,
      copyScore: copyScore,
      copyMax: MAX,
      immediateRecallScore: immediateScore,
      delayedRecallScore: delayedScore,
      delayedRecallMax: MAX,
      retentionRatio: retentionRatio,
      interpretation: interpret(copyScore, immediateScore, delayedScore, retentionRatio)
    };
  }

  function interpret(copyScore, immediateScore, delayedScore, retentionRatio) {
    var parts = [];
    if (copyScore === null) {
      return 'Copy phase not scored \u2014 no interpretation available.';
    }
    parts.push('Copy (18-element Osterrieth key): ' + copyScore + '/' + MAX + '.');
    if (immediateScore !== null) parts.push('Immediate recall: ' + immediateScore + '/' + MAX + '.');
    if (delayedScore !== null) parts.push('Delayed recall: ' + delayedScore + '/' + MAX + '.');
    if (retentionRatio !== null) parts.push('Retention (delayed / copy): ' + retentionRatio + '%.');
    if (copyScore < MAX * 0.5) {
      parts.push('Copy accuracy is low \u2014 interpret recall scores alongside it: poor copy plus proportionate recall suggests a constructional rather than a memory-specific difficulty.');
    }
    parts.push('Compare against your scoring manual\u2019s normative data (age-adjusted) before drawing conclusions.');
    return parts.join(' ');
  }

  return {
    key: 'Rey',
    name: ReyContent.name,
    items: ReyContent.items,
    score: score,
    interpret: interpret
  };
})();
