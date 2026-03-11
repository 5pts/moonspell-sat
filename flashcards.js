(function () {
  const bank = window.QUESTION_BANK;
  const lexiconSeed = window.LEXICON_SEED || { entries: {} };
  if (!bank) {
    return;
  }

  const STORAGE_KEY = "moonspell-wordbook";
  const savedWords = loadWords();
  const state = {
    search: "",
    index: 0,
    flipped: false,
  };

  const flashcardStats = document.getElementById("flashcardStats");
  const flashcardSearch = document.getElementById("flashcardSearch");
  const prevCard = document.getElementById("prevCard");
  const flipCard = document.getElementById("flipCard");
  const nextCard = document.getElementById("nextCard");
  const flashcardHeading = document.getElementById("flashcardHeading");
  const flashcardMeta = document.getElementById("flashcardMeta");
  const flashcardStage = document.getElementById("flashcardStage");

  function loadWords() {
    try {
      return JSON.parse(window.localStorage.getItem(STORAGE_KEY) || "{}");
    } catch (_error) {
      return {};
    }
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

  function visibleWords() {
    const needle = state.search.trim().toLowerCase();
    return Object.values(savedWords)
      .filter(function (entry) {
        return !needle || entry.word.includes(needle);
      })
      .sort(function (a, b) {
        return a.word.localeCompare(b.word);
      });
  }

  function getEntry(word) {
    return lexiconSeed.entries[word] || null;
  }

  function renderStats() {
    const words = visibleWords();
    const exampleCount = words.filter(function (entry) {
      const lex = getEntry(entry.word);
      return lex && lex.authorityExamples && lex.authorityExamples.length;
    }).length;

    flashcardStats.replaceChildren(
      createStatCard(Object.keys(savedWords).length, "Saved Words"),
      createStatCard(words.length, "Visible Cards"),
      createStatCard(exampleCount, "Cards With Examples")
    );
  }

  function renderCard() {
    const words = visibleWords();
    if (!words.length) {
      flashcardHeading.textContent = "No saved words yet";
      flashcardMeta.innerHTML = "";
      flashcardStage.innerHTML = '<div class="empty-state">Save words from the SC lab first. Then they appear here automatically.</div>';
      return;
    }

    if (state.index >= words.length) {
      state.index = 0;
    }
    if (state.index < 0) {
      state.index = words.length - 1;
    }

    const record = words[state.index];
    const entry = getEntry(record.word) || {
      word: record.word,
      cambridgeUrl: `https://dictionary.cambridge.org/us/search/english/direct/?q=${record.word}`,
      merriamUrl: `https://www.merriam-webster.com/dictionary/${record.word}`,
      memoryHooks: [],
      authorityExamples: [],
      derivatives: [],
    };

    flashcardHeading.textContent = `${record.word} · card ${state.index + 1} / ${words.length}`;
    flashcardMeta.innerHTML = `<span class="badge">${record.questionIds.length} source questions</span>`;

    if (!state.flipped) {
      flashcardStage.innerHTML = `
        <article class="flashcard">
          <p class="eyebrow">Front</p>
          <h3>${escapeHtml(record.word)}</h3>
          <p class="lede">Try to recall the meaning, the source question, and one memory hook before flipping.</p>
          <div class="chip-grid">
            ${record.questionIds.map(function (questionId) {
              return `<a class="chip" href="design.html#${questionId}">${questionId}</a>`;
            }).join("")}
          </div>
        </article>
      `;
      return;
    }

    flashcardStage.innerHTML = `
      <article class="flashcard flashcard--back">
        <p class="eyebrow">Back</p>
        <h3>${escapeHtml(record.word)}</h3>

        <div class="detail-row">
          <strong>Mnemonic Hooks</strong>
          ${
            entry.memoryHooks && entry.memoryHooks.length
              ? `<ul class="mini-list">${entry.memoryHooks.map(function (hook) {
                  return `<li><strong>${escapeHtml(hook.title)}</strong><span>${escapeHtml(hook.text)}</span></li>`;
                }).join("")}</ul>`
              : '<div class="muted">No mnemonic hooks seeded yet.</div>'
          }
        </div>

        <div class="detail-row">
          <strong>Authority Examples</strong>
          ${
            entry.authorityExamples && entry.authorityExamples.length
              ? `<ul class="mini-list">${entry.authorityExamples.map(function (item) {
                  return `<li><strong>${escapeHtml(item.source)}</strong><span>${escapeHtml(item.text)}</span></li>`;
                }).join("")}</ul>`
              : '<div class="muted">Authority example slot is ready, but this entry still needs API or editorial fill.</div>'
          }
        </div>

        <div class="detail-row">
          <strong>Derived Forms</strong>
          <div class="chip-grid">
            ${
              entry.derivatives && entry.derivatives.length
                ? entry.derivatives.map(function (item) {
                    return `<span class="chip chip--static">${escapeHtml(item)}</span>`;
                  }).join("")
                : '<span class="muted">No derivatives seeded yet.</span>'
            }
          </div>
        </div>

        <div class="detail-actions">
          <a class="button button--ghost" href="${entry.cambridgeUrl}" target="_blank" rel="noreferrer">Cambridge</a>
          <a class="button button--ghost" href="${entry.merriamUrl}" target="_blank" rel="noreferrer">Merriam-Webster</a>
        </div>
      </article>
    `;
  }

  flashcardSearch.addEventListener("input", function (event) {
    state.search = event.target.value;
    state.index = 0;
    renderStats();
    renderCard();
  });

  prevCard.addEventListener("click", function () {
    state.index -= 1;
    state.flipped = false;
    renderCard();
  });

  nextCard.addEventListener("click", function () {
    state.index += 1;
    state.flipped = false;
    renderCard();
  });

  flipCard.addEventListener("click", function () {
    state.flipped = !state.flipped;
    renderCard();
  });

  renderStats();
  renderCard();
})();
