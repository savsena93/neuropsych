/**
 * data/tmt-content.js
 * -----------------------------------------------------------------------
 * Official Trail Making Test Parts A & B (Iowa version, from the source
 * document), as INTERACTIVE trails (SRS): the participant draws node to
 * node in ascending order without lifting the stylus; connected nodes
 * colour differently; lifting early or touching a wrong node counts as
 * an error without stopping the clock. The clock starts at the first
 * touch and stops at the last node, exactly the "time the patient as
 * he or she connects the trail" rule.
 *
 * Each real part is preceded by a PRACTICE trail (the document's
 * "SAMPLE" sheets) that auto-advances on completion. Per the document:
 * point out errors immediately and let the participant correct them —
 * correction time counts; discontinue if both parts exceed five
 * minutes; results are reported as seconds to complete.
 *
 * Node coordinates are fractions of canvas width/height — editable if
 * you want to match the printed worksheet positions exactly. The scanned
 * worksheets from the source document are in assets/test-images/tmt/
 * for reference (verify which file is which via the contact sheet).
 */

var TMTContent = {
  name: 'Trail-Making Test (Parts A & B)',
  items: [
    {
      id: 'practice_a',
      section: 'Part A \u2014 Practice',
      type: 'trail',
      prompt: 'PRACTICE. Give the participant the stylus and demonstrate first: connect the numbered circles in ascending order (1-2-3\u2026) as quickly as possible, without lifting the stylus. Let them complete this sample trail themselves \u2014 it finishes automatically.',
      points: 0,
      examinerScored: false,
      autoAdvance: true,
      nodes: [
        { label: '1', xFrac: 0.15, yFrac: 0.20 },
        { label: '2', xFrac: 0.50, yFrac: 0.15 },
        { label: '3', xFrac: 0.80, yFrac: 0.30 },
        { label: '4', xFrac: 0.60, yFrac: 0.60 },
        { label: '5', xFrac: 0.25, yFrac: 0.50 },
        { label: '6', xFrac: 0.45, yFrac: 0.80 },
        { label: '7', xFrac: 0.15, yFrac: 0.85 },
        { label: '8', xFrac: 0.80, yFrac: 0.75 }
      ]
    },
    {
      id: 'part_a',
      section: 'Part A',
      type: 'trail',
      prompt: 'Part A \u2014 timed. Say: "Draw a line from 1 to 2, then 2 to 3, and so on, as quickly as possible, without lifting the pen from the paper. Begin here [point to 1] and end here [point to 25]." If the participant makes an error, point it out immediately and let them correct it \u2014 the correction is included in the completion time. The timer starts at their first touch.',
      points: 0,
      examinerScored: false,
      doneLabel: 'Finished Part A',
      nodes: [
        { label: '1', xFrac: 0.10, yFrac: 0.15 },
        { label: '2', xFrac: 0.55, yFrac: 0.08 },
        { label: '3', xFrac: 0.28, yFrac: 0.30 },
        { label: '4', xFrac: 0.75, yFrac: 0.18 },
        { label: '5', xFrac: 0.12, yFrac: 0.42 },
        { label: '6', xFrac: 0.45, yFrac: 0.38 },
        { label: '7', xFrac: 0.85, yFrac: 0.35 },
        { label: '8', xFrac: 0.22, yFrac: 0.62 },
        { label: '9', xFrac: 0.60, yFrac: 0.55 },
        { label: '10', xFrac: 0.90, yFrac: 0.60 },
        { label: '11', xFrac: 0.35, yFrac: 0.78 },
        { label: '12', xFrac: 0.05, yFrac: 0.80 },
        { label: '13', xFrac: 0.65, yFrac: 0.85 },
        { label: '14', xFrac: 0.48, yFrac: 0.70 },
        { label: '15', xFrac: 0.82, yFrac: 0.10 },
        { label: '16', xFrac: 0.70, yFrac: 0.75 },
        { label: '17', xFrac: 0.15, yFrac: 0.95 },
        { label: '18', xFrac: 0.95, yFrac: 0.90 },
        { label: '19', xFrac: 0.05, yFrac: 0.05 },
        { label: '20', xFrac: 0.40, yFrac: 0.92 },
        { label: '21', xFrac: 0.55, yFrac: 0.20 },
        { label: '22', xFrac: 0.92, yFrac: 0.45 },
        { label: '23', xFrac: 0.25, yFrac: 0.50 },
        { label: '24', xFrac: 0.60, yFrac: 0.35 },
        { label: '25', xFrac: 0.78, yFrac: 0.50 }
      ]
    },
    {
      id: 'practice_b',
      section: 'Part B \u2014 Practice',
      type: 'trail',
      prompt: 'PRACTICE. Demonstrate the alternation: connect the circles alternating number and letter in ascending order (1-A-2-B-3-C\u2026) as quickly as possible, without lifting the stylus. Let the participant complete this sample trail themselves \u2014 it finishes automatically.',
      points: 0,
      examinerScored: false,
      autoAdvance: true,
      nodes: [
        { label: '1', xFrac: 0.12, yFrac: 0.18 },
        { label: 'A', xFrac: 0.50, yFrac: 0.12 },
        { label: '2', xFrac: 0.30, yFrac: 0.35 },
        { label: 'B', xFrac: 0.78, yFrac: 0.28 },
        { label: '3', xFrac: 0.14, yFrac: 0.55 },
        { label: 'C', xFrac: 0.60, yFrac: 0.50 },
        { label: '4', xFrac: 0.88, yFrac: 0.55 },
        { label: 'D', xFrac: 0.40, yFrac: 0.78 },
        { label: '5', xFrac: 0.15, yFrac: 0.85 },
        { label: 'E', xFrac: 0.70, yFrac: 0.85 }
      ]
    },
    {
      id: 'part_b',
      section: 'Part B',
      type: 'trail',
      prompt: 'Part B \u2014 timed. Say: "Draw a line from 1 to A, then A to 2, then 2 to B, and so on, alternating number and letter, as quickly as possible, without lifting the pen from the paper. Begin here [point to 1] and end here [point to 13]." Point out errors immediately \u2014 corrections count in the time. Discontinue the test if Part A and Part B together exceed five minutes.',
      points: 0,
      examinerScored: false,
      doneLabel: 'Finished Part B',
      nodes: [
        { label: '1', xFrac: 0.08, yFrac: 0.12 },
        { label: 'A', xFrac: 0.50, yFrac: 0.10 },
        { label: '2', xFrac: 0.30, yFrac: 0.28 },
        { label: 'B', xFrac: 0.78, yFrac: 0.16 },
        { label: '3', xFrac: 0.12, yFrac: 0.38 },
        { label: 'C', xFrac: 0.62, yFrac: 0.32 },
        { label: '4', xFrac: 0.88, yFrac: 0.28 },
        { label: 'D', xFrac: 0.42, yFrac: 0.50 },
        { label: '5', xFrac: 0.18, yFrac: 0.58 },
        { label: 'E', xFrac: 0.72, yFrac: 0.52 },
        { label: '6', xFrac: 0.95, yFrac: 0.42 },
        { label: 'F', xFrac: 0.35, yFrac: 0.68 },
        { label: '7', xFrac: 0.08, yFrac: 0.78 },
        { label: 'G', xFrac: 0.60, yFrac: 0.72 },
        { label: '8', xFrac: 0.85, yFrac: 0.62 },
        { label: 'H', xFrac: 0.25, yFrac: 0.90 },
        { label: '9', xFrac: 0.50, yFrac: 0.85 },
        { label: 'I', xFrac: 0.95, yFrac: 0.82 },
        { label: '10', xFrac: 0.70, yFrac: 0.95 },
        { label: 'J', xFrac: 0.15, yFrac: 0.93 },
        { label: '11', xFrac: 0.70, yFrac: 0.42 },
        { label: 'K', xFrac: 0.22, yFrac: 0.78 },
        { label: '12', xFrac: 0.52, yFrac: 0.65 },
        { label: 'L', xFrac: 0.80, yFrac: 0.78 },
        { label: '13', xFrac: 0.93, yFrac: 0.05 }
      ]
    }
  ]
};
