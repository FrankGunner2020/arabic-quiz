// Data model
//
// Each verb has a stable `id` (its Lëtzebuergesch infinitive, lowercased).
// `infinitive` holds the Lëtzebuergesch/Arabic-phonetic/English triple for the
// infinitive form itself. `forms` is an array of six conjugations, one per
// person (ech, du, hien-hatt, mir, dir, si). Each form stores the Arabic
// pronoun and verb as separate fields — the Lëtzebuergesch prompt already
// establishes the subject, so the verb alone is what's actually drilled;
// the pronoun is kept around to show the full phrase for context and to
// accept it as an alternate answer.
//
// Every quizzable unit (an infinitive or a single conjugated form) gets a
// flattened, stable item id of the shape `${verbId}.inf` or
// `${verbId}.${person}` so stats can be tracked per item across sessions.

const PERSONS = ["ech", "du", "hien-hatt", "mir", "dir", "si"];

const VERBS = [
  {
    id: "sinn",
    infinitive: { lb: "sinn", ar: "yakoon", en: "to be" },
    forms: [
      { lb: "ech sinn", arPronoun: "ana", arVerb: "akoon" },
      { lb: "du bass", arPronoun: "anta", arVerb: "takoon" },
      { lb: "hien/hatt ass", arPronoun: "huwa", arVerb: "yakoon" },
      { lb: "mir sinn", arPronoun: "nahnu", arVerb: "nakoon" },
      { lb: "dir sidd", arPronoun: "antum", arVerb: "takoonoon" },
      { lb: "si sinn", arPronoun: "hum", arVerb: "yakoonoon" },
    ],
  },
  {
    id: "hunn",
    infinitive: { lb: "hunn", ar: "yamlik", en: "to have" },
    forms: [
      { lb: "ech hunn", arPronoun: "ana", arVerb: "amlik" },
      { lb: "du hues", arPronoun: "anta", arVerb: "tamlik" },
      { lb: "hien/hatt huet", arPronoun: "huwa", arVerb: "yamlik" },
      { lb: "mir hunn", arPronoun: "nahnu", arVerb: "namlik" },
      { lb: "dir hutt", arPronoun: "antum", arVerb: "tamlikoon" },
      { lb: "si hunn", arPronoun: "hum", arVerb: "yamlikoon" },
    ],
  },
  {
    id: "goen",
    infinitive: { lb: "goen", ar: "yadhab", en: "to go" },
    forms: [
      { lb: "ech ginn", arPronoun: "ana", arVerb: "adhab" },
      { lb: "du gees", arPronoun: "anta", arVerb: "tadhab" },
      { lb: "hien/hatt geet", arPronoun: "huwa", arVerb: "yadhab" },
      { lb: "mir ginn", arPronoun: "nahnu", arVerb: "nadhab" },
      { lb: "dir gitt", arPronoun: "antum", arVerb: "tadhaboon" },
      { lb: "si ginn", arPronoun: "hum", arVerb: "yadhaboon" },
    ],
  },
  {
    id: "kommen",
    infinitive: { lb: "kommen", ar: "ya'ti", en: "to come" },
    forms: [
      { lb: "ech kommen", arPronoun: "ana", arVerb: "a'ti" },
      { lb: "du kënns", arPronoun: "anta", arVerb: "ta'ti" },
      { lb: "hien/hatt kënnt", arPronoun: "huwa", arVerb: "ya'ti" },
      { lb: "mir kommen", arPronoun: "nahnu", arVerb: "na'ti" },
      { lb: "dir kommt", arPronoun: "antum", arVerb: "ta'toon" },
      { lb: "si kommen", arPronoun: "hum", arVerb: "ya'toon" },
    ],
  },
  {
    id: "wellen",
    infinitive: { lb: "wëllen", ar: "yurid", en: "to want" },
    forms: [
      { lb: "ech wëll", arPronoun: "ana", arVerb: "urid" },
      { lb: "du wëlls", arPronoun: "anta", arVerb: "turid" },
      { lb: "hien/hatt wëll", arPronoun: "huwa", arVerb: "yurid" },
      { lb: "mir wëllen", arPronoun: "nahnu", arVerb: "nurid" },
      { lb: "dir wëllt", arPronoun: "antum", arVerb: "turidoon" },
      { lb: "si wëllen", arPronoun: "hum", arVerb: "yuridoon" },
    ],
  },
  {
    id: "brauchen",
    infinitive: { lb: "brauchen", ar: "yahtaj", en: "to need" },
    forms: [
      { lb: "ech brauch", arPronoun: "ana", arVerb: "ahtaj" },
      { lb: "du brauchs", arPronoun: "anta", arVerb: "tahtaj" },
      { lb: "hien/hatt brauch", arPronoun: "huwa", arVerb: "yahtaj" },
      { lb: "mir brauchen", arPronoun: "nahnu", arVerb: "nahtaj" },
      { lb: "dir braucht", arPronoun: "antum", arVerb: "tahtajoon" },
      { lb: "si brauchen", arPronoun: "hum", arVerb: "yahtajoon" },
    ],
  },
  {
    id: "maachen",
    infinitive: { lb: "maachen", ar: "yaf'al", en: "to do / make" },
    forms: [
      { lb: "ech maachen", arPronoun: "ana", arVerb: "af'al" },
      { lb: "du méchs", arPronoun: "anta", arVerb: "taf'al" },
      { lb: "hien/hatt mécht", arPronoun: "huwa", arVerb: "yaf'al" },
      { lb: "mir maachen", arPronoun: "nahnu", arVerb: "naf'al" },
      { lb: "dir maacht", arPronoun: "antum", arVerb: "taf'aloon" },
      { lb: "si maachen", arPronoun: "hum", arVerb: "yaf'aloon" },
    ],
  },
  {
    id: "soen",
    infinitive: { lb: "soen", ar: "yaqool", en: "to say" },
    forms: [
      { lb: "ech soen", arPronoun: "ana", arVerb: "aqool" },
      { lb: "du sees", arPronoun: "anta", arVerb: "taqool" },
      { lb: "hien/hatt seet", arPronoun: "huwa", arVerb: "yaqool" },
      { lb: "mir soen", arPronoun: "nahnu", arVerb: "naqool" },
      { lb: "dir sot", arPronoun: "antum", arVerb: "taqooloon" },
      { lb: "si soen", arPronoun: "hum", arVerb: "yaqooloon" },
    ],
  },
  {
    id: "schwatzen",
    infinitive: { lb: "schwätzen", ar: "yatakallam", en: "to speak" },
    forms: [
      { lb: "ech schwätzen", arPronoun: "ana", arVerb: "atakallam" },
      { lb: "du schwätz", arPronoun: "anta", arVerb: "tatakallam" },
      { lb: "hien/hatt schwätzt", arPronoun: "huwa", arVerb: "yatakallam" },
      { lb: "mir schwätzen", arPronoun: "nahnu", arVerb: "natakallam" },
      { lb: "dir schwätzt", arPronoun: "antum", arVerb: "tatakallamoon" },
      { lb: "si schwätzen", arPronoun: "hum", arVerb: "yatakallamoon" },
    ],
  },
  {
    id: "verstoen",
    infinitive: { lb: "verstoen", ar: "yafham", en: "to understand" },
    forms: [
      { lb: "ech verstinn", arPronoun: "ana", arVerb: "afham" },
      { lb: "du verstees", arPronoun: "anta", arVerb: "tafham" },
      { lb: "hien/hatt versteet", arPronoun: "huwa", arVerb: "yafham" },
      { lb: "mir verstinn", arPronoun: "nahnu", arVerb: "nafham" },
      { lb: "dir verstitt", arPronoun: "antum", arVerb: "tafhamoon" },
      { lb: "si verstinn", arPronoun: "hum", arVerb: "yafhamoon" },
    ],
  },
  {
    id: "wessen",
    infinitive: { lb: "wëssen", ar: "ya'lam", en: "to know" },
    forms: [
      { lb: "ech weess", arPronoun: "ana", arVerb: "a'lam" },
      { lb: "du wees", arPronoun: "anta", arVerb: "ta'lam" },
      { lb: "hien/hatt weess", arPronoun: "huwa", arVerb: "ya'lam" },
      { lb: "mir wëssen", arPronoun: "nahnu", arVerb: "na'lam" },
      { lb: "dir wësst", arPronoun: "antum", arVerb: "ta'lamoon" },
      { lb: "si wëssen", arPronoun: "hum", arVerb: "ya'lamoon" },
    ],
  },
  {
    id: "gesinn",
    infinitive: { lb: "gesinn", ar: "yara", en: "to see" },
    forms: [
      { lb: "ech gesinn", arPronoun: "ana", arVerb: "ara" },
      { lb: "du gesäis", arPronoun: "anta", arVerb: "tara" },
      { lb: "hien/hatt gesäit", arPronoun: "huwa", arVerb: "yara" },
      { lb: "mir gesinn", arPronoun: "nahnu", arVerb: "nara" },
      { lb: "dir gesitt", arPronoun: "antum", arVerb: "tarawn" },
      { lb: "si gesinn", arPronoun: "hum", arVerb: "yarawn" },
    ],
  },
  {
    id: "kucken",
    infinitive: { lb: "kucken", ar: "yandhur", en: "to look / watch" },
    forms: [
      { lb: "ech kucken", arPronoun: "ana", arVerb: "andhur" },
      { lb: "du kucks", arPronoun: "anta", arVerb: "tandhur" },
      { lb: "hien/hatt kuckt", arPronoun: "huwa", arVerb: "yandhur" },
      { lb: "mir kucken", arPronoun: "nahnu", arVerb: "nandhur" },
      { lb: "dir kuckt", arPronoun: "antum", arVerb: "tandhuroon" },
      { lb: "si kucken", arPronoun: "hum", arVerb: "yandhuroon" },
    ],
  },
];

