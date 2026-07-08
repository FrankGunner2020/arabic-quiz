(function () {
  "use strict";

  const STORAGE_KEY = "arabic-quiz-state-v1";
  const UNLOCK_STREAK = 2; // infinitive streak needed to unlock the all-forms stage
  const MASTERY_STREAK = 2; // streak needed for an item to count as "mastered" in the grid

  const INFINITIVE_ITEMS = ITEMS.filter((item) => item.stage === "infinitive");

  // ---------- state ----------

  function defaultState() {
    return {
      stage: "infinitive", // "infinitive" | "all"
      items: {}, // id -> { correct, incorrect, streak }
      totalAnswered: 0,
      totalCorrect: 0,
      currentStreak: 0,
      hasUnlockedForms: false,
      bannerDismissed: false,
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

    checkUnlock();
    checkMilestones();
    saveState();
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

  function checkUnlock() {
    if (state.hasUnlockedForms) return;
    const allMastered = INFINITIVE_ITEMS.every(
      (item) => getItemStats(item.id).streak >= UNLOCK_STREAK
    );
    if (allMastered) {
      state.hasUnlockedForms = true;
      state.bannerDismissed = false;
    }
  }

  // ---------- item selection ----------

  function activePool() {
    return state.stage === "infinitive" ? INFINITIVE_ITEMS : ITEMS;
  }

  function pickNextItem() {
    const pool = activePool();
    const weights = pool.map((item) =>
      Math.max(0.3, 3 - getItemStats(item.id).streak)
    );
    const total = weights.reduce((a, b) => a + b, 0);
    let r = Math.random() * total;
    for (let i = 0; i < pool.length; i++) {
      r -= weights[i];
      if (r <= 0) return pool[i];
    }
    return pool[pool.length - 1];
  }

  // ---------- DOM ----------

  const els = {
    statStreak: document.getElementById("stat-streak"),
    statAccuracy: document.getElementById("stat-accuracy"),
    statTotal: document.getElementById("stat-total"),
    stageToggle: document.getElementById("stage-toggle"),
    unlockBanner: document.getElementById("unlock-banner"),
    unlockSwitch: document.getElementById("unlock-switch"),
    unlockDismiss: document.getElementById("unlock-dismiss"),
    gloss: document.getElementById("gloss"),
    prompt: document.getElementById("prompt"),
    form: document.getElementById("answer-form"),
    input: document.getElementById("answer-input"),
    submitBtn: document.querySelector("#answer-form button[type=submit]"),
    feedback: document.getElementById("feedback"),
    masteryGrid: document.getElementById("mastery-grid"),
    exportSection: document.getElementById("export-section"),
    exportJson: document.getElementById("export-json"),
    exportCopy: document.getElementById("export-copy"),
    exportMarkDone: document.getElementById("export-mark-done"),
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

  function renderStageToggle() {
    if (state.stage === "infinitive") {
      els.stageToggle.textContent = "All forms →";
      els.stageToggle.disabled = !state.hasUnlockedForms;
      els.stageToggle.title = state.hasUnlockedForms
        ? ""
        : "Answer every infinitive correctly twice in a row to unlock";
    } else {
      els.stageToggle.textContent = "← Infinitives only";
      els.stageToggle.disabled = false;
      els.stageToggle.title = "";
    }

    const showBanner =
      state.hasUnlockedForms && state.stage === "infinitive" && !state.bannerDismissed;
    els.unlockBanner.hidden = !showBanner;
  }

  function renderQuestion() {
    currentItem = pickNextItem();
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

  function renderMasteryGrid() {
    els.masteryGrid.innerHTML = "";
    VERBS.forEach((verb) => {
      const ids =
        state.stage === "infinitive"
          ? [`${verb.id}.inf`]
          : ITEMS.filter((item) => item.verbId === verb.id).map((item) => item.id);

      const masteredCount = ids.filter(
        (id) => getItemStats(id).streak >= MASTERY_STREAK
      ).length;
      const percent = Math.round((masteredCount / ids.length) * 100);

      const row = document.createElement("div");
      row.className = "mastery-row";

      const label = document.createElement("div");
      label.className = "mastery-label";
      label.textContent = verb.infinitive.lb;

      const barTrack = document.createElement("div");
      barTrack.className = "mastery-bar-track";
      const bar = document.createElement("div");
      bar.className = "mastery-bar-fill";
      bar.style.width = percent + "%";
      barTrack.appendChild(bar);

      const count = document.createElement("div");
      count.className = "mastery-count";
      count.textContent = `${masteredCount}/${ids.length}`;

      row.appendChild(label);
      row.appendChild(barTrack);
      row.appendChild(count);
      els.masteryGrid.appendChild(row);
    });
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
    renderStageToggle();
    renderMasteryGrid();
    renderExportSection();
  }

  // ---------- events ----------

  els.form.addEventListener("submit", function (e) {
    e.preventDefault();

    if (!awaitingNext) {
      const value = els.input.value.trim();
      if (!value) return;

      const correct = isCorrectForItem(value, currentItem);
      recordAnswer(currentItem.id, correct);

      els.feedback.className = "feedback " + (correct ? "correct" : "incorrect");
      els.feedback.textContent = correct
        ? "Correct."
        : `Not quite — ${currentItem.displayAnswer}`;

      els.input.disabled = true;
      els.submitBtn.textContent = "Next";
      awaitingNext = true;

      renderStats();
      renderStageToggle();
      renderMasteryGrid();
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

  els.stageToggle.addEventListener("click", function () {
    if (els.stageToggle.disabled) return;
    state.stage = state.stage === "infinitive" ? "all" : "infinitive";
    saveState();
    renderAll();
    renderQuestion();
  });

  els.unlockSwitch.addEventListener("click", function () {
    state.stage = "all";
    state.bannerDismissed = true;
    saveState();
    renderAll();
    renderQuestion();
  });

  els.unlockDismiss.addEventListener("click", function () {
    state.bannerDismissed = true;
    saveState();
    renderStageToggle();
  });

  // ---------- init ----------

  renderAll();
  renderQuestion();
})();
