import "react-native-url-polyfill/auto";

import AsyncStorage from "@react-native-async-storage/async-storage";
import Constants from "expo-constants";
import { StatusBar } from "expo-status-bar";
import React, { useEffect, useMemo, useState } from "react";
import {
  Alert,
  Image,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View
} from "react-native";
import { createClient, SupabaseClient, User } from "@supabase/supabase-js";

declare const process: { env: Record<string, string | undefined> };

type ViewName = "dashboard" | "accounts" | "expenses" | "revenue" | "analytics" | "budget" | "settings";
type AuthMode = "signin" | "signup" | "reset" | "recover";

type Account = {
  id: string;
  userId: string;
  name: string;
  type: string;
  currency: string;
  balance: number;
  icon: string;
};

type Expense = {
  id: string;
  userId: string;
  accountId: string;
  category: string;
  amount: number;
  date: string;
  note: string;
};

type Revenue = {
  id: string;
  userId: string;
  accountId: string;
  source: string;
  amount: number;
  date: string;
  note: string;
};

type BudgetPeriod = "Daily" | "Weekly" | "Monthly" | "Yearly";

type Budget = {
  id: string;
  userId: string;
  name: string;
  amount: number;
  currency: string;
  accountIds: string[];
  startDate: string;
  period: BudgetPeriod;
};

type UserProfile = {
  userId: string;
  firstName: string;
  lastName: string;
  sex: string;
  birthDate: string;
  photoUri: string;
  defaultCurrency: string;
  language: string;
};

type LocalUser = {
  id: string;
  name: string;
  email: string;
  password: string;
};

type LocalState = {
  sessionUserId: string | null;
  users: LocalUser[];
  accounts: Account[];
  expenses: Expense[];
  revenues: Revenue[];
  budgets: Budget[];
  profiles: UserProfile[];
  expenseCategories: string[];
  revenueCategories: string[];
};

const STORAGE_KEY = "myMoneyExpoState";
const defaultExpenseCategories = ["Food & Drink", "Groceries", "Transport", "Home", "Bills & Fees", "Education", "Health care", "Shopping", "Travel", "Other"];
const defaultRevenueCategories = ["Salary", "Business", "Freelance", "Investment", "Gift", "Refund", "Other"];
const accountTypes = ["Cash", "Bank account", "Credit card", "Savings", "Investment", "Mobile money", "Loan", "Crypto wallet"];
const accountTypeIcons: Record<string, string> = {
  Cash: "CA",
  "Bank account": "BK",
  "Credit card": "CC",
  Savings: "SV",
  Investment: "IV",
  "Mobile money": "MM",
  Loan: "LN",
  "Crypto wallet": "CR"
};
const currencies = [
  "AED", "AFN", "ALL", "AMD", "ANG", "AOA", "ARS", "AUD", "AWG", "AZN", "BAM", "BBD", "BDT", "BGN", "BHD", "BIF",
  "BMD", "BND", "BOB", "BRL", "BSD", "BTN", "BWP", "BYN", "BZD", "CAD", "CDF", "CHF", "CLP", "CNY", "COP", "CRC",
  "CUP", "CVE", "CZK", "DJF", "DKK", "DOP", "DZD", "EGP", "ERN", "ETB", "EUR", "FJD", "FKP", "FOK", "GBP", "GEL",
  "GGP", "GHS", "GIP", "GMD", "GNF", "GTQ", "GYD", "HKD", "HNL", "HRK", "HTG", "HUF", "IDR", "ILS", "IMP", "INR",
  "IQD", "IRR", "ISK", "JEP", "JMD", "JOD", "JPY", "KES", "KGS", "KHR", "KID", "KMF", "KRW", "KWD", "KYD", "KZT",
  "LAK", "LBP", "LKR", "LRD", "LSL", "LYD", "MAD", "MDL", "MGA", "MKD", "MMK", "MNT", "MOP", "MRU", "MUR", "MVR",
  "MWK", "MXN", "MYR", "MZN", "NAD", "NGN", "NIO", "NOK", "NPR", "NZD", "OMR", "PAB", "PEN", "PGK", "PHP", "PKR",
  "PLN", "PYG", "QAR", "RON", "RSD", "RUB", "RWF", "SAR", "SBD", "SCR", "SDG", "SEK", "SGD", "SHP", "SLE", "SOS",
  "SRD", "SSP", "STN", "SYP", "SZL", "THB", "TJS", "TMT", "TND", "TOP", "TRY", "TTD", "TVD", "TWD", "TZS", "UAH",
  "UGX", "USD", "UYU", "UZS", "VES", "VND", "VUV", "WST", "XAF", "XCD", "XOF", "XPF", "YER", "ZAR", "ZMW", "ZWL"
];
const currencySearchTerms: Record<string, string> = {
  AED: "United Arab Emirates dirham UAE Dubai Abu Dhabi",
  AFN: "Afghanistan afghani",
  ALL: "Albania lek",
  AMD: "Armenia dram",
  ANG: "Curacao Sint Maarten Netherlands Antilles guilder",
  AOA: "Angola kwanza",
  ARS: "Argentina peso",
  AUD: "Australia Australian dollar Christmas Island Cocos Keeling Kiribati Nauru Norfolk Tuvalu",
  AWG: "Aruba florin",
  AZN: "Azerbaijan manat",
  BAM: "Bosnia Herzegovina convertible mark",
  BBD: "Barbados dollar",
  BDT: "Bangladesh taka",
  BGN: "Bulgaria lev",
  BHD: "Bahrain dinar",
  BIF: "Burundi franc",
  BMD: "Bermuda dollar",
  BND: "Brunei dollar",
  BOB: "Bolivia boliviano",
  BRL: "Brazil real",
  BSD: "Bahamas dollar",
  BTN: "Bhutan ngultrum",
  BWP: "Botswana pula",
  BYN: "Belarus ruble",
  BZD: "Belize dollar",
  CAD: "Canada Canadian dollar",
  CDF: "Congo DRC franc",
  CHF: "Switzerland Swiss franc Liechtenstein",
  CLP: "Chile peso",
  CNY: "China yuan renminbi",
  COP: "Colombia peso",
  CRC: "Costa Rica colon",
  CUP: "Cuba peso",
  CVE: "Cape Verde escudo",
  CZK: "Czech Republic Czechia koruna",
  DJF: "Djibouti franc",
  DKK: "Denmark krone Greenland Faroe Islands",
  DOP: "Dominican Republic peso",
  DZD: "Algeria dinar",
  EGP: "Egypt pound",
  ERN: "Eritrea nakfa",
  ETB: "Ethiopia birr",
  EUR: "Euro European Union Germany France Italy Spain Netherlands Belgium Portugal Ireland Austria Finland Greece Cyprus Estonia Latvia Lithuania Luxembourg Malta Slovakia Slovenia Croatia Andorra Monaco San Marino Vatican",
  FJD: "Fiji dollar",
  FKP: "Falkland Islands pound",
  FOK: "Faroe Islands krona",
  GBP: "United Kingdom pound sterling England Scotland Wales Northern Ireland",
  GEL: "Georgia lari",
  GGP: "Guernsey pound",
  GHS: "Ghana cedi",
  GIP: "Gibraltar pound",
  GMD: "Gambia dalasi",
  GNF: "Guinea franc",
  GTQ: "Guatemala quetzal",
  GYD: "Guyana dollar",
  HKD: "Hong Kong dollar",
  HNL: "Honduras lempira",
  HRK: "Croatia kuna",
  HTG: "Haiti gourde",
  HUF: "Hungary forint",
  IDR: "Indonesia rupiah",
  ILS: "Israel shekel Palestine",
  IMP: "Isle of Man pound",
  INR: "India rupee",
  IQD: "Iraq dinar",
  IRR: "Iran rial",
  ISK: "Iceland krona",
  JEP: "Jersey pound",
  JMD: "Jamaica dollar",
  JOD: "Jordan dinar",
  JPY: "Japan yen",
  KES: "Kenya shilling",
  KGS: "Kyrgyzstan som",
  KHR: "Cambodia riel",
  KID: "Kiribati dollar",
  KMF: "Comoros franc",
  KRW: "South Korea won",
  KWD: "Kuwait dinar",
  KYD: "Cayman Islands dollar",
  KZT: "Kazakhstan tenge",
  LAK: "Laos kip",
  LBP: "Lebanon pound",
  LKR: "Sri Lanka rupee",
  LRD: "Liberia dollar",
  LSL: "Lesotho loti",
  LYD: "Libya dinar",
  MAD: "Morocco dirham Western Sahara",
  MDL: "Moldova leu",
  MGA: "Madagascar ariary",
  MKD: "North Macedonia denar",
  MMK: "Myanmar Burma kyat",
  MNT: "Mongolia tugrik",
  MOP: "Macau pataca",
  MRU: "Mauritania ouguiya",
  MUR: "Mauritius rupee",
  MVR: "Maldives rufiyaa",
  MWK: "Malawi kwacha",
  MXN: "Mexico peso",
  MYR: "Malaysia ringgit",
  MZN: "Mozambique metical",
  NAD: "Namibia dollar",
  NGN: "Nigeria naira",
  NIO: "Nicaragua cordoba",
  NOK: "Norway krone Svalbard",
  NPR: "Nepal rupee",
  NZD: "New Zealand dollar Cook Islands Niue Tokelau Pitcairn",
  OMR: "Oman rial",
  PAB: "Panama balboa",
  PEN: "Peru sol",
  PGK: "Papua New Guinea kina",
  PHP: "Philippines peso",
  PKR: "Pakistan rupee",
  PLN: "Poland zloty",
  PYG: "Paraguay guarani",
  QAR: "Qatar riyal",
  RON: "Romania leu",
  RSD: "Serbia dinar",
  RUB: "Russia ruble",
  RWF: "Rwanda franc",
  SAR: "Saudi Arabia riyal",
  SBD: "Solomon Islands dollar",
  SCR: "Seychelles rupee",
  SDG: "Sudan pound",
  SEK: "Sweden krona",
  SGD: "Singapore dollar",
  SHP: "Saint Helena pound",
  SLE: "Sierra Leone leone",
  SOS: "Somalia shilling",
  SRD: "Suriname dollar",
  SSP: "South Sudan pound",
  STN: "Sao Tome and Principe dobra",
  SYP: "Syria pound",
  SZL: "Eswatini Swaziland lilangeni",
  THB: "Thailand baht",
  TJS: "Tajikistan somoni",
  TMT: "Turkmenistan manat",
  TND: "Tunisia dinar",
  TOP: "Tonga paanga",
  TRY: "Turkey Turkiye lira",
  TTD: "Trinidad and Tobago dollar",
  TVD: "Tuvalu dollar",
  TWD: "Taiwan dollar",
  TZS: "Tanzania shilling",
  UAH: "Ukraine hryvnia",
  UGX: "Uganda shilling",
  USD: "United States dollar USA America Ecuador El Salvador Panama Zimbabwe Puerto Rico Guam US Virgin Islands",
  UYU: "Uruguay peso",
  UZS: "Uzbekistan som",
  VES: "Venezuela bolivar",
  VND: "Vietnam dong",
  VUV: "Vanuatu vatu",
  WST: "Samoa tala",
  XAF: "Central African CFA franc Cameroon Central African Republic Chad Congo Equatorial Guinea Gabon",
  XCD: "East Caribbean dollar Antigua Barbuda Dominica Grenada Montserrat Saint Kitts Nevis Saint Lucia Saint Vincent Grenadines Anguilla",
  XOF: "West African CFA franc Benin Burkina Faso Guinea Bissau Ivory Coast Cote dIvoire Mali Niger Senegal Togo",
  XPF: "CFP franc French Polynesia New Caledonia Wallis Futuna",
  YER: "Yemen rial",
  ZAR: "South Africa rand Lesotho Namibia Eswatini",
  ZMW: "Zambia kwacha",
  ZWL: "Zimbabwe dollar"
};
const currencyLabels = Object.fromEntries(
  currencies.map((code) => [code, `${code} - ${currencyDisplayName(code)}`])
);
const appLanguages = ["English", "French", "Swahili"];
const sexes = ["Prefer not to say", "Female", "Male", "Other"];
const budgetPeriods: BudgetPeriod[] = ["Daily", "Weekly", "Monthly", "Yearly"];
const analyticsRanges = ["7", "30", "90", "365"];
const reportRanges = ["30", "90", "365", "730"];

