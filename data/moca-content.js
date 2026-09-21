/**
 * data/moca-content.js
 * -----------------------------------------------------------------------
 * Official MoCA Version 8.1 content, transcribed from the administration
 * and scoring instructions and the test sheet in the source document
 * (MOCA-8.1.8.2-English). Point values sum to the real 30-point scale:
 *
 *   Visuospatial/Executive  trail 1 + cube 1 + clock 3  = 5
 *   Naming                                        = 3
 *   Attention  digits 2 + vigilance 1 + serial 7s 3     = 6
 *   Language  sentences 2 + fluency 1                  = 3
 *   Abstraction                                        = 2
 *   Delayed recall                                      = 5
 *   Orientation                                         = 6
 *   (Memory registration and MIS cueing are not part of /30)
 *
 * Rules implemented here + js/tests/moca.js:
 *   - Verbal stimuli (word list, digit sequences, letter string, serial
 *     7s, sentences, fluency letter) are `examinerOnly`: an examinee
 *     taking the test sees only the domain label — the examiner reads
 *     the script aloud (SRS rule).
 *   - Vigilance is recorded as a TALLY OF ERRORS (taps on wrong letters
 *     or missed A's); 0-1 errors scores 1, 2+ scores 0 (converted in
 *     moca.js).
 *   - Serial 7s: each subtraction is judged independently; 0 correct = 0,
 *     1 = 1, 2-3 = 2, 4-5 = 3 points. The examiner records the answers
 *     and sets the point total.
 *   - Delayed recall: examiner tallies words recalled freely (0-5).
 *     MIS sub-score: category-cue recalls x2 + multiple-choice recalls
 *     x1, max 15, computed in moca.js (not part of /30).
 *   - Education rule: +1 point if the participant has <= 12 years of
 *     formal education (captured at intake), capped at 30 (moca.js).
 *   - 26 or above = normal screening range (moca.js).
 *
 * IMAGES: the alternating-trail layout is the interactive 'trail' item
 * below; the cube stimulus is a local SVG (assets/test-images/moca/
 * cube.svg). The naming animals live inside the scanned full-sheet image
 * (assets/test-images/moca/image1.png) and CANNOT be shown as-is without
 * leaking the memory words etc. — crop the three animals out of the
 * sheet with any image editor, save them as e.g. assets/test-images/
 * moca/naming-1.png (lion), naming-2.png (rhinoceros), naming-3.png
 * (camel), then set `stimulusImage` on the three naming items.
 *
 * v8.2 differences (also in the source document), if you ever switch
 * versions: chair copy instead of cube; clock 10 past 9; naming
 * snake/elephant/crocodile; memory words HAND/NYLON/PARK/CARROT/YELLOW;
 * digits forward 8-1-5-2-4, backward correct 7-4-2; serial 7s from 70;
 * fluency letter S; sentences A/B below; abstraction bed-table and
 * letter-telephone.
 */

