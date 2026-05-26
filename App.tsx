import "react-native-url-polyfill/auto";

import AsyncStorage from "@react-native-async-storage/async-storage";
import Constants from "expo-constants";
import { StatusBar } from "expo-status-bar";
import React, { useEffect, useMemo, useState } from "react";
import {
  Alert,
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

type ViewName = "dashboard" | "accounts" | "expenses" | "analytics";
type AuthMode = "signin" | "signup" | "reset";

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
};

const STORAGE_KEY = "myMoneyExpoState";
const categories = ["Housing", "Food", "Transport", "Utilities", "Health", "Education", "Entertainment", "Debt", "Savings", "Other"];
const accountTypes = ["Cash", "Bank account", "Credit card", "Savings", "Investment"];
const currencies = ["USD", "ZAR", "EUR", "GBP", "NGN", "KES", "INR"];
const icons = ["M", "B", "$", "H", "I", "S", "C"];

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
          detectSessionInUrl: false
        }
      })
    : null;

const blankLocalState: LocalState = {
  sessionUserId: null,
  users: [],
  accounts: [],
  expenses: []
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
  const [editingAccountId, setEditingAccountId] = useState<string | null>(null);

  const [authForm, setAuthForm] = useState({ name: "", email: "", password: "", confirmPassword: "" });
  const [accountForm, setAccountForm] = useState({
    name: "Main wallet",
    type: "Cash",
    currency: "USD",
    balance: "0",
    icon: "M"
  });
  const [expenseForm, setExpenseForm] = useState({
    accountId: "",
    category: "Food",
    amount: "",
    date: today(),
    note: ""
  });
  const [expenseFilter, setExpenseFilter] = useState("all");

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
  }, [accounts, expenseForm.accountId]);

  const mainCurrency = accounts[0]?.currency || "USD";
  const metrics = useMemo(() => {
    const month = new Date().toISOString().slice(0, 7);
    const monthSpend = expenses
      .filter((expense) => expense.date.slice(0, 7) === month)
      .reduce((sum, expense) => sum + expense.amount, 0);
    const totalBalance = accounts.reduce((sum, account) => sum + Number(account.balance || 0), 0);
    const liabilities = accounts.reduce((sum, account) => {
      const balance = Number(account.balance || 0);
      return sum + (account.type === "Credit card" ? Math.abs(balance) : Math.max(0, -balance));
    }, 0);
    return { totalBalance, monthSpend, liabilities };
  }, [accounts, expenses]);

  const categoryTotals = useMemo(() => {
    const totals = new Map<string, number>();
    expenses.forEach((expense) => totals.set(expense.category, (totals.get(expense.category) || 0) + expense.amount));
    return Array.from(totals.entries())
      .map(([category, total]) => ({ category, total }))
      .sort((a, b) => b.total - a.total);
  }, [expenses]);

  async function bootstrap() {
    try {
      if (supabase) {
        const { data } = await supabase.auth.getSession();
        if (data.session?.user) {
          setUser(data.session.user);
          await loadRemoteData(data.session.user.id);
        }
        supabase.auth.onAuthStateChange(async (_event, session) => {
          setUser(session?.user || null);
          if (session?.user) await loadRemoteData(session.user.id);
          else {
            setAccounts([]);
            setExpenses([]);
          }
        });
      } else {
        const stored = await AsyncStorage.getItem(STORAGE_KEY);
        const parsed: LocalState = stored ? { ...blankLocalState, ...JSON.parse(stored) } : blankLocalState;
        setLocalState(parsed);
        const active = parsed.users.find((item) => item.id === parsed.sessionUserId) || null;
        setUser(active);
        if (active) {
          setAccounts(parsed.accounts.filter((account) => account.userId === active.id));
          setExpenses(parsed.expenses.filter((expense) => expense.userId === active.id));
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

  async function loadRemoteData(userId: string) {
    if (!supabase) return;
    const [{ data: accountRows, error: accountError }, { data: expenseRows, error: expenseError }] = await Promise.all([
      supabase.from("accounts").select("*").eq("user_id", userId).order("created_at", { ascending: true }),
      supabase.from("expenses").select("*").eq("user_id", userId).order("date", { ascending: false })
    ]);
    if (accountError || expenseError) {
      setNotice("Supabase data could not be loaded. Check the schema in supabase/schema.sql.");
      return;
    }
    setAccounts((accountRows || []).map(accountFromRow));
    setExpenses((expenseRows || []).map(expenseFromRow));
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
        if (authMode === "signup") {
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
      const next = {
        ...localState,
        sessionUserId: localUser.id,
        users: [...localState.users, localUser],
        accounts: [...localState.accounts, firstAccount]
      };
      await persistLocal(next);
      setUser(localUser);
      setAccounts([firstAccount]);
      setExpenses([]);
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
    setNotice("Signed in locally.");
  }

  function validateAuthForm(email: string, password: string) {
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
    setActiveView("dashboard");
  }

  async function saveAccount() {
    if (!user) return;
    const payload = {
      name: accountForm.name.trim(),
      type: accountForm.type,
      currency: accountForm.currency.trim().toUpperCase().slice(0, 3),
      balance: Number(accountForm.balance || 0),
      icon: accountForm.icon
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
        expenses: localState.expenses.filter((expense) => expense.accountId !== id)
      };
      await persistLocal(next);
      setAccounts(next.accounts.filter((account) => account.userId === user.id));
      setExpenses(next.expenses.filter((expense) => expense.userId === user.id));
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

  function editAccount(account: Account) {
    setEditingAccountId(account.id);
    setAccountForm({
      name: account.name,
      type: account.type,
      currency: account.currency,
      balance: String(account.balance),
      icon: account.icon
    });
    setActiveView("accounts");
  }

  function resetAccountForm() {
    setEditingAccountId(null);
    setAccountForm({ name: "", type: "Cash", currency: mainCurrency, balance: "0", icon: "M" });
  }

  const filteredExpenses = expenses
    .filter((expense) => expenseFilter === "all" || expense.accountId === expenseFilter)
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
            <View style={styles.tabs}>
              {(["signin", "signup"] as AuthMode[]).map((mode) => (
                <TabButton key={mode} active={authMode === mode} label={modeLabel(mode)} onPress={() => setAuthMode(mode)} />
              ))}
            </View>
            <Notice text={notice} />
            {authMode === "signup" && (
              <Field
                label="Full name"
                value={authForm.name}
                onChangeText={(name: string) => setAuthForm((current) => ({ ...current, name }))}
                autoComplete="name"
              />
            )}
            <Field
              label="Email"
              value={authForm.email}
              onChangeText={(email: string) => setAuthForm((current) => ({ ...current, email }))}
              keyboardType="email-address"
              autoCapitalize="none"
              autoComplete="email"
              textContentType="emailAddress"
            />
            {authMode !== "reset" && (
              <Field
                label="Password"
                value={authForm.password}
                onChangeText={(password: string) => setAuthForm((current) => ({ ...current, password }))}
                secureTextEntry
                autoComplete={authMode === "signup" ? "new-password" : "current-password"}
                textContentType={authMode === "signup" ? "newPassword" : "password"}
                onSubmitEditing={handleAuth}
              />
            )}
            {authMode === "signup" && (
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
            {authMode === "signup" && <Text style={styles.passwordHint}>Use at least 8 characters.</Text>}
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
        <ScrollView style={styles.content} contentContainerStyle={styles.contentInner}>
          <View style={[styles.topBar, phone && styles.topBarPhone]}>
            <View>
              <Text style={styles.eyebrow}>{new Intl.DateTimeFormat(undefined, { dateStyle: "full" }).format(new Date())}</Text>
              <Text style={styles.screenTitle}>{titleFor(activeView)}</Text>
            </View>
            {!compact && <SecondaryButton label="Sign out" onPress={signOut} />}
          </View>
          <Notice text={notice} />
          {activeView === "dashboard" && renderDashboard()}
          {activeView === "accounts" && renderAccounts()}
          {activeView === "expenses" && renderExpenses()}
          {activeView === "analytics" && renderAnalytics()}
        </ScrollView>
        {compact && <BottomNav activeView={activeView} setActiveView={setActiveView} signOut={signOut} />}
      </View>
    </SafeAreaView>
  );

  function renderDashboard() {
    const recent = filteredExpenses.slice(0, 3);
    return (
      <View>
        <View style={[styles.metricGrid, compact && styles.oneColumn]}>
          <MetricCard label="Total balance" value={formatMoney(metrics.totalBalance, mainCurrency)} />
          <MetricCard label="This month" value={formatMoney(metrics.monthSpend, mainCurrency)} />
          <MetricCard label="Liabilities" value={formatMoney(metrics.liabilities, mainCurrency)} />
        </View>
        <Panel title="Last 28 days">
          <View style={[styles.summaryGrid, phone && styles.oneColumn]}>
            <MetricCard compact label="Expenses" value={formatMoney(lastDaysExpenses(28), mainCurrency)} detail={`${recentItems(expenses, 28).length} tracked entries`} />
            <MetricCard compact label="Top category" value={categoryTotals[0]?.category || "None"} detail={categoryTotals[0] ? formatMoney(categoryTotals[0].total, mainCurrency) : "No spending yet"} />
          </View>
        </Panel>
        <View style={[styles.twoColumn, compact && styles.oneColumn]}>
          <Panel title="Financial accounts" action={<IconButton label="+" onPress={() => setActiveView("accounts")} />}>
            {accounts.slice(0, 3).map((account) => <AccountRow key={account.id} account={account} />)}
            {!accounts.length && <EmptyState text="Create your first account." />}
          </Panel>
          <Panel title="Recent expenses">
            {recent.map((expense) => <ExpenseRow key={expense.id} expense={expense} />)}
            {!recent.length && <EmptyState text="Add an expense to begin tracking." />}
          </Panel>
        </View>
      </View>
    );
  }

  function renderAccounts() {
    return (
      <View style={[styles.twoColumn, compact && styles.oneColumn]}>
        <Panel title={editingAccountId ? "Edit financial account" : "New financial account"}>
          <Field label="Account name" value={accountForm.name} onChangeText={(name: string) => setAccountForm((current) => ({ ...current, name }))} />
          <ChoiceRow label="Type" options={accountTypes} value={accountForm.type} onChange={(type) => setAccountForm((current) => ({ ...current, type }))} />
          <ChoiceRow label="Currency" options={currencies} value={accountForm.currency} onChange={(currency) => setAccountForm((current) => ({ ...current, currency }))} />
          <Field
            label="Balance"
            value={accountForm.balance}
            onChangeText={(balance: string) => setAccountForm((current) => ({ ...current, balance }))}
            keyboardType="decimal-pad"
          />
          <ChoiceRow label="Icon" options={icons} value={accountForm.icon} onChange={(icon) => setAccountForm((current) => ({ ...current, icon }))} />
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
          <ChoiceRow label="Account" options={accounts.map((account) => account.id)} labels={Object.fromEntries(accounts.map((account) => [account.id, account.name]))} value={expenseForm.accountId} onChange={(accountId) => setExpenseForm((current) => ({ ...current, accountId }))} />
          <ChoiceRow label="Category" options={categories} value={expenseForm.category} onChange={(category) => setExpenseForm((current) => ({ ...current, category }))} />
          <Field label="Amount" value={expenseForm.amount} onChangeText={(amount: string) => setExpenseForm((current) => ({ ...current, amount }))} keyboardType="decimal-pad" />
          <Field label="Date" value={expenseForm.date} onChangeText={(date: string) => setExpenseForm((current) => ({ ...current, date }))} placeholder="YYYY-MM-DD" />
          <Field label="Note" value={expenseForm.note} onChangeText={(note: string) => setExpenseForm((current) => ({ ...current, note }))} />
          <PrimaryButton label="Add expense" onPress={addExpense} />
        </Panel>
        <Panel title="Expense history">
          <ChoiceRow label="Filter" options={["all", ...accounts.map((account) => account.id)]} labels={{ all: "All accounts", ...Object.fromEntries(accounts.map((account) => [account.id, account.name])) }} value={expenseFilter} onChange={setExpenseFilter} />
          {filteredExpenses.map((expense) => <ExpenseRow key={expense.id} expense={expense} />)}
          {!filteredExpenses.length && <EmptyState text="No expenses match this account." />}
        </Panel>
      </View>
    );
  }

  function renderAnalytics() {
    const max = Math.max(...categoryTotals.map((item) => item.total), 1);
    return (
      <View style={[styles.twoColumn, compact && styles.oneColumn]}>
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
        <Panel title="AI insight">
          <Text style={styles.insightText}>{generateInsight(expenses, accounts, mainCurrency)}</Text>
        </Panel>
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
          <Text style={styles.accountIconText}>{account.icon}</Text>
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
          <Text style={styles.accountIconText}>{expense.category.slice(0, 1)}</Text>
        </View>
        <View style={styles.rowBody}>
          <Text style={styles.rowTitle}>{expense.category}</Text>
          <Text style={styles.rowMeta}>{account?.name || "Deleted account"} - {expense.note || "No note"} - {expense.date}</Text>
        </View>
        <Text style={styles.rowValue}>{formatMoney(expense.amount, account?.currency || mainCurrency)}</Text>
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

function ChoiceRow({ label, options, labels = {}, value, onChange }: { label: string; options: string[]; labels?: Record<string, string>; value: string; onChange: (value: string) => void }) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.choiceRow}>
        {options.map((option) => (
          <Pressable key={option} onPress={() => onChange(option)} style={[styles.choice, value === option && styles.choiceActive]}>
            <Text style={[styles.choiceText, value === option && styles.choiceTextActive]}>{labels[option] || option}</Text>
          </Pressable>
        ))}
      </ScrollView>
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
        {(["dashboard", "accounts", "expenses", "analytics"] as ViewName[]).map((view) => (
          <Pressable key={view} onPress={() => setActiveView(view)} style={[styles.navItem, activeView === view && styles.navItemActive]}>
            <Text style={[styles.navText, activeView === view && styles.navTextActive]}>{titleFor(view)}</Text>
          </Pressable>
        ))}
      </View>
      <SecondaryButton label="Sign out" onPress={signOut} />
    </View>
  );
}

function BottomNav({ activeView, setActiveView, signOut }: { activeView: ViewName; setActiveView: (view: ViewName) => void; signOut: () => void }) {
  return (
    <View style={styles.bottomNav}>
      {(["dashboard", "accounts", "expenses", "analytics"] as ViewName[]).map((view) => (
        <Pressable key={view} onPress={() => setActiveView(view)} style={[styles.bottomItem, activeView === view && styles.bottomItemActive]}>
          <Text style={[styles.bottomText, activeView === view && styles.bottomTextActive]}>{titleFor(view).split(" ")[0]}</Text>
        </Pressable>
      ))}
      <Pressable onPress={signOut} style={styles.bottomItem}>
        <Text style={styles.bottomText}>Out</Text>
      </Pressable>
    </View>
  );
}

function modeLabel(mode: AuthMode) {
  if (mode === "signin") return "Sign in";
  if (mode === "signup") return "Create";
  return "Reset";
}

function authButtonLabel(mode: AuthMode, busy: boolean) {
  if (busy) return "Please wait...";
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
    analytics: "AI analytics"
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

function recentItems(items: Expense[], days: number) {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  start.setDate(start.getDate() - (days - 1));
  return items.filter((item) => new Date(`${item.date}T00:00:00`) >= start);
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
    icon: "M"
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
    icon: row.icon || "M"
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
  navItem: { minHeight: 44, borderRadius: 7, justifyContent: "center", paddingHorizontal: 13 },
  navItemActive: { backgroundColor: "rgba(255,255,255,0.16)" },
  navText: { color: "rgba(255,255,255,0.76)", fontWeight: "800" },
  navTextActive: { color: "#fff" },
  bottomNav: { position: "absolute", left: 0, right: 0, bottom: 0, minHeight: 74, padding: 8, backgroundColor: "#10231f", flexDirection: "row", gap: 6 },
  bottomItem: { flex: 1, borderRadius: 7, alignItems: "center", justifyContent: "center" },
  bottomItemActive: { backgroundColor: "rgba(255,255,255,0.16)" },
  bottomText: { color: "rgba(255,255,255,0.76)", fontWeight: "800", fontSize: 12 },
  bottomTextActive: { color: "#fff" },
  content: { flex: 1 },
  contentInner: { padding: 28, gap: 14 },
  topBar: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 },
  topBarPhone: { alignItems: "flex-start" },
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
  panel: { flex: 1, padding: 16, borderWidth: 1, borderColor: "#d8dfdc", borderRadius: 8, backgroundColor: "#fff", marginBottom: 14 },
  panelHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 },
  panelTitle: { color: "#13201d", fontSize: 16, fontWeight: "900" },
  panelBody: { marginTop: 14, gap: 10 },
  iconButton: { width: 38, height: 38, borderRadius: 7, backgroundColor: "#0f6f5f", alignItems: "center", justifyContent: "center" },
  iconButtonText: { color: "#fff", fontSize: 20, fontWeight: "900" },
  row: { minHeight: 66, padding: 12, borderWidth: 1, borderColor: "#d8dfdc", borderRadius: 8, backgroundColor: "#fbfcfa", flexDirection: "row", alignItems: "center", gap: 12 },
  accountIcon: { width: 42, height: 42, borderRadius: 8, backgroundColor: "#e9f3ef", alignItems: "center", justifyContent: "center" },
  accountIconText: { color: "#0f6f5f", fontWeight: "900", fontSize: 18 },
  rowBody: { flex: 1 },
  rowTitle: { color: "#13201d", fontWeight: "900" },
  rowMeta: { color: "#66736f", fontSize: 12, marginTop: 3 },
  rowRight: { alignItems: "flex-end", gap: 8 },
  rowValue: { color: "#13201d", fontWeight: "900", textAlign: "right" },
  rowActions: { flexDirection: "row", gap: 8 },
  miniButton: { minHeight: 32, borderWidth: 1, borderColor: "#d8dfdc", borderRadius: 6, backgroundColor: "#fff", alignItems: "center", justifyContent: "center", paddingHorizontal: 10 },
  miniButtonText: { color: "#13201d", fontWeight: "900" },
  dangerText: { color: "#cf4b5c" },
  formActions: { flexDirection: "row", gap: 10, flexWrap: "wrap" },
  choiceRow: { gap: 8, paddingRight: 8 },
  choice: { minHeight: 38, borderWidth: 1, borderColor: "#d8dfdc", borderRadius: 7, backgroundColor: "#fff", paddingHorizontal: 12, alignItems: "center", justifyContent: "center" },
  choiceActive: { backgroundColor: "#0f6f5f", borderColor: "#0f6f5f" },
  choiceText: { color: "#13201d", fontWeight: "800" },
  choiceTextActive: { color: "#fff" },
  emptyState: { padding: 22, borderWidth: 1, borderStyle: "dashed", borderColor: "#d8dfdc", borderRadius: 8, alignItems: "center" },
  emptyText: { color: "#66736f", fontWeight: "800", textAlign: "center" },
  barItem: { gap: 8 },
  barLabel: { flexDirection: "row", justifyContent: "space-between", gap: 12 },
  barText: { color: "#13201d", fontWeight: "900" },
  barLine: { height: 14, borderRadius: 99, overflow: "hidden", backgroundColor: "#e5ebe8" },
  barFill: { height: "100%", borderRadius: 99, backgroundColor: "#0f6f5f" },
  insightText: { color: "#66736f", lineHeight: 24, fontWeight: "700" }
});
