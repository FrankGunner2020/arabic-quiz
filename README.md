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

**Three levels, strictly separated.**

1. *Level 1 — infinitives* — the 13 verb infinitives only. This is where
   every session starts.
2. *Level 2 — ana, anta, huwa* — the 39 conjugated forms for those three
   persons only (not mixed with infinitives). Unlocks automatically, no
   button, the instant all 13 infinitives have been answered correctly two
   times in a row. A brief one-time "Level 2 unlocked" message shows before
   the next question.
3. *Level 3 — nahnu, antum, hum* — the remaining 39 conjugated forms.
   Defined in the data model (see `data.js`) but not yet reachable in the
   UI; there's no auto-unlock wired up for it yet.

The current level is always shown as a label above the prompt.

**Answer matching is lenient, not strict.** Before comparing, both your input
and the correct answer are lowercased, stripped of apostrophes and excess
whitespace, and normalized so `oo`/`u` and `aa`/`a` are treated the same
(spelling variants of the same sound). On top of that, for answers 5+
characters long, a single-character typo (Levenshtein distance of 1) is
still accepted. The goal is testing whether you know the word, not your
typing precision.

**Spaced repetition, weighted by streak.** Each item (an infinitive or a
conjugated form) has a running correct-streak. The next question is picked
at random from the active level's item pool, weighted so that
lower-streak items come up more often:

```
weight = max(0.3, 3 - streak)
```

Mastered items don't disappear — they just fade into the background.

**Stats persist across sessions.** Per-item correct/incorrect counts and
streaks, plus overall totals (accuracy, running streak, questions answered),
are saved to `localStorage` after every answer and reloaded on page load.
There's no login and no backend — progress lives in the browser you're using.

**Progress milestones live in git, not just localStorage.** Since this is a
static site with no backend, the app can't write to the repo on its own.
Instead, whenever a verb reaches full mastery (all 7 of its items — the
infinitive plus 6 conjugations — at streak ≥ 2), a "New milestones" panel
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
    { lb: "ech sinn", arPronoun: "ana", arVerb: "akoon" },        // ech / ana
    { lb: "du bass", arPronoun: "anta", arVerb: "takoon" },       // du / anta
    { lb: "hien/hatt ass", arPronoun: "huwa", arVerb: "yakoon" }, // hien-hatt / huwa
    { lb: "mir sinn", arPronoun: "nahnu", arVerb: "nakoon" },     // mir / nahnu
    { lb: "dir sidd", arPronoun: "antum", arVerb: "takoonoon" },  // dir / antum
    { lb: "si sinn", arPronoun: "hum", arVerb: "yakoonoon" },     // si / hum
  ],
}
```

`data.js` flattens this into a single `ITEMS` array at load time — one entry
per infinitive and per conjugated form — each with a stable id of the shape
`sinn.inf` or `sinn.du`. That stable id is the key used for per-item stats in
`localStorage`, so ids need to stay stable across edits to the verb list.
Each item also gets a `level` (1: infinitive, 2: ech/du/hien-hatt forms, 3:
mir/dir/si forms) that the app filters on for the active level's pool.

## Files

```
index.html         markup: stats bar, quiz card, export panel
style.css          navy/soft-blue reference palette
data.js            the 13 verbs, their forms, and the ITEMS flattening
quiz.js            answer matching, item selection, leveling, stats, persistence, rendering
progress-log.json  dated record of verbs reaching full mastery
```

No build step, no framework, no backend. Open `index.html` or serve the
folder statically.
