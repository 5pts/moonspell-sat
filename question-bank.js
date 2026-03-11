(function () {
  const bank = window.QUESTION_BANK;
  const meta = window.QUESTION_META || { questions: {} };
  const lexiconSeed = window.LEXICON_SEED || { entries: {} };
  if (!bank) {
    return;
  }

  const STORAGE_KEYS = {
    favorites: "moonspell-favorite-questions",
    wrongBook: "moonspell-custom-wrongbook",
    words: "moonspell-wordbook",
    mode: "moonspell-view-mode",
  };

  const PREFIX_NOTES = [
    ["anti", "Prefix hook: `anti-` often signals opposition or resistance."],
    ["bene", "Root hook: `bene-` often points to goodness or benefit."],
    ["dis", "Prefix hook: `dis-` often signals separation, negation, or undoing."],
    ["hetero", "Root hook: `hetero-` points to difference or mixed kinds."],
    ["inter", "Prefix hook: `inter-` usually means between or among."],
    ["pre", "Prefix hook: `pre-` suggests before or in advance."],
    ["pro", "Prefix hook: `pro-` often suggests forward motion or support."],
    ["trans", "Prefix hook: `trans-` suggests across or through."],
  ];

  const SUFFIX_NOTES = [
    ["ity", "Suffix hook: `-ity` often turns an adjective into an abstract noun."],
    ["ive", "Suffix hook: `-ive` often forms adjectives describing a force or tendency."],
    ["ous", "Suffix hook: `-ous` often forms adjectives full of a quality."],
    ["tion", "Suffix hook: `-tion` often turns an action into a noun."],
    ["ment", "Suffix hook: `-ment` often names a result or condition."],
    ["al", "Suffix hook: `-al` often forms adjectives linked to a quality or relation."],
    ["ic", "Suffix hook: `-ic` often forms adjectives tied to a field or quality."],
    ["ly", "Suffix hook: `-ly` often marks adverbs and can cue sentence role."],
  ];

  const state = {
    search: "",
    section: "all",
    duplicatesOnly: false,
    focusDuplicateIds: null,
    collectionFilter: "all",
    mode: window.localStorage.getItem(STORAGE_KEYS.mode) || "practice",
    selectedWord: null,
    selectedWordQuestionId: null,
    selectedQuestionId: null,
    favorites: loadIdSet(STORAGE_KEYS.favorites),
    wrongBook: loadIdSet(STORAGE_KEYS.wrongBook),
    savedWords: loadObject(STORAGE_KEYS.words),
  };

  const heroStats = document.getElementById("heroStats");
  const modeSwitch = document.getElementById("modeSwitch");
  const searchInput = document.getElementById("searchInput");
  const sectionSelect = document.getElementById("sectionSelect");
  const jumpInput = document.getElementById("jumpInput");
  const jumpButton = document.getElementById("jumpButton");
  const duplicatesOnly = document.getElementById("duplicatesOnly");
  const collectionStats = document.getElementById("collectionStats");
  const collectionFilters = document.getElementById("collectionFilters");
  const sectionChips = document.getElementById("sectionChips");
  const duplicateList = document.getElementById("duplicateList");
  const resultHeading = document.getElementById("resultHeading");
  const toolbarMeta = document.getElementById("toolbarMeta");
  const questionSections = document.getElementById("questionSections");
  const wordDetail = document.getElementById("wordDetail");
  const selectionDetail = document.getElementById("selectionDetail");

  function loadIdSet(key) {
    try {
      return new Set(JSON.parse(window.localStorage.getItem(key) || "[]"));
    } catch (_error) {
      return new Set();
    }
  }

  function saveIdSet(key, value) {
    window.localStorage.setItem(key, JSON.stringify(Array.from(value)));
  }

  function loadObject(key) {
    try {
      return JSON.parse(window.localStorage.getItem(key) || "{}");
    } catch (_error) {
      return {};
    }
  }

  function saveObject(key, value) {
    window.localStorage.setItem(key, JSON.stringify(value));
  }

  function escapeHtml(value) {
    return value
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#39;");
  }

  function createStatCard(value, label) {
    const card = document.createElement("div");
    card.className = "stat-card";
    card.innerHTML = `<strong>${value}</strong><span>${label}</span>`;
    return card;
  }

  function renderHeroStats() {
    const walkthroughCount = Object.keys(meta.questions || {}).length;
    heroStats.replaceChildren(
      createStatCard(bank.summary.totalQuestions, "Questions"),
      createStatCard(state.wrongBook.size, "Wrong Book Picks"),
      createStatCard(Object.keys(state.savedWords).length, "Saved Words"),
      createStatCard(walkthroughCount, "Walkthrough Keys")
    );
  }

  function buildChip(value, label, onClick) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "chip";
    button.dataset.value = value;
    button.textContent = label;
    button.addEventListener("click", onClick);
    return button;
  }

  function renderModeSwitch() {
    modeSwitch.innerHTML = "";
    const fragment = document.createDocumentFragment();
    [
      ["practice", "Practice"],
      ["walkthrough", "Walkthrough"],
    ].forEach(function (pair) {
      const value = pair[0];
      const label = pair[1];
      const button = buildChip(value, label, function () {
        state.mode = value;
        window.localStorage.setItem(STORAGE_KEYS.mode, value);
        renderModeSwitch();
        renderQuestions();
      });
      button.classList.toggle("is-active", state.mode === value);
      fragment.appendChild(button);
    });
    modeSwitch.appendChild(fragment);
  }

  function renderSectionControls() {
    const fragment = document.createDocumentFragment();
    const defaultOption = document.createElement("option");
    defaultOption.value = "all";
    defaultOption.textContent = "All sections";
    fragment.appendChild(defaultOption);

    for (const section of bank.sections) {
      const option = document.createElement("option");
      option.value = section.code;
      option.textContent = `${section.code} · ${section.displayName}`;
      fragment.appendChild(option);
    }
    sectionSelect.appendChild(fragment);

    const chipFragment = document.createDocumentFragment();
    chipFragment.appendChild(
      buildChip("all", "All", function () {
        state.section = "all";
        sectionSelect.value = "all";
        syncChipState();
        renderQuestions();
      })
    );
    for (const section of bank.sections) {
      chipFragment.appendChild(
        buildChip(section.code, section.code, function () {
          state.section = section.code;
          sectionSelect.value = section.code;
          syncChipState();
          renderQuestions();
        })
      );
    }
    sectionChips.appendChild(chipFragment);
    syncChipState();
  }

  function syncChipState() {
    for (const chip of sectionChips.querySelectorAll(".chip")) {
      chip.classList.toggle("is-active", chip.dataset.value === state.section);
    }
  }

  function renderDuplicateList() {
    if (!bank.duplicateGroups.length) {
      duplicateList.innerHTML = '<div class="empty-state">No exact duplicate stems detected.</div>';
      return;
    }

    const fragment = document.createDocumentFragment();
    for (const group of bank.duplicateGroups) {
      const item = document.createElement("button");
      item.type = "button";
      item.className = "duplicate-item";
      item.innerHTML = `<strong>${group.questionIds.join(" / ")}</strong><div class="muted">${group.count} linked prompts with matching stems.</div>`;
      item.addEventListener("click", function () {
        state.duplicatesOnly = true;
        state.focusDuplicateIds = new Set(group.questionIds);
        state.collectionFilter = "all";
        state.section = "all";
        duplicatesOnly.checked = true;
        sectionSelect.value = "all";
        searchInput.value = "";
        state.search = "";
        renderCollectionControls();
        syncChipState();
        renderQuestions();
        const element = document.getElementById(group.questionIds[0]);
        if (element) {
          element.scrollIntoView({ behavior: "smooth", block: "start" });
        }
      });
      fragment.appendChild(item);
    }
    duplicateList.replaceChildren(fragment);
  }

  function renderCollectionControls() {
    collectionStats.innerHTML = `
      <div class="collection-stat"><strong>${state.favorites.size}</strong><span>Favorites</span></div>
      <div class="collection-stat"><strong>${state.wrongBook.size}</strong><span>Wrong Book</span></div>
      <div class="collection-stat"><strong>${Object.keys(state.savedWords).length}</strong><span>Wordbook</span></div>
    `;

    collectionFilters.innerHTML = "";
    [
      ["all", "All questions"],
      ["favorites", "Favorites"],
      ["wrongbook", "Wrong book"],
    ].forEach(function (pair) {
      const button = buildChip(pair[0], pair[1], function () {
        state.collectionFilter = pair[0];
        renderCollectionControls();
        renderQuestions();
      });
      button.classList.toggle("is-active", state.collectionFilter === pair[0]);
      collectionFilters.appendChild(button);
    });
  }

  function normalize(value) {
    return value.trim().toLowerCase();
  }

  function searchableText(question) {
    return [
      question.globalId,
      question.localId,
      question.sectionDisplayName,
      question.stem,
      ...question.options.map(function (option) {
        return option.text;
      }),
    ]
      .join(" ")
      .toLowerCase();
  }

  function belongsToCollection(question) {
    if (state.collectionFilter === "favorites") {
      return state.favorites.has(question.globalId);
    }
    if (state.collectionFilter === "wrongbook") {
      return state.wrongBook.has(question.globalId);
    }
    return true;
  }

  function filterQuestions() {
    const needle = normalize(state.search);
    return bank.questions.filter(function (question) {
      if (state.section !== "all" && question.sectionCode !== state.section) {
        return false;
      }
      if (!belongsToCollection(question)) {
        return false;
      }
      if (state.duplicatesOnly && question.duplicateCount === 0) {
        return false;
      }
      if (state.focusDuplicateIds && !state.focusDuplicateIds.has(question.globalId)) {
        return false;
      }
      if (!needle) {
        return true;
      }
      return searchableText(question).includes(needle);
    });
  }

  function renderToolbarMeta(filtered) {
    toolbarMeta.innerHTML = "";
    const metaValues = [];
    metaValues.push(`${filtered.length} visible`);
    metaValues.push(state.mode);
    if (state.section !== "all") {
      metaValues.push(`section ${state.section}`);
    }
    if (state.collectionFilter !== "all") {
      metaValues.push(state.collectionFilter);
    }
    if (state.duplicatesOnly) {
      metaValues.push("duplicates only");
    }
    if (state.focusDuplicateIds) {
      metaValues.push("selected group");
    }
    const pill = document.createElement("div");
    pill.className = "badge";
    pill.textContent = metaValues.join(" · ");
    toolbarMeta.appendChild(pill);
  }

  function decorateText(text, questionId) {
    return escapeHtml(text).replace(/\b([A-Za-z][A-Za-z'-]{2,})\b/g, function (match, token) {
      return `<button type="button" class="word-token" data-word="${token.toLowerCase()}" data-question-id="${questionId}">${escapeHtml(match)}</button>`;
    });
  }

  function walkthroughMarkup(question) {
    const solution = meta.questions ? meta.questions[question.globalId] : null;
    if (!solution) {
      return `
        <div class="walkthrough-panel walkthrough-panel--pending">
          <strong>Walkthrough key pending</strong>
          <p>This question has not been matched to an answer source yet. The logic slot is ready in <code>question_meta.json</code>.</p>
        </div>
      `;
    }
    return `
      <div class="walkthrough-panel">
        <div class="badge-row">
          <span class="badge badge--danger">Answer ${solution.answerLetter}</span>
          <span class="badge">${escapeHtml(solution.answerText)}</span>
        </div>
        <p>${escapeHtml(solution.walkthroughExplanation)}</p>
        <a class="inline-link" href="${solution.sourceUrl}" target="_blank" rel="noreferrer">Source walkthrough page</a>
      </div>
    `;
  }

  function renderQuestions() {
    const filtered = filterQuestions();
    resultHeading.textContent = `${filtered.length} question${filtered.length === 1 ? "" : "s"} in view`;
    renderToolbarMeta(filtered);
    renderSelectionDetail();

    if (!filtered.length) {
      questionSections.innerHTML = '<div class="empty-state">No questions matched the current filter.</div>';
      return;
    }

    const grouped = new Map();
    for (const question of filtered) {
      if (!grouped.has(question.sectionCode)) {
        grouped.set(question.sectionCode, []);
      }
      grouped.get(question.sectionCode).push(question);
    }

    const fragment = document.createDocumentFragment();
    for (const section of bank.sections) {
      const questions = grouped.get(section.code);
      if (!questions || !questions.length) {
        continue;
      }

      const block = document.createElement("section");
      block.className = "section-block";

      const header = document.createElement("div");
      header.className = "section-header";
      header.innerHTML = `
        <div>
          <h3>${section.displayName}</h3>
          <p>${section.code} · ${section.startGlobalId}-${section.endGlobalId}</p>
        </div>
        <div class="section-header__meta">
          <div>${questions.length} visible</div>
          <div>${section.count} total</div>
        </div>
      `;
      block.appendChild(header);

      const grid = document.createElement("div");
      grid.className = "question-grid";

      for (const question of questions) {
        const isFavorite = state.favorites.has(question.globalId);
        const isWrongBook = state.wrongBook.has(question.globalId);
        const card = document.createElement("article");
        card.className = "question-card";
        if (isWrongBook) {
          card.classList.add("question-card--picked");
        }
        card.id = question.globalId;
        card.dataset.localId = question.localId;
        card.dataset.questionId = question.globalId;

        card.innerHTML = `
          <div class="question-card__top">
            <div class="badge-row">
              <span class="badge">${question.globalId}</span>
              <span class="badge">${question.localId}</span>
              <span class="badge">${question.optionCount} options</span>
              ${question.duplicateCount ? `<span class="badge badge--duplicate">${question.duplicateCount} possible duplicate${question.duplicateCount > 1 ? "s" : ""}</span>` : ""}
            </div>
            <div class="muted">${question.sectionDisplayName}</div>
          </div>

          <h4>${decorateText(question.stem, question.globalId)}</h4>

          <ol class="question-options">
            ${question.options
              .map(function (option) {
                return `<li><span class="option-label">${option.label}</span><span>${decorateText(option.text, question.globalId)}</span></li>`;
              })
              .join("")}
          </ol>

          <div class="action-row">
            <button type="button" class="button button--ghost action-button ${isFavorite ? "is-active" : ""}" data-action="toggle-favorite" data-question-id="${question.globalId}">
              ${isFavorite ? "Favorited" : "Favorite"}
            </button>
            <button type="button" class="button button--ghost action-button ${isWrongBook ? "is-active" : ""}" data-action="toggle-wrongbook" data-question-id="${question.globalId}">
              ${isWrongBook ? "In Wrong Book" : "Add to Wrong Book"}
            </button>
            <button type="button" class="button button--ghost action-button" data-action="select-question" data-question-id="${question.globalId}">
              Inspect
            </button>
          </div>

          ${state.mode === "walkthrough" ? walkthroughMarkup(question) : ""}
        `;
        grid.appendChild(card);
      }

      block.appendChild(grid);
      fragment.appendChild(block);
    }

    questionSections.replaceChildren(fragment);
  }

  function jumpToQuestion() {
    const needle = normalize(jumpInput.value);
    if (!needle) {
      return;
    }

    const target = bank.questions.find(function (question) {
      return normalize(question.globalId) === needle || normalize(question.localId) === needle;
    });

    if (!target) {
      jumpInput.focus();
      return;
    }

    state.section = target.sectionCode;
    state.search = "";
    state.collectionFilter = "all";
    state.duplicatesOnly = false;
    state.focusDuplicateIds = null;
    sectionSelect.value = target.sectionCode;
    searchInput.value = "";
    duplicatesOnly.checked = false;
    renderCollectionControls();
    syncChipState();
    renderQuestions();

    const element = document.getElementById(target.globalId);
    if (element) {
      element.scrollIntoView({ behavior: "smooth", block: "start" });
      element.classList.add("is-highlighted");
      window.setTimeout(function () {
        element.classList.remove("is-highlighted");
      }, 1800);
    }
  }

  function buildFallbackDerivatives(word) {
    const derived = [];
    if (word.length > 4) {
      derived.push(word + "s");
      if (/[a-z]e$/.test(word)) {
        derived.push(word.slice(0, -1) + "ing");
      }
      derived.push(word + "ly");
      derived.push(word + "ness");
    }
    return Array.from(new Set(derived)).filter(function (item) {
      return item !== word;
    }).slice(0, 6);
  }

  function buildFallbackHooks(word, question) {
    const hooks = [
      {
        title: "Context anchor",
        text: `Anchor it to ${question.globalId}: rehearse the word against "${question.stem.slice(0, 88)}...".`,
      },
    ];

    const lowered = word.toLowerCase();
    const prefixMatch = PREFIX_NOTES.find(function (entry) {
      return lowered.startsWith(entry[0]) && lowered.length - entry[0].length >= 3;
    });
    const suffixMatch = SUFFIX_NOTES.find(function (entry) {
      return lowered.endsWith(entry[0]) && lowered.length - entry[0].length >= 2;
    });

    if (prefixMatch) {
      hooks.push({ title: "Prefix / root hook", text: prefixMatch[1] });
    } else if (suffixMatch) {
      hooks.push({ title: "Suffix / family hook", text: suffixMatch[1] });
    } else {
      hooks.push({
        title: "Sound hook",
        text: `Chunk the form as ${lowered.match(/.{1,3}/g).join("-")} and rehearse it aloud with the source sentence.`,
      });
    }
    return hooks;
  }

  function getWordEntry(word, questionId) {
    const lowered = word.toLowerCase();
    const seed = lexiconSeed.entries ? lexiconSeed.entries[lowered] : null;
    const question = bank.questions.find(function (item) {
      return item.globalId === questionId;
    }) || bank.questions[0];

    return {
      word: lowered,
      cambridgeUrl: (seed && seed.cambridgeUrl) || `https://dictionary.cambridge.org/us/search/english/direct/?q=${lowered}`,
      merriamUrl: (seed && seed.merriamUrl) || `https://www.merriam-webster.com/dictionary/${lowered}`,
      relatedQuestionIds: (seed && seed.relatedQuestionIds) || [questionId],
      memoryHooks: (seed && seed.memoryHooks && seed.memoryHooks.length ? seed.memoryHooks : buildFallbackHooks(lowered, question)).slice(0, 2),
      authorityExamples: (seed && seed.authorityExamples) || [],
      derivatives: (seed && seed.derivatives && seed.derivatives.length ? seed.derivatives : buildFallbackDerivatives(lowered)).slice(0, 8),
      status: (seed && seed.status) || "seeded",
    };
  }

  function saveWord(word, questionId) {
    const lowered = word.toLowerCase();
    const record = state.savedWords[lowered] || {
      word: lowered,
      questionIds: [],
      addedAt: new Date().toISOString(),
    };
    if (!record.questionIds.includes(questionId)) {
      record.questionIds.push(questionId);
    }
    state.savedWords[lowered] = record;
    saveObject(STORAGE_KEYS.words, state.savedWords);
    renderHeroStats();
    renderCollectionControls();
    renderWordDetail();
  }

  function renderWordDetail() {
    if (!state.selectedWord || !state.selectedWordQuestionId) {
      wordDetail.innerHTML = `
        <div class="detail-card is-empty">
          Click any word in the stem or options. This panel will show dictionary links, mnemonic hooks, derivatives, and source questions.
        </div>
      `;
      return;
    }

    const entry = getWordEntry(state.selectedWord, state.selectedWordQuestionId);
    const saved = Boolean(state.savedWords[entry.word]);
    wordDetail.innerHTML = `
      <div class="detail-card__head">
        <div class="badge-row">
          <span class="badge">${entry.word}</span>
          <span class="badge">${saved ? "Saved" : "Unsaved"}</span>
        </div>
        <h3>${entry.word}</h3>
      </div>

      <div class="detail-card__grid">
        <div class="detail-row">
          <strong>Dictionary</strong>
          <div class="detail-actions">
            <a class="button button--ghost" href="${entry.cambridgeUrl}" target="_blank" rel="noreferrer">Cambridge</a>
            <a class="button button--ghost" href="${entry.merriamUrl}" target="_blank" rel="noreferrer">Merriam-Webster</a>
            <button id="saveWordButton" class="button button--solid" type="button">${saved ? "Saved to flashcards" : "Save to flashcards"}</button>
          </div>
        </div>

        <div class="detail-row">
          <strong>Mnemonic Hooks</strong>
          <ul class="mini-list">
            ${entry.memoryHooks.map(function (hook) {
              return `<li><strong>${escapeHtml(hook.title)}</strong><span>${escapeHtml(hook.text)}</span></li>`;
            }).join("")}
          </ul>
        </div>

        <div class="detail-row">
          <strong>Authority Examples</strong>
          ${
            entry.authorityExamples.length
              ? `<ul class="mini-list">${entry.authorityExamples.map(function (example) {
                  return `<li><strong>${escapeHtml(example.source)}</strong><span>${escapeHtml(example.text)}</span></li>`;
                }).join("")}</ul>`
              : `<div class="muted">This word is wired for authority examples, but this seed set still needs a licensed dictionary API or manual editorial fill for this entry.</div>`
          }
        </div>

        <div class="detail-row">
          <strong>Derived / Related Forms</strong>
          <div class="chip-grid">
            ${
              entry.derivatives.length
                ? entry.derivatives.map(function (item) {
                    return `<span class="chip chip--static">${escapeHtml(item)}</span>`;
                  }).join("")
                : '<span class="muted">No derivatives seeded yet.</span>'
            }
          </div>
        </div>

        <div class="detail-row">
          <strong>Source Questions</strong>
          <div class="chip-grid">
            ${entry.relatedQuestionIds.slice(0, 10).map(function (questionId) {
              return `<button type="button" class="chip" data-action="jump-question" data-question-id="${questionId}">${questionId}</button>`;
            }).join("")}
          </div>
        </div>
      </div>
    `;

    document.getElementById("saveWordButton").addEventListener("click", function () {
      saveWord(entry.word, state.selectedWordQuestionId);
    });
  }

  function renderSelectionDetail() {
    const selectedIds = Array.from(state.wrongBook).sort();
    if (!selectedIds.length) {
      selectionDetail.innerHTML = `
        <div class="detail-card is-empty">
          Use “Add to Wrong Book” on any question. Favorites are separate; a question does not need to be favorited first.
        </div>
      `;
      return;
    }

    const visible = selectedIds.slice(0, 14);
    selectionDetail.innerHTML = `
      <div class="detail-card__head">
        <div class="badge-row">
          <span class="badge">${selectedIds.length} selected</span>
        </div>
        <h3>Your Wrong Book</h3>
      </div>

      <div class="detail-card__grid">
        <div class="detail-row">
          <strong>Question IDs</strong>
          <div class="chip-grid">
            ${visible.map(function (questionId) {
              return `<button type="button" class="chip" data-action="jump-question" data-question-id="${questionId}">${questionId}</button>`;
            }).join("")}
          </div>
        </div>

        <div class="detail-row">
          <strong>Collection Logic</strong>
          <div class="muted">This deck is fully manual: any question can be added here whether it is favorited or not. Use the “Wrong book” filter on the left to browse only this set.</div>
        </div>

        <div class="detail-actions">
          <button id="clearWrongBook" class="button button--ghost" type="button">Clear selection</button>
        </div>
      </div>
    `;

    document.getElementById("clearWrongBook").addEventListener("click", function () {
      state.wrongBook = new Set();
      saveIdSet(STORAGE_KEYS.wrongBook, state.wrongBook);
      renderHeroStats();
      renderCollectionControls();
      renderQuestions();
    });
  }

  function setSelectedWord(word, questionId) {
    state.selectedWord = word.toLowerCase();
    state.selectedWordQuestionId = questionId;
    renderWordDetail();
  }

  function toggleFavorite(questionId) {
    if (state.favorites.has(questionId)) {
      state.favorites.delete(questionId);
    } else {
      state.favorites.add(questionId);
    }
    saveIdSet(STORAGE_KEYS.favorites, state.favorites);
    renderHeroStats();
    renderCollectionControls();
    renderQuestions();
  }

  function toggleWrongBook(questionId) {
    if (state.wrongBook.has(questionId)) {
      state.wrongBook.delete(questionId);
    } else {
      state.wrongBook.add(questionId);
    }
    state.selectedQuestionId = questionId;
    saveIdSet(STORAGE_KEYS.wrongBook, state.wrongBook);
    renderHeroStats();
    renderCollectionControls();
    renderQuestions();
  }

  function handleQuestionAreaClick(event) {
    const wordButton = event.target.closest(".word-token");
    if (wordButton) {
      setSelectedWord(wordButton.dataset.word, wordButton.dataset.questionId);
      return;
    }

    const actionButton = event.target.closest("[data-action]");
    if (!actionButton) {
      return;
    }

    const action = actionButton.dataset.action;
    const questionId = actionButton.dataset.questionId;

    if (action === "toggle-favorite") {
      toggleFavorite(questionId);
      return;
    }
    if (action === "toggle-wrongbook") {
      toggleWrongBook(questionId);
      return;
    }
    if (action === "select-question") {
      state.selectedQuestionId = questionId;
      const question = bank.questions.find(function (item) {
        return item.globalId === questionId;
      });
      if (question) {
        const firstWord = (question.stem.match(/[A-Za-z][A-Za-z'-]{2,}/) || [])[0];
        if (firstWord) {
          setSelectedWord(firstWord, questionId);
        }
      }
      return;
    }
    if (action === "jump-question") {
      jumpInput.value = questionId;
      jumpToQuestion();
    }
  }

  searchInput.addEventListener("input", function (event) {
    state.search = event.target.value;
    state.focusDuplicateIds = null;
    renderQuestions();
  });

  sectionSelect.addEventListener("change", function (event) {
    state.section = event.target.value;
    state.focusDuplicateIds = null;
    syncChipState();
    renderQuestions();
  });

  duplicatesOnly.addEventListener("change", function (event) {
    state.duplicatesOnly = event.target.checked;
    if (!state.duplicatesOnly) {
      state.focusDuplicateIds = null;
    }
    renderQuestions();
  });

  jumpButton.addEventListener("click", jumpToQuestion);
  jumpInput.addEventListener("keydown", function (event) {
    if (event.key === "Enter") {
      jumpToQuestion();
    }
  });

  questionSections.addEventListener("click", handleQuestionAreaClick);
  wordDetail.addEventListener("click", handleQuestionAreaClick);
  selectionDetail.addEventListener("click", handleQuestionAreaClick);

  renderHeroStats();
  renderModeSwitch();
  renderSectionControls();
  renderDuplicateList();
  renderCollectionControls();
  renderWordDetail();
  renderQuestions();
})();
