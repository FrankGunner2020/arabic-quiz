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

if (typeof module !== "undefined" && module.exports) {
  module.exports = { normalizeAnswer, levenshtein, isAnswerCorrect, isCorrectForItem };
}