// Flatten VERBS into individual quiz items. `stage` is either "infinitive"
// or "form" so the app can filter by item type; `level` is the tier the item
// belongs to (1: infinitives, 2: ana/anta/huwa, 3: nahnu/antum/hum) so the
// app can filter by the active level. PERSONS[0..2] (ech/du/hien-hatt, i.e.
// ana/anta/huwa) are level 2; PERSONS[3..5] (mir/dir/si, i.e.
// nahnu/antum/hum) are level 3 -- structured now as the extension point for
// a future Level 3 unlock, not yet reachable in the UI.
//
// `answer` is the primary grading target (verb-only for conjugated forms,
// since the Lëtzebuergesch prompt already establishes the subject).
// `altAnswer` is the full pronoun+verb phrase, accepted as an alternate for
// anyone who types it out of habit. `displayAnswer` is always the full
// phrase, shown in feedback for context even though only the verb was
// required.
function buildItems() {
  const items = [];
  for (const verb of VERBS) {
    items.push({
      id: `${verb.id}.inf`,
      verbId: verb.id,
      stage: "infinitive",
      level: 1,
      prompt: verb.infinitive.lb,
      gloss: verb.infinitive.en,
      answer: verb.infinitive.ar,
      altAnswer: null,
      displayAnswer: verb.infinitive.ar,
    });
    verb.forms.forEach((form, i) => {
      items.push({
        id: `${verb.id}.${PERSONS[i]}`,
        verbId: verb.id,
        stage: "form",
        level: i < 3 ? 2 : 3,
        prompt: form.lb,
        gloss: verb.infinitive.en,
        answer: form.arVerb,
        altAnswer: `${form.arPronoun} ${form.arVerb}`,
        displayAnswer: `${form.arPronoun} ${form.arVerb}`,
      });
    });
  }
  return items;
}

const ITEMS = buildItems();

if (typeof module !== "undefined" && module.exports) {
  module.exports = { PERSONS, VERBS, ITEMS };
}
