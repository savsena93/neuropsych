/**
 * data/rey-content.js
 * -----------------------------------------------------------------------
 * Rey-Osterrieth Complex Figure Test, three phases per the project SRS:
 *
 *   1. COPY     — the figure is shown; the participant copies it. No
 *                 countdown (SRS): they start drawing only when confident,
 *                 and the elapsed clock starts at their FIRST stroke.
 *                 Nothing in this phase hints that recall phases follow.
 *   2. IMMEDIATE — after a 3-minute gate (figure and copy out of view),
 *                 reproduce from memory with no cues.
 *   3. DELAYED  — after a further 3-minute gate, draw it again from
 *                 memory.
 *
 * The figure is shown ONLY in the copy phase (stimulusImage below).
 *
 * SCORING: after each phase the examiner scores that drawing with the
 * standard 18-element Osterrieth key, 0/0.5/1/2 per element, total 0-36
 * per phase:
 *   2   = correctly placed AND accurately drawn
 *   1   = accurate but poorly placed, OR distorted but correctly placed
 *   0.5 = distorted AND poorly placed
 *   0   = absent or unrecognizable
 * The *_scoring items below carry the element list in their prompt;
 * the examiner enters the per-phase total (0-36) in the examiner-score
 * dropdown and may record element-by-element notes in the text box.
 * Element names follow the standard Osterrieth 18-element key — verify
 * the numbering against your scoring manual's figure before clinical
 * use.
 *
 * IMAGE: stimulusImage points at the figure extracted from the source
 * document (assets/test-images/rey/image1.jpg). VERIFY via
 * assets/test-images/contact-sheet.html that image1.jpg is the actual
 * complex figure and not one of the automated-scoring paper's element
 * diagrams — the folder holds all 19 extracted images; if the mapping is
 * wrong, correct the path below.
 */

var REY_SCORING_KEY_PROMPT = (
  'Score this drawing with the 18-element Osterrieth key \u2014 2 pts: correctly placed AND accurate; ' +
  '1 pt: accurate but poorly placed OR distorted but correctly placed; 0.5 pt: distorted AND poorly ' +
  'placed; 0: absent or unrecognizable. Elements: ' +
  '(1) cross at the upper left; ' +
  '(2) large rectangle; ' +
  '(3) the two diagonals of the rectangle; ' +
  '(4) horizontal midline of the rectangle (lower half); ' +
  '(5) vertical midline of the rectangle (continuing into the extension); ' +
  '(6) the extension of the rectangle at the lower left; ' +
  '(7) small rectangle attached at the bottom of the extension; ' +
  '(8) two short parallel lines to the right of the extension, below the rectangle; ' +
  '(9) triangle attached to the rectangle\u2019s left edge (pointing left); ' +
  '(10) left short vertical tick below the rectangle\u2019s bottom edge; ' +
  '(11) middle short vertical tick below the bottom edge; ' +
  '(12) right short vertical tick below the bottom edge; ' +
  '(13) four-line star/asterisk above the rectangle; ' +
  '(14) the diamond (rhombus) at the right of the rectangle\u2019s midline; ' +
  '(15) horizontal line joining the rectangle to the diamond; ' +
  '(16) curved "flame" below and right of the diamond; ' +
  '(17) two parallel vertical lines below the right half of the rectangle; ' +
  '(18) small square at the bottom right, connected to the flame. ' +
  'Enter the total (0-36) in the examiner score dropdown; use the text box for optional element-by-element notes.'
);

var ReyContent = {
  name: 'Rey Complex Figure Test (copy / immediate / delayed)',
  items: [
    // ---- Copy: figure shown, no countdown -------------------------------
    {
      id: 'copy',
      section: 'Copy phase',
      type: 'drawing',
      prompt: 'Show the figure below and say: "Copy this drawing as accurately as you can." There is no time limit and no countdown \u2014 the participant studies the figure and starts drawing only when they are confident. The clock starts at their first stroke.',
      stimulusImage: 'assets/test-images/rey/image1.jpg',
      stimulusImageAlt: 'Rey-Osterrieth complex figure',
      points: 0,
      examinerScored: false,
      showsTimer: true,
      doneLabel: 'Copy complete'
    },
    {
      id: 'copy_scoring',
      section: 'Copy phase \u2014 scoring',
      type: 'text',
      examinerOnly: true,
      prompt: REY_SCORING_KEY_PROMPT,
      points: 36,
      examinerScored: true,
      allowSkip: false
    },

    // ---- 3-minute gate before immediate recall -----------------------------
    {
      id: 'delay_gate_1',
      section: 'Interval',
      type: 'countdownGate',
      examinerOnly: true,
      prompt: '3-minute interval. Keep BOTH the original figure and the participant\u2019s copy out of view. Do not tell the participant that a recall task is coming \u2014 fill the time with neutral conversation (the SRS requires no hint between phases).',
      timerSeconds: 180,
      points: 0,
      allowSkip: true
    },

    // ---- Immediate recall: figure not shown ------------------------------
    {
      id: 'immediate_recall',
      section: 'Immediate recall',
      type: 'drawing',
      prompt: 'Without showing the figure again, say: "Draw as much of the figure as you can remember." No cues of any kind. The clock starts at the first stroke.',
      points: 0,
      examinerScored: false,
      showsTimer: true,
      doneLabel: 'Recall complete'
    },
    {
      id: 'immediate_scoring',
      section: 'Immediate recall \u2014 scoring',
      type: 'text',
      examinerOnly: true,
      prompt: REY_SCORING_KEY_PROMPT,
      points: 36,
      examinerScored: true,
      allowSkip: false
    },

    // ---- second 3-minute gate before delayed recall ---------------------------
    {
      id: 'delay_gate_2',
      section: 'Interval',
      type: 'countdownGate',
      examinerOnly: true,
      prompt: 'A further 3-minute interval. Keep the figure, the copy, and the immediate-recall drawing all out of view.',
      timerSeconds: 180,
      points: 0,
      allowSkip: true
    },

    // ---- Phase 3: delayed recall (figure NOT shown) ----------------------------
    {
      id: 'delayed_recall',
      section: 'Delayed recall',
      type: 'drawing',
      prompt: 'Say: "Draw the figure again, as much of it as you can remember." No cues. The clock starts at the first stroke.',
      points: 0,
      examinerScored: false,
      showsTimer: true,
      doneLabel: 'Recall complete'
    },
    {
      id: 'delayed_scoring',
      section: 'Delayed recall \u2014 scoring',
      type: 'text',
      examinerOnly: true,
      prompt: REY_SCORING_KEY_PROMPT,
      points: 36,
      examinerScored: true,
      allowSkip: false
    }
  ]
};
