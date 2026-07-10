// Answer matching, kept separate from quiz.js (and free of DOM access) so
// it can run identically in the browser and under plain Node for the
// self-test in scripts/self-test.js.

function normalizeAnswer(str) {
  return str
    .toLowerCase()
    .replace(/['’‘ʼ]/g, "")
    .trim()
    .replace(/\s+/g, " ")
    .replace(/oo/g, "u")
    .replace(/aa/g, "a");
}

function levenshtein(a, b) {
  const m = a.length;
  const n = b.length;
  const dp = new Array(n + 1);
  for (let j = 0; j <= n; j++) dp[j] = j;

  for (let i = 1; i <= m; i++) {
    let prev = dp[0];
    dp[0] = i;
    for (let j = 1; j <= n; j++) {
      const temp = dp[j];
      if (a[i - 1] === b[j - 1]) {
        dp[j] = prev;
      } else {
        dp[j] = 1 + Math.min(prev, dp[j], dp[j - 1]);
      }
      prev = temp;
    }
  }
  return dp[n];
}

function isAnswerCorrect(input, correct) {
  const normInput = normalizeAnswer(input);
  const normCorrect = normalizeAnswer(correct);
  if (normInput === normCorrect) return true;
  // The typo-tolerance below is meant to forgive fat-fingering, not a wrong
  // verb form entirely. Several verbs here differ only by their leading
  // person-prefix (e.g. huwa's "yakoon" vs hiya's "takoon"), which is a
  // single-character edit at position 0 -- exactly what Levenshtein-1 would
  // otherwise forgive. Requiring the first character to match exactly closes
  // that hole while still tolerating typos anywhere else in the word.
  if (
    normCorrect.length >= 5 &&
    normInput.length > 0 &&
    normInput[0] === normCorrect[0] &&
    levenshtein(normInput, normCorrect) <= 1
  ) {
    return true;
  }
  return false;
}

// Grades against an item's primary answer (verb-only for conjugated forms),
// falling back to the full pronoun+verb phrase if the item has one.
function isCorrectForItem(input, item) {
  if (isAnswerCorrect(input, item.answer)) return true;
  if (item.altAnswer && isAnswerCorrect(input, item.altAnswer)) return true;
  return false;
}

// ---------------------------------------------------------------------
// Character-level diff, for display only. None of the above grading
// functions are used or modified by this section -- correctness is
// already decided by isAnswerCorrect/isCorrectForItem before any of this
// runs; it only visualizes *where* an already-incorrect answer diverged.
// ---------------------------------------------------------------------

// Like normalizeAnswer, but also returns, for every character in the
// normalized output, the [start, end) slice of the *original* string that
// produced it. This lets a diff computed on normalized strings (so
// accepted spelling variants like oo/u or aa/a line up as matches, same as
// grading treats them) be rendered back against the real, un-normalized
// spelling -- apostrophes and all. Mirrors normalizeAnswer's
// transformations and their order exactly; keep the two in sync if
// normalizeAnswer ever changes.
function normalizeWithTrace(str) {
  const lower = str.toLowerCase();

  // Strip apostrophe variants, but keep a stripped apostrophe attached to
  // the *next* surviving character's span (or the previous one, if it's
  // the very last character) so the real spelling still comes through
  // when a segment is rendered, even though the apostrophe itself carries
  // no weight in the alignment.
  const stage1 = [];
  let pendingStart = null;
  for (let i = 0; i < lower.length; i++) {
    const ch = lower[i];
    if (/['’‘ʼ]/.test(ch)) {
      if (pendingStart === null) pendingStart = i;
      continue;
    }
    stage1.push({ ch, start: pendingStart === null ? i : pendingStart, end: i + 1 });
    pendingStart = null;
  }
  if (pendingStart !== null && stage1.length > 0) {
    stage1[stage1.length - 1].end = lower.length;
  }

  // Collapse whitespace runs to a single space, trim leading/trailing.
  const stage2 = [];
  for (const entry of stage1) {
    if (/\s/.test(entry.ch)) {
      if (stage2.length === 0) continue;
      const prev = stage2[stage2.length - 1];
      if (prev.ch === " ") {
        prev.end = entry.end;
        continue;
      }
      stage2.push({ ch: " ", start: entry.start, end: entry.end });
    } else {
      stage2.push({ ch: entry.ch, start: entry.start, end: entry.end });
    }
  }
  while (stage2.length && stage2[stage2.length - 1].ch === " ") stage2.pop();

  // Fold oo -> u and aa -> a (matches two sequential non-overlapping,
  // non-recursive regex passes -- same-letter pairs only, so processing
  // both fold types in one left-to-right scan can't diverge from doing
  // them as separate passes).
  const stage3 = [];
  for (let i = 0; i < stage2.length; i++) {
    const a = stage2[i];
    const b = stage2[i + 1];
    if (b && a.ch === b.ch && (a.ch === "o" || a.ch === "a")) {
      stage3.push({ ch: a.ch === "o" ? "u" : "a", start: a.start, end: b.end });
      i++;
    } else {
      stage3.push(a);
    }
  }

  return {
    normalized: stage3.map((e) => e.ch).join(""),
    spans: stage3.map((e) => [e.start, e.end]),
  };
}

// Standard Levenshtein alignment with backtrace, turning string `a` into
// string `b`. Returns an ordered list of steps:
//   { op: "match" | "sub", aIndex, bIndex }
//   { op: "del", aIndex }  -- a[aIndex] has no counterpart in b
//   { op: "ins", bIndex }  -- b[bIndex] has no counterpart in a
function levenshteinAlign(a, b) {
  const m = a.length;
  const n = b.length;
  const dp = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));
  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] =
        a[i - 1] === b[j - 1]
          ? dp[i - 1][j - 1]
          : 1 + Math.min(dp[i - 1][j - 1], dp[i - 1][j], dp[i][j - 1]);
    }
  }

  // Backtrace order: match, then del/ins, then sub as the last resort.
  // When a substitution and a deletion/insertion cost exactly the same
  // (a tie in dp[i][j]), del/ins is checked first and wins -- e.g. a
  // dropped trailing letter reads as "missing" rather than as an
  // unrelated-looking mid-word "substitution", which is the more
  // intuitive framing for a human reading the diff. Only falls through to
  // "sub" when neither match nor del/ins can account for dp[i][j].
  const ops = [];
  let i = m;
  let j = n;
  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && a[i - 1] === b[j - 1] && dp[i][j] === dp[i - 1][j - 1]) {
      ops.push({ op: "match", aIndex: i - 1, bIndex: j - 1 });
      i--;
      j--;
    } else if (i > 0 && dp[i][j] === dp[i - 1][j] + 1) {
      ops.push({ op: "del", aIndex: i - 1 });
      i--;
    } else if (j > 0 && dp[i][j] === dp[i][j - 1] + 1) {
      ops.push({ op: "ins", bIndex: j - 1 });
      j--;
    } else {
      ops.push({ op: "sub", aIndex: i - 1, bIndex: j - 1 });
      i--;
      j--;
    }
  }
  ops.reverse();
  return ops;
}

