/**
 * data/rqcst-content.js
 * -----------------------------------------------------------------------
 * Revised Quick Cognitive Screening Test (RQCST; Mate-Kole et al., 2009)
 * — all 50 items transcribed from the source test form. Structure and
 * points follow the printed sheet exactly:
 *
 *   ORIENTATION (1-12)            /12
 *   ATTENTION/CONCENTRATION VERBAL, item 13 (count by 3s)      /2
 *   ATTENTION/CONCENTRATION VISUAL, item 14 (count dots)       /2
 *   MEMORY: IMMEDIATE RECALL VERBAL, item 15 (pen, watch, tie,
 *     car, book)                                               /5
 *   SPATIAL NEGLECT, item 16 (mark the middle of each line)   /4
 *   ARITHMETIC, item 17 (113+113, 65-56, 20x3, 144/12)        /4
 *   CONSTRUCTIONAL PRAXIS, item 18 (copy figures)             /6
 *   MEMORY: IMMEDIATE RECALL VISUAL, item 19 (draw again)      /6
 *   VOCABULARY, items 20-24 (synonyms, auto-scored)            /5
 *   NAMING, items 25-29                                         /5
 *   SIMILARITIES, items 30-33 (auto-scored)                    /4
 *   ANALOGIES, items 34-37 (auto-scored)                       /4
 *   UNUSUAL VIEWS, items 38-42                                  /5
 *   SPATIAL ORIENTATION, items 43-47                            /5
 *   MEMORY: DELAYED RECALL VISUAL, item 48                      /6
 *   MEMORY: DELAYED RECALL VERBAL, item 49                      /5
 *   MEMORY: NEW LEARNING, item 50 (sentence, up to 10 trials;  /10
 *     trial 1 = 10 pts ... trial 10 = 1 pt, > 10 or never = 0)
 *
 * Summary scores (js/tests/rqcst.js): Verbal /44, Visual/Spatial /34,
 * Orientation /12, GLOBAL /90.
 *
 * SRS RULES APPLIED: verbal items (spoken by the examiner) are
 * `examinerOnly` — the examinee sees only the domain label. Visual items
 * the examinee must see (dots, figures, choice grids) show normally.
 *
 * IMAGES: item 14 uses the two dot-counting images, item 18 uses the
 * constructional-praxis sheet, items 25-29 use isolated crops from the
 * naming composite, and items 38-42 use the five single-object images
 * that follow the naming composite in the source document. The spatial
 * orientation designs remain grouped source material and are not mapped
 * until each five-choice row is isolated and verified.
 */