var MoCAContent = {
  name: 'MoCA (Montreal Cognitive Assessment, v8.1)',
  items: [
    // ---- Visuospatial / Executive (5 pts) --------------------------------
    {
      id: 'visuospatial_trail',
      section: 'Visuospatial / Executive',
      type: 'trail',
      prompt: 'Draw a line going from a number to a letter in ascending order. Begin at 1 and draw a line from 1 then to A then to 2 and so on. End here (E). Draw the lines without lifting the stylus.',
      points: 1,
      examinerScored: true,
      nodes: [
        { label: '1', xFrac: 0.20, yFrac: 0.28 },
        { label: 'A', xFrac: 0.72, yFrac: 0.10 },
        { label: '2', xFrac: 0.38, yFrac: 0.42 },
        { label: 'B', xFrac: 0.86, yFrac: 0.30 },
        { label: '3', xFrac: 0.58, yFrac: 0.55 },
        { label: 'C', xFrac: 0.14, yFrac: 0.72 },
        { label: '4', xFrac: 0.70, yFrac: 0.68 },
        { label: 'D', xFrac: 0.45, yFrac: 0.90 },
        { label: '5', xFrac: 0.08, yFrac: 0.42 },
        { label: 'E', xFrac: 0.90, yFrac: 0.62 }
      ],
      allowSkip: true
    },
    {
      id: 'visuospatial_cube',
      section: 'Visuospatial / Executive',
      type: 'drawing',
      prompt: 'Copy this drawing as accurately as you can. (Scoring: three-dimensional, all lines drawn, lines meet with little or no space, no line added, lines relatively parallel and similar in length, orientation preserved.)',
      stimulusImage: 'assets/test-images/moca/cube.svg',
      stimulusImageAlt: 'MoCA cube copy stimulus',
      points: 1,
      examinerScored: true,
      showsTimer: false,
      doneLabel: 'Cube done'
    },
    {
      id: 'visuospatial_clock',
      section: 'Visuospatial / Executive',
      type: 'drawing',
      prompt: 'Draw a clock. Put in all the numbers and set the time to 10 past 11. (Scoring: 1 pt contour, 1 pt numbers \u2014 all present, correct order, upright, in quadrants; 1 pt hands \u2014 two hands jointly indicating the correct time, hour hand clearly shorter, junction near the centre.)',
      points: 3,
      examinerScored: true,
      showsTimer: false,
      doneLabel: 'Clock done'
    },

    // ---- Naming (3 pts) ----------------------------------------------------
    {
      id: 'naming_1',
      section: 'Naming',
      type: 'passfail',
      prompt: 'Point to the first animal (lion) and ask: "Tell me the name of this animal." Accept: lion.',
      stimulusNote: 'Examiner: show the Naming figures from the printed MoCA sheet (or add cropped stimulus images \u2014 see the note at the top of this file).',
      points: 1,
      examinerScored: true
    },
    {
      id: 'naming_2',
      section: 'Naming',
      type: 'passfail',
      prompt: 'Point to the second animal (rhinoceros) and ask: "Tell me the name of this animal." Accept: rhinoceros or rhino.',
      points: 1,
      examinerScored: true
    },
    {
      id: 'naming_3',
      section: 'Naming',
      type: 'passfail',
      prompt: 'Point to the third animal (camel) and ask: "Tell me the name of this animal." Accept: camel or dromedary.',
      points: 1,
      examinerScored: true
    },

    // ---- Memory registration (not scored) ---------------------------------
    {
      id: 'memory_registration',
      section: 'Memory',
      type: 'info',
      examinerOnly: true,
      prompt: 'Read the 5-word list at one word per second: FACE, VELVET, CHURCH, DAISY, RED. Say: "This is a memory test. I am going to read a list of words that you will have to remember now and later on. Listen carefully. When I am through, tell me as many words as you can remember. It doesn\u2019t matter in what order you say them." Mark words recalled on trial 1, then read the list a second time ("Try to remember and tell me as many words as you can, including words you said the first time"). At the end of the second trial say: "I will ask you to recall those words again at the end of the test." No points for either trial. Advance when both trials are done.',
      points: 0,
      allowSkip: false
    },

    // ---- Attention (6 pts) -------------------------------------------------
    {
      id: 'attention_digit_forward',
      section: 'Attention \u2014 Forward digit span',
      type: 'text',
      examinerOnly: true,
      prompt: 'Say: "I am going to say some numbers and when I am through, repeat them to me exactly as I said them." Read at one digit per second: 2 \u2013 1 \u2013 8 \u2013 5 \u2013 4. Record what the participant said, then score 1 pt for an exact repetition.',
      points: 1,
      examinerScored: true
    },
    {
      id: 'attention_digit_backward',
      section: 'Attention \u2014 Backward digit span',
      type: 'text',
      examinerOnly: true,
      prompt: 'Say: "Now I am going to say some more numbers, but when I am through you must repeat them in the backward order." Read at one digit per second: 7 \u2013 4 \u2013 2. (Correct backward response is 2-4-7.) Record what the participant said, then score 1 pt for the exact backward sequence.',
      points: 1,
      examinerScored: true
    },
    {
      id: 'attention_vigilance',
      section: 'Attention \u2014 Vigilance',
      type: 'tally',
      examinerOnly: true,
      prompt: 'Say: "I am going to read a sequence of letters. Every time I say the letter A, tap your hand once. If I say a different letter, do not tap your hand." Read at one letter per second: F B A C M N A A J K L B A A F A K D E A A A J A M O F A A A B. Tally each ERROR (tap on a wrong letter or failure to tap on A). Scoring is automatic: 0\u20131 error = 1 pt, 2 or more = 0.',
      points: 1,
      examinerScored: false
    },
    {
      id: 'attention_serial7',
      section: 'Attention \u2014 Serial 7s',
      type: 'text',
      examinerOnly: true,
      prompt: 'Say: "Now, I will ask you to count by subtracting 7 from 100, and then, keep subtracting 7 from your answer until I tell you to stop." No fingers, no pencil and paper; do not repeat the participant\u2019s answers. Record the sequence given (e.g. 93 86 79 72 65). Each subtraction is judged independently \u2014 an incorrect number that is then correctly subtracted from still counts. Score: 0 correct = 0 pts, 1 = 1 pt, 2\u20133 = 2 pts, 4\u20135 = 3 pts.',
      points: 3,
      examinerScored: true
    },

    // ---- Language (3 pts) ---------------------------------------------------
    {
      id: 'language_repeat_1',
      section: 'Language \u2014 Sentence repetition',
      type: 'passfail',
      examinerOnly: true,
      prompt: 'Say: "I am going to read you a sentence. Repeat it after me, exactly as I say it." Then read: "I only know that John is the one to help today." Repetition must be exact \u2014 watch for omissions, substitutions/additions, grammar errors.',
      points: 1,
      examinerScored: true
    },
    {
      id: 'language_repeat_2',
      section: 'Language \u2014 Sentence repetition',
      type: 'passfail',
      examinerOnly: true,
      prompt: 'Read: "Now I am going to read you another sentence. Repeat it after me, exactly as I say it." Then: "The cat always hid under the couch when dogs were in the room." Repetition must be exact.',
      points: 1,
      examinerScored: true
    },
    {
      id: 'language_fluency',
      section: 'Language \u2014 Verbal fluency',
      type: 'timedFluency',
      examinerOnly: true,
      prompt: 'Say: "Now, I want you to tell me as many words as you can think of that begin with the letter F. I will tell you to stop after one minute. Proper nouns, numbers, and different forms of a verb are not permitted." Tap "Valid response" once per acceptable word. Scoring is automatic: 11 or more words in 60s = 1 pt.',
      timerSeconds: 60,
      points: 1,
      examinerScored: false
    },

    // ---- Abstraction (2 pts) -------------------------------------------------
    {
      id: 'abstraction_1',
      section: 'Abstraction',
      type: 'passfail',
      examinerOnly: true,
      prompt: 'Practice pair first (orange and banana \u2014 fruits; give the category prompt once if answered concretely). Then ask: "Now, a train and a bicycle." Accept: means of transportation, means of travelling, "you take trips in both". NOT acceptable: "they have wheels".',
      points: 1,
      examinerScored: true
    },
    {
      id: 'abstraction_2',
      section: 'Abstraction',
      type: 'passfail',
      examinerOnly: true,
      prompt: 'Ask: "Now, a ruler and a watch." Accept: measuring instruments, used to measure. NOT acceptable: "they have numbers". (One prompt for the whole section, if not used on the example.)',
      points: 1,
      examinerScored: true
    },

    // ---- Delayed recall (5 pts) + MIS (sub-score /15) ------------------------
    {
      id: 'delayed_recall',
      section: 'Delayed recall',
      type: 'tally',
      examinerOnly: true,
      prompt: 'Say: "I read some words to you earlier, which I asked you to remember. Tell me as many of those words as you can remember." (FACE, VELVET, CHURCH, DAISY, RED \u2014 do not read them aloud.) Tally ONLY words recalled freely, without any cue \u2014 each is worth 1 pt automatically.',
      points: 5,
      examinerScored: false
    },
    {
      id: 'mis_category',
      section: 'Memory index score (MIS) \u2014 category cues',
      type: 'tally',
      examinerOnly: true,
      prompt: 'For each word NOT freely recalled, give the category cue \u2014 FACE: "a body part"; VELVET: "a type of fabric"; CHURCH: "a type of building"; DAISY: "a type of flower"; RED: "a color". Tally how many words were recalled with the category cue (each counts 2 points toward the MIS, computed automatically \u2014 the MIS is a sub-score and does not add to the /30).',
      points: 5,
      examinerScored: false
    },
    {
      id: 'mis_multiple',
      section: 'Memory index score (MIS) \u2014 multiple choice',
      type: 'tally',
      examinerOnly: true,
      prompt: 'For each word still not recalled, give the multiple-choice cue \u2014 FACE: "nose, face or hand"; VELVET: "denim, velvet or cotton"; CHURCH: "church, school or hospital"; DAISY: "rose, daisy or tulip"; RED: "red, blue or green". Tally how many were recalled this way (each counts 1 point toward the MIS, computed automatically).',
      points: 5,
      examinerScored: false
    },

    // ---- Orientation (6 pts) ---------------------------------------------------
    {
      id: 'orientation_date',
      section: 'Orientation',
      type: 'passfail',
      prompt: 'Ask: "Tell me today\u2019s date." (Prompt for the exact date if needed \u2014 must be exact.)',
      points: 1,
      examinerScored: true
    },
    {
      id: 'orientation_month',
      section: 'Orientation',
      type: 'passfail',
      prompt: 'Ask for the current month.',
      points: 1,
      examinerScored: true
    },
    {
      id: 'orientation_year',
      section: 'Orientation',
      type: 'passfail',
      prompt: 'Ask for the current year.',
      points: 1,
      examinerScored: true
    },
    {
      id: 'orientation_day',
      section: 'Orientation',
      type: 'passfail',
      prompt: 'Ask for the day of the week.',
      points: 1,
      examinerScored: true
    },
    {
      id: 'orientation_place',
      section: 'Orientation',
      type: 'passfail',
      prompt: 'Ask: "Tell me the name of this place." (Name of hospital/clinic/office must be exact.)',
      points: 1,
      examinerScored: true
    },
    {
      id: 'orientation_city',
      section: 'Orientation',
      type: 'passfail',
      prompt: 'Ask which city it is in.',
      points: 1,
      examinerScored: true
    }
  ]
};