const iconAssets = {
  dashboard: require("./Icons/Dashboard_tab_icon/dashboard.png"),
  accounts: require("./Icons/Accounts_tab_icon/bank.png"),
  expenses: require("./Icons/Expenses_tab_icon/money-transaction.png"),
  revenue: require("./Icons/Revenue_tab_icon/revenue.png"),
  analytics: require("./Icons/Analytics_tab_icon/bar-chart.png"),
  budget: require("./Icons/My_money_icon/dollar.png"),
  settings: require("./Icons/Settings_icon/setting.png"),
  profile: require("./Icons/Profile_icon/user.png"),
  cash: require("./Icons/Cash_type_icon/money.png"),
  bank: require("./Icons/bank_account_type_icon/bank.png"),
  card: require("./Icons/Credit_card_type_icon/credit-card.png"),
  savings: require("./Icons/savings_type_icon/piggy-bank.png"),
  investment: require("./Icons/investment_type_icon/investment.png"),
  mobile: require("./Icons/Mobile_Money_type_icon/mobile-banking.png"),
  loan: require("./Icons/Loan_type_icon/signing.png"),
  crypto: require("./Icons/crypto_wallet_type_icon/wallet.png")
};
const expenseCategoryIcons: Record<string, any> = {
  "Food & Drink": require("./Icons/Expenses Categories/Food & Drink/cutlery.png"),
  Groceries: require("./Icons/Expenses Categories/Groceries_icon/grocery-cart.png"),
  Transport: require("./Icons/Expenses Categories/transport_icon/transportation.png"),
  Home: require("./Icons/Expenses Categories/Home_icon/home.png"),
  "Bills & Fees": require("./Icons/Expenses Categories/Bills_&_Fees_Icon/bill.png"),
  Education: require("./Icons/Expenses Categories/education_icon/graduation.png"),
  "Health care": require("./Icons/Expenses Categories/health_care_icon/first-aid-bag-outline.png"),
  Shopping: require("./Icons/Expenses Categories/shopping_icon/online-shopping.png"),
  Travel: require("./Icons/Expenses Categories/Travel_icon/travel.png"),
  Beauty: require("./Icons/Expenses Categories/Beauty_icon/skin-care.png"),
  Business: require("./Icons/Expenses Categories/Business_icon/owner.png"),
  Car: require("./Icons/Expenses Categories/Car_Icon/car.png"),
  Entertainment: require("./Icons/Expenses Categories/Entertainment/cinema.png"),
  "Family & Personal": require("./Icons/Expenses Categories/Family_&_Personal/family-of-four-with-two-minors-and-two-adults.png"),
  Gift: require("./Icons/Expenses Categories/Gift_icon/gift-box-with-a-bow.png"),
  "Internet & Airtime": require("./Icons/Expenses Categories/Internet_&_Airtimes_Icon/signal.png"),
  "Sport & Hobbies": require("./Icons/Expenses Categories/Sport_&_Hobbies_icon/running.png"),
  Subscriptions: require("./Icons/Expenses Categories/Subscriptions_Icon/subscribe.png"),
  Other: require("./Icons/Expenses Categories/Others_icons/cash-in.png")
};
const revenueCategoryIcons: Record<string, any> = {
  Salary: require("./Icons/Revenue Categories/Salary_icon/wages.png"),
  Business: require("./Icons/Revenue Categories/Business_icon/owner.png"),
  Freelance: require("./Icons/Revenue Categories/extra_icome_icon/income.png"),
  Investment: require("./Icons/investment_type_icon/investment.png"),
  Gift: require("./Icons/Revenue Categories/Gift_icon/gift.png"),
  Refund: require("./Icons/Revenue Categories/Others_icons/cash-in.png"),
  Insurance: require("./Icons/Revenue Categories/Insurance_icon/shield.png"),
  Loans: require("./Icons/Revenue Categories/Loans_Icons/mortgage-loan.png"),
  "Parental leave": require("./Icons/Revenue Categories/parental_leave_icon/parental-control.png"),
  Other: require("./Icons/Revenue Categories/Others_icons/cash-in.png")
};

const cleanEnvValue = (value: string | undefined) => {
  const trimmed = value?.trim() || "";
  return trimmed.startsWith("$") || trimmed.includes("your-project") ? "" : trimmed;
};

const isValidSupabaseUrl = (value: string) => {
  try {
    const url = new URL(value);
    return url.protocol === "https:" && url.hostname.endsWith(".supabase.co");
  } catch {
    return false;
  }
};

const supabaseUrl = cleanEnvValue(
  process.env.EXPO_PUBLIC_SUPABASE_URL || (Constants.expoConfig?.extra?.supabaseUrl as string | undefined)
);
const supabaseAnonKey = cleanEnvValue(
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || (Constants.expoConfig?.extra?.supabaseAnonKey as string | undefined)
);
const supabase: SupabaseClient | null =
  isValidSupabaseUrl(supabaseUrl) && supabaseAnonKey
    ? createClient(supabaseUrl, supabaseAnonKey, {
        auth: {
          storage: AsyncStorage,
          autoRefreshToken: true,
          persistSession: true,
          detectSessionInUrl: Platform.OS === "web"
        }
      })
    : null;

const blankLocalState: LocalState = {
  sessionUserId: null,
  users: [],
  accounts: [],
  expenses: [],
  revenues: [],
  budgets: [],
  profiles: [],
  expenseCategories: defaultExpenseCategories,
  revenueCategories: defaultRevenueCategories
};