// Computes a display-ready diff between what the user typed (`rawInput`)
// and the correct answer (`correctAnswer`), for visualizing where an
// already-incorrect answer diverged. Alignment runs on normalized forms
// (so tolerated spelling variants show as matches, not false mismatches);
// rendering uses each side's real, un-normalized spelling.
//
// Returns an array of { text, kind } segments in reading order, kind one
// of: "match" (correct as typed), "sub" (wrong letter where a right one
// was expected -- shown as the correct letter), "missing" (a correct
// letter the user never typed), "extra" (a letter the user typed that
// isn't in the correct answer at all -- shown as what was actually typed).
function diffAnswer(rawInput, correctAnswer) {
  const inputTraced = normalizeWithTrace(rawInput);
  const correctTraced = normalizeWithTrace(correctAnswer);
  const ops = levenshteinAlign(inputTraced.normalized, correctTraced.normalized);

  const segments = ops.map((step) => {
    if (step.op === "match" || step.op === "sub") {
      const [s, e] = correctTraced.spans[step.bIndex];
      return { text: correctAnswer.slice(s, e), kind: step.op === "match" ? "match" : "sub" };
    }
    if (step.op === "ins") {
      const [s, e] = correctTraced.spans[step.bIndex];
      return { text: correctAnswer.slice(s, e), kind: "missing" };
    }
    // "del": present in what was typed, absent from the correct answer.
    const [s, e] = inputTraced.spans[step.aIndex];
    return { text: rawInput.slice(s, e), kind: "extra" };
  });

  // Merge adjacent same-kind segments so a run of matching letters renders
  // as one span instead of one per character.
  const merged = [];
  for (const seg of segments) {
    const last = merged[merged.length - 1];
    if (last && last.kind === seg.kind) {
      last.text += seg.text;
    } else {
      merged.push({ text: seg.text, kind: seg.kind });
    }
  }
  return merged;
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = {
    normalizeAnswer,
    levenshtein,
    isAnswerCorrect,
    isCorrectForItem,
    normalizeWithTrace,
    levenshteinAlign,
    diffAnswer,
  };
}
