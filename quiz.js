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
    homeBtn: document.getElementById("home-btn"),
    homeView: document.getElementById("home-view"),
    quizViewRoot: document.getElementById("quiz-view-root"),
    levelCards: {
      1: {
        button: document.getElementById("level-card-1"),
        lock: document.getElementById("level-card-lock-1"),
        status: document.getElementById("level-card-status-1"),
        track: document.getElementById("level-progress-track-1"),
        fill: document.getElementById("level-progress-fill-1"),
        note: document.getElementById("level-card-note-1"),
      },
      2: {
        button: document.getElementById("level-card-2"),
        lock: document.getElementById("level-card-lock-2"),
        status: document.getElementById("level-card-status-2"),
        track: document.getElementById("level-progress-track-2"),
        fill: document.getElementById("level-progress-fill-2"),
        note: document.getElementById("level-card-note-2"),
      },
      3: {
        button: document.getElementById("level-card-3"),
        lock: document.getElementById("level-card-lock-3"),
        status: document.getElementById("level-card-status-3"),
        track: document.getElementById("level-progress-track-3"),
        fill: document.getElementById("level-progress-fill-3"),
        note: document.getElementById("level-card-note-3"),
      },
    },
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

  // Renders "Not quite — " followed by the correct answer with a
  // character-level diff overlay against what was actually typed. Grading
  // has already happened by the time this runs (isCorrectForItem already
  // returned false) -- this is purely visualizing where the divergence
  // is, against the item's primary answer (the verb-only string that was
  // actually graded, not the full pronoun+verb displayAnswer).
  function renderAnswerDiff(rawInput, item) {
    els.feedback.textContent = "";

    els.feedback.appendChild(document.createTextNode("Not quite — "));

    const diffEl = document.createElement("span");
    diffEl.className = "answer-diff";
    diffAnswer(rawInput, item.answer).forEach((seg) => {
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

  // ---------- home screen ----------

  function levelUnlocked(level) {
    return state.unlockedLevel >= level;
  }

  // `label` override lets level 3 (the last level, nothing further to
  // unlock) read "Completed" instead of "Passed" -- same variant/styling,
  // different copy.
  function passedResult(correctCount, total, label) {
    const pct = Math.round((correctCount / total) * 100);
    return {
      clickable: true,
      variant: "passed",
      label: label || `Passed — ${correctCount}/${total}`,
      percent: pct,
      note: null,
    };
  }

  function passedLabel(level, correctCount, total) {
    return level === 3
      ? `Completed — ${correctCount}/${total}`
      : `Passed — ${correctCount}/${total}`;
  }

  // Computes what a home-screen level card should show. `variant` is for
  // styling only (progress-bar color, locked/disabled look); `label` and
  // `note` are the copy shown on the card.
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
          : { clickable: true, variant: "not-started", label: "Not started", percent: 0, note: null };
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
        };
      }
      // ensureTest() creates the test object as soon as the quiz view is
      // rendered, even before the first question is answered, so index 0
      // still reads as "Not started" rather than a premature 0% "In
      // progress" the moment a level is merely opened.
      if (test.index === 0) {
        return { clickable: true, variant: "not-started", label: "Not started", percent: 0, note: null };
      }
      const pct = Math.round((test.index / cfg.total) * 100);
      return { clickable: true, variant: "in-progress", label: "In progress", percent: pct, note: null };
    }

    const last = state.lastTest[level];
    if (last) return passedResult(last.correctCount, last.total, passedLabel(level, last.correctCount, last.total));
    if (state.unlockedLevel > level) {
      // Passed at some point but no snapshot on record (e.g. a save from
      // before this bookkeeping existed).
      return { clickable: true, variant: "passed", label: "Passed", percent: 100, note: null };
    }
    return { clickable: true, variant: "not-started", label: "Not started", percent: 0, note: null };
  }

  function renderHome() {
    [1, 2, 3].forEach((level) => {
      const card = els.levelCards[level];
      const cs = levelCardState(level);

      card.button.disabled = !cs.clickable;
      card.button.classList.toggle("passed", cs.variant === "passed");
      card.button.classList.toggle("failed", cs.variant === "failed");
      card.lock.hidden = cs.variant !== "locked";
      card.status.textContent = cs.label;

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
    saveState();
    render();
  }

  function goHome() {
    view = "home";
    render();
  }

  function render() {
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

  els.homeBtn.addEventListener("click", goHome);
  [1, 2, 3].forEach((level) => {
    els.levelCards[level].button.addEventListener("click", function () {
      goToLevel(level);
    });
  });

  // ---------- init ----------

  render();
})();
