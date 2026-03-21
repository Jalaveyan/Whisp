import { invoke } from "@tauri-apps/api/core";
import { readText as clipboardRead, writeText as clipboardWrite } from "@tauri-apps/plugin-clipboard-manager";
import * as topojson from "topojson-client";
import worldAtlas from "world-atlas/land-110m.json";
import "./styles.css";

const _landGeo = topojson.feature(worldAtlas as any, (worldAtlas as any).objects.land);

const ICONS = {
  ml: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M12 1v4M12 19v4M4.22 4.22l2.83 2.83M16.95 16.95l2.83 2.83M1 12h4M19 12h4M4.22 19.78l2.83-2.83M16.95 7.05l2.83-2.83"/></svg>`,
  bolt: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>`,
  home: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>`,
  wifi: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12.55a11 11 0 0 1 14.08 0"/><path d="M1.42 9a16 16 0 0 1 21.16 0"/><path d="M8.53 16.11a6 6 0 0 1 6.95 0"/><line x1="12" y1="20" x2="12.01" y2="20"/></svg>`,
  user: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>`,
  log: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>`,
  globe: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>`,
  settings: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>`,
  refresh: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/></svg>`,
  copy: `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>`,
  play: `<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"/></svg>`,
  x: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>`,
  link: `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>`,
  ping: `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>`,
  pencil: `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>`,
};

interface AppSettings {
  conn_key: string;
  auto_connect: boolean;
  theme: string;
  mihomo_port: number;
  socks_addr: string;
  kill_switch: boolean;
  dns_redirect: boolean;
  ipv6: boolean;
  tun_stack: string;
  hwid: boolean;
  auth_tip: boolean;
  secret: string;
}

interface Profile { id: string; name: string; key: string; }

interface Subscription {
  id: string;
  name: string;
  url: string;
  keys: string[];
  servers: unknown[];
  updated: string;
}

interface SiteCheck {
  name: string;
  letter: string;
  cssClass: string;
  url: string;
  status: "checking" | "ok" | "timeout";
  ping: number;
}

type Page = "home" | "connections" | "profiles" | "routing" | "blocklist" | "logs" | "settings" | "bridges" | "ml";
type Lang = "ru" | "en";

interface BridgeInfo {
  id: string;
  name?: string;
  lat: number;
  lon: number;
  country?: string;
  city?: string;
  region?: string;
  alive: boolean;
  latency_ms?: number;
  type?: string;
  address?: string;
  load?: number;
  bandwidth_mbps?: number;
  cur_users?: number;
  max_users?: number;
  version?: string;
  distance_km?: number;
  ml_score?: number;
  ml_reason?: string;
}

interface MLNetworkAnalysis {
  dpi_risk: "low" | "medium" | "high" | "critical";
  recommended_transport: string;
  recommended_reason: string;
  avg_rtt_ms: number | null;
  reachable: number;
  total_probed: number;
}

interface MLTransportRecommendation {
  dpi_risk: string;
  transport: string;
  options: string;
  description: string;
}

/** Haversine distance between two coordinates, returns km. */
function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) ** 2;
  return Math.round(R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
}

let userLat = 0, userLon = 0;

interface RoutingRule {
  id: string;
  kind: "domain" | "process" | "domain-keyword" | "domain-full" | "ip";
  value: string;
  action: "DIRECT" | "PROXY" | "REJECT";
}

const i18n: Record<Lang, Record<string, string>> = {
  ru: {
    home: "Главная", connections: "Соединения", profiles: "Профили", routing: "Маршруты", logs: "Журнал", settings: "Настройки", bridges: "Мосты", ml: "Режим ML",
    mlTitle: "Режим ML", mlStatus: "Статус", mlRunning: "Запущен", mlStopped: "Остановлен",
    mlStart: "Запустить", mlStop: "Остановить", mlRestart: "Перезапустить",
    mlNoBinary: "Файл whispera-ml-server.exe не найден рядом с клиентом",
    mlServer: "ML Сервер", mlEndpoint: "Адрес", mlLogs: "Логи",
    mlClearLogs: "Очистить", mlRefreshLogs: "Обновить",
    mlFallback: "Режим работы", mlFallbackOn: "Fallback (встроенный)", mlFallbackOff: "Python ML активен",
    mlDesc: "ML анализирует трафик в реальном времени и адаптирует обфускацию под текущий DPI",
    mlNetworkAnalysis: "Анализ сети", mlRunAnalysis: "Анализировать сеть", mlAnalyzing: "Анализирую...",
    mlDpiRisk: "Риск DPI", mlDpiLow: "Низкий", mlDpiMedium: "Средний", mlDpiHigh: "Высокий", mlDpiCritical: "Критический",
    mlAvgRtt: "Средний RTT", mlReachable: "Хостов доступно",
    mlTransportRec: "Рекомендуемый транспорт", mlTransportDesc: "Почему",
    mlScanFirst: "Нажмите «Анализировать сеть» для рекомендации транспорта",
    mlTraining: "Тренировка модели", mlTrainStart: "Запустить тренировку", mlTrainStop: "Остановить",
    mlTrainRunning: "Тренируется...", mlTrainEpoch: "Эпоха", mlTrainLoss: "Loss", mlTrainProgress: "Прогресс",
    mlTrainDone: "Тренировка завершена", mlTrainFailed: "Ошибка тренировки",
    mlPortScan: "Сканирование портов", mlScanStart: "Сканировать", mlScanRunning: "Сканирование...",
    mlScanHost: "Хост", mlScanPort: "Порт", mlScanService: "Сервис", mlScanLatency: "Задержка",
    mlScanOpen: "открыт", mlScanClosed: "закрыт", mlScanNoResults: "Нет результатов",
    mlFederated: "Федеративное обучение", mlFedExport: "Экспорт дельты", mlFedImport: "Импорт дельты",
    mlFedLosses: "Loss метрики", mlFedExported: "Дельта экспортирована", mlFedImported: "Дельта импортирована",
    mlDatasets: "Датасеты", mlDsCapture: "Захватить", mlDsUpload: "Загрузить", mlDsEmpty: "Нет датасетов",
    mlFeedback: "Обратная связь", mlFbSuccess: "Успех", mlFbFail: "Ошибка", mlFbTotal: "Всего", mlFbLatency: "Задержка",
    mlFbNoData: "Нет данных", mlFbSend: "Отправить результат",
    mlModelMgmt: "Управление моделью", mlModelReload: "Перезагрузить модель", mlModelParams: "Параметров",
    mlModelAccuracy: "Точность", mlModelSamples: "Сэмплов", mlModelEngine: "Движок",
    mlTargetServer: "Целевой сервер", mlTargetServerHint: "host:port, например 1.2.3.4:8443",
    mlToken: "ML Токен", mlTokenHint: "PSK токен для авторизации",
    mlConnect: "Подключить через ML", mlConnecting: "Подключение...", mlDisconnect: "Отключить",
    mlBridgesRanked: "Мосты проранжированы ML", mlScore: "ML",
    bridgesTitle: "Карта мостов", noBridges: "Нет доступных мостов", bridgeConnect: "Подключить",
    bridgesAlive: "Активных", bridgesTotal: "Всего", bridgesLatency: "Пинг", bridgesRefresh: "Обновить",
    bridgesNoKey: "Укажите ключ подключения в Настройках чтобы загрузить мосты",
    bridgesConnecting: "Подключение к мосту...", bridgesConnected: "Ключ моста установлен",
    connection: "ПОДКЛЮЧЕНИЕ", noProfile: "Нет профиля", disconnected: "Отключено", connected: "Подключено",
    keyPlaceholder: "Вставьте ключ...", connect: "Connect", disconnect: "Disconnect",
    siteCheck: "ПРОВЕРКА САЙТОВ", timeout: "Timeout", ok: "OK", checking: "...",
    ipInfo: "IP ИНФОРМАЦИЯ", ipAddress: "IP Адрес", location: "Местоположение", provider: "Провайдер",
    system: "СИСТЕМА", os: "ОС", uptime: "Время работы", version: "Версия", admin: "Админ",
    activeConns: "Активные соединения", connectToSee: "Подключитесь к VPN чтобы увидеть соединения",
    noProfiles: "Нет сохранённых профилей", addProfile: "Добавить профиль",
    systemLog: "Системный журнал", logReady: "Система готова. Ожидание логов...",
    mixedPort: "Смешанный порт :", bindAddr: "Привязать адрес :", tunStack: "Tun Stack :",
    theme: "Тема :", dark: "Тёмная", auto: "Белая", dnsRedirect: "DNS перенаправление :",
    ipv6Label: "IPv6 :", secretLabel: "Secret :", copy: "Копировать",
    hwid: "HWID :", autostart: "Автозапуск :", authTip: "Совет по аутентификации :",
    config: "Конфиг :", open: "Открыть", update: "Обновить :",
    openRepo: "Открыть репо", checkUpdates: "Проверить обновления",
    installed: "Установлено в актуальной версии",
    profileName: "Имя профиля", profileKey: "Ключ подключения",
    save: "Сохранить", cancel: "Отмена",
    mihomo: "MIHOMO", whisp: "WHISP",
    tunnel: "ТУННЕЛЬ", server: "Сервер", duration: "Длительность",
    proxy: "ПРОКСИ", port: "Порт", notSet: "не задан",
    clearLogs: "Очистить", active: "Активно", inactive: "Неактивно",
    paste: "Вставить", connecting: "Подключение...", disconnecting: "Отключение...",
    killSwitch: "Kill Switch",
    routingTitle: "Маршруты", routingDesc: "Укажите приложения или сайты которые идут напрямую или через VPN",
    addSite: "Добавить сайт", addApp: "Выбрать приложение", domain: "Домен", app: "Приложение",
    routeDirect: "Напрямую", routeProxy: "Через VPN", noRules: "Правила не добавлены",
    domainHint: "Например: steampowered.com",
    discordVpn: "Через VPN", discordDirect: "Напрямую",
    discordDesc: "VPN — приложение запускается; Напрямую — голос работает",
    blocklist: "Блок-лист", blocklistTitle: "Блок-лист", blocklistDesc: "Заблокированные домены и приложения — трафик полностью блокируется",
    blockDomain: "Заблокировать домен", blockApp: "Заблокировать приложение", blockKeyword: "По ключевому слову", blockIp: "Заблокировать IP/CIDR",
    noBlocked: "Список пуст", blocked: "Заблокирован", domainBlockHint: "Например: tiktok.com",
    keywordHint: "Например: tracker", ipHint: "Например: 1.2.3.0/24",
    subscriptions: "Подписки", addSubscription: "Добавить подписку",
    subName: "Название", subUrl: "URL подписки", subUrlHint: "https://server/sub/TOKEN",
    noSubscriptions: "Нет подписок", subKeys: "ключей", subRefreshing: "Обновление...",
    subRefresh: "Обновить", subDelete: "Удалить", subLastUpdated: "Обновлено",
    subSelectKey: "Выбрать ключ", subRename: "Переименовать",
    pingKey: "Пинг", pingAll: "Пинг всех", pingMs: "мс", pingTimeout: "timeout", pingRunning: "...",
  },
  en: {
    home: "Home", connections: "Connections", profiles: "Profiles", routing: "Routing", logs: "Logs", settings: "Settings", bridges: "Bridges", ml: "ML Mode",
    mlTitle: "ML Mode", mlStatus: "Status", mlRunning: "Running", mlStopped: "Stopped",
    mlStart: "Start", mlStop: "Stop", mlRestart: "Restart",
    mlNoBinary: "whispera-ml-server.exe not found next to the client",
    mlServer: "ML Server", mlEndpoint: "Endpoint", mlLogs: "Logs",
    mlClearLogs: "Clear", mlRefreshLogs: "Refresh",
    mlFallback: "Mode", mlFallbackOn: "Fallback (built-in)", mlFallbackOff: "Python ML active",
    mlDesc: "ML analyses traffic in real-time and adapts obfuscation to the current DPI",
    mlNetworkAnalysis: "Network Analysis", mlRunAnalysis: "Analyse network", mlAnalyzing: "Analysing...",
    mlDpiRisk: "DPI Risk", mlDpiLow: "Low", mlDpiMedium: "Medium", mlDpiHigh: "High", mlDpiCritical: "Critical",
    mlAvgRtt: "Avg RTT", mlReachable: "Hosts reachable",
    mlTransportRec: "Recommended transport", mlTransportDesc: "Why",
    mlScanFirst: "Click «Analyse network» to get a transport recommendation",
    mlTraining: "Model Training", mlTrainStart: "Start Training", mlTrainStop: "Stop",
    mlTrainRunning: "Training...", mlTrainEpoch: "Epoch", mlTrainLoss: "Loss", mlTrainProgress: "Progress",
    mlTrainDone: "Training complete", mlTrainFailed: "Training failed",
    mlPortScan: "Port Scan", mlScanStart: "Scan", mlScanRunning: "Scanning...",
    mlScanHost: "Host", mlScanPort: "Port", mlScanService: "Service", mlScanLatency: "Latency",
    mlScanOpen: "open", mlScanClosed: "closed", mlScanNoResults: "No results",
    mlFederated: "Federated Learning", mlFedExport: "Export Delta", mlFedImport: "Import Delta",
    mlDatasets: "Datasets", mlDsCapture: "Capture", mlDsUpload: "Upload", mlDsEmpty: "No datasets",
    mlFeedback: "Feedback", mlFbSuccess: "Success", mlFbFail: "Fail", mlFbTotal: "Total", mlFbLatency: "Latency",
    mlFbNoData: "No data", mlFbSend: "Send result",
    mlModelMgmt: "Model Management", mlModelReload: "Reload Model", mlModelParams: "Parameters",
    mlModelAccuracy: "Accuracy", mlModelSamples: "Samples", mlModelEngine: "Engine",
    mlFedLosses: "Loss Metrics", mlFedExported: "Delta exported", mlFedImported: "Delta imported",
    mlTargetServer: "Target server", mlTargetServerHint: "host:port, e.g. 1.2.3.4:8443",
    mlToken: "ML Token", mlTokenHint: "PSK auth token",
    mlConnect: "Connect via ML", mlConnecting: "Connecting...", mlDisconnect: "Disconnect",
    mlBridgesRanked: "Bridges ranked by ML", mlScore: "ML",
    bridgesTitle: "Bridge Map", noBridges: "No bridges available", bridgeConnect: "Connect",
    bridgesAlive: "Alive", bridgesTotal: "Total", bridgesLatency: "Latency", bridgesRefresh: "Refresh",
    bridgesNoKey: "Set a connection key in Settings to load bridges",
    bridgesConnecting: "Connecting to bridge...", bridgesConnected: "Bridge key set",
    connection: "CONNECTION", noProfile: "No profile", disconnected: "Disconnected", connected: "Connected",
    keyPlaceholder: "Paste key...", connect: "Connect", disconnect: "Disconnect",
    siteCheck: "SITE CHECK", timeout: "Timeout", ok: "OK", checking: "...",
    ipInfo: "IP INFORMATION", ipAddress: "IP Address", location: "Location", provider: "Provider",
    system: "SYSTEM", os: "OS", uptime: "Uptime", version: "Version", admin: "Admin",
    activeConns: "Active connections", connectToSee: "Connect to VPN to see connections",
    noProfiles: "No saved profiles", addProfile: "Add profile",
    systemLog: "System Log", logReady: "System ready. Waiting for logs...",
    mixedPort: "Mixed port :", bindAddr: "Bind address :", tunStack: "Tun Stack :",
    theme: "Theme :", dark: "Dark", auto: "Light", dnsRedirect: "DNS redirect :",
    ipv6Label: "IPv6 :", secretLabel: "Secret :", copy: "Copy",
    hwid: "HWID :", autostart: "Autostart :", authTip: "Auth tip :",
    config: "Config :", open: "Open", update: "Update :",
    openRepo: "Open repo", checkUpdates: "Check updates",
    installed: "Installed & up to date",
    profileName: "Profile name", profileKey: "Connection key",
    save: "Save", cancel: "Cancel",
    mihomo: "MIHOMO", whisp: "WHISP",
    tunnel: "TUNNEL", server: "Server", duration: "Duration",
    proxy: "PROXY", port: "Port", notSet: "not set",
    clearLogs: "Clear", active: "Active", inactive: "Inactive",
    paste: "Paste", connecting: "Connecting...", disconnecting: "Disconnecting...",
    killSwitch: "Kill Switch",
    routingTitle: "Routing", routingDesc: "Specify apps or sites that go direct or through VPN",
    addSite: "Add site", addApp: "Browse app", domain: "Domain", app: "Application",
    routeDirect: "Direct", routeProxy: "Through VPN", noRules: "No rules added",
    domainHint: "e.g. steampowered.com",
    discordVpn: "Through VPN", discordDirect: "Direct",
    discordDesc: "VPN — app connects; Direct — voice works",
    blocklist: "Blocklist", blocklistTitle: "Blocklist", blocklistDesc: "Blocked domains and apps — traffic is completely rejected",
    blockDomain: "Block domain", blockApp: "Block application", blockKeyword: "By keyword", blockIp: "Block IP/CIDR",
    noBlocked: "List is empty", blocked: "Blocked", domainBlockHint: "e.g. tiktok.com",
    keywordHint: "e.g. tracker", ipHint: "e.g. 1.2.3.0/24",
    subscriptions: "Subscriptions", addSubscription: "Add subscription",
    subName: "Name", subUrl: "Subscription URL", subUrlHint: "https://server/sub/TOKEN",
    noSubscriptions: "No subscriptions", subKeys: "keys", subRefreshing: "Refreshing...",
    subRefresh: "Refresh", subDelete: "Delete", subLastUpdated: "Updated",
    subSelectKey: "Use key", subRename: "Rename",
    pingKey: "Ping", pingAll: "Ping all", pingMs: "ms", pingTimeout: "timeout", pingRunning: "...",
  },
};

let currentPage: Page = "home";
let lang: Lang = "ru";
let isConnected = false;
let isConnecting = false;
let settings: AppSettings = {
  conn_key: "", auto_connect: false, theme: "dark", mihomo_port: 9887,
  socks_addr: "127.0.0.1", kill_switch: false, dns_redirect: false,
  ipv6: true, tun_stack: "Mixed", hwid: true, auth_tip: true, secret: "",
};

let profiles: Profile[] = [];
let subscriptions: Subscription[] = [];
let pingResults: Map<string, number | "pinging" | "timeout"> = new Map();
let subUpdateAvailable: Set<string> = new Set();
let subAutoCheckTimer: ReturnType<typeof setInterval> | null = null;
let routingRules: RoutingRule[] = [];
let blocklistRules: RoutingRule[] = [];
let bridgeList: BridgeInfo[] = [];
let currentFingerprint = "chrome";
let logLines: string[] = [];
let connectTime: number | null = null;
let ipInfo = { ip: "—", location: "—", provider: "—" };
let sysInfo = { os: "—", uptime: "—", version: "v0.1.4", admin: false };

const sites: SiteCheck[] = [
  { name: "Google",    letter: "G",  cssClass: "google",    url: "https://google.com",    status: "checking", ping: 0 },
  { name: "YouTube",   letter: "Y",  cssClass: "youtube",   url: "https://youtube.com",   status: "checking", ping: 0 },
  { name: "GitHub",    letter: "H",  cssClass: "github",    url: "https://github.com",    status: "checking", ping: 0 },
  { name: "Twitter",   letter: "X",  cssClass: "twitter",   url: "https://twitter.com",   status: "checking", ping: 0 },
  { name: "Spotify",   letter: "S",  cssClass: "spotify",   url: "https://spotify.com",   status: "checking", ping: 0 },
  { name: "Instagram", letter: "In", cssClass: "instagram", url: "https://instagram.com", status: "checking", ping: 0 },
  { name: "Facebook",  letter: "F",  cssClass: "facebook",  url: "https://facebook.com",  status: "checking", ping: 0 },
  { name: "Discord",   letter: "D",  cssClass: "discord",   url: "https://discord.com",   status: "checking", ping: 0 },
  { name: "Reddit",    letter: "R",  cssClass: "reddit",    url: "https://reddit.com",    status: "checking", ping: 0 },
  { name: "Netflix",   letter: "N",  cssClass: "netflix",   url: "https://netflix.com",   status: "checking", ping: 0 },
];

function t(key: string): string { return i18n[lang][key] || key; }

function getServerBaseURL(): string {
  const key = settings.conn_key.trim();
  if (!key) return "";
  if (key.startsWith("whispera://")) {
    try {
      const u = new URL(key);
      const scheme = u.port === "443" || u.port === "" ? "https" : "http";
      return `${scheme}://${u.host}`;
    } catch { return ""; }
  }
  return "";
}

