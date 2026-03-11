(function () {
  const bank = window.QUESTION_BANK;
  const meta = window.QUESTION_META || { questions: {} };

  if (!bank || !Array.isArray(bank.questions)) {
    return;
  }

  const STORAGE_KEYS = {
    favorites: "moonspell-local-favorites",
    wrongBook: "moonspell-local-wrongbook",
    wrongBookDraft: "moonspell-local-wrongbook-draft",
    words: "moonspell-local-words",
    dictionary: "moonspell-local-dictionary-cache",
    translations: "moonspell-local-translation-cache",
    tutorialHidden: "moonspell-local-tutorial-hidden",
  };

  const PREFIX_NOTES = [
    ["anti", "Prefix hook: anti- usually signals opposition or resistance."],
    ["bene", "Root hook: bene- often points to goodness or benefit."],
    ["contra", "Prefix hook: contra- often points to opposition."],
    ["dis", "Prefix hook: dis- often signals separation, negation, or undoing."],
    ["hetero", "Root hook: hetero- points to difference or mixed kinds."],
    ["inter", "Prefix hook: inter- usually means between or among."],
    ["mal", "Root hook: mal- often points to badness or failure."],
    ["pre", "Prefix hook: pre- usually marks before or in advance."],
    ["pro", "Prefix hook: pro- often suggests forward motion or support."],
    ["trans", "Prefix hook: trans- suggests across or through."],
  ];

  const SUFFIX_NOTES = [
    ["ity", "Suffix hook: -ity often turns an adjective into an abstract noun."],
    ["ive", "Suffix hook: -ive often forms adjectives describing force or tendency."],
    ["ment", "Suffix hook: -ment often names a result or condition."],
    ["ness", "Suffix hook: -ness often turns an adjective into a state."],
    ["ous", "Suffix hook: -ous often forms adjectives full of a quality."],
    ["tion", "Suffix hook: -tion often turns an action into a noun."],
    ["al", "Suffix hook: -al often forms adjectives linked to a relation or field."],
    ["ly", "Suffix hook: -ly often marks adverbs and can cue sentence role."],
  ];

  const heroStats = document.getElementById("heroStats");
  const tutorialPanel = document.getElementById("tutorialPanel");
  const modeSwitch = document.getElementById("modeSwitch");
  const collectionSwitch = document.getElementById("collectionSwitch");
  const sectionSelect = document.getElementById("sectionSelect");
  const searchInput = document.getElementById("searchInput");
  const jumpInput = document.getElementById("jumpInput");
  const jumpButton = document.getElementById("jumpButton");
  const prevButton = document.getElementById("prevButton");
  const nextButton = document.getElementById("nextButton");
  const duplicatesOnly = document.getElementById("duplicatesOnly");
  const wrongBookList = document.getElementById("wrongBookList");
  const wrongBookPicker = document.getElementById("wrongBookPicker");
  const savedWordsList = document.getElementById("savedWordsList");
  const questionHeading = document.getElementById("questionHeading");
  const questionMeta = document.getElementById("questionMeta");
  const questionCard = document.getElementById("questionCard");
  const wordExplorer = document.getElementById("wordExplorer");
  const flashcardDeck = document.getElementById("flashcardDeck");

  const state = {
    mode: "practice",
    collection: "all",
    section: "all",
    search: "",
    duplicatesOnly: false,
    favorites: loadSet(STORAGE_KEYS.favorites),
    wrongBook: loadSet(STORAGE_KEYS.wrongBook),
    wrongBookDraft: loadSet(STORAGE_KEYS.wrongBookDraft),
    savedWords: loadObject(STORAGE_KEYS.words),
    dictionaryCache: loadObject(STORAGE_KEYS.dictionary),
    pendingDictionary: {},
    translationCache: loadObject(STORAGE_KEYS.translations),
    pendingTranslation: {},
    tutorialHidden: window.localStorage.getItem(STORAGE_KEYS.tutorialHidden) === "1",
    currentQuestionId: bank.questions[0].globalId,
    selectedOptionIndex: null,
    selectedWord: null,
    glossaryOptionIndex: null,
    flashcardWord: null,
    flashcardFace: "front",
  };
  const questionSourceById = Object.create(null);
  let questionSourceLoaded = false;

  const STOP_WORDS = new Set([
    "a",
    "an",
    "and",
    "as",
    "at",
    "be",
    "for",
    "from",
    "in",
    "into",
    "of",
    "on",
    "or",
    "the",
    "to",
    "with",
  ]);

  function loadSet(key) {
    try {
      return new Set(JSON.parse(window.localStorage.getItem(key) || "[]"));
    } catch (_error) {
      return new Set();
    }
  }

  function saveSet(key, value) {
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
    return String(value)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#39;");
  }

  function normalize(value) {
    return String(value || "").trim().toLowerCase();
  }

  function normalizeAnswerText(value) {
    return String(value || "")
      .trim()
      .toLowerCase()
      .replaceAll("…", "...")
      .replace(/\s+/g, " ");
  }

  function getQuestionSource(question) {
    return questionSourceById[question.globalId] || question;
  }

  function loadQuestionSourceData() {
    fetch("src/data/questions.json")
      .then(function (response) {
        if (!response.ok) {
          throw new Error("Question source load failed");
        }
        return response.json();
      })
      .then(function (payload) {
        if (!payload || !Array.isArray(payload.questions)) {
          return;
        }

        payload.questions.forEach(function (question) {
          questionSourceById[question.globalId] = question;
        });

        questionSourceLoaded = true;
        renderAll();
      })
      .catch(function () {
        // Keep local preview usable even if the extended source cannot be loaded.
      });
  }

  function getMetaEntry(question) {
    return meta.questions ? meta.questions[question.globalId] : null;
  }

  function resolveAnswerIndex(question, metaEntry) {
    const options = Array.isArray(question.options) ? question.options : [];

    if (Number.isInteger(question.answer)) {
      if (question.answer >= 0 && question.answer < options.length) {
        return question.answer;
      }
    } else if (typeof question.answer === "string") {
      const answerIndex = options.findIndex(function (option) {
        return normalizeAnswerText(option.text) === normalizeAnswerText(question.answer);
      });
      if (answerIndex !== -1) {
        return answerIndex;
      }
    }

    if (!metaEntry || !metaEntry.answerLetter) {
      return -1;
    }

    const metaAnswerIndex = metaEntry.answerLetter.charCodeAt(0) - 65;
    if (metaAnswerIndex >= 0 && metaAnswerIndex < options.length) {
      return metaAnswerIndex;
    }

    return -1;
  }

  function getAnswerData(question) {
    const sourceQuestion = getQuestionSource(question);
    const metaEntry = getMetaEntry(question);
    const mergedQuestion = {
      options: question.options || [],
      answer: sourceQuestion.answer,
    };
    const answerIndex = resolveAnswerIndex(mergedQuestion, metaEntry);
    const answerLetter = answerIndex >= 0 ? String.fromCharCode(65 + answerIndex) : (metaEntry && metaEntry.answerLetter) || "";
    const answerText = answerIndex >= 0 && question.options[answerIndex]
      ? question.options[answerIndex].text
      : (metaEntry && metaEntry.answerText) || "";

    return {
      answerIndex: answerIndex,
      hasKey: answerIndex >= 0 && !!question.options[answerIndex],
      answerLetter: answerLetter,
      answerText: answerText,
      explanation: sourceQuestion.explanation || (metaEntry && metaEntry.walkthroughExplanation) || "",
      sourceUrl: (metaEntry && metaEntry.sourceUrl) || "",
    };
  }

  function getAnswerIndex(question) {
    return getAnswerData(question).answerIndex;
  }

  function getResolvedAnswerCount() {
    return bank.questions.reduce(function (count, question) {
      return count + (getAnswerIndex(question) >= 0 ? 1 : 0);
    }, 0);
  }

  function filteredQuestions() {
    const needle = normalize(state.search);
    return bank.questions.filter(function (question) {
      if (state.section !== "all" && question.sectionCode !== state.section) {
        return false;
      }
      if (state.collection === "favorites" && !state.favorites.has(question.globalId)) {
        return false;
      }
      if (state.collection === "wrongbook" && !state.wrongBook.has(question.globalId)) {
        return false;
      }
      if (state.duplicatesOnly && !question.duplicateCount) {
        return false;
      }
      if (!needle) {
        return true;
      }
      return [
        question.globalId,
        question.localId,
        question.sectionCode,
        question.sectionDisplayName,
        question.stem,
        ...question.options.map(function (option) {
          return option.text;
        }),
      ].join(" ").toLowerCase().includes(needle);
    });
  }

  function getCurrentQuestionList() {
    const list = filteredQuestions();
    if (!list.length) {
      return [];
    }
    if (!list.some(function (question) {
      return question.globalId === state.currentQuestionId;
    })) {
      state.currentQuestionId = list[0].globalId;
      state.selectedOptionIndex = null;
    }
    return list;
  }

  function getCurrentQuestion() {
    const list = getCurrentQuestionList();
    return list.find(function (question) {
      return question.globalId === state.currentQuestionId;
    }) || list[0] || null;
  }

  function currentQuestionPosition() {
    const list = getCurrentQuestionList();
    const index = list.findIndex(function (question) {
      return question.globalId === state.currentQuestionId;
    });
    return { list: list, index: index };
  }

  function getFavoriteQuestions() {
    return bank.questions.filter(function (question) {
      return state.favorites.has(question.globalId);
    });
  }

  function syncWrongBookDraft() {
    const next = new Set();
    state.wrongBookDraft.forEach(function (questionId) {
      if (state.favorites.has(questionId)) {
        next.add(questionId);
      }
    });
    if (next.size !== state.wrongBookDraft.size) {
      state.wrongBookDraft = next;
      saveSet(STORAGE_KEYS.wrongBookDraft, state.wrongBookDraft);
    }
  }

  function translationKey(text) {
    return String(text || "").trim().replace(/\s+/g, " ").toLowerCase();
  }

  function createStatCard(value, label) {
    const card = document.createElement("div");
    card.className = "stat-card";
    card.innerHTML = "<strong>" + escapeHtml(value) + "</strong><span>" + escapeHtml(label) + "</span>";
    return card;
  }

  function renderHeroStats() {
    heroStats.replaceChildren(
      createStatCard(bank.summary.totalQuestions, "Questions"),
      createStatCard(getResolvedAnswerCount(), questionSourceLoaded ? "Answer Keys" : "Walkthrough Keys"),
      createStatCard(state.favorites.size, "Favorites"),
      createStatCard(state.wrongBook.size, "Wrong Book")
    );
  }

  function renderTutorialPanel() {
    if (state.tutorialHidden) {
      tutorialPanel.innerHTML = "";
      return;
    }

    tutorialPanel.innerHTML = [
      '<div class="tutorial-card">',
      "<div>",
      "<p class=\"eyebrow\">Beginner Guide</p>",
      "<h2>How to use this local SC site</h2>",
      "</div>",
      '<div class="tutorial-steps">',
      '<div class="tutorial-step"><strong>1. Start with all 384 questions</strong><span>The site is using the full extracted bank. Use section filter, search, or jump by <code>Q218</code> / <code>V1-01</code>.</span></div>',
      '<div class="tutorial-step"><strong>2. Practice or walkthrough</strong><span><code>Practice</code> lets students answer first. <code>Walkthrough</code> reveals the matched answer and explanation immediately and now auto-shows option Chinese.</span></div>',
      '<div class="tutorial-step"><strong>3. Check option meanings</strong><span>Use each option card\'s <code>Gloss</code> button to see quick definitions and save useful words without leaving the question.</span></div>',
      '<div class="tutorial-step"><strong>4. Build the wrong book your way</strong><span>Favorite questions first, then use the new picker to manually choose them for the wrong book or select all in one click.</span></div>',
      "</div>",
      '<div class="detail-actions"><button id="dismissTutorialButton" class="button button-ghost" type="button">Hide Tutorial</button></div>',
      "</div>",
    ].join("");

    document.getElementById("dismissTutorialButton").addEventListener("click", function () {
      state.tutorialHidden = true;
      window.localStorage.setItem(STORAGE_KEYS.tutorialHidden, "1");
      renderTutorialPanel();
    });
  }

  function renderSectionSelect() {
    if (sectionSelect.childElementCount) {
      return;
    }
    const fragment = document.createDocumentFragment();
    const option = document.createElement("option");
    option.value = "all";
    option.textContent = "All sections";
    fragment.appendChild(option);
    bank.sections.forEach(function (section) {
      const item = document.createElement("option");
      item.value = section.code;
      item.textContent = section.code + " · " + section.displayName;
      fragment.appendChild(item);
    });
    sectionSelect.appendChild(fragment);
  }

  function renderSwitch(container, value, options, handler) {
    container.innerHTML = "";
    options.forEach(function (option) {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "chip" + (value === option.value ? " is-active" : "");
      button.textContent = option.label;
      button.addEventListener("click", function () {
        handler(option.value);
      });
      container.appendChild(button);
    });
  }

  function renderWrongBookList() {
    wrongBookList.innerHTML = "";
    if (!state.wrongBook.size) {
      wrongBookList.innerHTML = '<span class="muted">No picks yet.</span>';
      return;
    }
    Array.from(state.wrongBook).sort().slice(0, 18).forEach(function (questionId) {
      const chip = document.createElement("button");
      chip.type = "button";
      chip.className = "chip";
      chip.textContent = questionId;
      chip.addEventListener("click", function () {
        state.currentQuestionId = questionId;
        state.selectedOptionIndex = null;
        renderAll();
      });
      wrongBookList.appendChild(chip);
    });
  }

  function renderWrongBookPicker() {
    syncWrongBookDraft();

    const favorites = getFavoriteQuestions();
    if (!favorites.length) {
      wrongBookPicker.className = "detail-card is-empty";
      wrongBookPicker.innerHTML = "Favorite questions first. Then you can manually choose which saved questions enter the wrong book.";
      return;
    }

    const selectedCount = favorites.filter(function (question) {
      return state.wrongBookDraft.has(question.globalId);
    }).length;

    wrongBookPicker.className = "detail-card";
    wrongBookPicker.innerHTML = [
      '<div class="wrongbook-picker">',
      '<p class="wrongbook-picker__summary">Choose from favorited questions, then push the selected set into the wrong book. You can also select all favorites in one click.</p>',
      '<div class="wrongbook-picker__actions">',
      '<button type="button" class="button button-ghost" data-action="select-all-favorites">Select All Favorites</button>',
      '<button type="button" class="button button-ghost" data-action="clear-favorite-picks">Clear Picks</button>',
      '<button type="button" class="button button-solid" data-action="add-selected-favorites"' + (selectedCount ? "" : " disabled") + '>Add Selected (' + selectedCount + ")</button>",
      '<button type="button" class="button button-solid" data-action="add-all-favorites">Add All Favorites</button>',
      "</div>",
      '<div class="wrongbook-picker__list">',
      favorites.map(function (question) {
        const checked = state.wrongBookDraft.has(question.globalId) ? " checked" : "";
        const inWrongBook = state.wrongBook.has(question.globalId)
          ? '<span class="badge badge-success">In Wrong Book</span>'
          : '<span class="badge">Not Added</span>';
        return [
          '<div class="wrongbook-picker__row">',
          '<input type="checkbox" data-action="toggle-favorite-pick" data-question-id="' + question.globalId + '"' + checked + " />",
          '<span class="wrongbook-picker__copy"><strong>' + question.globalId + " · " + escapeHtml(question.localId) + '</strong><span class="wrongbook-picker__meta">' + escapeHtml(question.sectionDisplayName) + "</span></span>",
          '<span class="detail-actions">' + inWrongBook + '<button type="button" class="button button-ghost" data-action="open-favorite-question" data-question-id="' + question.globalId + '">Open</button></span>',
          "</div>",
        ].join("");
      }).join(""),
      "</div>",
      "</div>",
    ].join("");
  }

  function renderSavedWordsList() {
    savedWordsList.innerHTML = "";
    const words = Object.keys(state.savedWords).sort();
    savedWordsList.className = words.length ? "saved-word-list" : "chip-grid";
    if (!words.length) {
      savedWordsList.innerHTML = '<span class="muted">No saved words yet.</span>';
      return;
    }
    words.slice(0, 24).forEach(function (word) {
      const urls = makeDictionaryUrls(word);
      const row = document.createElement("div");
      row.className = "saved-word-row";
      row.innerHTML = [
        '<div class="saved-word-row__head">',
        '<div class="saved-word-row__word">' + escapeHtml(word) + "</div>",
        '<button type="button" class="button button-ghost open-saved-word" data-word="' + escapeHtml(word) + '">Open</button>',
        "</div>",
        '<div class="saved-word-links">',
        '<a class="button button-ghost" target="_blank" rel="noreferrer" href="' + urls.cambridge + '">Cambridge</a>',
        '<a class="button button-ghost" target="_blank" rel="noreferrer" href="' + urls.merriam + '">Merriam</a>',
        "</div>",
      ].join("");
      row.querySelector(".open-saved-word").addEventListener("click", function () {
        state.selectedWord = word;
        state.flashcardWord = word;
        state.flashcardFace = "front";
        ensureDictionaryEntry(word);
        renderWordExplorer();
        renderFlashcardDeck();
      });
      savedWordsList.appendChild(row);
    });
  }

  function makeDictionaryUrls(word) {
    return {
      cambridge: "https://dictionary.cambridge.org/us/search/english/direct/?q=" + encodeURIComponent(word),
      merriam: "https://www.merriam-webster.com/dictionary/" + encodeURIComponent(word),
    };
  }

  function fetchDictionaryEntry(word) {
    const normalized = normalize(word);
    if (!normalized) {
      return Promise.resolve(null);
    }
    if (state.dictionaryCache[normalized]) {
      return Promise.resolve(state.dictionaryCache[normalized]);
    }
    if (state.pendingDictionary[normalized]) {
      return state.pendingDictionary[normalized];
    }

    state.pendingDictionary[normalized] = fetch("/api/dictionary?word=" + encodeURIComponent(normalized))
      .then(function (response) {
        if (!response.ok) {
          throw new Error("Lookup failed");
        }
        return response.json();
      })
      .catch(function () {
        return {
          word: normalized,
          error: "Lookup unavailable",
          definitions: [],
          meanings: [],
          phonetic: "",
        };
      })
      .then(function (payload) {
        state.dictionaryCache[normalized] = payload;
        saveObject(STORAGE_KEYS.dictionary, state.dictionaryCache);
        delete state.pendingDictionary[normalized];
        renderWordExplorer();
        renderQuestionCard();
        renderSavedWordsList();
        return payload;
      });

    return state.pendingDictionary[normalized];
  }

  function ensureDictionaryEntry(word) {
    const normalized = normalize(word);
    if (!normalized || state.dictionaryCache[normalized] || state.pendingDictionary[normalized]) {
      return;
    }
    fetchDictionaryEntry(normalized);
  }

  function fetchTranslation(text) {
    const key = translationKey(text);
    if (!key) {
      return Promise.resolve(null);
    }
    if (state.translationCache[key]) {
      return Promise.resolve(state.translationCache[key]);
    }
    if (state.pendingTranslation[key]) {
      return state.pendingTranslation[key];
    }

    state.pendingTranslation[key] = fetch("/api/translate?text=" + encodeURIComponent(text))
      .then(function (response) {
        if (!response.ok) {
          throw new Error("Translation failed");
        }
        return response.json();
      })
      .catch(function () {
        return {
          text: text,
          error: "Translation unavailable",
          translation: "",
        };
      })
      .then(function (payload) {
        state.translationCache[key] = payload;
        saveObject(STORAGE_KEYS.translations, state.translationCache);
        delete state.pendingTranslation[key];
        renderQuestionCard();
        return payload;
      });

    return state.pendingTranslation[key];
  }

  function ensureTranslation(text) {
    const key = translationKey(text);
    if (!key || state.translationCache[key] || state.pendingTranslation[key]) {
      return;
    }
    fetchTranslation(text);
  }

  function extractKeywords(text) {
    const tokens = text
      .replace(/\.+/g, " ")
      .replace(/[^A-Za-z'-]+/g, " ")
      .split(/\s+/)
      .map(function (token) {
        return token.toLowerCase().replace(/^'+|'+$/g, "");
      })
      .filter(function (token) {
        return token.length >= 4 && !STOP_WORDS.has(token);
      });
    return Array.from(new Set(tokens)).slice(0, 3);
  }

  function buildFallbackDerivatives(word) {
    const forms = [];
    if (word.length >= 4) {
      forms.push(word + "s");
      forms.push(word + "ly");
      forms.push(word + "ness");
      if (word.endsWith("e")) {
        forms.push(word.slice(0, -1) + "ing");
      } else {
        forms.push(word + "ing");
      }
      forms.push(word + "ed");
    }
    return Array.from(new Set(forms.filter(function (item) {
      return item !== word;
    }))).slice(0, 6);
  }

  function buildMnemonicHooks(word, question) {
    const hooks = [
      {
        title: "Context anchor",
        text: "Anchor it to " + question.globalId + ": rehearse it inside \"" + question.stem.slice(0, 80) + "...\".",
      },
    ];

    const lower = word.toLowerCase();
    const prefix = PREFIX_NOTES.find(function (item) {
      return lower.startsWith(item[0]) && lower.length - item[0].length >= 3;
    });
    const suffix = SUFFIX_NOTES.find(function (item) {
      return lower.endsWith(item[0]) && lower.length - item[0].length >= 2;
    });

    if (prefix) {
      hooks.push({ title: "Root / prefix hook", text: prefix[1] });
    } else if (suffix) {
      hooks.push({ title: "Suffix hook", text: suffix[1] });
    } else {
      const chunked = lower.match(/.{1,3}/g) || [lower];
      hooks.push({
        title: "Sound hook",
        text: "Chunk it as " + chunked.join("-") + " and read it aloud with the source sentence.",
      });
    }
    return hooks.slice(0, 2);
  }

  function getWordRecord(word) {
    const question = getCurrentQuestion() || bank.questions[0];
    const saved = state.savedWords[word] || null;
    const dictionary = state.dictionaryCache[word] || null;
    return {
      word: word,
      saved: saved,
      questionIds: saved && saved.questionIds ? saved.questionIds : [question.globalId],
      urls: makeDictionaryUrls(word),
      hooks: buildMnemonicHooks(word, question),
      derivatives: buildFallbackDerivatives(word),
      dictionary: dictionary,
    };
  }

  function saveWord(word) {
    const currentQuestion = getCurrentQuestion();
    if (!currentQuestion) {
      return;
    }
    const record = state.savedWords[word] || {
      word: word,
      questionIds: [],
      createdAt: new Date().toISOString(),
    };
    if (!record.questionIds.includes(currentQuestion.globalId)) {
      record.questionIds.push(currentQuestion.globalId);
    }
    state.savedWords[word] = record;
    state.flashcardWord = word;
    state.flashcardFace = "front";
    saveObject(STORAGE_KEYS.words, state.savedWords);
    renderHeroStats();
    renderSavedWordsList();
    renderWordExplorer();
    renderFlashcardDeck();
  }

  function removeWord(word) {
    delete state.savedWords[word];
    if (state.flashcardWord === word) {
      state.flashcardWord = Object.keys(state.savedWords)[0] || null;
      state.flashcardFace = "front";
    }
    if (state.selectedWord === word && !state.savedWords[word]) {
      state.selectedWord = null;
    }
    saveObject(STORAGE_KEYS.words, state.savedWords);
    renderHeroStats();
    renderSavedWordsList();
    renderWordExplorer();
    renderFlashcardDeck();
  }

  function renderWordExplorer() {
    if (!state.selectedWord) {
      wordExplorer.className = "detail-card is-empty";
      wordExplorer.innerHTML = "Click any word in the question or options. This panel will show dictionary links, mnemonic hooks, and derived forms.";
      return;
    }

    const record = getWordRecord(state.selectedWord);
    if (!record.dictionary) {
      ensureDictionaryEntry(record.word);
    }
    wordExplorer.className = "detail-card";
    wordExplorer.innerHTML = [
      '<div class="detail-grid">',
      '<div class="badge-row"><span class="badge">' + escapeHtml(record.word) + '</span><span class="badge">' + (record.saved ? "Saved" : "Unsaved") + "</span></div>",
      "<h3>" + escapeHtml(record.word) + "</h3>",
      "<div><strong>Quick English Gloss</strong>" +
        (record.dictionary
          ? (record.dictionary.error
            ? '<p class="muted">Lookup unavailable right now. Use the external dictionary buttons below.</p>'
            : (
              (record.dictionary.phonetic ? '<p><code>' + escapeHtml(record.dictionary.phonetic) + "</code></p>" : "") +
              '<ul>' + (record.dictionary.definitions || []).slice(0, 2).map(function (definition) {
                return "<li>" + escapeHtml(definition) + "</li>";
              }).join("") + "</ul>"
            ))
          : '<p class="muted">Fetching dictionary entry...</p>') +
      "</div>",
      '<div><strong>Dictionary</strong><div class="detail-actions">' +
        '<a class="button button-ghost" href="' + record.urls.cambridge + '" target="_blank" rel="noreferrer">Cambridge</a>' +
        '<a class="button button-ghost" href="' + record.urls.merriam + '" target="_blank" rel="noreferrer">Merriam-Webster</a>' +
        '<button id="saveWordButton" class="button button-solid" type="button">' + (record.saved ? "Save Again" : "Save to Flashcards") + "</button>" +
      "</div></div>",
      "<div><strong>Mnemonic Hooks</strong><ul>" + record.hooks.map(function (hook) {
        return "<li><strong>" + escapeHtml(hook.title) + ":</strong> " + escapeHtml(hook.text) + "</li>";
      }).join("") + "</ul></div>",
      "<div><strong>Derived / Related Forms</strong><div class=\"chip-grid\">" +
        (record.derivatives.length ? record.derivatives.map(function (item) {
          return '<span class="chip chip-static">' + escapeHtml(item) + "</span>";
        }).join("") : '<span class="muted">No derivative pattern generated.</span>') +
      "</div></div>",
      "<div><strong>Source Questions</strong><div class=\"chip-grid\">" + record.questionIds.map(function (questionId) {
        return '<button type="button" class="chip jump-word-question" data-question-id="' + questionId + '">' + questionId + "</button>";
      }).join("") + "</div></div>",
      '<div class="detail-note">Authority example slots are reserved, but this lightweight local build skips licensed dictionary content so the page opens fast and locally.</div>',
      (record.saved ? '<div class="detail-actions"><button id="removeWordButton" class="button button-ghost" type="button">Remove Word</button></div>' : ""),
      "</div>",
    ].join("");

    document.getElementById("saveWordButton").addEventListener("click", function () {
      saveWord(record.word);
    });

    const removeButton = document.getElementById("removeWordButton");
    if (removeButton) {
      removeButton.addEventListener("click", function () {
        removeWord(record.word);
      });
    }

    wordExplorer.querySelectorAll(".jump-word-question").forEach(function (button) {
      button.addEventListener("click", function () {
        state.currentQuestionId = button.dataset.questionId;
        state.selectedOptionIndex = null;
        renderAll();
      });
    });
  }

  function renderFlashcardDeck() {
    const words = Object.keys(state.savedWords).sort();
    if (!words.length) {
      flashcardDeck.className = "detail-card is-empty";
      flashcardDeck.innerHTML = "Save a word first. Then this panel turns into a local flashcard deck.";
      return;
    }

    if (!state.flashcardWord || !state.savedWords[state.flashcardWord]) {
      state.flashcardWord = words[0];
      state.flashcardFace = "front";
    }

    const record = getWordRecord(state.flashcardWord);
    const currentIndex = words.indexOf(state.flashcardWord);
    const currentNumber = currentIndex >= 0 ? currentIndex + 1 : 1;

    flashcardDeck.className = "detail-card";
    flashcardDeck.innerHTML = [
      '<div class="flashcard">',
      '<div class="badge-row"><span class="badge">Card ' + currentNumber + "/" + words.length + "</span><span class=\"badge\">" + escapeHtml(record.word) + "</span></div>",
      '<div class="flashcard-face">',
      state.flashcardFace === "front"
        ? "<h3>" + escapeHtml(record.word) + "</h3><p>Use flip to reveal mnemonic hooks and source questions.</p>"
        : "<h3>Back</h3><p><strong>Hook 1:</strong> " + escapeHtml(record.hooks[0].text) + "</p><p><strong>Hook 2:</strong> " + escapeHtml(record.hooks[1].text) + "</p><p><strong>Questions:</strong> " + escapeHtml(record.questionIds.join(", ")) + "</p>",
      "</div>",
      '<div class="flashcard-actions">',
      '<button id="flipCardButton" class="button button-solid" type="button">Flip</button>',
      '<button id="nextCardButton" class="button button-ghost" type="button">Next Card</button>',
      '<button id="jumpFromCardButton" class="button button-ghost" type="button">Open Source Question</button>',
      "</div>",
      "</div>",
    ].join("");

    document.getElementById("flipCardButton").addEventListener("click", function () {
      state.flashcardFace = state.flashcardFace === "front" ? "back" : "front";
      renderFlashcardDeck();
    });

    document.getElementById("nextCardButton").addEventListener("click", function () {
      const nextIndex = (currentIndex + 1) % words.length;
      state.flashcardWord = words[nextIndex];
      state.flashcardFace = "front";
      renderFlashcardDeck();
    });

    document.getElementById("jumpFromCardButton").addEventListener("click", function () {
      state.currentQuestionId = record.questionIds[0];
      state.selectedOptionIndex = null;
      renderAll();
    });
  }

  function renderTokenizedText(text, questionId) {
    return escapeHtml(text).replace(/\b([A-Za-z][A-Za-z'-]{2,})\b/g, function (match, token) {
      const normalized = token.toLowerCase();
      const classes = ["word-token"];
      if (state.selectedWord === normalized) {
        classes.push("active");
      }
      return '<button type="button" class="' + classes.join(" ") + '" data-action="pick-word" data-question-id="' + questionId + '" data-word="' + normalized + '">' + escapeHtml(match) + "</button>";
    });
  }

  function renderSentence(question, answerIndex, showAnswer) {
    return question.stem.split(/(_+|[\w'-]+)/g).map(function (part) {
      if (!part) {
        return "";
      }
      if (/^_+$/.test(part)) {
        let fill = "";
        if (showAnswer && answerIndex >= 0) {
          fill = question.options[answerIndex].text;
        } else if (state.selectedOptionIndex !== null && question.options[state.selectedOptionIndex]) {
          fill = question.options[state.selectedOptionIndex].text;
        }
        return '<span class="blank-fill">' + escapeHtml(fill) + "</span>";
      }
      if (/^[A-Za-z][A-Za-z'-]*$/.test(part) && part.length >= 3) {
        return renderTokenizedText(part, question.globalId);
      }
      return escapeHtml(part);
    }).join("");
  }

  function renderOptionTranslation(text) {
    if (state.mode !== "walkthrough") {
      return "";
    }

    ensureTranslation(text);
    const entry = state.translationCache[translationKey(text)];

    if (!entry) {
      return '<span class="option-translation option-translation--muted">中文加载中...</span>';
    }
    if (entry.error) {
      return '<span class="option-translation option-translation--muted">中文暂不可用</span>';
    }
    return '<span class="option-translation">中: ' + escapeHtml(entry.translation || "") + "</span>";
  }

  function optionGlossaryMarkup(question) {
    if (state.glossaryOptionIndex === null || !question.options[state.glossaryOptionIndex]) {
      return "";
    }

    const option = question.options[state.glossaryOptionIndex];
    const keywords = extractKeywords(option.text);
    keywords.forEach(ensureDictionaryEntry);

    return [
      '<div class="option-gloss-panel">',
      '<div class="badge-row"><span class="badge">Option ' + option.label + '</span><span class="badge">' + escapeHtml(option.text) + "</span></div>",
      "<h3>Option Gloss</h3>",
      keywords.length
        ? '<div class="option-gloss-grid">' + keywords.map(function (word) {
            const entry = state.dictionaryCache[word];
            const urls = makeDictionaryUrls(word);
            return [
              '<div class="gloss-row">',
              "<strong>" + escapeHtml(word) + "</strong>",
              entry
                ? (entry.error
                  ? '<p class="muted">Lookup unavailable. Use external dictionaries.</p>'
                  : '<p>' + escapeHtml((entry.definitions || [])[0] || "Definition pending.") + "</p>")
                : '<p class="muted">Loading definition...</p>',
              '<div class="detail-actions">',
              '<button type="button" class="button button-solid" data-action="save-option-word" data-word="' + escapeHtml(word) + '">Save Word</button>',
              '<a class="button button-ghost" target="_blank" rel="noreferrer" href="' + urls.cambridge + '">Cambridge</a>',
              '<a class="button button-ghost" target="_blank" rel="noreferrer" href="' + urls.merriam + '">Merriam</a>',
              "</div>",
              "</div>",
            ].join("");
          }).join("") + "</div>"
        : '<p class="muted">No clean keyword was extracted from this option. Open the stem word explorer instead.</p>',
      "</div>",
    ].join("");
  }

  function answerPanelMarkup(question, answerData, showAnswer) {
    if (!showAnswer) {
      return "";
    }

    if (!answerData || !answerData.hasKey || !question.options[answerData.answerIndex]) {
      return [
        '<div class="answer-panel">',
        '<div class="badge-row"><span class="badge badge-warning">No key yet</span></div>',
        "<h3>Walkthrough pending</h3>",
        "<p>This question is loaded, numbered, and usable, but its answer key is still unavailable locally.</p>",
        "</div>",
      ].join("");
    }

    const isWalkthrough = state.mode === "walkthrough";
    const isCorrect = state.selectedOptionIndex === answerData.answerIndex;
    const statusClass = isWalkthrough || isCorrect ? "badge-success" : "badge-danger";
    const statusText = isWalkthrough ? "Walkthrough" : (isCorrect ? "Correct" : "Check");

    return [
      '<div class="answer-panel">',
      '<div class="badge-row"><span class="badge ' + statusClass + '">' + statusText + '</span><span class="badge">Answer ' + escapeHtml(answerData.answerLetter || "?") + "</span></div>",
      "<h3>" + escapeHtml(answerData.answerText || question.options[answerData.answerIndex].text) + "</h3>",
      "<p>" + escapeHtml(answerData.explanation || "Explanation pending.") + "</p>",
      answerData.sourceUrl ? '<p><a class="button button-ghost" href="' + answerData.sourceUrl + '" target="_blank" rel="noreferrer">Source Walkthrough</a></p>' : "",
      "</div>",
    ].join("");
  }

  function renderQuestionCard() {
    const list = getCurrentQuestionList();
    const question = getCurrentQuestion();

    if (!question) {
      questionHeading.textContent = "No questions matched";
      questionMeta.innerHTML = "";
      questionCard.innerHTML = '<div class="answer-panel"><h3>Nothing matched the current filter.</h3><p>Clear search, change section, or switch the question set.</p></div>';
      return;
    }

    const position = list.findIndex(function (item) {
      return item.globalId === question.globalId;
    });
    const answerData = getAnswerData(question);
    const answerIndex = answerData.answerIndex;
    const showAnswer = state.mode === "walkthrough" || state.selectedOptionIndex !== null;
    const isFavorite = state.favorites.has(question.globalId);
    const isWrong = state.wrongBook.has(question.globalId);

    questionHeading.textContent = question.globalId + " · " + question.localId;
    questionMeta.innerHTML = [
      '<span class="badge">' + (position + 1) + "/" + list.length + "</span>",
      '<span class="badge">' + escapeHtml(question.sectionDisplayName) + "</span>",
      '<span class="badge">' + question.optionCount + " options</span>",
      answerData.hasKey ? '<span class="badge badge-success">Answer key</span>' : '<span class="badge badge-warning">Walkthrough pending</span>',
      question.duplicateCount ? '<span class="badge badge-warning">' + question.duplicateCount + " duplicate" + (question.duplicateCount > 1 ? "s" : "") + "</span>" : "",
    ].join("");

    const optionMarkup = question.options.map(function (option, index) {
      const classes = ["option-button"];
      if (showAnswer && answerIndex >= 0) {
        if (index === answerIndex) {
          classes.push("correct");
        } else if (state.selectedOptionIndex === index) {
          classes.push("incorrect");
        } else {
          classes.push("dimmed");
        }
      }
      return [
        '<div class="option-card">',
        '<button type="button" class="' + classes.join(" ") + '" data-action="pick-option" data-option-index="' + index + '">',
        '<span class="option-tag">' + option.label + "</span>",
        '<span class="option-copy"><span class="option-copy__text">' + escapeHtml(option.text) + "</span>" + renderOptionTranslation(option.text) + "</span>",
        "</button>",
        '<div class="option-card__footer">',
        '<button type="button" class="button button-ghost" data-action="show-option-gloss" data-option-index="' + index + '">Gloss</button>',
        "</div>",
        "</div>",
      ].join("");
    }).join("");

    questionCard.innerHTML = [
      '<div class="badge-row">',
      '<span class="badge">' + question.globalId + "</span>",
      '<span class="badge">' + question.localId + "</span>",
      "</div>",
      '<div class="question-text">' + renderSentence(question, answerIndex, showAnswer && answerIndex >= 0) + "</div>",
      '<div class="action-row">',
      '<button type="button" class="button ' + (isFavorite ? "button-solid" : "button-ghost") + '" data-action="toggle-favorite">' + (isFavorite ? "Favorited" : "Favorite") + "</button>",
      '<button type="button" class="button ' + (isWrong ? "button-solid" : "button-ghost") + '" data-action="toggle-wrongbook">' + (isWrong ? "In Wrong Book" : "Add to Wrong Book") + "</button>",
      '<button type="button" class="button button-ghost" data-action="focus-first-word">Study First Word</button>',
      "</div>",
      '<div class="option-list">' + optionMarkup + "</div>",
      optionGlossaryMarkup(question),
      answerPanelMarkup(question, answerData, showAnswer),
    ].join("");
  }

  function moveQuestion(offset) {
    const position = currentQuestionPosition();
    if (!position.list.length) {
      return;
    }
    let next = position.index + offset;
    if (next < 0) {
      next = 0;
    }
    if (next >= position.list.length) {
      next = position.list.length - 1;
    }
    state.currentQuestionId = position.list[next].globalId;
    state.selectedOptionIndex = null;
    state.glossaryOptionIndex = null;
    renderAll();
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
    state.currentQuestionId = target.globalId;
    state.section = target.sectionCode;
    state.collection = "all";
    state.search = "";
    state.duplicatesOnly = false;
    state.selectedOptionIndex = null;
    state.glossaryOptionIndex = null;
    searchInput.value = "";
    sectionSelect.value = target.sectionCode;
    duplicatesOnly.checked = false;
    renderAll();
  }

  function pickFirstWord(question) {
    const match = question.stem.match(/[A-Za-z][A-Za-z'-]{2,}/);
    if (!match) {
      return;
    }
    state.selectedWord = match[0].toLowerCase();
    ensureDictionaryEntry(state.selectedWord);
    renderWordExplorer();
  }

  function handleQuestionCardClick(event) {
    const target = event.target.closest("[data-action]");
    if (!target) {
      return;
    }

    const question = getCurrentQuestion();
    if (!question) {
      return;
    }

    const action = target.dataset.action;
    if (action === "pick-word") {
      state.selectedWord = target.dataset.word;
      ensureDictionaryEntry(state.selectedWord);
      renderWordExplorer();
      return;
    }
    if (action === "pick-option") {
      if (state.mode === "walkthrough") {
        return;
      }
      state.selectedOptionIndex = Number(target.dataset.optionIndex);
      renderQuestionCard();
      return;
    }
    if (action === "show-option-gloss") {
      state.glossaryOptionIndex = Number(target.dataset.optionIndex);
      renderQuestionCard();
      return;
    }
    if (action === "save-option-word") {
      saveWord(target.dataset.word);
      return;
    }
    if (action === "toggle-favorite") {
      if (state.favorites.has(question.globalId)) {
        state.favorites.delete(question.globalId);
      } else {
        state.favorites.add(question.globalId);
      }
      saveSet(STORAGE_KEYS.favorites, state.favorites);
      renderAll();
      return;
    }
    if (action === "toggle-wrongbook") {
      if (state.wrongBook.has(question.globalId)) {
        state.wrongBook.delete(question.globalId);
      } else {
        state.wrongBook.add(question.globalId);
      }
      saveSet(STORAGE_KEYS.wrongBook, state.wrongBook);
      renderAll();
      return;
    }
    if (action === "focus-first-word") {
      pickFirstWord(question);
    }
  }

  function handleWrongBookPickerClick(event) {
    const target = event.target.closest("[data-action]");
    if (!target) {
      return;
    }

    const favorites = getFavoriteQuestions();
    const favoriteIds = favorites.map(function (question) {
      return question.globalId;
    });

    if (target.dataset.action === "select-all-favorites") {
      state.wrongBookDraft = new Set(favoriteIds);
      saveSet(STORAGE_KEYS.wrongBookDraft, state.wrongBookDraft);
      renderWrongBookPicker();
      return;
    }

    if (target.dataset.action === "clear-favorite-picks") {
      state.wrongBookDraft = new Set();
      saveSet(STORAGE_KEYS.wrongBookDraft, state.wrongBookDraft);
      renderWrongBookPicker();
      return;
    }

    if (target.dataset.action === "add-selected-favorites") {
      state.wrongBookDraft.forEach(function (questionId) {
        state.wrongBook.add(questionId);
      });
      saveSet(STORAGE_KEYS.wrongBook, state.wrongBook);
      renderAll();
      return;
    }

    if (target.dataset.action === "add-all-favorites") {
      favoriteIds.forEach(function (questionId) {
        state.wrongBook.add(questionId);
      });
      state.wrongBookDraft = new Set(favoriteIds);
      saveSet(STORAGE_KEYS.wrongBookDraft, state.wrongBookDraft);
      saveSet(STORAGE_KEYS.wrongBook, state.wrongBook);
      renderAll();
      return;
    }

    if (target.dataset.action === "open-favorite-question") {
      state.currentQuestionId = target.dataset.questionId;
      state.selectedOptionIndex = null;
      state.glossaryOptionIndex = null;
      renderAll();
    }
  }

  function handleWrongBookPickerChange(event) {
    const target = event.target;
    if (!target.matches('[data-action="toggle-favorite-pick"]')) {
      return;
    }

    const questionId = target.dataset.questionId;
    if (target.checked) {
      state.wrongBookDraft.add(questionId);
    } else {
      state.wrongBookDraft.delete(questionId);
    }
    saveSet(STORAGE_KEYS.wrongBookDraft, state.wrongBookDraft);
    renderWrongBookPicker();
  }

  function renderAll() {
    renderHeroStats();
    renderTutorialPanel();
    renderSwitch(modeSwitch, state.mode, [
      { value: "practice", label: "Practice" },
      { value: "walkthrough", label: "Walkthrough" },
    ], function (value) {
      state.mode = value;
      state.selectedOptionIndex = null;
      state.glossaryOptionIndex = null;
      renderAll();
    });

    renderSwitch(collectionSwitch, state.collection, [
      { value: "all", label: "All" },
      { value: "favorites", label: "Favorites" },
      { value: "wrongbook", label: "Wrong Book" },
    ], function (value) {
      state.collection = value;
      state.selectedOptionIndex = null;
      state.glossaryOptionIndex = null;
      renderAll();
    });

    sectionSelect.value = state.section;
    searchInput.value = state.search;
    duplicatesOnly.checked = state.duplicatesOnly;
    renderWrongBookList();
    renderWrongBookPicker();
    renderSavedWordsList();
    renderQuestionCard();
    renderWordExplorer();
    renderFlashcardDeck();
  }

  renderSectionSelect();
  renderAll();
  loadQuestionSourceData();

  sectionSelect.addEventListener("change", function (event) {
    state.section = event.target.value;
    state.selectedOptionIndex = null;
    state.glossaryOptionIndex = null;
    renderAll();
  });

  searchInput.addEventListener("input", function (event) {
    state.search = event.target.value;
    state.selectedOptionIndex = null;
    state.glossaryOptionIndex = null;
    renderAll();
  });

  duplicatesOnly.addEventListener("change", function (event) {
    state.duplicatesOnly = event.target.checked;
    state.selectedOptionIndex = null;
    state.glossaryOptionIndex = null;
    renderAll();
  });

  prevButton.addEventListener("click", function () {
    moveQuestion(-1);
  });

  nextButton.addEventListener("click", function () {
    moveQuestion(1);
  });

  jumpButton.addEventListener("click", jumpToQuestion);
  jumpInput.addEventListener("keydown", function (event) {
    if (event.key === "Enter") {
      jumpToQuestion();
    }
  });

  questionCard.addEventListener("click", handleQuestionCardClick);
  wrongBookPicker.addEventListener("click", handleWrongBookPickerClick);
  wrongBookPicker.addEventListener("change", handleWrongBookPickerChange);
})();
