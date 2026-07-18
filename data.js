// Data model
//
// Each verb has a stable `id` (its Lëtzebuergesch infinitive, lowercased).
// `infinitive` holds the Lëtzebuergesch/Arabic-phonetic/English triple for the
// infinitive form itself. `forms` is an array of seven conjugations, one per
// person (ech, du, hien, hatt, mir, dir, si). hien (huwa) and hatt (hiya) are
// kept as fully separate items, never combined, even though in Arabic the
// hiya verb form is spelled identically to the anta form for every verb here
// (both take the tā- prefix) — hatt's arVerb is always a copy of that verb's
// anta arVerb. Each form stores the Arabic pronoun and verb as separate
// fields — the Lëtzebuergesch prompt already establishes the subject, so the
// verb alone is what's actually drilled; the pronoun is kept around to show
// the full phrase for context and to accept it as an alternate answer.
//
// Every quizzable unit (an infinitive or a single conjugated form) gets a
// flattened, stable item id of the shape `${verbId}.inf` or
// `${verbId}.${person}` so stats can be tracked per item across sessions.
//
// buildItems() below calls generateAcceptedAnswers() (matching.js) to
// precompute each item's accepted-spelling list. In the browser that
// function is already a global by the time this file runs -- index.html
// loads matching.js before data.js specifically for this reason. Under
// Node (scripts/self-test.js, scripts/audit-hiya.js both require this file
// directly) globals aren't shared between required files, so pull it in
// explicitly here, the same way modules already export themselves below.
if (typeof module !== "undefined" && module.exports) {
  global.generateAcceptedAnswers = require("./matching.js").generateAcceptedAnswers;
}

const PERSONS = ["ech", "du", "hien", "hatt", "mir", "dir", "si"];

const VERBS = [
  {
    id: "sinn",
    infinitive: { lb: "sinn", ar: "yakoon", en: "to be" },
    forms: [
      { lb: "ech sinn", arPronoun: "ana", arVerb: "akoon" },
      { lb: "du bass", arPronoun: "anta", arVerb: "takoon" },
      { lb: "hien ass", arPronoun: "huwa", arVerb: "yakoon" },
      { lb: "hatt ass", arPronoun: "hiya", arVerb: "takoon" },
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
      { lb: "hien huet", arPronoun: "huwa", arVerb: "yamlik" },
      { lb: "hatt huet", arPronoun: "hiya", arVerb: "tamlik" },
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
      { lb: "hien geet", arPronoun: "huwa", arVerb: "yadhab" },
      { lb: "hatt geet", arPronoun: "hiya", arVerb: "tadhab" },
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
      { lb: "hien kënnt", arPronoun: "huwa", arVerb: "ya'ti" },
      { lb: "hatt kënnt", arPronoun: "hiya", arVerb: "ta'ti" },
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
      { lb: "hien wëll", arPronoun: "huwa", arVerb: "yurid" },
      { lb: "hatt wëll", arPronoun: "hiya", arVerb: "turid" },
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
      { lb: "hien brauch", arPronoun: "huwa", arVerb: "yahtaj" },
      { lb: "hatt brauch", arPronoun: "hiya", arVerb: "tahtaj" },
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
      { lb: "hien mécht", arPronoun: "huwa", arVerb: "yaf'al" },
      { lb: "hatt mécht", arPronoun: "hiya", arVerb: "taf'al" },
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
      { lb: "hien seet", arPronoun: "huwa", arVerb: "yaqool" },
      { lb: "hatt seet", arPronoun: "hiya", arVerb: "taqool" },
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
      { lb: "hien schwätzt", arPronoun: "huwa", arVerb: "yatakallam" },
      { lb: "hatt schwätzt", arPronoun: "hiya", arVerb: "tatakallam" },
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
      { lb: "hien versteet", arPronoun: "huwa", arVerb: "yafham" },
      { lb: "hatt versteet", arPronoun: "hiya", arVerb: "tafham" },
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
      { lb: "hien weess", arPronoun: "huwa", arVerb: "ya'lam" },
      { lb: "hatt weess", arPronoun: "hiya", arVerb: "ta'lam" },
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
      { lb: "hien gesäit", arPronoun: "huwa", arVerb: "yara" },
      { lb: "hatt gesäit", arPronoun: "hiya", arVerb: "tara" },
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
      { lb: "hien kuckt", arPronoun: "huwa", arVerb: "yandhur" },
      { lb: "hatt kuckt", arPronoun: "hiya", arVerb: "tandhur" },
      { lb: "mir kucken", arPronoun: "nahnu", arVerb: "nandhur" },
      { lb: "dir kuckt", arPronoun: "antum", arVerb: "tandhuroon" },
      { lb: "si kucken", arPronoun: "hum", arVerb: "yandhuroon" },
    ],
  },
];