function getServerHost(): string {
  const key = settings.conn_key.trim();
  if (!key) return "";
  if (key.startsWith("whispera://") && key.includes("?")) {
    try { return new URL(key).host; } catch { return ""; }
  }
  return "";
}

function formatDuration(ms: number): string {
  const s = Math.floor(ms / 1000);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${sec}s`;
  return `${sec}s`;
}

function genSecret(): string {
  const c = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  return Array.from({ length: 16 }, () => c[Math.floor(Math.random() * c.length)]).join("");
}

function loadProfiles(): void { try { const r = localStorage.getItem("whisp_profiles"); if (r) profiles = JSON.parse(r); } catch {/**/ } }
function saveProfiles(): void { localStorage.setItem("whisp_profiles", JSON.stringify(profiles)); }

async function loadSubscriptions(): Promise<void> {
  try { subscriptions = await invoke<Subscription[]>("get_subscriptions"); } catch {/**/ }
}

async function autoCheckSubscriptions(): Promise<void> {
  for (const sub of subscriptions) {
    try {
      const remote = await invoke<Subscription>("check_subscription_update", { id: sub.id });
      if (remote && remote.updated !== sub.updated) {
        subUpdateAvailable.add(sub.id);
      }
    } catch {/**/}
  }
  if (subUpdateAvailable.size > 0 && currentPage === "profiles") renderPage();
}

function startSubAutoCheck(): void {
  if (subAutoCheckTimer) clearInterval(subAutoCheckTimer);
  subAutoCheckTimer = setInterval(() => autoCheckSubscriptions(), 10 * 60 * 1000);
}
function loadLang(): void { const s = localStorage.getItem("whisp_lang"); if (s === "en" || s === "ru") lang = s; }
function saveLang(): void { localStorage.setItem("whisp_lang", lang); }

/* ===================== BACKEND ===================== */
async function loadSettings(): Promise<void> {
  try { const s = await invoke<AppSettings>("get_app_settings"); settings = { ...settings, ...s }; } catch {/**/ }
  if (!settings.secret) settings.secret = genSecret();
}

async function persistSettings(): Promise<void> {
  try { await invoke("save_app_setting", { settings }); } catch {/**/ }
}

async function loadRoutingRules(): Promise<void> {
  try { routingRules = await invoke<RoutingRule[]>("get_routing_rules"); } catch {/**/ }
}

async function persistRoutingRules(): Promise<void> {
  try { await invoke("save_routing_rules", { rules: routingRules }); } catch {/**/ }
}

async function loadBlocklist(): Promise<void> {
  try { blocklistRules = await invoke<RoutingRule[]>("get_blocklist"); } catch {/**/ }
}

async function persistBlocklist(): Promise<void> {
  try { await invoke("save_blocklist", { rules: blocklistRules }); } catch {/**/ }
}

let _appliedMlTransport = "";

async function doConnect(): Promise<void> {
  isConnecting = true;
  if (currentPage === "home") renderPage();
  try {
    const msg = await invoke<string>("connect");
    isConnected = true;
    connectTime = Date.now();
    addLog("✓ " + msg);
    try { _appliedMlTransport = await invoke<string>("get_ml_transport"); } catch { _appliedMlTransport = ""; }
    const transportMsg = _appliedMlTransport
      ? (lang === "ru" ? `VPN подключён · транспорт: ${_appliedMlTransport}` : `VPN connected · transport: ${_appliedMlTransport}`)
      : (lang === "ru" ? "VPN подключён" : "VPN connected");
    showToast(transportMsg, "success", 4000);
  } catch (e) {
    addLog("✗ " + e);
    showToast(String(e), "error", 5000);
  }
  isConnecting = false;
  if (currentPage === "home") renderPage();
}

async function doDisconnect(): Promise<void> {
  isConnecting = true;
  if (currentPage === "home") renderPage();
  try {
    const msg = await invoke<string>("disconnect");
    isConnected = false;
    connectTime = null;
    addLog("○ " + msg);
    showToast(lang === "ru" ? "VPN отключён" : "VPN disconnected", "info");
  } catch (e) {
    addLog("✗ " + e);
    showToast(String(e), "error", 5000);
  }
  isConnecting = false;
  if (currentPage === "home") renderPage();
}

async function checkStatus(): Promise<void> {
  try { isConnected = await invoke<boolean>("get_status"); } catch {/**/ }
}

/* Site checks — update DOM in-place, no flicker */
async function checkSites(): Promise<void> {
  for (const site of sites) {
    site.status = "checking";
    site.ping = 0;
    updateSiteDOM(site);
  }
  for (const site of sites) {
    try {
      const result = await invoke<{ status: number; ping_ms: number }>("check_site", { url: site.url });
      site.status = result.status < 400 ? "ok" : "timeout";
      site.ping = result.ping_ms;
    } catch {
      site.status = "timeout";
      site.ping = 0;
    }
    updateSiteDOM(site);
  }
}

function updateSiteDOM(site: SiteCheck): void {
  const el = document.getElementById("site-" + site.name);
  if (!el) return;
  const statusEl = el.querySelector(".site-status");
  if (!statusEl) return;
  statusEl.className = "site-status " + site.status;
  if (site.status === "ok") {
    statusEl.textContent = site.ping + "ms";
  } else if (site.status === "timeout") {
    statusEl.textContent = t("timeout");
  } else {
    statusEl.textContent = "...";
  }
}

async function fetchIpInfo(): Promise<void> {
  try {
    const info = await invoke<{ ip: string; city: string; region: string; country: string; org: string; loc: string }>("get_ip_info");
    ipInfo = { ip: info.ip || "—", location: (info.city || "—") + ", " + (info.country || ""), provider: info.org || "—" };
    if (info.loc) {
      const parts = info.loc.split(",");
      if (parts.length === 2) {
        userLat = parseFloat(parts[0]);
        userLon = parseFloat(parts[1]);
      }
    }
  } catch { ipInfo = { ip: "—", location: "—", provider: "—" }; }
  updateIPDOM();
}

function updateIPDOM(): void {
  const el = document.getElementById("ip-val");
  const loc = document.getElementById("loc-val");
  const prov = document.getElementById("prov-val");
  if (el) el.innerHTML = `${ipInfo.ip} <span class="copy-icon" data-copy="${ipInfo.ip}">${ICONS.copy}</span>`;
  if (loc) loc.textContent = ipInfo.location;
  if (prov) prov.textContent = ipInfo.provider;
}

async function fetchSysInfo(): Promise<void> {
  try {
    const info = await invoke<{ os: string; uptime: string; version: string; admin: boolean }>("get_system_info");
    sysInfo = info;
  } catch {
    sysInfo = { os: "Windows (x64)", uptime: "0h 0m", version: "v0.1.4", admin: false };
  }
  updateSysDOM();
}

function updateSysDOM(): void {
  const os = document.getElementById("sys-os");
  const up = document.getElementById("sys-uptime");
  const ver = document.getElementById("sys-ver");
  const adm = document.getElementById("sys-admin");
  if (os) os.textContent = sysInfo.os;
  if (up) up.textContent = sysInfo.uptime;
  if (ver) ver.textContent = sysInfo.version;
  if (adm) { adm.textContent = sysInfo.admin ? "ON" : "OFF"; adm.className = "info-value " + (sysInfo.admin ? "badge-on" : "badge-off"); }
}

function addLog(line: string): void {
  const ts = new Date().toLocaleTimeString();
  logLines.push("[" + ts + "] " + line);
  if (logLines.length > 500) logLines.shift();
  const box = document.getElementById("log-box");
  if (box) { box.textContent = logLines.join("\n"); box.scrollTop = box.scrollHeight; }
}

function renderShell(): void {
  const app = document.getElementById("app");
  if (!app) return;

  if (!document.getElementById("toast-container")) {
    const tc = document.createElement("div");
    tc.id = "toast-container";
    tc.className = "toast-container";
    document.body.appendChild(tc);
  }

  app.innerHTML = `
    <nav class="sidebar" id="sidebar">
      <div class="sidebar-logo">
        <span class="logo-wordmark">whisp</span>
      </div>
      <div class="lang-switcher" id="lang-sw"></div>
      <div class="nav-items" id="nav-items"></div>
      <div class="nav-settings" id="nav-settings"></div>
    </nav>
    <div class="main-content" id="main-content"></div>
  `;

  renderNav();
  renderPage();
}

function renderNav(): void {
  const navItems = document.getElementById("nav-items")!;
  const navSettings = document.getElementById("nav-settings")!;
  const langSw = document.getElementById("lang-sw")!;

  const routeIcon = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="6" cy="6" r="3"/><circle cx="18" cy="18" r="3"/><path d="M6 9v3a3 3 0 0 0 3 3h6"/></svg>`;
  const items: { id: Page; icon: string; label: string }[] = [
    { id: "home", icon: ICONS.home, label: t("home") },
    { id: "connections", icon: ICONS.wifi, label: t("connections") },
    { id: "profiles", icon: ICONS.user, label: t("profiles") },
    { id: "routing", icon: routeIcon, label: t("routing") },
    { id: "blocklist", icon: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="4.93" y1="4.93" x2="19.07" y2="19.07"/></svg>`, label: t("blocklist") },
    { id: "bridges", icon: ICONS.globe, label: t("bridges") },
    { id: "ml", icon: ICONS.ml, label: t("ml") },
    { id: "logs", icon: ICONS.log, label: t("logs") },
  ];

  navItems.innerHTML = items.map(n =>
    `<div class="nav-item ${currentPage === n.id ? "active" : ""}" data-page="${n.id}">
      <span class="nav-icon">${n.icon}</span>${n.label}
    </div>`
  ).join("");

  navSettings.innerHTML = `<div class="nav-item ${currentPage === "settings" ? "active" : ""}" data-page="settings">
    <span class="nav-icon">${ICONS.settings}</span>${t("settings")}
  </div>`;

  langSw.innerHTML = `
    <button class="lang-btn ${lang === "ru" ? "active" : ""}" data-lang="ru">RU</button>
    <button class="lang-btn ${lang === "en" ? "active" : ""}" data-lang="en">EN</button>
  `;

  document.querySelectorAll<HTMLElement>(".nav-item[data-page]").forEach(el => {
    el.addEventListener("click", () => { currentPage = el.dataset.page as Page; renderNav(); renderPage(); });
  });
  document.querySelectorAll<HTMLElement>(".lang-btn[data-lang]").forEach(el => {
    el.addEventListener("click", () => { lang = el.dataset.lang as Lang; saveLang(); renderNav(); renderPage(); });
  });
}

function renderPage(): void {
  document.body.classList.toggle("theme-light", settings.theme === "auto");
  const main = document.getElementById("main-content")!;
  switch (currentPage) {
    case "home": main.innerHTML = renderHome(); bindHomeEvents(); break;
    case "connections": main.innerHTML = renderConnections(); break;
    case "profiles": main.innerHTML = renderProfiles(); bindProfileEvents(); break;
    case "routing": main.innerHTML = renderRouting(); bindRoutingEvents(); break;
    case "blocklist": main.innerHTML = renderBlocklist(); bindBlocklistEvents(); break;
    case "logs":
      main.innerHTML = renderLogs();
      bindLogEvents();
      document.getElementById("btn-clear-logs")?.addEventListener("click", () => {
        logLines = [];
        logSearch = "";
        logFilter = "all";
        renderPage();
      });
      break;
    case "settings": main.innerHTML = renderSettings(); bindSettingsEvents(); break;
    case "bridges": main.innerHTML = renderBridges(); bindBridgesEvents(); break;
    case "ml": main.innerHTML = renderML(); bindMLEvents(); break;
  }
  document.querySelectorAll<HTMLElement>(".copy-icon[data-copy]").forEach(el => {
    el.addEventListener("click", () => {
      clipboardWrite(el.dataset.copy || "");
      showToast(lang === "ru" ? "Скопировано" : "Copied", "success", 1800);
    });
  });
}

function updateHome(): void {
  if (currentPage !== "home") return;
  renderPage();
}

function showToast(msg: string, type: "success" | "error" | "info" = "info", duration = 3500): void {
  const container = document.getElementById("toast-container");
  if (!container) return;
  const toast = document.createElement("div");
  toast.className = `toast toast-${type}`;
  toast.innerHTML = `<span class="toast-dot"></span><span class="toast-msg">${esc(msg)}</span>`;
  container.appendChild(toast);
  requestAnimationFrame(() => requestAnimationFrame(() => toast.classList.add("toast-visible")));
  setTimeout(() => {
    toast.classList.remove("toast-visible");
    toast.classList.add("toast-hiding");
    setTimeout(() => toast.remove(), 280);
  }, duration);
}

function tickUptime(): void {
  const el = document.getElementById("status-uptime");
  if (el) el.textContent = isConnected && connectTime ? formatDuration(Date.now() - connectTime) : "";
  const el2 = document.getElementById("conn-uptime");
  if (el2) el2.textContent = isConnected && connectTime ? formatDuration(Date.now() - connectTime) : "—";
}

function renderHome(): string {
  const profileName = profiles.find(p => p.key === settings.conn_key)?.name;
  const serverHost = getServerHost();
  const uptimeStr = isConnected && connectTime ? formatDuration(Date.now() - connectTime) : "";

  let connectionCard: string;
  if (isConnected) {
    connectionCard = `
      <div class="card card-connection">
        <div class="card-header">
          <span class="card-title">${t("connection")}</span>
          <span class="card-title-right">${profileName || t("noProfile")}</span>
        </div>
        <div class="status-line">
          <span class="status-dot on"></span>
          <span class="status-text">${t("connected")}</span>
          <span class="status-uptime" id="status-uptime">${uptimeStr}</span>
        </div>
        ${serverHost ? `<div class="info-row conn-server-row"><span class="info-label">${t("server")}</span><span class="info-value">${esc(serverHost)}</span></div>` : ""}
        ${_appliedMlTransport ? `<div class="info-row"><span class="info-label">ML транспорт</span><span class="info-value"><span class="badge-on">${esc(_appliedMlTransport)}</span></span></div>` : ""}
        <div class="ks-row">
          <span class="ks-label">${t("killSwitch")}</span>
          <span class="${settings.kill_switch ? "badge-on" : "badge-off"}">${settings.kill_switch ? "ON" : "OFF"}</span>
        </div>
        <button class="btn-connect connected" id="btn-connect">${ICONS.x} ${t("disconnect")}</button>
      </div>`;
  } else {
    const dis = isConnecting;
    connectionCard = `
      <div class="card card-connection">
        <div class="card-header">
          <span class="card-title">${t("connection")}</span>
          <span class="card-title-right">${profileName || t("noProfile")}</span>
        </div>
        <div class="status-line">
          <span class="status-dot ${dis ? "connecting" : "off"}"></span>
          <span class="status-text">${dis ? t("connecting") : t("disconnected")}</span>
        </div>
        <div class="key-area">
          <textarea class="key-input" id="conn-key" rows="2" placeholder="${t("keyPlaceholder")}"${dis ? " disabled" : ""}>${esc(settings.conn_key)}</textarea>
          <div class="key-footer">
            <span class="key-hint">Ctrl+Enter</span>
            <button class="paste-btn" id="btn-paste"${dis ? " disabled" : ""}>${t("paste")}</button>
          </div>
        </div>
        <div class="ks-row">
          <span class="ks-label">${t("killSwitch")}</span>
          <label class="toggle"><input type="checkbox" id="ks-home" ${settings.kill_switch ? "checked" : ""}${dis ? " disabled" : ""}/><span class="toggle-slider"></span></label>
        </div>
        <button class="btn-connect${dis ? " connecting" : ""}" id="btn-connect"${dis ? " disabled" : ""}>${ICONS.bolt} ${dis ? t("connecting") : t("connect")}</button>
      </div>`;
  }

  return `<div class="home-grid">
    ${connectionCard}

    <div class="card card-sites">
      <div class="card-header">
        <span class="card-title">${t("siteCheck")}</span>
        <button class="refresh-btn" id="btn-refresh-sites">${ICONS.refresh}</button>
      </div>
      <div class="sites-grid">
        ${sites.map(s => `<div class="site-item" id="site-${s.name}">
          <div class="site-icon ${s.cssClass}">${s.letter}</div>
          <span class="site-name">${s.name}</span>
          <span class="site-status ${s.status}">${s.status === "ok" ? s.ping + "ms" : s.status === "timeout" ? t("timeout") : "..."}</span>
        </div>`).join("")}
      </div>
    </div>

    <div class="card card-ip">
      <div class="card-header"><span class="card-title">${t("ipInfo")}</span><button class="refresh-btn" id="btn-refresh-ip">${ICONS.refresh}</button></div>
      <div class="info-row"><span class="info-label">${t("ipAddress")}</span><span class="info-value" id="ip-val">${ipInfo.ip} <span class="copy-icon" data-copy="${ipInfo.ip}">${ICONS.copy}</span></span></div>
      <div class="info-row"><span class="info-label">${t("location")}</span><span class="info-value" id="loc-val">${ipInfo.location}</span></div>
      <div class="info-row"><span class="info-label">${t("provider")}</span><span class="info-value" id="prov-val">${ipInfo.provider}</span></div>
    </div>

    <div class="card card-system">
      <div class="card-header"><span class="card-title">${t("system")}</span></div>
      <div class="info-row"><span class="info-label">${t("os")}</span><span class="info-value" id="sys-os">${sysInfo.os}</span></div>
      <div class="info-row"><span class="info-label">${t("uptime")}</span><span class="info-value" id="sys-uptime">${sysInfo.uptime}</span></div>
      <div class="info-row"><span class="info-label">${t("version")}</span><span class="info-value" id="sys-ver">${sysInfo.version}</span></div>
      <div class="info-row"><span class="info-label">${t("admin")}</span><span class="info-value ${sysInfo.admin ? "badge-on" : "badge-off"}" id="sys-admin">${sysInfo.admin ? "ON" : "OFF"}</span></div>
    </div>
  </div>`;
}

function bindHomeEvents(): void {
  document.getElementById("btn-connect")?.addEventListener("click", async () => {
    if (isConnecting) return;
    if (!isConnected) {
      const k = document.getElementById("conn-key") as HTMLTextAreaElement | null;
      if (k) { settings.conn_key = k.value.trim(); await persistSettings(); }
    }
    isConnected ? await doDisconnect() : await doConnect();
  });

  document.getElementById("btn-paste")?.addEventListener("click", async () => {
    try {
      const text = await clipboardRead();
      const ta = document.getElementById("conn-key") as HTMLTextAreaElement | null;
      if (ta && text && text.trim()) {
        ta.value = text.trim();
        ta.focus();
        showToast(lang === "ru" ? "Ключ вставлен" : "Key pasted", "success", 2000);
      } else {
        showToast(lang === "ru" ? "Буфер пуст" : "Clipboard is empty", "info", 2000);
      }
    } catch {
      showToast(lang === "ru" ? "Ошибка чтения буфера" : "Clipboard read failed", "error", 2500);
    }
  });

  document.getElementById("conn-key")?.addEventListener("keydown", async (ev) => {
    const e = ev as KeyboardEvent;
    if (e.key === "Enter" && e.ctrlKey) {
      e.preventDefault();
      if (isConnecting || isConnected) return;
      const ta = ev.target as HTMLTextAreaElement;
      settings.conn_key = ta.value.trim();
      await persistSettings();
      await doConnect();
    }
  });

  document.getElementById("ks-home")?.addEventListener("change", function () {
    settings.kill_switch = (this as HTMLInputElement).checked;
    persistSettings();
  });

  document.getElementById("btn-refresh-sites")?.addEventListener("click", () => checkSites());
  document.getElementById("btn-refresh-ip")?.addEventListener("click", () => fetchIpInfo());
}

function renderConnections(): string {
  const server = getServerHost() || (settings.conn_key ? (lang === "ru" ? "зашифрован" : "encrypted") : t("notSet"));
  const uptimeStr = isConnected && connectTime ? formatDuration(Date.now() - connectTime) : "—";
  const stChipCls = isConnected ? "chip-active" : "chip-idle";
  const stChipTxt = isConnected ? t("active") : t("inactive");

  return `
    <div class="page-header">
      <h2 class="page-title">${t("connections")}</h2>
      <span class="conn-chip ${stChipCls}">${stChipTxt}</span>
    </div>

    <div class="card" style="margin-bottom:9px">
      <div class="card-header"><span class="card-title">${t("tunnel")}</span></div>
      <div class="info-row">
        <span class="info-label">${t("server")}</span>
        <span class="info-value">${esc(server)}</span>
      </div>
      <div class="info-row">
        <span class="info-label">${t("duration")}</span>
        <span class="info-value" id="conn-uptime">${uptimeStr}</span>
      </div>
      <div class="info-row">
        <span class="info-label">Kill Switch</span>
        <span class="info-value"><span class="${settings.kill_switch ? "badge-on" : "badge-off"}">${settings.kill_switch ? "ON" : "OFF"}</span></span>
      </div>
      <div class="info-row">
        <span class="info-label">DNS Redirect</span>
        <span class="info-value"><span class="${settings.dns_redirect ? "badge-on" : "badge-off"}">${settings.dns_redirect ? "ON" : "OFF"}</span></span>
      </div>
    </div>

    <div class="card">
      <div class="card-header"><span class="card-title">${t("proxy")}</span></div>
      <div class="info-row">
        <span class="info-label">SOCKS5</span>
        <span class="info-value">${esc(settings.socks_addr)}:10800</span>
      </div>
      <div class="info-row">
        <span class="info-label">${lang === "ru" ? "Mihomo" : "Mihomo"}</span>
        <span class="info-value">:${settings.mihomo_port}</span>
      </div>
      <div class="info-row">
        <span class="info-label">TUN Stack</span>
        <span class="info-value">${esc(settings.tun_stack)}</span>
      </div>
      <div class="info-row">
        <span class="info-label">IPv6</span>
        <span class="info-value"><span class="${settings.ipv6 ? "badge-on" : "badge-off"}">${settings.ipv6 ? "ON" : "OFF"}</span></span>
      </div>
    </div>`;
}

function renderProfiles(): string {
  const profileList = profiles.length === 0
    ? `<div class="empty-state"><div class="empty-icon">${ICONS.user}</div><p>${t("noProfiles")}</p></div>`
    : profiles.map(p => `
        <div class="profile-card">
          <div class="profile-info"><span>${ICONS.user}</span><span>${esc(p.name)}</span></div>
          <div class="profile-actions">
            <button class="btn-use-profile" data-id="${p.id}" title="${t("subSelectKey")}">${ICONS.play}</button>
            <button class="btn-del-profile" data-id="${p.id}" title="${t("subDelete")}">${ICONS.x}</button>
          </div>
        </div>`).join("");

  const subList = subscriptions.length === 0
    ? `<div class="empty-state"><p>${t("noSubscriptions")}</p></div>`
    : subscriptions.map(s => {
        const keyRows = s.keys.map((k, i) => {
          const pr = pingResults.get(`${s.id}:${i}`);
          const pingLabel = pr === "pinging" ? `<span class="ping-val pinging">${t("pingRunning")}</span>`
            : pr === "timeout" ? `<span class="ping-val timeout">${t("pingTimeout")}</span>`
            : pr !== undefined ? `<span class="ping-val ok">${pr}${t("pingMs")}</span>`
            : "";
          return `
          <div class="sub-key-row">
            <span class="sub-key-val" title="${esc(k)}">${esc(k.length > 50 ? k.slice(0, 50) + "…" : k)}</span>
            ${pingLabel}
            <button class="btn-ping-key" data-sub="${s.id}" data-idx="${i}" data-key="${esc(k)}" title="${t("pingKey")}">${ICONS.ping}</button>
            <button class="btn-use-sub-key" data-sub="${s.id}" data-idx="${i}">${ICONS.play}</button>
          </div>`;
        }).join("");
        const updLabel = s.updated ? `<span class="sub-meta">${t("subLastUpdated")}: ${s.updated.slice(0, 10)}</span>` : "";
        return `
          <div class="profile-card sub-card">
            <div class="profile-info">
              <span>${ICONS.link}</span>
              <span>${esc(s.name || s.url)}</span>
              <span class="sub-meta">${s.keys.length} ${t("subKeys")}</span>
              ${updLabel}
            </div>
            <div class="profile-actions">
              <button class="btn-ping-all-sub" data-id="${s.id}" title="${t("pingAll")}">${ICONS.ping}</button>
              <button class="btn-rename-sub" data-id="${s.id}" title="${t("subRename")}">${ICONS.pencil}</button>
              <button class="btn-refresh-sub" data-id="${s.id}" title="${t("subRefresh")}">${subUpdateAvailable.has(s.id) ? '<span class="sub-update-dot"></span>' : ""}${ICONS.refresh}</button>
              <button class="btn-del-sub" data-id="${s.id}" title="${t("subDelete")}">${ICONS.x}</button>
            </div>
            ${s.keys.length > 0 ? `<div class="sub-keys">${keyRows}</div>` : ""}
          </div>`;
      }).join("");

  return `
    <div class="page-header">
      <h2 class="page-title">${t("profiles")}</h2>
      <button class="btn-add-profile" id="btn-add-profile">${t("addProfile")}</button>
    </div>
    ${profileList}
    <div class="section-header">
      <span class="section-title">${t("subscriptions")}</span>
      <button class="btn-add-profile" id="btn-add-sub">${t("addSubscription")}</button>
    </div>
    ${subList}`;
}

function bindProfileEvents(): void {
  document.getElementById("btn-add-profile")?.addEventListener("click", () => showProfileModal());

  document.querySelectorAll<HTMLElement>(".btn-use-profile").forEach(el => {
    el.addEventListener("click", () => {
      const p = profiles.find(x => x.id === el.dataset.id);
      if (p) { settings.conn_key = p.key; persistSettings(); currentPage = "home"; renderNav(); renderPage(); }
    });
  });
  document.querySelectorAll<HTMLElement>(".btn-del-profile").forEach(el => {
    el.addEventListener("click", () => { profiles = profiles.filter(x => x.id !== el.dataset.id); saveProfiles(); renderPage(); });
  });

  document.getElementById("btn-add-sub")?.addEventListener("click", () => showSubModal());

  document.querySelectorAll<HTMLElement>(".btn-ping-key").forEach(el => {
    el.addEventListener("click", async () => {
      const subId = el.dataset.sub!;
      const idx = parseInt(el.dataset.idx ?? "0", 10);
      const key = el.dataset.key!;
      const mapKey = `${subId}:${idx}`;
      pingResults.set(mapKey, "pinging");
      renderPage();
      try {
        const ms = await invoke<number>("ping_key", { key });
        pingResults.set(mapKey, ms);
      } catch {
        pingResults.set(mapKey, "timeout");
      }
      renderPage();
    });
  });

  document.querySelectorAll<HTMLElement>(".btn-ping-all-sub").forEach(el => {
    el.addEventListener("click", async () => {
      const subId = el.dataset.id!;
      const sub = subscriptions.find(s => s.id === subId);
      if (!sub) return;
      sub.keys.forEach((_, i) => pingResults.set(`${subId}:${i}`, "pinging"));
      renderPage();
      await Promise.all(sub.keys.map(async (k, i) => {
        try {
          const ms = await invoke<number>("ping_key", { key: k });
          pingResults.set(`${subId}:${i}`, ms);
        } catch {
          pingResults.set(`${subId}:${i}`, "timeout");
        }
      }));
      renderPage();
    });
  });

  document.querySelectorAll<HTMLElement>(".btn-rename-sub").forEach(el => {
    el.addEventListener("click", () => {
      const subId = el.dataset.id!;
      const sub = subscriptions.find(s => s.id === subId);
      if (!sub) return;
      const newName = prompt(t("subName"), sub.name || sub.url);
      if (newName === null) return;
      invoke("rename_subscription", { id: subId, name: newName.trim() }).then(() => {
        sub.name = newName.trim();
        renderPage();
      }).catch(() => { });
    });
  });

  document.querySelectorAll<HTMLElement>(".btn-refresh-sub").forEach(el => {
    el.addEventListener("click", async () => {
      const id = el.dataset.id!;
      (el as HTMLButtonElement).disabled = true;
      el.classList.add("spinning");
      try {
        const updated = await invoke<Subscription>("refresh_subscription", { id });
        subscriptions = subscriptions.map(s => s.id === id ? updated : s);
        subUpdateAvailable.delete(id);
        showToast(lang === "ru" ? "Подписка обновлена" : "Subscription updated", "success");
      } catch { showToast(lang === "ru" ? "Ошибка обновления" : "Update failed", "error"); }
      renderPage();
    });
  });
  document.querySelectorAll<HTMLElement>(".btn-del-sub").forEach(el => {
    el.addEventListener("click", async () => {
      const id = el.dataset.id!;
      await invoke("delete_subscription", { id }).catch(() => {/**/});
      subscriptions = subscriptions.filter(s => s.id !== id);
      renderPage();
    });
  });
  document.querySelectorAll<HTMLElement>(".btn-use-sub-key").forEach(el => {
    el.addEventListener("click", () => {
      const sub = subscriptions.find(s => s.id === el.dataset.sub);
      const idx = parseInt(el.dataset.idx ?? "0", 10);
      if (sub && sub.keys[idx]) {
        settings.conn_key = sub.keys[idx];
        persistSettings();
        currentPage = "home";
        renderNav();
        renderPage();
      }
    });
  });
}

function showSubModal(): void {
  const ov = document.createElement("div");
  ov.className = "modal-overlay";
  ov.innerHTML = `
    <div class="modal">
      <h3>${t("addSubscription")}</h3>
      <label>${t("subName")}</label>
      <input class="modal-input" id="sub-modal-name" placeholder="${t("subName")}" />
      <label>${t("subUrl")}</label>
      <input class="modal-input" id="sub-modal-url" placeholder="${t("subUrlHint")}" />
      <div class="modal-err" id="sub-modal-err" style="color:var(--danger,#e55);display:none"></div>
      <div class="modal-actions">
        <button class="btn-secondary" id="sub-modal-cancel">${t("cancel")}</button>
        <button class="btn-primary" id="sub-modal-save">${t("save")}</button>
      </div>
    </div>`;
  document.body.appendChild(ov);
  document.getElementById("sub-modal-cancel")?.addEventListener("click", () => ov.remove());
  document.getElementById("sub-modal-save")?.addEventListener("click", async () => {
    const name = (document.getElementById("sub-modal-name") as HTMLInputElement).value.trim();
    const url = (document.getElementById("sub-modal-url") as HTMLInputElement).value.trim();
    const errEl = document.getElementById("sub-modal-err")!;
    if (!url) { errEl.textContent = t("subUrlHint"); errEl.style.display = ""; return; }
    const btn = document.getElementById("sub-modal-save") as HTMLButtonElement;
    btn.disabled = true; btn.textContent = t("subRefreshing");
    try {
      const entry = await invoke<Subscription>("add_subscription", { name, url });
      subscriptions.push(entry);
      ov.remove();
      if (currentPage === "profiles") renderPage();
    } catch (e) {
      errEl.textContent = String(e);
      errEl.style.display = "";
      btn.disabled = false; btn.textContent = t("save");
    }
  });
}

const DISCORD_RULE_ID = "discord-builtin";
const DISCORD_UPDATE_RULE_ID = "discord-update-builtin";


function getDiscordRule(): RoutingRule | undefined {
  return routingRules.find(r =>
    r.id === DISCORD_RULE_ID ||
    (r.kind === "process" && r.value.toLowerCase() === "discord.exe")
  );
}

async function setDiscordMode(action: "PROXY" | "DIRECT"): Promise<void> {
  const main = getDiscordRule();
  if (main) {
    main.action = action;
  } else {
    routingRules.push({ id: DISCORD_RULE_ID, kind: "process", value: "Discord.exe", action });
  }
  const upd = routingRules.find(r => r.id === DISCORD_UPDATE_RULE_ID ||
    (r.kind === "process" && r.value.toLowerCase() === "update.exe"));
  if (upd) {
    upd.action = action;
  } else {
    routingRules.push({ id: DISCORD_UPDATE_RULE_ID, kind: "process", value: "Update.exe", action });
  }
  await persistRoutingRules();
}

function renderRouting(): string {
  const actionBadge = (a: string) => a === "DIRECT"
    ? `<span class="badge-off">${t("routeDirect")}</span>`
    : `<span class="badge-on">${t("routeProxy")}</span>`;

  const discordRule = getDiscordRule();
  const discordAction = discordRule?.action ?? "PROXY";

  const discordIds = new Set([DISCORD_RULE_ID, DISCORD_UPDATE_RULE_ID]);
  const discordProcs = new Set(["discord.exe", "update.exe"]);
  const userRules = routingRules.filter(r =>
    !discordIds.has(r.id) &&
    !(r.kind === "process" && discordProcs.has(r.value.toLowerCase()))
  );

  const rows = userRules.length === 0
    ? `<div class="empty-state"><p>${t("noRules")}</p></div>`
    : userRules.map(r => `
        <div class="rule-row" data-id="${r.id}">
          <span class="rule-kind">${r.kind === "domain" ? t("domain") : t("app")}</span>
          <span class="rule-value" title="${esc(r.value)}">${esc(r.kind === "process" ? r.value.split(/[\\/]/).pop() || r.value : r.value)}</span>
          ${actionBadge(r.action)}
          <button class="btn-del-rule" data-id="${r.id}">${ICONS.x}</button>
        </div>`).join("");

  const discordIcon = `<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057c.002.025.016.048.036.063a19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028c.462-.63.874-1.295 1.226-1.994a.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03z"/></svg>`;

  return `
    <div class="page-header">
      <h2 class="page-title">${t("routingTitle")}</h2>
    </div>
    <p class="page-desc">${t("routingDesc")}</p>

    <div class="card" style="margin-bottom:12px">
      <div class="card-header">
        <span class="card-title" style="display:flex;align-items:center;gap:6px;color:#5865F2">${discordIcon} Discord</span>
      </div>
      <div class="rule-add-row" style="justify-content:space-between;align-items:center">
        <span class="setting-label" style="font-size:12px;opacity:0.6">${t("discordDesc")}</span>
        <div class="pill-group" id="discord-mode-pills">
          <button class="pill-btn${discordAction === "PROXY" ? " active" : ""}" data-act="PROXY">${t("discordVpn")}</button>
          <button class="pill-btn${discordAction === "DIRECT" ? " active" : ""}" data-act="DIRECT">${t("discordDirect")}</button>
        </div>
      </div>
    </div>

    <div class="card" style="margin-bottom:12px">
      <div class="card-header"><span class="card-title">${t("addSite")}</span></div>
      <div class="rule-add-row">
        <input type="text" id="rule-domain-input" placeholder="${t("domainHint")}" class="rule-input"/>
        <div class="pill-group" id="rule-domain-action">
          <button class="pill-btn active" data-act="DIRECT">${t("routeDirect")}</button>
          <button class="pill-btn" data-act="PROXY">${t("routeProxy")}</button>
        </div>
        <button class="btn-sm" id="btn-add-domain">+</button>
      </div>
    </div>

    <div class="card" style="margin-bottom:12px">
      <div class="card-header"><span class="card-title">${t("addApp")}</span></div>
      <div class="rule-add-row">
        <label class="btn-sm" id="btn-browse-exe" style="cursor:pointer">
          ${lang === "ru" ? "Выбрать .exe" : "Browse .exe"}
          <input type="file" id="rule-exe-input" accept=".exe" style="display:none"/>
        </label>
        <span class="rule-exe-display" id="rule-exe-display">—</span>
        <div class="pill-group" id="rule-process-action">
          <button class="pill-btn active" data-act="DIRECT">${t("routeDirect")}</button>
          <button class="pill-btn" data-act="PROXY">${t("routeProxy")}</button>
        </div>
        <button class="btn-sm" id="btn-add-process">+</button>
      </div>
    </div>

    <div class="card">
      <div class="card-header"><span class="card-title">${lang === "ru" ? "Правила" : "Rules"}</span></div>
      <div id="rules-list">${rows}</div>
    </div>`;
}

let _selectedExe = "";

function bindRoutingEvents(): void {
  document.querySelectorAll<HTMLElement>("#discord-mode-pills .pill-btn").forEach(el => {
    el.addEventListener("click", async () => {
      const action = el.dataset.act as "PROXY" | "DIRECT";
      document.querySelectorAll("#discord-mode-pills .pill-btn").forEach(b => b.classList.remove("active"));
      el.classList.add("active");
      await setDiscordMode(action);
    });
  });

  document.querySelectorAll<HTMLElement>("#rule-domain-action .pill-btn").forEach(el => {
    el.addEventListener("click", () => {
      document.querySelectorAll("#rule-domain-action .pill-btn").forEach(b => b.classList.remove("active"));
      el.classList.add("active");
    });
  });

  document.querySelectorAll<HTMLElement>("#rule-process-action .pill-btn").forEach(el => {
    el.addEventListener("click", () => {
      document.querySelectorAll("#rule-process-action .pill-btn").forEach(b => b.classList.remove("active"));
      el.classList.add("active");
    });
  });

  document.getElementById("btn-add-domain")?.addEventListener("click", async () => {
    const input = document.getElementById("rule-domain-input") as HTMLInputElement;
    const domain = input.value.trim().replace(/^https?:\/\//, "");
    if (!domain) return;
    const action = (document.querySelector("#rule-domain-action .pill-btn.active") as HTMLElement)?.dataset.act || "DIRECT";
    routingRules.push({ id: Date.now().toString(), kind: "domain", value: domain, action: action as "DIRECT" | "PROXY" });
    await persistRoutingRules();
    input.value = "";
    renderPage();
  });

  document.getElementById("rule-exe-input")?.addEventListener("change", (e) => {
    const file = (e.target as HTMLInputElement).files?.[0];
    if (file) {
      _selectedExe = file.name;
      const display = document.getElementById("rule-exe-display");
      if (display) display.textContent = file.name;
    }
  });

  document.getElementById("btn-add-process")?.addEventListener("click", async () => {
    if (!_selectedExe) return;
    const action = (document.querySelector("#rule-process-action .pill-btn.active") as HTMLElement)?.dataset.act || "DIRECT";
    routingRules.push({ id: Date.now().toString(), kind: "process", value: _selectedExe, action: action as "DIRECT" | "PROXY" });
    await persistRoutingRules();
    _selectedExe = "";
    renderPage();
  });

  document.querySelectorAll<HTMLElement>(".btn-del-rule").forEach(el => {
    el.addEventListener("click", async () => {
      routingRules = routingRules.filter(r => r.id !== el.dataset.id);
      await persistRoutingRules();
      renderPage();
    });
  });
}

let _blockSelectedExe = "";

function renderBlocklist(): string {
  const rows = blocklistRules.length === 0
    ? `<div class="empty-state"><p>${t("noBlocked")}</p></div>`
    : blocklistRules.map(r => {
        const kindLabel = r.kind === "domain" ? t("domain")
          : r.kind === "domain-keyword" ? t("blockKeyword")
          : r.kind === "ip" ? "IP"
          : t("app");
        const displayVal = r.kind === "process" ? (r.value.split(/[\\/]/).pop() || r.value) : r.value;
        return `<div class="rule-row" data-id="${r.id}">
          <span class="rule-kind">${kindLabel}</span>
          <span class="rule-value" title="${esc(r.value)}">${esc(displayVal)}</span>
          <span class="badge-off" style="background:var(--danger,#e74c3c);color:#fff">${t("blocked")}</span>
          <button class="btn-del-rule btn-del-block" data-id="${r.id}">${ICONS.x}</button>
        </div>`;
      }).join("");

  return `
    <div class="page-header">
      <h2 class="page-title">${t("blocklistTitle")}</h2>
    </div>
    <p class="page-desc">${t("blocklistDesc")}</p>

    <div class="card" style="margin-bottom:12px">
      <div class="card-header"><span class="card-title">${t("blockDomain")}</span></div>
      <div class="rule-add-row">
        <input type="text" id="block-domain-input" placeholder="${t("domainBlockHint")}" class="rule-input"/>
        <button class="btn-sm" id="btn-block-domain">+</button>
      </div>
    </div>

    <div class="card" style="margin-bottom:12px">
      <div class="card-header"><span class="card-title">${t("blockKeyword")}</span></div>
      <div class="rule-add-row">
        <input type="text" id="block-keyword-input" placeholder="${t("keywordHint")}" class="rule-input"/>
        <button class="btn-sm" id="btn-block-keyword">+</button>
      </div>
    </div>

    <div class="card" style="margin-bottom:12px">
      <div class="card-header"><span class="card-title">${t("blockApp")}</span></div>
      <div class="rule-add-row">
        <label class="btn-sm" id="btn-block-browse-exe" style="cursor:pointer">
          ${lang === "ru" ? "Выбрать .exe" : "Browse .exe"}
          <input type="file" id="block-exe-input" accept=".exe" style="display:none"/>
        </label>
        <span class="rule-exe-display" id="block-exe-display">—</span>
        <button class="btn-sm" id="btn-block-process">+</button>
      </div>
    </div>

    <div class="card" style="margin-bottom:12px">
      <div class="card-header"><span class="card-title">${t("blockIp")}</span></div>
      <div class="rule-add-row">
        <input type="text" id="block-ip-input" placeholder="${t("ipHint")}" class="rule-input"/>
        <button class="btn-sm" id="btn-block-ip">+</button>
      </div>
    </div>

    <div class="card">
      <div class="card-header"><span class="card-title">${t("blocklist")}</span></div>
      <div id="block-rules-list">${rows}</div>
    </div>`;
}

function bindBlocklistEvents(): void {
  document.getElementById("btn-block-domain")?.addEventListener("click", async () => {
    const input = document.getElementById("block-domain-input") as HTMLInputElement;
    const domain = input.value.trim().replace(/^https?:\/\//, "").replace(/\/.*$/, "");
    if (!domain) return;
    blocklistRules.push({ id: Date.now().toString(), kind: "domain", value: domain, action: "REJECT" });
    await persistBlocklist();
    input.value = "";
    renderPage();
  });

  document.getElementById("btn-block-keyword")?.addEventListener("click", async () => {
    const input = document.getElementById("block-keyword-input") as HTMLInputElement;
    const keyword = input.value.trim();
    if (!keyword) return;
    blocklistRules.push({ id: Date.now().toString(), kind: "domain-keyword", value: keyword, action: "REJECT" });
    await persistBlocklist();
    input.value = "";
    renderPage();
  });

  document.getElementById("block-exe-input")?.addEventListener("change", (e) => {
    const file = (e.target as HTMLInputElement).files?.[0];
    if (file) {
      _blockSelectedExe = file.name;
      const display = document.getElementById("block-exe-display");
      if (display) display.textContent = file.name;
    }
  });

  document.getElementById("btn-block-process")?.addEventListener("click", async () => {
    if (!_blockSelectedExe) return;
    blocklistRules.push({ id: Date.now().toString(), kind: "process", value: _blockSelectedExe, action: "REJECT" });
    await persistBlocklist();
    _blockSelectedExe = "";
    renderPage();
  });

  document.getElementById("btn-block-ip")?.addEventListener("click", async () => {
    const input = document.getElementById("block-ip-input") as HTMLInputElement;
    const ip = input.value.trim();
    if (!ip) return;
    blocklistRules.push({ id: Date.now().toString(), kind: "ip", value: ip, action: "REJECT" });
    await persistBlocklist();
    input.value = "";
    renderPage();
  });

  document.querySelectorAll<HTMLElement>(".btn-del-block").forEach(el => {
    el.addEventListener("click", async () => {
      blocklistRules = blocklistRules.filter(r => r.id !== el.dataset.id);
      await persistBlocklist();
      renderPage();
    });
  });
}

let logFilter = "all";
let logSearch = "";

function renderLogs(): string {
  const filtered = logLines.filter(line => {
    if (logFilter !== "all") {
      const level = logFilter.toUpperCase();
      if (!line.toUpperCase().includes(`[${level}]`) && !line.toUpperCase().includes(`"level":"${level}"`)) return false;
    }
    if (logSearch && !line.toLowerCase().includes(logSearch.toLowerCase())) return false;
    return true;
  });
  const colorized = filtered.map(line => {
    let cls = "log-line";
    const upper = line.toUpperCase();
    if (upper.includes("[ERROR]") || upper.includes('"level":"error"')) cls += " log-error";
    else if (upper.includes("[WARN]") || upper.includes('"level":"warn"')) cls += " log-warn";
    else if (upper.includes("[INFO]") || upper.includes('"level":"info"')) cls += " log-info";
    else if (upper.includes("[DEBUG]") || upper.includes('"level":"debug"')) cls += " log-debug";
    return `<div class="${cls}">${esc(line)}</div>`;
  }).join("");
  const txt = colorized || `<div class="log-line log-info">${t("logReady")}</div>`;
  return `
    <div class="page-header">
      <h2 class="page-title">${t("systemLog")}</h2>
      <div style="display:flex;align-items:center;gap:8px">
        <span class="log-status">${isConnected ? t("connected") : t("disconnected")}</span>
        <button class="btn-sm" id="btn-clear-logs">${t("clearLogs")}</button>
      </div>
    </div>
    <div class="log-toolbar">
      <input type="text" class="log-search" id="log-search" placeholder="${lang === "ru" ? "Поиск в логах..." : "Search logs..."}" value="${esc(logSearch)}"/>
      <div class="pill-group">
        <button class="pill-btn log-filter-btn ${logFilter === "all" ? "active" : ""}" data-filter="all">${lang === "ru" ? "Все" : "All"}</button>
        <button class="pill-btn log-filter-btn ${logFilter === "error" ? "active" : ""}" data-filter="error">Error</button>
        <button class="pill-btn log-filter-btn ${logFilter === "warn" ? "active" : ""}" data-filter="warn">Warn</button>
        <button class="pill-btn log-filter-btn ${logFilter === "info" ? "active" : ""}" data-filter="info">Info</button>
        <button class="pill-btn log-filter-btn ${logFilter === "debug" ? "active" : ""}" data-filter="debug">Debug</button>
      </div>
      <span class="log-count">${filtered.length}/${logLines.length}</span>
    </div>
    <div class="log-box" id="log-box">${txt}</div>`;
}

function bindLogEvents(): void {
  document.getElementById("log-search")?.addEventListener("input", function () {
    logSearch = (this as HTMLInputElement).value;
    const box = document.getElementById("log-box");
    if (box) { const tmp = document.createElement("div"); tmp.innerHTML = renderLogs(); const newBox = tmp.querySelector("#log-box"); if (newBox) box.innerHTML = newBox.innerHTML; }
    const cnt = document.querySelector(".log-count");
    if (cnt) { const f = logLines.filter(l => { if (logFilter !== "all" && !l.toUpperCase().includes(`[${logFilter.toUpperCase()}]`)) return false; if (logSearch && !l.toLowerCase().includes(logSearch.toLowerCase())) return false; return true; }); cnt.textContent = `${f.length}/${logLines.length}`; }
  });
  document.querySelectorAll<HTMLElement>(".log-filter-btn").forEach(btn => btn.addEventListener("click", () => {
    logFilter = btn.dataset.filter || "all";
    renderPage();
  }));
}

function getFPDescription(fp: string): string {
  const descs: Record<string, [string, string]> = {
    chrome: ["Chrome — самый распространённый, рекомендуется", "Chrome — most common, recommended"],
    chrome_120: ["Chrome 120 — конкретная версия", "Chrome 120 — specific version"],
    chrome_115: ["Chrome 115 — конкретная версия", "Chrome 115 — specific version"],
    firefox: ["Firefox — второй по популярности", "Firefox — second most popular"],
    firefox_120: ["Firefox 120 — конкретная версия", "Firefox 120 — specific version"],
    safari: ["Safari — macOS/iOS браузер Apple", "Safari — Apple macOS/iOS browser"],
    ios: ["iOS Safari — мобильный фингерпринт", "iOS Safari — mobile fingerprint"],
    android: ["Android OkHttp — мобильный клиент", "Android OkHttp — mobile client"],
    edge: ["Microsoft Edge — на базе Chromium", "Microsoft Edge — Chromium-based"],
    random: ["Случайный фингерпринт каждое подключение", "Random fingerprint per connection"],
  };
  const d = descs[fp];
  return d ? d[lang === "ru" ? 0 : 1] : "";
}

function renderSettings(): string {
  return `<div class="page-header"><h2 class="page-title">${t("settings")}</h2></div>
    <div class="settings-section">
      <div class="settings-section-title">${t("mihomo")}</div>
      <div class="setting-row"><span class="setting-label">${t("mixedPort")}</span><div class="setting-value"><input type="number" id="set-port" value="${settings.mihomo_port}"/><span class="edit-icon">✎</span></div></div>
      <div class="setting-row"><span class="setting-label">${t("bindAddr")}</span><div class="setting-value"><input type="text" id="set-bind" value="${settings.socks_addr}"/><span class="edit-icon">✎</span></div></div>
      <div class="setting-row"><span class="setting-label">${t("tunStack")}</span><div class="setting-value"><div class="pill-group">
        <button class="pill-btn ${settings.tun_stack === "Mixed" ? "active" : ""}" data-tun="Mixed">Mixed</button>
        <button class="pill-btn ${settings.tun_stack === "gVisor" ? "active" : ""}" data-tun="gVisor">gVisor</button>
        <button class="pill-btn ${settings.tun_stack === "System" ? "active" : ""}" data-tun="System">System</button>
      </div></div></div>
      <div class="setting-row"><span class="setting-label">${t("theme")}</span><div class="setting-value"><div class="pill-group">
        <button class="pill-btn ${settings.theme === "dark" ? "active" : ""}" data-theme="dark">${t("dark")}</button>
        <button class="pill-btn ${settings.theme === "auto" ? "active" : ""}" data-theme="auto">${t("auto")}</button>
      </div></div></div>
      <div class="setting-row"><span class="setting-label">${t("dnsRedirect")}</span><div class="setting-value"><label class="toggle"><input type="checkbox" id="set-dns" ${settings.dns_redirect ? "checked" : ""}/><span class="toggle-slider"></span></label></div></div>
      <div class="setting-row"><span class="setting-label">${t("ipv6Label")}</span><div class="setting-value"><label class="toggle"><input type="checkbox" id="set-ipv6" ${settings.ipv6 ? "checked" : ""}/><span class="toggle-slider"></span></label></div></div>
      <div class="setting-row"><span class="setting-label">${t("secretLabel")}</span><div class="setting-value"><span class="secret-value">${settings.secret}</span><button class="btn-sm" id="btn-copy-secret">${t("copy")}</button></div></div>
    </div>
    <div class="settings-section">
      <div class="settings-section-header"><span class="settings-section-title">${t("whisp")}</span><span class="settings-link">${t("installed")}</span></div>
      <div class="setting-row"><span class="setting-label">${t("hwid")}</span><div class="setting-value"><label class="toggle"><input type="checkbox" id="set-hwid" ${settings.hwid ? "checked" : ""}/><span class="toggle-slider"></span></label></div></div>
      <div class="setting-row"><span class="setting-label">${t("autostart")}</span><div class="setting-value"><label class="toggle"><input type="checkbox" id="set-autostart" ${settings.auto_connect ? "checked" : ""}/><span class="toggle-slider"></span></label></div></div>
      <div class="setting-row"><span class="setting-label">${t("authTip")}</span><div class="setting-value"><label class="toggle"><input type="checkbox" id="set-authtip" ${settings.auth_tip ? "checked" : ""}/><span class="toggle-slider"></span></label></div></div>
      <div class="setting-row"><span class="setting-label">${t("config")}</span><div class="setting-value"><button class="btn-sm" id="btn-open-config">${t("open")}</button></div></div>
      <div class="setting-row"><span class="setting-label">${t("update")}</span><div class="setting-value"><button class="btn-sm" id="btn-open-repo">${t("openRepo")}</button><button class="btn-sm" id="btn-check-updates">${t("checkUpdates")}</button></div></div>
    </div>
    <div class="settings-section">
      <div class="settings-section-title">${lang === "ru" ? "TLS фингерпринт" : "TLS Fingerprint"}</div>
      <div class="setting-row"><span class="setting-label">${lang === "ru" ? "Браузер" : "Browser"}</span><div class="setting-value">
        <select id="set-fingerprint" class="setting-select">
          <option value="chrome" ${currentFingerprint === "chrome" ? "selected" : ""}>Chrome Auto</option>
          <option value="chrome_120" ${currentFingerprint === "chrome_120" ? "selected" : ""}>Chrome 120</option>
          <option value="chrome_115" ${currentFingerprint === "chrome_115" ? "selected" : ""}>Chrome 115</option>
          <option value="firefox" ${currentFingerprint === "firefox" ? "selected" : ""}>Firefox Auto</option>
          <option value="firefox_120" ${currentFingerprint === "firefox_120" ? "selected" : ""}>Firefox 120</option>
          <option value="safari" ${currentFingerprint === "safari" ? "selected" : ""}>Safari Auto</option>
          <option value="ios" ${currentFingerprint === "ios" ? "selected" : ""}>iOS Safari</option>
          <option value="android" ${currentFingerprint === "android" ? "selected" : ""}>Android OkHttp</option>
          <option value="edge" ${currentFingerprint === "edge" ? "selected" : ""}>Edge Auto</option>
          <option value="random" ${currentFingerprint === "random" ? "selected" : ""}>${lang === "ru" ? "Случайный" : "Random"}</option>
        </select>
      </div></div>
      <div class="setting-row fp-desc"><span class="setting-label">${lang === "ru" ? "Описание" : "Description"}</span><span class="setting-value fp-desc-text" id="fp-desc">${getFPDescription(currentFingerprint)}</span></div>
    </div>`;
}

function bindSettingsEvents(): void {
  (document.getElementById("set-port") as HTMLInputElement)?.addEventListener("change", function () { settings.mihomo_port = parseInt(this.value, 10) || 7890; persistSettings(); });
  (document.getElementById("set-bind") as HTMLInputElement)?.addEventListener("change", function () { settings.socks_addr = this.value; persistSettings(); });
  document.querySelectorAll<HTMLElement>(".pill-btn[data-tun]").forEach(el => el.addEventListener("click", () => { settings.tun_stack = el.dataset.tun || "Mixed"; persistSettings(); renderPage(); }));
  document.querySelectorAll<HTMLElement>(".pill-btn[data-theme]").forEach(el => el.addEventListener("click", () => { settings.theme = el.dataset.theme || "dark"; persistSettings(); renderPage(); }));
  const toggles: [string, keyof AppSettings][] = [["set-dns", "dns_redirect"], ["set-ipv6", "ipv6"], ["set-hwid", "hwid"], ["set-autostart", "auto_connect"], ["set-authtip", "auth_tip"]];
  toggles.forEach(([id, key]) => { (document.getElementById(id) as HTMLInputElement)?.addEventListener("change", function () { (settings as any)[key] = this.checked; persistSettings(); }); });
  document.getElementById("btn-copy-secret")?.addEventListener("click", () => {
    clipboardWrite(settings.secret);
    showToast(lang === "ru" ? "Secret скопирован" : "Secret copied", "success", 1800);
  });
  document.getElementById("btn-open-repo")?.addEventListener("click", () => invoke("open_url", { url: "https://github.com/Jalaveyan/Whispera" }).catch(() => { }));
  document.getElementById("btn-open-config")?.addEventListener("click", () => invoke("open_config_dir").catch(() => { }));
  document.getElementById("btn-check-updates")?.addEventListener("click", async () => {
    const current = "0.1.4";
    try {
      const res = await fetch("https://api.github.com/repos/Jalaveyan/Whispera/releases/latest");
      if (!res.ok) throw new Error();
      const data = await res.json();
      const latest = (data.tag_name as string).replace(/^v/, "");
      if (latest === current) {
        showToast(lang === "ru" ? "Установлена актуальная версия" : "Already up to date", "success", 2500);
      } else {
        showToast(lang === "ru" ? `Доступна версия ${latest}` : `Version ${latest} available`, "info", 4000);
        invoke("open_url", { url: data.html_url }).catch(() => { });
      }
    } catch {
      showToast(lang === "ru" ? "Не удалось проверить обновления" : "Update check failed", "error", 2500);
    }
  });
  (document.getElementById("set-fingerprint") as HTMLSelectElement)?.addEventListener("change", function () {
    currentFingerprint = this.value;
    const desc = document.getElementById("fp-desc");
    if (desc) desc.textContent = getFPDescription(currentFingerprint);
    showToast(lang === "ru" ? `Фингерпринт: ${this.value}` : `Fingerprint: ${this.value}`, "success", 2000);
  });
}

let _selectedBridge: BridgeInfo | null = null;

function _mlScoreColor(score: number): string {
  if (score >= 75) return "#4ade80";
  if (score >= 50) return "#fbbf24";
  return "#f87171";
}

function _bridgeRow(b: BridgeInfo): string {
  const isWhite = b.type === "white";
  const loadPct = b.load != null ? Math.round(b.load) : null;
  const loadColor = loadPct != null ? (loadPct > 80 ? "#f87171" : loadPct > 50 ? "#fbbf24" : "#4ade80") : "#666";
  const mlBadge = b.ml_score != null
    ? `<span class="bridge-ml-score" style="color:${_mlScoreColor(b.ml_score)}" title="${esc(b.ml_reason || "")}">${t("mlScore")} ${b.ml_score}</span>`
    : "";
  return `
    <div class="bridge-row" data-id="${esc(b.id)}">
      <span class="bridge-dot alive"></span>
      <span class="bridge-loc">
        ${b.name ? `<span class="bridge-name">${esc(b.name)}</span> ` : ""}${esc(b.city || b.region || b.country || "—")}
      </span>
      ${isWhite ? '<span class="bridge-badge white">WHITE</span>' : '<span class="bridge-badge">PUBLIC</span>'}
      <span class="bridge-latency">${b.latency_ms ? b.latency_ms + " ms" : "—"}</span>
      <span class="bridge-load" style="color:${loadColor}">${loadPct != null ? loadPct + "%" : "—"}</span>
      ${b.distance_km != null ? `<span class="bridge-dist">${b.distance_km} km</span>` : "<span></span>"}
      ${mlBadge}
      <button class="btn-sm btn-bridge-connect" data-id="${esc(b.id)}">${t("bridgeConnect")}</button>
    </div>`;
}

function renderBridges(): string {
  const alive = bridgeList.filter(b => b.alive).length;
  const tableRows = bridgeList.filter(b => b.alive).map(b => _bridgeRow(b)).join("")
    || `<div class="empty-state"><p>${t("noBridges")}</p></div>`;

  return `
    <div class="page-header">
      <h2 class="page-title">${t("bridgesTitle")}</h2>
      <button class="btn-sm" id="btn-bridges-refresh">${ICONS.refresh} ${t("bridgesRefresh")}</button>
    </div>
    <div class="bridge-map-wrap">
      <canvas id="bridge-map-canvas"></canvas>
      <div class="bridge-map-tooltip" id="bridge-tooltip" style="display:none"></div>
      <div class="bridge-popup" id="bridge-popup" style="display:none">
        <div class="bridge-popup-header">
          <span class="bridge-popup-name" id="bridge-popup-name"></span>
          <button class="bridge-popup-close" id="bridge-popup-close">${ICONS.x}</button>
        </div>
        <div class="bridge-popup-latency" id="bridge-popup-latency"></div>
        <button class="btn-connect bridge-popup-btn" id="bridge-popup-connect">${ICONS.bolt} ${t("bridgeConnect")}</button>
      </div>
    </div>
    <div class="bridge-stats">
      <div class="bridge-stat"><span class="bridge-stat-val" id="bstat-alive">${alive}</span><span class="bridge-stat-lbl">${t("bridgesAlive")}</span></div>
      <div class="bridge-stat"><span class="bridge-stat-val" id="bstat-total">${bridgeList.length}</span><span class="bridge-stat-lbl">${t("bridgesTotal")}</span></div>
    </div>
    <div class="card" style="margin-top:12px">
      <div id="bridge-table">${tableRows}</div>
    </div>`;
}

const LAT_MAX = 80;
const LAT_MIN = -58;
const LAT_RANGE = LAT_MAX - LAT_MIN;

function _drawBridgeMap(bridges: BridgeInfo[], selected: BridgeInfo | null): void {
  const canvas = document.getElementById("bridge-map-canvas") as HTMLCanvasElement | null;
  if (!canvas) return;
  const wrap = canvas.parentElement!;
  const W = wrap.clientWidth || 600;
  const H = Math.round(W / (360 / LAT_RANGE));
  const dpr = window.devicePixelRatio || 1;
  canvas.width = W * dpr;
  canvas.height = H * dpr;
  canvas.style.width = W + "px";
  canvas.style.height = H + "px";

  const ctx = canvas.getContext("2d")!;
  ctx.scale(dpr, dpr);

  ctx.fillStyle = "#080c14";
  ctx.fillRect(0, 0, W, H);

  ctx.save();
  ctx.beginPath();
  ctx.rect(0, 0, W, H);
  ctx.clip();

  const lonX = (lon: number) => ((lon + 180) / 360) * W;
  const latY = (lat: number) => ((LAT_MAX - lat) / LAT_RANGE) * H;

  function buildPath(geom: any): Path2D {
    const p = new Path2D();
    const drawRing = (ring: number[][]) => {
      for (let i = 0; i < ring.length; i++) {
        const [lon, lat] = ring[i];
        if (i === 0) {
          p.moveTo(lonX(lon), latY(lat));
        } else {
          const prevLon = ring[i - 1][0];
          if (Math.abs(lon - prevLon) > 180) {
            p.moveTo(lonX(lon), latY(lat));
          } else {
            p.lineTo(lonX(lon), latY(lat));
          }
        }
      }
      p.closePath();
    };
    if (geom.type === "Polygon") {
      geom.coordinates.forEach(drawRing);
    } else if (geom.type === "MultiPolygon") {
      geom.coordinates.forEach((poly: number[][][]) => poly.forEach(drawRing));
    }
    return p;
  }

  const landPath = new Path2D();
  const geo = _landGeo as any;
  const features: any[] = geo.type === "FeatureCollection" ? geo.features : [geo];
  features.forEach(f => {
    const sub = buildPath(f.geometry ?? f);
    landPath.addPath(sub);
  });

  ctx.fillStyle = "rgba(88,108,150,0.22)";
  ctx.fill(landPath);
  ctx.strokeStyle = "rgba(140,165,210,0.45)";
  ctx.lineWidth = 0.6;
  ctx.stroke(landPath);

  bridges.forEach(b => {
    if (!b.lat && !b.lon) return;
    const x = lonX(b.lon);
    const y = latY(b.lat);
    const isSel = selected?.id === b.id;
    const isWhite = b.type === "white";
    const aliveColor = isWhite ? "#a78bfa" : "#4ade80";
    const color = b.alive ? (isSel ? "#00e5ff" : aliveColor) : "#f87171";
    const r = isSel ? 8 : (isWhite ? 6 : 5);

    if (isSel) {
      ctx.strokeStyle = "rgba(0,229,255,0.35)";
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(x, y, 15, 0, Math.PI * 2); ctx.stroke();
      ctx.strokeStyle = "rgba(0,229,255,0.15)";
      ctx.beginPath(); ctx.arc(x, y, 22, 0, Math.PI * 2); ctx.stroke();
    }
    ctx.shadowColor = color + "bb";
    ctx.shadowBlur = isSel ? 18 : 10;
    ctx.fillStyle = color;
    ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
    ctx.shadowBlur = 0;
    ctx.strokeStyle = isWhite ? "rgba(167,139,250,0.6)" : "rgba(0,0,0,0.55)";
    ctx.lineWidth = isWhite ? 2 : 1.5;
    ctx.stroke();

    if (isWhite && !isSel) {
      ctx.strokeStyle = "rgba(167,139,250,0.2)";
      ctx.lineWidth = 1;
      ctx.beginPath(); ctx.arc(x, y, 10, 0, Math.PI * 2); ctx.stroke();
    }

    const label = b.name || b.city || "";
    if (label) {
      ctx.save();
      ctx.font = isSel ? "bold 10px sans-serif" : "10px sans-serif";
      ctx.fillStyle = isSel ? "#00e5ff" : "rgba(210,220,255,0.75)";
      ctx.textAlign = "center";
      ctx.shadowBlur = 0;
      ctx.fillText(label, x, y + r + 10);
      ctx.restore();
    }
  });

  (canvas as any)._bridges = bridges;
  (canvas as any)._lonX = lonX;
  (canvas as any)._latY = latY;
}

function _showBridgePopup(b: BridgeInfo): void {
  _selectedBridge = b;
  const popup = document.getElementById("bridge-popup");
  const nameEl = document.getElementById("bridge-popup-name");
  const latEl = document.getElementById("bridge-popup-latency");
  if (!popup || !nameEl || !latEl) return;
  const loc = b.city ? `${b.city}, ${b.country || ""}` : (b.region || b.country || b.id);
  const badge = b.type === "white" ? " [WHITE]" : "";
  nameEl.textContent = (b.name ? b.name + " — " : "") + loc + badge;
  const details: string[] = [];
  if (b.latency_ms) details.push("🏓 " + b.latency_ms + " ms");
  if (b.distance_km != null) details.push("📍 " + b.distance_km + " km");
  if (b.load != null) details.push("load: " + Math.round(b.load) + "%");
  if (b.cur_users != null) details.push(b.cur_users + (b.max_users ? "/" + b.max_users : "") + " users");
  latEl.textContent = details.join(" · ");
  popup.style.display = "flex";
  _drawBridgeMap(bridgeList, b);
}

function _hideBridgePopup(): void {
  _selectedBridge = null;
  const popup = document.getElementById("bridge-popup");
  if (popup) popup.style.display = "none";
  _drawBridgeMap(bridgeList, null);
}

function bindBridgesEvents(): void {
  const refresh = async () => {
    _hideBridgePopup();
    const baseURL = getServerBaseURL();
    if (!baseURL) {
      const tbl = document.getElementById("bridge-table");
      if (tbl) tbl.innerHTML = `<div class="empty-state"><p>${t("bridgesNoKey")}</p></div>`;
      return;
    }
    try {
      const res = await fetch(`${baseURL}/api/bridge-map`, { signal: AbortSignal.timeout(8000) });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      bridgeList = (Array.isArray(data) ? data : (data.bridges || [])) as BridgeInfo[];
      if (userLat !== 0 || userLon !== 0) {
        bridgeList.forEach(b => {
          if (b.lat || b.lon) b.distance_km = haversineKm(userLat, userLon, b.lat, b.lon);
        });
      }
      if (_mlStatus && bridgeList.length > 0) {
        try {
          const ranked = await invoke<string>("ml_rank_bridges", {
            bridgesJson: JSON.stringify(bridgeList),
          });
          const rankedList = JSON.parse(ranked) as BridgeInfo[];
          const scoreMap = new Map(rankedList.map(b => [b.id, b]));
          bridgeList = bridgeList.map(b => {
            const r = scoreMap.get(b.id);
            return r ? { ...b, ml_score: r.ml_score, ml_reason: r.ml_reason } : b;
          });
          bridgeList.sort((a, b) => {
            if (a.alive !== b.alive) return a.alive ? -1 : 1;
            return (b.ml_score ?? 0) - (a.ml_score ?? 0);
          });
          addLog("✦ ML ranked " + bridgeList.length + " bridges");
        } catch { }
      }
    } catch { bridgeList = []; }

    const alive = bridgeList.filter(b => b.alive).length;
    const sa = document.getElementById("bstat-alive"); if (sa) sa.textContent = String(alive);
    const st = document.getElementById("bstat-total"); if (st) st.textContent = String(bridgeList.length);

    const rows = bridgeList.filter(b => b.alive).map(b => _bridgeRow(b)).join("")
      || `<div class="empty-state"><p>${t("noBridges")}</p></div>`;
    const table = document.getElementById("bridge-table");
    if (table) table.innerHTML = rows;

    requestAnimationFrame(() => {
      _drawBridgeMap(bridgeList, null);
      bindBridgeRowEvents();
    });
  };

  document.getElementById("btn-bridges-refresh")?.addEventListener("click", refresh);
  document.getElementById("bridge-popup-close")?.addEventListener("click", _hideBridgePopup);
  document.getElementById("bridge-popup-connect")?.addEventListener("click", () => {
    if (_selectedBridge) connectToBridge(_selectedBridge);
  });

  const canvas = document.getElementById("bridge-map-canvas") as HTMLCanvasElement | null;
  const tooltip = document.getElementById("bridge-tooltip");

  if (canvas && tooltip) {
    canvas.addEventListener("mousemove", (ev) => {
      const rect = canvas.getBoundingClientRect();
      const mx = ev.clientX - rect.left;
      const my = ev.clientY - rect.top;
      const bs: BridgeInfo[] = (canvas as any)._bridges || [];
      const lonX: (l: number) => number = (canvas as any)._lonX;
      const latY: (l: number) => number = (canvas as any)._latY;
      if (!lonX) return;
      let hit: BridgeInfo | null = null;
      for (const b of bs) {
        if (!b.lat && !b.lon) continue;
        if (Math.hypot(lonX(b.lon) - mx, latY(b.lat) - my) < 10) { hit = b; break; }
      }
      if (hit) {
        tooltip.style.display = "block";
        tooltip.style.left = (mx + 14) + "px";
        tooltip.style.top = (my - 10) + "px";
        const label = hit.name
          ? `${hit.name} · ${hit.city || hit.country || hit.id}`
          : (hit.city || hit.region || hit.country || hit.id);
        const parts = [label];
        if (hit.type === "white") parts.push("⚡ WHITE");
        if (hit.latency_ms) parts.push(hit.latency_ms + " ms");
        if (hit.distance_km != null) parts.push(hit.distance_km + " km");
        if (hit.load != null) parts.push("load: " + Math.round(hit.load) + "%");
        if (hit.cur_users != null) parts.push(hit.cur_users + (hit.max_users ? "/" + hit.max_users : "") + " users");
        tooltip.textContent = parts.join(" · ");
        canvas.style.cursor = "pointer";
      } else {
        tooltip.style.display = "none";
        canvas.style.cursor = "default";
      }
    });
    canvas.addEventListener("mouseleave", () => { tooltip.style.display = "none"; });
    canvas.addEventListener("click", (ev) => {
      const rect = canvas.getBoundingClientRect();
      const mx = ev.clientX - rect.left;
      const my = ev.clientY - rect.top;
      const bs: BridgeInfo[] = (canvas as any)._bridges || [];
      const lonX: (l: number) => number = (canvas as any)._lonX;
      const latY: (l: number) => number = (canvas as any)._latY;
      if (!lonX) return;
      for (const b of bs) {
        if (!b.lat && !b.lon) continue;
        if (Math.hypot(lonX(b.lon) - mx, latY(b.lat) - my) < 10) {
          _showBridgePopup(b);
          tooltip.style.display = "none";
          return;
        }
      }
      _hideBridgePopup();
    });
  }

  refresh();
}

function bindBridgeRowEvents(): void {
  document.querySelectorAll<HTMLElement>(".btn-bridge-connect").forEach(el => {
    el.addEventListener("click", () => {
      const b = bridgeList.find(x => x.id === el.dataset.id);
      if (b) connectToBridge(b);
    });
  });
}

async function connectToBridge(b: BridgeInfo): Promise<void> {
  const baseURL = getServerBaseURL();
  if (!baseURL) return;
  showToast(t("bridgesConnecting"), "info", 2000);
  try {
    const res = await fetch(`${baseURL}/api/bridge-connect`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ bridge_id: b.id }),
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    const conn = data.connection || data;
    if (conn.conn_key || conn.address) {
      settings.conn_key = conn.conn_key || `whispera://${conn.address}?pubkey=${conn.public_key || ""}`;
      await persistSettings();
      showToast(t("bridgesConnected"), "success", 2500);
      currentPage = "home";
      renderNav();
      renderPage();
    } else {
      showToast(lang === "ru" ? "Нет данных подключения" : "No connection data", "error", 3000);
    }
  } catch (e) {
    showToast(String(e), "error", 4000);
  }
}

let _mlStatus = false;
let _mlBinaryExists = false;
let _mlLogs = "";
let _mlLogsInterval: ReturnType<typeof setInterval> | null = null;
let _mlNetworkAnalysis: MLNetworkAnalysis | null = null;
let _mlTransportRec: MLTransportRecommendation | null = null;
let _mlAnalyzing = false;
let _mlTargetServer = "";
let _mlToken = "";
let _mlConnecting = false;
const _mlEndpoint = localStorage.getItem("ml_endpoint") || "https://127.0.0.1:8000";
let _mlTraining = false;
let _mlTrainProgress = 0;
let _mlTrainEpoch = 0;
let _mlTrainLoss = 0;
let _mlTrainStatus = "";
let _mlScanResults: {host: string; port: number; open: boolean; service: string; latency: number}[] = [];
let _mlScanning = false;
let _mlDatasets: {name: string; size: number; modified: number}[] = [];
let _mlFeedbackStats: Record<string, {success: number; fail: number; total: number; total_latency: number; count: number}> = {};
let _mlModelInfo: {accuracy: number; parameters: number; samples: number; engine: string} | null = null;

async function refreshMLState(): Promise<void> {
  try { _mlStatus = await invoke<boolean>("get_ml_status"); } catch { _mlStatus = false; }
  try { _mlBinaryExists = await invoke<boolean>("ml_binary_exists"); } catch { _mlBinaryExists = false; }
  try { _mlLogs = await invoke<string>("get_ml_logs"); } catch { _mlLogs = ""; }
}

function _dpiRiskBadge(risk: string): string {
  const map: Record<string, [string, string]> = {
    low:      ["badge-on",  t("mlDpiLow")],
    medium:   ["badge-warn", t("mlDpiMedium")],
    high:     ["badge-off", t("mlDpiHigh")],
    critical: ["badge-off", t("mlDpiCritical")],
  };
  const [cls, label] = map[risk] ?? ["badge-off", risk];
  return `<span class="${cls}">${label}</span>`;
}

function renderML(): string {
  const statusClass = _mlStatus ? "badge-on" : "badge-off";
  const statusText  = _mlStatus ? t("mlRunning") : t("mlStopped");
  const modeText    = _mlStatus ? t("mlFallbackOff") : t("mlFallbackOn");
  const modeClass   = _mlStatus ? "badge-on" : "badge-off";

  let analysisCard: string;
  if (_mlNetworkAnalysis) {
    const a = _mlNetworkAnalysis;
    const rec = _mlTransportRec;
    analysisCard = `
      <div class="card" style="margin-bottom:12px">
        <div class="card-header">
          <span class="card-title">${t("mlNetworkAnalysis")}</span>
          <button class="btn-sm" id="btn-ml-analyze" ${_mlAnalyzing ? "disabled" : ""}>${_mlAnalyzing ? t("mlAnalyzing") : t("mlRunAnalysis")}</button>
        </div>
        <div class="info-row"><span class="info-label">${t("mlDpiRisk")}</span><span class="info-value" id="ml-dpi-risk">${_dpiRiskBadge(a.dpi_risk)}</span></div>
        <div class="info-row"><span class="info-label">${t("mlAvgRtt")}</span><span class="info-value">${a.avg_rtt_ms != null ? a.avg_rtt_ms + " ms" : "—"}</span></div>
        <div class="info-row"><span class="info-label">${t("mlReachable")}</span><span class="info-value">${a.reachable} / ${a.total_probed}</span></div>
        ${rec ? `
        <div class="info-row" style="margin-top:6px">
          <span class="info-label">${t("mlTransportRec")}</span>
          <span class="info-value"><span class="badge-on">${esc(rec.transport)}</span></span>
        </div>
        <div class="info-row">
          <span class="info-label">${t("mlTransportDesc")}</span>
          <span class="info-value" style="font-size:12px;opacity:0.75">${esc(rec.description)}</span>
        </div>` : ""}
      </div>`;
  } else {
    analysisCard = `
      <div class="card" style="margin-bottom:12px">
        <div class="card-header">
          <span class="card-title">${t("mlNetworkAnalysis")}</span>
          <button class="btn-sm" id="btn-ml-analyze" ${_mlAnalyzing || !_mlStatus ? "disabled" : ""}>${_mlAnalyzing ? t("mlAnalyzing") : t("mlRunAnalysis")}</button>
        </div>
        <div class="empty-state" style="padding:16px 0"><p id="ml-analysis-hint" style="opacity:0.5">${_mlStatus ? t("mlScanFirst") : t("mlStopped") + " — " + t("mlStart")}</p></div>
      </div>`;
  }

  return `
    <div class="page-header">
      <h2 class="page-title">${t("mlTitle")}</h2>
      <button class="btn-sm" id="btn-ml-refresh-logs">${ICONS.refresh} ${t("mlRefreshLogs")}</button>
    </div>
    <p class="page-desc" style="margin-bottom:16px">${t("mlDesc")}</p>

    <div class="card" style="margin-bottom:12px">
      <div class="card-header"><span class="card-title">${t("mlServer")}</span></div>
      <div class="info-row">
        <span class="info-label">${t("mlStatus")}</span>
        <span class="info-value"><span class="${statusClass}" id="ml-status-badge">${statusText}</span></span>
      </div>
      <div class="info-row">
        <span class="info-label">${t("mlFallback")}</span>
        <span class="info-value"><span class="${modeClass}" id="ml-mode-badge">${modeText}</span></span>
      </div>
      <div class="info-row">
        <span class="info-label">${t("mlEndpoint")}</span>
        <span class="info-value" style="font-family:monospace;font-size:12px">${_mlEndpoint}</span>
      </div>
      <div class="info-row" id="ml-no-binary-row" style="${!_mlBinaryExists && !_mlStatus ? "" : "display:none"}"><span style="color:#f87171;font-size:12px">${t("mlNoBinary")}</span></div>
      <div style="display:flex;gap:8px;margin-top:12px">
        <button class="btn-sm" id="btn-ml-start"   ${_mlStatus || !_mlBinaryExists ? "disabled" : ""}>${t("mlStart")}</button>
        <button class="btn-sm" id="btn-ml-stop"    ${!_mlStatus ? "disabled" : ""}>${t("mlStop")}</button>
        <button class="btn-sm" id="btn-ml-restart" ${!_mlBinaryExists ? "disabled" : ""}>${t("mlRestart")}</button>
      </div>
    </div>

    <div class="card" style="margin-bottom:12px">
      <div class="card-header"><span class="card-title">${t("mlTargetServer")}</span></div>
      <div class="info-row" style="gap:8px;align-items:center">
        <span class="info-label" style="min-width:100px">${t("mlTargetServer")}</span>
        <input id="ml-target-server" class="key-input" style="flex:1;padding:6px 10px;font-size:13px;font-family:monospace"
          placeholder="${t("mlTargetServerHint")}" value="${esc(_mlTargetServer)}"/>
      </div>
      <div class="info-row" style="gap:8px;align-items:center;margin-top:6px">
        <span class="info-label" style="min-width:100px">${t("mlToken")}</span>
        <input id="ml-token" class="key-input" type="password" style="flex:1;padding:6px 10px;font-size:13px;font-family:monospace"
          placeholder="${t("mlTokenHint")}" value="${esc(_mlToken)}"/>
      </div>
      <div style="display:flex;gap:8px;margin-top:12px">
        <button class="btn-connect${_mlConnecting ? " connecting" : ""}" id="btn-ml-connect"
          style="flex:1;padding:8px 0;font-size:13px"
          ${_mlConnecting || !_mlTargetServer ? "disabled" : ""}>
          ${_mlConnecting ? t("mlConnecting") : t("mlConnect")}
        </button>
      </div>
    </div>

    ${analysisCard}

    <div class="card" style="margin-bottom:12px">
      <div class="card-header">
        <span class="card-title">${t("mlPortScan")}</span>
        <button class="btn-sm" id="btn-ml-scan" ${_mlScanning || !_mlStatus ? "disabled" : ""}>${_mlScanning ? t("mlScanRunning") : t("mlScanStart")}</button>
      </div>
      ${_mlScanResults.length > 0 ? `
        <div class="scan-table" style="font-size:12px;margin-top:8px">
          <div class="scan-row scan-header" style="display:flex;gap:8px;padding:4px 0;opacity:0.6;border-bottom:1px solid rgba(255,255,255,0.1)">
            <span style="flex:2">${t("mlScanHost")}</span>
            <span style="flex:1">${t("mlScanPort")}</span>
            <span style="flex:2">${t("mlScanService")}</span>
            <span style="flex:1">${t("mlScanLatency")}</span>
          </div>
          ${_mlScanResults.map(r => `
            <div class="scan-row" style="display:flex;gap:8px;padding:3px 0;font-family:monospace">
              <span style="flex:2">${esc(r.host)}</span>
              <span style="flex:1"><span class="${r.open ? "badge-on" : "badge-off"}" style="font-size:11px">${r.port}</span></span>
              <span style="flex:2">${esc(r.service)}</span>
              <span style="flex:1">${r.latency > 0 ? r.latency + " ms" : "—"}</span>
            </div>
          `).join("")}
        </div>` : `<div class="empty-state" style="padding:12px 0"><p style="opacity:0.4">${t("mlScanNoResults")}</p></div>`}
    </div>

    <div class="card" style="margin-bottom:12px">
      <div class="card-header">
        <span class="card-title">${t("mlTraining")}</span>
        <button class="btn-sm" id="btn-ml-train" ${!_mlStatus ? "disabled" : ""}>${_mlTraining ? t("mlTrainStop") : t("mlTrainStart")}</button>
      </div>
      ${_mlTraining ? `
        <div style="margin-top:8px">
          <div class="info-row"><span class="info-label">${t("mlTrainEpoch")}</span><span class="info-value" id="ml-train-epoch">${_mlTrainEpoch}</span></div>
          <div class="info-row"><span class="info-label">${t("mlTrainLoss")}</span><span class="info-value" id="ml-train-loss">${_mlTrainLoss.toFixed(6)}</span></div>
          <div class="info-row"><span class="info-label">${t("mlTrainProgress")}</span><span class="info-value" id="ml-train-pct">${_mlTrainProgress}%</span></div>
          <div style="margin-top:8px;height:6px;background:rgba(255,255,255,0.1);border-radius:3px;overflow:hidden">
            <div id="ml-train-bar" style="height:100%;width:${_mlTrainProgress}%;background:var(--accent);transition:width 0.3s"></div>
          </div>
        </div>` : `
        <div class="empty-state" style="padding:12px 0"><p style="opacity:0.4">${_mlTrainStatus || (lang === "ru" ? "Нажмите чтобы начать тренировку" : "Click to start training")}</p></div>`}
    </div>

    <div class="card" style="margin-bottom:12px">
      <div class="card-header"><span class="card-title">${t("mlFederated")}</span></div>
      <div style="display:flex;gap:8px;margin-top:8px">
        <button class="btn-sm" id="btn-ml-fed-export" ${!_mlStatus ? "disabled" : ""}>${t("mlFedExport")}</button>
        <button class="btn-sm" id="btn-ml-fed-import" ${!_mlStatus ? "disabled" : ""}>${t("mlFedImport")}</button>
        <button class="btn-sm" id="btn-ml-fed-losses" ${!_mlStatus ? "disabled" : ""}>${t("mlFedLosses")}</button>
      </div>
      <div id="ml-fed-output" style="margin-top:8px;font-size:12px;font-family:monospace;max-height:150px;overflow-y:auto"></div>
    </div>

    <div class="card" style="margin-bottom:12px">
      <div class="card-header">
        <span class="card-title">${t("mlModelMgmt")}</span>
        <button class="btn-sm" id="btn-ml-model-reload" ${!_mlStatus ? "disabled" : ""}>${t("mlModelReload")}</button>
      </div>
      ${_mlModelInfo ? `
        <div class="info-row"><span class="info-label">${t("mlModelEngine")}</span><span class="info-value"><span class="badge-on">${esc(_mlModelInfo.engine)}</span></span></div>
        <div class="info-row"><span class="info-label">${t("mlModelAccuracy")}</span><span class="info-value">${(_mlModelInfo.accuracy * 100).toFixed(1)}%</span></div>
        <div class="info-row"><span class="info-label">${t("mlModelParams")}</span><span class="info-value">${_mlModelInfo.parameters.toLocaleString()}</span></div>
        <div class="info-row"><span class="info-label">${t("mlModelSamples")}</span><span class="info-value">${_mlModelInfo.samples.toLocaleString()}</span></div>
      ` : `<div class="empty-state" style="padding:12px 0"><p style="opacity:0.4">—</p></div>`}
    </div>

    <div class="card" style="margin-bottom:12px">
      <div class="card-header">
        <span class="card-title">${t("mlFeedback")}</span>
        <button class="btn-sm" id="btn-ml-fb-refresh" ${!_mlStatus ? "disabled" : ""}>${ICONS.refresh}</button>
      </div>
      ${Object.keys(_mlFeedbackStats).length > 0 ? `
        <div style="font-size:12px;margin-top:8px">
          ${Object.entries(_mlFeedbackStats).map(([name, st]) => `
            <div style="display:flex;gap:8px;padding:3px 0;align-items:center">
              <span style="flex:2;font-family:monospace">${esc(name)}</span>
              <span style="flex:1;color:#4ade80">${t("mlFbSuccess")}: ${st.success}</span>
              <span style="flex:1;color:#f87171">${t("mlFbFail")}: ${st.fail}</span>
              <span style="flex:1;opacity:0.6">${t("mlFbTotal")}: ${st.total}</span>
              <span style="flex:1;opacity:0.6">${st.count > 0 ? (st.total_latency / st.count).toFixed(0) + "ms" : "—"}</span>
            </div>
          `).join("")}
        </div>` : `<div class="empty-state" style="padding:12px 0"><p style="opacity:0.4">${t("mlFbNoData")}</p></div>`}
    </div>

    <div class="card" style="margin-bottom:12px">
      <div class="card-header">
        <span class="card-title">${t("mlDatasets")}</span>
        <div style="display:flex;gap:4px">
          <button class="btn-sm" id="btn-ml-ds-capture" ${!_mlStatus ? "disabled" : ""}>${t("mlDsCapture")}</button>
          <button class="btn-sm" id="btn-ml-ds-refresh" ${!_mlStatus ? "disabled" : ""}>${ICONS.refresh}</button>
        </div>
      </div>
      ${_mlDatasets.length > 0 ? `
        <div style="font-size:12px;margin-top:8px">
          ${_mlDatasets.map(ds => `
            <div style="display:flex;gap:8px;padding:3px 0;font-family:monospace;align-items:center">
              <span style="flex:3">${esc(ds.name)}</span>
              <span style="flex:1;opacity:0.6">${(ds.size / 1024).toFixed(1)} KB</span>
              <span style="flex:2;opacity:0.5">${new Date(ds.modified * 1000).toLocaleString()}</span>
            </div>
          `).join("")}
        </div>` : `<div class="empty-state" style="padding:12px 0"><p style="opacity:0.4">${t("mlDsEmpty")}</p></div>`}
    </div>

    <div class="card">
      <div class="card-header">
        <span class="card-title">${t("mlLogs")}</span>
        <button class="btn-sm" id="btn-ml-clear-logs">${t("mlClearLogs")}</button>
      </div>
      <div class="log-box" id="ml-log-box" style="height:220px">${_mlLogs ? esc(_mlLogs) : '<span style="opacity:0.4">—</span>'}</div>
    </div>`;
}

function _updateMLStatusDOM(): void {
  const badge = document.getElementById("ml-status-badge");
  const modeBadge = document.getElementById("ml-mode-badge");
  if (badge) {
    badge.textContent = _mlStatus ? t("mlRunning") : t("mlStopped");
    badge.className = _mlStatus ? "badge-on" : "badge-off";
  }
  if (modeBadge) {
    modeBadge.textContent = _mlStatus ? t("mlFallbackOff") : t("mlFallbackOn");
    modeBadge.className = _mlStatus ? "badge-on" : "badge-off";
  }
  const btnStart = document.getElementById("btn-ml-start") as HTMLButtonElement | null;
  const btnStop = document.getElementById("btn-ml-stop") as HTMLButtonElement | null;
  const btnAnalyze = document.getElementById("btn-ml-analyze") as HTMLButtonElement | null;
  if (btnStart) btnStart.disabled = _mlStatus || !_mlBinaryExists;
  if (btnStop) btnStop.disabled = !_mlStatus;
  if (btnAnalyze && !_mlAnalyzing) btnAnalyze.disabled = !_mlStatus;
  const noBinaryRow = document.getElementById("ml-no-binary-row") as HTMLElement | null;
  if (noBinaryRow) noBinaryRow.style.display = (!_mlBinaryExists && !_mlStatus) ? "" : "none";
  const analysisHint = document.getElementById("ml-analysis-hint");
  if (analysisHint) analysisHint.textContent = _mlStatus ? t("mlScanFirst") : t("mlStopped") + " — " + t("mlStart");
}

function _updateMLLogsDOM(): void {
  const box = document.getElementById("ml-log-box");
  if (box && _mlLogs) {
    box.textContent = _mlLogs;
    box.scrollTop = box.scrollHeight;
  }
}

function bindMLEvents(): void {
  _mlTargetServer = localStorage.getItem("ml_target_server") ?? _mlTargetServer;
  _mlToken = localStorage.getItem("ml_token") ?? _mlToken;

  const targetInput = document.getElementById("ml-target-server") as HTMLInputElement | null;
  if (targetInput) {
    targetInput.value = _mlTargetServer;
    targetInput.addEventListener("input", () => {
      _mlTargetServer = targetInput.value.trim();
      localStorage.setItem("ml_target_server", _mlTargetServer);
      const btn = document.getElementById("btn-ml-connect") as HTMLButtonElement | null;
      if (btn) btn.disabled = _mlConnecting || !_mlTargetServer;
    });
  }

  const tokenInput = document.getElementById("ml-token") as HTMLInputElement | null;
  if (tokenInput) {
    tokenInput.value = _mlToken;
    tokenInput.addEventListener("input", () => {
      _mlToken = tokenInput.value.trim();
      localStorage.setItem("ml_token", _mlToken);
    });
  }

  document.getElementById("btn-ml-connect")?.addEventListener("click", async () => {
    if (_mlConnecting || !_mlTargetServer) return;
    _mlConnecting = true;
    const btn = document.getElementById("btn-ml-connect") as HTMLButtonElement | null;
    if (btn) { btn.disabled = true; btn.textContent = t("mlConnecting"); }
    try {
      const msg = await invoke<string>("connect_ml", {
        server: _mlTargetServer,
        token: _mlToken,
      });
      showToast(msg, "success", 4000);
      addLog("✓ " + msg);
    } catch (e) {
      showToast(String(e), "error", 5000);
      addLog("✗ ML connect: " + e);
    }
    _mlConnecting = false;
    if (btn) { btn.disabled = !_mlTargetServer; btn.textContent = t("mlConnect"); }
  });

  refreshMLState().then(() => {
    _updateMLStatusDOM();
    _updateMLLogsDOM();
  });

  _mlLogsInterval = setInterval(async () => {
    if (currentPage !== "ml") {
      if (_mlLogsInterval) { clearInterval(_mlLogsInterval); _mlLogsInterval = null; }
      return;
    }
    try { _mlStatus = await invoke<boolean>("get_ml_status"); } catch { /**/ }
    if (!_mlStatus) {
      try { const r = await fetch(`${_mlEndpoint}/health`, { signal: AbortSignal.timeout(1000) }); if (r.ok) _mlStatus = true; } catch { /**/ }
    }
    if (_mlStatus) {
      try {
        const r = await fetch(`${_mlEndpoint}/logs?n=150`, { signal: AbortSignal.timeout(1500) });
        if (r.ok) { const j = await r.json() as { lines: string[] }; _mlLogs = j.lines.join("\n"); }
      } catch { try { _mlLogs = await invoke<string>("get_ml_logs"); } catch { /**/ } }
    }
    _updateMLStatusDOM();
    _updateMLLogsDOM();
  }, 3000);

  document.getElementById("btn-ml-start")?.addEventListener("click", async () => {
    try {
      await invoke("start_ml_server");
      showToast(lang === "ru" ? "ML сервер запускается..." : "ML server starting...", "info", 2500);
      setTimeout(async () => {
        try { _mlStatus = await invoke<boolean>("get_ml_status"); } catch { /**/ }
        _updateMLStatusDOM();
      }, 1500);
    } catch (e) { showToast(String(e), "error", 4000); }
  });

  document.getElementById("btn-ml-stop")?.addEventListener("click", async () => {
    try {
      await invoke("stop_ml_server");
      _mlStatus = false;
      _updateMLStatusDOM();
      showToast(lang === "ru" ? "ML сервер остановлен" : "ML server stopped", "info", 2000);
    } catch (e) { showToast(String(e), "error", 4000); }
  });

  document.getElementById("btn-ml-restart")?.addEventListener("click", async () => {
    try {
      await invoke("stop_ml_server");
      await new Promise(r => setTimeout(r, 800));
      await invoke("start_ml_server");
      showToast(lang === "ru" ? "ML сервер перезапущен" : "ML server restarted", "success", 2500);
      setTimeout(async () => {
        try { _mlStatus = await invoke<boolean>("get_ml_status"); } catch { /**/ }
        _updateMLStatusDOM();
      }, 1500);
    } catch (e) { showToast(String(e), "error", 4000); }
  });

  document.getElementById("btn-ml-refresh-logs")?.addEventListener("click", async () => {
    try { _mlLogs = await invoke<string>("get_ml_logs"); } catch { /**/ }
    _updateMLLogsDOM();
  });

  document.getElementById("btn-ml-clear-logs")?.addEventListener("click", () => {
    _mlLogs = "";
    const box = document.getElementById("ml-log-box");
    if (box) box.innerHTML = '<span style="opacity:0.4">—</span>';
  });

  document.getElementById("btn-ml-analyze")?.addEventListener("click", async () => {
    if (_mlAnalyzing) return;
    _mlAnalyzing = true;
    const btn = document.getElementById("btn-ml-analyze") as HTMLButtonElement | null;
    if (btn) { btn.disabled = true; btn.textContent = t("mlAnalyzing"); }

    try {
      const target = _mlTargetServer || getServerHost();
      const parts = target.split(":");
      const host = parts[0] || "";
      const port = parseInt(parts[1] ?? "8443", 10) || 8443;
      const rawAnalysis = await invoke<string>("ml_analyze_network", { host, port });
      _mlNetworkAnalysis = JSON.parse(rawAnalysis) as MLNetworkAnalysis;

      const rawRec = await invoke<string>("ml_recommend_transport", {
        serverHost: host,
        serverPort: port,
      });
      _mlTransportRec = JSON.parse(rawRec) as MLTransportRecommendation;

      showToast(
        lang === "ru"
          ? `Анализ завершён — риск DPI: ${_mlNetworkAnalysis.dpi_risk}`
          : `Analysis done — DPI risk: ${_mlNetworkAnalysis.dpi_risk}`,
        _mlNetworkAnalysis.dpi_risk === "low" ? "success" : "info",
        3500,
      );
    } catch (e) {
      showToast(
        lang === "ru" ? "ML сервер недоступен" : "ML server unavailable",
        "error", 3000,
      );
    }

    _mlAnalyzing = false;
    const main = document.getElementById("main-content");
    if (main && currentPage === "ml") { main.innerHTML = renderML(); bindMLEvents(); }
  });

  document.getElementById("btn-ml-scan")?.addEventListener("click", async () => {
    if (_mlScanning || !_mlStatus) return;
    _mlScanning = true;
    const btn = document.getElementById("btn-ml-scan") as HTMLButtonElement | null;
    if (btn) { btn.disabled = true; btn.textContent = t("mlScanRunning"); }
    try {
      const target = _mlTargetServer || getServerHost();
      const host = target.split(":")[0] || "";
      const r = await fetch(`${_mlEndpoint}/scan?host=${encodeURIComponent(host)}`, { signal: AbortSignal.timeout(30000) });
      if (r.ok) {
        const j = await r.json() as { results: typeof _mlScanResults };
        _mlScanResults = j.results || [];
        showToast(lang === "ru" ? `Найдено ${_mlScanResults.filter(x => x.open).length} открытых портов` : `Found ${_mlScanResults.filter(x => x.open).length} open ports`, "success", 3000);
      }
    } catch {
      showToast(lang === "ru" ? "Ошибка сканирования" : "Scan failed", "error", 3000);
    }
    _mlScanning = false;
    const m2 = document.getElementById("main-content");
    if (m2 && currentPage === "ml") { m2.innerHTML = renderML(); bindMLEvents(); }
  });

  document.getElementById("btn-ml-train")?.addEventListener("click", async () => {
    if (!_mlStatus) return;
    if (_mlTraining) {
      try { await fetch(`${_mlEndpoint}/train/stop`, { method: "POST", signal: AbortSignal.timeout(5000) }); } catch { /**/ }
      _mlTraining = false;
      _mlTrainStatus = t("mlTrainDone");
      const m3 = document.getElementById("main-content");
      if (m3 && currentPage === "ml") { m3.innerHTML = renderML(); bindMLEvents(); }
      return;
    }
    _mlTraining = true;
    _mlTrainProgress = 0;
    _mlTrainEpoch = 0;
    _mlTrainLoss = 0;
    _mlTrainStatus = "";
    const m4 = document.getElementById("main-content");
    if (m4 && currentPage === "ml") { m4.innerHTML = renderML(); bindMLEvents(); }
    try {
      const r = await fetch(`${_mlEndpoint}/train/start`, { method: "POST", signal: AbortSignal.timeout(5000) });
      if (!r.ok) throw new Error("start failed");
      const pollId = setInterval(async () => {
        if (!_mlTraining || currentPage !== "ml") { clearInterval(pollId); return; }
        try {
          const sr = await fetch(`${_mlEndpoint}/train/status`, { signal: AbortSignal.timeout(3000) });
          if (sr.ok) {
            const s = await sr.json() as { running: boolean; epoch: number; total_epochs: number; loss: number };
            _mlTrainEpoch = s.epoch;
            _mlTrainLoss = s.loss;
            _mlTrainProgress = s.total_epochs > 0 ? Math.round(s.epoch / s.total_epochs * 100) : 0;
            const epochEl = document.getElementById("ml-train-epoch");
            const lossEl = document.getElementById("ml-train-loss");
            const pctEl = document.getElementById("ml-train-pct");
            const bar = document.getElementById("ml-train-bar");
            if (epochEl) epochEl.textContent = String(s.epoch);
            if (lossEl) lossEl.textContent = s.loss.toFixed(6);
            if (pctEl) pctEl.textContent = _mlTrainProgress + "%";
            if (bar) bar.style.width = _mlTrainProgress + "%";
            if (!s.running) {
              clearInterval(pollId);
              _mlTraining = false;
              _mlTrainStatus = t("mlTrainDone");
              _mlTrainProgress = 100;
              showToast(t("mlTrainDone"), "success", 3000);
              const m5 = document.getElementById("main-content");
              if (m5 && currentPage === "ml") { m5.innerHTML = renderML(); bindMLEvents(); }
            }
          }
        } catch { /**/ }
      }, 2000);
    } catch {
      _mlTraining = false;
      _mlTrainStatus = t("mlTrainFailed");
      showToast(t("mlTrainFailed"), "error", 3000);
      const m6 = document.getElementById("main-content");
      if (m6 && currentPage === "ml") { m6.innerHTML = renderML(); bindMLEvents(); }
    }
  });

  document.getElementById("btn-ml-fed-export")?.addEventListener("click", async () => {
    const out = document.getElementById("ml-fed-output");
    try {
      const r = await fetch(`${_mlEndpoint}/federated/export`, { signal: AbortSignal.timeout(10000) });
      if (r.ok) {
        const j = await r.json();
        if (out) out.textContent = JSON.stringify(j, null, 2);
        showToast(t("mlFedExported"), "success", 2000);
      }
    } catch { showToast("Error", "error", 2000); }
  });

  document.getElementById("btn-ml-fed-import")?.addEventListener("click", async () => {
    const out = document.getElementById("ml-fed-output");
    try {
      const r = await fetch(`${_mlEndpoint}/federated/import`, { method: "POST", signal: AbortSignal.timeout(10000) });
      if (r.ok) {
        const j = await r.json();
        if (out) out.textContent = JSON.stringify(j, null, 2);
        showToast(t("mlFedImported"), "success", 2000);
      }
    } catch { showToast("Error", "error", 2000); }
  });

  document.getElementById("btn-ml-fed-losses")?.addEventListener("click", async () => {
    const out = document.getElementById("ml-fed-output");
    try {
      const r = await fetch(`${_mlEndpoint}/federated/losses`, { signal: AbortSignal.timeout(5000) });
      if (r.ok) {
        const j = await r.json();
        if (out) out.textContent = JSON.stringify(j, null, 2);
      }
    } catch { showToast("Error", "error", 2000); }
  });

  document.getElementById("btn-ml-model-reload")?.addEventListener("click", async () => {
    try {
      await fetch(`${_mlEndpoint}/models/load`, { method: "POST", signal: AbortSignal.timeout(5000) });
      showToast(lang === "ru" ? "Модель перезагружена" : "Model reloaded", "success", 2000);
      await _refreshMLModelInfo();
    } catch { showToast("Error", "error", 2000); }
  });

  document.getElementById("btn-ml-fb-refresh")?.addEventListener("click", _refreshMLFeedback);

  document.getElementById("btn-ml-ds-capture")?.addEventListener("click", async () => {
    try {
      const r = await fetch(`${_mlEndpoint}/datasets/capture`, { method: "POST", signal: AbortSignal.timeout(10000) });
      if (r.ok) {
        showToast(lang === "ru" ? "Датасет захвачен" : "Dataset captured", "success", 2000);
        await _refreshMLDatasets();
        const m = document.getElementById("main-content");
        if (m && currentPage === "ml") { m.innerHTML = renderML(); bindMLEvents(); }
      }
    } catch { showToast("Error", "error", 2000); }
  });

  document.getElementById("btn-ml-ds-refresh")?.addEventListener("click", async () => {
    await _refreshMLDatasets();
    const m = document.getElementById("main-content");
    if (m && currentPage === "ml") { m.innerHTML = renderML(); bindMLEvents(); }
  });

  _refreshMLModelInfo();
  _refreshMLFeedback();
  _refreshMLDatasets();
}

async function _refreshMLModelInfo(): Promise<void> {
  try {
    const r = await fetch(`${_mlEndpoint}/models/status`, { signal: AbortSignal.timeout(3000) });
    if (r.ok) {
      const j = await r.json() as { stats?: { accuracy?: number; parameters?: number; samples?: number; model?: string } };
      if (j.stats) {
        _mlModelInfo = {
          accuracy: j.stats.accuracy ?? 0,
          parameters: j.stats.parameters ?? 0,
          samples: j.stats.samples ?? 0,
          engine: j.stats.model ?? "unknown",
        };
      }
    }
  } catch { /**/ }
}

async function _refreshMLFeedback(): Promise<void> {
  try {
    const r = await fetch(`${_mlEndpoint}/feedback/stats`, { signal: AbortSignal.timeout(3000) });
    if (r.ok) {
      _mlFeedbackStats = await r.json();
    }
  } catch { /**/ }
}

async function _refreshMLDatasets(): Promise<void> {
  try {
    const r = await fetch(`${_mlEndpoint}/datasets`, { signal: AbortSignal.timeout(3000) });
    if (r.ok) {
      const j = await r.json() as { datasets: typeof _mlDatasets };
      _mlDatasets = j.datasets || [];
    }
  } catch { /**/ }
}

function showProfileModal(): void {
  const ov = document.createElement("div");
  ov.className = "modal-overlay";
  ov.innerHTML = `<div class="modal"><h3>${t("addProfile")}</h3>
    <div class="modal-field"><label>${t("profileName")}</label><input type="text" id="modal-name"/></div>
    <div class="modal-field"><label>${t("profileKey")}</label><textarea id="modal-key" rows="3"></textarea></div>
    <div class="modal-actions"><button class="btn-cancel" id="modal-cancel">${t("cancel")}</button><button class="btn-save" id="modal-save">${t("save")}</button></div>
  </div>`;
  document.body.appendChild(ov);
  ov.addEventListener("click", e => { if (e.target === ov) ov.remove(); });
  document.getElementById("modal-cancel")?.addEventListener("click", () => ov.remove());
  document.getElementById("modal-save")?.addEventListener("click", () => {
    const name = (document.getElementById("modal-name") as HTMLInputElement).value.trim();
    const key = (document.getElementById("modal-key") as HTMLTextAreaElement).value.trim();
    if (!name || !key) return;
    profiles.push({ id: Date.now().toString(), name, key });
    saveProfiles(); ov.remove(); renderPage();
  });
}

function esc(s: string): string { return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;"); }

/* ===================== INIT ===================== */
window.addEventListener("DOMContentLoaded", async () => {
  loadLang(); loadProfiles();
  _mlTargetServer = localStorage.getItem("ml_target_server") ?? "";
  _mlToken = localStorage.getItem("ml_token") ?? "";
  await loadSettings();
  await loadSubscriptions();
  await loadRoutingRules();
  await loadBlocklist();
  await checkStatus();
  try { _mlBinaryExists = await invoke<boolean>("ml_binary_exists"); } catch { /**/ }
  try { _mlStatus = await invoke<boolean>("get_ml_status"); } catch { /**/ }
  renderShell();
  checkSites(); fetchIpInfo(); fetchSysInfo();
  startSubAutoCheck();
  setInterval(() => { if (isConnected && connectTime) tickUptime(); }, 1000);

  // silent periodic status check — no re-render unless status changed
  setInterval(async () => {
    const prev = isConnected;
    await checkStatus();
    if (prev !== isConnected) updateHome();
  }, 10000);
});
