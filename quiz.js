(function () {
  "use strict";

  const STORAGE_KEY = "arabic-quiz-state-v1";
  const UNLOCK_STREAK = 2; // correct-in-a-row streak needed to unlock the next level
  const MASTERY_STREAK = 2; // streak needed for an item to count toward a verb milestone

  const LEVEL1_ITEMS = ITEMS.filter((item) => item.level === 1);
  const LEVEL2_ITEMS = ITEMS.filter((item) => item.level === 2);
  // Level 3 (nahnu/antum/hum) mirrors Level 2's shape but has no unlock path
  // wired up yet. Extension point: once LEVEL2_ITEMS are all mastered (same
  // UNLOCK_STREAK pattern as the Level 1 -> 2 check in checkLevelUp below),
  // set state.level = 3 there and return true the same way.
  const LEVEL3_ITEMS = ITEMS.filter((item) => item.level === 3);

  const LEVEL_POOLS = { 1: LEVEL1_ITEMS, 2: LEVEL2_ITEMS, 3: LEVEL3_ITEMS };
  const LEVEL_LABELS = {
    1: "Level 1 — infinitives",
    2: "Level 2 — ana, anta, huwa",
    3: "Level 3 — nahnu, antum, hum",
  };

  // ---------- state ----------

  function defaultState() {
    return {
      level: 1, // 1 | 2 | 3 (3 has no unlock path yet, see LEVEL3_ITEMS above)
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

  function checkLevelUp() {
    if (state.level === 1) {
      const allMastered = LEVEL1_ITEMS.every(
        (item) => getItemStats(item.id).streak >= UNLOCK_STREAK
      );
      if (allMastered) {
        state.level = 2;
        return true;
      }
    }
    return false;
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

    const leveledUp = checkLevelUp();
    checkMilestones();
    saveState();
    return leveledUp;
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

  // ---------- item selection ----------

  function activePool() {
    return LEVEL_POOLS[state.level] || LEVEL1_ITEMS;
  }

  let lastItemId = null;

  function pickNextItem() {
    const pool = activePool();
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
    levelUpMessage: document.getElementById("level-up-message"),
    gloss: document.getElementById("gloss"),
    prompt: document.getElementById("prompt"),
    form: document.getElementById("answer-form"),
    input: document.getElementById("answer-input"),
    submitBtn: document.querySelector("#answer-form button[type=submit]"),
    feedback: document.getElementById("feedback"),
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

  function renderQuestion() {
    currentItem = pickNextItem();
    lastItemId = currentItem.id;
    awaitingNext = false;
    els.levelUpMessage.hidden = true;
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

  function renderAll() {
    renderStats();
    renderLevelLabel();
    renderExportSection();
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
      const leveledUp = recordAnswer(currentItem.id, correct);

      els.feedback.className = "feedback " + (correct ? "correct" : "incorrect");
      els.feedback.textContent = correct
        ? "Correct."
        : `Not quite — ${currentItem.displayAnswer}`;

      if (leveledUp) {
        els.levelUpMessage.textContent = `Level ${state.level} unlocked`;
        els.levelUpMessage.hidden = false;
      }

      els.input.disabled = true;
      els.submitBtn.textContent = "Next";
      awaitingNext = true;

      renderStats();
      renderLevelLabel();
      renderExportSection();
      els.submitBtn.focus();
    } else {
      renderQuestion();
    }
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

  renderAll();
  renderQuestion();
})();
