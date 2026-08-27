(function () {
  "use strict";

  const STORAGE_KEY = "mon-budget-data-v2";
  const MONTH_NAMES = ["Jan","Fév","Mar","Avr","Mai","Jun","Jul","Aoû","Sep","Oct","Nov","Déc"];
  const MONTH_NAMES_FULL = ["janvier","février","mars","avril","mai","juin","juillet","août","septembre","octobre","novembre","décembre"];

  const CATEGORIES = [
    { id: "loyer", label: "Loyer", color: "#4C7EA8", icon: iconHome },
    { id: "pension", label: "Pension", color: "#8B6FB3", icon: iconUser },
    { id: "voiture", label: "Voiture", color: "#C98A3B", icon: iconCar },
    { id: "assurance", label: "Assurance", color: "#3B9C8B", icon: iconShield },
    { id: "vacances", label: "Vacances", color: "#D9738B", icon: iconSun },
    { id: "abonnement", label: "Abonnement", color: "#5B6FD6", icon: iconRepeat },
    { id: "sante", label: "Santé", color: "#D9645C", icon: iconHeart },
    { id: "autre", label: "Autre", color: "#8B9089", icon: iconTag },
  ];

  const THEMES = [
    { id: "bleu", label: "Bleu doux", color: "#5C8AA6" },
    { id: "vert", label: "Vert sauge", color: "#5E8B7E" },
    { id: "anthracite", label: "Anthracite", color: "#5C6470" },
  ];

  function catById(id) { return CATEGORIES.find((c) => c.id === id) || CATEGORIES[CATEGORIES.length - 1]; }

  // ---------- Icons ----------
  function svgWrap(inner) { return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${inner}</svg>`; }
  function iconHome() { return svgWrap('<path d="M4 10L12 4l8 6"/><rect x="6" y="10" width="12" height="9"/>'); }
  function iconUser() { return svgWrap('<circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 4-6 8-6s8 2 8 6"/>'); }
  function iconCar() { return svgWrap('<rect x="3" y="11" width="18" height="6" rx="2"/><circle cx="7.5" cy="17.5" r="1.4" fill="currentColor"/><circle cx="16.5" cy="17.5" r="1.4" fill="currentColor"/><path d="M5 11l2-4h10l2 4"/>'); }
  function iconShield() { return svgWrap('<path d="M12 3l7 3v6c0 5-3 8-7 9-4-1-7-4-7-9V6l7-3z"/>'); }
  function iconSun() { return svgWrap('<circle cx="12" cy="9" r="3.5"/><path d="M4 18c2-2 4-2 6 0s4 2 6 0 4-2 4 0"/>'); }
  function iconRepeat() { return svgWrap('<path d="M4 7h12l-3-3M20 17H8l3 3"/>'); }
  function iconHeart() { return svgWrap('<path d="M12 20s-7-4.5-9-9c-1.5-3 1-6 4-6 2 0 3.5 1.5 5 3 1.5-1.5 3-3 5-3 3 0 5.5 3 4 6-2 4.5-9 9-9 9z"/>'); }
  function iconTag() { return svgWrap('<path d="M20 12l-8 8-9-9V4h7l10 8z"/><circle cx="7.5" cy="7.5" r="1.1" fill="currentColor"/>'); }

  // ---------- State ----------
  let state = { salary: 0, theme: "bleu", expenses: [] };

  function loadState() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (typeof parsed.salary === "number" && Array.isArray(parsed.expenses)) {
          state = Object.assign({ theme: "bleu" }, parsed);
        }
      }
    } catch (e) { console.warn("lecture impossible", e); }
  }
  function saveState() {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); }
    catch (e) { console.warn("sauvegarde impossible", e); }
  }

  function uid() { return Math.random().toString(36).slice(2, 10); }
  function parseNum(str) {
    if (str === null || str === undefined || str === "") return 0;
    const cleaned = String(str).trim().replace(",", ".").replace(/[^0-9.\-]/g, "");
    const n = Number(cleaned);
    return isNaN(n) ? 0 : n;
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
  function escapeHtml(str) {
    const div = document.createElement("div");
    div.textContent = str;
    return div.innerHTML;
  }

  const today = new Date();
  const currentMonth = today.getMonth() + 1;
  const currentYear = today.getFullYear();

  // ---------- Derived data ----------
  function computeDerived() {
    const fixed = state.expenses.filter((e) => e.type === "fixe");
    const periodique = state.expenses.filter((e) => e.type === "periodique");
    const provisions = state.expenses.filter((e) => e.type === "provision");

    const fixedTotal = fixed.reduce((s, e) => s + (Number(e.amount) || 0), 0);
    const periodiqueMonthlyTotal = periodique.reduce((s, e) => {
      const nMonths = (e.months || []).length || 1;
      return s + ((Number(e.amount) || 0) * nMonths) / 12;
    }, 0);

    const provisionsWithMeta = provisions.map((e) => {
      const [ty, tm] = (e.targetMonth || "").split("-").map(Number);
      let monthsRemaining = 1;
      if (ty && tm) {
        monthsRemaining = (ty - currentYear) * 12 + (tm - currentMonth) + 1;
        if (monthsRemaining < 1) monthsRemaining = 1;
      }
      const monthly = (Number(e.amount) || 0) / monthsRemaining;
      const dueThisMonth = ty === currentYear && tm === currentMonth;
      return Object.assign({}, e, { monthsRemaining, monthly, dueThisMonth, targetYear: ty, targetMonthNum: tm });
    });
    const provisionsMonthlyTotal = provisionsWithMeta.reduce((s, e) => s + e.monthly, 0);

    const periodiqueDueThisMonth = periodique.filter((e) => (e.months || []).includes(currentMonth));
    const provisionsDueThisMonth = provisionsWithMeta.filter((e) => e.dueThisMonth);

    const salaryNum = Number(state.salary) || 0;
    const resteAVivre = salaryNum - fixedTotal - periodiqueMonthlyTotal - provisionsMonthlyTotal;

    return {
      fixed, periodique, provisions: provisionsWithMeta,
      fixedTotal, periodiqueMonthlyTotal, provisionsMonthlyTotal,
      salaryNum, resteAVivre,
      periodiqueDueThisMonth, provisionsDueThisMonth,
    };
  }

  // ---------- Tabs ----------
  const tabButtons = document.querySelectorAll(".tab-btn");
  const pages = document.querySelectorAll(".page");
  tabButtons.forEach((btn) => {
    btn.addEventListener("click", () => switchTab(btn.dataset.tab));
  });
  function switchTab(tab) {
    tabButtons.forEach((b) => b.classList.toggle("active", b.dataset.tab === tab));
    pages.forEach((p) => p.classList.toggle("active", p.id === "page-" + tab));
    if (tab === "calendrier") renderCalendar();
  }

  // ---------- Render: Accueil ----------
  const salaryInput = document.getElementById("salaryInput");

  function renderAccueil() {
    const d = computeDerived();
    salaryInput.value = state.salary ? String(state.salary).replace(".", ",") : "";

    document.getElementById("lineSalary").textContent = formatEUR(d.salaryNum);
    document.getElementById("lineFixed").textContent = "− " + formatEUR(d.fixedTotal);
    document.getElementById("linePeriod").textContent = "− " + formatEUR(d.periodiqueMonthlyTotal);
    document.getElementById("lineProv").textContent = "− " + formatEUR(d.provisionsMonthlyTotal);
    const totalEl = document.getElementById("lineTotal");
    totalEl.textContent = formatEUR(d.resteAVivre);
    const isNegative = d.resteAVivre < 0;
    totalEl.classList.toggle("negative", isNegative);

    const pct = d.salaryNum > 0 ? Math.max(0, Math.min(100, (d.resteAVivre / d.salaryNum) * 100)) : 0;
    const circumference = 2 * Math.PI * 54;
    const offset = circumference - (pct / 100) * circumference;
    const gaugeCircle = document.getElementById("gaugeCircle");
    gaugeCircle.style.strokeDashoffset = d.salaryNum > 0 ? offset : circumference;
    const themeColor = getComputedStyle(document.body).getPropertyValue("--primary-400").trim();
    gaugeCircle.setAttribute("stroke", isNegative ? "#D9847C" : (themeColor || "#86AFC4"));
    document.getElementById("gaugePct").textContent = d.salaryNum > 0 ? Math.round(pct) + "%" : "—";

    const alertItems = [
      ...d.periodiqueDueThisMonth.map((e) => ({ name: e.name, amount: e.amount })),
      ...d.provisionsDueThisMonth.map((e) => ({ name: e.name, amount: e.amount })),
    ];
    const alertCard = document.getElementById("alertCard");
    if (alertItems.length > 0) {
      alertCard.style.display = "block";
      alertCard.innerHTML =
        `<p class="alert-title">À payer ce mois-ci</p>` +
        alertItems.map((it) => `<div class="alert-row"><p>${escapeHtml(it.name)}</p><span>${formatEUR(it.amount)}</span></div>`).join("");
    } else {
      alertCard.style.display = "none";
    }
  }

  // ---------- Render: Dépenses ----------
  const listsContainer = document.getElementById("listsContainer");

  function expenseMeta(exp, d) {
    if (exp.type === "provision") {
      const meta = d.provisions.find((p) => p.id === exp.id);
      const label = meta && meta.targetMonthNum ? `${MONTH_NAMES_FULL[meta.targetMonthNum - 1]} ${meta.targetYear}` : "échéance non définie";
      return `${formatEUR(exp.amount)} pour ${label} · ${formatEUR(meta ? meta.monthly : 0)}/mois` + (meta && meta.dueThisMonth ? `<span class="due-badge">CE MOIS-CI</span>` : "");
    }
    if (exp.type === "periodique") {
      const months = (exp.months || []).map((m) => MONTH_NAMES[m - 1]).join(", ") || "aucun mois";
      const dueNow = (exp.months || []).includes(currentMonth);
      return `${formatEUR(exp.amount)} en ${months}` + (dueNow ? `<span class="due-badge">CE MOIS-CI</span>` : "");
    }
    return "chaque mois";
  }

  function renderExpenseRow(exp, d) {
    const cat = catById(exp.category);
    const row = document.createElement("div");
    row.className = "expense-row";
    row.style.setProperty("--cat-color", cat.color);
    row.innerHTML = `
      <div class="expense-icon">${cat.icon()}</div>
      <div class="expense-body">
        <p class="expense-name">${escapeHtml(exp.name)}</p>
        <p class="expense-meta">${expenseMeta(exp, d)}</p>
      </div>
      <div class="expense-right">
        <span class="expense-amount">${formatEUR(exp.amount)}</span>
        <button class="delete-btn" aria-label="Supprimer">${svgWrap('<polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>')}</button>
      </div>`;
    row.querySelector(".delete-btn").addEventListener("click", () => deleteExpense(exp.id));
    return row;
  }

  function renderDepenses() {
    const d = computeDerived();
    listsContainer.innerHTML = "";

    const sections = [
      { title: "Charges fixes", items: d.fixed, total: d.fixedTotal, suffix: "" },
      { title: "Certains mois", items: d.periodique, total: d.periodiqueMonthlyTotal, suffix: "/mois" },
      { title: "Provisions & épargnes", items: d.provisions, total: d.provisionsMonthlyTotal, suffix: "/mois" },
    ];

    let any = false;
    sections.forEach((sec) => {
      if (sec.items.length === 0) return;
      any = true;
      const section = document.createElement("div");
      section.className = "section";
      const head = document.createElement("div");
      head.className = "section-head";
      head.innerHTML = `<p>${sec.title}</p><p>${formatEUR(sec.total)}${sec.suffix}</p>`;
      section.appendChild(head);
      const list = document.createElement("div");
      list.className = "section-list";
      sec.items.forEach((exp) => list.appendChild(renderExpenseRow(exp, d)));
      section.appendChild(list);
      listsContainer.appendChild(section);
    });

    if (!any) {
      const empty = document.createElement("div");
      empty.className = "empty-state";
      empty.innerHTML = `<p>Aucune dépense pour l'instant.</p><p>Ajoutez votre premier loyer, abonnement ou projet d'épargne ci-dessus.</p>`;
      listsContainer.appendChild(empty);
    }
  }

  function deleteExpense(id) {
    state.expenses = state.expenses.filter((e) => e.id !== id);
    saveState();
    renderAll();
  }

  // ---------- Render: Calendrier ----------
  function renderCalendar() {
    const d = computeDerived();
    const calGrid = document.getElementById("calGrid");
    calGrid.innerHTML = "";

    for (let m = 1; m <= 12; m++) {
      const items = [];
      d.periodique.forEach((e) => { if ((e.months || []).includes(m)) items.push({ name: e.name, amount: e.amount }); });
      d.provisions.forEach((e) => { if (e.targetMonthNum === m && e.targetYear === currentYear) items.push({ name: e.name, amount: e.amount }); });
      const total = d.fixedTotal + items.reduce((s, it) => s + (Number(it.amount) || 0), 0);

      const card = document.createElement("div");
      card.className = "cal-month" + (m === currentMonth ? " current" : "");
      card.innerHTML = `
        <div class="cal-month-head">
          <p>${MONTH_NAMES_FULL[m - 1]}</p>
          <span class="cal-month-total">${formatEUR(total)}</span>
        </div>
        <div class="cal-items">
          ${items.length ? items.map((it) => `<div class="cal-item"><strong>${escapeHtml(it.name)}</strong><span>${formatEUR(it.amount)}</span></div>`).join("") : `<div class="cal-empty">Charges fixes uniquement</div>`}
        </div>`;
      calGrid.appendChild(card);
    }
  }

  // ---------- Render: all ----------
  function renderAll() {
    renderAccueil();
    renderDepenses();
    if (document.getElementById("page-calendrier").classList.contains("active")) renderCalendar();
  }

  // ---------- Form: category & type ----------
  const catScroll = document.getElementById("catScroll");
  let currentCategory = CATEGORIES[0].id;
  CATEGORIES.forEach((cat) => {
    const chip = document.createElement("button");
    chip.type = "button";
    chip.className = "cat-chip" + (cat.id === currentCategory ? " active" : "");
    chip.style.setProperty("--cat-color", cat.color);
    chip.dataset.cat = cat.id;
    chip.innerHTML = `<span class="cat-chip-dot">${cat.icon()}</span>${cat.label}`;
    chip.addEventListener("click", () => {
      currentCategory = cat.id;
      catScroll.querySelectorAll(".cat-chip").forEach((c) => c.classList.toggle("active", c.dataset.cat === cat.id));
    });
    catScroll.appendChild(chip);
  });

  const monthGrid = document.getElementById("monthGrid");
  let selectedMonths = [];
  MONTH_NAMES.forEach((label, idx) => {
    const m = idx + 1;
    const pill = document.createElement("button");
    pill.type = "button";
    pill.className = "month-pill";
    pill.textContent = label;
    pill.addEventListener("click", () => {
      if (selectedMonths.includes(m)) selectedMonths = selectedMonths.filter((x) => x !== m);
      else selectedMonths.push(m);
      pill.classList.toggle("active");
      updatePeriodiqueHint();
    });
    monthGrid.appendChild(pill);
  });

  const typeButtons = document.querySelectorAll(".type-toggle button");
  const monthsBlock = document.getElementById("monthsBlock");
  const targetBlock = document.getElementById("targetBlock");
  let currentType = "fixe";
  typeButtons.forEach((btn) => {
    btn.addEventListener("click", () => {
      currentType = btn.dataset.type;
      typeButtons.forEach((b) => b.classList.toggle("active", b === btn));
      monthsBlock.classList.toggle("visible", currentType === "periodique");
      targetBlock.classList.toggle("visible", currentType === "provision");
    });
  });

  const nameInput = document.getElementById("nameInput");
  const amountInput = document.getElementById("amountInput");
  const targetMonthInput = document.getElementById("targetMonthInput");
  const monthsHint = document.getElementById("monthsHint");
  const targetHint = document.getElementById("targetHint");

  function updatePeriodiqueHint() {
    const amount = parseNum(amountInput.value);
    if (currentType === "periodique" && amount > 0 && selectedMonths.length > 0) {
      const monthly = (amount * selectedMonths.length) / 12;
      monthsHint.textContent = `→ ${formatEUR(monthly)}/mois à provisionner (${selectedMonths.length}x/an)`;
    } else {
      monthsHint.textContent = "";
    }
  }
  function updateTargetHint() {
    const amount = parseNum(amountInput.value);
    const val = targetMonthInput.value;
    if (currentType === "provision" && amount > 0 && val) {
      const [ty, tm] = val.split("-").map(Number);
      let monthsRemaining = (ty - currentYear) * 12 + (tm - currentMonth) + 1;
      if (monthsRemaining < 1) monthsRemaining = 1;
      targetHint.textContent = `→ ${formatEUR(amount / monthsRemaining)} à mettre de côté chaque mois`;
    } else {
      targetHint.textContent = "";
    }
  }
  amountInput.addEventListener("input", () => { updatePeriodiqueHint(); updateTargetHint(); });
  targetMonthInput.addEventListener("input", updateTargetHint);

  document.getElementById("expenseForm").addEventListener("submit", (e) => {
    e.preventDefault();
    const name = nameInput.value.trim();
    const amount = parseNum(amountInput.value);

    if (!name || !amount || amount <= 0) { showToast("Nom et montant valides requis"); return; }
    if (currentType === "periodique" && selectedMonths.length === 0) { showToast("Sélectionnez au moins un mois"); return; }
    if (currentType === "provision" && !targetMonthInput.value) { showToast("Indiquez une échéance"); return; }

    const expense = { id: uid(), name, amount, category: currentCategory, type: currentType };
    if (currentType === "periodique") expense.months = [...selectedMonths].sort((a, b) => a - b);
    if (currentType === "provision") expense.targetMonth = targetMonthInput.value;

    state.expenses.push(expense);
    saveState();
    renderAll();
    showToast("Dépense ajoutée");

    nameInput.value = ""; amountInput.value = ""; targetMonthInput.value = "";
    monthsHint.textContent = ""; targetHint.textContent = "";
    selectedMonths = [];
    monthGrid.querySelectorAll(".month-pill").forEach((p) => p.classList.remove("active"));
    currentType = "fixe";
    typeButtons.forEach((b) => b.classList.toggle("active", b.dataset.type === "fixe"));
    monthsBlock.classList.remove("visible");
    targetBlock.classList.remove("visible");
    nameInput.focus();
  });

  salaryInput.addEventListener("input", () => {
    state.salary = parseNum(salaryInput.value) || 0;
    saveState();
    renderAccueil();
  });

  // ---------- Settings: theme ----------
  const themeRow = document.getElementById("themeRow");
  THEMES.forEach((t) => {
    const sw = document.createElement("div");
    sw.className = "theme-swatch" + (state.theme === t.id ? " active" : "");
    sw.dataset.theme = t.id;
    sw.innerHTML = `<span class="theme-dot" style="background:${t.color}"></span><span>${t.label}</span>`;
    sw.addEventListener("click", () => {
      state.theme = t.id;
      saveState();
      applyTheme();
      themeRow.querySelectorAll(".theme-swatch").forEach((s) => s.classList.toggle("active", s.dataset.theme === t.id));
      renderAccueil();
    });
    themeRow.appendChild(sw);
  });
  function applyTheme() { document.body.setAttribute("data-theme", state.theme || "bleu"); }

  // ---------- Export / Import ----------
  document.getElementById("exportBtn").addEventListener("click", () => {
    const data = { salary: state.salary, theme: state.theme, expenses: state.expenses, exportedAt: new Date().toISOString() };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `budget-sauvegarde-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
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
        state.theme = data.theme || "bleu";
        state.expenses = data.expenses.map((exp) => ({
          id: exp.id || uid(),
          name: exp.name || "Sans nom",
          amount: Number(exp.amount) || 0,
          category: exp.category || "autre",
          type: exp.type === "periodique" ? "periodique" : (exp.type === "provision" ? "provision" : "fixe"),
          months: exp.months || undefined,
          targetMonth: exp.targetMonth || undefined,
        }));
        saveState();
        applyTheme();
        themeRow.querySelectorAll(".theme-swatch").forEach((s) => s.classList.toggle("active", s.dataset.theme === state.theme));
        renderAll();
        showToast("Sauvegarde importée");
      } catch (err) { showToast("Fichier invalide"); }
    };
    reader.readAsText(file);
    e.target.value = "";
  });

  document.getElementById("resetBtn").addEventListener("click", () => {
    if (confirm("Effacer toutes les données de l'app ? Cette action est irréversible.")) {
      state = { salary: 0, theme: state.theme, expenses: [] };
      saveState();
      renderAll();
      showToast("Données réinitialisées");
    }
  });

  // ---------- Help modal ----------
  const helpOverlay = document.getElementById("helpOverlay");
  document.getElementById("helpBtn").addEventListener("click", () => helpOverlay.classList.add("visible"));
  document.getElementById("helpClose").addEventListener("click", () => helpOverlay.classList.remove("visible"));
  helpOverlay.addEventListener("click", (e) => { if (e.target === helpOverlay) helpOverlay.classList.remove("visible"); });
  document.querySelectorAll(".help-tabs button").forEach((btn) => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".help-tabs button").forEach((b) => b.classList.toggle("active", b === btn));
      document.getElementById("panel-ios").classList.toggle("visible", btn.dataset.tab === "ios");
      document.getElementById("panel-android").classList.toggle("visible", btn.dataset.tab === "android");
    });
  });

  // ---------- Install prompt ----------
  let deferredPrompt = null;
  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    deferredPrompt = e;
  });

  // ---------- Service worker ----------
  if ("serviceWorker" in navigator) {
    window.addEventListener("load", () => {
      navigator.serviceWorker.register("sw.js").catch((err) => console.warn("SW registration failed", err));
    });
  }

  // ---------- Init ----------
  loadState();
  applyTheme();
  renderAll();
})();
