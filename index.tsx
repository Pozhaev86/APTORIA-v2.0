import React, { useState, useEffect, useMemo, useRef } from "react";
import { createRoot } from "react-dom/client";
import { GoogleGenAI } from "@google/genai";
import {
  TrendingUp,
  TrendingDown,
  LogOut,
  Plus,
  Trash2,
  Building,
  Settings,
  Hash,
  RefreshCw,
  Upload,
  HardDrive,
  Cloud,
  CloudOff,
  CloudCheck,
  UserPlus,
  User,
  Users,
  Check,
  Link as LinkIcon,
  Cpu,
  Eye,
  Clock,
  Briefcase,
  ChevronRight,
  ShieldCheck,
  Terminal,
  Calculator,
  Calendar,
  Sparkles,
  AlertCircle,
  Pencil,
  X as XIcon,
  Filter,
  ArrowRight,
  Download,
  Share2,
  Database,
  Layers,
  Key
} from "lucide-react";
import {
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  AreaChart,
  Area
} from "recharts";

// Глобальные объявления для сборщика
declare global {
  const gapi: any;
  const google: any;
  const __API_KEY__: string;
  interface Window {
    pusherSync: any;
  }
}

// --- Types & Constants ---

type Role = "FOUNDER" | "ADMIN" | "USER";
type FilterType = "today" | "7days" | "period";

interface Location {
  id: string;
  name: string;
}

interface UserAccount {
  id: string;
  email: string;
  password: string; 
  nickname: string;
  role: Role;
  locationIds: string[]; // Поддержка нескольких локаций
}

interface Transaction {
  id: string;
  type: "EXPENSE" | "INCOME";
  amount: number;
  category: string;
  date: string; 
  time: string; 
  userId: string;
  userNickname: string;
  locationId: string;
  comment?: string;
  createdAt: number;
}

interface CategoryMap {
    [locationId: string]: {
        INCOME: string[];
        EXPENSE: string[];
    }
}

const DEFAULT_EXPENSE_CATEGORIES = [
  "Деталь/товар", "Зарплата", "Личные расходы", "Бытовые расходы",
  "Покупка телефона", "Аренда", "Реклама", "Капитализация", "Возврат долга", "Иной расход",
];

const DEFAULT_INCOME_CATEGORIES = [
  "Выручка ремонты", "Выручка продажи", "Возврат от поставщика",
  "Продажа телефона", "Инвестиция", "Иной доход",
];

const INITIAL_LOCATIONS: Location[] = [
  { id: "loc-1", name: "Екатеринбург - Центр" },
  { id: "loc-2", name: "Екатеринбург - Уралмаш" },
];

const SEED_FOUNDER: UserAccount = {
  id: "user-founder",
  email: "a.pozhaev@gmail.com",
  password: "1234",
  nickname: "Основатель",
  role: "FOUNDER",
  locationIds: [], // Основатель видит всё
};

const DRIVE_FILE_NAME = "aptoria_finance_cloud_v1.json";

// --- Google Auth Config ---
const GOOGLE_CLIENT_ID = "86162384918-placeholder.apps.googleusercontent.com"; 

// --- Storage Helpers ---

const storage = {
  get: (key: string) => {
    try {
      const data = localStorage.getItem(`aptoria_${key}`);
      return data ? JSON.parse(data) : null;
    } catch (e) {
      console.error("Storage read error", e);
      return null;
    }
  },
  set: (key: string, val: any) => {
    try {
      localStorage.setItem(`aptoria_${key}`, JSON.stringify(val));
    } catch (e) {
      console.error("Storage write error", e);
    }
  },
};

// --- Pusher Sync Helper ---
const syncWithPusher = async (eventType: string, data: any, options?: { forceFullSync?: boolean }) => {
  if (!window.pusherSync?.isInitialized || !window.pusherSync.isConnected) {
    console.warn('Pusher not available for sync');
    return false;
  }

  try {
    if (options?.forceFullSync) {
      await window.pusherSync.sendFullSync();
      console.log('✅ Full sync sent to Pusher');
    } else {
      await window.pusherSync.sendDataUpdate(eventType, data);
      console.log(`✅ ${eventType} sync sent to Pusher`);
    }
    return true;
  } catch (error) {
    console.error('Pusher sync error:', error);
    return false;
  }
};

// --- Global Date Helpers ---

const filterByDateRange = (list: Transaction[], filterType: FilterType, startDate?: string, endDate?: string) => {
  const now = new Date();
  const todayStr = now.toISOString().split('T')[0];
  
  return list.filter(t => {
    if (filterType === 'today') return t.date === todayStr;
    if (filterType === '7days') {
      const tDate = new Date(t.date);
      const diffTime = Math.abs(now.getTime() - tDate.getTime());
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      return diffDays <= 7;
    }
    if (filterType === 'period' && startDate && endDate) {
      return t.date >= startDate && t.date <= endDate;
    }
    return true;
  });
};

const downloadCSV = (data: any[], filename: string) => {
  if (data.length === 0) return;
  const headers = Object.keys(data[0]).join(";");
  const rows = data.map(obj => Object.values(obj).join(";"));
  const csvContent = "\uFEFF" + [headers, ...rows].join("\n");
  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.setAttribute("href", url);
  link.setAttribute("download", filename);
  link.style.visibility = "hidden";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};

// --- UI Components ---

const Button = ({ children, onClick, variant = "primary", className = "", icon: Icon, disabled = false, loading = false, type = "button" }: any) => {
  const base = "flex items-center justify-center gap-2 px-4 py-2 rounded-xl font-medium transition-all duration-200 active:scale-95 disabled:opacity-50 disabled:scale-100 whitespace-nowrap";
  const variants: any = {
    primary: "bg-indigo-600 text-white hover:bg-indigo-700 shadow-md shadow-indigo-200",
    secondary: "bg-white text-slate-700 border border-slate-200 hover:bg-slate-50",
    danger: "bg-red-500 text-white hover:bg-red-600 shadow-md shadow-red-100",
    ghost: "bg-transparent text-slate-500 hover:bg-slate-100",
    google: "bg-white text-slate-700 border border-slate-200 hover:bg-slate-50 shadow-sm",
  };
  return (
    <button type={type} disabled={disabled || loading} onClick={onClick} className={`${base} ${variants[variant]} ${className}`}>
      {loading ? <RefreshCw className="animate-spin" size={18} /> : Icon && <Icon size={18} />}
      {children}
    </button>
  );
};

const Card = ({ children, title, icon: Icon, className = "", extra }: any) => (
  <div className={`bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden ${className}`}>
    {(title || Icon) && (
      <div className="px-5 py-4 border-b border-slate-50 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          {Icon && <Icon className="text-indigo-600" size={18} />}
          {title && <h3 className="font-bold text-slate-800 text-sm md:text-base">{title}</h3>}
        </div>
        {extra}
      </div>
    )}
    <div className="p-4 md:p-6">{children}</div>
  </div>
);

// --- Main App Logic ---

