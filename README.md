# Arabic Quiz

A personal language-learning ledger: it drills translating Lëtzebuergesch
(Luxembourgish) verbs into Arabic, phonetically. There's no Arabic script here
on purpose — the goal is to internalize the sounds first, before reading
kicks in.

Direction is always one-way, Lëtzebuergesch → Arabic phonetic, because that's
the direction that actually trains speaking. Every question is typed, not
multiple choice, so recall is forced rather than recognition.

Live at: (added once deployed)

## Mechanics

**Two stages.**

1. *Infinitives* — the 13 verb infinitives. This is the only stage available
   at first.
2. *All forms* — the 13 infinitives plus all 78 conjugated forms (13 verbs ×
   6 persons: ech/du/hien-hatt/mir/dir/si). This unlocks automatically once
   every infinitive has been answered correctly two times in a row, with a
   banner inviting a switch. You can also toggle back to infinitives-only at
   any time from the stage button in the top right, even after unlocking.

**Answer matching is lenient, not strict.** Before comparing, both your input
and the correct answer are lowercased, stripped of apostrophes and excess
whitespace, and normalized so `oo`/`u` and `aa`/`a` are treated the same
(spelling variants of the same sound). On top of that, for answers 5+
characters long, a single-character typo (Levenshtein distance of 1) is
still accepted. The goal is testing whether you know the word, not your
typing precision.

**Spaced repetition, weighted by streak.** Each item (an infinitive or a
conjugated form) has a running correct-streak. The next question is picked
at random from the active stage's item pool, weighted so that
lower-streak items come up more often:

```
weight = max(0.3, 3 - streak)
```

Mastered items don't disappear — they just fade into the background.

**Stats persist across sessions.** Per-item correct/incorrect counts and
streaks, plus overall totals (accuracy, running streak, questions answered),
are saved to `localStorage` after every answer and reloaded on page load.
There's no login and no backend — progress lives in the browser you're using.

**Mastery grid.** Below the quiz, each of the 13 verbs shows a small progress
bar. On the infinitives stage that's just "is the infinitive mastered
(streak ≥ 2)?" On the all-forms stage it aggregates all 7 items per verb (the
infinitive plus its 6 conjugations).

## Data model

All quiz content lives in [`data.js`](data.js). Each of the 13 verbs is an
object with:

```js
{
  id: "sinn",
  infinitive: { lb: "sinn", ar: "yakoon", en: "to be" },
  forms: [
    { lb: "ech sinn", ar: "ana akoon" },      // ech / ana
    { lb: "du bass", ar: "anta takoon" },     // du / anta
    { lb: "hien/hatt ass", ar: "huwa yakoon" },// hien-hatt / huwa
    { lb: "mir sinn", ar: "nahnu nakoon" },   // mir / nahnu
    { lb: "dir sidd", ar: "antum takoonoon" },// dir / antum
    { lb: "si sinn", ar: "hum yakoonoon" },   // si / hum
  ],
}
```

`data.js` flattens this into a single `ITEMS` array at load time — one entry
per infinitive and per conjugated form — each with a stable id of the shape
`sinn.inf` or `sinn.du`. That stable id is the key used for per-item stats in
`localStorage`, so ids need to stay stable across edits to the verb list.

## Files

```
index.html   markup: stats bar, stage toggle, quiz card, mastery grid
style.css    dark editorial theme
data.js      the 13 verbs, their forms, and the ITEMS flattening
quiz.js      answer matching, item selection, stats, persistence, rendering
```

No build step, no framework, no backend. Open `index.html` or serve the
folder statically.
