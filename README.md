# Arabic Quiz

A personal language-learning ledger: it drills translating Lëtzebuergesch
(Luxembourgish) verbs into Arabic, phonetically. There's no Arabic script here
on purpose — the goal is to internalize the sounds first, before reading
kicks in.

Direction is always one-way, Lëtzebuergesch → Arabic phonetic, because that's
the direction that actually trains speaking. Every question is typed, not
multiple choice, so recall is forced rather than recognition.

Live at: https://arabic-quiz-gunner-ops.vercel.app

## Mechanics

**A home screen is the landing page, not any particular level.** Every page
load opens on an overview with one card per level — status ("Not started",
"In progress", "Passed — X/Y"), a progress bar, and a lock note for levels
not yet unlocked — rather than always dropping back into whichever level
was last active. Clicking an unlocked card jumps straight into that level,
resuming an in-progress attempt if one exists or starting fresh otherwise;
replaying an already-passed level is always allowed and never re-locks a
later level (unlocking only ever moves forward, tracked separately from
"which level am I currently looking at"). A "Home" button appears in the
header once you're inside a level, so you can back out to the overview
mid-attempt without losing progress — in-progress test state is only ever
discarded if you navigate into a *different* level while one is unfinished.
Level 3 is the last level: its card links into its fixed test just like
Levels 1/2 once unlocked, but passing it shows a "Completed — X/Y" card
instead of unlocking anything further.

**Three levels, strictly separated, each with the same fixed-test progression style.**

1. *Level 1 — infinitives* — the 13 verb infinitives only, run as a fixed
   13-question test rather than open-ended practice. Each attempt shuffles
   the 13 once and asks every item exactly once (no repeats within an
   attempt), with a counter under the input ("1/13" .. "13/13"). After the
   13th question a result screen shows the score and percentage. 12/13
   (~92%) or better passes — 11/13 (~85%) lands just under the bar — and
   unlocks Level 2 with a button to go straight there; anything lower shows
   the score with a Retry button that reshuffles a fresh attempt. There's no
   way into Level 2 without a passing attempt.
2. *Level 2 — ana, anta, huwa, hiya* — the 52 conjugated forms for those
   four persons only (not mixed with infinitives). huwa (hien) and hiya
   (hatt) are always separate quiz items, never combined, even though in
   Arabic the hiya verb form is spelled identically to the anta form for
   every verb here — both take the tā- prefix. Same fixed-test pattern as
   Level 1: one shuffled pass through all 52 with no repeats, a counter
   ("1/52" .. "52/52"), and a result screen. 45/52 (~87%) or better passes
   — 44/52 (~85%) lands just under the bar — and unlocks Level 3; anything
   lower shows the score with a Retry button that reshuffles a fresh
   52-question attempt. The shared fixed-test machinery (shuffle, counter,
   pass/fail result screen) lives in one place in `quiz.js`, parameterized
   per level, rather than being duplicated between Level 1 and Level 2.
3. *Level 3 — nahnu, antum, hum* — the remaining 39 conjugated forms,
   reachable once Level 2 is passed. Same fixed-test pattern as Levels 1/2:
   one shuffled pass through all 39 with no repeats, a counter ("1/39" ..
   "39/39"), and a result screen. 34/39 (~87%) or better passes — 33/39
   (~85%) lands just under the bar. Since it's the last level, passing
   doesn't unlock anything further — the result screen and home card just
   show a completed state, with a Retry button on a failed attempt exactly
   like Levels 1/2.

The current level is always shown as a label above the prompt. A "Word
list" button in the header opens a reference panel listing every item in
the active level's pool (Lëtzebuergesch alongside its Arabic phonetic form)
for review before or during practice.

**Answer matching is lenient, not strict.** Before comparing, both your input
and the correct answer are lowercased, stripped of apostrophes and excess
whitespace, and normalized so `oo`/`u` and `aa`/`a` are treated the same
(spelling variants of the same sound). On top of that, for answers 5+
characters long, a single-character typo (Levenshtein distance of 1) is
still accepted. The goal is testing whether you know the word, not your
typing precision.