const newId = (prefix: string) => `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
const today = () => new Date().toISOString().slice(0, 10);

export default function App() {
  const { width } = useWindowDimensions();
  const compact = width < 860;
  const phone = width < 540;
  const [booting, setBooting] = useState(true);
  const [notice, setNotice] = useState("");
  const [authMode, setAuthMode] = useState<AuthMode>("signin");
  const [authBusy, setAuthBusy] = useState(false);
  const [activeView, setActiveView] = useState<ViewName>("dashboard");
  const [user, setUser] = useState<User | LocalUser | null>(null);
  const [localState, setLocalState] = useState<LocalState>(blankLocalState);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [revenues, setRevenues] = useState<Revenue[]>([]);
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [editingAccountId, setEditingAccountId] = useState<string | null>(null);
  const [editingBudgetId, setEditingBudgetId] = useState<string | null>(null);
  const [selectedBudgetId, setSelectedBudgetId] = useState<string | null>(null);
  const [budgetMode, setBudgetMode] = useState<"list" | "form" | "detail">("list");
  const [openSelect, setOpenSelect] = useState<string | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [settingsTab, setSettingsTab] = useState<"account" | "categories" | "app">("account");

  const [authForm, setAuthForm] = useState({ name: "", email: "", password: "", confirmPassword: "" });
  const [accountForm, setAccountForm] = useState({
    name: "Main wallet",
    type: "Cash",
    currency: "USD",
    balance: "0",
    icon: accountTypeIcons.Cash
  });
  const [expenseForm, setExpenseForm] = useState({
    accountId: "",
    category: "Food",
    amount: "",
    date: today(),
    note: ""
  });
  const [expenseFilter, setExpenseFilter] = useState("all");
  const [revenueForm, setRevenueForm] = useState({
    accountId: "",
    source: "Salary",
    amount: "",
    date: today(),
    note: ""
  });
  const [revenueFilter, setRevenueFilter] = useState("all");
  const [budgetForm, setBudgetForm] = useState({
    name: "Monthly budget",
    amount: "",
    currency: "USD",
    accountIds: [] as string[],
    startDate: today(),
    period: "Monthly" as BudgetPeriod
  });
  const [settingsForm, setSettingsForm] = useState({
    defaultCurrency: "USD",
    defaultView: "dashboard",
    compactSummary: "On",
    language: "English"
  });
  const [profileForm, setProfileForm] = useState({
    firstName: "",
    lastName: "",
    sex: "Prefer not to say",
    birthDate: "",
    photoUri: ""
  });
  const [expenseCategories, setExpenseCategories] = useState(defaultExpenseCategories);
  const [revenueCategoriesState, setRevenueCategoriesState] = useState(defaultRevenueCategories);
  const [categoryDraft, setCategoryDraft] = useState("");
  const [categoryKind, setCategoryKind] = useState<"expense" | "revenue">("expense");
  const [analyticsRange, setAnalyticsRange] = useState("30");
  const [reportRange, setReportRange] = useState("30");
  const [exchangeRates, setExchangeRates] = useState<Record<string, number>>({});
  const [exchangeDate, setExchangeDate] = useState("");

  useEffect(() => {
    void bootstrap();
  }, []);

  useEffect(() => {
    if (notice) {
      const timer = setTimeout(() => setNotice(""), 3800);
      return () => clearTimeout(timer);
    }
  }, [notice]);

  useEffect(() => {
    if (!expenseForm.accountId && accounts[0]) {
      setExpenseForm((current) => ({ ...current, accountId: accounts[0].id }));
    }
    if (!revenueForm.accountId && accounts[0]) {
      setRevenueForm((current) => ({ ...current, accountId: accounts[0].id }));
    }
  }, [accounts, expenseForm.accountId, revenueForm.accountId]);

  useEffect(() => {
    void loadExchangeRates(settingsForm.defaultCurrency);
  }, [settingsForm.defaultCurrency]);

  const mainCurrency = settingsForm.defaultCurrency || accounts[0]?.currency || "USD";
  const activityCurrency = accounts[0]?.currency || "USD";
  const convertAmount = (amount: number, fromCurrency = mainCurrency) => {
    if (fromCurrency === mainCurrency) return Number(amount || 0);
    if (fromCurrency === "EUR") return Number(amount || 0) * (exchangeRates[mainCurrency] || 1);
    const fromRate = exchangeRates[fromCurrency];
    const toRate = exchangeRates[mainCurrency];
    if (!fromRate || !toRate) return Number(amount || 0);
    return (Number(amount || 0) / fromRate) * toRate;
  };
  const reportStart = useMemo(() => daysAgo(Number(reportRange)), [reportRange]);
  const metrics = useMemo(() => {
    const month = new Date().toISOString().slice(0, 7);
    const inReportRange = (date: string) => new Date(`${date}T00:00:00`) >= reportStart;
    const monthSpend = expenses
      .filter((expense) => expense.date.slice(0, 7) === month)
      .reduce((sum, expense) => sum + expense.amount, 0);
    const monthRevenue = revenues
      .filter((revenue) => revenue.date.slice(0, 7) === month)
      .reduce((sum, revenue) => sum + revenue.amount, 0);
    const periodSpend = expenses
      .filter((expense) => inReportRange(expense.date))
      .reduce((sum, expense) => sum + expense.amount, 0);
    const periodRevenue = revenues
      .filter((revenue) => inReportRange(revenue.date))
      .reduce((sum, revenue) => sum + revenue.amount, 0);
    const totalBalance = accounts.reduce((sum, account) => sum + convertAmount(account.balance, account.currency), 0);
    const liabilities = accounts.reduce((sum, account) => {
      const balance = Number(account.balance || 0);
      return sum + (account.type === "Credit card" ? Math.abs(balance) : Math.max(0, -balance));
    }, 0);
    return { totalBalance, monthSpend, monthRevenue, periodSpend, periodRevenue, netFlow: monthRevenue - monthSpend, liabilities };
  }, [accounts, expenses, revenues, mainCurrency, exchangeRates, reportStart]);

  const categoryTotals = useMemo(() => {
    const totals = new Map<string, number>();
    expenses.forEach((expense) => totals.set(expense.category, (totals.get(expense.category) || 0) + expense.amount));
    return Array.from(totals.entries())
      .map(([category, total]) => ({ category, total }))
      .sort((a, b) => b.total - a.total);
  }, [expenses]);

  async function loadExchangeRates(targetCurrency: string) {
    try {
      const response = await fetch("https://api.frankfurter.dev/v1/latest");
      const data = await response.json();
      const rates = { EUR: 1, ...(data.rates || {}) };
      setExchangeRates(rates);
      setExchangeDate(data.date || "");
      if (targetCurrency && !rates[targetCurrency] && targetCurrency !== "EUR") {
        setNotice(`${targetCurrency} conversion is not available from the rate provider yet.`);
      }
    } catch {
      setExchangeRates({});
      setExchangeDate("");
    }
  }

  async function bootstrap() {
    try {
      const stored = await AsyncStorage.getItem(STORAGE_KEY);
      const parsed: LocalState = stored ? { ...blankLocalState, ...JSON.parse(stored) } : blankLocalState;
      setLocalState(parsed);
      setExpenseCategories(parsed.expenseCategories?.length ? parsed.expenseCategories : defaultExpenseCategories);
      setRevenueCategoriesState(parsed.revenueCategories?.length ? parsed.revenueCategories : defaultRevenueCategories);
      if (supabase) {
        const { data } = await supabase.auth.getSession();
        if (data.session?.user) {
          setUser(data.session.user);
          applyLocalUserPreferences(parsed, data.session.user.id, data.session.user.email || "");
          await loadRemoteData(data.session.user.id);
        }
        supabase.auth.onAuthStateChange(async (event, session) => {
          if (event === "PASSWORD_RECOVERY") {
            setAuthMode("recover");
            setNotice("Choose a new password.");
            setUser(null);
            return;
          }

          setUser(session?.user || null);
          if (session?.user) {
            applyLocalUserPreferences(parsed, session.user.id, session.user.email || "");
            await loadRemoteData(session.user.id);
          }
          else {
            setAccounts([]);
            setExpenses([]);
            setRevenues([]);
            setBudgets([]);
          }
        });
      } else {
        const active = parsed.users.find((item) => item.id === parsed.sessionUserId) || null;
        setUser(active);
        if (active) {
          setAccounts(parsed.accounts.filter((account) => account.userId === active.id));
          setExpenses(parsed.expenses.filter((expense) => expense.userId === active.id));
          setRevenues(parsed.revenues.filter((revenue) => revenue.userId === active.id));
          applyLocalUserPreferences(parsed, active.id, active.email);
        }
      }
    } catch {
      setNotice("The app could not load saved data.");
    } finally {
      setBooting(false);
    }
  }

  async function persistLocal(next: LocalState) {
    setLocalState(next);
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  }

  function applyLocalUserPreferences(state: LocalState, userId: string, email: string) {
    const nameParts = displayNameFromUser({ id: userId, email } as User | LocalUser).split(" ");
    const profile = state.profiles.find((item) => item.userId === userId) || {
      userId,
      firstName: nameParts[0] || "",
      lastName: nameParts.slice(1).join(" "),
      sex: "Prefer not to say",
      birthDate: "",
      photoUri: "",
      defaultCurrency: "USD",
      language: "English"
    };
    setBudgets(state.budgets.filter((budget) => budget.userId === userId));
    setProfileForm({
      firstName: profile.firstName,
      lastName: profile.lastName,
      sex: profile.sex,
      birthDate: profile.birthDate,
      photoUri: profile.photoUri
    });
    setSettingsForm((current) => ({
      ...current,
      defaultCurrency: profile.defaultCurrency || current.defaultCurrency,
      language: profile.language || current.language
    }));
  }

  async function loadRemoteData(userId: string) {
    if (!supabase) return;
    const [{ data: accountRows, error: accountError }, { data: expenseRows, error: expenseError }, { data: revenueRows, error: revenueError }] = await Promise.all([
      supabase.from("accounts").select("*").eq("user_id", userId).order("created_at", { ascending: true }),
      supabase.from("expenses").select("*").eq("user_id", userId).order("date", { ascending: false }),
      supabase.from("revenues").select("*").eq("user_id", userId).order("date", { ascending: false })
    ]);
    if (accountError || expenseError || revenueError) {
      setNotice("Supabase data could not be loaded. Check the schema in supabase/schema.sql.");
      return;
    }
    setAccounts((accountRows || []).map(accountFromRow));
    setExpenses((expenseRows || []).map(expenseFromRow));
    setRevenues((revenueRows || []).map(revenueFromRow));
  }

  async function handleAuth() {
    if (authBusy) return;
    const email = authForm.email.trim().toLowerCase();
    const password = authForm.password;
    const validationMessage = validateAuthForm(email, password);
    if (validationMessage) return setNotice(validationMessage);

    setAuthBusy(true);
    try {
      if (supabase) {
        if (authMode === "recover") {
          const { error } = await supabase.auth.updateUser({ password });
          if (error) throw error;
          await supabase.auth.signOut();
          setAuthForm((current) => ({ ...current, password: "", confirmPassword: "" }));
          setAuthMode("signin");
          setNotice("Password updated. Sign in with your new password.");
        } else if (authMode === "signup") {
          const { data, error } = await supabase.auth.signUp({
            email,
            password,
            options: {
              data: { full_name: authForm.name.trim() },
              emailRedirectTo: getAuthRedirectUrl()
            }
          });
          if (error) throw error;
          if (data.user && data.session) await ensureFirstRemoteAccount(data.user.id);
          setNotice(data.session ? "Account created." : "Check your email to confirm your Supabase account.");
        } else if (authMode === "signin") {
          const { data, error } = await supabase.auth.signInWithPassword({ email, password });
          if (error) throw error;
          if (data.user) {
            await ensureFirstRemoteAccount(data.user.id);
            await loadRemoteData(data.user.id);
          }
          setNotice("Signed in.");
        } else {
          const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: getAuthRedirectUrl() });
          if (error) throw error;
          setNotice("Password reset email sent.");
        }
      } else {
        await handleLocalAuth(email, password);
      }
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Authentication failed.");
    } finally {
      setAuthBusy(false);
    }
  }

  async function handleLocalAuth(email: string, password: string) {
    if (authMode === "reset") {
      setNotice("Supabase is required for email password reset. Add .env values to enable it.");
      return;
    }
    if (authMode === "signup") {
      if (localState.users.some((item) => item.email === email)) return setNotice("An account already exists for this email.");
      const localUser = { id: newId("user"), name: authForm.name.trim(), email, password };
      const firstAccount = seedAccount(localUser.id);
      const [firstName, ...restName] = localUser.name.split(" ");
      const next = {
        ...localState,
        sessionUserId: localUser.id,
        users: [...localState.users, localUser],
        accounts: [...localState.accounts, firstAccount],
        profiles: [
          ...localState.profiles,
          {
            userId: localUser.id,
            firstName,
            lastName: restName.join(" "),
            sex: "Prefer not to say",
            birthDate: "",
            photoUri: "",
            defaultCurrency: "USD",
            language: "English"
          }
        ]
      };
      await persistLocal(next);
      setUser(localUser);
      setAccounts([firstAccount]);
      setExpenses([]);
      setRevenues([]);
      setNotice("Local demo account created.");
      return;
    }
    const localUser = localState.users.find((item) => item.email === email && item.password === password);
    if (!localUser) return setNotice("Email or password is incorrect.");
    const next = { ...localState, sessionUserId: localUser.id };
    await persistLocal(next);
    setUser(localUser);
    setAccounts(next.accounts.filter((account) => account.userId === localUser.id));
    setExpenses(next.expenses.filter((expense) => expense.userId === localUser.id));
    setRevenues(next.revenues.filter((revenue) => revenue.userId === localUser.id));
    applyLocalUserPreferences(next, localUser.id, localUser.email);
    setNotice("Signed in locally.");
  }

  function validateAuthForm(email: string, password: string) {
    if (authMode === "recover") {
      if (password.length < 8) return "Password must be at least 8 characters.";
      if (password !== authForm.confirmPassword) return "Passwords do not match.";
      return "";
    }
    if (!email) return "Enter your email address.";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return "Enter a valid email address.";
    if (authMode === "reset") return "";
    if (password.length < 8) return "Password must be at least 8 characters.";
    if (authMode === "signup") {
      if (!authForm.name.trim()) return "Enter your full name.";
      if (password !== authForm.confirmPassword) return "Passwords do not match.";
    }
    return "";
  }

  async function signOut() {
    if (supabase) {
      await supabase.auth.signOut();
    } else {
      await persistLocal({ ...localState, sessionUserId: null });
    }
    setUser(null);
    setAccounts([]);
    setExpenses([]);
    setRevenues([]);
    setBudgets([]);
    setMenuOpen(false);
    setActiveView("dashboard");
  }

  async function saveAccount() {
    if (!user) return;
    const payload = {
      name: accountForm.name.trim(),
      type: accountForm.type,
      currency: accountForm.currency.trim().toUpperCase().slice(0, 3),
      balance: Number(accountForm.balance || 0),
      icon: iconForAccountType(accountForm.type)
    };
    if (!payload.name) return setNotice("Account name is required.");
    if (!currencies.includes(payload.currency)) return setNotice("Choose a supported currency.");

    if (supabase) {
      if (editingAccountId) {
        const { error } = await supabase.from("accounts").update(accountToRow(payload)).eq("id", editingAccountId);
        if (error) return setNotice(error.message);
      } else {
        const { error } = await supabase.from("accounts").insert(accountToRow({ ...payload, userId: user.id }));
        if (error) return setNotice(error.message);
      }
      await loadRemoteData(user.id);
    } else {
      const userId = user.id;
      const nextAccount: Account = editingAccountId
        ? ({ id: editingAccountId, userId, ...payload } as Account)
        : ({ id: newId("account"), userId, ...payload } as Account);
      const nextAccounts = editingAccountId
        ? localState.accounts.map((account) => (account.id === editingAccountId ? nextAccount : account))
        : [...localState.accounts, nextAccount];
      const next = { ...localState, accounts: nextAccounts };
      await persistLocal(next);
      setAccounts(nextAccounts.filter((account) => account.userId === userId));
    }
    resetAccountForm();
    setNotice("Financial account saved.");
  }

  async function deleteAccount(id: string) {
    if (!user) return;
    const proceed = await confirmDelete();
    if (!proceed) return;
    if (supabase) {
      const { error } = await supabase.from("accounts").delete().eq("id", id);
      if (error) return setNotice(error.message);
      await loadRemoteData(user.id);
    } else {
      const next = {
        ...localState,
        accounts: localState.accounts.filter((account) => account.id !== id),
        expenses: localState.expenses.filter((expense) => expense.accountId !== id),
        revenues: localState.revenues.filter((revenue) => revenue.accountId !== id)
      };
      await persistLocal(next);
      setAccounts(next.accounts.filter((account) => account.userId === user.id));
      setExpenses(next.expenses.filter((expense) => expense.userId === user.id));
      setRevenues(next.revenues.filter((revenue) => revenue.userId === user.id));
    }
    setNotice("Account deleted.");
  }

  async function addExpense() {
    if (!user) return;
    const account = accounts.find((item) => item.id === expenseForm.accountId);
    const amount = Number(expenseForm.amount || 0);
    if (!account) return setNotice("Create or select an account first.");
    if (amount <= 0) return setNotice("Enter a positive expense amount.");
    const expense: Expense = {
      id: newId("expense"),
      userId: user.id,
      accountId: account.id,
      category: expenseForm.category,
      amount,
      date: expenseForm.date || today(),
      note: expenseForm.note.trim()
    };
    const updatedAccount = { ...account, balance: Number(account.balance) - amount };

    if (supabase) {
      const { error: expenseError } = await supabase.from("expenses").insert(expenseToRow(expense));
      if (expenseError) return setNotice(expenseError.message);
      const { error: accountError } = await supabase.from("accounts").update({ balance: updatedAccount.balance }).eq("id", account.id);
      if (accountError) return setNotice(accountError.message);
      await loadRemoteData(user.id);
    } else {
      const next = {
        ...localState,
        expenses: [...localState.expenses, expense],
        accounts: localState.accounts.map((item) => (item.id === account.id ? updatedAccount : item))
      };
      await persistLocal(next);
      setAccounts(next.accounts.filter((item) => item.userId === user.id));
      setExpenses(next.expenses.filter((item) => item.userId === user.id));
    }
    setExpenseForm((current) => ({ ...current, amount: "", note: "", date: today() }));
    setNotice("Expense tracked.");
  }

  async function addRevenue() {
    if (!user) return;
    const account = accounts.find((item) => item.id === revenueForm.accountId);
    const amount = Number(revenueForm.amount || 0);
    if (!account) return setNotice("Create or select an account first.");
    if (amount <= 0) return setNotice("Enter a positive revenue amount.");
    const revenue: Revenue = {
      id: newId("revenue"),
      userId: user.id,
      accountId: account.id,
      source: revenueForm.source,
      amount,
      date: revenueForm.date || today(),
      note: revenueForm.note.trim()
    };
    const updatedAccount = { ...account, balance: Number(account.balance) + amount };

    if (supabase) {
      const { error: revenueError } = await supabase.from("revenues").insert(revenueToRow(revenue));
      if (revenueError) return setNotice(revenueError.message);
      const { error: accountError } = await supabase.from("accounts").update({ balance: updatedAccount.balance }).eq("id", account.id);
      if (accountError) return setNotice(accountError.message);
      await loadRemoteData(user.id);
    } else {
      const next = {
        ...localState,
        revenues: [...localState.revenues, revenue],
        accounts: localState.accounts.map((item) => (item.id === account.id ? updatedAccount : item))
      };
      await persistLocal(next);
      setAccounts(next.accounts.filter((item) => item.userId === user.id));
      setRevenues(next.revenues.filter((item) => item.userId === user.id));
    }
    setRevenueForm((current) => ({ ...current, amount: "", note: "", date: today() }));
    setNotice("Revenue tracked.");
  }

  function saveSettings() {
    if (!user) return;
    const profile: UserProfile = {
      userId: user.id,
      firstName: profileForm.firstName.trim(),
      lastName: profileForm.lastName.trim(),
      sex: profileForm.sex,
      birthDate: profileForm.birthDate,
      photoUri: profileForm.photoUri.trim(),
      defaultCurrency: settingsForm.defaultCurrency.toUpperCase(),
      language: settingsForm.language
    };
    const next = {
      ...localState,
      profiles: [...localState.profiles.filter((item) => item.userId !== user.id), profile],
      expenseCategories,
      revenueCategories: revenueCategoriesState
    };
    void persistLocal(next);
    setSettingsForm((current) => ({ ...current, defaultCurrency: current.defaultCurrency.toUpperCase() }));
    setNotice("Settings updated.");
  }

  async function saveBudget() {
    if (!user) return;
    const amount = Number(budgetForm.amount || 0);
    if (!budgetForm.name.trim()) return setNotice("Budget name is required.");
    if (amount <= 0) return setNotice("Enter a positive budget amount.");
    if (!budgetForm.accountIds.length) return setNotice("Choose at least one account for this budget.");
    const budget: Budget = {
      id: editingBudgetId || newId("budget"),
      userId: user.id,
      name: budgetForm.name.trim(),
      amount,
      currency: budgetForm.currency,
      accountIds: budgetForm.accountIds,
      startDate: budgetForm.startDate || today(),
      period: budgetForm.period
    };
    const nextBudgets = editingBudgetId ? budgets.map((item) => (item.id === editingBudgetId ? budget : item)) : [...budgets, budget];
    const next = {
      ...localState,
      budgets: [...localState.budgets.filter((item) => item.userId !== user.id), ...nextBudgets]
    };
    await persistLocal(next);
    setBudgets(nextBudgets);
    setSelectedBudgetId(budget.id);
    setEditingBudgetId(null);
    setBudgetMode("detail");
    setNotice("Budget saved.");
  }

  async function deleteBudget(id: string) {
    if (!user) return;
    const nextBudgets = budgets.filter((budget) => budget.id !== id);
    const next = { ...localState, budgets: [...localState.budgets.filter((budget) => budget.userId !== user.id), ...nextBudgets] };
    await persistLocal(next);
    setBudgets(nextBudgets);
    setSelectedBudgetId(null);
    setBudgetMode("list");
    setNotice("Budget deleted.");
  }

  function editBudget(budget: Budget) {
    setEditingBudgetId(budget.id);
    setBudgetForm({
      name: budget.name,
      amount: String(budget.amount),
      currency: budget.currency,
      accountIds: budget.accountIds,
      startDate: budget.startDate,
      period: budget.period
    });
    setBudgetMode("form");
  }

  function resetBudgetForm() {
    setEditingBudgetId(null);
    setBudgetForm({ name: "Monthly budget", amount: "", currency: mainCurrency, accountIds: accounts.map((account) => account.id), startDate: today(), period: "Monthly" });
    setBudgetMode("form");
    setActiveView("budget");
  }

  function addCategory() {
    const name = categoryDraft.trim();
    if (!name) return;
    if (categoryKind === "expense" && !expenseCategories.includes(name)) setExpenseCategories((current) => [...current, name]);
    if (categoryKind === "revenue" && !revenueCategoriesState.includes(name)) setRevenueCategoriesState((current) => [...current, name]);
    setCategoryDraft("");
  }

  function removeCategory(kind: "expense" | "revenue", name: string) {
    if (kind === "expense") setExpenseCategories((current) => current.filter((item) => item !== name));
    else setRevenueCategoriesState((current) => current.filter((item) => item !== name));
  }

  function editAccount(account: Account) {
    setEditingAccountId(account.id);
    setAccountForm({
      name: account.name,
      type: account.type,
      currency: account.currency,
      balance: String(account.balance),
      icon: iconForAccountType(account.type)
    });
    setActiveView("accounts");
  }

  function resetAccountForm() {
    setEditingAccountId(null);
    setAccountForm({ name: "", type: "Cash", currency: settingsForm.defaultCurrency || mainCurrency, balance: "0", icon: iconForAccountType("Cash") });
  }

  const filteredExpenses = expenses
    .filter((expense) => expenseFilter === "all" || expense.accountId === expenseFilter)
    .sort((a, b) => b.date.localeCompare(a.date));
  const filteredRevenues = revenues
    .filter((revenue) => revenueFilter === "all" || revenue.accountId === revenueFilter)
    .sort((a, b) => b.date.localeCompare(a.date));

  if (booting) {
    return (
      <SafeAreaView style={styles.loading}>
        <Text style={styles.loadingText}>Loading My Money...</Text>
      </SafeAreaView>
    );
  }

  if (!user) {
    return (
      <SafeAreaView style={styles.root}>
        <StatusBar style="dark" />
        <ScrollView contentContainerStyle={[styles.authShell, phone && styles.authShellPhone]}>
          <View style={styles.brandBlock}>
            <View style={styles.brandMark}>
              <Text style={styles.brandMarkText}>M</Text>
            </View>
            <View style={styles.brandCopy}>
              <Text style={styles.heroTitle}>My Money</Text>
              <Text style={styles.heroText}>Personal accounts, spending analytics, and everyday accounting across web, iOS, and Android.</Text>
            </View>
          </View>
          <View style={styles.authCard}>
            {authMode !== "recover" && (
              <View style={styles.tabs}>
                {(["signin", "signup"] as AuthMode[]).map((mode) => (
                  <TabButton key={mode} active={authMode === mode} label={modeLabel(mode)} onPress={() => setAuthMode(mode)} />
                ))}
              </View>
            )}
            <Notice text={notice} />
            {authMode === "signup" && (
              <Field
                label="Full name"
                value={authForm.name}
                onChangeText={(name: string) => setAuthForm((current) => ({ ...current, name }))}
                autoComplete="name"
              />
            )}
            {authMode !== "recover" && (
              <Field
                label="Email"
                value={authForm.email}
                onChangeText={(email: string) => setAuthForm((current) => ({ ...current, email }))}
                keyboardType="email-address"
                autoCapitalize="none"
                autoComplete="email"
                textContentType="emailAddress"
              />
            )}
            {authMode !== "reset" && (
              <Field
                label="Password"
                value={authForm.password}
                onChangeText={(password: string) => setAuthForm((current) => ({ ...current, password }))}
                secureTextEntry
                autoComplete={authMode === "signin" ? "current-password" : "new-password"}
                textContentType={authMode === "signin" ? "password" : "newPassword"}
                onSubmitEditing={handleAuth}
              />
            )}
            {(authMode === "signup" || authMode === "recover") && (
              <Field
                label="Confirm password"
                value={authForm.confirmPassword}
                onChangeText={(confirmPassword: string) => setAuthForm((current) => ({ ...current, confirmPassword }))}
                secureTextEntry
                autoComplete="new-password"
                textContentType="newPassword"
                onSubmitEditing={handleAuth}
              />
            )}
            {(authMode === "signup" || authMode === "recover") && <Text style={styles.passwordHint}>Use at least 8 characters.</Text>}
            <PrimaryButton label={authButtonLabel(authMode, authBusy)} onPress={handleAuth} disabled={authBusy} />
            <View style={styles.authSwitchRow}>
              <Pressable onPress={() => setAuthMode(authMode === "signin" ? "signup" : "signin")}>
                <Text style={styles.authSwitchLink}>{authMode === "signin" ? "Create account" : "Sign in"}</Text>
              </Pressable>
            </View>
            {authMode === "signin" && (
              <Pressable onPress={() => setAuthMode("reset")}>
                <Text style={styles.forgotLink}>Forgot your password?</Text>
              </Pressable>
            )}
          </View>
        </ScrollView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.root}>
      <StatusBar style="light" />
      <View style={[styles.workspace, compact && styles.workspaceCompact]}>
        {!compact && (
          <SideNav activeView={activeView} setActiveView={setActiveView} signOut={signOut} />
        )}
        <ScrollView style={styles.content} contentContainerStyle={[styles.contentInner, phone && styles.contentInnerPhone]}>
          <View style={[styles.topBar, phone && styles.topBarPhone]}>
            <View>
              <Text style={styles.eyebrow}>{new Intl.DateTimeFormat(undefined, { dateStyle: "full" }).format(new Date())}</Text>
              <Text style={styles.screenTitle}>{titleFor(activeView)}</Text>
            </View>
            <View style={styles.headerActions}>
              <Pressable onPress={() => { setActiveView("settings"); setSettingsTab("account"); }} style={styles.profileButton}>
                <Image source={profileForm.photoUri ? { uri: profileForm.photoUri } : iconAssets.profile} style={styles.profileImage} />
              </Pressable>
              <Pressable onPress={() => setMenuOpen((current) => !current)} style={styles.moreButton}>
                <Text style={styles.moreText}>...</Text>
              </Pressable>
              {menuOpen && (
                <View style={styles.menuBox}>
                  <MiniButton label="Settings" onPress={() => { setActiveView("settings"); setMenuOpen(false); }} />
                  <MiniButton label="Support" onPress={() => { setNotice("Support: contact the My Money team from your app store listing."); setMenuOpen(false); }} />
                  <MiniButton label="Log out" onPress={signOut} />
                </View>
              )}
            </View>
          </View>
          <Notice text={notice} />
          {activeView === "dashboard" && renderDashboard()}
          {activeView === "accounts" && renderAccounts()}
          {activeView === "expenses" && renderExpenses()}
          {activeView === "revenue" && renderRevenue()}
          {activeView === "analytics" && renderAnalytics()}
          {activeView === "budget" && renderBudgetPage()}
          {activeView === "settings" && renderSettings()}
        </ScrollView>
        {compact && <BottomNav activeView={activeView} setActiveView={setActiveView} />}
      </View>
    </SafeAreaView>
  );

  function renderDashboard() {
    if (compact) {
      return (
        <View style={styles.mobileStudio}>
          <View style={styles.mobileHero}>
            <Text style={styles.mobileHeroLabel}>Cash wallet</Text>
            <Text style={styles.mobileHeroValue}>{formatMoney(metrics.totalBalance, mainCurrency)}</Text>
            <Text style={styles.rateText}>{exchangeDate ? `Converted with latest rates from ${exchangeDate}.` : "Total balance follows the currency selected in settings."}</Text>
          </View>
          <View style={styles.quickActions}>
            <PrimaryButton label="Create budget" onPress={resetBudgetForm} />
            <SecondaryButton label="View budgets" onPress={() => { setBudgetMode("list"); setActiveView("budget"); }} />
          </View>
          {renderReportCards()}
        </View>
      );
    }
    return (
      <View>
        <View style={styles.dashboardHeroRow}>
          <View style={styles.balancePanel}>
            <Text style={styles.mobileHeroLabel}>Cash wallet</Text>
            <Text style={styles.mobileHeroValue}>{formatMoney(metrics.totalBalance, mainCurrency)}</Text>
            <Text style={styles.rateText}>{exchangeDate ? `Converted with latest rates from ${exchangeDate}.` : "Total balance follows the currency selected in settings."}</Text>
          </View>
          <View style={styles.budgetActionPanel}>
            <PrimaryButton label="Create budget" onPress={resetBudgetForm} />
            <SecondaryButton label="View budgets" onPress={() => { setBudgetMode("list"); setActiveView("budget"); }} />
          </View>
        </View>
        {renderReportCards()}
      </View>
    );
  }

  function renderReportCards() {
    return (
      <Panel title="Period statistics">
        <View style={styles.periodPickerRow}>
          <SelectField
            id="report-range"
            label="Period"
            compact
            options={reportRanges}
            labels={{ "30": "30 days", "90": "90 days", "365": "1 year", "730": "2 years" }}
            value={reportRange}
            openSelect={openSelect}
            setOpenSelect={setOpenSelect}
            onChange={setReportRange}
          />
        </View>
        <View style={[styles.summaryGrid, phone && styles.oneColumn]}>
          <MetricCard compact label="Total period expenses" value={formatMoney(metrics.periodSpend, activityCurrency)} />
          <MetricCard compact label="Total period revenue" value={formatMoney(metrics.periodRevenue, activityCurrency)} />
          <MetricCard compact label="Liability" value={formatMoney(metrics.liabilities, activityCurrency)} />
        </View>
      </Panel>
    );
  }

  function renderBudgetPage() {
    return <View>{renderBudgetSection()}</View>;
  }

  function renderBudgetSection() {
    const selectedBudget = budgets.find((budget) => budget.id === selectedBudgetId) || budgets[0];
    if (budgetMode === "form") return renderBudgetForm();
    if (budgetMode === "detail" && selectedBudget) return renderBudgetDetail(selectedBudget);
    return (
      <Panel title="Budgets" action={<IconButton label="+" onPress={resetBudgetForm} />}>
        {budgets.map((budget) => (
          <Pressable key={budget.id} onPress={() => { setSelectedBudgetId(budget.id); setBudgetMode("detail"); }} style={styles.budgetListItem}>
            <View>
              <Text style={styles.rowTitle}>{budget.name}</Text>
              <Text style={styles.rowMeta}>{budget.accountIds.length === accounts.length ? "All accounts" : `${budget.accountIds.length} account(s)`} - {budget.period}</Text>
            </View>
            <Text style={styles.rowValue}>{formatMoney(budget.amount, budget.currency)}</Text>
          </Pressable>
        ))}
        {!budgets.length && (
          <View style={styles.emptyState}>
            <Text style={styles.emptyText}>No budget has been created yet.</Text>
            <PrimaryButton label="Create budget" onPress={resetBudgetForm} />
          </View>
        )}
      </Panel>
    );
  }

  function renderBudgetForm() {
    const allSelected = accounts.length > 0 && budgetForm.accountIds.length === accounts.length;
    return (
      <Panel title={editingBudgetId ? "Edit budget" : "Create budget"}>
        <Field label="Budget name" value={budgetForm.name} onChangeText={(name: string) => setBudgetForm((current) => ({ ...current, name }))} />
        <Field label="Amount" value={budgetForm.amount} onChangeText={(amount: string) => setBudgetForm((current) => ({ ...current, amount }))} keyboardType="decimal-pad" />
        <SelectField id="budget-currency" label="Currency" options={currencies} labels={currencyLabels} searchTerms={currencySearchTerms} searchable value={budgetForm.currency} openSelect={openSelect} setOpenSelect={setOpenSelect} onChange={(currency) => setBudgetForm((current) => ({ ...current, currency }))} />
        <Text style={styles.label}>Budget filter</Text>
        <Pressable onPress={() => setBudgetForm((current) => ({ ...current, accountIds: allSelected ? [] : accounts.map((account) => account.id) }))} style={styles.checkRow}>
          <Text style={styles.checkBox}>{allSelected ? "X" : ""}</Text>
          <Text style={styles.rowTitle}>Select all accounts</Text>
        </Pressable>
        {accounts.map((account) => {
          const selected = budgetForm.accountIds.includes(account.id);
          return (
            <Pressable key={account.id} onPress={() => setBudgetForm((current) => ({ ...current, accountIds: selected ? current.accountIds.filter((id) => id !== account.id) : [...current.accountIds, account.id] }))} style={styles.checkRow}>
              <Text style={styles.checkBox}>{selected ? "X" : ""}</Text>
              <Text style={styles.rowTitle}>{account.name}</Text>
            </Pressable>
          );
        })}
        <Field label="Start date" value={budgetForm.startDate} onChangeText={(startDate: string) => setBudgetForm((current) => ({ ...current, startDate }))} placeholder="YYYY-MM-DD" />
        <SelectField id="budget-period" label="Budget period" options={budgetPeriods} value={budgetForm.period} openSelect={openSelect} setOpenSelect={setOpenSelect} onChange={(period) => setBudgetForm((current) => ({ ...current, period: period as BudgetPeriod }))} />
        <View style={styles.formActions}>
          <PrimaryButton label="Save changes" onPress={saveBudget} />
          <SecondaryButton label="Cancel" onPress={() => setBudgetMode("list")} />
        </View>
        {editingBudgetId && <Pressable onPress={() => deleteBudget(editingBudgetId)}><Text style={styles.deleteLink}>Delete budget</Text></Pressable>}
      </Panel>
    );
  }

  function renderBudgetDetail(budget: Budget) {
    const budgetExpenses = expenses.filter((expense) => budget.accountIds.includes(expense.accountId) && new Date(`${expense.date}T00:00:00`) >= new Date(`${budget.startDate}T00:00:00`));
    const spent = budgetExpenses.reduce((sum, expense) => sum + convertAmount(expense.amount, accounts.find((account) => account.id === expense.accountId)?.currency || mainCurrency), 0);
    const budgetValue = convertAmount(budget.amount, budget.currency);
    const left = Math.max(0, budgetValue - spent);
    const daily = left / Math.max(1, daysRemainingInBudget(budget));
    const progress = Math.min(100, budgetValue ? (spent / budgetValue) * 100 : 0);
    return (
      <Panel title={`Budget - ${budget.name}`} action={<MiniButton label="Edit budget" onPress={() => editBudget(budget)} />}>
        <Text style={styles.rowMeta}>{displayNameFromUser(user)} - {budget.accountIds.map((id) => accounts.find((account) => account.id === id)?.name).filter(Boolean).join(", ") || "No accounts"}</Text>
        <View style={[styles.summaryGrid, phone && styles.oneColumn]}>
          <MetricCard compact label="Originally budgeted" value={formatMoney(budgetValue, mainCurrency)} />
          <MetricCard compact label="Spent so far" value={formatMoney(spent, mainCurrency)} />
          <MetricCard compact label="Money left" value={formatMoney(left, mainCurrency)} />
          <MetricCard compact label="You can spend" value={formatMoney(daily, mainCurrency)} detail="per day" />
        </View>
        <View style={styles.progressTrack}>
          <View style={[styles.progressFill, { width: `${progress}%` }]} />
        </View>
        <View style={styles.formActions}>
          <SecondaryButton label="Close" onPress={() => setBudgetMode("list")} />
        </View>
      </Panel>
    );
  }

  function renderAccounts() {
    return (
      <View style={[styles.twoColumn, compact && styles.oneColumn]}>
        <Panel title={editingAccountId ? "Edit financial account" : "New financial account"}>
          <SelectField id="account-type" label="Type" options={accountTypes} value={accountForm.type} openSelect={openSelect} setOpenSelect={setOpenSelect} onChange={(type) => setAccountForm((current) => ({ ...current, type, icon: iconForAccountType(type) }))} />
          <Field label="Account name" value={accountForm.name} onChangeText={(name: string) => setAccountForm((current) => ({ ...current, name }))} />
          <SelectField id="account-currency" label="Currency" options={currencies} labels={currencyLabels} searchTerms={currencySearchTerms} searchable value={accountForm.currency} openSelect={openSelect} setOpenSelect={setOpenSelect} onChange={(currency) => setAccountForm((current) => ({ ...current, currency }))} />
          <Field
            label="Amount"
            value={accountForm.balance}
            onChangeText={(balance: string) => setAccountForm((current) => ({ ...current, balance }))}
            keyboardType="decimal-pad"
          />
          <View style={styles.autoIconPreview}>
            <View style={styles.accountIcon}>
              <Text style={styles.accountIconText}>{iconForAccountType(accountForm.type)}</Text>
            </View>
            <Text style={styles.rowMeta}>Assigned icon</Text>
          </View>
          <View style={styles.formActions}>
            <PrimaryButton label="Save account" onPress={saveAccount} />
            <SecondaryButton label="Clear" onPress={resetAccountForm} />
          </View>
        </Panel>
        <Panel title="Accounts">
          {accounts.map((account) => (
            <AccountRow key={account.id} account={account} detailed onEdit={() => editAccount(account)} onDelete={() => deleteAccount(account.id)} />
          ))}
          {!accounts.length && <EmptyState text="No financial accounts yet." />}
        </Panel>
      </View>
    );
  }

  function renderExpenses() {
    return (
      <View style={[styles.twoColumn, compact && styles.oneColumn]}>
        <Panel title="Track expense">
          <SelectField id="expense-account" label="Account" options={accounts.map((account) => account.id)} labels={Object.fromEntries(accounts.map((account) => [account.id, account.name]))} value={expenseForm.accountId} openSelect={openSelect} setOpenSelect={setOpenSelect} onChange={(accountId) => setExpenseForm((current) => ({ ...current, accountId }))} />
          <SelectField id="expense-category" label="Category" options={expenseCategories} value={expenseForm.category} openSelect={openSelect} setOpenSelect={setOpenSelect} onChange={(category) => setExpenseForm((current) => ({ ...current, category }))} />
          <Field label="Amount" value={expenseForm.amount} onChangeText={(amount: string) => setExpenseForm((current) => ({ ...current, amount }))} keyboardType="decimal-pad" />
          <Field label="Date" value={expenseForm.date} onChangeText={(date: string) => setExpenseForm((current) => ({ ...current, date }))} placeholder="YYYY-MM-DD" />
          <Field label="Note" value={expenseForm.note} onChangeText={(note: string) => setExpenseForm((current) => ({ ...current, note }))} />
          <PrimaryButton label="Add expense" onPress={addExpense} />
        </Panel>
        <Panel title="Expense history">
          <SelectField id="expense-filter" label="Filter" options={["all", ...accounts.map((account) => account.id)]} labels={{ all: "All accounts", ...Object.fromEntries(accounts.map((account) => [account.id, account.name])) }} value={expenseFilter} openSelect={openSelect} setOpenSelect={setOpenSelect} onChange={setExpenseFilter} />
          {filteredExpenses.map((expense) => <ExpenseRow key={expense.id} expense={expense} />)}
          {!filteredExpenses.length && <EmptyState text="No expenses match this account." />}
        </Panel>
      </View>
    );
  }

  function renderRevenue() {
    const recentRevenue = filteredRevenues.slice(0, 8);
    return (
      <View style={[styles.twoColumn, compact && styles.oneColumn]}>
        <Panel title="Track revenue">
          <SelectField id="revenue-account" label="Account" options={accounts.map((account) => account.id)} labels={Object.fromEntries(accounts.map((account) => [account.id, account.name]))} value={revenueForm.accountId} openSelect={openSelect} setOpenSelect={setOpenSelect} onChange={(accountId) => setRevenueForm((current) => ({ ...current, accountId }))} />
          <SelectField id="revenue-source" label="Source" options={revenueCategoriesState} value={revenueForm.source} openSelect={openSelect} setOpenSelect={setOpenSelect} onChange={(source) => setRevenueForm((current) => ({ ...current, source }))} />
          <Field label="Amount" value={revenueForm.amount} onChangeText={(amount: string) => setRevenueForm((current) => ({ ...current, amount }))} keyboardType="decimal-pad" />
          <Field label="Date" value={revenueForm.date} onChangeText={(date: string) => setRevenueForm((current) => ({ ...current, date }))} placeholder="YYYY-MM-DD" />
          <Field label="Note" value={revenueForm.note} onChangeText={(note: string) => setRevenueForm((current) => ({ ...current, note }))} />
          <PrimaryButton label="Add revenue" onPress={addRevenue} />
        </Panel>
        <Panel title="Revenue history">
          <SelectField id="revenue-filter" label="Filter" options={["all", ...accounts.map((account) => account.id)]} labels={{ all: "All accounts", ...Object.fromEntries(accounts.map((account) => [account.id, account.name])) }} value={revenueFilter} openSelect={openSelect} setOpenSelect={setOpenSelect} onChange={setRevenueFilter} />
          {recentRevenue.map((revenue) => <RevenueRow key={revenue.id} revenue={revenue} />)}
          {!recentRevenue.length && <EmptyState text="No revenue has been tracked yet." />}
        </Panel>
      </View>
    );
  }

  function renderAnalytics() {
    const max = Math.max(...categoryTotals.map((item) => item.total), 1);
    const expenseSeries = buildSeries(expenses.map((expense) => ({ date: expense.date, amount: expense.amount })), Number(analyticsRange));
    const revenueSeries = buildSeries(revenues.map((revenue) => ({ date: revenue.date, amount: revenue.amount })), Number(analyticsRange));
    if (compact) {
      return (
        <View style={styles.mobileStudio}>
          <View style={styles.mobileHero}>
            <Text style={styles.mobileHeroLabel}>Monthly performance</Text>
            <Text style={styles.mobileHeroValue}>{formatMoney(metrics.netFlow, mainCurrency)}</Text>
            <View style={styles.mobileHeroStats}>
              <View>
                <Text style={styles.mobileStatLabel}>Revenue</Text>
                <Text style={styles.mobileStatValue}>{formatMoney(metrics.monthRevenue, mainCurrency)}</Text>
              </View>
              <View>
                <Text style={styles.mobileStatLabel}>Expenses</Text>
                <Text style={styles.mobileStatValue}>{formatMoney(metrics.monthSpend, mainCurrency)}</Text>
              </View>
              <View>
                <Text style={styles.mobileStatLabel}>Entries</Text>
                <Text style={styles.mobileStatValue}>{String(expenses.length + revenues.length)}</Text>
              </View>
            </View>
          </View>
          <Panel title="Time frame">
            <View style={styles.segmentRow}>
              {analyticsRanges.map((range) => <MiniButton key={range} label={`${range}d`} onPress={() => setAnalyticsRange(range)} />)}
            </View>
          </Panel>
          <ChartPanel title="Revenue" data={revenueSeries} currency={mainCurrency} barMode={analyticsRange === "365"} />
          <ChartPanel title="Expenses" data={expenseSeries} currency={mainCurrency} barMode={analyticsRange === "365"} />
          <Panel title="Spending by category">
            {categoryTotals.map((item) => (
              <View key={item.category} style={styles.barItem}>
                <View style={styles.barLabel}>
                  <Text style={styles.barText}>{item.category}</Text>
                  <Text style={styles.barText}>{formatMoney(item.total, mainCurrency)}</Text>
                </View>
                <View style={styles.barLine}>
                  <View style={[styles.barFill, { width: `${(item.total / max) * 100}%` }]} />
                </View>
              </View>
            ))}
            {!categoryTotals.length && <EmptyState text="No spending categories yet." />}
          </Panel>
          <Panel title="Insight">
            <Text style={styles.insightText}>{generateInsight(expenses, accounts, mainCurrency)}</Text>
          </Panel>
        </View>
      );
    }
    return (
      <View style={[styles.twoColumn, compact && styles.oneColumn]}>
        <View style={styles.fullWidth}>
          <Panel title="Analytics period">
            <View style={styles.segmentRow}>
              {analyticsRanges.map((range) => <MiniButton key={range} label={range === "365" ? "365 days" : `Last ${range} days`} onPress={() => setAnalyticsRange(range)} />)}
            </View>
          </Panel>
          <View style={[styles.twoColumn, compact && styles.oneColumn]}>
            <ChartPanel title="Revenue" data={revenueSeries} currency={mainCurrency} barMode={analyticsRange === "365"} />
            <ChartPanel title="Expenses" data={expenseSeries} currency={mainCurrency} barMode={analyticsRange === "365"} />
          </View>
        </View>
        <Panel title="Spending by category">
          {categoryTotals.map((item) => (
            <View key={item.category} style={styles.barItem}>
              <View style={styles.barLabel}>
                <Text style={styles.barText}>{item.category}</Text>
                <Text style={styles.barText}>{formatMoney(item.total, mainCurrency)}</Text>
              </View>
              <View style={styles.barLine}>
                <View style={[styles.barFill, { width: `${(item.total / max) * 100}%` }]} />
              </View>
            </View>
          ))}
          {!categoryTotals.length && <EmptyState text="No spending categories yet." />}
        </Panel>
        <Panel title="Insight">
          <Text style={styles.insightText}>{generateInsight(expenses, accounts, mainCurrency)}</Text>
        </Panel>
      </View>
    );
  }

  function renderSettings() {
    return (
      <View>
        <View style={styles.tabs}>
          <TabButton active={settingsTab === "account"} label="Account" onPress={() => setSettingsTab("account")} />
          <TabButton active={settingsTab === "categories"} label="All categories" onPress={() => setSettingsTab("categories")} />
          <TabButton active={settingsTab === "app"} label="App" onPress={() => setSettingsTab("app")} />
        </View>
        {settingsTab === "account" && (
          <View style={[styles.twoColumn, compact && styles.oneColumn]}>
            <Panel title="Profile">
              <View style={styles.profileEditor}>
                <Image source={profileForm.photoUri ? { uri: profileForm.photoUri } : iconAssets.profile} style={styles.profilePreview} />
                <Field label="Profile photo URL" value={profileForm.photoUri} onChangeText={(photoUri: string) => setProfileForm((current) => ({ ...current, photoUri }))} />
              </View>
              <Field label="First name" value={profileForm.firstName} onChangeText={(firstName: string) => setProfileForm((current) => ({ ...current, firstName }))} />
              <Field label="Last name" value={profileForm.lastName} onChangeText={(lastName: string) => setProfileForm((current) => ({ ...current, lastName }))} />
              <SelectField id="profile-sex" label="Sex" options={sexes} value={profileForm.sex} openSelect={openSelect} setOpenSelect={setOpenSelect} onChange={(sex) => setProfileForm((current) => ({ ...current, sex }))} />
              <Field label="Date of birth" value={profileForm.birthDate} onChangeText={(birthDate: string) => setProfileForm((current) => ({ ...current, birthDate }))} placeholder="YYYY-MM-DD" />
              <SelectField id="setting-currency" label="Account currency" options={currencies} labels={currencyLabels} searchTerms={currencySearchTerms} searchable value={settingsForm.defaultCurrency} openSelect={openSelect} setOpenSelect={setOpenSelect} onChange={(defaultCurrency) => setSettingsForm((current) => ({ ...current, defaultCurrency }))} />
              <View style={styles.formActions}>
                <PrimaryButton label="Save settings" onPress={saveSettings} />
                <SecondaryButton label="Delete account" onPress={() => setNotice("Account deletion is available when backend account deletion is enabled.")} />
              </View>
            </Panel>
            <Panel title="Currency display">
              <MetricCard compact label="Dashboard currency" value={settingsForm.defaultCurrency} detail={exchangeDate ? `Latest rate date: ${exchangeDate}` : "Rates load quietly in the background."} />
              <Text style={styles.insightText}>Balances from different account currencies are converted into the account currency for dashboard totals.</Text>
            </Panel>
          </View>
        )}
        {settingsTab === "categories" && (
          <View style={[styles.twoColumn, compact && styles.oneColumn]}>
            <Panel title="Add category">
              <SelectField id="category-kind" label="Category type" options={["expense", "revenue"]} labels={{ expense: "Expense", revenue: "Revenue" }} value={categoryKind} openSelect={openSelect} setOpenSelect={setOpenSelect} onChange={(value) => setCategoryKind(value as "expense" | "revenue")} />
              <Field label="Category name" value={categoryDraft} onChangeText={setCategoryDraft} />
              <PrimaryButton label="Add category" onPress={addCategory} />
            </Panel>
            <Panel title="All categories">
              <Text style={styles.label}>Expense categories</Text>
              {expenseCategories.map((category) => <CategoryRow key={category} kind="expense" name={category} onDelete={() => removeCategory("expense", category)} />)}
              <Text style={styles.label}>Revenue categories</Text>
              {revenueCategoriesState.map((category) => <CategoryRow key={category} kind="revenue" name={category} onDelete={() => removeCategory("revenue", category)} />)}
              <PrimaryButton label="Save categories" onPress={saveSettings} />
            </Panel>
          </View>
        )}
        {settingsTab === "app" && (
          <Panel title="App settings">
            <SelectField id="setting-language" label="Language" options={appLanguages} value={settingsForm.language} openSelect={openSelect} setOpenSelect={setOpenSelect} onChange={(language) => setSettingsForm((current) => ({ ...current, language }))} />
            <SelectField id="setting-view" label="Default view" options={["dashboard", "accounts", "expenses", "revenue", "analytics"]} labels={{ dashboard: "Dashboard", accounts: "Accounts", expenses: "Expenses", revenue: "Revenue", analytics: "Analytics" }} value={settingsForm.defaultView} openSelect={openSelect} setOpenSelect={setOpenSelect} onChange={(defaultView) => setSettingsForm((current) => ({ ...current, defaultView }))} />
            <SelectField id="setting-summary" label="Compact summary" options={["On", "Off"]} value={settingsForm.compactSummary} openSelect={openSelect} setOpenSelect={setOpenSelect} onChange={(compactSummary) => setSettingsForm((current) => ({ ...current, compactSummary }))} />
            <View style={styles.formActions}>
              <PrimaryButton label="Save settings" onPress={saveSettings} />
              <SecondaryButton label="Sign out" onPress={signOut} />
            </View>
          </Panel>
        )}
      </View>
    );
  }

  function lastDaysExpenses(days: number) {
    return recentItems(expenses, days).reduce((sum, expense) => sum + expense.amount, 0);
  }

  function AccountRow({ account, detailed, onEdit, onDelete }: { account: Account; detailed?: boolean; onEdit?: () => void; onDelete?: () => void }) {
    return (
      <View style={styles.row}>
        <View style={styles.accountIcon}>
          <Image source={assetForAccountType(account.type)} style={styles.smallIcon} />
        </View>
        <View style={styles.rowBody}>
          <Text style={styles.rowTitle}>{account.name}</Text>
          <Text style={styles.rowMeta}>{account.type} - {account.currency}</Text>
        </View>
        <View style={styles.rowRight}>
          <Text style={styles.rowValue}>{formatMoney(account.balance, account.currency)}</Text>
          {detailed && (
            <View style={styles.rowActions}>
              <MiniButton label="Edit" onPress={onEdit} />
              <MiniButton label="Delete" danger onPress={onDelete} />
            </View>
          )}
        </View>
      </View>
    );
  }

  function ExpenseRow({ expense }: { expense: Expense }) {
    const account = accounts.find((item) => item.id === expense.accountId);
    return (
      <View style={styles.row}>
        <View style={styles.accountIcon}>
          <Image source={assetForExpenseCategory(expense.category)} style={styles.smallIcon} />
        </View>
        <View style={styles.rowBody}>
          <Text style={styles.rowTitle}>{expense.category}</Text>
          <Text style={styles.rowMeta}>{account?.name || "Deleted account"} - {expense.note || "No note"} - {expense.date}</Text>
        </View>
        <Text style={styles.rowValue}>{formatMoney(expense.amount, account?.currency || mainCurrency)}</Text>
      </View>
    );
  }

  function RevenueRow({ revenue }: { revenue: Revenue }) {
    const account = accounts.find((item) => item.id === revenue.accountId);
    return (
      <View style={styles.row}>
        <View style={styles.revenueIcon}>
          <Image source={assetForRevenueCategory(revenue.source)} style={styles.smallIcon} />
        </View>
        <View style={styles.rowBody}>
          <Text style={styles.rowTitle}>{revenue.source}</Text>
          <Text style={styles.rowMeta}>{account?.name || "Deleted account"} - {revenue.note || "No note"} - {revenue.date}</Text>
        </View>
        <Text style={styles.positiveValue}>{formatMoney(revenue.amount, account?.currency || mainCurrency)}</Text>
      </View>
    );
  }

  function CategoryRow({ kind, name, onDelete }: { kind: "expense" | "revenue"; name: string; onDelete: () => void }) {
    return (
      <View style={styles.row}>
        <View style={styles.accountIcon}>
          <Image source={kind === "expense" ? assetForExpenseCategory(name) : assetForRevenueCategory(name)} style={styles.smallIcon} />
        </View>
        <View style={styles.rowBody}>
          <Text style={styles.rowTitle}>{name}</Text>
          <Text style={styles.rowMeta}>Customizable transaction category</Text>
        </View>
        <MiniButton label="Delete" danger onPress={onDelete} />
      </View>
    );
  }
}

function Field(props: React.ComponentProps<typeof TextInput> & { label: string }) {
  const { label, ...inputProps } = props;
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <TextInput style={styles.input} placeholderTextColor="#87908d" {...inputProps} />
    </View>
  );
}

function SelectField({
  id,
  label,
  options,
  labels = {},
  searchTerms = {},
  value,
  openSelect,
  setOpenSelect,
  onChange,
  compact,
  searchable
}: {
  id: string;
  label: string;
  options: string[];
  labels?: Record<string, string>;
  searchTerms?: Record<string, string>;
  value: string;
  openSelect: string | null;
  setOpenSelect: (id: string | null) => void;
  onChange: (value: string) => void;
  compact?: boolean;
  searchable?: boolean;
}) {
  const open = openSelect === id;
  const [query, setQuery] = useState("");
  const display = labels[value] || value || "Choose";
  const normalizedQuery = query.trim().toLowerCase();
  const filteredOptions = normalizedQuery
    ? options.filter((option) => `${option} ${labels[option] || ""} ${searchTerms[option] || ""}`.toLowerCase().includes(normalizedQuery))
    : options;
  return (
    <View style={[styles.field, styles.selectField, open && styles.selectFieldOpen]}>
      {label ? <Text style={styles.label}>{label}</Text> : null}
      <Pressable onPress={() => setOpenSelect(open ? null : id)} style={[styles.selectButton, compact && styles.selectButtonCompact]}>
        <Text style={styles.selectButtonText}>{display}</Text>
        <Text style={styles.selectChevron}>{open ? "⌃" : "⌄"}</Text>
      </Pressable>
      {open && (
        <ScrollView style={styles.selectMenu} nestedScrollEnabled>
          {searchable && (
            <View style={styles.selectSearchWrap}>
              <TextInput
                value={query}
                onChangeText={setQuery}
                placeholder="Search country, currency, or code"
                placeholderTextColor="#87908d"
                style={styles.selectSearchInput}
                autoCapitalize="none"
              />
            </View>
          )}
          {filteredOptions.map((option) => (
            <Pressable
              key={option}
              onPress={() => {
                onChange(option);
                setQuery("");
                setOpenSelect(null);
              }}
              style={[styles.selectOption, value === option && styles.selectOptionActive]}
            >
              <Text style={[styles.selectOptionText, value === option && styles.selectOptionTextActive]}>{labels[option] || option}</Text>
            </Pressable>
          ))}
          {!filteredOptions.length && <Text style={styles.selectEmptyText}>No currency found.</Text>}
        </ScrollView>
      )}
    </View>
  );
}

function PrimaryButton({ label, disabled, onPress }: { label: string; disabled?: boolean; onPress?: () => void }) {
  return (
    <Pressable disabled={disabled} onPress={onPress} style={[styles.primaryButton, disabled && styles.buttonDisabled]}>
      <Text style={[styles.primaryButtonText, disabled && styles.buttonDisabledText]}>{label}</Text>
    </Pressable>
  );
}

function SecondaryButton({ label, onPress }: { label: string; onPress?: () => void }) {
  return (
    <Pressable onPress={onPress} style={styles.secondaryButton}>
      <Text style={styles.secondaryButtonText}>{label}</Text>
    </Pressable>
  );
}

function MiniButton({ label, danger, onPress }: { label: string; danger?: boolean; onPress?: () => void }) {
  return (
    <Pressable onPress={onPress} style={styles.miniButton}>
      <Text style={[styles.miniButtonText, danger && styles.dangerText]}>{label}</Text>
    </Pressable>
  );
}

function IconButton({ label, onPress }: { label: string; onPress?: () => void }) {
  return (
    <Pressable onPress={onPress} style={styles.iconButton}>
      <Text style={styles.iconButtonText}>{label}</Text>
    </Pressable>
  );
}

function TabButton({ active, label, onPress }: { active: boolean; label: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={[styles.tabButton, active && styles.tabButtonActive]}>
      <Text style={[styles.tabButtonText, active && styles.tabButtonTextActive]}>{label}</Text>
    </Pressable>
  );
}

function MetricCard({ label, value, detail, compact }: { label: string; value: string; detail?: string; compact?: boolean }) {
  return (
    <View style={[styles.metricCard, compact && styles.metricCardCompact]}>
      <Text style={styles.metricLabel}>{label}</Text>
      <Text style={styles.metricValue}>{value}</Text>
      {detail && <Text style={styles.metricDetail}>{detail}</Text>}
    </View>
  );
}

function ChartPanel({ title, data, currency, barMode }: { title: string; data: { label: string; total: number }[]; currency: string; barMode?: boolean }) {
  const max = Math.max(...data.map((item) => item.total), 1);
  return (
    <Panel title={title}>
      <View style={styles.chartArea}>
        {data.map((item) => (
          <View key={item.label} style={styles.chartColumn}>
            <View style={styles.chartRail}>
              <View style={[barMode ? styles.chartBar : styles.chartPoint, { height: `${Math.max(4, (item.total / max) * 100)}%` }]} />
            </View>
            <Text style={styles.chartLabel}>{item.label}</Text>
          </View>
        ))}
      </View>
      <Text style={styles.rowMeta}>Peak: {formatMoney(max, currency)}</Text>
    </Panel>
  );
}

function Panel({ title, action, children }: { title: string; action?: React.ReactNode; children: React.ReactNode }) {
  return (
    <View style={styles.panel}>
      <View style={styles.panelHeader}>
        <Text style={styles.panelTitle}>{title}</Text>
        {action}
      </View>
      <View style={styles.panelBody}>{children}</View>
    </View>
  );
}

function EmptyState({ text }: { text: string }) {
  return (
    <View style={styles.emptyState}>
      <Text style={styles.emptyText}>{text}</Text>
    </View>
  );
}

function Notice({ text }: { text: string }) {
  return text ? <Text style={styles.notice}>{text}</Text> : <View style={styles.noticeSpacer} />;
}

function SideNav({ activeView, setActiveView, signOut }: { activeView: ViewName; setActiveView: (view: ViewName) => void; signOut: () => void }) {
  return (
    <View style={styles.sideNav}>
      <View style={styles.sideBrand}>
        <View style={styles.sideBrandMark}>
          <Text style={styles.sideBrandText}>M</Text>
        </View>
        <Text style={styles.sideBrandName}>My Money</Text>
      </View>
      <View style={styles.navList}>
        {(["dashboard", "accounts", "expenses", "revenue", "analytics"] as ViewName[]).map((view) => (
          <Pressable key={view} onPress={() => setActiveView(view)} style={[styles.navItem, activeView === view && styles.navItemActive]}>
            <Image source={iconAssets[view]} style={styles.navIcon} />
            <Text style={[styles.navText, activeView === view && styles.navTextActive]}>{titleFor(view)}</Text>
          </Pressable>
        ))}
      </View>
      <SecondaryButton label="Sign out" onPress={signOut} />
    </View>
  );
}

function BottomNav({ activeView, setActiveView }: { activeView: ViewName; setActiveView: (view: ViewName) => void }) {
  return (
    <View style={styles.bottomNav}>
      {(["dashboard", "accounts", "expenses", "revenue", "analytics"] as ViewName[]).map((view) => (
        <Pressable key={view} onPress={() => setActiveView(view)} style={[styles.bottomItem, activeView === view && styles.bottomItemActive]}>
          <Image source={iconAssets[view]} style={styles.bottomIcon} />
          <Text style={[styles.bottomText, activeView === view && styles.bottomTextActive]}>{titleFor(view).split(" ")[0]}</Text>
        </Pressable>
      ))}
    </View>
  );
}

function modeLabel(mode: AuthMode) {
  if (mode === "signin") return "Sign in";
  if (mode === "signup") return "Create";
  if (mode === "recover") return "Recover";
  return "Reset";
}

function authButtonLabel(mode: AuthMode, busy: boolean) {
  if (busy) return "Please wait...";
  if (mode === "recover") return "Update password";
  if (mode === "reset") return "Send reset link";
  if (mode === "signup") return "Create account";
  return "Sign in";
}

function getAuthRedirectUrl() {
  if (Platform.OS === "web" && typeof window !== "undefined") return window.location.origin;
  return "mymoney://auth";
}

function titleFor(view: ViewName) {
  const titles: Record<ViewName, string> = {
    dashboard: "Dashboard",
    accounts: "Accounts",
    expenses: "Expenses",
    revenue: "Revenue",
    analytics: "Analytics",
    budget: "Budget",
    settings: "Settings"
  };
  return titles[view];
}

function formatMoney(amount: number, currency = "USD") {
  try {
    return new Intl.NumberFormat(undefined, { style: "currency", currency, maximumFractionDigits: 2 }).format(Number(amount || 0));
  } catch {
    return `${currency} ${Number(amount || 0).toFixed(2)}`;
  }
}

function currencyDisplayName(code: string) {
  try {
    return new Intl.DisplayNames(undefined, { type: "currency" }).of(code) || code;
  } catch {
    return code;
  }
}

function recentItems(items: Expense[], days: number) {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  start.setDate(start.getDate() - (days - 1));
  return items.filter((item) => new Date(`${item.date}T00:00:00`) >= start);
}

function daysAgo(days: number) {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  start.setDate(start.getDate() - (days - 1));
  return start;
}

function buildSeries(items: { date: string; amount: number }[], days: number) {
  if (days === 365) {
    const buckets = new Map<string, number>();
    for (let index = 11; index >= 0; index -= 1) {
      const date = new Date();
      date.setMonth(date.getMonth() - index);
      buckets.set(date.toISOString().slice(0, 7), 0);
    }
    items.forEach((item) => {
      const key = item.date.slice(0, 7);
      if (buckets.has(key)) buckets.set(key, (buckets.get(key) || 0) + item.amount);
    });
    return Array.from(buckets.entries()).map(([label, total]) => ({ label: label.slice(5), total }));
  }

  const start = daysAgo(days);
  const buckets = new Map<string, number>();
  for (let index = 0; index < days; index += 1) {
    const date = new Date(start);
    date.setDate(start.getDate() + index);
    buckets.set(date.toISOString().slice(0, 10), 0);
  }
  items.forEach((item) => {
    if (buckets.has(item.date)) buckets.set(item.date, (buckets.get(item.date) || 0) + item.amount);
  });
  return Array.from(buckets.entries()).map(([label, total]) => ({ label: label.slice(5), total }));
}

function daysRemainingInBudget(budget: Budget) {
  const start = new Date(`${budget.startDate}T00:00:00`);
  const end = new Date(start);
  if (budget.period === "Daily") end.setDate(start.getDate() + 1);
  if (budget.period === "Weekly") end.setDate(start.getDate() + 7);
  if (budget.period === "Monthly") end.setMonth(start.getMonth() + 1);
  if (budget.period === "Yearly") end.setFullYear(start.getFullYear() + 1);
  const diff = end.getTime() - Date.now();
  return Math.ceil(diff / 86400000);
}

function displayNameFromUser(user: User | LocalUser | null) {
  if (!user) return "User";
  if ("name" in user && user.name) return user.name;
  return user.email?.split("@")[0] || "User";
}

function generateInsight(expenses: Expense[], accounts: Account[], currency: string) {
  if (!accounts.length) return "Create a financial account first, then My Money can build useful spending insights from your transactions.";
  if (!expenses.length) return "Add a few expenses and the analytics area will identify your strongest spending category, monthly pace, and possible savings opportunities.";
  const totals = new Map<string, number>();
  expenses.forEach((expense) => totals.set(expense.category, (totals.get(expense.category) || 0) + expense.amount));
  const sorted = Array.from(totals.entries()).sort((a, b) => b[1] - a[1]);
  const [category, total] = sorted[0];
  const totalSpend = sorted.reduce((sum, item) => sum + item[1], 0);
  const share = Math.round((total / totalSpend) * 100);
  if (share >= 45) return `${category} is taking ${share}% of tracked spending. Review the last few entries and set a weekly limit.`;
  return `Spending is spread across ${sorted.length} categories, with ${category} currently highest at ${formatMoney(total, currency)}.`;
}

function confirmDelete() {
  if (Platform.OS === "web") {
    return Promise.resolve(Boolean((globalThis as any).confirm?.("Delete this account and related expenses?")));
  }

  return new Promise<boolean>((resolve) => {
    Alert.alert("Delete account", "Delete this account and related expenses?", [
      { text: "Cancel", style: "cancel", onPress: () => resolve(false) },
      { text: "Delete", style: "destructive", onPress: () => resolve(true) }
    ]);
  });
}

async function ensureFirstRemoteAccount(userId: string) {
  if (!supabase) return;
  const { data, error } = await supabase.from("accounts").select("id").eq("user_id", userId).limit(1);
  if (!error && data && data.length === 0) {
    await supabase.from("accounts").insert(accountToRow(seedAccount(userId)));
  }
}

function seedAccount(userId: string): Account {
  return {
    id: newId("account"),
    userId,
    name: "Main wallet",
    type: "Cash",
    currency: "USD",
    balance: 0,
    icon: iconForAccountType("Cash")
  };
}

function accountFromRow(row: any): Account {
  return {
    id: row.id,
    userId: row.user_id,
    name: row.name,
    type: row.type,
    currency: row.currency,
    balance: Number(row.balance || 0),
    icon: row.icon || iconForAccountType(row.type)
  };
}

function expenseFromRow(row: any): Expense {
  return {
    id: row.id,
    userId: row.user_id,
    accountId: row.account_id,
    category: row.category,
    amount: Number(row.amount || 0),
    date: row.date,
    note: row.note || ""
  };
}

function revenueFromRow(row: any): Revenue {
  return {
    id: row.id,
    userId: row.user_id,
    accountId: row.account_id,
    source: row.source,
    amount: Number(row.amount || 0),
    date: row.date,
    note: row.note || ""
  };
}

function accountToRow(account: Partial<Account>) {
  return {
    id: account.id,
    user_id: account.userId,
    name: account.name,
    type: account.type,
    currency: account.currency,
    balance: account.balance,
    icon: account.icon
  };
}

function expenseToRow(expense: Expense) {
  return {
    id: expense.id,
    user_id: expense.userId,
    account_id: expense.accountId,
    category: expense.category,
    amount: expense.amount,
    date: expense.date,
    note: expense.note
  };
}

function revenueToRow(revenue: Revenue) {
  return {
    id: revenue.id,
    user_id: revenue.userId,
    account_id: revenue.accountId,
    source: revenue.source,
    amount: revenue.amount,
    date: revenue.date,
    note: revenue.note
  };
}

function iconForAccountType(type: string) {
  return accountTypeIcons[type] || type.slice(0, 2).toUpperCase();
}

function assetForAccountType(type: string) {
  const assets: Record<string, any> = {
    Cash: iconAssets.cash,
    "Bank account": iconAssets.bank,
    "Credit card": iconAssets.card,
    Savings: iconAssets.savings,
    Investment: iconAssets.investment,
    "Mobile money": iconAssets.mobile,
    Loan: iconAssets.loan,
    "Crypto wallet": iconAssets.crypto
  };
  return assets[type] || iconAssets.cash;
}

function assetForExpenseCategory(category: string) {
  return expenseCategoryIcons[category] || expenseCategoryIcons.Other;
}

function assetForRevenueCategory(category: string) {
  return revenueCategoryIcons[category] || revenueCategoryIcons.Other;
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#f7f8f5" },
  loading: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: "#f7f8f5" },
  loadingText: { color: "#13201d", fontWeight: "800" },
  authShell: { minHeight: "100%", padding: 32, gap: 40, alignItems: "center", justifyContent: "center", flexDirection: "row" },
  authShellPhone: { padding: 22, alignItems: "stretch", flexDirection: "column" },
  brandBlock: { flex: 1, maxWidth: 560, flexDirection: "row", gap: 18, alignItems: "flex-start" },
  brandMark: { width: 52, height: 52, borderRadius: 8, backgroundColor: "#0f6f5f", alignItems: "center", justifyContent: "center" },
  brandMarkText: { color: "#fff", fontSize: 24, fontWeight: "900" },
  brandCopy: { flex: 1 },
  heroTitle: { color: "#13201d", fontSize: 56, lineHeight: 58, fontWeight: "900" },
  heroText: { color: "#66736f", marginTop: 14, fontSize: 18, lineHeight: 28 },
  authCard: { width: "100%", maxWidth: 440, padding: 18, gap: 14, backgroundColor: "#fff", borderColor: "#d8dfdc", borderWidth: 1, borderRadius: 8 },
  passwordHint: { color: "#66736f", marginTop: -6, fontSize: 12, fontWeight: "700" },
  authSwitchRow: { flexDirection: "row", gap: 6, alignItems: "center", justifyContent: "center", flexWrap: "wrap" },
  authSwitchLink: { color: "#0f6f5f", fontWeight: "900" },
  forgotLink: { color: "#0f6f5f", textAlign: "center", fontWeight: "900" },
  tabs: { flexDirection: "row", gap: 6, padding: 4, borderRadius: 8, backgroundColor: "#edf1ee" },
  tabButton: { flex: 1, minHeight: 42, borderRadius: 6, alignItems: "center", justifyContent: "center" },
  tabButtonActive: { backgroundColor: "#0f6f5f" },
  tabButtonText: { color: "#66736f", fontWeight: "800" },
  tabButtonTextActive: { color: "#fff" },
  field: { gap: 7 },
  label: { color: "#66736f", fontSize: 13, fontWeight: "800" },
  input: { minHeight: 44, borderWidth: 1, borderColor: "#d8dfdc", borderRadius: 7, backgroundColor: "#fff", color: "#13201d", paddingHorizontal: 12 },
  primaryButton: { minHeight: 44, borderRadius: 7, backgroundColor: "#0f6f5f", alignItems: "center", justifyContent: "center", paddingHorizontal: 16 },
  primaryButtonText: { color: "#fff", fontWeight: "900" },
  buttonDisabled: { backgroundColor: "#a8b5b1" },
  buttonDisabledText: { color: "#eef3f1" },
  secondaryButton: { minHeight: 42, borderRadius: 7, backgroundColor: "#e8eeeb", alignItems: "center", justifyContent: "center", paddingHorizontal: 14 },
  secondaryButtonText: { color: "#13201d", fontWeight: "900" },
  notice: { minHeight: 20, color: "#0d4f45", fontWeight: "800", marginBottom: 8 },
  noticeSpacer: { height: 8 },
  workspace: { flex: 1, flexDirection: "row" },
  workspaceCompact: { paddingBottom: 76 },
  sideNav: { width: 240, padding: 22, gap: 22, backgroundColor: "#10231f" },
  sideBrand: { flexDirection: "row", alignItems: "center", gap: 12 },
  sideBrandMark: { width: 40, height: 40, borderRadius: 8, backgroundColor: "#d39b25", alignItems: "center", justifyContent: "center" },
  sideBrandText: { color: "#fff", fontWeight: "900" },
  sideBrandName: { color: "#fff", fontWeight: "900", fontSize: 17 },
  navList: { gap: 8, flex: 1 },
  navItem: { minHeight: 44, borderRadius: 7, alignItems: "center", flexDirection: "row", gap: 10, paddingHorizontal: 13 },
  navItemActive: { backgroundColor: "rgba(255,255,255,0.16)" },
  navIcon: { width: 20, height: 20, tintColor: "#fff" },
  navText: { color: "rgba(255,255,255,0.76)", fontWeight: "800" },
  navTextActive: { color: "#fff" },
  bottomNav: { position: "absolute", left: 0, right: 0, bottom: 0, minHeight: 74, padding: 6, backgroundColor: "#10231f", flexDirection: "row", gap: 3 },
  bottomItem: { flex: 1, minWidth: 0, borderRadius: 7, alignItems: "center", justifyContent: "center", paddingHorizontal: 2 },
  bottomItemActive: { backgroundColor: "rgba(255,255,255,0.16)" },
  bottomIcon: { width: 18, height: 18, tintColor: "#fff", marginBottom: 4 },
  bottomText: { color: "rgba(255,255,255,0.76)", fontWeight: "800", fontSize: 10, textAlign: "center" },
  bottomTextActive: { color: "#fff" },
  content: { flex: 1 },
  contentInner: { padding: 28, gap: 14 },
  contentInnerPhone: { padding: 14, paddingBottom: 92 },
  topBar: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 },
  topBarPhone: { alignItems: "flex-start", paddingHorizontal: 2 },
  headerActions: { flexDirection: "row", gap: 10, alignItems: "center", position: "relative" },
  profileButton: { width: 40, height: 40, borderRadius: 20, overflow: "hidden", borderWidth: 1, borderColor: "#d8dfdc", backgroundColor: "#fff" },
  profileImage: { width: "100%", height: "100%" },
  profilePreview: { width: 86, height: 86, borderRadius: 43, borderWidth: 1, borderColor: "#d8dfdc", backgroundColor: "#f7f8f5" },
  profileEditor: { gap: 12 },
  moreButton: { width: 38, height: 38, borderRadius: 7, backgroundColor: "#e8eeeb", alignItems: "center", justifyContent: "center" },
  moreText: { color: "#13201d", fontSize: 18, fontWeight: "900", marginTop: -8 },
  menuBox: { position: "absolute", right: 0, top: 46, zIndex: 50, width: 154, padding: 8, gap: 8, borderWidth: 1, borderColor: "#d8dfdc", borderRadius: 8, backgroundColor: "#fff" },
  eyebrow: { color: "#66736f", fontSize: 12, fontWeight: "900", textTransform: "uppercase" },
  screenTitle: { color: "#13201d", fontSize: 30, fontWeight: "900" },
  metricGrid: { flexDirection: "row", gap: 14 },
  twoColumn: { flexDirection: "row", gap: 14, alignItems: "flex-start" },
  summaryGrid: { flexDirection: "row", gap: 14 },
  oneColumn: { flexDirection: "column" },
  metricCard: { flex: 1, minHeight: 112, padding: 18, borderWidth: 1, borderColor: "#d8dfdc", borderRadius: 8, backgroundColor: "#fff" },
  metricCardCompact: { minHeight: 130 },
  metricLabel: { color: "#66736f", marginBottom: 10, fontWeight: "800" },
  metricValue: { color: "#13201d", fontSize: 28, fontWeight: "900" },
  metricDetail: { marginTop: 10, color: "#66736f", fontWeight: "700", lineHeight: 20 },
  mobileStudio: { gap: 12 },
  mobileHero: { padding: 18, borderWidth: 1, borderColor: "#d8dfdc", borderRadius: 8, backgroundColor: "#fff", gap: 14 },
  mobileHeroLabel: { color: "#66736f", fontSize: 12, fontWeight: "900", textTransform: "uppercase" },
  mobileHeroValue: { color: "#13201d", fontSize: 34, lineHeight: 40, fontWeight: "900" },
  mobileHeroStats: { flexDirection: "row", justifyContent: "space-between", gap: 8, paddingTop: 4 },
  mobileStatLabel: { color: "#66736f", fontSize: 11, fontWeight: "800" },
  mobileStatValue: { color: "#13201d", marginTop: 4, fontSize: 13, fontWeight: "900" },
  quickActions: { flexDirection: "row", gap: 8, flexWrap: "wrap" },
  dashboardHeroRow: { flexDirection: "row", gap: 14, alignItems: "stretch", marginBottom: 14 },
  balancePanel: { flex: 1.6, padding: 18, borderWidth: 1, borderColor: "#d8dfdc", borderRadius: 8, backgroundColor: "#fff", gap: 10 },
  budgetActionPanel: { width: 220, padding: 16, borderWidth: 1, borderColor: "#d8dfdc", borderRadius: 8, backgroundColor: "#fff", gap: 10, justifyContent: "center" },
  periodPickerRow: { alignSelf: "flex-end", minWidth: 160, marginBottom: 4, zIndex: 40 },
  fullWidth: { width: "100%" },
  panel: { flex: 1, padding: 16, borderWidth: 1, borderColor: "#d8dfdc", borderRadius: 8, backgroundColor: "#fff", marginBottom: 14, overflow: "visible" },
  panelHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 },
  panelTitle: { color: "#13201d", fontSize: 16, fontWeight: "900" },
  panelBody: { marginTop: 14, gap: 10 },
  iconButton: { width: 38, height: 38, borderRadius: 7, backgroundColor: "#0f6f5f", alignItems: "center", justifyContent: "center" },
  iconButtonText: { color: "#fff", fontSize: 12, fontWeight: "900" },
  row: { minHeight: 66, padding: 12, borderWidth: 1, borderColor: "#d8dfdc", borderRadius: 8, backgroundColor: "#fbfcfa", flexDirection: "row", alignItems: "center", gap: 12 },
  accountIcon: { width: 42, height: 42, borderRadius: 8, backgroundColor: "#e9f3ef", alignItems: "center", justifyContent: "center" },
  accountIconText: { color: "#0f6f5f", fontWeight: "900", fontSize: 18 },
  smallIcon: { width: 24, height: 24 },
  revenueIcon: { width: 42, height: 42, borderRadius: 8, backgroundColor: "#eaf5dc", alignItems: "center", justifyContent: "center" },
  revenueIconText: { color: "#51751c", fontWeight: "900", fontSize: 14 },
  rowBody: { flex: 1 },
  rowTitle: { color: "#13201d", fontWeight: "900" },
  rowMeta: { color: "#66736f", fontSize: 12, marginTop: 3 },
  rowRight: { alignItems: "flex-end", gap: 8 },
  rowValue: { color: "#13201d", fontWeight: "900", textAlign: "right" },
  positiveValue: { color: "#51751c", fontWeight: "900", textAlign: "right" },
  rowActions: { flexDirection: "row", gap: 8 },
  miniButton: { minHeight: 32, borderWidth: 1, borderColor: "#d8dfdc", borderRadius: 6, backgroundColor: "#fff", alignItems: "center", justifyContent: "center", paddingHorizontal: 10 },
  miniButtonText: { color: "#13201d", fontWeight: "900" },
  dangerText: { color: "#cf4b5c" },
  formActions: { flexDirection: "row", gap: 10, flexWrap: "wrap" },
  segmentRow: { flexDirection: "row", gap: 8, flexWrap: "wrap" },
  autoIconPreview: { flexDirection: "row", alignItems: "center", gap: 10 },
  budgetListItem: { minHeight: 66, padding: 12, borderWidth: 1, borderColor: "#d8dfdc", borderRadius: 8, backgroundColor: "#fbfcfa", flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 },
  checkRow: { minHeight: 42, padding: 10, borderWidth: 1, borderColor: "#d8dfdc", borderRadius: 7, backgroundColor: "#fff", flexDirection: "row", alignItems: "center", gap: 10 },
  checkBox: { width: 22, height: 22, borderWidth: 1, borderColor: "#a8b5b1", borderRadius: 4, textAlign: "center", color: "#0f6f5f", fontWeight: "900" },
  deleteLink: { color: "#cf4b5c", fontWeight: "900" },
  progressTrack: { height: 18, borderRadius: 99, overflow: "hidden", backgroundColor: "#e5ebe8" },
  progressFill: { height: "100%", borderRadius: 99, backgroundColor: "#0f6f5f" },
  rateText: { color: "#66736f", fontSize: 12, fontWeight: "700" },
  selectField: { position: "relative", zIndex: 1 },
  selectFieldOpen: { zIndex: 20 },
  selectButton: { minHeight: 44, borderWidth: 1, borderColor: "#d8dfdc", borderRadius: 7, backgroundColor: "#fff", paddingHorizontal: 12, flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10 },
  selectButtonCompact: { minHeight: 36, minWidth: 112 },
  selectButtonText: { color: "#13201d", fontWeight: "800", flex: 1 },
  selectChevron: { color: "#66736f", fontSize: 11, fontWeight: "900", textTransform: "uppercase" },
  selectMenu: { position: "absolute", top: 72, left: 0, right: 0, maxHeight: 220, borderWidth: 1, borderColor: "#d8dfdc", borderRadius: 7, backgroundColor: "#fff", zIndex: 30 },
  selectSearchWrap: { padding: 8, borderBottomWidth: 1, borderBottomColor: "#eef2ef", backgroundColor: "#fff" },
  selectSearchInput: { minHeight: 38, borderWidth: 1, borderColor: "#d8dfdc", borderRadius: 7, color: "#13201d", paddingHorizontal: 10, fontWeight: "800" },
  selectOption: { minHeight: 40, justifyContent: "center", paddingHorizontal: 12, borderBottomWidth: 1, borderBottomColor: "#eef2ef" },
  selectOptionActive: { backgroundColor: "#e9f3ef" },
  selectOptionText: { color: "#13201d", fontWeight: "800" },
  selectOptionTextActive: { color: "#0f6f5f" },
  selectEmptyText: { color: "#66736f", padding: 14, textAlign: "center", fontWeight: "800" },
  emptyState: { padding: 22, borderWidth: 1, borderStyle: "dashed", borderColor: "#d8dfdc", borderRadius: 8, alignItems: "center" },
  emptyText: { color: "#66736f", fontWeight: "800", textAlign: "center" },
  barItem: { gap: 8 },
  barLabel: { flexDirection: "row", justifyContent: "space-between", gap: 12 },
  barText: { color: "#13201d", fontWeight: "900" },
  barLine: { height: 14, borderRadius: 99, overflow: "hidden", backgroundColor: "#e5ebe8" },
  barFill: { height: "100%", borderRadius: 99, backgroundColor: "#0f6f5f" },
  insightText: { color: "#66736f", lineHeight: 24, fontWeight: "700" },
  chartArea: { height: 190, flexDirection: "row", alignItems: "flex-end", gap: 5, paddingTop: 12 },
  chartColumn: { flex: 1, minWidth: 7, alignItems: "center", gap: 6 },
  chartRail: { height: 150, width: "100%", justifyContent: "flex-end", alignItems: "center", backgroundColor: "#eef2ef", borderRadius: 6, overflow: "hidden" },
  chartBar: { width: "72%", backgroundColor: "#0f6f5f", borderRadius: 5 },
  chartPoint: { width: "52%", backgroundColor: "#d39b25", borderRadius: 99 },
  chartLabel: { color: "#66736f", fontSize: 9, fontWeight: "800" }
});
