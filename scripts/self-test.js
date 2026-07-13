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
const { isAnswerCorrect, isCorrectForItem, diffAnswer, closestAcceptedAnswer } = require("../matching.js");

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

// Regression test: both the verb-only answer AND, for items that have one,
// the full pronoun+verb phrase must be accepted -- across a sample of
// items spanning all three levels, not just gesinn.du (the item that
// surfaced this specific regression: "anta tara" was being rejected
// because the explicit-accepted-answers refactor only generated variants
// from the verb-only canonical answer for a beat, dropping the earlier
// "also accept the full phrase" path). Level 1 items have no pronoun/
// altAnswer at all, so only the verb-only check applies to those.
{
  const SAMPLE_IDS = ["sinn.inf", "verstoen.inf", "gesinn.du", "hunn.hien", "wessen.mir", "kucken.si"];
  for (const id of SAMPLE_IDS) {
    const item = ITEMS.find((it) => it.id === id);
    if (!item) continue;

    const verbOnlyOk = isCorrectForItem(item.answer, item);
    if (verbOnlyOk) {
      pass++;
    } else {
      fail++;
      console.log(`FAIL: ${id} -> isCorrectForItem("${item.answer}", item) should be true (verb-only answer)`);
    }

    if (!item.altAnswer) continue; // level 1: no pronoun, nothing further to check
    const fullPhraseOk = isCorrectForItem(item.altAnswer, item);
    if (fullPhraseOk) {
      pass++;
    } else {
      fail++;
      console.log(`FAIL: ${id} -> isCorrectForItem("${item.altAnswer}", item) should be true (full pronoun+verb phrase)`);
    }
  }
}

// Diff-specific regression: someone who types the full phrase with the
// right pronoun but a wrong verb (e.g. "anta xyz" for gesinn.du, answer
// "tara", altAnswer "anta tara") must see their pronoun rendered as a
// clean match, not garbled/flagged as wrong just because the diff engine
// compared their whole input against the verb-only canonical answer.
// closestAcceptedAnswer must pick the full-phrase variant as the diff
// target here (and not consider it a "different word" -- close enough for
// a granular diff to be useful), for that to happen.
{
  const item = ITEMS.find((it) => it.id === "gesinn.du");
  const rawInput = "anta xyz";
  const { answer: target, isDifferentWord } = closestAcceptedAnswer(rawInput, item);
  const { wordSegments } = diffAnswer(rawInput, target);
  const pronounSegment = wordSegments[0];

  const ok =
    !isDifferentWord &&
    pronounSegment &&
    pronounSegment.kind === "match" &&
    pronounSegment.text.trim() === "anta";
  if (ok) {
    pass++;
  } else {
    fail++;
    console.log(
      `FAIL: gesinn.du -> diffAnswer("${rawInput}", "${target}") should render "anta" as a matched segment (isDifferentWord=${isDifferentWord}), got ${JSON.stringify(wordSegments)}`
    );
  }
}

// Regression test for the "tandhur~~a~~" bug: an "extra" segment must
// never render directly appended after the correct answer's own spelling
// -- diffAnswer must keep extraSegments (leftover typed characters not
// part of the correct answer) fully separate from wordSegments (the
// correct answer's own letters, which concatenated in order must always
// render the intact, correctly-spelled word with no "extra" text mixed
// in). "tandhura" (one genuine extra trailing character) against
// "tandhur" is a small, close edit -- not a different word -- so this
// should still produce a granular diff, just with the "a" kept out of
// wordSegments.
{
  const rawInput = "tandhura";
  const correctAnswer = "tandhur";
  const { wordSegments, extraSegments } = diffAnswer(rawInput, correctAnswer);

  const wordText = wordSegments.map((seg) => seg.text).join("");
  const wordHasNoExtraKind = wordSegments.every((seg) => seg.kind !== "extra");
  const extraText = extraSegments.map((seg) => seg.text).join("");

  const ok = wordText === correctAnswer && wordHasNoExtraKind && extraText === "a";
  if (ok) {
    pass++;
  } else {
    fail++;
    console.log(
      `FAIL: diffAnswer("${rawInput}", "${correctAnswer}") -> wordSegments should spell exactly "${correctAnswer}" with no "extra" kind mixed in and extraSegments should be "a", got wordSegments=${JSON.stringify(wordSegments)} extraSegments=${JSON.stringify(extraSegments)}`
    );
  }
}

// Regression test for the "different word" threshold: typing "tara"
// (gesinn's ana/anta-ish fragment) against kucken.du's "tandhur" is 5 of 7
// characters off -- a different word, not a typo -- and closestAcceptedAnswer
// must flag it as such (isDifferentWord: true) rather than force a
// character-by-character alignment between two unrelated words. A close
// typo (one missing letter) against the same word must NOT be flagged.
{
  const item = ITEMS.find((it) => it.id === "kucken.du");
  const differentWord = closestAcceptedAnswer("tara", item);
  const nearTypo = closestAcceptedAnswer("tandur", item); // missing the "h"

  const ok = item && item.answer === "tandhur" && differentWord.isDifferentWord && !nearTypo.isDifferentWord;
  if (ok) {
    pass++;
  } else {
    fail++;
    console.log(
      `FAIL: kucken.du (answer should be "tandhur") -> closestAcceptedAnswer("tara", item).isDifferentWord should be true (got ${JSON.stringify(differentWord)}), closestAcceptedAnswer("tandur", item).isDifferentWord should be false (got ${JSON.stringify(nearTypo)})`
    );
  }
}

console.log(`${pass}/${pass + fail} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
