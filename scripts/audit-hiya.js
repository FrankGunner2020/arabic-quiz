// Audits every hiya item's Arabic verb string against two invariants:
//   1. It must exactly equal the corresponding anta item's arVerb.
//   2. It must NOT equal the corresponding huwa item's arVerb.
// Also asserts every huwa item's arVerb is untouched (still the ya- form),
// to confirm a hiya fix never accidentally touches huwa.
//
// Run with: node scripts/audit-hiya.js

const { VERBS } = require("../data.js");

// Known-correct ya-/ta- pairs, taken from the reference table supplied for
// this audit (huwa column is reference-only, never written back).
const EXPECTED = {
  sinn: { huwa: "yakoon", hiya: "takoon" },
  hunn: { huwa: "yamlik", hiya: "tamlik" },
  goen: { huwa: "yadhab", hiya: "tadhab" },
  kommen: { huwa: "ya'ti", hiya: "ta'ti" },
  wellen: { huwa: "yurid", hiya: "turid" },
  brauchen: { huwa: "yahtaj", hiya: "tahtaj" },
  maachen: { huwa: "yaf'al", hiya: "taf'al" },
  soen: { huwa: "yaqool", hiya: "taqool" },
  schwatzen: { huwa: "yatakallam", hiya: "tatakallam" },
  verstoen: { huwa: "yafham", hiya: "tafham" },
  wessen: { huwa: "ya'lam", hiya: "ta'lam" },
  gesinn: { huwa: "yara", hiya: "tara" },
  kucken: { huwa: "yandhur", hiya: "tandhur" },
};

const PERSONS = ["ech", "du", "hien", "hatt", "mir", "dir", "si"];

let pass = 0;
let fail = 0;

for (const verb of VERBS) {
  const antaForm = verb.forms[PERSONS.indexOf("du")];
  const huwaForm = verb.forms[PERSONS.indexOf("hien")];
  const hiyaForm = verb.forms[PERSONS.indexOf("hatt")];
  const expected = EXPECTED[verb.id];

  const checks = [
    {
      label: "hiya.arVerb === anta.arVerb",
      ok: hiyaForm.arVerb === antaForm.arVerb,
      detail: `hiya="${hiyaForm.arVerb}" anta="${antaForm.arVerb}"`,
    },
    {
      label: "hiya.arVerb !== huwa.arVerb",
      ok: hiyaForm.arVerb !== huwaForm.arVerb,
      detail: `hiya="${hiyaForm.arVerb}" huwa="${huwaForm.arVerb}"`,
    },
    {
      label: "hiya.arVerb matches reference table",
      ok: hiyaForm.arVerb === expected.hiya,
      detail: `got="${hiyaForm.arVerb}" expected="${expected.hiya}"`,
    },
    {
      label: "huwa.arVerb unchanged (still ya- form, matches reference)",
      ok: huwaForm.arVerb === expected.huwa,
      detail: `got="${huwaForm.arVerb}" expected="${expected.huwa}"`,
    },
  ];

  const verbPass = checks.every((c) => c.ok);
  console.log(`${verbPass ? "PASS" : "FAIL"} ${verb.id}`);
  for (const c of checks) {
    if (!c.ok) {
      fail++;
      console.log(`  FAIL: ${c.label} (${c.detail})`);
    } else {
      pass++;
    }
  }
}

console.log(`\n${pass}/${pass + fail} checks passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
