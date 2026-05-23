const STORAGE_KEY = "myMoneyAppState";
const categories = ["Housing", "Food", "Transport", "Utilities", "Health", "Education", "Entertainment", "Debt", "Savings", "Other"];
const currencies = [
  { code: "USD", symbol: "$", name: "US Dollar" },
  { code: "ZAR", symbol: "R", name: "South African Rand" },
  { code: "EUR", symbol: "€", name: "Euro" },
  { code: "GBP", symbol: "£", name: "British Pound" },
  { code: "NGN", symbol: "₦", name: "Nigerian Naira" },
  { code: "KES", symbol: "KSh", name: "Kenyan Shilling" },
  { code: "INR", symbol: "₹", name: "Indian Rupee" }
];
const icons = ["💳", "🏦", "💵", "🏠", "📈", "🎓", "🚗", "🧾", "⭐"];

const RATES_URL = "https://open.er-api.com/v6/latest/USD";
const RATES_CACHE_MS = 12 * 60 * 60 * 1000;

const state = loadState();
let verificationCode = "";
let activeUserId = state.sessionUserId;
let activeView = "dashboard";

const els = {
  authPanel: document.querySelector("#authPanel"),
  workspace: document.querySelector("#workspace"),
  authNotice: document.querySelector("#authNotice"),
  notice: document.querySelector("#notice"),
  viewTitle: document.querySelector("#viewTitle"),
  todayLabel: document.querySelector("#todayLabel"),
  totalBalance: document.querySelector("#totalBalance"),
  monthSpend: document.querySelector("#monthSpend"),
  topCategory: document.querySelector("#topCategory"),
  exchangeRateStatus: document.querySelector("#exchangeRateStatus"),
  dashboardAccounts: document.querySelector("#dashboardAccounts"),
  accountsList: document.querySelector("#accountsList"),
  recentExpenses: document.querySelector("#recentExpenses"),
  expenseHistory: document.querySelector("#expenseHistory"),
  expenseAccount: document.querySelector("#expenseAccount"),
  expenseFilter: document.querySelector("#expenseFilter"),
  accountCurrency: document.querySelector("#accountCurrency"),
  currencyOptions: document.querySelector("#currencyOptions"),
  accountIcon: document.querySelector("#accountIcon"),
  accountForm: document.querySelector("#accountForm"),
  accountFormTitle: document.querySelector("#accountFormTitle"),
  expenseForm: document.querySelector("#expenseForm"),
  categoryBars: document.querySelector("#categoryBars"),
  aiInsight: document.querySelector("#aiInsight")
};

function loadState() {
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored) {
    const parsed = JSON.parse(stored);
    return {
      sessionUserId: null,
      users: [],
      accounts: [],
      expenses: [],
      exchangeRates: null,
      ...parsed
    };
  }

  return {
    sessionUserId: null,
    users: [],
    accounts: [],
    expenses: [],
    exchangeRates: null
  };
}

function saveState() {
  state.sessionUserId = activeUserId;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function uid(prefix) {
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function getUser() {
  return state.users.find((user) => user.id === activeUserId);
}

function userAccounts() {
  return state.accounts.filter((account) => account.userId === activeUserId);
}

function userExpenses() {
  return state.expenses.filter((expense) => expense.userId === activeUserId);
}

function formatMoney(amount, currencyCode = "USD") {
  try {
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency: currencyCode,
      maximumFractionDigits: 2
    }).format(Number(amount || 0));
  } catch {
    return `${currencyCode} ${Number(amount || 0).toFixed(2)}`;
  }
}

function currencyName(code) {
  try {
    return new Intl.DisplayNames([navigator.language || "en"], { type: "currency" }).of(code) || code;
  } catch {
    return currencies.find((currency) => currency.code === code)?.name || code;
  }
}

function normalizeCurrencyInput(value) {
  return String(value || "").trim().slice(0, 3).toUpperCase();
}

function exchangeRate(code) {
  const rates = state.exchangeRates?.rates;
  return rates?.[code] || null;
}

function convertCurrency(amount, fromCurrency, toCurrency) {
  const fromRate = exchangeRate(fromCurrency);
  const toRate = exchangeRate(toCurrency);
  if (!fromRate || !toRate) return Number(amount || 0);
  return (Number(amount || 0) / fromRate) * toRate;
}