var RQCSTContent = {
  name: 'RQCST (Revised Quick Cognitive Screening Test)',
  items: [
    // ---- ORIENTATION (items 1-12, 1 pt each) -------------------------------
    { id: 'orientation_1',  section: 'Orientation', type: 'passfail', examinerOnly: true, prompt: '1. Ask: "What time of day is it?"', points: 1, examinerScored: true },
    { id: 'orientation_2',  section: 'Orientation', type: 'passfail', examinerOnly: true, prompt: '2. Ask: "What day of the week is this?"', points: 1, examinerScored: true },
    { id: 'orientation_3',  section: 'Orientation', type: 'passfail', examinerOnly: true, prompt: '3. Ask: "What month is this?"', points: 1, examinerScored: true },
    { id: 'orientation_4',  section: 'Orientation', type: 'passfail', examinerOnly: true, prompt: '4. Ask: "What date of the month is this?"', points: 1, examinerScored: true },
    { id: 'orientation_5',  section: 'Orientation', type: 'passfail', examinerOnly: true, prompt: '5. Ask: "What year is this?"', points: 1, examinerScored: true },
    { id: 'orientation_6',  section: 'Orientation', type: 'passfail', examinerOnly: true, prompt: '6. Ask: "Where are you now?"', points: 1, examinerScored: true },
    { id: 'orientation_7',  section: 'Orientation', type: 'passfail', examinerOnly: true, prompt: '7. Ask: "What is your age?"', points: 1, examinerScored: true },
    { id: 'orientation_8',  section: 'Orientation', type: 'passfail', examinerOnly: true, prompt: '8. Ask: "What is your date of birth?"', points: 1, examinerScored: true },
    { id: 'orientation_9',  section: 'Orientation', type: 'passfail', examinerOnly: true, prompt: '9. Ask: "What is the name of the President?"', points: 1, examinerScored: true },
    { id: 'orientation_10', section: 'Orientation', type: 'passfail', examinerOnly: true, prompt: '10. Ask: "Who was the President before him/her?"', points: 1, examinerScored: true },
    { id: 'orientation_11', section: 'Orientation', type: 'passfail', examinerOnly: true, prompt: '11. Say: "Write or say all the days of the week." (1 pt only if all seven are given.)', points: 1, examinerScored: true },
    { id: 'orientation_12', section: 'Orientation', type: 'passfail', examinerOnly: true, prompt: '12. Say: "Write or say your full address." (1 pt only if complete and correct.)', points: 1, examinerScored: true },

    // ---- 13. ATTENTION / CONCENTRATION (VERBAL) — /2 ------------------------
    {
      id: 'attention_verbal_13',
      section: 'Attention / Concentration (Verbal)',
      type: 'text',
      examinerOnly: true,
      prompt: '13. Say: "I want to see how quickly you can count by threes, beginning with one, like this: 1, 4, 7, etc." The participant continues the series up to 40 (1, 4, 7, 10, 13, 16, 19, 22, 25, 28, 31, 34, 37, 40). Record the sequence given; circle the errors. Scoring: all correct = 2 pts, one error = 1 pt, two or more errors = 0.',
      points: 2,
      examinerScored: true
    },

    // ---- 14. ATTENTION / CONCENTRATION (VISUAL) — /2 -------------------------
    {
      id: 'attention_visual_14',
      section: 'Attention / Concentration (Visual)',
      type: 'text',
      prompt: '14. Say: "How many dots are there in each set shown?" Record both counts (one per line: first set, second set). 1 pt per correct count.',
      stimulusImages: ['assets/test-images/rqcst/image1.jpg', 'assets/test-images/rqcst/image2.jpg'],
      stimulusImageAlt: 'RQCST dot-counting stimulus set',
      points: 2,
      examinerScored: true
    },

    // ---- 15. MEMORY: IMMEDIATE RECALL (VERBAL) — /5 ---------------------------
    {
      id: 'memory_immediate_verbal_15',
      section: 'Memory: Immediate Recall (Verbal)',
      type: 'tally',
      examinerOnly: true,
      prompt: '15. Say: "I am going to name some objects. When I am finished I want you to say them back to me." Read slowly: PEN \u2014 WATCH \u2014 TIE \u2014 CAR \u2014 BOOK. Tally each object repeated back correctly, then add: "I want you to remember these words because I will ask you to repeat them back to me later." Each correctly recalled object is worth 1 pt automatically.',
      points: 5,
      examinerScored: false
    },

    // ---- 16. SPATIAL NEGLECT — /4 (lines drawn programmatically) --------------
    {
      id: 'spatial_neglect_16',
      section: 'Spatial Neglect',
      type: 'drawing',
      prompt: '16. Say: "Make a stroke through the middle of each line." 1 pt per correctly marked line \u2014 score 0-4 below.',
      points: 4,
      examinerScored: true,
      showsTimer: false,
      doneLabel: 'Done',
      background: function (ctx, canvas) {
        var rect = canvas.getBoundingClientRect();
        ctx.lineWidth = 2.5;
        ctx.strokeStyle = '#1B2124';
        // Four lines: two at the far edges, two near the centre \u2014 the
        // classic distribution for detecting left/right neglect.
        [[0.02, 0.14, 0.30], [0.42, 0.58, 0.30], [0.42, 0.58, 0.70], [0.86, 0.98, 0.70]].forEach(function (l) {
          ctx.beginPath();
          ctx.moveTo(l[0] * rect.width, l[2] * rect.height);
          ctx.lineTo(l[1] * rect.width, l[2] * rect.height);
          ctx.stroke();
        });
      }
    },

    // ---- 17. ARITHMETIC — /4 -----------------------------------------------------
    {
      id: 'arithmetic_17',
      section: 'Arithmetic',
      type: 'text',
      prompt: '17. Say: "Do these arithmetic problems." Record all four answers, one per line: (a) 113 + 113 = ___   (b) 65 \u2212 56 = ___   (c) 20 \u00d7 3 = ___   (d) 144 \u00f7 12 = ___. 1 pt per correct answer.',
      points: 4,
      examinerScored: true
    },

    // ---- 18. CONSTRUCTIONAL PRAXIS — /6 ------------------------------------------
    {
      id: 'constructional_praxis_18',
      section: 'Constructional Praxis',
      type: 'drawing',
      prompt: '18. Say: "Copy this drawing." Scoring: 1 pt per figure, plus 1 pt per correct placement of each figure (max 6) \u2014 score 0-6 below.',
      stimulusImage: 'assets/test-images/rqcst/image15.jpg',
      stimulusImageAlt: 'RQCST constructional praxis figures (VERIFY this mapping via the contact sheet)',
      points: 6,
      examinerScored: true,
      showsTimer: false,
      doneLabel: 'Copy complete'
    },

    // ---- 19. MEMORY: IMMEDIATE RECALL (VISUAL) — /6 --------------------------------
    {
      id: 'memory_immediate_visual_19',
      section: 'Memory: Immediate Recall (Visual)',
      type: 'drawing',
      prompt: '19. Hide the original figures and the participant\u2019s copy, then say: "Draw the same figures again." Scoring: 1 pt per figure plus 1 pt per correct placement (max 6).',
      points: 6,
      examinerScored: true,
      showsTimer: false,
      doneLabel: 'Done'
    },

    // ---- 20-24. VOCABULARY — auto-scored, 1 pt each ---------------------------------
    {
      id: 'vocabulary_20', section: 'Vocabulary', type: 'choice', points: 1, examinerScored: false,
      prompt: '20. Circle the word which means the same as DELICATE.',
      options: [
        { value: 'flexible', label: 'Flexible' },
        { value: 'decompose', label: 'Decompose' },
        { value: 'fragile', label: 'Fragile' },
        { value: 'touch', label: 'Touch' }
      ],
      correct: 'fragile'
    },
    {
      id: 'vocabulary_21', section: 'Vocabulary', type: 'choice', points: 1, examinerScored: false,
      prompt: '21. Circle the word which means the same as CAUTION.',
      options: [
        { value: 'vigil', label: 'Vigil' },
        { value: 'neglect', label: 'Neglect' },
        { value: 'courage', label: 'Courage' },
        { value: 'care', label: 'Care' },
        { value: 'despair', label: 'Despair' }
      ],
      correct: 'care'
    },
    {
      id: 'vocabulary_22', section: 'Vocabulary', type: 'choice', points: 1, examinerScored: false,
      prompt: '22. Circle the word which means the same as ALLOW.',
      options: [
        { value: 'permit', label: 'Permit' },
        { value: 'forbid', label: 'Forbid' },
        { value: 'refuse', label: 'Refuse' },
        { value: 'help', label: 'Help' },
        { value: 'fallow', label: 'Fallow' }
      ],
      correct: 'permit'
    },
    {
      id: 'vocabulary_23', section: 'Vocabulary', type: 'choice', points: 1, examinerScored: false,
      prompt: '23. Circle the word which means the same as PARTICLE.',
      options: [
        { value: 'piece', label: 'Piece' },
        { value: 'full', label: 'Full' },
        { value: 'partial', label: 'Partial' },
        { value: 'point', label: 'Point' },
        { value: 'complete', label: 'Complete' }
      ],
      correct: 'piece'
    },
    {
      id: 'vocabulary_24', section: 'Vocabulary', type: 'choice', points: 1, examinerScored: false,
      prompt: '24. Circle the word which means the same as REGENERATE.',
      options: [
        { value: 'erect', label: 'Erect' },
        { value: 'general', label: 'General' },
        { value: 'live', label: 'Live' },
        { value: 'restore', label: 'Restore' },
        { value: 'new', label: 'New' }
      ],
      correct: 'restore'
    },

    // ---- 25-29. NAMING — /5 (stimulus images required) --------------------------------
    { id: 'naming_25', section: 'Naming', type: 'passfail', points: 1, examinerScored: true,
      prompt: '25. Say: "Name or write the name of this item."',
      stimulusImage: 'assets/test-images/rqcst/naming-1.png', stimulusImageAlt: 'RQCST naming stimulus 1' },
    { id: 'naming_26', section: 'Naming', type: 'passfail', points: 1, examinerScored: true,
      prompt: '26. Say: "Name or write the name of this item."',
      stimulusImage: 'assets/test-images/rqcst/naming-2.png', stimulusImageAlt: 'RQCST naming stimulus 2' },
    { id: 'naming_27', section: 'Naming', type: 'passfail', points: 1, examinerScored: true,
      prompt: '27. Say: "Name or write the name of this item."',
      stimulusImage: 'assets/test-images/rqcst/naming-3.png', stimulusImageAlt: 'RQCST naming stimulus 3' },
    { id: 'naming_28', section: 'Naming', type: 'passfail', points: 1, examinerScored: true,
      prompt: '28. Say: "Name or write the name of this item."',
      stimulusImage: 'assets/test-images/rqcst/naming-4.png', stimulusImageAlt: 'RQCST naming stimulus 4' },
    { id: 'naming_29', section: 'Naming', type: 'passfail', points: 1, examinerScored: true,
      prompt: '29. Say: "Name or write the name of this item."',
      stimulusImage: 'assets/test-images/rqcst/naming-5.png', stimulusImageAlt: 'RQCST naming stimulus 5' },

    // ---- 30-33. ABSTRACT REASONING: SIMILARITIES — auto-scored, 1 pt each --------------
    {
      id: 'similarities_30', section: 'Abstract Reasoning: Similarities', type: 'choice', points: 1, examinerScored: false,
      prompt: '30. Circle the word or phrase which describes both words: KNIFE & FORK.',
      options: [
        { value: 'plate', label: 'Plate' },
        { value: 'out', label: 'Out' },
        { value: 'spoon', label: 'Spoon' },
        { value: 'cutlery', label: 'Cutlery' },
        { value: 'eat', label: 'Eat' }
      ],
      correct: 'cutlery'
    },
    {
      id: 'similarities_31', section: 'Abstract Reasoning: Similarities', type: 'choice', points: 1, examinerScored: false,
      prompt: '31. Circle the word or phrase which describes both words: SALT & SUGAR.',
      options: [
        { value: 'drink', label: 'Drink' },
        { value: 'grow', label: 'Grow' },
        { value: 'taste', label: 'Taste' },
        { value: 'smell_them', label: 'Smell them' },
        { value: 'eat_them', label: 'Eat them' }
      ],
      correct: 'taste'
    },
    {
      id: 'similarities_32', section: 'Abstract Reasoning: Similarities', type: 'choice', points: 1, examinerScored: false,
      prompt: '32. Circle the word or phrase which describes both words: RULER & SCALE.',
      options: [
        { value: 'drawing', label: 'Drawing' },
        { value: 'cooking', label: 'Cooking' },
        { value: 'weighing', label: 'Weighing' },
        { value: 'straight', label: 'Straight' },
        { value: 'measuring', label: 'Measuring' }
      ],
      correct: 'measuring'
    },
    {
      id: 'similarities_33', section: 'Abstract Reasoning: Similarities', type: 'choice', points: 1, examinerScored: false,
      prompt: '33. Circle the word or phrase which describes both words: NOSE & TONGUE.',
      options: [
        { value: 'on_face', label: 'On Face' },
        { value: 'taste', label: 'Taste' },
        { value: 'talking', label: 'Talking' },
        { value: 'sense_organs', label: 'Sense Organs' },
        { value: 'for_eating', label: 'For eating' }
      ],
      correct: 'sense_organs'
    },

    // ---- 34-37. ABSTRACT REASONING: ANALOGIES — auto-scored, 1 pt each ------------------
    {
      id: 'analogies_34', section: 'Abstract Reasoning: Analogies', type: 'choice', points: 1, examinerScored: false,
      prompt: '34. Circle the word which completes the sentence: Hand is to Glove as Foot is to:',
      options: [
        { value: 'hat', label: 'Hat' },
        { value: 'cold', label: 'Cold' },
        { value: 'leg', label: 'Leg' },
        { value: 'shoe', label: 'Shoe' },
        { value: 'coat', label: 'Coat' }
      ],
      correct: 'shoe'
    },
    {
      id: 'analogies_35', section: 'Abstract Reasoning: Analogies', type: 'choice', points: 1, examinerScored: false,
      prompt: '35. Circle the word which completes the sentence: Spider is to Web as Bird is to:',
      options: [
        { value: 'nest', label: 'Nest' },
        { value: 'egg', label: 'Egg' },
        { value: 'tree', label: 'Tree' },
        { value: 'fly', label: 'Fly' },
        { value: 'wing', label: 'Wing' }
      ],
      correct: 'nest'
    },
    {
      id: 'analogies_36', section: 'Abstract Reasoning: Analogies', type: 'choice', points: 1, examinerScored: false,
      prompt: '36. Circle the word which completes the sentence: Sun is to Heat as Lamp is to:',
      options: [
        { value: 'flower', label: 'Flower' },
        { value: 'light', label: 'Light' },
        { value: 'star', label: 'Star' },
        { value: 'shadow', label: 'Shadow' },
        { value: 'fire', label: 'Fire' }
      ],
      correct: 'light'
    },
    {
      id: 'analogies_37', section: 'Abstract Reasoning: Analogies', type: 'choice', points: 1, examinerScored: false,
      prompt: '37. Circle the word which completes the sentence: Spring is to Summer as Tuesday is to:',
      options: [
        { value: 'wednesday', label: 'Wednesday' },
        { value: 'saturday', label: 'Saturday' },
        { value: 'thursday', label: 'Thursday' },
        { value: 'monday', label: 'Monday' },
        { value: 'friday', label: 'Friday' }
      ],
      correct: 'wednesday'
    },

    // ---- 38-42. UNUSUAL VIEWS — /5 (stimulus images required) ----------------------------
    { id: 'unusual_views_38', section: 'Unusual Views', type: 'text', points: 1, examinerScored: true,
      prompt: '38. Say: "Identify or write the name of this object." Record the answer given; 1 pt for a correct identification.',
      stimulusImage: 'assets/test-images/rqcst/image4.jpg', stimulusImageAlt: 'RQCST unusual view 1' },
    { id: 'unusual_views_39', section: 'Unusual Views', type: 'text', points: 1, examinerScored: true,
      prompt: '39. Say: "Identify or write the name of this object."',
      stimulusImage: 'assets/test-images/rqcst/image5.jpg', stimulusImageAlt: 'RQCST unusual view 2' },
    { id: 'unusual_views_40', section: 'Unusual Views', type: 'text', points: 1, examinerScored: true,
      prompt: '40. Say: "Identify or write the name of this object."',
      stimulusImage: 'assets/test-images/rqcst/image6.jpg', stimulusImageAlt: 'RQCST unusual view 3' },
    { id: 'unusual_views_41', section: 'Unusual Views', type: 'text', points: 1, examinerScored: true,
      prompt: '41. Say: "Identify or write the name of this object."',
      stimulusImage: 'assets/test-images/rqcst/image8.jpg', stimulusImageAlt: 'RQCST unusual view 4' },
    { id: 'unusual_views_42', section: 'Unusual Views', type: 'text', points: 1, examinerScored: true,
      prompt: '42. Say: "Identify or write the name of this object."',
      stimulusImage: 'assets/test-images/rqcst/image9.jpg', stimulusImageAlt: 'RQCST unusual view 5' },

    // ---- 43-47. SPATIAL ORIENTATION — /5 (design rows; A-E options) ------------------------
    {
      id: 'spatial_orientation_43', section: 'Spatial Orientation', type: 'choice', points: 1, examinerScored: true,
      prompt: '43. Say: "Point to the design on the right which is the same as the design on the left." The participant answers A-E; award 1 pt if the choice matches the correct design.',
      stimulusNote: 'Examiner: show the printed design row for item 43 (or map the extracted image); the correct letter comes from your scoring key.',
      options: [
        { value: 'A', label: 'A' }, { value: 'B', label: 'B' }, { value: 'C', label: 'C' },
        { value: 'D', label: 'D' }, { value: 'E', label: 'E' }
      ]
    },
    {
      id: 'spatial_orientation_44', section: 'Spatial Orientation', type: 'choice', points: 1, examinerScored: true,
      prompt: '44. Say: "Point to the design on the right which is the same as the design on the left."',
      stimulusNote: 'Examiner: show the printed design row for item 44 (or map the extracted image).',
      options: [
        { value: 'A', label: 'A' }, { value: 'B', label: 'B' }, { value: 'C', label: 'C' },
        { value: 'D', label: 'D' }, { value: 'E', label: 'E' }
      ]
    },
    {
      id: 'spatial_orientation_45', section: 'Spatial Orientation', type: 'choice', points: 1, examinerScored: true,
      prompt: '45. Say: "Point to the design on the right which is the same as the design on the left."',
      stimulusNote: 'Examiner: show the printed design row for item 45 (or map the extracted image).',
      options: [
        { value: 'A', label: 'A' }, { value: 'B', label: 'B' }, { value: 'C', label: 'C' },
        { value: 'D', label: 'D' }, { value: 'E', label: 'E' }
      ]
    },
    {
      id: 'spatial_orientation_46', section: 'Spatial Orientation', type: 'choice', points: 1, examinerScored: true,
      prompt: '46. Say: "Point to the design on the right which is the same as the design on the left."',
      stimulusNote: 'Examiner: show the printed design row for item 46 (or map the extracted image).',
      options: [
        { value: 'A', label: 'A' }, { value: 'B', label: 'B' }, { value: 'C', label: 'C' },
        { value: 'D', label: 'D' }, { value: 'E', label: 'E' }
      ]
    },
    {
      id: 'spatial_orientation_47', section: 'Spatial Orientation', type: 'choice', points: 1, examinerScored: true,
      prompt: '47. Say: "Point to the design on the right which is the same as the design on the left."',
      stimulusNote: 'Examiner: show the printed design row for item 47 (or map the extracted image).',
      options: [
        { value: 'A', label: 'A' }, { value: 'B', label: 'B' }, { value: 'C', label: 'C' },
        { value: 'D', label: 'D' }, { value: 'E', label: 'E' }
      ]
    },

    // ---- 48. MEMORY: DELAYED RECALL (VISUAL) — /6 ------------------------------------------
    {
      id: 'delayed_recall_visual_48',
      section: 'Memory: Delayed Recall (Visual)',
      type: 'drawing',
      examinerOnly: true,
      prompt: '48. Say: "I want you to draw the figures that you drew earlier." (The constructional-praxis figures from item 18, from memory \u2014 keep the original and the copy out of view.) Scoring: 1 pt per figure plus 1 pt per correct placement (max 6).',
      points: 6,
      examinerScored: true,
      showsTimer: false,
      doneLabel: 'Done'
    },

    // ---- 49. MEMORY: DELAYED RECALL (VERBAL) — /5 -------------------------------------------
    {
      id: 'delayed_recall_verbal_49',
      section: 'Memory: Delayed Recall (Verbal)',
      type: 'tally',
      examinerOnly: true,
      prompt: '49. Say: "I want you to repeat back to me the five objects I named earlier." (PEN, WATCH, TIE, CAR, BOOK \u2014 do not read them aloud.) Tally each object recalled correctly \u2014 each is worth 1 pt automatically.',
      points: 5,
      examinerScored: false
    },

    // ---- 50. MEMORY: NEW LEARNING — /10 --------------------------------------------------------
    {
      id: 'new_learning_50',
      section: 'Memory: New Learning',
      type: 'tally',
      examinerOnly: true,
      prompt: '50. Say: "I am going to say a sentence to you. Listen carefully and when I am finished I would like you to repeat the sentence back to me exactly as I say it." Read: "One thing a nation must have to be rich and great is a large secure supply of wood." Repeat the sentence for up to 10 trials, stopping as soon as the repetition is exact. Tally ONE PER TRIAL attempted \u2014 scoring is automatic: exact on trial 1 = 10 pts, trial 2 = 9 pts, ... trial 10 = 1 pt; not exact within 10 trials = 0.',
      points: 10,
      examinerScored: false
    }
  ]
};
