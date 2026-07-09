(function () {
  "use strict";

  const STORAGE_KEY = "arabic-quiz-state-v1";
  const MASTERY_STREAK = 2; // streak needed for an item to count toward a verb milestone

  const LEVEL1_ITEMS = ITEMS.filter((item) => item.level === 1);
  const LEVEL2_ITEMS = ITEMS.filter((item) => item.level === 2);
  // Level 3 (nahnu/antum/hum) is reachable once Level 2 is passed, but stays
  // continuous weighted-repetition practice (no fixed test) -- see
  // TEST_CONFIG below, which only has entries for levels 1 and 2.
  const LEVEL3_ITEMS = ITEMS.filter((item) => item.level === 3);

  const LEVEL_POOLS = { 1: LEVEL1_ITEMS, 2: LEVEL2_ITEMS, 3: LEVEL3_ITEMS };
  const LEVEL_LABELS = {
    1: "Level 1 — infinitives",
    2: "Level 2 — ana, anta, huwa, hiya",
    3: "Level 3 — nahnu, antum, hum",
  };

  const ITEMS_BY_ID = new Map(ITEMS.map((item) => [item.id, item]));

  // Levels with a fixed-length pass/fail test, keyed by level number.
  // Levels not listed here (currently level 3) are continuous practice.
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
  };

  // ---------- state ----------

  function freshLevelStats() {
    return { totalAnswered: 0, totalCorrect: 0, currentStreak: 0 };
  }

  function defaultState() {
    return {
      level: 1, // 1 | 2 | 3
      test: null, // { order, index, correctCount, done, passed } -- current fixed-test attempt (levels 1/2 only)
      items: {}, // id -> { correct, incorrect, streak }
      // Session stats (streak/accuracy/answered), tracked separately per
      // level so switching levels doesn't blend one level's numbers into
      // another's. Accumulates across retries within a level (a Level 1
      // retry doesn't zero these out) rather than resetting per attempt.
      levelStats: { 1: freshLevelStats(), 2: freshLevelStats(), 3: freshLevelStats() },
      milestones: [], // verb ids that have reached full mastery (historical, never removed)
      pendingExport: [], // milestones not yet copied into progress-log.json
    };
  }

  function loadState() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return defaultState();
      const parsed = JSON.parse(raw);
      return Object.assign(defaultState(), parsed);
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

  function recordAnswer(id, isCorrect) {
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
    // A saved in-progress test can reference item ids that no longer exist
    // after a data.js edit (e.g. the huwa/hiya split renamed
    // "verb.hien-hatt" to "verb.hien"/"verb.hatt"). Discard it rather than
    // crashing on the missing lookup.
    if (state.test && !state.test.order.every((id) => ITEMS_BY_ID.has(id))) {
      state.test = null;
    }
    if (!state.test) {
      state.test = newTest(state.level);
      saveState();
    }
  }

  // ---------- item selection (Level 2 / Level 3 continuous practice) ----------

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

  const els = {
    statStreak: document.getElementById("stat-streak"),
    statAccuracy: document.getElementById("stat-accuracy"),
    statTotal: document.getElementById("stat-total"),
    levelLabel: document.getElementById("level-label"),
    questionView: document.getElementById("question-view"),
    gloss: document.getElementById("gloss"),
    prompt: document.getElementById("prompt"),
    form: document.getElementById("answer-form"),
    input: document.getElementById("answer-input"),
    submitBtn: document.querySelector("#answer-form button[type=submit]"),
    progressCounter: document.getElementById("progress-counter"),
    feedback: document.getElementById("feedback"),
    resultView: document.getElementById("result-view"),
    resultScore: document.getElementById("result-score"),
    resultMessage: document.getElementById("result-message"),
    resultAction: document.getElementById("result-action"),
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

  function renderStats() {
    const levelStats = state.levelStats[state.level];
    els.statStreak.textContent = levelStats.currentStreak;
    els.statTotal.textContent = levelStats.totalAnswered;
    els.statAccuracy.textContent =
      levelStats.totalAnswered === 0
        ? "—"
        : Math.round((levelStats.totalCorrect / levelStats.totalAnswered) * 100) + "%";
  }

  function renderLevelLabel() {
    els.levelLabel.textContent = LEVEL_LABELS[state.level] || "";
  }

  function showQuestionView() {
    els.questionView.hidden = false;
    els.resultView.hidden = true;
  }

  function showResultView() {
    els.questionView.hidden = true;
    els.resultView.hidden = false;

    const cfg = TEST_CONFIG[state.level];
    const test = state.test;
    const pct = Math.round((test.correctCount / cfg.total) * 100);
    els.resultScore.textContent = `${test.correctCount}/${cfg.total} (${pct}%)`;

    if (test.passed) {
      els.resultMessage.textContent = cfg.unlockMessage;
      els.resultMessage.className = "result-message pass";
      els.resultAction.textContent = cfg.actionLabel;
    } else {
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

  function render() {
    renderStats();
    renderLevelLabel();
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

      const cfg = TEST_CONFIG[state.level];
      let isLastTestQuestion = false;
      if (cfg) {
        const test = state.test;
        if (correct) test.correctCount += 1;
        isLastTestQuestion = test.index === cfg.total - 1;
      }

      els.feedback.className = "feedback " + (correct ? "correct" : "incorrect");
      els.feedback.textContent = correct
        ? "Correct."
        : `Not quite — ${currentItem.displayAnswer}`;

      els.input.disabled = true;
      els.submitBtn.textContent = isLastTestQuestion ? "See results" : "Next";
      awaitingNext = true;

      saveState();
      renderStats();
      renderExportSection();
      els.submitBtn.focus();
    } else if (TEST_CONFIG[state.level]) {
      const cfg = TEST_CONFIG[state.level];
      const test = state.test;
      test.index += 1;
      if (test.index >= cfg.total) {
        test.done = true;
        test.passed = test.correctCount >= cfg.passThreshold;
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

  els.resultAction.addEventListener("click", function () {
    const cfg = TEST_CONFIG[state.level];
    const test = state.test;
    if (test.passed) {
      state.level = cfg.nextLevel;
      state.test = null;
    } else {
      state.test = newTest(state.level);
    }
    saveState();
    render();
  });

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

  // ---------- init ----------

  render();
})();