function currencyLabel(currency) {
  return `${currency.code} - ${currency.name || currencyName(currency.code)}`;
}

function currencyInputValue(code) {
  const currency = currencies.find((item) => item.code === code);
  return currency ? currencyLabel(currency) : code;
}

function updateCurrencyChoices(rateCodes = []) {
  const known = new Map(currencies.map((currency) => [currency.code, currency]));
  rateCodes.forEach((code) => known.set(code, { code, name: currencyName(code) }));
  const sorted = [...known.values()].sort((a, b) => a.code.localeCompare(b.code));
  currencies.length = 0;
  currencies.push(...sorted);
  renderCurrencyOptions();
}

function renderCurrencyOptions() {
  els.currencyOptions.innerHTML = currencies
    .map((currency) => `<option value="${escapeHtml(currencyLabel(currency))}"></option>`)
    .join("");
}

function resetAccountForm() {
  els.accountForm.reset();
  els.accountForm.elements.id.value = "";
  els.accountForm.elements.currency.value = currencyInputValue(userAccounts()[0]?.currency || "USD");
  els.accountFormTitle.textContent = "New financial account";
}

async function loadExchangeRates() {
  if (state.exchangeRates?.loadedAt && Date.now() - state.exchangeRates.loadedAt < RATES_CACHE_MS) {
    updateCurrencyChoices(Object.keys(state.exchangeRates.rates || {}));
    renderAll();
    return;
  }

  try {
    const response = await fetch(RATES_URL);
    if (!response.ok) throw new Error("Exchange rate request failed.");
    const data = await response.json();
    if (data.result !== "success" || !data.rates) throw new Error("Exchange rate data was unavailable.");

    state.exchangeRates = {
      base: data.base_code,
      rates: data.rates,
      loadedAt: Date.now(),
      updatedAt: data.time_last_update_utc,
      nextUpdateAt: data.time_next_update_utc
    };
    updateCurrencyChoices(Object.keys(data.rates));
    saveState();
    renderAll();
  } catch {
    updateCurrencyChoices(Object.keys(state.exchangeRates?.rates || {}));
    renderAll();
    showNotice("Live exchange rates could not load. Using saved currency data for now.");
  }
}

function showNotice(message) {
  els.notice.textContent = message;
  els.authNotice.textContent = message;
  window.clearTimeout(showNotice.timer);
  showNotice.timer = window.setTimeout(() => {
    els.notice.textContent = "";
    els.authNotice.textContent = "";
  }, 3600);
}

function setAuthTab(tabName) {
  document.querySelectorAll("[data-auth-tab]").forEach((tab) => {
    tab.classList.toggle("active", tab.dataset.authTab === tabName);
  });
  document.querySelector("#signInForm").classList.toggle("hidden", tabName !== "signin");
  document.querySelector("#signUpForm").classList.toggle("hidden", tabName !== "signup");
  document.querySelector("#resetForm").classList.toggle("hidden", tabName !== "reset");
}

function renderShell() {
  const signedIn = Boolean(getUser());
  els.authPanel.classList.toggle("hidden", signedIn);
  els.workspace.classList.toggle("hidden", !signedIn);
  els.todayLabel.textContent = new Intl.DateTimeFormat(undefined, { dateStyle: "full" }).format(new Date());
  if (signedIn) renderAll();
}

function renderAll() {
  renderNavigation();
  renderMetrics();
  renderAccounts();
  renderExpenses();
  renderAnalytics();
}

function renderNavigation() {
  const titles = {
    dashboard: "Dashboard",
    accounts: "Accounts",
    expenses: "Expenses",
    analytics: "AI analytics"
  };
  els.viewTitle.textContent = titles[activeView];
  document.querySelectorAll(".nav-item").forEach((button) => {
    button.classList.toggle("active", button.dataset.view === activeView);
  });
  document.querySelectorAll(".view").forEach((view) => {
    view.classList.toggle("active", view.id === `${activeView}View`);
  });
}

