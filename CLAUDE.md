# Arabic Quiz — project reference

## Stack & deploy
- Vanilla HTML/CSS/JS. No build step, no framework, no backend. localStorage only.
- Repo: https://github.com/FrankGunner2020/arabic-quiz (public)
- Live: https://arabic-quiz-gunner-ops.vercel.app (Vercel project gunner-ops/arabic-quiz), auto-deploys on push to main.
- Deploy lag can be 1-3 min — after pushing, curl the live URL and grep for a specific new string/line before declaring a change live. A curl immediately after push can give a false "not deployed" read.
- Local git identity for this repo (not global): name FrankGunner2020, email 279538098+FrankGunner2020@users.noreply.github.com
- Vercel "Deployment Protection" was manually disabled for this project (on by default for new projects) — check for this on any future fresh Vercel project for this user.

## Files
- `index.html` — header (practice line + Home/Word list buttons), #home-view (level cards + the Phrases card), #quiz-view-root (stats band, quiz shell/panel, result view with plain-fail and milestone-pass sub-views, export panel), #phrases-view-root (its own stats band + quiz shell/panel, multiple-choice options), word-list modal.
- `style.css` — palette + design-system tokens live in :root vars: base palette (--header-bg #1b3a6b, --border #9fb9dd, --ink #16233d, --ink-dim #5b7299, --arabic #3d6cb9, --correct/--incorrect + *-bg pairs), radii (--radius-shell/panel/plate/pill), per-level hue sets (--l1/--l2/--l3/--phrases + *-tint/*-border/*-dim/*-pale/*-kicker), milestone dot hues (--dot-*). Soft rounding + tonal layering throughout (no box-shadows anywhere — see "Visual design system" below). Always reference the vars, never hardcode hex. Font is Source Serif 4, only weights 400/600 loaded — never set font-weight:700 on --serif text.
- `data.js` — 13 verbs x 7 persons (ech/du/hien/hatt/mir/dir/si = ana/anta/huwa/hiya/nahnu/antum/hum). `buildItems()` flattens to `ITEMS[]` with stable ids (`${verbId}.inf` or `${verbId}.${person}`), a `level` field (1=infinitive, 2=ana/anta/huwa/hiya, 3=nahnu/antum/hum), and each item's precomputed `acceptedAnswers`/`acceptedAltAnswers` (depends on matching.js's `generateAcceptedAnswers` — see "Grading rules" for the load-order/require wiring this needs). Also holds `PHRASES` (22 objects, see "Phrases" below) — a completely separate, much simpler dataset with no relationship to `ITEMS`/`VERBS` and no `generateAcceptedAnswers` involvement.
- `matching.js` — grading (normalizeAnswer, generateAcceptedAnswers, isAnswerCorrect, isCorrectForItem) — exact-match only, no fuzzy tolerance, see "Grading rules" below — PLUS a separate, display-only diff engine (normalizeWithTrace, levenshteinAlign, closestAcceptedAnswer, diffAnswer) for incorrect-answer character-diff feedback. The two halves are independent — the diff engine never influences grading, keep it that way. `data.js` requires `generateAcceptedAnswers` from here to precompute each item's accepted-answer list; see script load order note under "Grading rules". None of this file is used by Phrases (see below) — that section grades separately and deliberately doesn't import anything from here.
- `quiz.js` — state, view routing (home/quiz/phrases), fixed-test machinery (levels 1/2/3), home-screen cards (incl. per-card fraction badge), level-hue pills + milestone takeover rendering, the Day-N/answered-today practice line, per-level stats, answer-diff rendering, persistence, the Phrases section (see below), plus a shared weighted-repetition picker (`weightedPick`) used by both the conjugation levels' dormant continuous-practice fallback and by Phrases for real. Largest file — if it keeps growing, split by concern (test machinery / state / rendering / phrases) rather than letting one file keep absorbing everything.
- `scripts/self-test.js` — run via `node scripts/self-test.js`. Asserts every item's answer grades against itself, apostrophe-variant handling, and "right pronoun + wrong verb must be rejected." Run after any data.js/matching.js edit. Must stay 100%. Conjugation-only — doesn't cover Phrases (nothing in that section touches matching.js/data.js's `ITEMS`, so there's nothing for this suite to regress).
- `scripts/audit-hiya.js` — run via `node scripts/audit-hiya.js`. Verifies every hiya item's arVerb equals anta's and differs from huwa's, against a hardcoded reference table. Run after any data.js edit touching hien/hatt/hiya forms.
- `progress-log.json` — manually-committed record of verbs reaching full mastery, via the "New milestones" export panel. Not auto-written. Phrases has no equivalent milestone/export concept.