// Flatten VERBS into individual quiz items. `stage` is either "infinitive"
// or "form" so the app can filter by item type; `level` is the tier the item
// belongs to (1: infinitives, 2: ana/anta/huwa/hiya, 3: nahnu/antum/hum) so
// the app can filter by the active level. PERSONS[0..3] (ech/du/hien/hatt,
// i.e. ana/anta/huwa/hiya) are level 2; PERSONS[4..6] (mir/dir/si, i.e.
// nahnu/antum/hum) are level 3.
//
// `answer` is the primary grading target (verb-only for conjugated forms,
// since the Lëtzebuergesch prompt already establishes the subject).
// `altAnswer` is the full pronoun+verb phrase, accepted as an alternate for
// anyone who types it out of habit. `displayAnswer` is always the full
// phrase, shown in feedback for context even though only the verb was
// required. `acceptedAnswers`/`acceptedAltAnswers` are what grading
// actually checks against (see matching.js's isCorrectForItem) -- each is
// generateAcceptedAnswers() run on this item's own answer/altAnswer only,
// so one item's accepted spellings can never include another item's, even
// a coincidentally similar one.
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
      acceptedAnswers: generateAcceptedAnswers(verb.infinitive.ar),
      acceptedAltAnswers: null,
      displayAnswer: verb.infinitive.ar,
    });
    verb.forms.forEach((form, i) => {
      const altAnswer = `${form.arPronoun} ${form.arVerb}`;
      items.push({
        id: `${verb.id}.${PERSONS[i]}`,
        verbId: verb.id,
        stage: "form",
        level: i < 4 ? 2 : 3,
        prompt: form.lb,
        gloss: verb.infinitive.en,
        answer: form.arVerb,
        altAnswer,
        acceptedAnswers: generateAcceptedAnswers(form.arVerb),
        acceptedAltAnswers: generateAcceptedAnswers(altAnswer),
        displayAnswer: altAnswer,
      });
    });
  }
  return items;
}

const ITEMS = buildItems();

// ---------------------------------------------------------------------
// Phrases -- a separate content track from the verb-conjugation levels
// above (Level 1/2/3), not a continuation of them. Different skill (phrase
// recognition vs. verb production), different question format (multiple
// choice vs. typing), no fixed test/pass-threshold. See CLAUDE.md's
// "Phrases" section for the full architecture; the short version is that
// this array is the ENTIRE data surface for that feature -- unlike VERBS/
// ITEMS above, phrases are never run through generateAcceptedAnswers or
// any of matching.js's machinery, since grading here is trivial exact-match
// on which multiple-choice option was clicked (see quiz.js). `id` is a
// stable slug (never derived from `lb`/`en` at runtime) used for per-phrase
// streak stats, the same way conjugation items use their own id scheme --
// the two id namespaces don't overlap (dotted vs. hyphenated) so they can
// safely share the general shuffle/weighting helpers in quiz.js without
// ever colliding.
const PHRASES = [
  { id: "moien", lb: "Moien", en: "hello", ar: "marhaban" },
  { id: "gudde-moien", lb: "Gudde Moien", en: "good morning", ar: "sabah al-khayr" },
  { id: "gudden-owend", lb: "Gudden Owend", en: "good evening", ar: "masa al-khayr" },
  { id: "wei-geet-et-iech", lb: "Wéi geet et Iech?", en: "how are you?", ar: "kayfa haluk" },
  { id: "mir-geet-et-gutt", lb: "Mir geet et gutt, merci", en: "I'm fine, thank you", ar: "ana bikhayr, shukran" },
  { id: "merci", lb: "Merci", en: "thank you", ar: "shukran" },
  { id: "gaer-geschitt", lb: "Gär geschitt", en: "you're welcome", ar: "afwan" },
  { id: "wann-ech-gelift", lb: "Wann ech gelift", en: "please", ar: "min fadlak" },
  { id: "entschellegt", lb: "Entschëllegt", en: "sorry / excuse me", ar: "asif" },
  { id: "jo", lb: "Jo", en: "yes", ar: "na'am" },
  { id: "nee", lb: "Nee", en: "no", ar: "la" },
  { id: "wei-heeschs-du", lb: "Wéi heeschs du?", en: "what is your name?", ar: "ma ismuk" },
  { id: "ech-heeschen", lb: "Ech heeschen...", en: "my name is...", ar: "ismi..." },
  { id: "wat-mechs-du", lb: "Wat méchs du?", en: "what are you doing?", ar: "madha taf'al" },
  { id: "firwat-mechs-du-dat", lb: "Firwat méchs du dat?", en: "why are you doing that?", ar: "limadha taf'al dhalik" },
  { id: "vu-wou-kenns-du", lb: "Vu wou kënns du?", en: "where are you from?", ar: "min ayna anta" },
  { id: "wei-al-bass-du", lb: "Wéi al bass du?", en: "how old are you?", ar: "kam umruk" },
  { id: "ech-verstinn-net", lb: "Ech verstinn net", en: "I don't understand", ar: "la afham" },
  { id: "addi", lb: "Äddi", en: "goodbye", ar: "ma'a as-salama" },
  { id: "wou-ass", lb: "Wou ass...?", en: "where is...?", ar: "ayna..." },
  {
    id: "ech-schwatzen-nemmen-e-bessen-arabesch",
    lb: "Ech schwätzen nëmmen e bëssen Arabesch",
    en: "I just speak a little Arabic",
    ar: "atakallam al-arabiyya qaliylan",
  },
  {
    id: "ech-sinn-gemescht",
    lb: "Ech sinn gemëscht, Lëtzebuergesch-Algeresch",
    en: "I am mixed, I am Luxembourgish-Algerian",
    ar: "ana mukhtalit, luksemburgi jazairi",
  },
];

if (typeof module !== "undefined" && module.exports) {
  module.exports = { PERSONS, VERBS, ITEMS, PHRASES };
}
