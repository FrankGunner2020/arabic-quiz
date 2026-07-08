// Sanity check: every item's canonical verb-only answer must grade as
// correct against itself. This is the identity case that should always
// hold — if it doesn't, normalization (case/apostrophes/whitespace/
// oo<->u/aa<->a) has broken something for that specific string.
//
// Run with: node scripts/self-test.js

const { ITEMS } = require("../data.js");
const { isAnswerCorrect } = require("../matching.js");

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

console.log(`${pass}/${ITEMS.length} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
