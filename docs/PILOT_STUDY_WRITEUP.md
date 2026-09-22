# Pilot Study Write-up and Administration Guide

## 1. Purpose

This pilot evaluates whether the electronic Neuropsychological Assessment Toolkit can be administered successfully on a tablet and whether it captures the required responses, drawings, timings, examiner scores, and reports.

This is a small feasibility and usability pilot with two participants. It is not sufficient to establish diagnostic validity, reliability, normative cutoffs, or equivalence with paper administration.

## 2. Before recruiting participants

Obtain the approval required by the course, department, institution, or ethics review process before collecting data from patients. Confirm:

- who is authorized to administer the tests;
- whether the participants are patients, volunteers, or classmates acting as simulated participants;
- how informed consent will be documented;
- where assessment data and backups will be stored;
- who can access the Cloudflare deployment and D1 database;
- how participant withdrawal and data deletion will be handled;
- whether the instrument owners' permissions cover this pilot.

Do not use the pilot as a diagnostic service. Do not alter clinical care based only on prototype scores.

## 3. Recommended pilot design

Use two participants who can safely complete the selected tasks. For a usability pilot, the two participants may have different familiarity with tablets or styluses. Record these characteristics without recording names in the app.

Use the same selected test battery for both participants unless the approved protocol says otherwise. A practical full-battery pilot is:

- MoCA v8.1;
- RQCST;
- Rey Complex Figure;
- Trail-Making Test Parts A and B;
- BSI-18.

Using the same battery makes it easier to compare administration time, missing responses, drawing behavior, examiner workload, and report completeness. If fatigue is a concern, predefine a shorter battery and use it consistently.

## 4. Roles and equipment

### Examiner

The examiner creates the assignment, administers spoken instructions, scores examiner-scored items, monitors the session, records deviations, and downloads the report.

### Participant

The participant uses the tablet and stylus, completes visible items, gives spoken responses when prompted, and signs consent.

### Equipment checklist

- charged tablet;
- compatible stylus;
- stable Wi-Fi if using the hosted Worker deployment;
- examiner device if live monitoring is being tested;
- approved participant information and consent materials;
- secure location for the exported report;
- backup plan if the network or tablet fails.

Use the hosted deployment for two-device live monitoring. `file://` mode is single-device only.

## 5. Administration procedure

### Preparation

1. Sign in as Administrator or Examiner.
2. Select **New assessment**.
3. Select the predefined pilot test battery.
4. Create a non-identifying participant code such as `PILOT-01`.
5. Create a participant PIN and provide it privately.
6. Enter only the approved intake fields.
7. Confirm that the participant assignment lists the intended tests.
8. Check that the examiner has access to live monitoring and report functions.

### Consent and start

1. Have the participant sign in with the participant code and PIN.
2. Read and discuss the informed-consent screen.
3. Answer questions without promising a clinical diagnosis or benefit.
4. Record consent only after the participant confirms understanding and signs.
5. Confirm that the assigned tests are correct.
6. Have the participant select **Begin assessment**.
7. Start the pilot observation log at the beginning of the first item.

### Test administration

Follow the source instrument's administration and scoring instructions. The electronic application supplies the item order, visible stimulus, response control, timing, and storage. It does not replace examiner judgment or the official administration manual.

The examiner should:

- read examiner-only scripts exactly as approved;
- avoid showing examiner-only prompts to the participant;
- avoid giving feedback about correctness or scores;
- score subjective items immediately when the interface requests it;
- record any interruption, clarification, technical issue, or deviation;
- pause rather than abandon the session if a break is needed;
- stop the session with a reason if completion is not appropriate.

### Test-specific points to observe

**MoCA**

- confirm the participant sees only the required visual stimulus;
- confirm spoken word lists, digit sequences, sentences, vigilance material, and serial subtraction instructions remain examiner-only;
- observe cube, clock, trail, and naming interaction;
- verify examiner scoring is recorded without exposing scores to the participant.

**RQCST**

- verify each domain appears as a separate item;
- confirm naming, unusual-view, and spatial-orientation images display correctly;
- note whether the participant understands the response controls;
- check examiner scoring for visual and verbal items.

**Rey Complex Figure**

- confirm the figure is shown during copy only;
- confirm the immediate and delayed recall phases do not reveal the figure;
- verify the two three-minute intervals;
- record whether the participant understands the drawing canvas and whether the examiner can see the live drawing.

**Trail-Making Test**

- test the stylus without lifting it;
- observe the continuous path, node highlighting, error behavior, and timing;
- verify practice parts occur before the corresponding test part;
- record any difficulty caused by stylus sensitivity or screen size.

