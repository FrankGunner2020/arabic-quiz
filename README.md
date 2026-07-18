# Arabic Quiz

A personal language-learning ledger: it drills translating Lëtzebuergesch
(Luxembourgish) into Arabic, phonetically. There's no Arabic script here
on purpose — the goal is to internalize the sounds first, before reading
kicks in.

Direction is always one-way, Lëtzebuergesch → Arabic phonetic, because that's
the direction that actually trains speaking.

Two separate tracks, deliberately not blended together:

- **Verb conjugation (Levels 1/2/3)** — every question is typed, not
  multiple choice, so recall is forced rather than recognition. See
  "Verb conjugation" below.
- **Phrases** — everyday greetings and set phrases, drilled by multiple
  choice (recognition, not production) with no fixed test or pass
  threshold. See "Phrases" below.

Live at: https://arabic-quiz-gunner-ops.vercel.app

## Verb conjugation (Levels 1/2/3)

**A home screen is the landing page, not any particular level.** Every page
load opens on an overview with one card per level plus a Phrases card
(see below) — status ("Not started", "In progress", "Passed — X/Y"), a
mono fraction badge next to the title ("31/52"), a progress bar, and a
lock note for levels not yet unlocked — rather than always dropping back
into whichever level was last active. Each card is a soft-rounded shell
with a spine in its own color (blue for Level 1, teal for Level 2, amber
for Level 3, violet for Phrases) — the same hue carries through into that
section's pills, prompt background, and progress fill once you're inside
it. Clicking an unlocked level card jumps straight into that level,
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

The current level is shown as a pill above the prompt ("Level 2"), with a
second pill next to it naming the pronoun being drilled — Arabic pronoun ·
Lëtzebuergesch pronoun ("anta · du", "nahnu · mir") — hidden for Level 1,
which has no pronoun, and on the result screen, where there's no longer a
single current question to name. A "Word list" button in the header opens
a reference panel listing every item in the active level's pool
(Lëtzebuergesch alongside its Arabic phonetic form) for review before or
during practice.

**Passing a fixed test shows a full takeover, not just a message.** The
result screen normally shows a plain score-and-Retry view, but a genuine
pass replaces it with a level-hue takeover: the level's own color fills the
card, a kicker line names the level and the actual date it was passed
("Level 2 — passed · 18 July 2026"), the score renders large, a row of
small dots represents the pronouns just completed (skipped for Level 1,
which has none), and a closing line either points at the next level
("Ana, anta, huwa, hiya — yours. Level 3 unlocked.") or, for Level 3 since
it's the last one, declares the whole thing done ("Nahnu, antum, hum —
yours. Every level complete.") with a button back to the home screen
instead of a next level to jump to. Failing a test never shows this — the
takeover is reserved for real passes.

**The header keeps a running practice streak.** A persistent "Day N · X
answered today" line sits under the subtitle on every screen. Day N counts
consecutive calendar days with at least one answered question — a gap of a
day or more resets it back to 1 (never 0, and never with any guilt copy or
warning color), and "X answered today" resets silently at the first answer
of a new day.

**Answer matching accepts known spelling variants, not typos.** Every item's
correct answer has a small, precomputed list of accepted spellings — the
apostrophe present or omitted, `oo`/`u`, and `aa`/`a`, in whatever
combination actually applies to that specific word (a word with none of
those produces one accepted spelling, a word with one produces two, a word
with more produces the real combination — e.g. an apostrophe and `oo`
together produce four). Your input is lowercased and trimmed, then checked
for an exact match against that list. There's deliberately no fat-finger
tolerance beyond that (no "off by one letter is close enough"): fuzzy
matching used to allow that, but it couldn't tell a genuine typo of the
right word apart from a coincidentally similar wrong one — typing "yafam"
for wëssen's "ya'lam" (to know) was accepted even though "yafam" is
actually a fragment of a different verb entirely (verstoen's "yafham", to
understand). Precision over convenience.

**Per-item streaks feed milestones; the weighted-repetition picker itself
isn't used by anything right now.** Each item (an infinitive or a
conjugated form) tracks a running correct-streak regardless of which level
it's answered in — that streak is what milestone mastery (see below) is
based on. `quiz.js` also has a weighted-random item picker built for
continuous, open-ended practice, excluding whatever was just asked and
weighting so lower-streak items come up more often
(`weight = max(0.3, 3 - streak)`), but since all three conjugation levels
*and* Phrases (see below) are now fixed shuffle-once-no-repeats rounds,
nothing currently calls it — it's kept as ready-made architecture for any
future level or mode that wants that style of open-ended practice instead.

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
milestone logic — there's no progress-bar UI for them. Phrases has no
equivalent milestone/export system.

## Phrases

A separate content track, not a continuation of the numbered levels —
everyday greetings and set phrases (22 of them), drilled by recognition
instead of production. Always accessible from the home screen, no
unlocking required.

**Multiple choice, not typing.** The Lëtzebuergesch phrase and its English
gloss are shown the same way a conjugation prompt is; below it are 5
tappable Arabic phonetic options — the correct answer plus 4 distractors
drawn at random from the other 21 phrases' answers, freshly reshuffled
every question. Selecting an option grades immediately: right answers turn
green, a wrong pick turns red and the actually-correct option lights up
green too, so the right answer is always revealed. A "Next" button then
loads a new question. Grading here is a plain exact match on which option
was clicked — none of the spelling-variant/typo-tolerance machinery the
conjugation levels use applies, on purpose; there's nothing to type; so
there's nothing to grade the spelling of.

**A fixed round, same shape as the conjugation levels' fixed tests.** All
22 phrases are shuffled once at the start of a round and presented exactly
once each, with a counter under the prompt ("1/22" .. "22/22") — no
repeats, no endless loop. After the 22nd question a plain completion
screen shows the score out of 22 and a "New round" button that shuffles a
fresh attempt; there's no pass/fail threshold, since this isn't gated
content — the round is just done, not "passed" or "failed." The session
stats (streak/accuracy/answered) carry over from round to round rather
than resetting, same as the conjugation levels' stats accumulate across
retries. The home card's fraction badge works exactly like the numbered
levels' now too (`answered/total` mid-round, `total/total` once done).

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

Phrases has its own, much simpler dataset, unrelated to `VERBS`/`ITEMS` —
`PHRASES` in `data.js`, 22 flat objects with no flattening/build step:

```js
{ id: "gudde-moien", lb: "Gudde Moien", en: "good morning", ar: "sabah al-khayr" }
```

`id` is a hyphenated slug, kept distinct from the conjugation items' dotted
ids on purpose (`verbId.person` / `verbId.inf`) so per-item stats for the
two tracks can never collide even though they're tracked with the same
kind of `{ correct, incorrect, streak }` shape.

## Files

```
index.html         markup: header, home screen, quiz card, phrases card, export panel
style.css          navy/soft-blue palette, soft-rounded radii, per-level (+ phrases) hues
data.js            the 13 verbs, their forms, the ITEMS flattening, and the 22 PHRASES
matching.js        answer matching/grading -- conjugation levels only, unused by Phrases
quiz.js            answer matching, item selection, leveling, phrases, stats, persistence, rendering
progress-log.json  dated record of verbs reaching full mastery
```

No build step, no framework, no backend. Open `index.html` or serve the
folder statically.