function renderMetrics() {
  const accounts = userAccounts();
  const expenses = userExpenses();
  const mainCurrency = accounts[0]?.currency || "USD";
  const total = accounts.reduce((sum, account) => sum + convertCurrency(account.balance, account.currency, mainCurrency), 0);
  const month = new Date().toISOString().slice(0, 7);
  const monthExpenses = expenses.filter((expense) => expense.date.slice(0, 7) === month);
  const monthSpend = monthExpenses.reduce((sum, expense) => {
    const account = state.accounts.find((item) => item.id === expense.accountId);
    return sum + convertCurrency(expense.amount, account?.currency || mainCurrency, mainCurrency);
  }, 0);
  const top = topCategoryFrom(expenses, mainCurrency);

  els.totalBalance.textContent = formatMoney(total, mainCurrency);
  els.monthSpend.textContent = formatMoney(monthSpend, mainCurrency);
  els.topCategory.textContent = top?.category || "None";
  els.exchangeRateStatus.textContent = state.exchangeRates?.updatedAt
    ? `Live exchange rates loaded. Last update: ${state.exchangeRates.updatedAt}. Dashboard totals are shown in ${mainCurrency}.`
    : "Exchange rates loading. Dashboard totals use saved values until live rates are available.";
}

function renderAccounts() {
  const accounts = userAccounts();
  renderCurrencyOptions();
  els.accountIcon.innerHTML = icons.map((icon) => `<option value="${icon}">${icon}</option>`).join("");
  els.expenseAccount.innerHTML = accounts.map((account) => `<option value="${account.id}">${account.icon} ${account.name}</option>`).join("");
  els.expenseFilter.innerHTML = `<option value="all">All accounts</option>${accounts.map((account) => `<option value="${account.id}">${account.name}</option>`).join("")}`;

  const simpleRows = accounts.map(accountRow).join("");
  els.dashboardAccounts.innerHTML = simpleRows || emptyHtml("Create your first account.");
  els.accountsList.innerHTML = accounts.map((account) => accountRow(account, true)).join("") || emptyHtml("No financial accounts yet.");
}

function accountRow(account, detailed = false) {
  return `
    <article class="account-row">
      <span class="account-icon">${account.icon}</span>
      <span>
        <span class="row-title">${escapeHtml(account.name)}</span>
        <span class="row-meta">${escapeHtml(account.type)} · ${account.currency}</span>
      </span>
      <span class="row-value">
        ${formatMoney(account.balance, account.currency)}
        ${detailed ? `<span class="row-actions"><button class="mini-button" data-edit-account="${account.id}" type="button">Edit</button><button class="mini-button danger" data-delete-account="${account.id}" type="button">Delete</button></span>` : ""}
      </span>
    </article>
  `;
}

function renderExpenses() {
  const selectedFilter = els.expenseFilter.value || "all";
  const expenses = userExpenses()
    .filter((expense) => selectedFilter === "all" || expense.accountId === selectedFilter)
    .sort((a, b) => b.date.localeCompare(a.date));

  els.recentExpenses.innerHTML = expenses.slice(0, 5).map(expenseRow).join("") || emptyHtml("Add an expense to begin tracking.");
  els.expenseHistory.innerHTML = expenses.map(expenseRow).join("") || emptyHtml("No expenses match this account.");
  document.querySelector("#expenseCategory").innerHTML = categories.map((category) => `<option>${category}</option>`).join("");
}

function expenseRow(expense) {
  const account = state.accounts.find((item) => item.id === expense.accountId);
  const currency = account?.currency || "USD";
  return `
    <article class="expense-row">
      <span class="account-icon">${categoryIcon(expense.category)}</span>
      <span>
        <span class="row-title">${escapeHtml(expense.category)}</span>
        <span class="row-meta">${escapeHtml(account?.name || "Deleted account")} · ${escapeHtml(expense.note || "No note")} · ${expense.date}</span>
      </span>
      <span class="row-value">${formatMoney(expense.amount, currency)}</span>
    </article>
  `;
}

function renderAnalytics() {
  const expenses = userExpenses();
  const mainCurrency = userAccounts()[0]?.currency || "USD";
  const totals = categoryTotals(expenses, mainCurrency);
  const max = Math.max(...totals.map((item) => item.total), 1);

  els.categoryBars.innerHTML = totals.length
    ? totals.map((item) => `
      <div class="bar-item">
        <div class="bar-label"><span>${item.category}</span><span>${formatMoney(item.total, mainCurrency)}</span></div>
        <div class="bar-line"><div class="bar-fill" style="width: ${(item.total / max) * 100}%"></div></div>
      </div>
    `).join("")
    : emptyHtml("No spending categories yet.");

  els.aiInsight.textContent = generateInsight(expenses, userAccounts());
}

