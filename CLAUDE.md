# Arabic Quiz — project reference

## Stack & deploy
- Vanilla HTML/CSS/JS. No build step, no framework, no backend. localStorage only.
- Repo: https://github.com/FrankGunner2020/arabic-quiz (public)
- Live: https://arabic-quiz-gunner-ops.vercel.app (Vercel project gunner-ops/arabic-quiz), auto-deploys on push to main.
- Deploy lag can be 1-3 min — after pushing, curl the live URL and grep for a specific new string/line before declaring a change live. A curl immediately after push can give a false "not deployed" read.
- Local git identity for this repo (not global): name FrankGunner2020, email 279538098+FrankGunner2020@users.noreply.github.com
- Vercel "Deployment Protection" was manually disabled for this project (on by default for new projects) — check for this on any future fresh Vercel project for this user.

## Files
- `index.html` — header (Home + Word list buttons), #home-view (level cards), #quiz-view-root (stats bar, quiz card, export panel), word-list modal.
- `style.css` — palette lives in :root vars (--header-bg #1b3a6b, --border #9fb9dd, --ink #16233d, --ink-dim #5b7299, --arabic #3d6cb9, --correct/--incorrect + *-bg pairs). Flat rectangles only — no border-radius, no box-shadow anywhere. Always reference the vars, never hardcode hex. Font is Source Serif 4, only weights 400/600 loaded — never set font-weight:700 on --serif text.
- `data.js` — 13 verbs x 7 persons (ech/du/hien/hatt/mir/dir/si = ana/anta/huwa/hiya/nahnu/antum/hum). `buildItems()` flattens to `ITEMS[]` with stable ids (`${verbId}.inf` or `${verbId}.${person}`) and a `level` field (1=infinitive, 2=ana/anta/huwa/hiya, 3=nahnu/antum/hum).
- `matching.js` — grading (normalizeAnswer, levenshtein, isAnswerCorrect, isCorrectForItem) PLUS a separate, display-only diff engine (normalizeWithTrace, levenshteinAlign, diffAnswer) for incorrect-answer character-diff feedback. The two halves are independent — the diff engine never influences grading, keep it that way.
- `quiz.js` — state, view routing (home/quiz), fixed-test machinery (levels 1/2), continuous practice (level 3), home-screen cards, per-level stats, answer-diff rendering, persistence. Largest file — if it keeps growing, split by concern (test machinery / state / rendering) rather than letting one file keep absorbing everything.
- `scripts/self-test.js` — run via `node scripts/self-test.js`. Asserts every item's answer grades against itself, apostrophe-variant handling, and "right pronoun + wrong verb must be rejected." Run after any data.js/matching.js edit. Must stay 100%.
- `scripts/audit-hiya.js` — run via `node scripts/audit-hiya.js`. Verifies every hiya item's arVerb equals anta's and differs from huwa's, against a hardcoded reference table. Run after any data.js edit touching hien/hatt/hiya forms.
- `progress-log.json` — manually-committed record of verbs reaching full mastery, via the "New milestones" export panel. Not auto-written.

## Levels & test mechanics
- Level 1: 13 infinitives. Fixed test, 13 questions shuffled once per attempt, no repeats. Pass = 12/13 (85%+).
- Level 2: ana/anta/huwa/hiya, 52 items. Fixed test, same pattern. Pass = 45/52 (85%+).
- Level 3: nahnu/antum/hum, 39 items. Continuous weighted-repetition practice, no fixed test, no TEST_CONFIG entry, not linked from the home screen yet ("Coming soon"). Ask the user for fixed-vs-continuous preference before ever building a real Level 3 flow.
- Shared fixed-test machinery lives in `TEST_CONFIG`, keyed by level — extend this rather than duplicating Level 1/2's logic for any future fixed-test level.
- `state.unlockedLevel` (monotonic) gates navigation, decoupled from `state.level` (which can move backward when replaying an already-passed level from home) — replaying Level 1 never re-locks Level 2.
- `state.lastTest[level] = {correctCount, total}` is a read-only snapshot for the home card's "Passed — X/Y" label — doesn't feed scoring/unlock logic.
- `ensureTest()` validates a saved test.order against id-existence AND `item.level === state.level`, regenerating if either check fails — guards against orphaned ids after a data.js rename and against a stale test belonging to a different level.
- Switching `state.level` away from an unfinished test to a DIFFERENT level discards that in-progress test (single global `state.test` slot, not per-level). Returning to the SAME level preserves progress. Known/accepted limitation, not a bug.
- Session stats (streak/accuracy/answered) tracked per level via `state.levelStats[level]`, accumulate across retries within a level (not reset per attempt).
- Home screen (`view = "home"|"quiz"`) is the landing page, runtime-only state, NOT persisted across reloads.

## Grading rules — hard-won, do not regress
Two real bugs found in this project, same root cause both times: **the first character of the compared string matched, but the character that actually mattered (the verb's own leading letter) didn't, because something was in front of it.** Watch for a third variant of this same mistake before trusting any new compound-string comparison.
- Normalize before comparing: lowercase, strip apostrophes/whitespace, fold oo<->u and aa<->a.
- The first character of the (normalized) answer must match the first character of the (normalized) correct answer EXACTLY, independent of Levenshtein tolerance — this is the grammatical person-prefix (a-/t-/y-/n-), and confusing it is never a typo. Check this directly (compare index 0), never infer it from whether the Levenshtein edit happened to be a substitution — insertions/deletions can hide the same error.
- Bug 1: huwa's "yakoon" was accepted as hiya's "takoon" — fixed by requiring `normInput[0] === normCorrect[0]` before typo tolerance applies, in `isAnswerCorrect`.
- Bug 2: "anta amlik" was accepted for the anta prompt whose correct answer is "tamlik" — the altAnswer fallback (full "pronoun + verb" phrase) reused the same first-char lock, but with a pronoun prefixed on, position 0 was the pronoun, not the verb, so the lock never actually inspected the verb's own leading letter. Fixed by removing typo tolerance entirely from the altAnswer path — exact normalized match only there. altAnswer is a bonus acceptance path, not the primary graded target, so this trade is acceptable.
- After the first-character check passes, Levenshtein distance <=1 is allowed as typo tolerance, only for answers 5+ normalized characters.
- anta and hiya are CORRECTLY identical in Arabic (both take the ta- prefix) — this is grammatically right, not a bug. Do not "fix" it.
- Never repeat the same item as the immediately preceding question (lastItemId exclusion in the picker).
- Character-diff feedback (shown on incorrect answers) diffs `item.answer` (the verb-only string actually graded, not the full pronoun+verb displayAnswer) against what was typed. Alignment runs on normalized strings so accepted spelling variants show as matches, not false mismatches, but renders against the correct answer's real spelling. The backtrace prefers a deletion framing over substitution when costs tie (reads more like "you dropped a letter"); genuine substitutions (no zero-sub path exists) still show as substitutions — that's correct, not a bug.

## Workflow conventions
- One commit per logical change; message explains *why*, not just *what*.
- Before committing anything touching data.js or matching.js: run `node scripts/self-test.js` and `node scripts/audit-hiya.js`. Both must stay 100%. If a change legitimately changes an outcome, that's a five-alarm moment — stop and confirm with the user before proceeding, don't just update the test to match.
- When fixing a real grading bug: reproduce it first with an isolated repro against the actual repo files (not a mental trace) BEFORE writing the fix. Add a permanent regression case to self-test.js afterward, and verify the new test actually fails on the old (pre-fix) code before trusting it as a real guard.
- After pushing: curl the live URL and grep for a specific new string/line to confirm the deploy actually picked up the change, rather than assuming push succeeded means live succeeded.
- If a user's bug report contradicts what a read of the code shows, verify with an actual repro before fixing the assumed cause. If the repro confirms a real bug in logic that was declared off-limits in an earlier, unrelated task ("don't touch grading logic" for that task), that constraint was scoped to that task's specific ask, not a standing prohibition — fix real bugs when found, just don't casually touch working logic outside of an actual reported bug.
- Read only the files directly relevant to whatever the current task touches. This file should cover orientation — no need to re-read all of quiz.js/style.css/data.js/matching.js up front just to get oriented.
- Keep README.md in sync with behavior changes as they're made, not as a batch cleanup later — it's read as "how this app currently works," and a stale README is worse than no README.

## Open gaps
- Level 3 has no fixed-test/unlock flow — functional as continuous practice in code, deliberately not linked from the home screen.
- In-progress test state is lost when switching to a different level mid-test (see above) — accepted limitation, not a bug.
