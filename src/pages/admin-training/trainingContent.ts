/**
 * Staff training content for the Rural Map / Decision Assist tool.
 *
 * Plain operational language. Used by the /admin/training page for both
 * on-screen rendering and .docx / .pdf export. Pure data — no React, no
 * runtime side effects. Safe to import from anywhere.
 */

export type TrainingBlock =
  | { kind: 'h1'; text: string }
  | { kind: 'h2'; text: string }
  | { kind: 'h3'; text: string }
  | { kind: 'p'; text: string }
  | { kind: 'bullets'; items: string[] }
  | { kind: 'steps'; items: string[] }
  | { kind: 'note'; text: string }
  | { kind: 'screenshot'; label: string; instruction: string };

export interface TrainingSection {
  id: string;
  title: string;
  blocks: TrainingBlock[];
}

export const TRAINING_TITLE = 'Rural Map & Decision Assist — Staff Training';
export const TRAINING_SUBTITLE =
  'Operational training for NovumHealth field coordination staff';

export const TRAINING_SECTIONS: TrainingSection[] = [
  {
    id: 'overview',
    title: '1. Overview',
    blocks: [
      {
        kind: 'p',
        text: 'The Rural Map is an operational tool used by NovumHealth staff to coordinate care for members across rural Nevada. It combines facility data, field staff coverage, and member access analysis into a single view. Decision Assist sits on top of this map and turns a member intake into a recommended next step.',
      },
      {
        kind: 'p',
        text: 'This training covers how to use the map and Decision Assist for day-to-day work. It does not cover engineering, data import, or admin configuration. Those have separate documentation.',
      },
      {
        kind: 'h2',
        text: 'Who this is for',
      },
      {
        kind: 'bullets',
        items: [
          'Care coordinators handling member intake',
          'Field staff planning visits across rural counties',
          'Supervisors reviewing routing decisions',
        ],
      },
      {
        kind: 'h2',
        text: 'What you will be able to do after this training',
      },
      {
        kind: 'bullets',
        items: [
          'Open the map and find a member by location',
          'Read facility, county, and coverage information correctly',
          'Use Decision Assist to generate a recommended care pathway',
          'Copy a clean care plan into AdvancedMD or Word',
          'Recognize common errors and know what to do next',
        ],
      },
    ],
  },
  {
    id: 'orientation',
    title: '2. System Orientation',
    blocks: [
      { kind: 'h2', text: 'Frontend (what you see)' },
      {
        kind: 'bullets',
        items: [
          'Map area — Nevada, with county boundaries and facility pins.',
          'Sidebar (left) — layer toggles, filters, and search.',
          'Detail panels — open on the right when you click a county, facility, or member pin.',
          'Decision Assist drawer — desktop only, opens from the right edge when a member location is set.',
          'Bottom-right controls — zoom, basemap, presentation mode.',
        ],
      },
      { kind: 'h2', text: 'Pin colors (always the same meaning)' },
      {
        kind: 'bullets',
        items: [
          'Red — Hospitals',
          'Blue — Clinics',
          'Green — Community services',
          'Purple — Behavioral health',
          'White (large) — Member location from the search',
        ],
      },
      { kind: 'h2', text: 'Backend (what runs behind the scenes)' },
      {
        kind: 'p',
        text: 'You do not need to manage the backend day-to-day. You only need to know:',
      },
      {
        kind: 'bullets',
        items: [
          'Facility, county, and coverage data is loaded from internal data files and verified records.',
          'Decision Assist is deterministic. The same inputs always produce the same recommendation. It does not call an AI model.',
          'Member search uses public geocoding to place a pin on the map. No member PHI is stored.',
        ],
      },
    ],
  },
  {
    id: 'daily-workflows',
    title: '3. Daily Workflows',
    blocks: [
      { kind: 'h2', text: 'Workflow A — Look up a member and find nearby care' },
      {
        kind: 'steps',
        items: [
          'Open the map at the project URL.',
          'In the sidebar, open Member Access search.',
          'Enter the member address or ZIP and submit.',
          'Wait for the white member pin to appear on the map.',
          'Review the Member Access panel for tier (10 / 25 / 40 mi) and recommended care mode.',
          'Click any nearby facility pin to see address, phone, and access info.',
        ],
      },
      { kind: 'h2', text: 'Workflow B — Use Decision Assist for an intake' },
      {
        kind: 'steps',
        items: [
          'Place a member pin first using Workflow A. Decision Assist will not open without one.',
          'On a desktop or laptop, open the Decision Assist drawer from the right side.',
          'Select the care domain that matches the member request.',
          'Select the specific need under that domain.',
          'Review the Operational Decision panel: Pathway, Order of Operations, Targets, Constraints, Confidence, Next Staff Action.',
          'Click a target facility to verify it on the map.',
          'Click Copy Plan to copy the formatted care plan.',
          'Paste the plan into AdvancedMD or Word for the member record.',
        ],
      },
      { kind: 'h2', text: 'Workflow C — Review county coverage' },
      {
        kind: 'steps',
        items: [
          'Click any county polygon on the map.',
          'Read the county detail panel: member volume, FTE coverage, resource strength.',
          'Cross-check the linked FTE card highlighted in the sidebar.',
          'Use this to plan field deployment or remote coordination.',
        ],
      },
    ],
  },
  {
    id: 'scenarios',
    title: '4. Scenario-Based Exercises',
    blocks: [
      {
        kind: 'p',
        text: 'Work through each scenario on the live map. Confirm the expected outcome before moving on.',
      },
      { kind: 'h3', text: 'Scenario 1 — Urgent primary care, frontier county' },
      {
        kind: 'p',
        text: 'A member in a frontier county needs same-day primary care. Place the member pin, open Decision Assist, choose Primary Care → Urgent. Expected: pathway favors remote coordination or nearest clinic with a clear travel constraint.',
      },
      { kind: 'h3', text: 'Scenario 2 — Behavioral health follow-up' },
      {
        kind: 'p',
        text: 'Member needs a behavioral health follow-up. Choose Behavioral Health → Follow-up. Expected: targets show purple BH sites and the plan recommends in-person if within 25 mi, otherwise remote.',
      },
      { kind: 'h3', text: 'Scenario 3 — Member outside any 40 mi tier' },
      {
        kind: 'p',
        text: 'Search a remote address with no clinics within 40 mi. Expected: Decision Assist shows a Gap tier and recommends remote care plus field engagement.',
      },
      { kind: 'h3', text: 'Scenario 4 — High-load county' },
      {
        kind: 'p',
        text: 'Pick a county where the FTE card shows Strained or Overloaded. Run Decision Assist for that member. Expected: Constraints section calls out FTE strain.',
      },
      { kind: 'h3', text: 'Scenario 5 — Specialty referral' },
      {
        kind: 'p',
        text: 'Choose Specialty → Cardiology (or similar). Expected: targets prioritize urban hospital sites and the plan notes likely travel.',
      },
      { kind: 'h3', text: 'Scenario 6 — Copy and paste into Word' },
      {
        kind: 'p',
        text: 'Run any Decision Assist result. Click Copy Plan. Paste into Word or AdvancedMD. Expected: clean plain text, no broken formatting, header reads CARE PLAN SUMMARY.',
      },
    ],
  },
  {
    id: 'screenshots',
    title: '5. Screenshot Placeholders',
    blocks: [
      {
        kind: 'p',
        text: 'These screenshots should be captured and added to the printed training packet. Capture on desktop at 1440 width or larger.',
      },
      {
        kind: 'screenshot',
        label: 'Screenshot 1 — Map with sidebar open',
        instruction:
          'Open the map at default zoom. Sidebar expanded with Core Map section visible. Capture full window.',
      },
      {
        kind: 'screenshot',
        label: 'Screenshot 2 — Member pin placed',
        instruction:
          'Search any rural Nevada address. Capture map showing the white member pin and the Member Access panel on the right.',
      },
      {
        kind: 'screenshot',
        label: 'Screenshot 3 — Decision Assist intake',
        instruction:
          'With a member pin placed, open Decision Assist. Capture the intake step showing domain and need selectors.',
      },
      {
        kind: 'screenshot',
        label: 'Screenshot 4 — Decision Assist result',
        instruction:
          'Run an intake to completion. Capture the Operational Decision panel including Pathway, Order of Operations, Targets, Constraints, Confidence, Next Staff Action, and the Copy Plan button.',
      },
      {
        kind: 'screenshot',
        label: 'Screenshot 5 — County detail panel',
        instruction:
          'Click any county. Capture the county detail panel showing member volume, FTE coverage, and resource strength.',
      },
      {
        kind: 'screenshot',
        label: 'Screenshot 6 — Copy Plan output in Word',
        instruction:
          'Paste a copied plan into Word. Capture the Word window showing the CARE PLAN SUMMARY block.',
      },
    ],
  },
  {
    id: 'rules',
    title: '6. Rules of Use',
    blocks: [
      {
        kind: 'bullets',
        items: [
          'Do not enter PHI into the URL or any search box. Use addresses, ZIPs, or general location only.',
          'Decision Assist is a recommendation, not a clinical decision. A coordinator must confirm before acting.',
          'Always confirm a target facility is operating (call ahead) before sending a member.',
          'Use the Copy Plan output as the canonical record. Do not retype it from memory.',
          'Do not screenshot member-identifying detail when sharing externally.',
          'If data looks wrong, file a verification request. Do not edit data in the UI.',
        ],
      },
    ],
  },
  {
    id: 'errors',
    title: '7. Common Errors',
    blocks: [
      { kind: 'h3', text: 'Decision Assist drawer does not appear' },
      {
        kind: 'p',
        text: 'Cause: no member pin placed, or you are on a small screen. Decision Assist is desktop / laptop only and requires a member pin.',
      },
      { kind: 'h3', text: 'Member search returns no pin' },
      {
        kind: 'p',
        text: 'Cause: address could not be geocoded. Try a nearby ZIP or a more specific address.',
      },
      { kind: 'h3', text: 'Copy Plan shows error toast' },
      {
        kind: 'p',
        text: 'Cause: the browser blocked clipboard access. Click the page once to focus, then retry. If still failing, copy text manually from the result panel.',
      },
      { kind: 'h3', text: 'Facility detail looks outdated' },
      {
        kind: 'p',
        text: 'Cause: source data needs verification. Submit through the verification queue. Do not change pin colors or names.',
      },
      { kind: 'h3', text: 'County polygon will not select' },
      {
        kind: 'p',
        text: 'Cause: clicking inside a tribal nation overlay. Tribal sovereign geometry takes priority. Click outside the tribal boundary to select the county.',
      },
    ],
  },
  {
    id: 'quickref',
    title: '8. Quick Reference',
    blocks: [
      { kind: 'h3', text: 'Pin colors' },
      {
        kind: 'bullets',
        items: [
          'Red = Hospital',
          'Blue = Clinic',
          'Green = Service',
          'Purple = Behavioral Health',
          'White = Member location',
        ],
      },
      { kind: 'h3', text: 'Access tiers (member to nearest care)' },
      {
        kind: 'bullets',
        items: [
          '0–10 mi — Strong access, in-person preferred',
          '10–25 mi — Conditional, in-person if reasonable',
          '25–40 mi — Weak, prefer remote',
          '> 40 mi — Gap, remote + field engagement',
        ],
      },
      { kind: 'h3', text: 'Decision Assist sections' },
      {
        kind: 'bullets',
        items: [
          'Pathway — overall care route',
          'Order of Operations — sequenced steps',
          'Targets — recommended facilities',
          'Constraints — what limits this plan',
          'Confidence Level — how strong the match is',
          'Next Staff Action — what to do right now',
        ],
      },
      { kind: 'h3', text: 'Keyboard / mode shortcuts' },
      {
        kind: 'bullets',
        items: [
          'Ctrl + Shift + D — toggle developer diagnostic mode (admin only)',
          'Esc — close detail panels',
        ],
      },
    ],
  },
];
