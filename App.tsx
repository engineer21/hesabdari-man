import React, { useState, useEffect, useCallback, useRef } from 'react';
import type {
  Account,
  AppSession,
  AppSettings,
  CheckItem,
  Contact,
  ContactGroup,
  Invoice,
  Loan,
  LoanInstallment,
  PayrollContract,
  PayrollEntry,
  Product,
  ReminderSettings,
  Transaction,
  UserProfile,
  View,
  Warehouse,
} from './types';
import {
  DEFAULT_CONTACT_GROUPS,
  DEFAULT_WAREHOUSES,
  EMPTY_CHART_OF_ACCOUNTS,
  EMPTY_PROFILE,
  EMPTY_REMINDER_SETTINGS,
  EMPTY_SETTINGS,
  APP_NAME,
} from './constants';
import { getDemoBundle } from './utils/demoData';
import { normalizeAttachment } from './utils/attachments';
import {
  logout,
  resolveSession,
  hydrateAuthCache,
  getOwnerAccount,
  getPermissionGroups,
  getStaffUsers,
} from './utils/auth';
import { can, canAccessView, firstAllowedView } from './utils/permissions';
import { SessionAuthProvider } from './hooks/useSessionAuth';
import { FormWorkspaceProvider } from './hooks/useFormWorkspace';
import { apiJson, setAuthToken, setUnauthorizedHandler } from './utils/api';
import { migrateLegacyIfNeeded } from './utils/migrateLocal';
import { restoreToServer } from './utils/backup';

import BottomNav from './components/BottomNav';
import { AppLayout } from './components/AppLayout';
import HomeDashboard from './components/HomeDashboard';
import SimpleTxnPage from './components/SimpleTxnPage';
import TransfersPage from './components/TransfersPage';
import InvoicesPage from './components/InvoicesPage';
import PayrollPage from './components/PayrollPage';
import ChecksPage from './components/ChecksPage';
import LoansPage from './components/LoansPage';
import BanksPage from './components/BanksPage';
import PersonsPage from './components/PersonsPage';
import InventoryPage from './components/InventoryPage';
import ChartOfAccountsPage from './components/ChartOfAccountsPage';
import AccountLedgerReport from './components/AccountLedgerReport';
import TrialBalanceReport from './components/reports/TrialBalanceReport';
import PersonsReportPage from './components/reports/PersonsReportPage';
import TreasuryReportPage from './components/reports/TreasuryReportPage';
import MonthlyBreakdownReport from './components/reports/MonthlyBreakdownReport';
import Reports from './components/Reports';
import Settings from './components/Settings';
import Profile from './components/Profile';
import LoginPage from './components/LoginPage';
import PasswordSettingsForm from './components/settings/PasswordSettingsForm';
import BackupSettingsForm from './components/settings/BackupSettingsForm';
import BusinessSettingsForm from './components/settings/BusinessSettingsForm';
import ReminderSettingsForm from './components/settings/ReminderSettingsForm';
import AccountingDefaultsSettingsForm from './components/settings/AccountingDefaultsSettingsForm';
import AboutModal from './components/AboutModal';
import HelpBrochureModal from './components/HelpBrochureModal';
import ContextualHelpPanel from './components/help/ContextualHelpPanel';
import AccessView from './components/AccessView';
import QuickAddSheet from './components/QuickAddSheet';
import BankTransferModal from './components/BankTransferModal';
import GlobalSearchDialog from './components/search/GlobalSearchDialog';
import type { SearchResult } from './utils/globalSearch';
import { getBankAccounts } from './utils/accountTree';
import { computeBankBalance } from './utils/accountBalance';
import { computeUpcomingReminders } from './utils/accrualEngine';
import { formatNumberWithCommas, toPersianDigits } from './utils/formatters';
import {
  fetchHelpConfig,
  isPageHelpNew,
  markPageHelpSeen,
  saveHelpConfig,
  type HelpConfig,
} from './utils/helpPrefs';
import { resolvePageHelp, viewToBrochureId } from './utils/pageHelp';

function sanitizeAccounts(list: Account[]): Account[] {
  return list.filter(
    (a) => a.module === 'income' || a.module === 'expense' || a.module === 'bank'
  );
}

function sanitizeTransactions(list: Transaction[]): Transaction[] {
  return list
    .filter((t) => t.type === 'income' || t.type === 'expense' || t.type === 'transfer')
    .map((t) => ({
      ...t,
      type: t.type as 'income' | 'expense' | 'transfer',
      contactId: t.contactId,
      attachment: normalizeAttachment(t.attachment),
    }));
}

function sanitizeContacts(list: Contact[]): Contact[] {
  return list.map((c) => ({
    ...c,
    picture: c.picture || undefined,
  }));
}

function sanitizeInvoices(list: Invoice[]): Invoice[] {
  return list.map((inv) => ({
    ...inv,
    attachment: normalizeAttachment(inv.attachment),
  }));
}

