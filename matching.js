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
  if (normCorrect.length >= 5 && levenshtein(normInput, normCorrect) <= 1) {
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
