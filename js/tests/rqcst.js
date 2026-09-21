/**
 * js/tests/rqcst.js
 * -----------------------------------------------------------------------
 * SCORING LOGIC for the RQCST (Mate-Kole et al., 2009), matching the
 * "Summary of Scores" page of the printed form:
 *
 *   Orientation            items 1-12                         /12
 *   Verbal                 items 13, 15, 17, 20-24, 25-29,
 *                          30-33, 34-37, 49, 50               /44
 *   Visual / Spatial       items 14, 16, 18, 19, 38-42,
 *                          43-47, 48                          /34
 *   GLOBAL                 all of the above                   /90
 *
 * Special conversions:
 *   - Item 50 (new learning) is recorded as a TRIAL TALLY: exact on
 *     trial n scores 11-n points (trial 1 = 10 ... trial 10 = 1);
 *     more than 10 trials or never exact = 0.
 *   - Item 13 scoring (all correct = 2 / one error = 1 / two or more = 0)
 *     is applied by the examiner via the 0-2 score dropdown.
 */

window.Tests = window.Tests || {};

window.Tests.RQCST = (function () {
  'use strict';

  var ORIENTATION_IDS = ['orientation_1', 'orientation_2', 'orientation_3', 'orientation_4', 'orientation_5',
    'orientation_6', 'orientation_7', 'orientation_8', 'orientation_9', 'orientation_10',
    'orientation_11', 'orientation_12'];

  var VERBAL_IDS = ['attention_verbal_13', 'memory_immediate_verbal_15', 'arithmetic_17',
    'vocabulary_20', 'vocabulary_21', 'vocabulary_22', 'vocabulary_23', 'vocabulary_24',
    'naming_25', 'naming_26', 'naming_27', 'naming_28', 'naming_29',
    'similarities_30', 'similarities_31', 'similarities_32', 'similarities_33',
    'analogies_34', 'analogies_35', 'analogies_36', 'analogies_37',
    'delayed_recall_verbal_49', 'new_learning_50'];

  var VISUAL_IDS = ['attention_visual_14', 'spatial_neglect_16', 'constructional_praxis_18',
    'memory_immediate_visual_19', 'unusual_views_38', 'unusual_views_39', 'unusual_views_40',
    'unusual_views_41', 'unusual_views_42', 'spatial_orientation_43', 'spatial_orientation_44',
    'spatial_orientation_45', 'spatial_orientation_46', 'spatial_orientation_47',
    'delayed_recall_visual_48'];

  function itemPoints(responses, id) {
    var r = responses[id];
    if (!r || r.skipped) return 0;
    return (typeof r.points === 'number') ? r.points : 0;
  }

  function score(responses) {
    var orientationTotal = 0;
    var verbalTotal = 0;
    var visualTotal = 0;

    ORIENTATION_IDS.forEach(function (id) { orientationTotal += itemPoints(responses, id); });

    VERBAL_IDS.forEach(function (id) {
      if (id === 'new_learning_50') {
        // Trial-tally conversion: exact on trial n = 11 - n points,
        // capped at 10; > 10 trials or never exact = 0. The engine's
        // stored points for a tally are min(count, points), which is
        // NOT this rule, so the points are recomputed from the value.
        var r = responses.new_learning_50;
        if (r && !r.skipped && typeof r.value === 'number') {
          verbalTotal += r.value >= 1 && r.value <= 10 ? (11 - r.value) : 0;
        }
        return;
      }
      verbalTotal += itemPoints(responses, id);
    });

    VISUAL_IDS.forEach(function (id) { visualTotal += itemPoints(responses, id); });

    var globalTotal = orientationTotal + verbalTotal + visualTotal;

    return {
      testKey: 'RQCST',
      raw: globalTotal,
      max: 90,
      orientationScore: { raw: orientationTotal, max: 12 },
      verbalScore: { raw: verbalTotal, max: 44 },
      visualSpatialScore: { raw: visualTotal, max: 34 },
      globalScore: { raw: globalTotal, max: 90 },
      interpretation: interpret(orientationTotal, verbalTotal, visualTotal, globalTotal)
    };
  }

  function interpret(orientationTotal, verbalTotal, visualTotal, globalTotal) {
    return 'Summary of scores \u2014 Orientation: ' + orientationTotal + '/12; Verbal: ' +
      verbalTotal + '/44; Visual/Spatial: ' + visualTotal + '/34; GLOBAL: ' + globalTotal +
      '/90. Compare against the RQCST validation paper\u2019s normative data (Mate-Kole et al., 2009) before drawing conclusions.';
  }

  return {
    key: 'RQCST',
    name: RQCSTContent.name,
    items: RQCSTContent.items,
    score: score,
    interpret: interpret
  };
})();