type DomainState = {
  accounts: Account[];
  transactions: Transaction[];
  contactGroups: ContactGroup[];
  contacts: Contact[];
  warehouses: Warehouse[];
  products: Product[];
  invoices: Invoice[];
  payrollContracts: PayrollContract[];
  payrollEntries: PayrollEntry[];
  checks: CheckItem[];
  loans: Loan[];
  loanInstallments: LoanInstallment[];
  reminderSettings: ReminderSettings;
  userProfile: UserProfile;
  appSettings: AppSettings;
};

const emptyDomain = (): DomainState => ({
  accounts: EMPTY_CHART_OF_ACCOUNTS,
  transactions: [],
  contactGroups: DEFAULT_CONTACT_GROUPS,
  contacts: [],
  warehouses: DEFAULT_WAREHOUSES,
  products: [],
  invoices: [],
  payrollContracts: [],
  payrollEntries: [],
  checks: [],
  loans: [],
  loanInstallments: [],
  reminderSettings: EMPTY_REMINDER_SETTINGS,
  userProfile: EMPTY_PROFILE,
  appSettings: EMPTY_SETTINGS,
});

const App: React.FC = () => {
  const [theme, setTheme] = useState<'light' | 'dark'>('light');
  const [domain, setDomain] = useState<DomainState>(emptyDomain);
  const [bootstrapping, setBootstrapping] = useState(false);
  const [activeView, setActiveView] = useState<View>('dashboard');
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [session, setSession] = useState<AppSession | null>(null);
  const [reportAccountId, setReportAccountId] = useState<string | undefined>();
  const [isAboutOpen, setIsAboutOpen] = useState(false);
  const [isHelpOpen, setIsHelpOpen] = useState(false);
  const [helpBrochureSection, setHelpBrochureSection] = useState<string | undefined>();
  const [pageHelpOpen, setPageHelpOpen] = useState(false);
  const [pageHelpFirstVisit, setPageHelpFirstVisit] = useState(false);
  const [helpConfig, setHelpConfig] = useState<HelpConfig>({
    showHelpOnLogin: false,
    seenPages: [],
  });
  const [quickAddOpen, setQuickAddOpen] = useState(false);
  const [transferOpen, setTransferOpen] = useState(false);
  const [transferFromBankId, setTransferFromBankId] = useState<string | undefined>();
  const [txnAutoOpen, setTxnAutoOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [personsInitialContactId, setPersonsInitialContactId] = useState<string | undefined>();
  const [personsInitialTab, setPersonsInitialTab] = useState<'groups' | 'people' | undefined>();
  const [syncError, setSyncError] = useState('');

  const openTransfer = useCallback((fromBankId?: string) => {
    setTransferFromBankId(fromBankId);
    setTransferOpen(true);
  }, []);

  const skipNextSync = useRef(true);
  const skipNextThemeSync = useRef(true);
  const syncTimer = useRef<number | null>(null);
  const syncGen = useRef(0);
  const domainRef = useRef(domain);
  domainRef.current = domain;
  const syncingRef = useRef(false);

  const {
    accounts,
    transactions,
    contactGroups,
    contacts,
    warehouses,
    products,
    invoices,
    payrollContracts,
    payrollEntries,
    checks,
    loans,
    loanInstallments,
    reminderSettings,
    userProfile,
    appSettings,
  } = domain;

  const flushDomainToServer = useCallback(async () => {
    if (!isLoggedIn) return;
    const gen = ++syncGen.current;
    const snapshot = domainRef.current;
    syncingRef.current = true;
    try {
      setSyncError('');
      await apiJson('/api/state', 'PUT', {
        accounts: snapshot.accounts,
        transactions: snapshot.transactions,
        contactGroups: snapshot.contactGroups,
        contacts: snapshot.contacts,
        warehouses: snapshot.warehouses,
        products: snapshot.products,
        invoices: snapshot.invoices,
        payrollContracts: snapshot.payrollContracts,
        payrollEntries: snapshot.payrollEntries,
        checks: snapshot.checks,
        loans: snapshot.loans,
        loanInstallments: snapshot.loanInstallments,
        reminderSettings: snapshot.reminderSettings,
        userProfile: snapshot.userProfile,
        appSettings: snapshot.appSettings,
      });
      // A newer edit started while we were saving — schedule another flush
      if (gen !== syncGen.current) {
        window.setTimeout(() => {
          void flushDomainToServer();
        }, 50);
      }
    } catch (e: any) {
      if (gen === syncGen.current) {
        setSyncError(e?.message || 'خطا در ذخیره روی سرور');
      }
    } finally {
      if (gen === syncGen.current) syncingRef.current = false;
    }
  }, [isLoggedIn]);

  const applyServerState = useCallback((data: any) => {
    hydrateAuthCache({
      session: data.session,
      ownerPublic: data.ownerPublic,
      owner: data.owner,
      permissionGroups: data.permissionGroups,
      staffUsers: data.staffUsers,
    });
    skipNextSync.current = true;
    skipNextThemeSync.current = true;
    setDomain({
      accounts: sanitizeAccounts(data.accounts || EMPTY_CHART_OF_ACCOUNTS),
      transactions: sanitizeTransactions(data.transactions || []),
      contactGroups: data.contactGroups || [],
      contacts: sanitizeContacts(data.contacts || []),
      warehouses:
        Array.isArray(data.warehouses) && data.warehouses.length > 0
          ? data.warehouses
          : DEFAULT_WAREHOUSES,
      products: Array.isArray(data.products) ? data.products : [],
      invoices: sanitizeInvoices(data.invoices || []),
      payrollContracts: data.payrollContracts || [],
      payrollEntries: data.payrollEntries || [],
      checks: data.checks || [],
      loans: data.loans || [],
      loanInstallments: data.loanInstallments || [],
      reminderSettings: {
        ...EMPTY_REMINDER_SETTINGS,
        ...(data.reminderSettings || {}),
      },
      userProfile: data.userProfile || EMPTY_PROFILE,
      appSettings: data.appSettings || EMPTY_SETTINGS,
    });
    if (data.prefs?.theme === 'dark' || data.prefs?.theme === 'light') {
      setTheme(data.prefs.theme);
    }
    if (data.session) setSession(data.session);
  }, []);

  const loadState = useCallback(async () => {
    const data = await apiJson<any>('/api/state', 'GET');
    applyServerState(data);
    return data;
  }, [applyServerState]);

  useEffect(() => {
    setUnauthorizedHandler(() => {
      setAuthToken(null);
      setSession(null);
      setIsLoggedIn(false);
    });
    return () => setUnauthorizedHandler(null);
  }, []);

  useEffect(() => {
    if (theme === 'dark') document.documentElement.classList.add('dark');
    else document.documentElement.classList.remove('dark');
  }, [theme]);

  // Persist theme only when user changes it (not on hydrate)
  useEffect(() => {
    if (!isLoggedIn) return;
    if (skipNextThemeSync.current) {
      skipNextThemeSync.current = false;
      return;
    }
    void apiJson('/api/prefs', 'PUT', { theme }).catch(() => {});
  }, [theme, isLoggedIn]);

  useEffect(() => {
    if (!isLoggedIn) return;
    void fetchHelpConfig().then(setHelpConfig);
  }, [isLoggedIn]);

  // Debounced domain sync — uses latest ref + generation to avoid stale overwrites
  useEffect(() => {
    if (!isLoggedIn) return;
    if (skipNextSync.current) {
      skipNextSync.current = false;
      return;
    }
    if (syncTimer.current) window.clearTimeout(syncTimer.current);
    syncTimer.current = window.setTimeout(() => {
      void flushDomainToServer();
    }, 450);
    return () => {
      if (syncTimer.current) window.clearTimeout(syncTimer.current);
    };
  }, [
    accounts,
    transactions,
    contactGroups,
    contacts,
    warehouses,
    products,
    invoices,
    payrollContracts,
    payrollEntries,
    checks,
    loans,
    loanInstallments,
    reminderSettings,
    userProfile,
    appSettings,
    isLoggedIn,
    flushDomainToServer,
  ]);

  const handleLoginSuccess = async () => {
    setBootstrapping(true);
    try {
      await migrateLegacyIfNeeded();
      const data = await loadState();
      const s = data.session || resolveSession();
      setSession(s);
      setIsLoggedIn(!!s);
      if (s) setActiveView(firstAllowedView(s));
    } catch (e: any) {
      setSyncError(e?.message || 'بارگذاری داده ناموفق بود');
      const s = resolveSession();
      setSession(s);
      setIsLoggedIn(!!s);
    } finally {
      setBootstrapping(false);
    }
  };

  const handleViewChange = (view: View) => {
    if (session && !canAccessView(session, view)) return;
    setActiveView(view);
  };

  const handleLogout = async () => {
    if (syncTimer.current) window.clearTimeout(syncTimer.current);
    try {
      await flushDomainToServer();
    } catch {
      /* best-effort */
    }
    await logout();
    setSession(null);
    setIsLoggedIn(false);
    setDomain(emptyDomain());
    setPageHelpOpen(false);
    setIsHelpOpen(false);
    setHelpBrochureSection(undefined);
  };

  const openFullHelp = useCallback((sectionId?: string) => {
    setHelpBrochureSection(sectionId);
    setIsHelpOpen(true);
  }, []);

  const openPageHelp = useCallback(() => {
    const pageId = activeView;
    const isNew = isPageHelpNew(pageId, helpConfig.seenPages);
    setPageHelpFirstVisit(isNew);
    setPageHelpOpen(true);
    if (isNew) {
      void markPageHelpSeen(pageId, helpConfig.seenPages).then((seenPages) => {
        setHelpConfig((prev) => ({ ...prev, seenPages }));
      });
    }
  }, [activeView, helpConfig.seenPages]);

  const handleShowHelpOnLoginChange = useCallback(async (value: boolean) => {
    setHelpConfig((prev) => ({ ...prev, showHelpOnLogin: value }));
    try {
      const next = await saveHelpConfig({ showHelpOnLogin: value });
      setHelpConfig(next);
    } catch {
      /* keep optimistic value */
    }
  }, []);

  const openAccountReport = (accountId: string) => {
    setReportAccountId(accountId);
    setActiveView('account-ledger-report');
  };

  const openPersonLedger = (contactId: string) => {
    setPersonsInitialContactId(contactId);
    setPersonsInitialTab('people');
    handleViewChange('persons');
  };

  const handleSearchSelect = (result: SearchResult) => {
    switch (result.kind) {
      case 'account-report':
        if ('accountId' in result.payload) openAccountReport(result.payload.accountId);
        break;
      case 'contact':
        if ('contactId' in result.payload) {
          setPersonsInitialContactId(result.payload.contactId);
          setPersonsInitialTab('people');
          handleViewChange('persons');
        }
        break;
      case 'contact-group':
        setPersonsInitialContactId(undefined);
        setPersonsInitialTab('groups');
        handleViewChange('persons');
        break;
      case 'transaction':
        if ('txnType' in result.payload) handleViewChange(result.payload.txnType);
        break;
      case 'navigation':
        if ('view' in result.payload) handleViewChange(result.payload.view);
        break;
      default:
        break;
    }
  };

  useEffect(() => {
    if (!isLoggedIn) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
        const tag = (event.target as HTMLElement | null)?.tagName;
        if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
        event.preventDefault();
        setSearchOpen(true);
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [isLoggedIn]);

  const patchDomain = (partial: Partial<DomainState> | ((prev: DomainState) => DomainState)) => {
    setDomain((prev) => (typeof partial === 'function' ? partial(prev) : { ...prev, ...partial }));
  };

  const setAccounts = (v: Account[] | ((p: Account[]) => Account[])) => {
    patchDomain((prev) => ({
      ...prev,
      accounts: typeof v === 'function' ? v(prev.accounts) : v,
    }));
  };
  const setTransactions = (v: Transaction[] | ((p: Transaction[]) => Transaction[])) => {
    patchDomain((prev) => ({
      ...prev,
      transactions: typeof v === 'function' ? v(prev.transactions) : v,
    }));
  };
  const setContactGroups = (v: ContactGroup[] | ((p: ContactGroup[]) => ContactGroup[])) => {
    patchDomain((prev) => ({
      ...prev,
      contactGroups: typeof v === 'function' ? v(prev.contactGroups) : v,
    }));
  };
  const setContacts = (v: Contact[] | ((p: Contact[]) => Contact[])) => {
    patchDomain((prev) => ({
      ...prev,
      contacts: typeof v === 'function' ? v(prev.contacts) : v,
    }));
  };
  const setUserProfile = (v: UserProfile | ((p: UserProfile) => UserProfile)) => {
    patchDomain((prev) => ({
      ...prev,
      userProfile: typeof v === 'function' ? v(prev.userProfile) : v,
    }));
  };
  const setAppSettings = (v: AppSettings | ((p: AppSettings) => AppSettings)) => {
    patchDomain((prev) => ({
      ...prev,
      appSettings: typeof v === 'function' ? v(prev.appSettings) : v,
    }));
  };
  const setWarehouses = (v: Warehouse[] | ((p: Warehouse[]) => Warehouse[])) => {
    patchDomain((prev) => ({
      ...prev,
      warehouses: typeof v === 'function' ? v(prev.warehouses) : v,
    }));
  };
  const setProducts = (v: Product[] | ((p: Product[]) => Product[])) => {
    patchDomain((prev) => ({
      ...prev,
      products: typeof v === 'function' ? v(prev.products) : v,
    }));
  };
  const setInvoices = (v: Invoice[] | ((p: Invoice[]) => Invoice[])) => {
    patchDomain((prev) => ({
      ...prev,
      invoices: typeof v === 'function' ? v(prev.invoices) : v,
    }));
  };
  const setPayrollContracts = (v: PayrollContract[] | ((p: PayrollContract[]) => PayrollContract[])) => {
    patchDomain((prev) => ({
      ...prev,
      payrollContracts: typeof v === 'function' ? v(prev.payrollContracts) : v,
    }));
  };
  const setPayrollEntries = (v: PayrollEntry[] | ((p: PayrollEntry[]) => PayrollEntry[])) => {
    patchDomain((prev) => ({
      ...prev,
      payrollEntries: typeof v === 'function' ? v(prev.payrollEntries) : v,
    }));
  };
  const setChecks = (v: CheckItem[] | ((p: CheckItem[]) => CheckItem[])) => {
    patchDomain((prev) => ({
      ...prev,
      checks: typeof v === 'function' ? v(prev.checks) : v,
    }));
  };
  const setLoans = (v: Loan[] | ((p: Loan[]) => Loan[])) => {
    patchDomain((prev) => ({
      ...prev,
      loans: typeof v === 'function' ? v(prev.loans) : v,
    }));
  };
  const setLoanInstallments = (v: LoanInstallment[] | ((p: LoanInstallment[]) => LoanInstallment[])) => {
    patchDomain((prev) => ({
      ...prev,
      loanInstallments: typeof v === 'function' ? v(prev.loanInstallments) : v,
    }));
  };
  const setReminderSettings = (v: ReminderSettings | ((p: ReminderSettings) => ReminderSettings)) => {
    patchDomain((prev) => ({
      ...prev,
      reminderSettings: typeof v === 'function' ? v(prev.reminderSettings) : v,
    }));
  };

  const saveTx = (entryData: Omit<Transaction, 'id'> | Transaction) => {
    if ('id' in entryData && entryData.id) {
      const next = entryData as Transaction;
      setTransactions((prev) => prev.map((t) => (t.id === next.id ? next : t)));
    } else {
      const { id: _ignored, ...rest } = entryData as Transaction & { id?: string };
      setTransactions((prev) => [...prev, { ...rest, id: `tx_${crypto.randomUUID()}` }]);
    }
  };

  const saveCheck = (checkData: Omit<CheckItem, 'id'> | CheckItem) => {
    if ('id' in checkData && checkData.id) {
      const next = checkData as CheckItem;
      setChecks((prev) => prev.map((c) => (c.id === next.id ? next : c)));
    } else {
      const { id: _ignored, ...rest } = checkData as CheckItem & { id?: string };
      setChecks((prev) => [...prev, { ...rest, id: `chk_${crypto.randomUUID()}` }]);
    }
  };

  const deleteTx = (id: string) => {
    setTransactions((prev) => prev.filter((t) => t.id !== id));
  };

  const handleLoadDemo = async () => {
    const demo = getDemoBundle();
    try {
      const data = await apiJson<any>('/api/demo/load', 'POST', {
        accounts: demo.accounts,
        transactions: demo.transactions,
        contactGroups: demo.contactGroups,
        contacts: demo.contacts,
        warehouses: demo.warehouses,
        products: demo.products,
        invoices: demo.invoices,
        userProfile: demo.userProfile,
        appSettings: demo.appSettings,
      });
      applyServerState({ ...data, session });
    } catch (e: any) {
      setSyncError(e?.message || 'بارگذاری دمو ناموفق');
    }
  };

  const handleClearAllData = async () => {
    try {
      const data = await apiJson<any>('/api/data/clear', 'POST', {});
      applyServerState({ ...data, session });
    } catch (e: any) {
      setSyncError(e?.message || 'پاک‌سازی ناموفق');
    }
  };

  const handleFactoryReset = () => {
    void handleLoadDemo();
  };

  const handleRestore = async (payload: any) => {
    try {
      // Already applied on server (restore from vault id)
      if (payload?.__serverApplied) {
        applyServerState({ ...payload, session: payload.session || session });
        return;
      }
      const data = await restoreToServer({
        accounts: Array.isArray(payload.accounts) ? sanitizeAccounts(payload.accounts) : undefined,
        transactions: Array.isArray(payload.transactions)
          ? sanitizeTransactions(payload.transactions)
          : undefined,
        contactGroups: payload.contactGroups,
        contacts: Array.isArray(payload.contacts) ? sanitizeContacts(payload.contacts) : undefined,
        warehouses: Array.isArray(payload.warehouses) ? payload.warehouses : undefined,
        products: Array.isArray(payload.products) ? payload.products : undefined,
        invoices: Array.isArray(payload.invoices) ? sanitizeInvoices(payload.invoices) : undefined,
        payrollContracts: payload.payrollContracts,
        payrollEntries: payload.payrollEntries,
        checks: payload.checks,
        loans: payload.loans,
        loanInstallments: payload.loanInstallments,
        reminderSettings: payload.reminderSettings,
        userProfile: payload.userProfile,
        appSettings: payload.appSettings,
        owner: payload.owner,
        permissionGroups: payload.permissionGroups,
        staffUsers: payload.staffUsers,
        prefs: payload.prefs,
      });
      applyServerState({ ...data, session: data.session || session });
    } catch (e: any) {
      setSyncError(e?.message || 'بازیابی ناموفق');
    }
  };

  if (!isLoggedIn || !session) {
    return (
      <LoginPage
        theme={theme}
        setTheme={setTheme}
        onLoginSuccess={() => void handleLoginSuccess()}
        bootstrapping={bootstrapping}
      />
    );
  }

  const backupPayload = {
    version: 8,
    app: APP_NAME,
    accounts,
    transactions,
    contactGroups,
    contacts,
    warehouses,
    products,
    invoices,
    payrollContracts,
    payrollEntries,
    checks,
    loans,
    loanInstallments,
    reminderSettings,
    userProfile,
    appSettings,
    owner: getOwnerAccount(),
    permissionGroups: getPermissionGroups(),
    staffUsers: getStaffUsers(),
  };

  const activeBanks = getBankAccounts(accounts);
  const upcomingReminders = computeUpcomingReminders(
    checks,
    loans,
    loanInstallments,
    contacts,
    reminderSettings
  );

  const renderView = () => {
    switch (activeView) {
      case 'dashboard':
        return (
          <HomeDashboard
            accounts={accounts}
            transactions={transactions}
            contacts={contacts}
            contactGroups={contactGroups}
            invoices={invoices}
            payrollEntries={payrollEntries}
            checks={checks}
            loans={loans}
            loanInstallments={loanInstallments}
            upcomingReminders={upcomingReminders}
            session={session}
            userProfile={userProfile}
            onNavigate={handleViewChange}
            onOpenAccountReport={openAccountReport}
            onQuickAdd={() => setQuickAddOpen(true)}
            onOpenTransfer={() => openTransfer()}
          />
        );
      case 'income':
        return (
          <SimpleTxnPage
            key="income"
            mode="income"
            accounts={accounts}
            transactions={transactions}
            contactGroups={contactGroups}
            contacts={contacts}
            invoices={invoices}
            checks={checks}
            onSave={saveTx}
            onSaveCheck={saveCheck}
            onDelete={deleteTx}
            autoOpen={txnAutoOpen}
            onAutoOpenConsumed={() => setTxnAutoOpen(false)}
            settings={appSettings}
          />
        );
      case 'expense':
        return (
          <SimpleTxnPage
            key="expense"
            mode="expense"
            accounts={accounts}
            transactions={transactions}
            contactGroups={contactGroups}
            contacts={contacts}
            invoices={invoices}
            checks={checks}
            onSave={saveTx}
            onSaveCheck={saveCheck}
            onDelete={deleteTx}
            autoOpen={txnAutoOpen}
            onAutoOpenConsumed={() => setTxnAutoOpen(false)}
            settings={appSettings}
          />
        );
      case 'invoices':
        return (
          <InvoicesPage
            accounts={accounts}
            contacts={contacts}
            contactGroups={contactGroups}
            warehouses={warehouses}
            products={products}
            setProducts={setProducts}
            invoices={invoices}
            setInvoices={setInvoices}
            transactions={transactions}
            setTransactions={setTransactions}
            onSaveTx={saveTx}
            onDeleteTx={deleteTx}
            checks={checks}
            setChecks={setChecks}
            onSaveCheck={saveCheck}
            settings={appSettings}
          />
        );
      case 'payroll':
        return (
          <PayrollPage
            accounts={accounts}
            contacts={contacts}
            contactGroups={contactGroups}
            contracts={payrollContracts}
            setContracts={setPayrollContracts}
            entries={payrollEntries}
            setEntries={setPayrollEntries}
            invoices={invoices}
            checks={checks}
            transactions={transactions}
            onSaveTx={saveTx}
            onOpenPersons={() => handleViewChange('persons')}
            onOpenChartOfAccounts={() => handleViewChange('chartOfAccounts')}
            settings={appSettings}
          />
        );
      case 'checks':
        return (
          <ChecksPage
            accounts={accounts}
            contacts={contacts}
            invoices={invoices}
            checks={checks}
            setChecks={setChecks}
            onSaveTx={saveTx}
            onDeleteTx={deleteTx}
            reminderSettings={reminderSettings}
            settings={appSettings}
          />
        );
      case 'loans':
        return (
          <LoansPage
            accounts={accounts}
            loans={loans}
            setLoans={setLoans}
            installments={loanInstallments}
            setInstallments={setLoanInstallments}
            onSaveTx={saveTx}
            onDeleteTx={deleteTx}
            settings={appSettings}
          />
        );
      case 'transfers':
        return (
          <TransfersPage
            accounts={accounts}
            transactions={transactions}
            onSave={saveTx}
            onDelete={deleteTx}
            settings={appSettings}
          />
        );
      case 'banks':
        return (
          <BanksPage
            accounts={accounts}
            setAccounts={setAccounts}
            transactions={transactions}
            contacts={contacts}
            contactGroups={contactGroups}
            onOpenReport={openAccountReport}
            onOpenTransfer={openTransfer}
            settings={appSettings}
          />
        );
      case 'persons':
        return (
          <PersonsPage
            accounts={accounts}
            groups={contactGroups}
            setGroups={setContactGroups}
            contacts={contacts}
            setContacts={setContacts}
            transactions={transactions}
            invoices={invoices}
            payrollEntries={payrollEntries}
            checks={checks}
            onSaveTx={saveTx}
            onSaveCheck={saveCheck}
            initialContactId={personsInitialContactId}
            initialTab={personsInitialTab}
            onInitialConsumed={() => {
              setPersonsInitialContactId(undefined);
              setPersonsInitialTab(undefined);
            }}
            settings={appSettings}
          />
        );
      case 'inventory':
        return (
          <InventoryPage
            warehouses={warehouses}
            setWarehouses={setWarehouses}
            products={products}
            setProducts={setProducts}
            invoices={invoices}
            contacts={contacts}
            settings={appSettings}
          />
        );
      case 'chartOfAccounts':
        return (
          <ChartOfAccountsPage
            accounts={accounts}
            setAccounts={setAccounts}
            transactions={transactions}
            invoices={invoices}
            payrollEntries={payrollEntries}
            onOpenReport={openAccountReport}
            onOpenAccountingDefaults={() => handleViewChange('settingsAccountingDefaults')}
            settings={appSettings}
          />
        );
      case 'reports':
        return (
          <Reports
            onNavigate={handleViewChange}
            accounts={accounts}
            transactions={transactions}
            invoices={invoices}
            payrollEntries={payrollEntries}
            checks={checks}
            contacts={contacts}
            onOpenLedger={openAccountReport}
          />
        );
      case 'monthly-report':
        return (
          <MonthlyBreakdownReport
            accounts={accounts}
            contacts={contacts}
            transactions={transactions}
            invoices={invoices}
            payrollEntries={payrollEntries}
            checks={checks}
            settings={appSettings}
          />
        );
      case 'account-ledger-report':
        return (
          <AccountLedgerReport
            accounts={accounts}
            transactions={transactions}
            invoices={invoices}
            payrollEntries={payrollEntries}
            contacts={contacts}
            contactGroups={contactGroups}
            settings={appSettings}
            initialAccountId={reportAccountId}
            onBack={() => handleViewChange('reports')}
          />
        );
      case 'trial-balance-report':
        return (
          <TrialBalanceReport
            accounts={accounts}
            transactions={transactions}
            invoices={invoices}
            payrollEntries={payrollEntries}
            settings={appSettings}
            onOpenLedger={openAccountReport}
          />
        );
      case 'persons-report':
        return (
          <PersonsReportPage
            contacts={contacts}
            contactGroups={contactGroups}
            transactions={transactions}
            invoices={invoices}
            payrollEntries={payrollEntries}
            checks={checks}
            settings={appSettings}
            onOpenPerson={openPersonLedger}
          />
        );
      case 'treasury-report':
        return (
          <TreasuryReportPage
            accounts={accounts}
            transactions={transactions}
            settings={appSettings}
            onOpenLedger={openAccountReport}
            onOpenTransfer={
              activeBanks.length >= 2 && can(session, 'journals.create')
                ? () => openTransfer()
                : undefined
            }
          />
        );
      case 'access':
        return <AccessView onSessionChange={setSession} />;
      case 'settings':
        return (
          <Settings
            onNavigate={handleViewChange}
            onLogout={() => void handleLogout()}
            onOpenHelp={() => openFullHelp()}
            theme={theme}
            setTheme={setTheme}
            appSettings={appSettings}
            showHelpOnLogin={helpConfig.showHelpOnLogin}
            onShowHelpOnLoginChange={(v) => void handleShowHelpOnLoginChange(v)}
          />
        );
      case 'profile':
        return (
          <Profile
            userProfile={userProfile}
            setUserProfile={setUserProfile}
            onLogout={() => void handleLogout()}
          />
        );
      case 'settingsPassword':
        return <PasswordSettingsForm />;
      case 'settingsBusiness':
        return <BusinessSettingsForm appSettings={appSettings} setAppSettings={setAppSettings} />;
      case 'settingsAccountingDefaults':
        return (
          <AccountingDefaultsSettingsForm
            accounts={accounts}
            setAccounts={setAccounts}
            contactGroups={contactGroups}
            setContactGroups={setContactGroups}
            warehouses={warehouses}
            appSettings={appSettings}
            setAppSettings={setAppSettings}
            activityCounts={{
              transactionsCount: transactions.length,
              invoicesCount: invoices.length,
              payrollEntriesCount: payrollEntries.length,
              checksCount: checks.length,
              loansCount: loans.length,
            }}
            onNavigate={handleViewChange}
          />
        );
      case 'settingsReminders':
        return (
          <ReminderSettingsForm
            reminderSettings={reminderSettings}
            setReminderSettings={setReminderSettings}
          />
        );
      case 'settingsBackup':
        return (
          <BackupSettingsForm
            allData={backupPayload}
            onRestore={(data) => void handleRestore(data)}
            onFactoryReset={handleFactoryReset}
            onLoadDemo={() => void handleLoadDemo()}
            onClearAllData={() => void handleClearAllData()}
          />
        );
      default:
        return (
          <HomeDashboard
            accounts={accounts}
            transactions={transactions}
            contacts={contacts}
            contactGroups={contactGroups}
            invoices={invoices}
            payrollEntries={payrollEntries}
            checks={checks}
            loans={loans}
            loanInstallments={loanInstallments}
            upcomingReminders={upcomingReminders}
            session={session}
            userProfile={userProfile}
            onNavigate={handleViewChange}
            onOpenAccountReport={openAccountReport}
            onQuickAdd={() => setQuickAddOpen(true)}
            onOpenTransfer={() => openTransfer()}
          />
        );
    }
  };

  const appAlerts: {
    id: string;
    title: string;
    detail?: string;
    tone?: 'warning' | 'danger' | 'info';
    onClick?: () => void;
  }[] = [];
  if (syncError) {
    appAlerts.push({
      id: 'sync-error',
      title: 'خطا در همگام‌سازی سرور',
      detail: syncError,
      tone: 'danger',
      onClick: () => void flushDomainToServer(),
    });
  }
  for (const rem of upcomingReminders) {
    const dueText =
      rem.daysUntilDue < 0
        ? `${toPersianDigits(Math.abs(rem.daysUntilDue))} روز گذشته`
        : rem.daysUntilDue === 0
          ? 'سررسید امروز'
          : `${toPersianDigits(rem.daysUntilDue)} روز دیگر`;
    appAlerts.push({
      id: rem.id,
      title: rem.title,
      detail: `${toPersianDigits(formatNumberWithCommas(Math.round(rem.amount)))} تومان · ${dueText}`,
      tone: rem.overdue ? 'danger' : rem.daysUntilDue === 0 ? 'warning' : 'info',
      onClick: () => handleViewChange(rem.targetView),
    });
  }
  if (activeBanks.length === 0) {
    appAlerts.push({
      id: 'no-banks',
      title: 'هنوز حساب بانکی تعریف نشده است',
      detail: 'برای ثبت درآمد و هزینه حداقل یک بانک یا صندوق اضافه کنید.',
      tone: 'warning',
      onClick: () => handleViewChange('banks'),
    });
  } else {
    for (const b of activeBanks) {
      const bal = computeBankBalance(b, transactions);
      if (bal < 0) {
        appAlerts.push({
          id: `neg-${b.id}`,
          title: `موجودی منفی در ${b.name}`,
          detail: 'گردش حساب را بررسی کنید.',
          tone: 'warning',
          onClick: () => openAccountReport(b.id),
        });
      }
    }
  }

  return (
    <SessionAuthProvider session={session}>
      <FormWorkspaceProvider>
      {syncError ? (
        <div className="fixed left-0 right-0 top-0 z-[100] bg-rose-600 px-3 py-2 text-center text-sm text-white">
          {syncError}
        </div>
      ) : null}
      <AppLayout
        view={activeView}
        onViewChange={handleViewChange}
        store={appSettings}
        session={session}
        onLogout={() => void handleLogout()}
        onAbout={() => setIsAboutOpen(true)}
        onOpenHelp={() => openFullHelp()}
        onOpenPageHelp={openPageHelp}
        pageHelpEmphasize={isPageHelpNew(activeView, helpConfig.seenPages)}
        onOpenSearch={() => setSearchOpen(true)}
        theme={theme}
        setTheme={setTheme}
        userPicture={userProfile.picture}
        onFabClick={() => setQuickAddOpen(true)}
        fabOpen={quickAddOpen}
        onOpenTransfer={() => openTransfer()}
        canTransfer={activeBanks.length >= 2 && can(session, 'journals.create')}
        alerts={appAlerts}
        mobileFooter={
          <BottomNav
            activeView={activeView}
            onViewChange={handleViewChange}
            onFabClick={() => setQuickAddOpen(true)}
            session={session}
          />
        }
      >
        {renderView()}
      </AppLayout>

      <QuickAddSheet
        open={quickAddOpen}
        onClose={() => setQuickAddOpen(false)}
        onNavigate={(view) => {
          if (view === 'income' || view === 'expense') setTxnAutoOpen(true);
          handleViewChange(view);
        }}
        onOpenTransfer={() => openTransfer()}
        hasBank={activeBanks.length > 0}
        canTransfer={activeBanks.length >= 2 && can(session, 'journals.create')}
      />

      <BankTransferModal
        open={transferOpen}
        onClose={() => {
          setTransferOpen(false);
          setTransferFromBankId(undefined);
        }}
        accounts={accounts}
        transactions={transactions}
        initialFromBankId={transferFromBankId}
        onSaveTransfer={saveTx}
      />

      {isAboutOpen ? <AboutModal onClose={() => setIsAboutOpen(false)} /> : null}

      <ContextualHelpPanel
        open={pageHelpOpen}
        onClose={() => setPageHelpOpen(false)}
        content={resolvePageHelp(activeView)}
        isFirstVisit={pageHelpFirstVisit}
        onOpenFullGuide={() => openFullHelp(viewToBrochureId(activeView))}
      />

      <HelpBrochureModal
        isOpen={isHelpOpen}
        onClose={() => {
          setIsHelpOpen(false);
          setHelpBrochureSection(undefined);
        }}
        storeName={APP_NAME}
        isLoggedIn
        initialSectionId={helpBrochureSection}
      />

      <GlobalSearchDialog
        open={searchOpen}
        onOpenChange={setSearchOpen}
        accounts={accounts}
        contacts={contacts}
        contactGroups={contactGroups}
        transactions={transactions}
        session={session}
        onSelect={handleSearchSelect}
        placeholder={activeView === 'persons' ? 'جستجو در اشخاص' : undefined}
      />
      </FormWorkspaceProvider>
    </SessionAuthProvider>
  );
};

export default App;
