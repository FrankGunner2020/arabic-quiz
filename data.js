// Data model
//
// Each verb has a stable `id` (its Lëtzebuergesch infinitive, lowercased).
// `infinitive` holds the Lëtzebuergesch/Arabic-phonetic/English triple for the
// infinitive form itself. `forms` is an array of six conjugations, one per
// person (ech, du, hien-hatt, mir, dir, si), each holding the matching
// Lëtzebuergesch and Arabic-phonetic pair.
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
      { lb: "ech sinn", ar: "ana akoon" },
      { lb: "du bass", ar: "anta takoon" },
      { lb: "hien/hatt ass", ar: "huwa yakoon" },
      { lb: "mir sinn", ar: "nahnu nakoon" },
      { lb: "dir sidd", ar: "antum takoonoon" },
      { lb: "si sinn", ar: "hum yakoonoon" },
    ],
  },
  {
    id: "hunn",
    infinitive: { lb: "hunn", ar: "yamlik", en: "to have" },
    forms: [
      { lb: "ech hunn", ar: "ana amlik" },
      { lb: "du hues", ar: "anta tamlik" },
      { lb: "hien/hatt huet", ar: "huwa yamlik" },
      { lb: "mir hunn", ar: "nahnu namlik" },
      { lb: "dir hutt", ar: "antum tamlikoon" },
      { lb: "si hunn", ar: "hum yamlikoon" },
    ],
  },
  {
    id: "goen",
    infinitive: { lb: "goen", ar: "yadhab", en: "to go" },
    forms: [
      { lb: "ech ginn", ar: "ana adhab" },
      { lb: "du gees", ar: "anta tadhab" },
      { lb: "hien/hatt geet", ar: "huwa yadhab" },
      { lb: "mir ginn", ar: "nahnu nadhab" },
      { lb: "dir gitt", ar: "antum tadhaboon" },
      { lb: "si ginn", ar: "hum yadhaboon" },
    ],
  },
  {
    id: "kommen",
    infinitive: { lb: "kommen", ar: "ya'ti", en: "to come" },
    forms: [
      { lb: "ech kommen", ar: "ana a'ti" },
      { lb: "du kënns", ar: "anta ta'ti" },
      { lb: "hien/hatt kënnt", ar: "huwa ya'ti" },
      { lb: "mir kommen", ar: "nahnu na'ti" },
      { lb: "dir kommt", ar: "antum ta'toon" },
      { lb: "si kommen", ar: "hum ya'toon" },
    ],
  },
  {
    id: "wellen",
    infinitive: { lb: "wëllen", ar: "yurid", en: "to want" },
    forms: [
      { lb: "ech wëll", ar: "ana urid" },
      { lb: "du wëlls", ar: "anta turid" },
      { lb: "hien/hatt wëll", ar: "huwa yurid" },
      { lb: "mir wëllen", ar: "nahnu nurid" },
      { lb: "dir wëllt", ar: "antum turidoon" },
      { lb: "si wëllen", ar: "hum yuridoon" },
    ],
  },
  {
    id: "brauchen",
    infinitive: { lb: "brauchen", ar: "yahtaj", en: "to need" },
    forms: [
      { lb: "ech brauch", ar: "ana ahtaj" },
      { lb: "du brauchs", ar: "anta tahtaj" },
      { lb: "hien/hatt brauch", ar: "huwa yahtaj" },
      { lb: "mir brauchen", ar: "nahnu nahtaj" },
      { lb: "dir braucht", ar: "antum tahtajoon" },
      { lb: "si brauchen", ar: "hum yahtajoon" },
    ],
  },
  {
    id: "maachen",
    infinitive: { lb: "maachen", ar: "yaf'al", en: "to do / make" },
    forms: [
      { lb: "ech maachen", ar: "ana af'al" },
      { lb: "du méchs", ar: "anta taf'al" },
      { lb: "hien/hatt mécht", ar: "huwa yaf'al" },
      { lb: "mir maachen", ar: "nahnu naf'al" },
      { lb: "dir maacht", ar: "antum taf'aloon" },
      { lb: "si maachen", ar: "hum yaf'aloon" },
    ],
  },
  {
    id: "soen",
    infinitive: { lb: "soen", ar: "yaqool", en: "to say" },
    forms: [
      { lb: "ech soen", ar: "ana aqool" },
      { lb: "du sees", ar: "anta taqool" },
      { lb: "hien/hatt seet", ar: "huwa yaqool" },
      { lb: "mir soen", ar: "nahnu naqool" },
      { lb: "dir sot", ar: "antum taqooloon" },
      { lb: "si soen", ar: "hum yaqooloon" },
    ],
  },
  {
    id: "schwatzen",
    infinitive: { lb: "schwätzen", ar: "yatakallam", en: "to speak" },
    forms: [
      { lb: "ech schwätzen", ar: "ana atakallam" },
      { lb: "du schwätz", ar: "anta tatakallam" },
      { lb: "hien/hatt schwätzt", ar: "huwa yatakallam" },
      { lb: "mir schwätzen", ar: "nahnu natakallam" },
      { lb: "dir schwätzt", ar: "antum tatakallamoon" },
      { lb: "si schwätzen", ar: "hum yatakallamoon" },
    ],
  },
  {
    id: "verstoen",
    infinitive: { lb: "verstoen", ar: "yafham", en: "to understand" },
    forms: [
      { lb: "ech verstinn", ar: "ana afham" },
      { lb: "du verstees", ar: "anta tafham" },
      { lb: "hien/hatt versteet", ar: "huwa yafham" },
      { lb: "mir verstinn", ar: "nahnu nafham" },
      { lb: "dir verstitt", ar: "antum tafhamoon" },
      { lb: "si verstinn", ar: "hum yafhamoon" },
    ],
  },
  {
    id: "wessen",
    infinitive: { lb: "wëssen", ar: "ya'lam", en: "to know" },
    forms: [
      { lb: "ech weess", ar: "ana a'lam" },
      { lb: "du wees", ar: "anta ta'lam" },
      { lb: "hien/hatt weess", ar: "huwa ya'lam" },
      { lb: "mir wëssen", ar: "nahnu na'lam" },
      { lb: "dir wësst", ar: "antum ta'lamoon" },
      { lb: "si wëssen", ar: "hum ya'lamoon" },
    ],
  },
  {
    id: "gesinn",
    infinitive: { lb: "gesinn", ar: "yara", en: "to see" },
    forms: [
      { lb: "ech gesinn", ar: "ana ara" },
      { lb: "du gesäis", ar: "anta tara" },
      { lb: "hien/hatt gesäit", ar: "huwa yara" },
      { lb: "mir gesinn", ar: "nahnu nara" },
      { lb: "dir gesitt", ar: "antum tarawn" },
      { lb: "si gesinn", ar: "hum yarawn" },
    ],
  },
  {
    id: "kucken",
    infinitive: { lb: "kucken", ar: "yandhur", en: "to look / watch" },
    forms: [
      { lb: "ech kucken", ar: "ana andhur" },
      { lb: "du kuckst", ar: "anta tandhur" },
      { lb: "hien/hatt kuckt", ar: "huwa yandhur" },
      { lb: "mir kucken", ar: "nahnu nandhur" },
      { lb: "dir kuckt", ar: "antum tandhuroon" },
      { lb: "si kucken", ar: "hum yandhuroon" },
    ],
  },
];

// Flatten VERBS into individual quiz items. `stage` is either "infinitive"
// or "form" so the app can filter by the active stage.
function buildItems() {
  const items = [];
  for (const verb of VERBS) {
    items.push({
      id: `${verb.id}.inf`,
      verbId: verb.id,
      stage: "infinitive",
      prompt: verb.infinitive.lb,
      answer: verb.infinitive.ar,
      gloss: verb.infinitive.en,
    });
    verb.forms.forEach((form, i) => {
      items.push({
        id: `${verb.id}.${PERSONS[i]}`,
        verbId: verb.id,
        stage: "form",
        prompt: form.lb,
        answer: form.ar,
        gloss: verb.infinitive.en,
      });
    });
  }
  return items;
}

const ITEMS = buildItems();
