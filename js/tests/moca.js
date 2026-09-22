/**
 * js/tests/moca.js
 * -----------------------------------------------------------------------
 * SCORING LOGIC for the official MoCA v8.1 content in
 * data/tests/moca-content.js. Rules implemented (from the MoCA administration
 * and scoring instructions in the source document):
 *
 *   - Straight item-point sums for examiner-scored items.
 *   - Verbal fluency: 1 pt if >= 11 words in 60 seconds.
 *   - Vigilance: recorded as a tally of ERRORS (wrong taps + missed A's);
 *     0-1 errors = 1 pt, 2 or more = 0.
 *   - MIS (Memory Index Score): words recalled with a category cue count
 *     2 pts each, with a multiple-choice cue 1 pt each, max 15 \u2014 a
 *     SUB-SCORE reported separately, never added to the /30 total.
 *   - Education bonus: +1 pt if the participant has <= 12 years of formal
 *     education (from intake), capped at 30.
 *   - Screening cutoff: 26 and above is considered normal (MoCA).
 */

window.Tests = window.Tests || {};

window.Tests.MoCA = (function () {
  'use strict';

  function score(responses, context) {
    var items = MoCAContent.items;
    var total = 0;
    var maxPossible = 0;
    var misCategory = 0;
    var misMultiple = 0;

    items.forEach(function (item) {
      if (item.points <= 0) return;
      var r = responses[item.id];

      // MIS items are a sub-score only \u2014 excluded from the /30 total.
      if (item.id === 'mis_category' || item.id === 'mis_multiple') {
        if (r && !r.skipped && typeof r.value === 'number') {
          if (item.id === 'mis_category') misCategory = Math.min(r.value, 5);
          else misMultiple = Math.min(r.value, 5);
        }
        return;
      }

      maxPossible += item.points;
      if (!r || r.skipped) return;

      if (item.id === 'language_fluency') {
        total += (typeof r.value === 'number' && r.value >= 11) ? 1 : 0;
      } else if (item.id === 'attention_vigilance') {
        // Tally of errors: 0-1 errors scores 1 point, 2 or more scores 0.
        var errors = (typeof r.value === 'number') ? r.value : 2;
        total += (errors <= 1) ? 1 : 0;
      } else {
        total += (typeof r.points === 'number') ? r.points : 0;
      }
    });

    var education = context && context.participant ? Number(context.participant.education) : null;
    var bonusApplied = false;
    if (education !== null && !isNaN(education) && education <= 12 && total < maxPossible) {
      total += 1;
      bonusApplied = true;
    }
    total = Math.min(total, maxPossible);

    var mis = misCategory * 2 + misMultiple; // 0-15

    return {
      testKey: 'MoCA',
      raw: total,
      max: maxPossible,
      educationBonusApplied: bonusApplied,
      mis: { categoryCued: misCategory, multipleChoiceCued: misMultiple, total: mis, max: 15 },
      interpretation: interpret(total, mis, bonusApplied)
    };
  }

  function interpret(total, mis, bonusApplied) {
    var notes = [];
    notes.push(bonusApplied ? 'Education bonus (+1, <= 12 years of formal education) applied.' : '');
    notes.push(typeof mis === 'number' ? 'Memory Index Score: ' + mis + '/15 (category-cue recalls x2, multiple-choice x1).' : '');
    var note = notes.filter(Boolean).join(' ');
    if (total >= 26) {
      return 'Total ' + total + '/30 \u2014 at or above the MoCA screening cutoff (26): within the normal screening range. ' + note;
    }
    return 'Total ' + total + '/30 \u2014 below the MoCA screening cutoff (26): screen positive for possible cognitive impairment; interpret with the scoring manual and clinical follow-up. ' + note;
  }

  return {
    key: 'MoCA',
    name: MoCAContent.name,
    items: MoCAContent.items,
    score: score,
    interpret: interpret
  };
})();
