# Arabic Quiz — project reference

## Stack & deploy
- Vanilla HTML/CSS/JS. No build step, no framework, no backend. localStorage only.
- Repo: https://github.com/FrankGunner2020/arabic-quiz (public)
- Live: https://arabic-quiz-gunner-ops.vercel.app (Vercel project gunner-ops/arabic-quiz), auto-deploys on push to main.
- Deploy lag can be 1-3 min — after pushing, curl the live URL and grep for a specific new string/line before declaring a change live. A curl immediately after push can give a false "not deployed" read.
- Local git identity for this repo (not global): name FrankGunner2020, email 279538098+FrankGunner2020@users.noreply.github.com
- Vercel "Deployment Protection" was manually disabled for this project (on by default for new projects) — check for this on any future fresh Vercel project for this user.

## Files
- `index.html` — header (practice line + Home/Word list buttons), #home-view (level cards), #quiz-view-root (stats band, quiz shell/panel, result view with plain-fail and milestone-pass sub-views, export panel), word-list modal.
- `style.css` — palette + design-system tokens live in :root vars: base palette (--header-bg #1b3a6b, --border #9fb9dd, --ink #16233d, --ink-dim #5b7299, --arabic #3d6cb9, --correct/--incorrect + *-bg pairs), radii (--radius-shell/panel/plate/pill), per-level hue sets (--l1/--l2/--l3 + *-tint/*-border/*-dim/*-pale/*-kicker), milestone dot hues (--dot-*). Soft rounding + tonal layering throughout (no box-shadows anywhere — see "Visual design system" below). Always reference the vars, never hardcode hex. Font is Source Serif 4, only weights 400/600 loaded — never set font-weight:700 on --serif text.
- `data.js` — 13 verbs x 7 persons (ech/du/hien/hatt/mir/dir/si = ana/anta/huwa/hiya/nahnu/antum/hum). `buildItems()` flattens to `ITEMS[]` with stable ids (`${verbId}.inf` or `${verbId}.${person}`), a `level` field (1=infinitive, 2=ana/anta/huwa/hiya, 3=nahnu/antum/hum), and each item's precomputed `acceptedAnswers`/`acceptedAltAnswers` (depends on matching.js's `generateAcceptedAnswers` — see "Grading rules" for the load-order/require wiring this needs).
- `matching.js` — grading (normalizeAnswer, generateAcceptedAnswers, isAnswerCorrect, isCorrectForItem) — exact-match only, no fuzzy tolerance, see "Grading rules" below — PLUS a separate, display-only diff engine (normalizeWithTrace, levenshteinAlign, diffAnswer) for incorrect-answer character-diff feedback. The two halves are independent — the diff engine never influences grading, keep it that way. `data.js` requires `generateAcceptedAnswers` from here to precompute each item's accepted-answer list; see script load order note under "Grading rules".
- `quiz.js` — state, view routing (home/quiz), fixed-test machinery (levels 1/2/3), home-screen cards (incl. per-card fraction badge), level-hue pills + milestone takeover rendering, the Day-N/answered-today practice line, per-level stats, answer-diff rendering, persistence, plus an unused continuous-practice picker kept as fallback architecture. Largest file — if it keeps growing, split by concern (test machinery / state / rendering) rather than letting one file keep absorbing everything.
- `scripts/self-test.js` — run via `node scripts/self-test.js`. Asserts every item's answer grades against itself, apostrophe-variant handling, and "right pronoun + wrong verb must be rejected." Run after any data.js/matching.js edit. Must stay 100%.
- `scripts/audit-hiya.js` — run via `node scripts/audit-hiya.js`. Verifies every hiya item's arVerb equals anta's and differs from huwa's, against a hardcoded reference table. Run after any data.js edit touching hien/hatt/hiya forms.
- `progress-log.json` — manually-committed record of verbs reaching full mastery, via the "New milestones" export panel. Not auto-written.

## Levels & test mechanics
- Level 1: 13 infinitives. Fixed test, 13 questions shuffled once per attempt, no repeats. Pass = 12/13 (85%+).
- Level 2: ana/anta/huwa/hiya, 52 items. Fixed test, same pattern. Pass = 45/52 (85%+).
- Level 3: nahnu/antum/hum, 39 items. Fixed test, same pattern as Levels 1/2. Pass = 34/39 (85%+). It's the last level: passing doesn't unlock a next level (`TEST_CONFIG[3].nextLevel` is `null`), so the result-screen action and the home card land back on Home / show "Completed — X/Y" instead of advancing. The weighted-repetition continuous-practice picker (`pickWeightedItem`/`activePool` in quiz.js) still exists but is unreachable now that all three levels have a `TEST_CONFIG` entry — kept as fallback architecture for a hypothetical future continuous-practice level.
- Shared fixed-test machinery lives in `TEST_CONFIG`, keyed by level — extend this rather than duplicating Level 1/2's logic for any future fixed-test level.
- `state.unlockedLevel` (monotonic) gates navigation, decoupled from `state.level` (which can move backward when replaying an already-passed level from home) — replaying Level 1 never re-locks Level 2.
- `state.lastTest[level] = {correctCount, total}` is a read-only snapshot for the home card's "Passed — X/Y" label — doesn't feed scoring/unlock logic.
- `ensureTest()` validates a saved test.order against id-existence AND `item.level === state.level`, regenerating if either check fails — guards against orphaned ids after a data.js rename and against a stale test belonging to a different level.
- Switching `state.level` away from an unfinished test to a DIFFERENT level discards that in-progress test (single global `state.test` slot, not per-level). Returning to the SAME level preserves progress. Known/accepted limitation, not a bug.
- Session stats (streak/accuracy/answered) tracked per level via `state.levelStats[level]`, accumulate across retries within a level (not reset per attempt).
- Home screen (`view = "home"|"quiz"`) is the landing page, runtime-only state, NOT persisted across reloads.

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
  milestone takeover field. `[data-level="1|2|3"]` (set statically on each
  `.level-card` in the HTML, and dynamically on `#quiz-card` by
  `renderQuizView()` from `state.level`) resolves `--level`/`--level-tint`/
  `--level-border`/`--level-dim`/`--level-pale`/`--level-kicker` — style
  rules should reference these generic aliases, never `--l1`/`--l2`/`--l3`
  directly, so nothing needs a per-level CSS selector.
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
- anta and hiya are CORRECTLY identical in Arabic (both take the ta- prefix) — this is grammatically right, not a bug. Do not "fix" it.
- Never repeat the same item as the immediately preceding question (lastItemId exclusion in the picker).
- Character-diff feedback (shown on incorrect answers) diffs `item.answer` (the verb-only string actually graded, not the full pronoun+verb displayAnswer) against what was typed. Alignment runs on normalized strings (`normalizeWithTrace`, mirroring `normalizeAnswer`'s apostrophe-folding and whitespace-collapsing exactly — no oo/aa folding there either, keep the two in sync if `normalizeAnswer` ever changes) but renders against the correct answer's real spelling. The backtrace prefers a deletion framing over substitution when costs tie (reads more like "you dropped a letter"); genuine substitutions (no zero-sub path exists) still show as substitutions — that's correct, not a bug. This engine is display-only and independent of grading (see matching.js's own file-level comment) — it was NOT the source of the yafam bug and needed no correctness fix, just a mirroring update to stay consistent with the new, simpler `normalizeAnswer`.

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
