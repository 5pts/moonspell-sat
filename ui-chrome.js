(function () {
  const THEME_KEY = "moonspell-theme";
  const body = document.body;
  if (!body) {
    return;
  }

  function applyTheme(mode) {
    body.classList.toggle("dark-mode", mode === "dark");
    const button = document.querySelector(".theme-toggle");
    if (button) {
      button.textContent = mode === "dark" ? "☼" : "☾";
      button.title = mode === "dark" ? "Switch to light mode" : "Switch to dark mode";
    }
  }

  function mountGrain() {
    if (document.querySelector(".grain-overlay")) {
      return;
    }
    const overlay = document.createElement("div");
    overlay.className = "grain-overlay";
    body.prepend(overlay);
  }

  function mountAsciiRain() {
    if (document.querySelector(".ascii-rain")) {
      return;
    }

    const symbols = ["+", "×", "÷", "=", ">", "<", "[ ]", "{ }", "SAT", "VERB", "NOUN", "☽", "☾", "✧", "A", "B", "C", "D", "///", "\\\\"];
    const colors = ["var(--text-primary)", "var(--text-primary)", "var(--text-primary)", "var(--accent-blue)", "var(--accent-orange)", "var(--accent-red)"];
    const container = document.createElement("div");
    container.className = "ascii-rain";

    for (let i = 0; i < 45; i += 1) {
      const symbol = document.createElement("div");
      symbol.className = "ascii-symbol";
      symbol.textContent = symbols[Math.floor(Math.random() * symbols.length)];
      symbol.style.left = `${Math.random() * 100}%`;
      symbol.style.color = colors[Math.floor(Math.random() * colors.length)];
      symbol.style.fontSize = `${Math.random() * 4 + 2}rem`;
      symbol.style.opacity = `${Math.random() * 0.15 + 0.05}`;
      symbol.style.animationDuration = `${Math.random() * 20 + 10}s`;
      symbol.style.animationDelay = `-${Math.random() * 30}s`;
      container.appendChild(symbol);
    }

    body.prepend(container);
  }

  function mountThemeToggle() {
    if (document.querySelector(".theme-toggle")) {
      return;
    }
    const button = document.createElement("button");
    button.type = "button";
    button.className = "theme-toggle";
    button.addEventListener("click", function () {
      const nextTheme = body.classList.contains("dark-mode") ? "light" : "dark";
      window.localStorage.setItem(THEME_KEY, nextTheme);
      applyTheme(nextTheme);
    });
    body.appendChild(button);
  }

  mountGrain();
  mountAsciiRain();
  mountThemeToggle();
  applyTheme(window.localStorage.getItem(THEME_KEY) || "light");
})();
