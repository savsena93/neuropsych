/**
 * js/tests/bsi18.js
 * -----------------------------------------------------------------------
 * SCORING LOGIC for the official BSI-18. Produces:
 *   - the three subscale raw totals (Somatization / Depression / Anxiety,
 *     each 0-24, from each item's `subscale` field)
 *   - the total distress score (0-72)
 *   - GSI: the mean item score (total / 18, 0-4)
 *   - PST: the count of items endorsed above zero
 * Interpretation intentionally reports raw values only and defers to the
 * clinician — published BSI-18 interpretation uses T-score norms by
 * sex/age that must be applied by the interpreting professional, per the
 * instrument's guidelines.
 */

window.Tests = window.Tests || {};

window.Tests.BSI18 = (function () {
  'use strict';

  function score(responses) {
    var items = BSI18Content.items;
    var total = 0;
    var subtotals = { Somatization: 0, Depression: 0, Anxiety: 0 };
    var endorsed = 0;

    items.forEach(function (item) {
      var r = responses[item.id];
      var value = (r && !r.skipped && typeof r.value === 'number') ? r.value : 0;
      total += value;
      subtotals[item.subscale] = (subtotals[item.subscale] || 0) + value;
      if (value > 0) endorsed += 1;
    });

    return {
      testKey: 'BSI18',
      raw: total,
      max: items.length * 4,
      subtotals: subtotals,
      gsi: Math.round((total / items.length) * 100) / 100,
      pst: endorsed,
      interpretation: interpret(total, subtotals, endorsed)
    };
  }

  function interpret(total, subtotals, endorsed) {
    var notes = Object.keys(subtotals).map(function (name) {
      return name + ': ' + subtotals[name] + '/24';
    }).join(', ');
    return 'Total distress ' + total + '/72; GSI ' + (Math.round((total / 18) * 100) / 100) +
      '; positive symptoms (PST) ' + endorsed + '/18. Subscale raw totals \u2014 ' + notes +
      '. Raw scores only: published BSI-18 interpretation applies T-score norms (by sex/age) and must be done by the interpreting clinician.';
  }

  return {
    key: 'BSI18',
    name: BSI18Content.name,
    items: BSI18Content.items,
    score: score,
    interpret: interpret
  };
})();