## Levels & test mechanics
- Level 1: 13 infinitives. Fixed test, 13 questions shuffled once per attempt, no repeats. Pass = 12/13 (85%+).
- Level 2: ana/anta/huwa/hiya, 52 items. Fixed test, same pattern. Pass = 45/52 (85%+).
- Level 3: nahnu/antum/hum, 39 items. Fixed test, same pattern as Levels 1/2. Pass = 34/39 (85%+). It's the last level: passing doesn't unlock a next level (`TEST_CONFIG[3].nextLevel` is `null`), so the result-screen action and the home card land back on Home / show "Completed — X/Y" instead of advancing. The weighted-repetition continuous-practice picker (`weightedPick`/`pickWeightedItem`/`activePool` in quiz.js) still exists but is unreachable by any conjugation level now that all three have a `TEST_CONFIG` entry — no longer purely hypothetical fallback architecture, though: Phrases (see below) actually uses `weightedPick` for real.
- Shared fixed-test machinery lives in `TEST_CONFIG`, keyed by level — extend this rather than duplicating Level 1/2's logic for any future fixed-test level. Phrases deliberately does NOT use this (see below) — it has no fixed test at all.
- `state.unlockedLevel` (monotonic) gates navigation, decoupled from `state.level` (which can move backward when replaying an already-passed level from home) — replaying Level 1 never re-locks Level 2. Phrases has no unlock concept at all — always accessible.
- `state.lastTest[level] = {correctCount, total}` is a read-only snapshot for the home card's "Passed — X/Y" label — doesn't feed scoring/unlock logic.
- `ensureTest()` validates a saved test.order against id-existence AND `item.level === state.level`, regenerating if either check fails — guards against orphaned ids after a data.js rename and against a stale test belonging to a different level.
- Switching `state.level` away from an unfinished test to a DIFFERENT level discards that in-progress test (single global `state.test` slot, not per-level). Returning to the SAME level preserves progress. Known/accepted limitation, not a bug.
- Session stats (streak/accuracy/answered) tracked per level via `state.levelStats[level]`, accumulate across retries within a level (not reset per attempt).
- Home screen (`view = "home"|"quiz"|"phrases"`) is the landing page, runtime-only state, NOT persisted across reloads. `render()` branches three ways on `view`; `els.homeView`/`els.quizViewRoot`/`els.phrasesViewRoot` visibility is set explicitly for all three on every render, not just toggled between two.

## Phrases
A separate content track from the numbered conjugation levels above, not a
continuation of them — different skill (phrase recognition vs. verb
production), different question format (multiple choice vs. typing), no
fixed test/pass-threshold, no unlock gating. Deliberately architected as
its own thing rather than squeezed into the `state.level`/`TEST_CONFIG`
system, which is fixed-test-shaped and doesn't fit multiple choice or
"no target length" well.
- Data: `PHRASES` in data.js — 22 plain objects `{ id, lb, en, ar }`
  (Lëtzebuergesch text, English gloss, Arabic Fusha phonetic answer). `id`
  is a hyphenated slug (e.g. `"gudde-moien"`), never derived from `lb`/`en`
  at runtime, and never overlaps the conjugation items' dotted id scheme
  (`verbId.person`/`verbId.inf`) — the two id namespaces coexist safely
  without ever needing to check for collisions.