function expenseAmountIn(expense, targetCurrency) {
  const account = state.accounts.find((item) => item.id === expense.accountId);
  return convertCurrency(expense.amount, account?.currency || targetCurrency, targetCurrency);
}

function categoryTotals(expenses, targetCurrency = userAccounts()[0]?.currency || "USD") {
  const totals = new Map();
  expenses.forEach((expense) => {
    totals.set(expense.category, (totals.get(expense.category) || 0) + expenseAmountIn(expense, targetCurrency));
  });
  return [...totals.entries()]
    .map(([category, total]) => ({ category, total }))
    .sort((a, b) => b.total - a.total);
}

function topCategoryFrom(expenses, targetCurrency) {
  return categoryTotals(expenses, targetCurrency)[0];
}

function generateInsight(expenses, accounts) {
  if (!accounts.length) return "Create a financial account first, then My Money can build useful spending insights from your transactions.";
  if (!expenses.length) return "Add a few expenses and the analytics area will identify your strongest spending category, monthly pace, and possible savings opportunities.";

  const totals = categoryTotals(expenses);
  const top = totals[0];
  const totalSpend = totals.reduce((sum, item) => sum + item.total, 0);
  const share = Math.round((top.total / totalSpend) * 100);
  const accountCount = accounts.length;
  const currency = accounts[0].currency;
  const balance = accounts.reduce((sum, account) => sum + Number(account.balance), 0);

  if (share >= 45) {
    return `${top.category} is taking ${share}% of tracked spending. Review the last few ${top.category.toLowerCase()} entries and set a weekly limit; your current tracked balance is ${formatMoney(balance, currency)} across ${accountCount} account${accountCount === 1 ? "" : "s"}.`;
  }

  return `Spending is spread across ${totals.length} categories, with ${top.category} currently highest at ${formatMoney(top.total, currency)}. Keep categorizing every transaction so the forecast becomes more accurate over time.`;
}

function categoryIcon(category) {
  const map = {
    Housing: "🏠",
    Food: "🍽️",
    Transport: "🚗",
    Utilities: "💡",
    Health: "🩺",
    Education: "🎓",
    Entertainment: "🎧",
    Debt: "🧾",
    Savings: "⭐",
    Other: "📌"
  };
  return map[category] || "📌";
}