**Per-item streaks feed milestones; the weighted-repetition picker itself is
currently unused.** Each item (an infinitive or a conjugated form) tracks a
running correct-streak regardless of which level it's answered in — that
streak is what milestone mastery (see below) is based on. `quiz.js` also
has a weighted-random item picker built for continuous, open-ended
practice, excluding whatever was just asked and weighting so lower-streak
items come up more often (`weight = max(0.3, 3 - streak)`), but since all
three levels are now fixed shuffle-once-no-repeats tests, no level actually
calls it — it's kept as ready-made fallback architecture for any future
level that wants that style of practice instead.

**Stats persist across sessions, scoped per level.** Per-item correct/
incorrect counts and streaks are tracked globally (used for weighting and
milestones, regardless of level). The session stats bar (streak, accuracy,
questions answered), however, is tracked separately per level and always
shows only the currently active level's numbers — passing Level 1 and
moving to Level 2 doesn't carry Level 1's accuracy into Level 2's display.
Switching levels never discards a level's stats; they're just not shown
while another level is active. Within a level, these stats accumulate
across attempts rather than resetting on retry — a failed Level 1 attempt
followed by a retry keeps accumulating into the same Level 1 totals rather
than starting over. Everything is saved to `localStorage` after every
answer and reloaded on page load. There's no login and no backend —
progress lives in the browser you're using.

**Progress milestones live in git, not just localStorage.** Since this is a
static site with no backend, the app can't write to the repo on its own.
Instead, whenever a verb reaches full mastery (all 8 of its items — the
infinitive plus 7 conjugations — at streak ≥ 2), a "New milestones" panel
appears below the quiz card with a ready-to-paste JSON snippet. Copy it
into [`progress-log.json`](progress-log.json) and commit — that's what turns
"I actually learned this" into a real, dated entry in the git history,
alongside the code changes. Per-item correct/incorrect/streak stats are
tracked for every item regardless of level, purely for this weighting and
milestone logic — there's no progress-bar UI for them.

## Data model

All quiz content lives in [`data.js`](data.js). Each of the 13 verbs is an
object with:

```js
{
  id: "sinn",
  infinitive: { lb: "sinn", ar: "yakoon", en: "to be" },
  forms: [
    { lb: "ech sinn", arPronoun: "ana", arVerb: "akoon" },       // ech / ana
    { lb: "du bass", arPronoun: "anta", arVerb: "takoon" },      // du / anta
    { lb: "hien ass", arPronoun: "huwa", arVerb: "yakoon" },     // hien / huwa
    { lb: "hatt ass", arPronoun: "hiya", arVerb: "takoon" },     // hatt / hiya
    { lb: "mir sinn", arPronoun: "nahnu", arVerb: "nakoon" },    // mir / nahnu
    { lb: "dir sidd", arPronoun: "antum", arVerb: "takoonoon" }, // dir / antum
    { lb: "si sinn", arPronoun: "hum", arVerb: "yakoonoon" },    // si / hum
  ],
}
```

hien (huwa) and hatt (hiya) are always distinct entries, never combined —
note that hatt's `arVerb` is the same string as anta's `arVerb` (`takoon`
above), since the hiya conjugation is spelled identically to anta's for
every verb in this dataset.

`data.js` flattens this into a single `ITEMS` array at load time — one entry
per infinitive and per conjugated form — each with a stable id of the shape
`sinn.inf` or `sinn.du`. That stable id is the key used for per-item stats in
`localStorage`, so ids need to stay stable across edits to the verb list.
Each item also gets a `level` (1: infinitive, 2: ech/du/hien/hatt forms, 3:
mir/dir/si forms) that the app filters on for the active level's pool.

## Files

```
index.html         markup: header, home screen, quiz card, export panel
style.css          navy/soft-blue reference palette
data.js            the 13 verbs, their forms, and the ITEMS flattening
quiz.js            answer matching, item selection, leveling, stats, persistence, rendering
progress-log.json  dated record of verbs reaching full mastery
```

No build step, no framework, no backend. Open `index.html` or serve the
folder statically.
