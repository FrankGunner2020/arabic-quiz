(function () {
  "use strict";

  const STORAGE_KEY = "arabic-quiz-state-v1";
  const MASTERY_STREAK = 2; // streak needed for an item to count toward a verb milestone

  const LEVEL1_ITEMS = ITEMS.filter((item) => item.level === 1);
  const LEVEL2_ITEMS = ITEMS.filter((item) => item.level === 2);
  // Level 3 (nahnu/antum/hum) is reachable once Level 2 is passed and, like
  // Levels 1/2, is a fixed-length pass/fail test -- see TEST_CONFIG below.
  // It's the last level: passing it doesn't unlock anything further.
  const LEVEL3_ITEMS = ITEMS.filter((item) => item.level === 3);

  const LEVEL_POOLS = { 1: LEVEL1_ITEMS, 2: LEVEL2_ITEMS, 3: LEVEL3_ITEMS };
  const LEVEL_LABELS = {
    1: "Level 1 — infinitives",
    2: "Level 2 — ana, anta, huwa, hiya",
    3: "Level 3 — nahnu, antum, hum",
  };

  const ITEMS_BY_ID = new Map(ITEMS.map((item) => [item.id, item]));

  // Arabic pronoun for each Lëtzebuergesch person key. The person key
  // itself IS the Lëtzebuergesch pronoun word used in every prompt for that
  // person (e.g. "du gees"), so no separate lb-pronoun table is needed.
  const PERSON_AR = {
    ech: "ana",
    du: "anta",
    hien: "huwa",
    hatt: "hiya",
    mir: "nahnu",
    dir: "antum",
    si: "hum",
  };
  // Which persons (as PERSONS keys) belong to each level's pronoun set, for
  // the pronoun pill and the milestone dots. Level 1 (infinitives) has none.
  const LEVEL_PRONOUNS = {
    2: ["ech", "du", "hien", "hatt"],
    3: ["mir", "dir", "si"],
  };
  const LEVEL_PRONOUN_LIST = {
    1: "The infinitives",
    2: "Ana, anta, huwa, hiya",
    3: "Nahnu, antum, hum",
  };
  // CSS custom property name (defined in style.css) for each person's
  // milestone dot color.
  const DOT_VAR = {
    ech: "--dot-ana",
    du: "--dot-anta",
    hien: "--dot-huwa",
    hatt: "--dot-hiya",
    mir: "--dot-nahnu",
    dir: "--dot-antum",
    si: "--dot-hum",
  };

  // A conjugated-form item's id is `${verbId}.${person}`; infinitives
  // (`${verbId}.inf`) have no person. Returns null for infinitives.
  function personOf(item) {
    if (item.stage !== "form") return null;
    return item.id.slice(item.id.lastIndexOf(".") + 1);
  }

  // Levels with a fixed-length pass/fail test, keyed by level number. All
  // three levels currently use this. A future level could still fall back
  // to continuous practice (see the weighted item picker further below) by
  // simply not getting an entry here.
  const TEST_CONFIG = {
    1: {
      pool: LEVEL1_ITEMS,
      total: LEVEL1_ITEMS.length, // 13
      // 11/13 (~85%) rounds to exactly the threshold but 12/13 (~92%) is the
      // next whole score above it, so require 12 to be unambiguously a pass.
      passThreshold: 12,
      nextLevel: 2,
      unlockMessage: "Level 2 unlocked!",
      actionLabel: "Start Level 2 →",
    },
    2: {
      pool: LEVEL2_ITEMS,
      total: LEVEL2_ITEMS.length, // 52
      // 44/52 is ~84.6% (just under 85%); 45/52 is ~86.5%, the smallest
      // count that clears 85%.
      passThreshold: 45,
      nextLevel: 3,
      unlockMessage: "Level 3 unlocked!",
      actionLabel: "Start Level 3 →",
    },
    3: {
      pool: LEVEL3_ITEMS,
      total: LEVEL3_ITEMS.length, // 39
      // 33/39 is ~84.6% (just under 85%); 34/39 is ~87.2%, the smallest
      // count that clears 85%.
      passThreshold: 34,
      // Last level -- passing doesn't unlock a next level, so there's no
      // nextLevel to advance to. Handled explicitly wherever nextLevel is
      // consumed (levelCardState, the resultAction click handler).
      nextLevel: null,
      unlockMessage: "Level 3 complete!",
      actionLabel: "Back to home",
    },
  };

  // ---------- state ----------

  function freshLevelStats() {
    return { totalAnswered: 0, totalCorrect: 0, currentStreak: 0 };
  }

  function defaultState() {
    return {
      level: 1, // 1 | 2 | 3 -- the level currently being practiced; can move
      // backward if the user revisits an earlier, already-passed level from
      // the home screen, so it is NOT what gates unlocking (see
      // unlockedLevel below).
      unlockedLevel: 1, // highest level ever reached; only ever increases.
      // Used for home-screen unlock gating instead of `level` so that
      // replaying an earlier level never re-locks a later one.
      test: null, // { order, index, correctCount, done, passed } -- current fixed-test attempt (levels 1/2 only)
      items: {}, // id -> { correct, incorrect, streak }
      // Session stats (streak/accuracy/answered), tracked separately per
      // level so switching levels doesn't blend one level's numbers into
      // another's. Accumulates across retries within a level (a Level 1
      // retry doesn't zero these out) rather than resetting per attempt.
      levelStats: { 1: freshLevelStats(), 2: freshLevelStats(), 3: freshLevelStats() },
      // Snapshot of each fixed-test level's most recent passing attempt
      // (score/total), taken right before the live test object is cleared
      // on advancing. Purely for the home screen's "Passed — X/Y" display;
      // doesn't feed back into scoring or unlock logic.
      lastTest: { 1: null, 2: null, 3: null },
      milestones: [], // verb ids that have reached full mastery (historical, never removed)
      pendingExport: [], // milestones not yet copied into progress-log.json
      // Persistent "Day N · X answered today" header line. dayCount is
      // consecutive CALENDAR days with >=1 answered question (a gap of a
      // day or more resets it to 1, not 0, so the header always reads as
      // "you're on day N" rather than implying zero days of practice).
      // todayCount resets silently on the first answer of a new day.
      dayCount: 1,
      todayCount: 0,
      lastPracticeDate: null, // "YYYY-MM-DD" of the last answered question
    };
  }

  function loadState() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return defaultState();
      const parsed = JSON.parse(raw);
      const merged = Object.assign(defaultState(), parsed);
      // Migration safety: saves from before unlockedLevel existed shouldn't
      // suddenly appear to have levels 2/3 locked just because the field
      // was missing.
      merged.unlockedLevel = Math.max(merged.unlockedLevel || 1, merged.level || 1);
      return merged;
    } catch (e) {
      return defaultState();
    }
  }

  function saveState() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }

  let state = loadState();

  function getItemStats(id) {
    return state.items[id] || { correct: 0, incorrect: 0, streak: 0 };
  }

  function todayStr() {
    return new Date().toISOString().slice(0, 10);
  }

  // Updates dayCount/todayCount for the header's "Day N · X answered
  // today" line. Only runs on an actual answer (not on page load/render),
  // per the spec: same day -> just bump todayCount; yesterday -> increment
  // dayCount; anything else (including the very first answer ever, where
  // lastPracticeDate is null) -> reset dayCount to 1. No guilt copy, no
  // color change on reset -- the number just changes.
  function touchPracticeDay() {
    const today = todayStr();
    if (state.lastPracticeDate === today) {
      state.todayCount += 1;
      return;
    }
    const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
    state.dayCount = state.lastPracticeDate === yesterday ? state.dayCount + 1 : 1;
    state.lastPracticeDate = today;
    state.todayCount = 1;
  }

  function recordAnswer(id, isCorrect) {
    touchPracticeDay();
    const stats = getItemStats(id);
    if (isCorrect) {
      stats.correct += 1;
      stats.streak += 1;
    } else {
      stats.incorrect += 1;
      stats.streak = 0;
    }
    state.items[id] = stats;

    const levelStats = state.levelStats[state.level];
    levelStats.totalAnswered += 1;
    if (isCorrect) {
      levelStats.totalCorrect += 1;
      levelStats.currentStreak += 1;
    } else {
      levelStats.currentStreak = 0;
    }

    checkMilestones();
  }

  function checkMilestones() {
    VERBS.forEach((verb) => {
      if (state.milestones.includes(verb.id)) return;
      const ids = [`${verb.id}.inf`, ...PERSONS.map((p) => `${verb.id}.${p}`)];
      const fullyMastered = ids.every(
        (id) => getItemStats(id).streak >= MASTERY_STREAK
      );
      if (fullyMastered) {
        state.milestones.push(verb.id);
        state.pendingExport.push({
          verbId: verb.id,
          achievedAt: new Date().toISOString().slice(0, 10),
        });
      }
    });
  }

  // ---------- fixed-length tests (levels 1 and 2) ----------

  function shuffle(arr) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      const tmp = a[i];
      a[i] = a[j];
      a[j] = tmp;
    }
    return a;
  }

  function newTest(level) {
    const cfg = TEST_CONFIG[level];
    return {
      order: shuffle(cfg.pool.map((item) => item.id)),
      index: 0,
      correctCount: 0,
      done: false,
      passed: false,
    };
  }

  function ensureTest() {
    const cfg = TEST_CONFIG[state.level];
    if (!cfg) return;
    // A saved test can be stale in two ways: it can reference item ids that
    // no longer exist after a data.js edit (e.g. the huwa/hiya split
    // renamed "verb.hien-hatt" to "verb.hien"/"verb.hatt"), or -- now that
    // the home screen lets state.level move around freely -- it can belong
    // to a *different* level than the one we're about to render (e.g. an
    // in-progress Level 2 test still sitting in state.test after navigating
    // home and into Level 1). Either way, discard rather than crash or show
    // the wrong pool.
    if (
      state.test &&
      !state.test.order.every((id) => {
        const item = ITEMS_BY_ID.get(id);
        return item && item.level === state.level;
      })
    ) {
      state.test = null;
    }
    if (!state.test) {
      state.test = newTest(state.level);
      saveState();
    }
  }

  // ---------- weighted item picker ----------
  // Currently unused by renderQuestion -- all three levels have a
  // TEST_CONFIG entry now, so the `else` branch below that calls
  // pickWeightedItem never runs. Kept as shared fallback architecture for
  // any future level that wants open-ended continuous practice instead of
  // a fixed test. activePool() itself is still used by the word list.

  function activePool() {
    return LEVEL_POOLS[state.level] || LEVEL1_ITEMS;
  }

  let lastItemId = null;

  function pickWeightedItem(pool) {
    // Never repeat the immediately preceding item, unless the pool is too
    // small to avoid it.
    const candidates =
      pool.length > 1 ? pool.filter((item) => item.id !== lastItemId) : pool;
    const weights = candidates.map((item) =>
      Math.max(0.3, 3 - getItemStats(item.id).streak)
    );
    const total = weights.reduce((a, b) => a + b, 0);
    let r = Math.random() * total;
    for (let i = 0; i < candidates.length; i++) {
      r -= weights[i];
      if (r <= 0) return candidates[i];
    }
    return candidates[candidates.length - 1];
  }

  // ---------- DOM ----------

  // "home" | "quiz". Not persisted -- every page load starts on the home
  // screen (a navigation hub across the three levels) rather than always
  // dropping back into whichever level was last active. Navigating between
  // views never touches in-progress test data, so leaving mid-attempt and
  // coming back via the Home/level-card buttons is lossless.
  let view = "home";

  const els = {
    practiceDay: document.getElementById("practice-day"),
    practiceCount: document.getElementById("practice-count"),
    homeBtn: document.getElementById("home-btn"),
    homeView: document.getElementById("home-view"),
    quizViewRoot: document.getElementById("quiz-view-root"),
    quizCard: document.getElementById("quiz-card"),
    levelCards: {
      1: {
        button: document.getElementById("level-card-1"),
        fraction: document.getElementById("level-card-fraction-1"),
        status: document.getElementById("level-card-status-1"),
        track: document.getElementById("level-progress-track-1"),
        fill: document.getElementById("level-progress-fill-1"),
        note: document.getElementById("level-card-note-1"),
      },
      2: {
        button: document.getElementById("level-card-2"),
        fraction: document.getElementById("level-card-fraction-2"),
        status: document.getElementById("level-card-status-2"),
        track: document.getElementById("level-progress-track-2"),
        fill: document.getElementById("level-progress-fill-2"),
        note: document.getElementById("level-card-note-2"),
      },
      3: {
        button: document.getElementById("level-card-3"),
        fraction: document.getElementById("level-card-fraction-3"),
        status: document.getElementById("level-card-status-3"),
        track: document.getElementById("level-progress-track-3"),
        fill: document.getElementById("level-progress-fill-3"),
        note: document.getElementById("level-card-note-3"),
      },
    },
    statStreak: document.getElementById("stat-streak"),
    statAccuracy: document.getElementById("stat-accuracy"),
    statTotal: document.getElementById("stat-total"),
    pillLevel: document.getElementById("pill-level"),
    pillPronoun: document.getElementById("pill-pronoun"),
    questionView: document.getElementById("question-view"),
    gloss: document.getElementById("gloss"),
    prompt: document.getElementById("prompt"),
    form: document.getElementById("answer-form"),
    input: document.getElementById("answer-input"),
    submitBtn: document.querySelector("#answer-form button[type=submit]"),
    progressCounter: document.getElementById("progress-counter"),
    feedback: document.getElementById("feedback"),
    resultView: document.getElementById("result-view"),
    resultPlain: document.getElementById("result-plain"),
    resultScore: document.getElementById("result-score"),
    resultMessage: document.getElementById("result-message"),
    resultAction: document.getElementById("result-action"),
    milestoneView: document.getElementById("milestone-view"),
    milestoneKicker: document.getElementById("milestone-kicker"),
    milestoneScore: document.getElementById("milestone-score"),
    milestoneSub: document.getElementById("milestone-sub"),
    milestoneDots: document.getElementById("milestone-dots"),
    milestoneLine: document.getElementById("milestone-line"),
    milestoneAction: document.getElementById("milestone-action"),
    exportSection: document.getElementById("export-section"),
    exportJson: document.getElementById("export-json"),
    exportCopy: document.getElementById("export-copy"),
    exportMarkDone: document.getElementById("export-mark-done"),
    wordListBtn: document.getElementById("word-list-btn"),
    wordListOverlay: document.getElementById("word-list-overlay"),
    wordListTitle: document.getElementById("word-list-title"),
    wordListBody: document.getElementById("word-list-body"),
    wordListClose: document.getElementById("word-list-close"),
  };

  let currentItem = null;
  let awaitingNext = false;
  // Cosmetic-only, not persisted: whether the streak stat should read in
  // the "reset" color (stays true across question loads until the next
  // correct answer, per spec) and a one-shot flag consumed by renderStats()
  // to (re)trigger the streak bump animation on a correct answer.
  let streakReset = false;
  let pendingStreakBump = false;

  function renderStats() {
    const levelStats = state.levelStats[state.level];
    els.statStreak.textContent = levelStats.currentStreak;
    els.statTotal.textContent = levelStats.totalAnswered;
    els.statAccuracy.textContent =
      levelStats.totalAnswered === 0
        ? "—"
        : Math.round((levelStats.totalCorrect / levelStats.totalAnswered) * 100) + "%";

    els.statStreak.classList.toggle("is-reset", streakReset);
    if (pendingStreakBump) {
      pendingStreakBump = false;
      els.statStreak.classList.remove("bump");
      void els.statStreak.offsetWidth; // force reflow so the animation retriggers
      els.statStreak.classList.add("bump");
    }
  }

  function renderPracticeLine() {
    els.practiceDay.textContent = state.dayCount;
    els.practiceCount.textContent = state.todayCount;
  }

  function renderLevelPill() {
    els.pillLevel.textContent = `Level ${state.level}`;
  }

  function formatPassDate(dateStr) {
    // Append a fixed time-of-day so this parses as local time everywhere,
    // not UTC midnight (which can roll back a day in western timezones).
    const d = new Date(`${dateStr}T00:00:00`);
    return d.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
  }

  function showQuestionView() {
    els.questionView.hidden = false;
    els.resultView.hidden = true;
  }

  // Populates the level-hue milestone takeover (`#milestone-view`) shown
  // in place of the plain result view when a fixed test is genuinely
  // passed. `pct` is the score percentage, already computed by the caller.
  function renderMilestone(cfg, test, pct) {
    const level = state.level;
    const dateLabel = formatPassDate(test.passedAt || todayStr());
    const verb = cfg.nextLevel ? "passed" : "complete";
    els.milestoneKicker.textContent = `Level ${level} — ${verb} · ${dateLabel}`;

    els.milestoneScore.textContent = "";
    els.milestoneScore.appendChild(document.createTextNode(String(test.correctCount)));
    const totalSpan = document.createElement("span");
    totalSpan.textContent = `/${cfg.total}`;
    els.milestoneScore.appendChild(totalSpan);

    els.milestoneSub.textContent = `${pct}% · every form asked once, no repeats`;

    const pronouns = LEVEL_PRONOUNS[level] || [];
    els.milestoneDots.innerHTML = "";
    pronouns.forEach((person) => {
      const dot = document.createElement("span");
      dot.style.background = `var(${DOT_VAR[person]})`;
      els.milestoneDots.appendChild(dot);
    });
    els.milestoneDots.hidden = pronouns.length === 0;

    const list = LEVEL_PRONOUN_LIST[level] || "";
    els.milestoneLine.textContent = cfg.nextLevel
      ? `${list} — yours. Level ${cfg.nextLevel} unlocked.`
      : `${list} — yours. Every level complete.`;

    els.milestoneAction.textContent = cfg.actionLabel;
  }

  function showResultView() {
    els.questionView.hidden = true;
    els.resultView.hidden = false;
    els.pillPronoun.hidden = true; // no single "current question" on a result screen

    const cfg = TEST_CONFIG[state.level];
    const test = state.test;
    const pct = Math.round((test.correctCount / cfg.total) * 100);

    if (test.passed) {
      els.resultPlain.hidden = true;
      els.milestoneView.hidden = false;
      renderMilestone(cfg, test, pct);
    } else {
      els.resultPlain.hidden = false;
      els.milestoneView.hidden = true;
      els.resultScore.textContent = `${test.correctCount}/${cfg.total} (${pct}%)`;
      els.resultMessage.textContent = `Not quite — ${cfg.passThreshold}/${cfg.total} needed to pass.`;
      els.resultMessage.className = "result-message fail";
      els.resultAction.textContent = "Retry";
    }
  }

  function renderQuestion() {
    const cfg = TEST_CONFIG[state.level];
    if (cfg) {
      ensureTest();
      const test = state.test;
      currentItem = ITEMS_BY_ID.get(test.order[test.index]);
      els.progressCounter.hidden = false;
      els.progressCounter.textContent = `${test.index + 1}/${cfg.total}`;
    } else {
      currentItem = pickWeightedItem(activePool());
      els.progressCounter.hidden = true;
    }
    lastItemId = currentItem.id;

    const person = personOf(currentItem);
    if (person) {
      els.pillPronoun.textContent = `${PERSON_AR[person]} · ${person}`;
      els.pillPronoun.hidden = false;
    } else {
      els.pillPronoun.hidden = true;
    }

    awaitingNext = false;
    els.gloss.textContent = currentItem.gloss;
    els.prompt.textContent = currentItem.prompt;
    els.input.value = "";
    els.input.disabled = false;
    els.submitBtn.textContent = "Check";
    els.feedback.textContent = "";
    els.feedback.className = "feedback";
    els.input.focus();
  }

  // Renders "Not quite — " followed by the correct answer with a
  // character-level diff overlay against what was actually typed. Grading
  // has already happened by the time this runs (isCorrectForItem already
  // returned false) -- this is purely visualizing where the divergence is.
  // Diffs against whichever of the item's accepted variants (verb-only or,
  // if typed, the full pronoun+verb phrase) is actually closest to what was
  // typed (matching.js's closestAcceptedAnswer), not always the verb-only
  // answer -- otherwise a legitimate full-phrase attempt with a wrong verb
  // would show its correct pronoun as garbled/wrong, since it isn't part
  // of the verb-only string.
  function renderAnswerDiff(rawInput, item) {
    els.feedback.textContent = "";

    els.feedback.appendChild(document.createTextNode("Not quite — "));

    const diffTarget = closestAcceptedAnswer(rawInput, item);
    const diffEl = document.createElement("span");
    diffEl.className = "answer-diff";
    diffAnswer(rawInput, diffTarget).forEach((seg) => {
      const span = document.createElement("span");
      span.className = "diff-" + seg.kind;
      span.textContent = seg.text;
      diffEl.appendChild(span);
    });
    els.feedback.appendChild(diffEl);
  }

  function renderExportSection() {
    const hasPending = state.pendingExport.length > 0;
    els.exportSection.hidden = !hasPending;
    if (!hasPending) return;

    const entries = state.pendingExport.map((m) => {
      const verb = VERBS.find((v) => v.id === m.verbId);
      return { verb: verb.id, gloss: verb.infinitive.en, masteredAt: m.achievedAt };
    });
    els.exportJson.value = JSON.stringify(entries, null, 2);
  }

  function renderQuizView() {
    // Drives every var(--level...) reference in style.css for whichever
    // level is currently active (pills, prompt plate, progress fill,
    // milestone field) -- see the [data-level] alias block in style.css.
    els.quizCard.dataset.level = state.level;

    renderStats();
    renderLevelPill();
    renderExportSection();

    if (TEST_CONFIG[state.level]) {
      ensureTest();
      if (state.test.done) {
        showResultView();
        return;
      }
    }
    showQuestionView();
    renderQuestion();
  }

  // ---------- home screen ----------

  function levelUnlocked(level) {
    return state.unlockedLevel >= level;
  }

  // `label` override lets level 3 (the last level, nothing further to
  // unlock) read "Completed" instead of "Passed" -- same variant/styling,
  // different copy. A passed attempt always asked every item in the pool
  // exactly once, so its fraction badge is always total/total (not
  // correctCount/total -- that's what the status label is for).
  function passedResult(correctCount, total, label) {
    const pct = Math.round((correctCount / total) * 100);
    return {
      clickable: true,
      variant: "passed",
      label: label || `Passed — ${correctCount}/${total}`,
      percent: pct,
      note: null,
      fraction: { num: total, den: total },
    };
  }

  function passedLabel(level, correctCount, total) {
    return level === 3
      ? `Completed — ${correctCount}/${total}`
      : `Passed — ${correctCount}/${total}`;
  }

  // Computes what a home-screen level card should show. `variant` is for
  // styling only (progress-bar color, locked/disabled look); `label` and
  // `note` are the copy shown on the card. `fraction` feeds the mono
  // "31/52"-style badge next to the title.
  function levelCardState(level) {
    const cfg = TEST_CONFIG[level];
    const unlocked = levelUnlocked(level);

    if (!unlocked) {
      return {
        clickable: false,
        variant: "locked",
        label: "Locked",
        percent: null,
        note:
          level === 2
            ? "Pass Level 1 to unlock."
            : level === 3
            ? "Pass Level 2 to unlock."
            : null,
        fraction: { num: 0, den: cfg.total },
      };
    }

    // Unlocked. If this is the level currently being practiced, read the
    // live test; otherwise it's an already-passed level left behind, so
    // fall back to the recorded snapshot (or a generic "Passed" if the
    // snapshot predates that bookkeeping).
    if (state.level === level) {
      const test = state.test;
      if (!test) {
        const last = state.lastTest[level];
        return last
          ? passedResult(last.correctCount, last.total, passedLabel(level, last.correctCount, last.total))
          : {
              clickable: true,
              variant: "not-started",
              label: "Not started",
              percent: 0,
              note: null,
              fraction: { num: 0, den: cfg.total },
            };
      }
      if (test.done) {
        const pct = Math.round((test.correctCount / cfg.total) * 100);
        return {
          clickable: true,
          variant: test.passed ? "passed" : "failed",
          label: test.passed
            ? passedLabel(level, test.correctCount, cfg.total)
            : `Not quite — ${test.correctCount}/${cfg.total}`,
          percent: pct,
          note: null,
          // Every item was asked exactly once whether the attempt passed
          // or failed -- the fraction badge tracks "how much of the test
          // did you go through", not the score (that's the label above).
          fraction: { num: cfg.total, den: cfg.total },
        };
      }
      // ensureTest() creates the test object as soon as the quiz view is
      // rendered, even before the first question is answered, so index 0
      // still reads as "Not started" rather than a premature 0% "In
      // progress" the moment a level is merely opened.
      if (test.index === 0) {
        return {
          clickable: true,
          variant: "not-started",
          label: "Not started",
          percent: 0,
          note: null,
          fraction: { num: 0, den: cfg.total },
        };
      }
      const pct = Math.round((test.index / cfg.total) * 100);
      return {
        clickable: true,
        variant: "in-progress",
        label: "In progress",
        percent: pct,
        note: null,
        fraction: { num: test.index, den: cfg.total },
      };
    }

    const last = state.lastTest[level];
    if (last) return passedResult(last.correctCount, last.total, passedLabel(level, last.correctCount, last.total));
    if (state.unlockedLevel > level) {
      // Passed at some point but no snapshot on record (e.g. a save from
      // before this bookkeeping existed).
      return {
        clickable: true,
        variant: "passed",
        label: "Passed",
        percent: 100,
        note: null,
        fraction: { num: cfg.total, den: cfg.total },
      };
    }
    return {
      clickable: true,
      variant: "not-started",
      label: "Not started",
      percent: 0,
      note: null,
      fraction: { num: 0, den: cfg.total },
    };
  }

  function renderHome() {
    [1, 2, 3].forEach((level) => {
      const card = els.levelCards[level];
      const cs = levelCardState(level);

      card.button.disabled = !cs.clickable;
      card.button.classList.toggle("passed", cs.variant === "passed");
      card.button.classList.toggle("failed", cs.variant === "failed");
      card.status.textContent = cs.label;
      card.fraction.textContent = `${cs.fraction.num}/${cs.fraction.den}`;

      if (cs.percent === null) {
        card.track.hidden = true;
      } else {
        card.track.hidden = false;
        card.fill.style.width = cs.percent + "%";
      }

      if (cs.note) {
        card.note.textContent = cs.note;
        card.note.hidden = false;
      } else {
        card.note.hidden = true;
      }
    });
  }

  function goToLevel(level) {
    state.level = level;
    view = "quiz";
    streakReset = false; // don't carry a stale reset color in from another level
    saveState();
    render();
  }

  function goHome() {
    view = "home";
    render();
  }

  function render() {
    renderPracticeLine(); // header line is visible on both home and quiz views
    els.homeBtn.hidden = view === "home";
    if (view === "home") {
      els.homeView.hidden = false;
      els.quizViewRoot.hidden = true;
      renderHome();
    } else {
      els.homeView.hidden = true;
      els.quizViewRoot.hidden = false;
      renderQuizView();
    }
  }

  // ---------- word list ----------

  function renderWordList() {
    const pool = activePool();
    els.wordListTitle.textContent = `Word list — ${LEVEL_LABELS[state.level] || ""}`;
    els.wordListBody.innerHTML = "";
    pool.forEach((item, i) => {
      const row = document.createElement("div");
      row.className = "word-row" + (i % 2 === 1 ? " alt" : "");

      const lb = document.createElement("span");
      lb.className = "word-lb";
      lb.textContent = item.prompt;

      const ar = document.createElement("span");
      ar.className = "word-ar";
      ar.textContent = item.displayAnswer;

      row.appendChild(lb);
      row.appendChild(ar);
      els.wordListBody.appendChild(row);
    });
  }

  function openWordList() {
    renderWordList();
    els.wordListOverlay.hidden = false;
  }

  function closeWordList() {
    els.wordListOverlay.hidden = true;
  }

  // ---------- events ----------

  els.form.addEventListener("submit", function (e) {
    e.preventDefault();

    if (!awaitingNext) {
      const value = els.input.value.trim();
      if (!value) return;

      const correct = isCorrectForItem(value, currentItem);
      recordAnswer(currentItem.id, correct);

      // Cosmetic streak-stat state, consumed by the next renderStats()
      // call below -- see the `let streakReset`/`pendingStreakBump`
      // declarations near the top of the DOM section.
      if (correct) {
        streakReset = false;
        pendingStreakBump = true;
      } else {
        streakReset = true;
      }

      const cfg = TEST_CONFIG[state.level];
      let isLastTestQuestion = false;
      if (cfg) {
        const test = state.test;
        if (correct) test.correctCount += 1;
        isLastTestQuestion = test.index === cfg.total - 1;
      }

      els.feedback.className = "feedback " + (correct ? "correct" : "incorrect");
      if (correct) {
        els.feedback.textContent = "Correct.";
      } else {
        renderAnswerDiff(value, currentItem);
      }

      els.input.disabled = true;
      els.submitBtn.textContent = isLastTestQuestion ? "See results" : "Next";
      awaitingNext = true;

      saveState();
      renderStats();
      renderPracticeLine();
      renderExportSection();
      els.submitBtn.focus();
    } else if (TEST_CONFIG[state.level]) {
      const cfg = TEST_CONFIG[state.level];
      const test = state.test;
      test.index += 1;
      if (test.index >= cfg.total) {
        test.done = true;
        test.passed = test.correctCount >= cfg.passThreshold;
        if (test.passed) test.passedAt = todayStr();
        saveState();
        showResultView();
      } else {
        saveState();
        renderQuestion();
      }
    } else {
      renderQuestion();
    }
  });

  // Shared by both the plain result view's Retry/next-level button and the
  // milestone takeover's action button -- which one is visible is decided
  // by showResultView(), but the underlying state transition is identical
  // either way.
  function handleResultAction() {
    const cfg = TEST_CONFIG[state.level];
    const test = state.test;
    if (test.passed) {
      state.lastTest[state.level] = { correctCount: test.correctCount, total: cfg.total };
      state.test = null;
      if (cfg.nextLevel) {
        state.unlockedLevel = Math.max(state.unlockedLevel, cfg.nextLevel);
        state.level = cfg.nextLevel;
      } else {
        // Last level (currently level 3) -- nothing further to unlock.
        // Land back on the home screen so the card shows its completed
        // state instead of re-opening an already-passed test.
        view = "home";
      }
    } else {
      state.test = newTest(state.level);
      streakReset = false; // fresh attempt -- don't carry the reset color over
    }
    saveState();
    render();
  }

  els.resultAction.addEventListener("click", handleResultAction);
  els.milestoneAction.addEventListener("click", handleResultAction);

  els.exportCopy.addEventListener("click", function () {
    navigator.clipboard.writeText(els.exportJson.value);
  });

  els.exportMarkDone.addEventListener("click", function () {
    state.pendingExport = [];
    saveState();
    renderExportSection();
  });

  els.wordListBtn.addEventListener("click", openWordList);
  els.wordListClose.addEventListener("click", closeWordList);
  els.wordListOverlay.addEventListener("click", function (e) {
    if (e.target === els.wordListOverlay) closeWordList();
  });
  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape" && !els.wordListOverlay.hidden) closeWordList();
  });

  els.homeBtn.addEventListener("click", goHome);
  [1, 2, 3].forEach((level) => {
    els.levelCards[level].button.addEventListener("click", function () {
      goToLevel(level);
    });
  });

  // ---------- init ----------

  render();
})();