- Grading is deliberately trivial and fully separate from matching.js: a
  clicked option is correct iff its text === `currentPhrase.ar` exactly
  (`handlePhraseAnswer` in quiz.js). No normalization, no accepted-answer
  lists, no `generateAcceptedAnswers` involvement at all — don't route
  Phrases through any of the conjugation levels' grading machinery, even
  if it looks reusable at a glance.
- Multiple choice: `buildPhraseOptions(phrase)` shuffles the other 21
  phrases, takes 4 of their `ar` values as distractors, adds the correct
  `ar`, and shuffles the resulting 5 — freshly reshuffled every question,
  not a fixed distractor set. Reuses the same `shuffle()` the fixed tests
  use for their question order.
- Continuous weighted-repetition practice — the same mechanic Level 3 used
  before it became a fixed test, and the reason that mechanic was kept
  around as "fallback architecture" in the first place. `pickWeightedPhrase()`
  and `pickWeightedItem()` are both now thin wrappers around a shared
  `weightedPick(pool, excludeId, getStats)` (same streak-weighting formula,
  `max(0.3, 3 - streak)`, and no-immediate-repeat rule as before) instead of
  duplicating that logic. This can become a fixed test later (add a
  `TEST_CONFIG` entry, a phrase pool, etc.) without restructuring the picker.
- State lives in `state.phrases = { items, stats }` — its own namespace,
  separate from `state.items`/`state.levelStats` even though there's no
  actual id-collision risk (hyphenated vs. dotted ids). Kept apart on
  purpose, for architectural independence, not because it was technically
  required. `state.phrases.stats` accumulates forever, same as `levelStats`
  (never reset except via `defaultState()`). `recordPhraseAnswer()` still
  calls `touchPracticeDay()` — the header's Day-N/answered-today line is a
  global practice measure across every content track, not conjugation-only.
  It does NOT call `checkMilestones()` — phrases have no verb-mastery/export
  equivalent.
- Home card (`#phrases-card`) reuses the exact `.level-card` markup/CSS as
  the numbered levels, with its own hue (`--phrases`, a violet, added
  alongside `--l1/--l2/--l3` with the same tint/border/dim/pale/kicker
  companion tokens, resolved via `[data-level="phrases"]` in the same alias
  block). Its fraction badge is "coverage" (phrases attempted at least
  once, tracked by presence as a key in `state.phrases.items` / 22 total)
  rather than a fixed-test fraction, since there's no fixed test to measure
  progress through.
- Quiz view (`#phrases-view-root`) is a fully separate DOM region, not
  layered into `#quiz-view-root`. It reuses the SAME CSS classes
  (`.session-stats`, `.quiz-shell`, `.quiz-panel`, `.q-pills`,
  `.prompt-plate`) for visual consistency with the conjugation levels, but
  none of the underlying render functions, state, or grading are shared.
- The "Word list" header button hides while `view === "phrases"` — that
  feature is specific to conjugation content and would be confusing to
  leave visible/functional while browsing phrases.

## Visual design system
Soft-roundness redesign layered onto the original navy/ivory, serif-content/
sans-chrome system (fonts and base palette unchanged). No box-shadows
anywhere — depth comes from tonal layering and the navy band, never shadows.
- Radii: `--radius-shell` (18px, outer containers: header top corners, home
  cards, quiz shell, milestone), `--radius-panel` (14px, white inner
  panels/cards), `--radius-plate` (10px, prompt plate/input/buttons),
  `--radius-pill` (999px, chips/tags/progress tracks).