function App() {
  const [currentUser, setCurrentUser] = useState<UserAccount | null>(storage.get("user"));
  const [users, setUsers] = useState<UserAccount[]>(storage.get("users") || [SEED_FOUNDER]);
  const [locations, setLocations] = useState<Location[]>(storage.get("locations") || INITIAL_LOCATIONS);
  const [transactions, setTransactions] = useState<Transaction[]>(storage.get("transactions") || []);
  const [categories, setCategories] = useState<CategoryMap>(storage.get("categories") || {});
  const [currentTab, setCurrentTab] = useState<"dashboard" | "transactions" | "settings">("dashboard");
  const [rememberMe, setRememberMe] = useState<boolean>(storage.get("rememberMe") || false);
  const [syncStatus, setSyncStatus] = useState<"synced" | "syncing" | "error" | "offline">("synced");

  const [showAddTransaction, setShowAddTransaction] = useState(false);
  const [googleDriveConnected, setGoogleDriveConnected] = useState<boolean>(storage.get("driveConnected") || false);

  const tokenClient = useRef<any>(null);
  const gapiInited = useRef(false);

  // Filtering
  const [filterType, setFilterType] = useState<FilterType>("7days");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loginError, setLoginError] = useState("");

  // --- Google Drive Logic ---

  const handleDriveSync = async () => {
    if (!googleDriveConnected || !gapiInited.current) return;
    setSyncStatus("syncing");
    
    try {
      const token = gapi.client.getToken();
      if (!token) {
        setSyncStatus("offline");
        return;
      }

      const data = { users, locations, transactions, categories, lastUpdated: Date.now() };
      
      const response = await gapi.client.drive.files.list({
        q: `name = '${DRIVE_FILE_NAME}' and trashed = false`,
        fields: 'files(id, name)',
      });
      
      const files = response.result.files;
      let fileId = files && files.length > 0 ? files[0].id : null;
      
      if (!fileId) {
        const metadata = { name: DRIVE_FILE_NAME, mimeType: 'application/json' };
        const content = JSON.stringify(data);
        const boundary = '-------314159265358979323846';
        const delimiter = "\r\n--" + boundary + "\r\n";
        const close_delim = "\r\n--" + boundary + "--";

        const multipartRequestBody =
            delimiter +
            'Content-Type: application/json\r\n\r\n' +
            JSON.stringify(metadata) +
            delimiter +
            'Content-Type: application/json\r\n\r\n' +
            content +
            close_delim;

        await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart', {
            method: 'POST',
            headers: {
                'Authorization': 'Bearer ' + token.access_token,
                'Content-Type': 'multipart/related; boundary=' + boundary
            },
            body: multipartRequestBody
        });
      } else {
        await gapi.client.request({
            path: `/upload/drive/v3/files/${fileId}`,
            method: 'PATCH',
            params: { uploadType: 'media' },
            body: JSON.stringify(data)
        });
      }
      setSyncStatus("synced");
    } catch (e) {
      console.error("Drive sync error:", e);
      setSyncStatus("error");
    }
  };

  const connectGoogleDrive = () => {
    if (!tokenClient.current) {
      alert("Библиотеки Google еще загружаются. Пожалуйста, подождите.");
      return;
    }
    
    tokenClient.current.callback = async (resp: any) => {
      if (resp.error) {
        console.error("Auth error:", resp.error);
        return;
      }
      
      setGoogleDriveConnected(true);
      storage.set("driveConnected", true);
      
      try {
        setSyncStatus("syncing");
        const listResp = await gapi.client.drive.files.list({
            q: `name = '${DRIVE_FILE_NAME}' and trashed = false`,
            fields: 'files(id, name)',
        });
        
        const files = listResp.result.files;
        if (files && files.length > 0) {
            const fileId = files[0].id;
            const contentResp = await gapi.client.drive.files.get({
                fileId: fileId,
                alt: 'media'
            });
            
            const cloudData = contentResp.result;
            if (confirm("Облачная копия найдена. Загрузить данные из Google Drive? Текущие данные будут заменены.")) {
                if(cloudData.users) setUsers(cloudData.users);
                if(cloudData.locations) setLocations(cloudData.locations);
                if(cloudData.transactions) setTransactions(cloudData.transactions);
                if(cloudData.categories) setCategories(cloudData.categories);
                setSyncStatus("synced");
            }
        } else {
            handleDriveSync();
        }
      } catch (err) {
        console.error("Initial load error:", err);
        setSyncStatus("error");
      }
    };
    
    tokenClient.current.requestAccessToken({ prompt: 'consent' });
  };

  // Автоматическая синхронизация с Pusher при изменениях данных
  useEffect(() => {
    const timer = setTimeout(() => {
      // Сохраняем в localStorage
      storage.set("user", currentUser);
      storage.set("users", users);
      storage.set("locations", locations);
      storage.set("transactions", transactions);
      storage.set("categories", categories);
      storage.set("rememberMe", rememberMe);
      
      // АВТОМАТИЧЕСКАЯ СИНХРОНИЗАЦИЯ С PUSHER
      if (window.pusherSync?.isInitialized && window.pusherSync.isConnected) {
        syncWithPusher('app-data-updated', {
          users: users,
          locations: locations,
          transactions: transactions,
          categories: categories,
          timestamp: Date.now()
        }).catch(err => console.error('Pusher send error:', err));
      }
      
      if (googleDriveConnected) handleDriveSync();
    }, 1000); // Уменьшили задержку до 1 секунды
    
    return () => clearTimeout(timer);
  }, [currentUser, users, locations, transactions, categories, rememberMe, googleDriveConnected]);

  useEffect(() => {
    const initGapi = async () => {
      try {
        await new Promise((resolve) => gapi.load('client', resolve));
        await gapi.client.init({
          discoveryDocs: ["https://www.googleapis.com/discovery/v1/apis/drive/v3/rest"],
        });
        gapiInited.current = true;
      } catch (e) {
        console.error("GAPI init failed:", e);
      }
    };

    const initGis = () => {
      try {
        tokenClient.current = google.accounts.oauth2.initTokenClient({
          client_id: GOOGLE_CLIENT_ID,
          scope: 'https://www.googleapis.com/auth/drive.file',
          callback: '', 
        });
      } catch (e) {
        console.error("GIS init failed:", e);
      }
    };

    if (typeof gapi !== 'undefined' && typeof google !== 'undefined') {
        initGapi();
        initGis();
    }
  }, []);

  const handleLogin = () => {
    const user = users.find(u => u.email === email && u.password === password);
    if (user) {
      setCurrentUser(user);
      setLoginError("");
      // Синхронизация входа пользователя
      syncWithPusher('user-logged-in', {
        userId: user.id,
        userNickname: user.nickname,
        timestamp: Date.now()
      });
    } else {
      setLoginError("Неверный логин или пароль");
    }
  };

  const handleLogout = () => {
    // Синхронизация выхода пользователя
    if (currentUser) {
      syncWithPusher('user-logged-out', {
        userId: currentUser.id,
        timestamp: Date.now()
      });
    }
    setCurrentUser(null);
    if (!rememberMe) {
      setEmail("");
      setPassword("");
    }
    setCurrentTab("dashboard");
  };

  if (!currentUser) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
        <div className="w-full max-w-md">
          <div className="text-center mb-8">
            <div className="bg-indigo-600 w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-xl shadow-indigo-500/30">
              <Cpu className="text-white" size={32} />
            </div>
            <h1 className="text-2xl font-bold text-white">Aptoria IT</h1>
            <p className="text-slate-400">Управление финансами сети</p>
          </div>
          <div className="bg-white rounded-3xl p-8 shadow-2xl">
            <div className="space-y-4">
              {loginError && (
                <div className="bg-rose-50 border border-rose-100 text-rose-600 p-3 rounded-xl flex items-center gap-2 text-sm font-medium">
                  <AlertCircle size={16} />
                  {loginError}
                </div>
              )}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Email</label>
                <input 
                  type="email" 
                  className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition-all bg-white text-slate-900"
                  placeholder="name@example.com"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Пароль</label>
                <input 
                  type="password" 
                  className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition-all bg-white text-slate-900"
                  placeholder="••••••••"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                />
              </div>
              <div className="flex items-center gap-2">
                  <input 
                    type="checkbox" 
                    id="remember" 
                    checked={rememberMe} 
                    onChange={e => setRememberMe(e.target.checked)}
                    className="w-4 h-4 text-indigo-600 border-slate-300 rounded focus:ring-indigo-500" 
                  />
                  <label htmlFor="remember" className="text-sm text-slate-600 cursor-pointer">Запомнить меня</label>
              </div>
              <Button onClick={handleLogin} className="w-full py-4 text-lg">Войти</Button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 pb-24 md:pb-0 md:pl-64">
      {/* Sidebar Desktop */}
      <aside className="hidden md:flex flex-col fixed left-0 top-0 bottom-0 w-64 bg-slate-900 border-r border-slate-800 p-4 z-50">
        <div className="flex items-center gap-3 px-2 mb-8">
          <div className="bg-indigo-600 p-2 rounded-lg text-white">
            <Cpu size={20} />
          </div>
          <span className="font-bold text-xl text-white tracking-tight">Aptoria IT</span>
        </div>

        <nav className="flex-1 space-y-1">
          <NavItem active={currentTab === "dashboard"} onClick={() => setCurrentTab("dashboard")} icon={TrendingUp} label="Аналитика" />
          <NavItem active={currentTab === "transactions"} onClick={() => setCurrentTab("transactions")} icon={Hash} label="Транзакции" />
          <NavItem active={currentTab === "settings"} onClick={() => setCurrentTab("settings")} icon={Settings} label="Настройки" />
        </nav>

        <div className="pt-4 border-t border-slate-800 space-y-4">
          <div className="flex items-center justify-between px-3 text-[10px] uppercase font-bold text-slate-500">
            <span className="flex items-center gap-1.5">{googleDriveConnected ? <CloudCheck size={12} className="text-emerald-400"/> : <CloudOff size={12}/>} Drive Sync</span>
            <div className="flex items-center gap-1.5">
              <div className={`w-2 h-2 rounded-full ${syncStatus === 'synced' ? 'bg-emerald-500 shadow-[0_0_8px_#10b981]' : syncStatus === 'error' ? 'bg-rose-500' : 'bg-amber-500 animate-pulse'}`} />
              <span className={syncStatus === 'synced' ? 'text-emerald-500' : syncStatus === 'error' ? 'text-rose-500' : 'text-amber-500'}>
                {syncStatus === 'synced' ? 'Ок' : syncStatus === 'error' ? 'Ошибка' : 'Обмен...' }
              </span>
            </div>
          </div>
          <div className="px-3 py-3 rounded-xl bg-slate-800/50">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-indigo-500 flex items-center justify-center text-white font-bold">
                {currentUser.nickname[0]}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-white truncate">{currentUser.nickname}</p>
                <p className="text-xs text-slate-400 truncate uppercase">{currentUser.role}</p>
              </div>
            </div>
          </div>
          <Button variant="ghost" className="w-full justify-start text-red-400 hover:bg-red-500/10 hover:text-red-500" onClick={handleLogout} icon={LogOut}>
            Выйти
          </Button>
        </div>
      </aside>

      {/* Bottom Nav Mobile */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 z-[100] flex justify-around items-center p-3 shadow-[0_-4px_20px_rgba(0,0,0,0.05)]">
          <MobileNavItem active={currentTab === "dashboard"} onClick={() => setCurrentTab("dashboard")} icon={TrendingUp} />
          <MobileNavItem active={currentTab === "transactions"} onClick={() => setCurrentTab("transactions")} icon={Hash} />
          <MobileNavItem active={currentTab === "settings"} onClick={() => setCurrentTab("settings")} icon={Settings} />
          <button onClick={handleLogout} className="p-2 text-rose-500 opacity-60"><LogOut size={24}/></button>
      </nav>

      {/* Header Filters */}
      {currentTab !== "settings" && (
        <header className="sticky top-0 bg-white/80 backdrop-blur-md border-b border-slate-200 z-40 p-4 md:px-8">
            <div className="max-w-7xl mx-auto flex flex-col md:flex-row gap-4 items-center justify-between">
                <div className="flex items-center gap-2 bg-slate-100 p-1 rounded-xl w-full md:w-auto">
                    <FilterBtn active={filterType === 'today'} onClick={() => setFilterType('today')}>Сегодня</FilterBtn>
                    <FilterBtn active={filterType === '7days'} onClick={() => setFilterType('7days')}>7 дней</FilterBtn>
                    <FilterBtn active={filterType === 'period'} onClick={() => setFilterType('period')}>Период</FilterBtn>
                </div>
                {filterType === 'period' && (
                    <div className="flex items-center gap-2 w-full md:w-auto overflow-hidden">
                        <input type="date" className="flex-1 md:w-auto bg-white border border-slate-200 rounded-lg px-2 py-1 text-sm text-slate-900 outline-none focus:ring-2 focus:ring-indigo-500" value={startDate} onChange={e => setStartDate(e.target.value)} />
                        <span className="text-slate-400">—</span>
                        <input type="date" className="flex-1 md:w-auto bg-white border border-slate-200 rounded-lg px-2 py-1 text-sm text-slate-900 outline-none focus:ring-2 focus:ring-indigo-500" value={endDate} onChange={e => setEndDate(e.target.value)} />
                    </div>
                )}
            </div>
        </header>
      )}

      {/* Floating Add Button */}
      {(currentTab === 'dashboard' || currentTab === 'transactions') && (
        <button 
            onClick={() => setShowAddTransaction(true)} 
            className="fixed bottom-24 right-6 md:bottom-10 md:right-10 w-14 h-14 md:w-16 md:h-16 bg-indigo-600 text-white rounded-full shadow-2xl flex items-center justify-center hover:bg-indigo-700 active:scale-90 transition-all z-[90] animate-in zoom-in-50 duration-300"
            aria-label="Добавить операцию"
        >
            <Plus size={32} />
        </button>
      )}

      <main className="p-4 md:p-8 max-w-7xl mx-auto">
        {currentTab === "dashboard" && (
          <DashboardView 
            transactions={transactions} 
            locations={locations} 
            currentUser={currentUser} 
            filterType={filterType}
            startDate={startDate}
            endDate={endDate}
          />
        )}
        {currentTab === "transactions" && (
          <TransactionsView 
            transactions={transactions} 
            setTransactions={setTransactions} 
            locations={locations} 
            categories={categories}
            currentUser={currentUser}
            filterType={filterType}
            startDate={startDate}
            endDate={endDate}
            showAdd={showAddTransaction}
            setShowAdd={setShowAddTransaction}
            users={users}
          />
        )}
        {currentTab === "settings" && (
          <SettingsView 
            currentUser={currentUser} 
            setCurrentUser={setCurrentUser}
            locations={locations} 
            setLocations={setLocations}
            categories={categories}
            setCategories={setCategories}
            users={users}
            setUsers={setUsers}
            transactions={transactions}
            setTransactions={setTransactions}
            googleDriveConnected={googleDriveConnected}
            setGoogleDriveConnected={setGoogleDriveConnected}
            connectGoogleDrive={connectGoogleDrive}
          />
        )}
      </main>

      {/* Global Add Transaction Modal Overlay */}
      {showAddTransaction && currentTab !== "transactions" && (
        <div className="fixed inset-0 z-[120]">
           <TransactionsView 
                transactions={transactions} 
                setTransactions={setTransactions} 
                locations={locations} 
                categories={categories}
                currentUser={currentUser}
                filterType={filterType}
                startDate={startDate}
                endDate={endDate}
                showAdd={true}
                setShowAdd={setShowAddTransaction}
                hideList={true}
                users={users}
            />
        </div>
      )}
    </div>
  );
}

