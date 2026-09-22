/**
 * data/bsi18-content.js
 * -----------------------------------------------------------------------
 * Official BSI-18 item content (Derogatis). The 18 statements and the
 * 0-4 "Not at all ... Extremely" anchors are administered for the past
 * 7 days, exactly as on the paper form. This is a SELF-REPORT measure:
 * the participant reads each statement and taps the distress level that
 * applies — nothing here is examinerOnly.
 *
 * Subscale key (interleaved across the 18 items, per the published
 * instrument — the even-numbered items were verified against the
 * scanned form in assets/test-images/bsi/image1.png):
 *   Somatization : 1, 4, 7, 10, 13, 16
 *   Depression   : 2, 5, 8, 11, 14, 17
 *   Anxiety      : 3, 6, 9, 12, 15, 18
 * js/tests/bsi18.js reads each item's `subscale` field for scoring —
 * do not change those without updating the scoring file too.
 */

var BSI18_SCALE_LABELS = ['Not at all', 'A little bit', 'Moderately', 'Quite a bit', 'Extremely'];

var BSI18_ITEMS = [
  { n: 1,  subscale: 'Somatization', text: 'Faintness or dizziness' },
  { n: 2,  subscale: 'Depression',   text: 'Feeling no interest in things' },
  { n: 3,  subscale: 'Anxiety',      text: 'Nervousness or shakiness inside' },
  { n: 4,  subscale: 'Somatization', text: 'Pains in heart or chest' },
  { n: 5,  subscale: 'Depression',   text: 'Feeling lonely' },
  { n: 6,  subscale: 'Anxiety',      text: 'Feeling tense or keyed up' },
  { n: 7,  subscale: 'Somatization', text: 'Nausea or upset stomach' },
  { n: 8,  subscale: 'Depression',   text: 'Feeling blue' },
  { n: 9,  subscale: 'Anxiety',      text: 'Suddenly scared for no reason' },
  { n: 10, subscale: 'Somatization', text: 'Trouble getting your breath' },
  { n: 11, subscale: 'Depression',   text: 'Feeling worthless' },
  { n: 12, subscale: 'Anxiety',      text: 'Spells of terror or panic' },
  { n: 13, subscale: 'Somatization', text: 'Numbness or tingling in parts of your body' },
  { n: 14, subscale: 'Depression',   text: 'Feeling hopeless about the future' },
  { n: 15, subscale: 'Anxiety',      text: 'Feeling so restless you couldn\u2019t sit still' },
  { n: 16, subscale: 'Somatization', text: 'Feeling weak in parts of your body' },
  { n: 17, subscale: 'Depression',   text: 'Thoughts of death or dying' },
  { n: 18, subscale: 'Anxiety',      text: 'Feeling fearful' }
];

var BSI18Content = {
  name: 'BSI-18 (Brief Symptom Inventory \u2014 18)',
  scaleLabels: BSI18_SCALE_LABELS,
  instruction: 'Below is a list of problems people sometimes have. Read each one and tap how much it distressed you during the PAST 7 DAYS, including today.',
  items: BSI18_ITEMS.map(function (entry) {
    return {
      id: 'item_' + entry.n,
      section: entry.subscale,
      subscale: entry.subscale,
      type: 'scale5',
      prompt: entry.n + '. ' + entry.text + ' \u2014 during the past 7 days, how much were you distressed by this?',
      scaleLabels: BSI18_SCALE_LABELS,
      points: 4,
      examinerScored: false
    };
  })
};