function emptyHtml(text) {
  return `<div class="empty-state">${text}</div>`;
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function seedFirstAccount(userId) {
  state.accounts.push({
    id: uid("account"),
    userId,
    name: "Main wallet",
    type: "Cash",
    currency: "USD",
    balance: 0,
    icon: "💵"
  });
}

document.querySelectorAll("[data-auth-tab]").forEach((button) => {
  button.addEventListener("click", () => setAuthTab(button.dataset.authTab));
});

document.querySelector("#sendCodeButton").addEventListener("click", () => {
  verificationCode = String(Math.floor(100000 + Math.random() * 900000));
  showNotice(`Verification code: ${verificationCode}`);
});

document.querySelector("#resetCodeButton").addEventListener("click", () => {
  verificationCode = String(Math.floor(100000 + Math.random() * 900000));
  showNotice(`Password reset code: ${verificationCode}`);
});

document.querySelector("#signUpForm").addEventListener("submit", (event) => {
  event.preventDefault();
  const form = new FormData(event.currentTarget);
  const email = form.get("email").toLowerCase().trim();
  if (state.users.some((user) => user.email === email)) return showNotice("An account already exists for this email.");
  if (form.get("code") !== verificationCode) return showNotice("Enter the verification code that was sent.");

  const user = {
    id: uid("user"),
    name: form.get("name").trim(),
    email,
    password: form.get("password")
  };
  state.users.push(user);
  activeUserId = user.id;
  seedFirstAccount(user.id);
  saveState();
  event.currentTarget.reset();
  renderShell();
});

document.querySelector("#signInForm").addEventListener("submit", (event) => {
  event.preventDefault();
  const form = new FormData(event.currentTarget);
  const email = form.get("email").toLowerCase().trim();
  const user = state.users.find((item) => item.email === email && item.password === form.get("password"));
  if (!user) return showNotice("Email or password is incorrect.");
  activeUserId = user.id;
  saveState();
  renderShell();
});

document.querySelector("#resetForm").addEventListener("submit", (event) => {
  event.preventDefault();
  const form = new FormData(event.currentTarget);
  const user = state.users.find((item) => item.email === form.get("email").toLowerCase().trim());
  if (!user) return showNotice("No account exists for this email.");
  if (form.get("code") !== verificationCode) return showNotice("Enter the reset verification code.");
  user.password = form.get("password");
  saveState();
  event.currentTarget.reset();
  setAuthTab("signin");
  showNotice("Password changed. Sign in with the new password.");
});

document.querySelector("#signOutButton").addEventListener("click", () => {
  activeUserId = null;
  saveState();
  renderShell();
});

document.querySelectorAll(".nav-item").forEach((button) => {
  button.addEventListener("click", () => {
    activeView = button.dataset.view;
    renderAll();
  });
});

document.querySelector("#quickExpenseButton").addEventListener("click", () => {
  activeView = "expenses";
  renderAll();
});

document.querySelector("#newAccountShortcut").addEventListener("click", () => {
  activeView = "accounts";
  resetAccountForm();
  renderAll();
});

els.accountForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const form = new FormData(event.currentTarget);
  const id = form.get("id");
  const currency = normalizeCurrencyInput(form.get("currency"));
  if (!currencies.some((item) => item.code === currency)) return showNotice("Choose a currency from the search list.");
  const payload = {
    name: form.get("name").trim(),
    type: form.get("type"),
    currency,
    balance: Number(form.get("balance")),
    icon: form.get("icon")
  };

  if (id) {
    const account = state.accounts.find((item) => item.id === id && item.userId === activeUserId);
    Object.assign(account, payload);
  } else {
    state.accounts.push({ id: uid("account"), userId: activeUserId, ...payload });
  }

  saveState();
  resetAccountForm();
  renderAll();
  showNotice("Financial account saved.");
});

document.querySelector("#clearAccountForm").addEventListener("click", () => {
  resetAccountForm();
});

els.accountsList.addEventListener("click", (event) => {
  const editId = event.target.dataset.editAccount;
  const deleteId = event.target.dataset.deleteAccount;
  if (editId) {
    const account = state.accounts.find((item) => item.id === editId);
    els.accountForm.elements.id.value = account.id;
    els.accountForm.elements.name.value = account.name;
    els.accountForm.elements.type.value = account.type;
    els.accountForm.elements.currency.value = currencyInputValue(account.currency);
    els.accountForm.elements.balance.value = account.balance;
    els.accountForm.elements.icon.value = account.icon;
    els.accountFormTitle.textContent = "Edit financial account";
  }
  if (deleteId) {
    state.accounts = state.accounts.filter((item) => item.id !== deleteId);
    state.expenses = state.expenses.filter((item) => item.accountId !== deleteId);
    saveState();
    renderAll();
    showNotice("Account and related expenses deleted.");
  }
});

els.expenseForm.addEventListener("submit", (event) => {
  event.preventDefault();
  if (!userAccounts().length) return showNotice("Create an account before adding an expense.");
  const form = new FormData(event.currentTarget);
  const account = state.accounts.find((item) => item.id === form.get("accountId"));
  const amount = Number(form.get("amount"));

  state.expenses.push({
    id: uid("expense"),
    userId: activeUserId,
    accountId: account.id,
    category: form.get("category"),
    amount,
    date: form.get("date"),
    note: form.get("note").trim()
  });
  account.balance = Number(account.balance) - amount;
  saveState();
  event.currentTarget.reset();
  els.expenseForm.elements.date.valueAsDate = new Date();
  renderAll();
  showNotice("Expense tracked.");
});

els.expenseFilter.addEventListener("change", renderExpenses);
document.querySelector("#refreshInsight").addEventListener("click", renderAnalytics);

els.expenseForm.elements.date.valueAsDate = new Date();
renderCurrencyOptions();
renderShell();
loadExchangeRates();