// --- Dashboard Component ---

function DashboardView({ transactions, locations, currentUser, filterType, startDate, endDate }: any) {
  const [aiReport, setAiReport] = useState("");
  const [isAiLoading, setIsAiLoading] = useState(false);
  
  // Доступные для текущего пользователя локации
  const availableLocations = useMemo(() => {
    if (currentUser.role === 'FOUNDER') return locations;
    return locations.filter((l: any) => currentUser.locationIds.includes(l.id));
  }, [locations, currentUser]);

  const [filterLocation, setFilterLocation] = useState("all");

  const filteredTransactions = useMemo(() => {
    let list = transactions;
    if (currentUser.role !== 'FOUNDER') {
      list = list.filter((t: any) => currentUser.locationIds.includes(t.locationId));
    }
    
    if (filterLocation !== 'all') {
      list = list.filter((t: any) => t.locationId === filterLocation);
    }
    
    return filterByDateRange(list, filterType, startDate, endDate);
  }, [transactions, currentUser, filterType, startDate, endDate, filterLocation]);

  const stats = useMemo(() => {
    const income = filteredTransactions.filter((t: any) => t.type === 'INCOME').reduce((acc: number, t: any) => acc + t.amount, 0);
    const expense = filteredTransactions.filter((t: any) => t.type === 'EXPENSE').reduce((acc: number, t: any) => acc + t.amount, 0);
    
    const revIncome = filteredTransactions.filter((t: any) => 
      t.type === 'INCOME' && DEFAULT_INCOME_CATEGORIES.includes(t.category)
    ).reduce((a: number, t: any) => a + t.amount, 0);

    const targetExpenses = filteredTransactions.filter((t: any) => 
      t.type === 'EXPENSE' && DEFAULT_EXPENSE_CATEGORIES.includes(t.category)
    ).reduce((a: number, t: any) => a + t.amount, 0);

    const profitability = revIncome > 0 ? (((revIncome - targetExpenses) / revIncome) * 100).toFixed(1) : "0";

    return { income, expense, balance: income - expense, profitability, revIncome, targetExpenses };
  }, [filteredTransactions]);

  const categoryStats = useMemo(() => {
    const map: Record<string, { total: number; type: string; profitability?: string; weight?: number }> = {};
    
    filteredTransactions.forEach(t => {
      if (!map[t.category]) map[t.category] = { total: 0, type: t.type };
      map[t.category].total += t.amount;
    });

    const incomeTotal = Object.values(map).filter(m => m.type === 'INCOME').reduce((s, m) => s + m.total, 0);
    const expenseTotal = Object.values(map).filter(m => m.type === 'EXPENSE').reduce((s, m) => s + m.total, 0);

    Object.keys(map).forEach(cat => {
      const isDefault = map[cat].type === 'INCOME' 
        ? DEFAULT_INCOME_CATEGORIES.includes(cat) 
        : DEFAULT_EXPENSE_CATEGORIES.includes(cat);
      
      const totalForSection = map[cat].type === 'INCOME' ? incomeTotal : expenseTotal;
      map[cat].weight = totalForSection > 0 ? (map[cat].total / totalForSection) * 100 : 0;

      if (isDefault && stats.revIncome > 0) {
          if (map[cat].type === 'EXPENSE') {
             map[cat].profitability = (100 - (map[cat].total / stats.revIncome * 100)).toFixed(1) + "%";
          } else {
             map[cat].profitability = (map[cat].total / stats.revIncome * 100).toFixed(1) + "%";
          }
      } else {
          map[cat].profitability = "";
      }
    });

    return Object.entries(map).sort((a, b) => b[1].total - a[1].total);
  }, [filteredTransactions, stats.revIncome]);

  const groupedCategories = useMemo(() => ({
    INCOME: categoryStats.filter(([_, data]) => data.type === 'INCOME'),
    EXPENSE: categoryStats.filter(([_, data]) => data.type === 'EXPENSE')
  }), [categoryStats]);

  const handleExportAnalytics = () => {
    const data = categoryStats.map(([name, d]) => ({
        "Категория": name,
        "Тип": d.type === 'INCOME' ? 'Доход' : 'Расход',
        "Сумма (₽)": d.total,
        "Вес (%)": d.weight?.toFixed(2),
        "Рентабельность": d.profitability || "—"
    }));
    downloadCSV(data, `Analytics_Export_${new Date().toISOString().split('T')[0]}.csv`);
  };

  const cashFlowData = useMemo(() => {
    const map: any = {};
    filteredTransactions.forEach(t => {
      if (!map[t.date]) map[t.date] = { date: t.date, income: 0, expense: 0 };
      if (t.type === 'INCOME') map[t.date].income += t.amount;
      else map[t.date].expense += t.amount;
    });
    return Object.values(map).sort((a: any, b: any) => a.date.localeCompare(b.date));
  }, [filteredTransactions]);

  const generateAiAnalysis = async () => {
    setIsAiLoading(true);
    setAiReport("");
    try {
      const apiKey = __API_KEY__;
      
      if (!apiKey || apiKey === '') {
        setAiReport("API ключ не настроен. Пожалуйста, добавьте API_KEY в настройки окружения.");
        setIsAiLoading(false);
        return;
      }

      const ai = new GoogleGenAI({ apiKey });
      const prompt = `Проведи финансовый аудит для сети сервисных центров Aptoria. Данные периода: доход ${stats.income}, расход ${stats.expense}, рентабельность ${stats.profitability}%. Детализация: ${JSON.stringify(categoryStats)}. Дай 3 конкретных совета.`;
      const response = await ai.models.generateContent({ 
        model: 'gemini-3-flash-preview', 
        contents: prompt 
      });
      setAiReport(response.text || "Ошибка анализа");
    } catch (e) {
      console.error("AI Error:", e);
      setAiReport("Ошибка ИИ: Проверьте подключение к интернету и ключ API.");
    } finally {
      setIsAiLoading(false);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-500">
      <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
        <h2 className="text-xl md:text-2xl font-black text-slate-800">Общая аналитика</h2>
        <div className="flex items-center gap-2 w-full md:w-auto">
          <select 
              className="flex-1 md:w-auto bg-white border border-slate-200 px-4 py-2 rounded-xl text-sm outline-none focus:ring-2 focus:ring-indigo-500 text-slate-900 font-bold"
              value={filterLocation}
              onChange={e => setFilterLocation(e.target.value)}
          >
              <option value="all">Все доступные филиалы</option>
              {availableLocations.map((l: any) => <option key={l.id} value={l.id}>{l.name}</option>)}
          </select>
          <Button variant="secondary" onClick={handleExportAnalytics} icon={Download}>CSV</Button>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
        <StatCard title="Остаток" value={stats.balance} icon={TrendingUp} color="indigo" />
        <StatCard title="Доход" value={stats.income} icon={TrendingUp} color="emerald" />
        <StatCard title="Расход" value={stats.expense} icon={TrendingDown} color="rose" />
        <StatCard title="Рент." value={`${stats.profitability}%`} icon={Calculator} color="amber" />
      </div>

      <Card title="Глубокий отчет эффективности" icon={ShieldCheck}>
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
              <AnalyticsTable section="Доходы" data={groupedCategories.INCOME} color="emerald" />
              <AnalyticsTable section="Расходы" data={groupedCategories.EXPENSE} color="rose" />
          </div>
      </Card>

      <Card title="Динамика потока" icon={TrendingUp}>
          <div className="h-64 md:h-80 w-full">
              <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={cashFlowData}>
                      <defs>
                          <linearGradient id="colorIncome" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#10b981" stopOpacity={0.2}/><stop offset="95%" stopColor="#10b981" stopOpacity={0}/></linearGradient>
                          <linearGradient id="colorExpense" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#f43f5e" stopOpacity={0.2}/><stop offset="95%" stopColor="#f43f5e" stopOpacity={0}/></linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                      <XAxis dataKey="date" tick={{fontSize: 9}} tickLine={false} axisLine={false} />
                      <YAxis tick={{fontSize: 9}} tickLine={false} axisLine={false} />
                      <Tooltip contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }} />
                      <Area type="monotone" dataKey="income" stroke="#10b981" fillOpacity={1} fill="url(#colorIncome)" name="Доход" />
                      <Area type="monotone" dataKey="expense" stroke="#f43f5e" fillOpacity={1} fill="url(#colorExpense)" name="Расход" />
                  </AreaChart>
              </ResponsiveContainer>
          </div>
      </Card>

      <Card title="Ассистент" icon={Sparkles} extra={<Button onClick={generateAiAnalysis} loading={isAiLoading} icon={Sparkles}>Анализ</Button>}>
        <div className="min-h-[100px]">
            {isAiLoading ? <div className="space-y-3 animate-pulse"><div className="h-4 bg-slate-100 rounded w-3/4" /><div className="h-4 bg-slate-100 rounded w-full" /></div>
            : aiReport ? <div className="text-slate-700 whitespace-pre-wrap text-sm leading-relaxed bg-indigo-50/30 p-4 rounded-xl border border-indigo-100">{aiReport}</div>
            : <div className="text-center text-slate-400 py-6 text-xs uppercase font-bold tracking-widest">Нажмите для ИИ аудита</div>}
        </div>
      </Card>
    </div>
  );
}

