// Sanity check: every item's canonical verb-only answer must grade as
// correct against itself. This is the identity case that should always
// hold — if it doesn't, normalization (case/apostrophes/whitespace/
// oo<->u/aa<->a) has broken something for that specific string.
//
// Also regression-tests apostrophe handling: mobile keyboards can render a
// typed apostrophe as any of several Unicode lookalikes (straight, curly
// open/close, modifier letter). Only stripping some of them caused false
// negatives on short answers like "ya'ti", where the typo-tolerance
// Levenshtein check doesn't kick in to mask the stray character.
//
// Run with: node scripts/self-test.js

const { ITEMS } = require("../data.js");
const { isAnswerCorrect, isCorrectForItem } = require("../matching.js");

let pass = 0;
let fail = 0;

for (const item of ITEMS) {
  const canonicalAnswer = item.answer; // verb-only target
  const ok = isAnswerCorrect(canonicalAnswer, canonicalAnswer);
  if (ok) {
    pass++;
  } else {
    fail++;
    console.log(`FAIL: ${item.id} -> isAnswerCorrect("${canonicalAnswer}", "${canonicalAnswer}")`);
  }
}

const APOSTROPHE_VARIANTS = ["'", "‘", "’", "ʼ"];
for (const item of ITEMS) {
  if (!/['‘’ʼ]/.test(item.answer)) continue;
  for (const variant of APOSTROPHE_VARIANTS) {
    const typed = item.answer.replace(/['‘’ʼ]/g, variant);
    const ok = isCorrectForItem(typed, item);
    if (ok) {
      pass++;
    } else {
      fail++;
      console.log(`FAIL: ${item.id} -> isCorrectForItem("${typed}", item) with apostrophe variant U+${variant.codePointAt(0).toString(16).toUpperCase().padStart(4, "0")}`);
    }
  }
}

console.log(`${pass}/${pass + fail} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