**BSI-18**

- confirm all 18 items are presented separately;
- verify the participant can select one response per item;
- observe fatigue, ambiguity, or difficulty reading the scale labels.

## 6. Scoring procedure

The application calculates objective scores using the configured test modules. The examiner must still review examiner-scored items and confirm that the result is plausible and complete.

For each participant:

1. Review every selected test in the completed session.
2. Confirm no item was unintentionally skipped.
3. Confirm examiner points are entered for subjective drawings, naming, visual tasks, and other clinical-judgment items.
4. Check timing and error fields for timed or trail tasks.
5. Download the PDF report as the examiner.
6. Confirm the report includes the participant code, selected tests, responses, points, interpretations, drawings, and timing data.
7. Do not show the report or scores to the participant.
8. Store the report using the approved secure process.

Do not interpret the prototype's screening output as a diagnosis. Where normative interpretation is not implemented, document that a qualified professional must interpret the result.

## 7. Pilot observation form

Complete one copy for each participant.

### Participant and session

- Pilot code:
- Date:
- Examiner:
- Device model and screen size:
- Stylus used:
- Hosted Worker or offline mode:
- Tests assigned:
- Session completed, paused, resumed, or stopped:
- Total elapsed administration time:

### Administration observations

- Was the login successful?
- Was consent understandable?
- Did the participant understand when to begin?
- Were instructions readable and appropriately hidden or shown?
- Did the participant need clarification? Describe:
- Did fatigue or distress affect the session?
- Were breaks required?
- Did any item need to be skipped? Why?

### Interaction observations

- Touch or stylus responsiveness:
- Drawing canvas usability:
- Trail error behavior:
- Timer behavior:
- Stimulus image quality and size:
- Text readability:
- Button placement and label clarity:
- Navigation or resume behavior:
- Examiner live-view behavior:

### Data and reporting checks

- Were all responses saved?
- Were drawings saved?
- Were timings saved?
- Were examiner scores saved?
- Did the participant remain unable to see grades?
- Did the PDF download successfully?
- Did the PDF contain the expected images and answers?
- Any data loss, duplicate record, or server error?

### Deviations and corrective actions

- Deviation:
- Effect on the participant or score:
- Immediate action taken:
- Recommended software or procedure change:

## 8. Two-participant comparison table

| Measure | Participant 1 | Participant 2 | Interpretation for feasibility |
|---|---|---|---|
| Completion status |  |  |  |
| Total administration time |  |  |  |
| Number of pauses |  |  |  |
| Number of skipped items |  |  |  |
| Technical interruptions |  |  |  |
| Drawing/stylus difficulties |  |  |  |
| Examiner scoring difficulties |  |  |  |
| Participant usability concerns |  |  |  |
| Report problems |  |  |  |

Compare process measures and usability observations, not diagnostic scores. With two participants, differences in scores cannot support claims about effectiveness or validity.

## 9. Challenges to discuss in the final write-up

Organize the discussion under these headings:

### Administration challenges

Examples include learning the electronic workflow, reading examiner scripts while monitoring the participant, maintaining standardized instructions, and handling breaks or interruptions.

### Participant challenges

Examples include unfamiliarity with tablets, stylus control, visual fatigue, reading small text, uncertainty about when to press **Next**, or anxiety about assessment performance.

### Technical challenges

Examples include connectivity, D1/Worker availability, browser reloads, device battery, live-view delay, image scaling, canvas responsiveness, and report downloads.

### Scoring challenges

Examples include examiner judgment for drawings, confirming that points were entered, distinguishing a skipped item from a blank response, and deciding how to document deviations.

### Data-protection challenges

Examples include keeping participant codes separate from names, protecting exported PDFs and JSON backups, limiting staff access, and deleting data after withdrawal.

## 10. Suggested conclusion

A suitable conclusion should state whether the prototype was feasible for the two observed administrations, which workflows worked reliably, which issues affected usability or standardization, and what must be changed before a larger pilot or clinical deployment. Avoid claiming that the electronic version is valid, reliable, or diagnostically equivalent based on two participants.

## 11. Deliverables for the course

Submit or retain:

1. this protocol and completed observation forms;
2. a de-identified summary of the two administrations;
3. the two examiner reports, stored securely and not embedded in a public repository;
4. a table of technical and administration challenges;
5. screenshots only if they contain no participant identifiers or protected health information;
6. the final version/commit identifier of the application;
7. a limitations and future-work section.