// --- Transactions Component ---

function TransactionsView({ 
    transactions, setTransactions, locations, categories, currentUser, 
    filterType, startDate, endDate, showAdd, setShowAdd, hideList = false,
    users = [] 
}: any) {
  const [details, setDetails] = useState<Transaction | null>(null);
  
  // Доступные локации для текущего пользователя
  const availableLocations = useMemo(() => {
    if (currentUser.role === 'FOUNDER') return locations;
    return locations.filter((l: any) => currentUser.locationIds.includes(l.id));
  }, [locations, currentUser]);

  const [filterLocation, setFilterLocation] = useState("all");
  const [filterTypeT, setFilterTypeT] = useState<"all" | "INCOME" | "EXPENSE">("all");
  const [filterResponsible, setFilterResponsible] = useState("all");

  const [type, setType] = useState<"INCOME" | "EXPENSE">("EXPENSE");
  const [amount, setAmount] = useState("");
  const [category, setCategory] = useState("");
  const [locationId, setLocationId] = useState(availableLocations[0]?.id || "");
  const [comment, setComment] = useState("");

  const [errors, setErrors] = useState<string[]>([]);
  const [shake, setShake] = useState(false);

  const filteredList = useMemo(() => {
    let list = transactions;
    
    // Сначала фильтруем по тому, что пользователю вообще разрешено видеть
    if (currentUser.role !== 'FOUNDER') {
        list = list.filter((t: any) => currentUser.locationIds.includes(t.locationId));
    }
    
    // Затем применяем фильтры интерфейса
    if (filterLocation !== 'all') list = list.filter((t: any) => t.locationId === filterLocation);
    if (filterTypeT !== 'all') list = list.filter((t: any) => t.type === filterTypeT);
    if (filterResponsible !== 'all') list = list.filter((t: any) => t.userNickname === filterResponsible);

    return filterByDateRange(list, filterType, startDate, endDate).sort((a: any, b: any) => b.createdAt - a.createdAt);
  }, [transactions, filterLocation, filterTypeT, filterResponsible, currentUser, filterType, startDate, endDate]);

  const handleExportTransactions = () => {
    const data = filteredList.map(t => ({
        "Дата": t.date, "Время": t.time, "Локация": locations.find((l: any) => l.id === t.locationId)?.name || '?',
        "Тип": t.type === 'INCOME' ? 'Доход' : 'Расход', "Категория": t.category, "Сумма": t.amount,
        "Пользователь": t.userNickname, "Комментарий": t.comment || ''
    }));
    downloadCSV(data, `Transactions_Export_${new Date().toISOString().split('T')[0]}.csv`);
  };

  const handleAdd = async () => {
    const newErrors = [];
    if (!amount || Number(amount) <= 0) newErrors.push("amount");
    if (!category) newErrors.push("category");
    if (!locationId) newErrors.push("location");

    if (newErrors.length > 0) {
      setErrors(newErrors);
      setShake(true);
      setTimeout(() => setShake(false), 500);
      return;
    }

    const now = new Date();
    const newT: Transaction = {
        id: Math.random().toString(36).substr(2, 9),
        type, amount: Number(amount), category,
        date: now.toISOString().split('T')[0],
        time: now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        locationId, comment, userId: currentUser.id, userNickname: currentUser.nickname,
        createdAt: Date.now()
    };
    
    // 1. Обновляем состояние
    const updatedTransactions = [...transactions, newT];
    setTransactions(updatedTransactions);
    
    // 2. Сбрасываем форму
    setShowAdd(false); 
    setAmount(""); 
    setComment(""); 
    setCategory(""); 
    setErrors([]);

    // 3. СИНХРОНИЗИРУЕМ ЧЕРЕЗ PUSHER
    const syncSuccess = await syncWithPusher('transaction-added', {
      transaction: newT,
      allTransactions: updatedTransactions,
      userId: currentUser.id,
      timestamp: Date.now()
    });

    if (!syncSuccess) {
      console.warn('⚠️ Transaction saved locally but Pusher sync failed');
    }
  };

  const currentCategories = useMemo(() => {
      const locCats = categories[locationId];
      if (locCats) return locCats[type];
      return type === 'INCOME' ? DEFAULT_INCOME_CATEGORIES : DEFAULT_EXPENSE_CATEGORIES;
  }, [categories, locationId, type]);

  if (hideList && !showAdd) return null;

  return (
    <div className={`space-y-6 ${!hideList ? 'animate-in fade-in slide-in-from-bottom-2 duration-500' : ''}`}>
      {!hideList && (
        <>
            <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
                <h2 className="text-xl md:text-2xl font-black text-slate-800">Журнал операций</h2>
                <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
                <select className="flex-1 md:w-auto bg-white border border-slate-200 px-3 py-2 rounded-xl text-sm outline-none focus:ring-2 focus:ring-indigo-500 text-slate-900 font-bold" value={filterTypeT} onChange={e => setFilterTypeT(e.target.value as any)}>
                    <option value="all">Все типы</option>
                    <option value="INCOME">Доходы</option>
                    <option value="EXPENSE">Расходы</option>
                </select>
                <select className="flex-1 md:w-auto bg-white border border-slate-200 px-3 py-2 rounded-xl text-sm outline-none focus:ring-2 focus:ring-indigo-500 text-slate-900 font-bold" value={filterResponsible} onChange={e => setFilterResponsible(e.target.value)}>
                    <option value="all">Все сотрудники</option>
                    {users.map((u: any) => (
                      <option key={u.id} value={u.nickname}>{u.nickname}</option>
                    ))}
                </select>
                <select className="flex-1 md:w-auto bg-white border border-slate-200 px-3 py-2 rounded-xl text-sm outline-none focus:ring-2 focus:ring-indigo-500 text-slate-900 font-bold" value={filterLocation} onChange={e => setFilterLocation(e.target.value)}>
                    <option value="all">Все дост. филиалы</option>
                    {availableLocations.map((l: any) => <option key={l.id} value={l.id}>{l.name}</option>)}
                </select>
                <div className="flex gap-2 w-full md:w-auto">
                    <Button variant="secondary" onClick={handleExportTransactions} icon={Download}>CSV</Button>
                </div>
                </div>
            </div>

            <div className="hidden md:block">
                <Card className="overflow-x-auto p-0">
                    <table className="w-full text-left">
                    <thead className="bg-slate-50 border-b border-slate-100">
                        <tr>
                        <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase">Время</th>
                        <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase">Локация</th>
                        <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase">Категория</th>
                        <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase">Сумма</th>
                        <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase text-right">Инфо</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                        {filteredList.map((t: any) => (
                        <tr key={t.id} className="hover:bg-slate-50/50 transition-colors">
                            <td className="px-6 py-4 text-xs text-slate-600 font-bold">{t.date}<br/>{t.time}</td>
                            <td className="px-6 py-4 text-sm text-slate-900 font-medium">{locations.find((l: any) => l.id === t.locationId)?.name || '-'}</td>
                            <td className="px-6 py-4"><span className={`px-2 py-1 rounded-md text-[10px] font-black ${t.type === 'INCOME' ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'}`}>{t.category}</span></td>
                            <td className={`px-6 py-4 text-sm font-black ${t.type === 'INCOME' ? 'text-emerald-600' : 'text-rose-600'}`}>{t.type === 'INCOME' ? '+' : '-'}{t.amount.toLocaleString()} ₽</td>
                            <td className="px-6 py-4 text-right"><button onClick={() => setDetails(t)} className="text-indigo-500 hover:text-indigo-700 p-2"><Eye size={18} /></button></td>
                        </tr>
                        ))}
                    </tbody>
                    </table>
                </Card>
            </div>

            <div className="md:hidden space-y-3">
                {filteredList.map((t: any) => (
                    <div key={t.id} onClick={() => setDetails(t)} className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm flex items-center justify-between active:scale-[0.98] transition-transform">
                        <div className="flex flex-col gap-1">
                            <div className="flex items-center gap-2">
                                <span className={`w-2 h-2 rounded-full ${t.type === 'INCOME' ? 'bg-emerald-500' : 'bg-rose-500'}`} />
                                <span className="text-sm font-black text-slate-900">{t.category}</span>
                            </div>
                            <span className="text-[10px] font-bold text-slate-400 uppercase">{locations.find((l: any) => l.id === t.locationId)?.name || '-'} • {t.date}</span>
                        </div>
                        <div className="text-right">
                            <div className={`text-sm font-black ${t.type === 'INCOME' ? 'text-emerald-600' : 'text-rose-600'}`}>
                                {t.type === 'INCOME' ? '+' : '-'}{t.amount.toLocaleString()} ₽
                            </div>
                            <div className="text-[10px] text-slate-400 font-bold">{t.time}</div>
                        </div>
                    </div>
                ))}
                {filteredList.length === 0 && <div className="py-20 text-center text-slate-400 font-bold uppercase text-xs">Нет данных</div>}
            </div>
        </>
      )}

      {details && (
        <DetailsModal 
          details={details} 
          locations={locations} 
          currentUser={currentUser} 
          onClose={() => setDetails(null)} 
          setTransactions={setTransactions} 
          transactions={transactions} 
        />
      )}

      {showAdd && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-[110] flex items-end md:items-center justify-center md:p-4">
          <Card title="Новая запись" icon={Plus} className={`w-full max-lg shadow-2xl rounded-t-3xl md:rounded-2xl transition-all ${shake ? 'animate-shake' : ''}`}>
            <div className="space-y-4">
              <div className="flex p-1 bg-slate-100 rounded-xl">
                <button onClick={() => {setType("INCOME"); setCategory("");}} className={`flex-1 py-2 text-sm font-bold rounded-lg ${type === 'INCOME' ? 'bg-white text-emerald-600 shadow-sm' : 'text-slate-500'}`}>Доход</button>
                <button onClick={() => {setType("EXPENSE"); setCategory("");}} className={`flex-1 py-2 text-sm font-bold rounded-lg ${type === 'EXPENSE' ? 'bg-white text-rose-600 shadow-sm' : 'text-slate-500'}`}>Расход</button>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <InputWrapper label="Сумма">
                    <input type="number" className={`w-full bg-white border ${errors.includes('amount') ? 'border-rose-500 animate-pulse' : 'border-slate-200'} p-3 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 text-slate-900 font-bold`} value={amount} onChange={e => {setAmount(e.target.value); if(errors.includes('amount')) setErrors(errors.filter(e=>e!=='amount')); }} placeholder="0" />
                </InputWrapper>
                <InputWrapper label="Филиал">
                    <select className={`w-full bg-white border ${errors.includes('location') ? 'border-rose-500 animate-pulse' : 'border-slate-200'} p-3 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 text-slate-900 font-bold`} value={locationId} onChange={e => {setLocationId(e.target.value); if(errors.includes('location')) setErrors(errors.filter(e=>e!=='location')); }}>
                        <option value="">Выбор...</option>
                        {availableLocations.map((l: any) => <option key={l.id} value={l.id}>{l.name}</option>)}
                    </select>
                </InputWrapper>
              </div>
              <InputWrapper label="Категория">
                <select className={`w-full bg-white border ${errors.includes('category') ? 'border-rose-500 animate-pulse' : 'border-slate-200'} p-3 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 text-slate-900 font-bold`} value={category} onChange={e => {setCategory(e.target.value); if(errors.includes('category')) setErrors(errors.filter(e=>e!=='category')); }}>
                  <option value="">Выберите категорию...</option>
                  {currentCategories.map((c: string) => <option key={c} value={c}>{c}</option>)}
                </select>
              </InputWrapper>
              <InputWrapper label="Комментарий">
                <textarea className="w-full bg-white border border-slate-200 p-3 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 text-slate-900 font-medium h-20" placeholder="Заметки..." value={comment} onChange={e => setComment(e.target.value)} />
              </InputWrapper>
              <div className="flex gap-3 pt-2">
                <Button variant="secondary" className="flex-1" onClick={() => {setShowAdd(false); setErrors([]);}}>Отмена</Button>
                <Button className="flex-1" onClick={handleAdd}>Сохранить</Button>
              </div>
            </div>
          </Card>
        </div>
      )}

      <style>{`
        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          25% { transform: translateX(-5px); }
          50% { transform: translateX(5px); }
          75% { transform: translateX(-5px); }
        }
        .animate-shake { animation: shake 0.4s ease-in-out; }
      `}</style>
    </div>
  );
}