- Each level owns one hue (`--l1` blue, `--l2` teal, `--l3` amber) used on
  its home-card spine, progress fill, prompt plate tint, pills, and its
  milestone takeover field. Phrases (see below) has the same kind of hue
  (`--phrases`, violet) even though it isn't a numbered level, via
  `data-level="phrases"` rather than a number. `[data-level="1|2|3|phrases"]`
  (set statically on each `.level-card`/`#phrases-card` in the HTML, and
  dynamically on `#quiz-card` by `renderQuizView()` from `state.level` for
  the conjugation levels, statically on `#phrases-card-quiz` since that one
  never changes) resolves `--level`/`--level-tint`/`--level-border`/
  `--level-dim`/`--level-pale`/`--level-kicker` — style rules should
  reference these generic aliases, never `--l1`/`--l2`/`--l3`/`--phrases`
  directly, so nothing needs a per-level (or per-track) CSS selector.
- Home cards: a `--level`-colored spine, title + mono fraction badge
  (`answered/total` in progress, `total/total` once done pass or fail, sunk
  to `0/total` when locked or not-started — the badge tracks "how much of
  the test have you gone through", the status label below it is what shows
  the actual score). No lock emoji — `.level-card:disabled { opacity: .6 }`
  alone signals locked.
- Quiz view: a navy `.session-stats` band joins directly to the white
  `.quiz-panel` below it (one visually continuous rounded shell). Inside
  the panel: a level pill + pronoun pill (`anta · du` — Arabic pronoun ·
  the Lëtzebuergesch person word, which is literally the PERSONS key already
  used everywhere else) above a tinted `.prompt-plate`; pronoun pill hidden
  for Level 1 (no pronoun) and on the result view (no single "current
  question" to attribute it to).
- Passing a fixed test shows a `.milestone` takeover (`#milestone-view`)
  instead of the plain result view — level-hue field, kicker
  ("Level N — passed/complete · <date>", using each test's `passedAt`
  snapshot so a delayed revisit still shows the real pass date, not
  "today"), giant score, pronoun dots (one per person in that level's
  `LEVEL_PRONOUNS`, omitted for Level 1), and an unlock/completion line.
  Failing always shows the plain `#result-plain` view (score + Retry) —
  the takeover is reserved for genuine passes. Both `#result-action` and
  `#milestone-action` share one `handleResultAction()` handler.
- Header has a persistent "Day N · X answered today" line
  (`state.dayCount`/`state.todayCount`/`state.lastPracticeDate`, updated by
  `touchPracticeDay()` inside `recordAnswer()` — same-day answers just bump
  the count, a gap of a day increments dayCount, any bigger gap resets it
  to 1, never 0). Deliberately no guilt copy or warning color on a reset.
- Micro-motion is restrained and one-shot: feedback chip fades/rises in,
  the streak stat does a quick scale-bump on a correct answer (retriggered
  via a forced-reflow class toggle, since the same class can't re-animate
  by just re-adding it), the milestone takeover fades in. Everything is
  disabled under `@media (prefers-reduced-motion: reduce)`.
- Gotcha (real bug, not hypothetical): any element whose own CSS sets a
  `display` value needs an explicit `#id[hidden] { display: none; }` (or
  equivalent) rule, or the `hidden` attribute silently stops hiding it —
  author `display` rules beat the browser's default `[hidden]{display:none}`
  regardless of selector specificity. `#home-view` was missing this and
  rendered on top of the quiz view; `.modal-overlay` already had the guard.
  Check for this pattern before giving any element its own unconditional
  `display` rule.

## Grading rules — hard-won, do not regress
Grading is exact-match-only against precomputed, per-item accepted-answer
lists — there is no fuzzy/edit-distance tolerance anywhere in the grading
path anymore. This replaced an earlier Levenshtein-1 typo-tolerance design
after three real bugs, the first two sharing one root cause and the third
being a different failure mode of fuzzy matching generally:
- Bug 1 & 2 (old first-character-lock era): huwa's "yakoon" was accepted as
  hiya's "takoon", and separately "anta amlik" was accepted for the anta
  prompt whose correct answer is "tamlik" — both were "the first character
  of the compared string matched, but the character that actually mattered
  (the verb's own leading letter) didn't, because something was in front of
  it" (a pronoun, in bug 2's case). Fixed at the time by requiring the first
  character to match exactly before typo tolerance applied.
- Bug 3: "yafam" was accepted for wëssen's infinitive ("ya'lam", to know) —
  it's exactly one substitution away from normalized "yalam" and shares the
  first character, so Levenshtein-1 tolerance waved it through, but "yafam"
  isn't a typo of "yalam" at all: it's a fragment of a completely different
  verb, "yafham" (to understand, verstoen). This is the general problem
  with fuzzy edit-distance for this app: it can't distinguish "a real typo
  of the right word" from "a coincidentally similar wrong word", and no
  amount of additional lock-the-first-character-style patching closes that
  off in general (bug 3 wasn't even a first-character case). Fixed by
  replacing fuzzy tolerance entirely with explicit accepted-answer lists.
- Current design: `data.js`'s `buildItems()` calls
  `generateAcceptedAnswers()` (matching.js) on each item's own `answer` and
  `altAnswer` to precompute `acceptedAnswers`/`acceptedAltAnswers` —  every
  known-safe spelling variant (apostrophe optional, oo<->u, aa<->a; only
  the combinations that actually apply to that specific word) enumerated as
  explicit strings, generated only from that item's own answer. Grading
  (`isCorrectForItem` in matching.js) normalizes the typed input (lowercase
  + fold apostrophe-lookalike characters to one canonical character +
  collapse whitespace — deterministic substitution, not fuzzy) and checks
  for an exact match against the item's list. Since each item's list is
  generated only from its own answer, one item's tolerance can never leak
  into accepting a different item's spelling — this structurally prevents
  the whole class of bugs 1-3, not just patches around each instance, so
  `audit-hiya.js` is now a redundant safety net rather than the only guard.
- Trade-off, not a bug: a genuine dropped-letter/extra-letter typo that
  isn't one of the generated variants is now marked wrong, since there's no
  fuzzy forgiveness left. That's the intentional trade — precision over
  convenience.
- `index.html` loads `matching.js` before `data.js` specifically so
  `generateAcceptedAnswers` is available as a global when `buildItems()`
  runs; under Node, `data.js` explicitly `require("./matching.js")`s it
  onto `global` at the top of the file for the same reason (self-test.js
  and audit-hiya.js both require data.js directly, and Node doesn't share
  globals between required files the way browser `<script>` tags do).
- Both the verb-only answer AND, for any item that has one, the full pronoun+verb phrase (`altAnswer`) are accepted answers — `acceptedAnswers` and `acceptedAltAnswers` are both generated by `generateAcceptedAnswers()`, from that item's own `answer`/`altAnswer` respectively (level 1 infinitives have no pronoun, so `altAnswer`/`acceptedAltAnswers` are `null` for those). `isCorrectForItem` checks both lists. Don't ever generate `acceptedAnswers` from only the verb-only form and skip `acceptedAltAnswers` — that's a real regression that surfaced once (gesinn.du's "anta tara" briefly looked rejected in a bug report, though the actually-committed code turned out to already generate both lists correctly — the report's specific example, "anta ara", was simply never correct in the first place, since "ara" is ana's verb, not anta's "tara". Verify against the real `altAnswer` string before trusting a report like this, per the workflow convention below).
- anta and hiya are CORRECTLY identical in Arabic (both take the ta- prefix) — this is grammatically right, not a bug. Do not "fix" it.
- Never repeat the same item as the immediately preceding question (lastItemId exclusion in the picker).
- Character-diff feedback (shown on incorrect answers) diffs against whichever of the item's accepted variants — verb-only or full-phrase, and either one's own spelling variants — has the lowest edit distance to what was actually typed (`closestAcceptedAnswer` in matching.js, used by `renderAnswerDiff` in quiz.js), not always the verb-only answer. This matters because someone who legitimately types the full phrase but gets the verb wrong (e.g. "anta xyz" for gesinn.du) needs their correct pronoun to align as a match against "anta tara", not get diffed against the bare verb-only "tara" where the pronoun has nothing to align with and renders as garbled/wrong. `closestAcceptedAnswer` is display-only, same as the rest of this section — which variant "looks closest" never feeds back into whether the answer was graded correct; that was already decided by `isCorrectForItem` before this runs. Alignment itself runs on normalized strings (`normalizeWithTrace`, mirroring `normalizeAnswer`'s apostrophe-folding and whitespace-collapsing exactly — no oo/aa folding there either, keep the two in sync if `normalizeAnswer` ever changes) but renders against the chosen target's real spelling. The backtrace prefers a deletion framing over substitution when costs tie (reads more like "you dropped a letter"); genuine substitutions (no zero-sub path exists) still show as substitutions — that's correct, not a bug.
- `diffAnswer` returns `{ wordSegments, extraSegments }`, not a flat list — `wordSegments` (match/sub/missing) concatenate to the correct answer's own intact spelling and must always be rendered as one uninterrupted span; `extraSegments` (leftover typed characters not part of the correct answer at all) must be rendered as a clearly separate annotation, never spliced directly after the word. Splicing them together used to read as the correct answer itself containing a struck-through mistake (typing "tandhura" for "tandhur" rendered as "tandhur" immediately followed by a struck-through "a", looking like "tandhura" was the correct-but-flawed answer). `renderAnswerDiff` (quiz.js) renders `wordSegments` inside `.answer-diff` and, only if `extraSegments` is non-empty, appends a visually distinct `.answer-diff-extra-note` (sans-serif, not mono/italic like the word) reading "(also typed ...)".
- `closestAcceptedAnswer` also returns `isDifferentWord` (true when the edit distance to even its best candidate exceeds `DIFFERENT_WORD_RATIO` — currently half — of that candidate's length). When true, `renderAnswerDiff` skips the granular diff entirely and shows `item.answer` plainly — a character-by-character alignment between two genuinely unrelated words (e.g. typing "tara" for "tandhur", 5 of 7 characters off) is an awkward, confusing diff, not useful feedback. Deliberately simple, not tuned per-word.

## Workflow conventions
- One commit per logical change; message explains *why*, not just *what*.
- Before committing anything touching data.js or matching.js: run `node scripts/self-test.js` and `node scripts/audit-hiya.js`. Both must stay 100%. If a change legitimately changes an outcome, that's a five-alarm moment — stop and confirm with the user before proceeding, don't just update the test to match.
- When fixing a real grading bug: reproduce it first with an isolated repro against the actual repo files (not a mental trace) BEFORE writing the fix. Add a permanent regression case to self-test.js afterward, and verify the new test actually fails on the old (pre-fix) code before trusting it as a real guard.
- After pushing: curl the live URL and grep for a specific new string/line to confirm the deploy actually picked up the change, rather than assuming push succeeded means live succeeded.
- If a user's bug report contradicts what a read of the code shows, verify with an actual repro before fixing the assumed cause. If the repro confirms a real bug in logic that was declared off-limits in an earlier, unrelated task ("don't touch grading logic" for that task), that constraint was scoped to that task's specific ask, not a standing prohibition — fix real bugs when found, just don't casually touch working logic outside of an actual reported bug.
- Read only the files directly relevant to whatever the current task touches. This file should cover orientation — no need to re-read all of quiz.js/style.css/data.js/matching.js up front just to get oriented.
- Keep README.md in sync with behavior changes as they're made, not as a batch cleanup later — it's read as "how this app currently works," and a stale README is worse than no README.

## Open gaps
- In-progress test state is lost when switching to a different level mid-test (see above) — accepted limitation, not a bug.
