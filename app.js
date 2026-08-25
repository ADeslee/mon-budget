(function () {
  "use strict";

  const STORAGE_KEY = "mon-budget-data-v1";

  // ---------- State ----------
  let state = { salary: 0, expenses: [] };

  function loadState() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (typeof parsed.salary === "number" && Array.isArray(parsed.expenses)) {
          state = parsed;
        }
      }
    } catch (e) {
      console.warn("Impossible de lire les données sauvegardées", e);
    }
  }

  function saveState() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch (e) {
      console.warn("Impossible de sauvegarder les données", e);
    }
  }

  // ---------- Helpers ----------
  function uid() {
    return Math.random().toString(36).slice(2, 10);
  }

  function formatEUR(n) {
    const v = Number(n) || 0;
    return v.toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " €";
  }

  function showToast(msg) {
    const toast = document.getElementById("toast");
    toast.textContent = msg;
    toast.classList.add("visible");
    clearTimeout(showToast._t);
    showToast._t = setTimeout(() => toast.classList.remove("visible"), 2200);
  }

  // ---------- Elements ----------
  const salaryInput = document.getElementById("salaryInput");
  const expenseForm = document.getElementById("expenseForm");
  const nameInput = document.getElementById("nameInput");
  const amountInput = document.getElementById("amountInput");
  const monthsInput = document.getElementById("monthsInput");
  const monthsBlock = document.getElementById("monthsBlock");
  const monthsHint = document.getElementById("monthsHint");
  const typeButtons = document.querySelectorAll(".type-toggle button");
  const listsContainer = document.getElementById("listsContainer");

  let currentType = "fixe";

  // ---------- Render ----------
  function render() {
    salaryInput.value = state.salary ? state.salary : "";

    const fixedExpenses = state.expenses.filter((e) => e.type === "fixe");
    const provisions = state.expenses.filter((e) => e.type === "provision");

    const fixedTotal = fixedExpenses.reduce((s, e) => s + (Number(e.amount) || 0), 0);
    const provisionMonthlyTotal = provisions.reduce(
      (s, e) => s + (Number(e.amount) || 0) / (Number(e.months) || 1),
      0
    );

    const salaryNum = Number(state.salary) || 0;
    const resteAVivre = salaryNum - fixedTotal - provisionMonthlyTotal;
    const pct = salaryNum > 0 ? Math.max(0, Math.min(100, (resteAVivre / salaryNum) * 100)) : 0;
    const isNegative = resteAVivre < 0;

    document.getElementById("lineSalary").textContent = formatEUR(salaryNum);
    document.getElementById("lineFixed").textContent = "− " + formatEUR(fixedTotal);
    document.getElementById("lineProv").textContent = "− " + formatEUR(provisionMonthlyTotal);
    const totalEl = document.getElementById("lineTotal");
    totalEl.textContent = formatEUR(resteAVivre);
    totalEl.classList.toggle("negative", isNegative);

    const circumference = 2 * Math.PI * 54;
    const offset = circumference - (pct / 100) * circumference;
    const gaugeCircle = document.getElementById("gaugeCircle");
    gaugeCircle.style.strokeDashoffset = salaryNum > 0 ? offset : circumference;
    gaugeCircle.setAttribute("stroke", isNegative ? "#D9847C" : "#7FA895");
    document.getElementById("gaugePct").textContent = salaryNum > 0 ? Math.round(pct) + "%" : "—";

    // Lists
    listsContainer.innerHTML = "";

    if (fixedExpenses.length > 0) {
      listsContainer.appendChild(renderSection("Charges fixes", fixedTotal, "", fixedExpenses));
    }
    if (provisions.length > 0) {
      listsContainer.appendChild(renderSection("Provisions & épargnes", provisionMonthlyTotal, "/mois", provisions));
    }
    if (state.expenses.length === 0) {
      const empty = document.createElement("div");
      empty.className = "empty-state";
      empty.innerHTML = `<p>Aucune dépense pour l'instant.</p><p>Ajoutez votre premier loyer, abonnement ou projet d'épargne ci-dessus.</p>`;
      listsContainer.appendChild(empty);
    }
  }

  function renderSection(title, total, suffix, items) {
    const section = document.createElement("div");
    section.className = "section";

    const head = document.createElement("div");
    head.className = "section-head";
    head.innerHTML = `<p>${title}</p><p>${formatEUR(total)}${suffix}</p>`;
    section.appendChild(head);

    const list = document.createElement("div");
    list.className = "section-list";

    items.forEach((exp) => {
      const row = document.createElement("div");
      row.className = "expense-row";
      const meta =
        exp.type === "provision"
          ? `${formatEUR(exp.amount)} sur ${exp.months} mois · ${formatEUR(exp.amount / exp.months)}/mois`
          : "chaque mois";
      row.innerHTML = `
        <div>
          <p class="expense-name">${escapeHtml(exp.name)}</p>
          <p class="expense-meta">${meta}</p>
        </div>
        <div class="expense-right">
          <span class="expense-amount">${formatEUR(exp.amount)}</span>
          <button class="delete-btn" data-id="${exp.id}" aria-label="Supprimer">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
          </button>
        </div>`;
      row.querySelector(".delete-btn").addEventListener("click", () => deleteExpense(exp.id));
      list.appendChild(row);
    });

    section.appendChild(list);
    return section;
  }

  function escapeHtml(str) {
    const div = document.createElement("div");
    div.textContent = str;
    return div.innerHTML;
  }

  // ---------- Actions ----------
  function deleteExpense(id) {
    state.expenses = state.expenses.filter((e) => e.id !== id);
    saveState();
    render();
  }

  salaryInput.addEventListener("input", () => {
    state.salary = Number(salaryInput.value) || 0;
    saveState();
    render();
  });

  typeButtons.forEach((btn) => {
    btn.addEventListener("click", () => {
      currentType = btn.dataset.type;
      typeButtons.forEach((b) => b.classList.toggle("active", b === btn));
      monthsBlock.classList.toggle("visible", currentType === "provision");
      updateMonthsHint();
    });
  });

  function updateMonthsHint() {
    const amount = Number(amountInput.value);
    const months = Number(monthsInput.value);
    if (currentType === "provision" && amount > 0 && months > 0) {
      monthsHint.textContent = `→ ${formatEUR(amount / months)} à mettre de côté chaque mois`;
    } else {
      monthsHint.textContent = "";
    }
  }
  amountInput.addEventListener("input", updateMonthsHint);
  monthsInput.addEventListener("input", updateMonthsHint);

  expenseForm.addEventListener("submit", (e) => {
    e.preventDefault();
    const name = nameInput.value.trim();
    const amount = Number(amountInput.value);
    const months = Number(monthsInput.value);

    if (!name || !amount || amount <= 0) {
      showToast("Nom et montant valides requis");
      return;
    }
    if (currentType === "provision" && (!months || months <= 0)) {
      showToast("Indiquez un nombre de mois valide");
      return;
    }

    state.expenses.push({
      id: uid(),
      name,
      amount,
      type: currentType,
      months: currentType === "provision" ? months : null,
    });
    saveState();
    render();
    showToast("Dépense ajoutée");

    nameInput.value = "";
    amountInput.value = "";
    monthsInput.value = "";
    monthsHint.textContent = "";
    currentType = "fixe";
    typeButtons.forEach((b) => b.classList.toggle("active", b.dataset.type === "fixe"));
    monthsBlock.classList.remove("visible");
    nameInput.focus();
  });

  // ---------- Export / Import ----------
  document.getElementById("exportBtn").addEventListener("click", () => {
    const data = { salary: state.salary, expenses: state.expenses, exportedAt: new Date().toISOString() };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `budget-sauvegarde-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showToast("Sauvegarde téléchargée");
  });

  const importFile = document.getElementById("importFile");
  document.getElementById("importBtn").addEventListener("click", () => importFile.click());
  importFile.addEventListener("change", (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const data = JSON.parse(evt.target.result);
        if (typeof data.salary !== "number" || !Array.isArray(data.expenses)) throw new Error("format invalide");
        state.salary = data.salary;
        state.expenses = data.expenses.map((exp) => ({
          id: exp.id || uid(),
          name: exp.name || "Sans nom",
          amount: Number(exp.amount) || 0,
          type: exp.type === "provision" ? "provision" : "fixe",
          months: exp.type === "provision" ? Number(exp.months) || 1 : null,
        }));
        saveState();
        render();
        showToast("Sauvegarde importée");
      } catch (err) {
        showToast("Fichier invalide");
      }
    };
    reader.readAsText(file);
    e.target.value = "";
  });

  // ---------- Help modal ----------
  const helpOverlay = document.getElementById("helpOverlay");
  document.getElementById("helpBtn").addEventListener("click", () => helpOverlay.classList.add("visible"));
  document.getElementById("helpClose").addEventListener("click", () => helpOverlay.classList.remove("visible"));
  helpOverlay.addEventListener("click", (e) => {
    if (e.target === helpOverlay) helpOverlay.classList.remove("visible");
  });
  document.querySelectorAll(".help-tabs button").forEach((btn) => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".help-tabs button").forEach((b) => b.classList.toggle("active", b === btn));
      document.getElementById("panel-ios").classList.toggle("visible", btn.dataset.tab === "ios");
      document.getElementById("panel-android").classList.toggle("visible", btn.dataset.tab === "android");
    });
  });

  // ---------- Install prompt (Android/desktop Chrome) ----------
  let deferredPrompt = null;
  const installBanner = document.getElementById("installBanner");
  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    deferredPrompt = e;
    if (!window.matchMedia("(display-mode: standalone)").matches) {
      installBanner.classList.add("visible");
    }
  });
  document.getElementById("installBtn").addEventListener("click", async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    await deferredPrompt.userChoice;
    deferredPrompt = null;
    installBanner.classList.remove("visible");
  });
  window.addEventListener("appinstalled", () => {
    installBanner.classList.remove("visible");
  });

  // ---------- Service worker ----------
  if ("serviceWorker" in navigator) {
    window.addEventListener("load", () => {
      navigator.serviceWorker.register("sw.js").catch((err) => console.warn("SW registration failed", err));
    });
  }

  // ---------- Init ----------
  loadState();
  render();
})();