// --- Settings View ---

function SettingsView({ currentUser, setCurrentUser, locations, setLocations, users, setUsers, transactions, setTransactions, categories, setCategories, googleDriveConnected, setGoogleDriveConnected, connectGoogleDrive }: any) {
  const [activeSection, setActiveSection] = useState<"profile" | "locations" | "users" | "data" | "categories">("profile");
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [isSureAboutReset, setIsSureAboutReset] = useState(false);

  const handleExportBackup = () => {
    const backup = { users, locations, transactions, categories, exportDate: new Date().toISOString() };
    const blob = new Blob([JSON.stringify(backup, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `Aptoria_Backup_${new Date().toISOString().split('T')[0]}.json`;
    link.click();
  };

  const handleImportBackup = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
        try {
            const data = JSON.parse(event.target?.result as string);
            if(confirm('Это заменит все текущие данные. Продолжить?')) {
                if(data.users) setUsers(data.users);
                if(data.locations) setLocations(data.locations);
                if(data.transactions) setTransactions(data.transactions);
                if(data.categories) setCategories(data.categories);
                alert('Данные восстановлены!');
                // Синхронизация после импорта
                syncWithPusher('data-imported', {
                  users: data.users || users,
                  locations: data.locations || locations,
                  transactions: data.transactions || transactions,
                  categories: data.categories || categories,
                  timestamp: Date.now()
                }, { forceFullSync: true });
            }
        } catch(e) { alert('Ошибка чтения файла'); }
    };
    reader.readAsText(file);
  };

  const handleFullReset = async () => {
    if (currentUser.role === 'FOUNDER' && isSureAboutReset) {
        setTransactions([]);
        setShowResetConfirm(false);
        setIsSureAboutReset(false);
        
        // Синхронизация сброса транзакций
        await syncWithPusher('transactions-reset', {
          userId: currentUser.id,
          timestamp: Date.now(),
          allTransactions: []
        });
    }
  };

  return (
    <div className="flex flex-col lg:flex-row gap-6">
      <div className="w-full lg:w-64 space-y-1 md:space-y-2 overflow-x-auto flex lg:flex-col pb-2 lg:pb-0 scrollbar-hide">
        <SettingsNavItem active={activeSection === "profile"} onClick={() => setActiveSection("profile")} icon={User} label="Профиль" />
        {(currentUser.role === 'FOUNDER' || currentUser.role === 'ADMIN') && (
            <SettingsNavItem active={activeSection === "categories"} onClick={() => setActiveSection("categories")} icon={Layers} label="Категории" />
        )}
        {currentUser.role === 'FOUNDER' && (
          <>
            <SettingsNavItem active={activeSection === "locations"} onClick={() => setActiveSection("locations")} icon={Building} label="Филиалы" />
            <SettingsNavItem active={activeSection === "users"} onClick={() => setActiveSection("users")} icon={Users} label="Доступы" />
            <SettingsNavItem active={activeSection === "data"} onClick={() => setActiveSection("data")} icon={Database} label="Управление" />
          </>
        )}
      </div>

      <div className="flex-1">
        {activeSection === "profile" && <ProfileSection currentUser={currentUser} setCurrentUser={setCurrentUser} setUsers={setUsers} users={users} />}
        {activeSection === "locations" && <LocationsSection locations={locations} setLocations={setLocations} />}
        {activeSection === "users" && <UsersSection users={users} setUsers={setUsers} locations={locations} currentUser={currentUser} />}
        {activeSection === "categories" && <CategoriesSection categories={categories} setCategories={setCategories} locations={locations} currentUser={currentUser} />}
        {activeSection === "data" && (
            <Card title="Управление данными" icon={Database}>
                <div className="space-y-6">
                    <div className="p-4 bg-indigo-50 border border-indigo-100 rounded-2xl">
                        <div className="flex items-center justify-between mb-2">
                             <h4 className="font-black text-indigo-800 text-sm uppercase">Google Drive Облако</h4>
                             <div className={`px-2 py-0.5 rounded text-[10px] font-black uppercase ${googleDriveConnected ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-200 text-slate-600'}`}>
                                {googleDriveConnected ? 'Активно' : 'Выключено'}
                             </div>
                        </div>
                        <p className="text-xs text-indigo-600 mb-4 font-medium">Синхронизируйте базу данных с вашим личным Google Диском.</p>
                        {!googleDriveConnected ? (
                            <Button onClick={connectGoogleDrive} variant="primary" icon={Cloud}>Подключить диск</Button>
                        ) : (
                            <div className="flex items-center justify-between">
                                <div className="text-xs text-emerald-600 font-bold flex items-center gap-1"><Check size={14}/> Облако подключено</div>
                                <Button variant="ghost" className="text-rose-500 text-[10px] px-2" onClick={() => { storage.set("driveConnected", false); setGoogleDriveConnected(false); location.reload(); }}>Отключить</Button>
                            </div>
                        )}
                    </div>
                    <div className="p-4 bg-slate-50 border border-slate-100 rounded-2xl">
                        <h4 className="font-black text-slate-800 text-sm uppercase mb-2">Локальный бэкап</h4>
                        <div className="flex flex-wrap gap-2">
                            <Button variant="secondary" onClick={handleExportBackup} icon={Download}>Скачать JSON</Button>
                            <label className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 text-slate-700 rounded-xl font-medium cursor-pointer hover:bg-slate-50 transition-all">
                                <Upload size={18}/>
                                Восстановить
                                <input type="file" accept=".json" className="hidden" onChange={handleImportBackup} />
                            </label>
                        </div>
                    </div>
                    {currentUser.role === 'FOUNDER' && (
                      <div className="p-4 bg-rose-50 border border-rose-100 rounded-2xl">
                           <h4 className="font-black text-rose-800 text-sm uppercase mb-2">Опасная зона</h4>
                           <p className="text-xs text-rose-600 mb-4 font-medium">Сброс всех записей о транзакциях сети.</p>
                           <Button variant="danger" onClick={() => setShowResetConfirm(true)} icon={Trash2}>Сбросить журнал</Button>
                      </div>
                    )}
                </div>

                {showResetConfirm && (
                    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-[200] flex items-center justify-center p-4 animate-in fade-in zoom-in-95 duration-200">
                        <Card title="Подтверждение удаления" icon={AlertCircle} className="w-full max-w-sm border-rose-100 shadow-2xl">
                            <div className="space-y-5">
                                <div className="flex items-center gap-4 text-rose-600 bg-rose-50 p-4 rounded-xl">
                                    <AlertCircle size={32} className="flex-shrink-0" />
                                    <p className="text-xs font-bold leading-relaxed uppercase">
                                        Внимание! Это действие удалит все транзакции сети без возможности восстановления.
                                    </p>
                                </div>
                                
                                <label className="flex items-start gap-3 p-4 border border-slate-100 rounded-xl bg-slate-50/50 cursor-pointer">
                                    <input 
                                        type="checkbox" 
                                        className="mt-0.5 w-4 h-4 text-rose-600 border-slate-300 rounded focus:ring-rose-500" 
                                        checked={isSureAboutReset}
                                        onChange={(e) => setIsSureAboutReset(e.target.checked)}
                                    />
                                    <span className="text-xs text-slate-600 font-semibold select-none">
                                        Я уверен в своем действии и понимаю, что данные будут удалены навсегда.
                                    </span>
                                </label>

                                <div className="flex gap-3 pt-2">
                                    <Button variant="secondary" className="flex-1" onClick={() => { setShowResetConfirm(false); setIsSureAboutReset(false); }}>Отмена</Button>
                                    <Button variant="danger" className="flex-1" disabled={!isSureAboutReset} onClick={handleFullReset} icon={Trash2}>Подтвердить</Button>
                                </div>
                            </div>
                        </Card>
                    </div>
                )}
            </Card>
        )}
      </div>
    </div>
  );
}

// --- Internal Helper Components ---

const AnalyticsTable = ({ section, data, color }: any) => (
    <div className="space-y-4">
        <div className={`flex items-center justify-between border-b-2 pb-2 ${color === 'emerald' ? 'border-emerald-500' : 'border-rose-500'}`}>
            <h4 className={`font-black uppercase tracking-tighter text-xs md:text-sm ${color === 'emerald' ? 'text-emerald-700' : 'text-rose-700'}`}>{section}</h4>
        </div>
        <div className="overflow-x-auto scrollbar-hide">
            <table className="w-full text-left text-sm">
                <thead>
                    <tr className="text-[10px] text-slate-400 uppercase font-black border-b border-slate-50">
                        <th className="pb-2">Кат.</th>
                        <th className="pb-2 text-right">Сумма</th>
                        <th className="pb-2 text-right">Рент.</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                    {data.map(([name, d]: any) => (
                        <tr key={name} className="hover:bg-slate-50 transition-colors">
                            <td className="py-2 pr-2">
                                <div className="text-black font-bold text-xs md:text-sm mb-1">{name}</div>
                                <div className="w-16 md:w-24 h-1 bg-slate-100 rounded-full overflow-hidden">
                                    <div className={`h-full ${color === 'emerald' ? 'bg-emerald-400' : 'bg-rose-400'}`} style={{ width: `${d.weight}%` }} />
                                </div>
                            </td>
                            <td className="py-2 text-right align-top">
                                <div className="font-black text-slate-900 text-xs md:text-sm">{d.total.toLocaleString()} ₽</div>
                                <div className="text-[9px] text-slate-400 font-bold">{d.weight?.toFixed(1)}%</div>
                            </td>
                            <td className="py-2 text-right align-top font-black text-amber-600 text-xs">{d.profitability}</td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    </div>
);

const DetailsModal = ({ details, locations, currentUser, onClose, setTransactions, transactions }: any) => (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[110] flex items-end md:items-center justify-center md:p-4 animate-in fade-in duration-300">
        <Card title="Операция" icon={Eye} className="w-full max-w-md shadow-2xl relative rounded-t-3xl md:rounded-2xl">
            <button onClick={onClose} className="absolute top-4 right-4 text-slate-400 p-2"><XIcon/></button>
            <div className="space-y-6 pt-2">
                <div className="grid grid-cols-2 gap-4">
                    <DetailItem label="Сумма" value={`${details.amount.toLocaleString()} ₽`} color={details.type === 'INCOME' ? 'text-emerald-600' : 'text-rose-600'} />
                    <DetailItem label="Тип" value={details.type === 'INCOME' ? 'Доход' : 'Расход'} />
                    <DetailItem label="Локация" value={locations.find((l: any) => l.id === details.locationId)?.name || '-'} />
                    <DetailItem label="Категория" value={details.category} />
                    <DetailItem label="Дата" value={details.date} />
                    <DetailItem label="Сотрудник" value={details.userNickname} icon={User} />
                </div>
                {details.comment && (
                    <div className="pt-4 border-t border-slate-100">
                        <label className="text-[10px] font-black text-slate-400 uppercase">Описание</label>
                        <p className="mt-1 text-slate-700 bg-slate-50 p-3 rounded-xl text-sm italic">{details.comment}</p>
                    </div>
                )}
                {(currentUser.role === 'FOUNDER' || currentUser.role === 'ADMIN') && (
                    <Button variant="danger" className="w-full py-3" icon={Trash2} onClick={async () => {
                        if(confirm('Удалить операцию?')) {
                            // 1. Удаляем из состояния
                            const updatedTransactions = transactions.filter((tx: any) => tx.id !== details.id);
                            setTransactions(updatedTransactions);
                            
                            // 2. Синхронизируем через Pusher
                            await syncWithPusher('transaction-deleted', {
                                transactionId: details.id,
                                allTransactions: updatedTransactions,
                                userId: currentUser.id,
                                timestamp: Date.now()
                            });
                            
                            onClose();
                        }
                    }}>Удалить</Button>
                )}
            </div>
        </Card>
    </div>
);

const ProfileSection = ({ currentUser, setCurrentUser, setUsers, users }: any) => {
    const [isEditing, setIsEditing] = useState(false);
    const [nick, setNick] = useState(currentUser.nickname);
    const [email, setEmail] = useState(currentUser.email);
    const [pass, setPass] = useState(currentUser.password);
    
    const handleSave = async () => {
        const updatedUser = {...currentUser, nickname: nick, email, password: pass};
        const updatedUsers = users.map((u: any) => u.id === currentUser.id ? updatedUser : u);
        
        setCurrentUser(updatedUser);
        setUsers(updatedUsers);
        setIsEditing(false);
        
        // Синхронизация изменений профиля
        await syncWithPusher('user-profile-updated', {
            user: updatedUser,
            allUsers: updatedUsers,
            timestamp: Date.now()
        });
    };
    
    return (
        <Card title="Мой профиль" icon={User}>
            <div className="space-y-4 max-w-md">
                <InputWrapper label="Никнейм"><input disabled={!isEditing} className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2 text-slate-900 font-bold disabled:bg-slate-50 outline-none" value={nick} onChange={e => setNick(e.target.value)} /></InputWrapper>
                <InputWrapper label="Email"><input disabled={!isEditing} className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2 text-slate-900 font-bold disabled:bg-slate-50 outline-none" value={email} onChange={e => setEmail(e.target.value)} /></InputWrapper>
                <InputWrapper label="Пароль"><input disabled={!isEditing} type="password" className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2 text-slate-900 font-bold disabled:bg-slate-50 outline-none" value={pass} onChange={e => setPass(e.target.value)} /></InputWrapper>
                <div className="flex gap-2 pt-2">
                    {isEditing ? (
                        <>
                            <Button onClick={handleSave}>Ок</Button>
                            <Button variant="secondary" onClick={()=>setIsEditing(false)}>Отмена</Button>
                        </>
                    ) : (
                        <Button onClick={()=>setIsEditing(true)}>Изменить</Button>
                    )}
                </div>
            </div>
        </Card>
    );
};

const CategoriesSection = ({ categories, setCategories, locations, currentUser }: any) => {
    const [targetLoc, setTargetLoc] = useState(locations[0]?.id || "");
    const [type, setType] = useState<"INCOME" | "EXPENSE">("INCOME");
    const [newCat, setNewCat] = useState("");

    const currentLocCats = useMemo(() => {
        const c = categories[targetLoc];
        if (c) return c[type];
        return type === 'INCOME' ? DEFAULT_INCOME_CATEGORIES : DEFAULT_EXPENSE_CATEGORIES;
    }, [categories, targetLoc, type]);

    const addCategory = async () => {
        if (!newCat) return;
        const current = categories[targetLoc] || { INCOME: [...DEFAULT_INCOME_CATEGORIES], EXPENSE: [...DEFAULT_EXPENSE_CATEGORIES] };
        if (current[type].includes(newCat)) return alert("Такая категория уже есть");
        
        const updatedCategories = { 
            ...categories, 
            [targetLoc]: { 
                ...current, 
                [type]: [...current[type], newCat] 
            } 
        };
        setCategories(updatedCategories);
        
        // Синхронизация добавления категории
        await syncWithPusher('category-added', {
            locationId: targetLoc,
            type: type,
            category: newCat,
            allCategories: updatedCategories,
            timestamp: Date.now()
        });
        
        setNewCat("");
    };

    const removeCategory = async (cat: string) => {
        if (!confirm(`Удалить категорию "${cat}"?`)) return;
        const current = categories[targetLoc] || { INCOME: [...DEFAULT_INCOME_CATEGORIES], EXPENSE: [...DEFAULT_EXPENSE_CATEGORIES] };
        const updatedCategories = { 
            ...categories, 
            [targetLoc]: { 
                ...current, 
                [type]: current[type].filter(c => c !== cat) 
            } 
        };
        setCategories(updatedCategories);
        
        // Синхронизация удаления категории
        await syncWithPusher('category-removed', {
            locationId: targetLoc,
            type: type,
            category: cat,
            allCategories: updatedCategories,
            timestamp: Date.now()
        });
    };

    return (
        <Card title="Категории операций" icon={Layers}>
            <div className="space-y-6">
                <div className="flex flex-col md:flex-row gap-4">
                    <InputWrapper label="Филиал" className="flex-1">
                        <select className="w-full bg-white border border-slate-200 p-3 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 text-slate-900 font-bold" value={targetLoc} onChange={e => setTargetLoc(e.target.value)}>
                            {locations.map((l: any) => <option key={l.id} value={l.id}>{l.name}</option>)}
                        </select>
                    </InputWrapper>
                    <div className="flex-1 space-y-1">
                        <label className="text-[10px] font-black text-slate-400 uppercase ml-1">Тип транзакций</label>
                        <div className="flex p-1 bg-slate-100 rounded-xl">
                            <button onClick={() => setType("INCOME")} className={`flex-1 py-2 text-sm font-bold rounded-lg ${type === 'INCOME' ? 'bg-white text-emerald-600 shadow-sm' : 'text-slate-500'}`}>Доходы</button>
                            <button onClick={() => setType("EXPENSE")} className={`flex-1 py-2 text-sm font-bold rounded-lg ${type === 'EXPENSE' ? 'bg-white text-rose-600 shadow-sm' : 'text-slate-500'}`}>Расходы</button>
                        </div>
                    </div>
                </div>
                <div className="flex gap-2">
                    <input type="text" placeholder="Новая категория..." className="flex-1 bg-white border border-slate-200 p-3 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 text-slate-900 font-bold" value={newCat} onChange={e => setNewCat(e.target.value)} />
                    <Button onClick={addCategory} icon={Plus}>Доб.</Button>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2 max-h-[400px] overflow-y-auto pr-2 scrollbar-hide">
                    {currentLocCats.map(cat => (
                        <div key={cat} className="p-3 border border-slate-100 rounded-xl flex items-center justify-between bg-slate-50/50 hover:bg-white hover:shadow-sm transition-all group">
                            <span className="text-sm font-bold text-slate-800">{cat}</span>
                            <button onClick={() => removeCategory(cat)} className="text-rose-400 hover:text-rose-600 p-1 group-hover:opacity-100 md:opacity-0 transition-opacity"><Trash2 size={16}/></button>
                        </div>
                    ))}
                </div>
            </div>
        </Card>
    );
};

const LocationsSection = ({ locations, setLocations }: any) => {
    const [showModal, setShowModal] = useState(false);
    const [edit, setEdit] = useState<any>(null);
    const [val, setVal] = useState("");
    
    const handleSaveLocation = async () => {
        if (!val) return;
        
        let updatedLocations;
        if (edit) {
            updatedLocations = locations.map((x: any) => 
                x.id === edit.id ? {...x, name: val} : x
            );
        } else {
            const newLocation = { id: Date.now().toString(), name: val };
            updatedLocations = [...locations, newLocation];
        }
        
        setLocations(updatedLocations);
        setShowModal(false);
        
        // Синхронизация изменения локаций
        await syncWithPusher(edit ? 'location-updated' : 'location-added', {
            location: edit ? {id: edit.id, name: val} : {id: Date.now().toString(), name: val},
            allLocations: updatedLocations,
            timestamp: Date.now()
        });
    };
    
    const handleDeleteLocation = async (id: string) => {
        const updatedLocations = locations.filter((x: any) => x.id !== id);
        setLocations(updatedLocations);
        
        // Синхронизация удаления локации
        await syncWithPusher('location-deleted', {
            locationId: id,
            allLocations: updatedLocations,
            timestamp: Date.now()
        });
    };
    
    return (
        <Card title="Локации" icon={Building} extra={
            <Button onClick={()=>{setEdit(null);setVal("");setShowModal(true)}} icon={Plus}>Добавить</Button>
        }>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {locations.map((l: any) => (
                    <div key={l.id} className="p-4 border border-slate-100 rounded-2xl flex items-center justify-between bg-white shadow-sm font-bold text-slate-800">
                        {l.name}
                        <div className="flex gap-1">
                            <button onClick={()=>{setEdit(l);setVal(l.name);setShowModal(true)}} className="p-2 text-indigo-400 hover:text-indigo-600">
                                <Pencil size={18}/>
                            </button>
                            <button onClick={() => handleDeleteLocation(l.id)} className="p-2 text-rose-400 hover:text-rose-600">
                                <Trash2 size={18}/>
                            </button>
                        </div>
                    </div>
                ))}
            </div>
            {showModal && (
                <div className="fixed inset-0 bg-slate-900/60 z-[120] flex items-center justify-center p-4">
                    <Card title={edit ? "Изменить филиал" : "Новая локация"} className="w-full max-w-xs relative">
                        <button onClick={()=>setShowModal(false)} className="absolute top-4 right-4 text-slate-400"><XIcon/></button>
                        <div className="space-y-4 pt-2">
                            <input 
                                placeholder="Название..." 
                                className="w-full p-3 border rounded-xl bg-white text-slate-900 font-bold outline-none" 
                                value={val} 
                                onChange={e=>setVal(e.target.value)}
                            />
                            <div className="flex gap-2">
                                <Button className="flex-1" onClick={handleSaveLocation}>Ок</Button>
                                <Button variant="secondary" onClick={()=>setShowModal(false)}>Отмена</Button>
                            </div>
                        </div>
                    </Card>
                </div>
            )}
        </Card>
    );
};

const UsersSection = ({ users, setUsers, locations, currentUser }: any) => {
    const [show, setShow] = useState(false);
    const [editId, setEditId] = useState<string | null>(null);
    const [nu, setNu] = useState({ nickname: '', email: '', password: '', role: 'USER' as Role, locs: [] as string[] });

    const handleOpenAdd = () => {
        setEditId(null);
        setNu({ nickname: '', email: '', password: '', role: 'USER', locs: [] });
        setShow(true);
    };

    const handleOpenEdit = (u: UserAccount) => {
        setEditId(u.id);
        setNu({ nickname: u.nickname, email: u.email, password: u.password, role: u.role, locs: u.locationIds || [] });
        setShow(true);
    };

    const handleSave = async () => {
        if (!nu.nickname || !nu.email || !nu.password) {
            alert("Заполните обязательные поля");
            return;
        }

        let updatedUsers;
        if (editId) {
            updatedUsers = users.map((u: any) => 
                u.id === editId ? { ...u, ...nu, locationIds: nu.locs } : u
            );
        } else {
            const newUser = { 
                ...nu, 
                id: Date.now().toString(), 
                locationIds: nu.locs 
            };
            updatedUsers = [...users, newUser];
        }
        
        setUsers(updatedUsers);
        setShow(false);
        
        // Синхронизация изменения пользователей
        await syncWithPusher(editId ? 'user-updated' : 'user-added', {
            user: editId ? 
                { id: editId, ...nu, locationIds: nu.locs } : 
                { id: Date.now().toString(), ...nu, locationIds: nu.locs },
            allUsers: updatedUsers,
            timestamp: Date.now()
        });
    };

    const handleDeleteUser = async (userId: string) => {
        const updatedUsers = users.filter((x: any) => x.id !== userId);
        setUsers(updatedUsers);
        
        // Синхронизация удаления пользователя
        await syncWithPusher('user-deleted', {
            userId: userId,
            allUsers: updatedUsers,
            timestamp: Date.now()
        });
    };

    const toggleLoc = (id: string) => {
        setNu(prev => ({
            ...prev,
            locs: prev.locs.includes(id) ? prev.locs.filter(l => l !== id) : [...prev.locs, id]
        }));
    };

    return (
        <Card title="Пользователи" icon={Users} extra={<Button onClick={handleOpenAdd} icon={UserPlus}>Добавить</Button>}>
            <div className="space-y-3">
                {users.map((u: any)=>(
                    <div key={u.id} className="flex items-center justify-between p-4 border border-slate-100 rounded-2xl bg-white shadow-sm">
                        <div className="flex-1 min-w-0 pr-4">
                            <p className="font-black text-slate-900 truncate">{u.nickname}</p>
                            <p className="text-[10px] text-slate-500 font-bold uppercase truncate">
                                {u.role} • {u.role === 'FOUNDER' ? 'Вся сеть' : (u.locationIds && u.locationIds.length > 0 ? locations.filter((l: any) => u.locationIds.includes(l.id)).map((l: any) => l.name).join(', ') : 'Нет доступа')}
                            </p>
                        </div>
                        <div className="flex gap-1">
                            <button onClick={() => handleOpenEdit(u)} className="p-2 text-indigo-400 hover:text-indigo-600">
                                <Pencil size={18}/>
                            </button>
                            {/* Удалить может только основатель, и нельзя удалить самого себя */}
                            {currentUser.role === 'FOUNDER' && u.id !== currentUser.id && (
                                <button onClick={() => handleDeleteUser(u.id)} className="p-2 text-rose-400 hover:text-rose-600">
                                    <Trash2 size={18}/>
                                </button>
                            )}
                        </div>
                    </div>
                ))}
            </div>
            
            {show && (
                <div className="fixed inset-0 bg-slate-900/60 z-[120] flex items-center justify-center p-4 overflow-y-auto backdrop-blur-sm">
                    <Card title={editId ? "Редактировать аккаунт" : "Новый аккаунт"} className="w-full max-w-sm relative">
                        <button onClick={() => setShow(false)} className="absolute top-4 right-4 text-slate-400 p-1"><XIcon/></button>
                        <div className="space-y-3 pt-2">
                            <InputWrapper label="Имя">
                                <input placeholder="Имя" className="w-full p-3 border rounded-xl bg-white text-slate-900 font-bold outline-none focus:ring-2 focus:ring-indigo-500 border-slate-200" value={nu.nickname} onChange={e=>setNu({...nu,nickname:e.target.value})}/>
                            </InputWrapper>
                            <InputWrapper label="Email">
                                <input placeholder="Email" className="w-full p-3 border rounded-xl bg-white text-slate-900 font-bold outline-none focus:ring-2 focus:ring-indigo-500 border-slate-200" value={nu.email} onChange={e=>setNu({...nu,email:e.target.value})}/>
                            </InputWrapper>
                            <InputWrapper label="Пароль">
                                <input placeholder="Пароль" className="w-full p-3 border rounded-xl bg-white text-slate-900 font-bold outline-none focus:ring-2 focus:ring-indigo-500 border-slate-200" value={nu.password} onChange={e=>setNu({...nu,password:e.target.value})}/>
                            </InputWrapper>
                            <InputWrapper label="Роль">
                                <select className="w-full p-3 border rounded-xl bg-white text-slate-900 font-bold outline-none focus:ring-2 focus:ring-indigo-500 border-slate-200" value={nu.role} onChange={e=>setNu({...nu,role:e.target.value as any})}>
                                    <option value="USER">Пользователь</option>
                                    <option value="ADMIN">Админ</option>
                                    <option value="FOUNDER">Основатель</option>
                                </select>
                            </InputWrapper>
                            
                            {nu.role !== 'FOUNDER' && (
                                <InputWrapper label="Доступные филиалы">
                                    <div className="max-h-40 overflow-y-auto border border-slate-200 rounded-xl p-2 bg-slate-50 space-y-1">
                                        {locations.map((l: any) => (
                                            <label key={l.id} className="flex items-center gap-3 p-2 hover:bg-white rounded-lg cursor-pointer transition-colors">
                                                <input 
                                                    type="checkbox" 
                                                    checked={nu.locs.includes(l.id)} 
                                                    onChange={() => toggleLoc(l.id)}
                                                    className="w-4 h-4 text-indigo-600 rounded border-slate-300"
                                                />
                                                <span className="text-sm font-bold text-slate-700">{l.name}</span>
                                            </label>
                                        ))}
                                        {locations.length === 0 && <p className="text-center text-[10px] py-4 text-slate-400 font-bold uppercase">Сначала добавьте локации</p>}
                                    </div>
                                </InputWrapper>
                            )}

                            <div className="flex gap-2 pt-4">
                                <Button className="flex-1" onClick={handleSave}>{editId ? "Сохранить" : "Создать"}</Button>
                                <Button variant="secondary" onClick={()=>setShow(false)}>Отмена</Button>
                            </div>
                        </div>
                    </Card>
                </div>
            )}
        </Card>
    );
};

const NavItem = ({ active, onClick, icon: Icon, label }: any) => (
  <button onClick={onClick} className={`w-full flex items-center gap-3 px-3 py-3 rounded-xl transition-all ${active ? 'bg-indigo-600 text-white font-black shadow-lg shadow-indigo-600/20' : 'text-slate-400 hover:bg-slate-800 hover:text-white'}`}>
    <Icon size={20} />
    <span className="text-sm font-bold">{label}</span>
  </button>
);

const MobileNavItem = ({ active, onClick, icon: Icon }: any) => (
  <button onClick={onClick} className={`p-3 rounded-2xl transition-all ${active ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-400'}`}>
    <Icon size={24} />
  </button>
);

const SettingsNavItem = ({ active, onClick, icon: Icon, label }: any) => (
  <button onClick={onClick} className={`flex-shrink-0 flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold transition-all ${active ? 'bg-indigo-600 text-white shadow-lg' : 'bg-white border border-slate-100 text-slate-500 lg:bg-transparent lg:border-none hover:bg-slate-50'}`}>
    <Icon size={18} />
    <span className="whitespace-nowrap">{label}</span>
  </button>
);

const FilterBtn = ({ active, onClick, children }: any) => (
    <button onClick={onClick} className={`flex-1 md:flex-none px-4 py-1.5 rounded-lg text-[10px] md:text-xs font-black transition-all ${active ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>{children}</button>
);

const StatCard = ({ title, value, icon: Icon, color }: any) => {
  const colors: any = { indigo: "bg-indigo-50 text-indigo-600", emerald: "bg-emerald-50 text-emerald-600", rose: "bg-rose-50 text-rose-600", amber: "bg-amber-50 text-amber-600" };
  return (
    <div className="bg-white p-3 md:p-6 rounded-2xl border border-slate-100 shadow-sm">
      <div className={`w-8 h-8 md:w-10 md:h-10 rounded-xl mb-3 flex items-center justify-center ${colors[color]}`}><Icon size={16} className="md:w-5 md:h-5" /></div>
      <h4 className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1 truncate">{title}</h4>
      <p className="text-sm md:text-xl font-black text-slate-900 truncate">{value.toLocaleString()} ₽</p>
    </div>
  );
};

const DetailItem = ({ label, value, color = "text-slate-900", icon: Icon }: any) => (
    <div className="space-y-0.5">
        <label className="text-[9px] font-black text-slate-400 uppercase flex items-center gap-1">{Icon && <Icon size={10}/>} {label}</label>
        <p className={`text-sm font-bold truncate ${color}`}>{value}</p>
    </div>
);

const InputWrapper = ({ label, children, className = "" }: any) => (
    <div className={`space-y-1 ${className}`}>
        <label className="text-[10px] font-black text-slate-400 uppercase ml-1">{label}</label>
        {children}
    </div>
);

// --- Render ---

const root = createRoot(document.getElementById("root")!);
root.render(<App />);
