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

const { ITEMS, VERBS, PERSONS } = require("../data.js");
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

// Regression test: the right pronoun paired with the *wrong verb* must
// never grade as correct via the altAnswer (pronoun+verb) fallback, even
// though the pronoun makes the overall string's first character line up.
// This is exactly the shape of a real bug: "anta amlik" (anta's pronoun
// grafted onto ana's verb "amlik", i.e. hunn's "tamlik" missing its
// leading t-) graded as correct for "du hues" (hunn.du, altAnswer "anta
// tamlik"), because isAnswerCorrect's typo tolerance only checks the
// *string's* first character -- the shared pronoun -- never the verb's
// own leading letter once something is prefixed onto it. Fixed by
// requiring an exact normalized match for the altAnswer fallback (no
// typo tolerance there at all); this guards against that regressing.
for (const verb of VERBS) {
  const conjugated = verb.forms.map((form, i) => ({ form, person: PERSONS[i] }));
  const anaEntry = conjugated.find((c) => c.person === "ech"); // ana form
  if (!anaEntry) continue;

  for (const { form, person } of conjugated) {
    if (person === "ech") continue; // nothing to cross with itself
    const item = ITEMS.find((it) => it.id === `${verb.id}.${person}`);
    if (!item || !item.altAnswer) continue;

    const corrupted = `${form.arPronoun} ${anaEntry.form.arVerb}`;
    if (corrupted === item.altAnswer) continue; // no real cross-check possible

    const ok = !isCorrectForItem(corrupted, item);
    if (ok) {
      pass++;
    } else {
      fail++;
      console.log(
        `FAIL: ${item.id} -> isCorrectForItem("${corrupted}", item) should be false (right pronoun, wrong verb)`
      );
    }
  }
}

// Regression test for the "yafam" bug: fuzzy Levenshtein-1 typo tolerance
// used to accept "yafam" for wëssen's infinitive (ya'lam, "to know") even
// though "yafam" isn't a typo of it at all -- it's a fragment of a
// completely different verb, yafham/verstoen ("to understand"), that just
// happens to be one substitution away and shares a leading character.
// Fuzzy edit-distance can't tell "a real typo of the right word" apart
// from "a coincidentally similar wrong word"; explicit accepted-answer
// lists (matching.js's generateAcceptedAnswers) can, since "yafam" is
// simply never in wëssen's list. Guards against fuzzy tolerance creeping
// back in.
{
  const item = ITEMS.find((it) => it.id === "wessen.inf");
  const ok = item && !isCorrectForItem("yafam", item);
  if (ok) {
    pass++;
  } else {
    fail++;
    console.log(
      `FAIL: wessen.inf -> isCorrectForItem("yafam", item) should be false (coincidental near-miss of an unrelated verb, verstoen/yafham)`
    );
  }
}

// Broader regression, same root cause: a sample of items' canonical
// answers must be rejected against several other, unrelated items -- not
// just typo variants of the right one. Only cross-verb pairs are checked
// (same-verb pairs can legitimately share a spelling by design, e.g. hiya
// === anta for every verb here), so every rejection asserted below is a
// genuine cross-verb collision that must never be accepted. This is
// structurally guaranteed now that each item's accepted list is generated
// only from that item's own answer -- this test is a redundant safety net
// confirming that guarantee actually holds, not just trusting the theory.
{
  const SAMPLE_IDS = ["wessen.inf", "sinn.hien", "hunn.du", "verstoen.inf", "kucken.mir"];
  const sampleItems = SAMPLE_IDS.map((id) => ITEMS.find((it) => it.id === id));
  for (const sourceItem of sampleItems) {
    if (!sourceItem) continue;
    for (const otherItem of sampleItems) {
      if (!otherItem || otherItem === sourceItem) continue;
      if (sourceItem.verbId === otherItem.verbId) continue;

      const ok = !isCorrectForItem(sourceItem.answer, otherItem);
      if (ok) {
        pass++;
      } else {
        fail++;
        console.log(
          `FAIL: ${otherItem.id} -> isCorrectForItem("${sourceItem.answer}", item) should be false (that's ${sourceItem.id}'s answer, an unrelated verb)`
        );
      }
    }
  }
}

console.log(`${pass}/${pass + fail} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
