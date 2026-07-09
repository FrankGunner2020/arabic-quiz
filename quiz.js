(function () {
  "use strict";

  const STORAGE_KEY = "arabic-quiz-state-v1";
  const MASTERY_STREAK = 2; // streak needed for an item to count toward a verb milestone

  const LEVEL1_ITEMS = ITEMS.filter((item) => item.level === 1);
  const LEVEL2_ITEMS = ITEMS.filter((item) => item.level === 2);
  // Level 3 (nahnu/antum/hum) mirrors Level 2's shape but has no unlock path
  // wired up yet. Extension point: once there's a policy for unlocking it
  // (fixed test like Level 1, or a streak-based gate like Level 1 used to
  // be), set state.level = 3 wherever that condition is checked and give it
  // the same treatment Level 1/2 get below.
  const LEVEL3_ITEMS = ITEMS.filter((item) => item.level === 3);

  const LEVEL_POOLS = { 1: LEVEL1_ITEMS, 2: LEVEL2_ITEMS, 3: LEVEL3_ITEMS };
  const LEVEL_LABELS = {
    1: "Level 1 — infinitives",
    2: "Level 2 — ana, anta, huwa",
    3: "Level 3 — nahnu, antum, hum",
  };

  const ITEMS_BY_ID = new Map(ITEMS.map((item) => [item.id, item]));

  const LEVEL1_TOTAL = LEVEL1_ITEMS.length; // 13
  // 11/13 (~85%) rounds to exactly the threshold but 12/13 (~92%) is the
  // next whole score above it, so require 12 to be unambiguously a pass.
  const LEVEL1_PASS_THRESHOLD = 12;

  // ---------- state ----------

  function defaultState() {
    return {
      level: 1, // 1 | 2 | 3 (3 has no unlock path yet, see LEVEL3_ITEMS above)
      level1Test: null, // { order, index, correctCount, done, passed } -- current Level 1 attempt
      items: {}, // id -> { correct, incorrect, streak }
      totalAnswered: 0,
      totalCorrect: 0,
      currentStreak: 0,
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

    state.totalAnswered += 1;
    if (isCorrect) {
      state.totalCorrect += 1;
      state.currentStreak += 1;
    } else {
      state.currentStreak = 0;
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

  // ---------- Level 1 fixed test ----------

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

  function newLevel1Test() {
    return {
      order: shuffle(LEVEL1_ITEMS.map((item) => item.id)),
      index: 0,
      correctCount: 0,
      done: false,
      passed: false,
    };
  }

  function ensureLevel1Test() {
    if (!state.level1Test) {
      state.level1Test = newLevel1Test();
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
    els.statStreak.textContent = state.currentStreak;
    els.statTotal.textContent = state.totalAnswered;
    els.statAccuracy.textContent =
      state.totalAnswered === 0
        ? "—"
        : Math.round((state.totalCorrect / state.totalAnswered) * 100) + "%";
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

    const test = state.level1Test;
    const pct = Math.round((test.correctCount / LEVEL1_TOTAL) * 100);
    els.resultScore.textContent = `${test.correctCount}/${LEVEL1_TOTAL} (${pct}%)`;

    if (test.passed) {
      els.resultMessage.textContent = "Level 2 unlocked!";
      els.resultMessage.className = "result-message pass";
      els.resultAction.textContent = "Start Level 2 →";
    } else {
      els.resultMessage.textContent = `Not quite — ${LEVEL1_PASS_THRESHOLD}/${LEVEL1_TOTAL} needed to pass.`;
      els.resultMessage.className = "result-message fail";
      els.resultAction.textContent = "Retry";
    }
  }

  function renderQuestion() {
    if (state.level === 1) {
      ensureLevel1Test();
      const test = state.level1Test;
      currentItem = ITEMS_BY_ID.get(test.order[test.index]);
      els.progressCounter.hidden = false;
      els.progressCounter.textContent = `${test.index + 1}/${LEVEL1_TOTAL}`;
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

    if (state.level === 1) {
      ensureLevel1Test();
      if (state.level1Test.done) {
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

      let isLastLevel1Question = false;
      if (state.level === 1) {
        const test = state.level1Test;
        if (correct) test.correctCount += 1;
        isLastLevel1Question = test.index === LEVEL1_TOTAL - 1;
      }

      els.feedback.className = "feedback " + (correct ? "correct" : "incorrect");
      els.feedback.textContent = correct
        ? "Correct."
        : `Not quite — ${currentItem.displayAnswer}`;

      els.input.disabled = true;
      els.submitBtn.textContent = isLastLevel1Question ? "See results" : "Next";
      awaitingNext = true;

      saveState();
      renderStats();
      renderExportSection();
      els.submitBtn.focus();
    } else if (state.level === 1) {
      const test = state.level1Test;
      test.index += 1;
      if (test.index >= LEVEL1_TOTAL) {
        test.done = true;
        test.passed = test.correctCount >= LEVEL1_PASS_THRESHOLD;
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
    const test = state.level1Test;
    if (test.passed) {
      state.level = 2;
      state.level1Test = null;
    } else {
      state.level1Test = newLevel1Test();
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
