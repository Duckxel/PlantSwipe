/* eslint-disable @typescript-eslint/ban-ts-comment */
// @ts-nocheck

type EnvWithAdminToken = { __ENV__?: { VITE_ADMIN_STATIC_TOKEN?: string } };
import React from "react";
import { createPortal } from "react-dom";
import { useLocation } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { LazyCharts, ChartSuspense } from "@/components/admin/LazyChart";
import { AdminUploadMediaPanel } from "@/components/admin/AdminUploadMediaPanel";
import { AdminNotificationsPanel } from "@/components/admin/AdminNotificationsPanel";
import { AdminEmailsPanel } from "@/components/admin/AdminEmailsPanel";
import { AdminAdvancedPanel } from "@/components/admin/AdminAdvancedPanel";
import { AdminStocksPanel } from "@/components/admin/AdminStocksPanel";
import { AdminReportsPanel } from "@/components/admin/AdminReportsPanel";
import { AdminBugsPanel } from "@/components/admin/AdminBugsPanel";
import { AdminPlantReportsPanel } from "@/components/admin/AdminPlantReportsPanel";
import { AdminUserMessagesDialog } from "@/components/admin/AdminUserMessagesDialog";
import { useTheme } from "@/context/ThemeContext";
import { useAuth } from "@/context/AuthContext";
import { getAccentOption, type AccentKey } from "@/lib/accent";
import { Link } from "@/components/i18n/Link";
import { useLanguageNavigate } from "@/lib/i18nRouting";
// Re-export for convenience
import {
  RefreshCw,
  Server,
  Database,
  Github,
  ExternalLink,
  ShieldCheck,
  ShieldX,
  UserSearch,
  AlertTriangle,
  AlertCircle,
  Gavel,
  Search,
  ChevronDown,
  ChevronUp,
  GitBranch,
  Trash2,
  EyeOff,
  Copy,
  ArrowUpRight,
  Info,
  Plus,
  LayoutDashboard,
  ChevronLeft,
  ChevronRight,
  Users,
  ScrollText,
  Mail,
  CloudUpload,
  Check,
  BellRing,
  Leaf,
  BarChart3,
  PieChart as PieChartIcon,
  Target,
  Calendar,
  Sprout,
  TrendingUp,
  Package,
  Sparkles,
  Clock,
  Wifi,
  Crown,
  Pencil,
  Shield,
  Store,
  ShieldAlert,
  Ban,
  X,
  Image,
  CircleCheck,
  Loader2,
  Square,
  FolderOpen,
  HardDrive,
  ArrowRight,
  FileImage,
  FileText,
  MessageSquare as MessageSquareIcon,
  MessageSquareText,
  BookOpen,
  Flower2,
  Bug,
  Zap,
  Trophy,
  CheckCircle2,
} from "lucide-react";
import { SearchInput } from "@/components/ui/search-input";
import { supabase } from "@/lib/supabaseClient";
import { cn } from "@/lib/utils";
import { setUserThreatLevel, getReportCounts } from "@/lib/moderation";
import { type ThreatLevel } from "@/types/moderation";
import {
  loadPersistedBroadcast,
  savePersistedBroadcast,
  type BroadcastRecord,
} from "@/lib/broadcastStorage";
import { processAllPlantRequests } from "@/lib/aiPrefillService";
import { IMAGE_SOURCES, type SourceResult, type ExternalImageSource } from "@/lib/externalImages";
import { getEnglishPlantName } from "@/lib/aiPlantFill";
import { Languages } from "lucide-react";
import { 
  buildCategoryProgress, 
  createEmptyCategoryProgress, 
  plantFormCategoryOrder, 
  mapFieldToCategory,
  type CategoryProgress, 
  type PlantFormCategory 
} from "@/lib/plantFormCategories";
import { enableMaintenanceMode as enableFrontendMaintenanceMode, disableMaintenanceMode as disableFrontendMaintenanceMode } from "@/lib/sentry";
import { fetchAllImpressions } from "@/lib/impressions";

/**
 * Enable maintenance mode on both frontend (browser Sentry) and backend (server Sentry)
 * This ensures 502/503/504 errors during service restarts are suppressed everywhere
 */
async function enableMaintenanceMode(durationMs: number = 300000, reason: string = 'admin-operation'): Promise<void> {
  // Enable frontend maintenance mode immediately (affects browser Sentry)
  enableFrontendMaintenanceMode(durationMs);
  
  // Also enable backend maintenance mode via API (affects server Sentry)
  try {
    const adminToken = (globalThis as { __ENV__?: { VITE_ADMIN_STATIC_TOKEN?: string } })?.__ENV__?.VITE_ADMIN_STATIC_TOKEN;
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    };
    if (adminToken) {
      headers['X-Admin-Token'] = String(adminToken);
    }
    
    await fetch('/api/admin/maintenance-mode/enable', {
      method: 'POST',
      headers,
      credentials: 'same-origin',
      body: JSON.stringify({ durationMs, reason }),
    }).catch(() => {
      // Best effort - if server is down, that's expected during maintenance
      console.log('[MaintenanceMode] Could not reach server to enable maintenance mode (expected during restart)');
    });
  } catch {
    // Silently ignore - server might be down which is expected
  }
}

/**
 * Disable maintenance mode on both frontend and backend
 */
async function disableMaintenanceMode(): Promise<void> {
  // Disable frontend maintenance mode
  disableFrontendMaintenanceMode();
  
  // Also disable backend maintenance mode via API
  try {
    const adminToken = (globalThis as { __ENV__?: { VITE_ADMIN_STATIC_TOKEN?: string } })?.__ENV__?.VITE_ADMIN_STATIC_TOKEN;
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    };
    if (adminToken) {
      headers['X-Admin-Token'] = String(adminToken);
    }
    
    await fetch('/api/admin/maintenance-mode/disable', {
      method: 'POST',
      headers,
      credentials: 'same-origin',
      body: '{}',
    }).catch(() => {
      // Best effort - server might still be coming up
      console.log('[MaintenanceMode] Could not reach server to disable maintenance mode');
    });
  } catch {
    // Silently ignore
  }
}
import {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";
const {
  ResponsiveContainer,
  ComposedChart,
  Line,
  Area,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  ReferenceLine,
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  RadialBarChart,
  RadialBar,
  PolarAngleAxis,
} = LazyCharts;

// Helper to check if an error is a cancellation/abort error (should not be logged to Sentry)
function isCancellationError(err: unknown): boolean {
  if (err instanceof DOMException && err.name === 'AbortError') return true
  if (typeof err === 'object' && err !== null && 'name' in err && (err as { name: string }).name === 'AbortError') return true
  if (typeof err === 'string') {
    const lower = err.toLowerCase()
    return lower.includes('cancel') || lower.includes('abort')
  }
  if (err instanceof Error) {
    const lower = err.message.toLowerCase()
    return lower.includes('cancel') || lower.includes('abort')
  }
  return false
}

type AdminTab =
  | "overview"
  | "members"
  | "plants"
  | "bugs"
  | "stocks"
  | "upload"
  | "notifications"
  | "emails"
  | "admin_logs";

type ListedMember = {
  id: string;
  email: string | null;
  displayName: string | null;
  createdAt: string | null;
  isAdmin: boolean;
  roles: string[];
  rpm5m: number | null;
};

type MemberListSort = "newest" | "oldest" | "rpm" | "role";

type RoleStats = {
  totalMembers: number;
  roleCounts: Record<string, number>;
};

const MEMBER_LIST_PAGE_SIZE = 20;

const THREAT_LEVEL_META: Record<number, { 
  label: string; 
  badge: string; 
  text: string;
  cardBg: string;
  cardBorder: string;
  iconColor: string;
}> = {
  0: {
    label: "Safe",
    badge: "bg-emerald-100 text-emerald-700 border border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-200 dark:border-emerald-800",
    text: "User is in good standing with no incidents.",
    cardBg: "bg-emerald-50 dark:bg-emerald-950/30",
    cardBorder: "border-emerald-300 dark:border-emerald-700",
    iconColor: "text-emerald-600 dark:text-emerald-400",
  },
  1: {
    label: "Suspicious",
    badge: "bg-amber-100 text-amber-700 border border-amber-200 dark:bg-amber-900/30 dark:text-amber-200 dark:border-amber-800",
    text: "User has had minor incidents. Monitor activity.",
    cardBg: "bg-amber-50 dark:bg-amber-950/30",
    cardBorder: "border-amber-300 dark:border-amber-700",
    iconColor: "text-amber-600 dark:text-amber-400",
  },
  2: {
    label: "Danger",
    badge: "bg-red-100 text-red-700 border border-red-200 dark:bg-red-900/30 dark:text-red-200 dark:border-red-800",
    text: "High risk user with multiple incidents. Consider restrictions.",
    cardBg: "bg-red-50 dark:bg-red-950/30",
    cardBorder: "border-red-300 dark:border-red-700",
    iconColor: "text-red-600 dark:text-red-400",
  },
  3: {
    label: "Banned",
    badge: "bg-black text-white border border-black/60 dark:bg-black dark:text-white",
    text: "User is permanently banned from the platform.",
    cardBg: "bg-stone-900 dark:bg-black",
    cardBorder: "border-stone-800 dark:border-stone-700",
    iconColor: "text-white",
  },
};

type RequestViewMode = "requests" | "plants" | "reports";
type NormalizedPlantStatus =
  | "in progres"
  | "review"
  | "rework"
  | "approved"
  | "other";
const REQUEST_VIEW_TABS: Array<{ key: RequestViewMode; label: string }> = [
  { key: "plants", label: "Plants" },
  { key: "requests", label: "Requests" },
  { key: "reports", label: "Reports" },
];

const PLANT_STATUS_LABELS: Record<NormalizedPlantStatus, string> = {
  "in progres": "In Progress",
  review: "Review",
  rework: "Rework",
  approved: "Approved",
  other: "Other",
};

import {
  ADMIN_STATUS_COLORS,
  ADMIN_STATUS_BADGE_CLASSES,
  ADMIN_STATUS_BUTTON_SELECTED_CLASSES,
} from "@/constants/plantStatus";
import {
  USER_ROLES,
  ADMIN_ASSIGNABLE_ROLES,
  ROLE_CONFIG,
  type UserRole,
  checkFullAdminAccess,
} from "@/constants/userRoles";
import { UserRoleBadge, ProfileNameBadges } from "@/components/profile/UserRoleBadges";

const PLANT_STATUS_COLORS: Record<NormalizedPlantStatus, string> = ADMIN_STATUS_COLORS;

const PLANT_STATUS_BADGE_CLASSES: Record<NormalizedPlantStatus, string> = ADMIN_STATUS_BADGE_CLASSES;

const PLANT_STATUS_BUTTON_SELECTED_CLASSES: Record<NormalizedPlantStatus, string> = ADMIN_STATUS_BUTTON_SELECTED_CLASSES;

const PLANT_STATUS_KEYS: NormalizedPlantStatus[] = [
  "approved",
  "rework",
  "review",
  "in progres",
  "other",
];

const DEFAULT_VISIBLE_PLANT_STATUSES: NormalizedPlantStatus[] =
  PLANT_STATUS_KEYS.filter((status) => status !== "approved");

const PLANT_STATUS_FILTER_OPTIONS = PLANT_STATUS_KEYS.map((status) => ({
  value: status,
  label: PLANT_STATUS_LABELS[status],
}));

const PRIORITIZED_STATUS_ORDER: Partial<Record<NormalizedPlantStatus, number>> =
  {
    approved: 0,
    rework: 1,
    review: 2,
    "in progres": 3,
  };
const FALLBACK_STATUS_ORDER = PLANT_STATUS_KEYS.filter(
  (status) => PRIORITIZED_STATUS_ORDER[status] === undefined,
)
  .sort((a, b) =>
    PLANT_STATUS_LABELS[a].localeCompare(PLANT_STATUS_LABELS[b]),
  )
  .reduce<Record<NormalizedPlantStatus, number>>((acc, status, index) => {
    acc[status] = 10 + index;
    return acc;
  }, {} as Record<NormalizedPlantStatus, number>);
const getStatusSortPriority = (status: NormalizedPlantStatus): number => {
  if (PRIORITIZED_STATUS_ORDER[status] !== undefined) {
    return PRIORITIZED_STATUS_ORDER[status]!;
  }
  return FALLBACK_STATUS_ORDER[status] ?? 99;
};

const STATUS_DONUT_SEGMENTS: NormalizedPlantStatus[] = [
  "approved",
  "rework",
  "review",
  "in progres",
  "other",
];

const PROMOTION_MONTH_SLUGS = [
  "january",
  "february",
  "march",
  "april",
  "may",
  "june",
  "july",
  "august",
  "september",
  "october",
  "november",
  "december",
] as const;

type PromotionMonthSlug = (typeof PROMOTION_MONTH_SLUGS)[number];

const PROMOTION_MONTH_LABELS: Record<PromotionMonthSlug, string> = {
  january: "Jan",
  february: "Feb",
  march: "Mar",
  april: "Apr",
  may: "May",
  june: "Jun",
  july: "Jul",
  august: "Aug",
  september: "Sep",
  october: "Oct",
  november: "Nov",
  december: "Dec",
};

type PlantDashboardRow = {
  id: string;
  name: string;
  givenNames: string[];
  status: NormalizedPlantStatus;
  promotionMonth: PromotionMonthSlug | null;
  primaryImage: string | null;
  updatedAt: number | null;
  createdAt: number | null;
  gardensCount: number;
  likesCount: number;
  viewsCount: number;
  imagesCount: number;
};

type PlantSortOption = "status" | "updated" | "created" | "name" | "gardens" | "likes" | "views" | "images";

const normalizePlantStatus = (
  status?: unknown,
): NormalizedPlantStatus => {
  if (!status || typeof status !== 'string') return "other";
  const normalized = status.toLowerCase();
  if (normalized === "in progres" || normalized === "in progress" || normalized === "in_progress") {
    return "in progres";
  }
  if (normalized === "review") return "review";
  if (normalized === "rework") return "rework";
  if (normalized === "approved") return "approved";
  return "other";
};

/** Map normalized UI status back to the DB column value */
const normalizedStatusToDb: Record<NormalizedPlantStatus, string> = {
  "in progres": "in_progress",
  review: "review",
  rework: "rework",
  approved: "approved",
  other: "other",
};

const toPromotionMonthSlug = (
  value?: unknown,
): PromotionMonthSlug | null => {
  if (!value || typeof value !== 'string') return null;
  const normalized = value.toLowerCase() as PromotionMonthSlug;
  return (PROMOTION_MONTH_SLUGS as readonly string[]).includes(normalized)
    ? normalized
    : null;
};

// Constants for persisting admin plants list state in sessionStorage
const ADMIN_PLANTS_STATE_KEY = "admin-plants-list-state";
const VALID_SORT_OPTIONS: PlantSortOption[] = ["status", "updated", "created", "name", "gardens", "likes", "views", "images"];

// Type for persisted plant list state
type AdminPlantsListState = {
  searchQuery: string;
  sortOption: PlantSortOption;
  promotionMonth: PromotionMonthSlug | "none" | "all";
  statuses: NormalizedPlantStatus[];
  scrollPosition: number;
};

// Load persisted state from sessionStorage
const loadAdminPlantsState = (): Partial<AdminPlantsListState> => {
  try {
    const saved = sessionStorage.getItem(ADMIN_PLANTS_STATE_KEY);
    if (!saved) return {};
    const parsed = JSON.parse(saved);
    
    // Validate and sanitize the loaded state
    const result: Partial<AdminPlantsListState> = {};
    
    if (typeof parsed.searchQuery === "string") {
      result.searchQuery = parsed.searchQuery;
    }
    
    if (parsed.sortOption && VALID_SORT_OPTIONS.includes(parsed.sortOption)) {
      result.sortOption = parsed.sortOption;
    }
    
    if (parsed.promotionMonth === "all" || parsed.promotionMonth === "none" || 
        (PROMOTION_MONTH_SLUGS as readonly string[]).includes(parsed.promotionMonth)) {
      result.promotionMonth = parsed.promotionMonth;
    }
    
    if (Array.isArray(parsed.statuses)) {
      const validStatuses = parsed.statuses.filter((s: string) =>
        PLANT_STATUS_KEYS.includes(s as NormalizedPlantStatus)
      ) as NormalizedPlantStatus[];
      if (validStatuses.length > 0) {
        result.statuses = validStatuses;
      }
    }
    
    if (typeof parsed.scrollPosition === "number" && parsed.scrollPosition >= 0) {
      result.scrollPosition = parsed.scrollPosition;
    }
    
    return result;
  } catch {
    return {};
  }
};

// Save state to sessionStorage
const saveAdminPlantsState = (state: AdminPlantsListState): void => {
  try {
    sessionStorage.setItem(ADMIN_PLANTS_STATE_KEY, JSON.stringify(state));
  } catch {
    // Ignore storage errors
  }
};

export const AdminPage: React.FC = () => {
  const navigate = useLanguageNavigate();
  const location = useLocation();
  const currentPath = location.pathname;
  const { effectiveTheme } = useTheme();
  const { user, profile } = useAuth();
  const isDark = effectiveTheme === "dark";

  // Get user's accent color (more subtle version)
  const accentColor = React.useMemo(() => {
    const accentKey = (profile as { accent_key?: string })?.accent_key || "emerald";
    const accentOption = getAccentOption(accentKey as AccentKey);
    if (!accentOption) return "hsl(142 72% 40%)";
    // Parse HSL and make it lighter/more subtle
    const hslMatch = accentOption.hsl.match(/(\d+)\s+(\d+)%\s+(\d+)%/);
    if (hslMatch) {
      const [, h, s, l] = hslMatch;
      // Reduce saturation by 20% and increase lightness by 15% for subtlety
      const newS = Math.max(30, parseInt(s) - 20);
      const newL = Math.min(60, parseInt(l) + 15);
      return `hsl(${h} ${newS}% ${newL}%)`;
    }
    return `hsl(${accentOption.hsl})`;
  }, [profile]);

  // Get accent color with opacity for shadows
  const accentColorWithOpacity = React.useMemo(() => {
    const accentKey = (profile as { accent_key?: string })?.accent_key || "emerald";
    const accentOption = getAccentOption(accentKey as AccentKey);
    if (!accentOption) return "hsl(142 72% 40% / 0.2)";
    const hslMatch = accentOption.hsl.match(/(\d+)\s+(\d+)%\s+(\d+)%/);
    if (hslMatch) {
      const [, h, s, l] = hslMatch;
      const newS = Math.max(30, parseInt(s) - 20);
      const newL = Math.min(60, parseInt(l) + 15);
      return `hsl(${h} ${newS}% ${newL}% / 0.15)`;
    }
    return `hsl(${accentOption.hsl} / 0.2)`;
  }, [profile]);
  const mobileNavPanelClass =
    "rounded-[24px] border border-stone-200/70 dark:border-[#3e3e42]/70 bg-white/95 dark:bg-[#16161a]/95 backdrop-blur shadow-[0_18px_45px_-25px_rgba(15,23,42,0.45)]";
  const glassCardClass =
    "rounded-[20px] border border-stone-200/70 dark:border-[#3e3e42]/70 bg-white/92 dark:bg-[#1a1a1d]/92 backdrop-blur";
  const sidebarHeroClass =
    "relative flex flex-col flex-1 rounded-[32px] border border-stone-200 dark:border-[#3e3e42] bg-gradient-to-br from-emerald-50 via-white to-stone-100 dark:from-[#252526] dark:via-[#1e1e1e] dark:to-[#171717] shadow-[0_35px_60px_-20px_rgba(16,185,129,0.35)]";
  const shortenMiddle = React.useCallback(
    (value: string, maxChars: number = 28): string => {
      try {
        const s = String(value || "");
        if (s.length <= maxChars) return s;
        const keep = Math.max(3, Math.floor((maxChars - 3) / 2));
        const left = s.slice(0, keep);
        const right = s.slice(-keep);
        return `${left}...${right}`;
      } catch {
        return value;
      }
    },
    [],
  );

  // Format last update time for display
  const formatLastUpdateTime = React.useCallback(
    (timeStr: string | null): string => {
      if (!timeStr) return "";
      try {
        const date = new Date(timeStr);
        if (isNaN(date.getTime())) return "";
        const now = new Date();
        const diffMs = now.getTime() - date.getTime();
        const diffHours = diffMs / (1000 * 60 * 60);
        const diffDays = diffMs / (1000 * 60 * 60 * 24);

        if (diffHours < 1) {
          const diffMins = Math.floor(diffMs / (1000 * 60));
          return diffMins < 1 ? "just now" : `${diffMins}m ago`;
        }
        if (diffHours < 24) {
          const hours = Math.floor(diffHours);
          return `${hours}h ago`;
        }
        if (diffDays < 7) {
          const days = Math.floor(diffDays);
          return `${days}d ago`;
        }
        return date.toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
          year: "numeric",
        });
      } catch {
        return "";
      }
    },
    [],
  );

  const formatMemberJoinDate = React.useCallback(
    (value?: string | null): string => {
      if (!value) return "-";
      try {
        const date = new Date(value);
        if (Number.isNaN(date.getTime())) return value;
        return date.toLocaleString();
      } catch {
        return String(value);
      }
    },
    [],
  );

  const formatRpmValue = React.useCallback((value?: number | null): string => {
    if (typeof value === "number" && Number.isFinite(value)) {
      return value.toFixed(2);
    }
    return "0.00";
  }, []);

  // Compute a responsive max character count for branch names based on viewport width
  const computeBranchMaxChars = React.useCallback(
    (viewportWidth: number): number => {
      const w = Math.max(0, viewportWidth || 0);
      if (w < 340) return 18;
      if (w < 380) return 22;
      if (w < 420) return 26;
      if (w < 640) return 32;
      if (w < 768) return 42;
      if (w < 1024) return 56;
      return 64;
    },
    [],
  );

  const [branchMaxChars, setBranchMaxChars] = React.useState<number>(() =>
    typeof window !== "undefined"
      ? computeBranchMaxChars(window.innerWidth)
      : 56,
  );

  React.useEffect(() => {
    const onResize = () =>
      setBranchMaxChars(computeBranchMaxChars(window.innerWidth));
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [computeBranchMaxChars]);
  const countryCodeToName = React.useCallback((code: string): string => {
    try {
      const c = String(code || "").toUpperCase();
      if (!c) return "";
      /* eslint-disable-next-line @typescript-eslint/no-explicit-any -- Intl.DisplayNames may not exist in all environments */
      if ((Intl as any)?.DisplayNames) {
        try {
          /* eslint-disable-next-line @typescript-eslint/no-explicit-any -- Intl.DisplayNames constructor */
          const dn = new (Intl as any).DisplayNames(
            [navigator.language || "en"],
            { type: "region" },
          );
          const name = dn.of(c);
          return name || c;
        } catch {}
      }
      return c;
    } catch {
      return code;
    }
  }, []);

  const [syncing, setSyncing] = React.useState(false);
  const [deployingEdge, setDeployingEdge] = React.useState(false);

  // Backup disabled for now

  const [restarting, setRestarting] = React.useState(false);
  const [pulling, setPulling] = React.useState(false);
  const [consoleOpen, setConsoleOpen] = React.useState<boolean>(false);
  const [consoleLines, setConsoleLines] = React.useState<string[]>([]);
  const [reloadReady, setReloadReady] = React.useState<boolean>(false);
  const [preRestartNotice, setPreRestartNotice] =
    React.useState<boolean>(false);
  // Default collapsed on load; will auto-open only if an active broadcast exists
  const [broadcastOpen, setBroadcastOpen] = React.useState<boolean>(false);
  // Server Controls - collapsed by default
  const [serverControlsOpen, setServerControlsOpen] = React.useState<boolean>(false);
  const [setupPassword, setSetupPassword] = React.useState<string>("");
  const [runningSetup, setRunningSetup] = React.useState<boolean>(false);
  const [clearingMemory, setClearingMemory] = React.useState<boolean>(false);
  const [gitPulling, setGitPulling] = React.useState<boolean>(false);
  const [regeneratingSitemap, setRegeneratingSitemap] = React.useState<boolean>(false);
  const [sitemapInfo, setSitemapInfo] = React.useState<{
    exists: boolean;
    lastModified?: string;
    size?: number;
    urlCount?: number | null;
    message?: string;
  } | null>(null);
  // On initial load, if a broadcast is currently active, auto-open the section
  React.useEffect(() => {
    let cancelled = false;
    const checkActiveBroadcast = async () => {
      const persisted = loadPersistedBroadcast();
      if (!cancelled && persisted) {
        setBroadcastOpen(true);
      }
      try {
        const r = await fetch("/api/broadcast/active", {
          headers: { Accept: "application/json" },
          credentials: "same-origin",
        });
        if (!cancelled && r.ok) {
          const data = await r.json().catch(() => ({}));
          if (data?.broadcast) setBroadcastOpen(true);
        }
      } catch {}
    };
    checkActiveBroadcast();
    return () => {
      cancelled = true;
    };
  }, []);

  // Even when collapsed, poll for broadcast state to auto-open when a broadcast starts
  React.useEffect(() => {
    let cancelled = false;
    const poll = async () => {
      try {
        const r = await fetch("/api/broadcast/active", {
          headers: { Accept: "application/json" },
          credentials: "same-origin",
        });
        if (!cancelled && r.ok) {
          const data = await r.json().catch(() => ({}));
          if (data?.broadcast) setBroadcastOpen(true);
        }
      } catch {}
    };
    const id = window.setInterval(poll, 60000);
    poll();
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, []);
  const consoleRef = React.useRef<HTMLDivElement | null>(null);
  React.useEffect(() => {
    if (!consoleOpen) return;
    const el = consoleRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [consoleLines, consoleOpen]);

  const copyTextToClipboard = React.useCallback(
    async (text: string): Promise<boolean> => {
      try {
        if (
          navigator &&
          navigator.clipboard &&
          typeof navigator.clipboard.writeText === "function"
        ) {
          await navigator.clipboard.writeText(text);
          return true;
        }
      } catch {}
      try {
        const ta = document.createElement("textarea");
        ta.value = text;
        ta.style.position = "fixed";
        ta.style.opacity = "0";
        document.body.appendChild(ta);
        ta.focus();
        ta.select();
        const ok = document.execCommand("copy");
        document.body.removeChild(ta);
        return ok;
      } catch {
        return false;
      }
    },
    [],
  );

  const memberListSortOptions = React.useMemo(
    () =>
      [
        { value: "newest", label: "New" },
        { value: "oldest", label: "Oldest" },
        { value: "rpm", label: "RPM (5m)" },
        { value: "role", label: "Role" },
      ] as Array<{ value: MemberListSort; label: string }>,
    [],
  );

  // Heuristic to mark the console as error. Keep strict to avoid false positives
  // from JSON keys like "error" or benign words. Prefer lines that clearly
  // signal errors (severity prefixes) and common failure words.
  // Exclude warnings (⚠) and lines starting with [sync] ⚠ from being treated as errors
  const errorLineRx = React.useMemo(() => {
    // Match error patterns, but exclude warning lines
    return (line: string) => {
      // Skip lines that are clearly warnings
      if (/^\s*\[.*\]\s*⚠|⚠|WARNING:/i.test(line)) {
        return false;
      }
      // Match actual error patterns
      return /(^\s*\[?(ERROR|FATAL)\]?|^\s*(error:|fatal:)|npm\s+ERR!|^\s*✗|^\s*\[.*\]\s*✗)/i.test(
        line,
      );
    };
  }, []);

  const getAllLogsText = React.useCallback((): string => {
    return consoleLines.join("\n");
  }, [consoleLines]);

  const hasConsoleError = React.useMemo(
    () => consoleLines.some((l) => errorLineRx(l)),
    [consoleLines, errorLineRx],
  );

  const appendConsole = React.useCallback((line: string) => {
    setConsoleLines((prev) => [...prev, line]);
  }, []);

  const reloadPage = React.useCallback(() => {
    try {
      window.location.reload();
    } catch {}
  }, []);

  // Helper function to retry API calls with exponential backoff
  const fetchWithRetry = React.useCallback(
    async (
      url: string,
      options: RequestInit = {},
      maxRetries: number = 3,
    ): Promise<Response> => {
      let lastError: Error | null = null;

      for (let attempt = 0; attempt <= maxRetries; attempt++) {
        try {
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 30000); // 30s timeout per attempt

          try {
            const response = await fetch(url, {
              ...options,
              signal: controller.signal,
            });
            clearTimeout(timeoutId);

            // If successful or client error (4xx), return immediately
            if (
              response.ok ||
              (response.status >= 400 && response.status < 500)
            ) {
              return response;
            }

            // Server error (5xx) - retry
            if (response.status >= 500 && attempt < maxRetries) {
              const delay = Math.min(1000 * Math.pow(2, attempt), 10000); // Exponential backoff, max 10s
              await new Promise((resolve) => setTimeout(resolve, delay));
              continue;
            }

            return response;
          } catch (fetchError: unknown) {
            clearTimeout(timeoutId);
            throw fetchError;
          }
        } catch (error: unknown) {
          lastError = error instanceof Error ? error : new Error(String(error));
          const err = error instanceof Error ? error : { name: "", message: String(error) };

          // Network error or timeout - retry
          if (
            attempt < maxRetries &&
            (err.name === "AbortError" ||
              err.name === "TypeError" ||
              err.message?.includes("fetch") ||
              !err.message?.includes("4"))
          ) {
            const delay = Math.min(1000 * Math.pow(2, attempt), 10000);
            await new Promise((resolve) => setTimeout(resolve, delay));
            continue;
          }

          throw error;
        }
      }

      throw lastError || new Error("Request failed after retries");
    },
    [],
  );

  // Safely parse response body into JSON, tolerating HTML/error pages
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- dynamic JSON response
  const safeJson = React.useCallback(async (resp: Response): Promise<any> => {
    try {
      const contentType = (
        resp.headers.get("content-type") || ""
      ).toLowerCase();
      const text = await resp.text().catch(() => "");
      if (
        contentType.includes("application/json") ||
        /^[\s\n]*[[{]/.test(text)
      ) {
        try {
          return JSON.parse(text);
        } catch {
          return {};
        }
      }
      return {};
    } catch {
      return {};
    }
  }, []);

  const runSyncSchema = async () => {
    if (syncing) return;
    setSyncing(true);
    try {
      setConsoleOpen(true);
      appendConsole("[sync] Sync DB Schema: starting...");
      const session = (await supabase.auth.getSession()).data.session;
      const token = session?.access_token || null;
      const adminToken = (globalThis as EnvWithAdminToken)?.__ENV__?.VITE_ADMIN_STATIC_TOKEN;
      if (!token && !adminToken) {
        appendConsole(
          "[sync] Unable to locate credentials for schema sync. Sign in as an admin or configure VITE_ADMIN_STATIC_TOKEN.",
        );
        return;
      }
      // Try Node API first
      let resp = await fetchWithRetry("/api/admin/sync-schema", {
        method: "GET",
        headers: (() => {
          const h: Record<string, string> = { Accept: "application/json" };
          if (token) h["Authorization"] = `Bearer ${token}`;
          if (adminToken) h["X-Admin-Token"] = String(adminToken);
          return h;
        })(),
        credentials: "same-origin",
      }).catch(() => null);
      if (!resp || resp.status === 405) {
        // Try POST on Node if GET blocked or failed
        resp = await fetchWithRetry("/api/admin/sync-schema", {
          method: "POST",
          headers: (() => {
            const h: Record<string, string> = {
              "Content-Type": "application/json",
              Accept: "application/json",
            };
            if (token) h["Authorization"] = `Bearer ${token}`;
            if (adminToken) h["X-Admin-Token"] = String(adminToken);
            return h;
          })(),
          credentials: "same-origin",
          body: "{}",
        }).catch(() => null);
      }
      // If Node API failed, fallback to local Admin API proxied by nginx
      if (!resp || !resp.ok) {
        const adminHeaders: Record<string, string> = {
          Accept: "application/json",
        };
        try {
          if (adminToken) adminHeaders["X-Admin-Token"] = String(adminToken);
        } catch {}
        let respAdmin = await fetchWithRetry("/admin/sync-schema", {
          method: "GET",
          headers: adminHeaders,
          credentials: "same-origin",
        }).catch(() => null);
        if (!respAdmin || respAdmin.status === 405) {
          respAdmin = await fetchWithRetry("/admin/sync-schema", {
            method: "POST",
            headers: { ...adminHeaders, "Content-Type": "application/json" },
            credentials: "same-origin",
            body: "{}",
          }).catch(() => null);
        }
        resp = respAdmin || resp;
      }
      if (!resp) {
        throw new Error(
          "Failed to connect to API. Please check your connection and try again.",
        );
      }
      const body = await safeJson(resp);
      if (!resp.ok) {
        // Display file-by-file results if available (new format)
        if (body?.results && Array.isArray(body.results)) {
          appendConsole(`[sync] Executing ${body.totalFiles || body.results.length} SQL files...`);
          appendConsole("[sync] ─────────────────────────────────────");
          
          body.results.forEach((result: { file: string; status: string; duration: string; error?: string; detail?: string; hint?: string }) => {
            if (result.status === 'success') {
              appendConsole(`[sync] ✓ ${result.file} (${result.duration})`);
            } else {
              appendConsole(`[sync] ✗ ${result.file} FAILED (${result.duration})`);
              if (result.error) {
                appendConsole(`[sync]   Error: ${result.error}`);
              }
              if (result.detail) {
                appendConsole(`[sync]   Detail: ${result.detail}`);
              }
              if (result.hint) {
                appendConsole(`[sync]   Hint: ${result.hint}`);
              }
            }
          });
          
          appendConsole("[sync] ─────────────────────────────────────");
          const successCount = body.successCount ?? 0;
          const errorCount = body.errorCount ?? 0;
          appendConsole(`[sync] ✗ Sync failed: ${successCount}/${body.totalFiles || body.results.length} files succeeded, ${errorCount} errors`);
        }
        
        // Legacy format handling
        if (body?.stdoutTail) {
          const lines = String(body.stdoutTail).split("\n").filter(Boolean);
          if (lines.length) {
            appendConsole("[sync] SQL stdout (tail):");
            lines
              .slice(-25)
              .forEach((line: string) => appendConsole(`[sync]   ${line}`));
          }
        }
        if (body?.stderr) {
          const lines = String(body.stderr).split("\n").filter(Boolean);
          if (lines.length) {
            appendConsole("[sync] SQL stderr:");
            lines
              .slice(-25)
              .forEach((line: string) => appendConsole(`[sync] ✗ ${line}`));
          }
        }
        if (body?.detail && !body?.results) {
          appendConsole(`[sync] Detail: ${String(body.detail)}`);
        }
        if (body?.path) {
          appendConsole(`[sync] Path: ${String(body.path)}`);
        }
        const parts: string[] = [];
        if (body?.error) parts.push(String(body.error));
        if (body?.detail && !body?.results) parts.push(String(body.detail));
        if (body?.stderr) parts.push(String(body.stderr));
        const msg =
          parts.length > 0
            ? parts.join(" | ")
            : `Request failed (${resp.status})`;
        throw new Error(msg);
      }
      // Display results from individual file execution
      if (body?.results && Array.isArray(body.results)) {
        appendConsole(`[sync] Executing ${body.totalFiles || body.results.length} SQL files...`);
        appendConsole("[sync] ─────────────────────────────────────");
        
        body.results.forEach((result: { file: string; status: string; duration: string; error?: string; detail?: string; hint?: string }) => {
          if (result.status === 'success') {
            appendConsole(`[sync] ✓ ${result.file} (${result.duration})`);
          } else {
            appendConsole(`[sync] ✗ ${result.file} FAILED (${result.duration})`);
            if (result.error) {
              appendConsole(`[sync]   Error: ${result.error}`);
            }
            if (result.detail) {
              appendConsole(`[sync]   Detail: ${result.detail}`);
            }
            if (result.hint) {
              appendConsole(`[sync]   Hint: ${result.hint}`);
            }
          }
        });
        
        appendConsole("[sync] ─────────────────────────────────────");
        
        const successCount = body.successCount ?? body.results.filter((r: { status: string }) => r.status === 'success').length;
        const errorCount = body.errorCount ?? body.results.filter((r: { status: string }) => r.status === 'error').length;
        
        if (errorCount > 0) {
          appendConsole(`[sync] ⚠ Completed with errors: ${successCount}/${body.totalFiles || body.results.length} files succeeded`);
        } else {
          appendConsole(`[sync] ✓ All ${successCount} files executed successfully`);
        }
      } else {
        // Fallback for old response format
        appendConsole("[sync] Schema synchronized successfully");
      }

      // Show SQL execution output if available (legacy format)
      if (body?.stdoutTail) {
        appendConsole("[sync] SQL execution output:");
        const outputLines = String(body.stdoutTail)
          .split("\n")
          .filter((l: string) => l.trim());
        let hasErrors = false;
        outputLines.forEach((line: string) => {
          const isError =
            /ERROR:|error:|failed|FAILED/i.test(line) && !/⚠/.test(line);
          if (isError) {
            hasErrors = true;
            appendConsole(`[sync] ✗ ERROR: ${line}`);
          } else if (/WARNING:|NOTICE:/i.test(line)) {
            appendConsole(`[sync] ⚠ ${line}`);
          } else {
            if (
              /CREATE|ALTER|DROP|SELECT|INSERT|UPDATE|DELETE|GRANT|REVOKE/i.test(
                line,
              )
            ) {
              appendConsole(`[sync]   ${line}`);
            }
          }
        });
        if (hasErrors) {
          appendConsole(
            "[sync] ✗ SQL execution encountered errors. Check the output above.",
          );
        }
      }

      // Show warnings array if available
      if (
        body?.warnings &&
        Array.isArray(body.warnings) &&
        body.warnings.length > 0
      ) {
        appendConsole("[sync] SQL execution warnings:");
        body.warnings.forEach((warning: string) => {
          appendConsole(`[sync] ⚠ ${warning}`);
        });
      }

      // Check for errors in stderr
      if (body?.stderr) {
        const stderrLines = String(body.stderr)
          .split("\n")
          .filter((l: string) => l.trim());
        if (stderrLines.length > 0) {
          appendConsole("[sync] SQL execution stderr output:");
          stderrLines.forEach((line: string) => {
            if (/ERROR:|error:/i.test(line)) {
              appendConsole(`[sync] ✗ ${line}`);
            } else {
              appendConsole(`[sync] ⚠ ${line}`);
            }
          });
        }
      }

      if (body?.summary) {
        try {
          const missingTables = Array.isArray(body.summary?.tables?.missing)
            ? body.summary.tables.missing
            : [];
          if (missingTables.length > 0) {
            appendConsole(
              `[sync] ⚠ Missing tables after sync: ${missingTables.join(", ")}`,
            );
          }
          const missingFunctions = Array.isArray(
            body.summary?.functions?.missing,
          )
            ? body.summary.functions.missing
            : [];
          if (missingFunctions.length > 0) {
            appendConsole(
              `[sync] ⚠ Missing functions after sync: ${missingFunctions.join(", ")}`,
            );
          }
          const missingExtensions = Array.isArray(
            body.summary?.extensions?.missing,
          )
            ? body.summary.extensions.missing
            : [];
          if (missingExtensions.length > 0) {
            appendConsole(
              `[sync] ⚠ Missing extensions after sync: ${missingExtensions.join(", ")}`,
            );
          }
        } catch {}
      }

      appendConsole("[sync] ✓ Database sync completed!");
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : String(e);
      appendConsole(`[sync] ✗ Failed to sync schema: ${message}`);
    } finally {
      setSyncing(false);
    }
  };

  const deployEdgeFunctions = async () => {
    if (deployingEdge) return
    setDeployingEdge(true)
    try {
      setConsoleOpen(true)
      appendConsole('[deploy] Supabase Edge Functions: starting...')
      const session = (await supabase.auth.getSession()).data.session
      const token = session?.access_token || null
      const adminToken = (globalThis as EnvWithAdminToken)?.__ENV__?.VITE_ADMIN_STATIC_TOKEN

      const nodeHeaders: Record<string, string> = { 'Accept': 'application/json', 'Content-Type': 'application/json' }
      if (token) nodeHeaders['Authorization'] = `Bearer ${token}`
      if (adminToken) nodeHeaders['X-Admin-Token'] = String(adminToken)

      let resp: Response | null = await fetchWithRetry('/api/admin/deploy-edge-functions', {
        method: 'POST',
        headers: nodeHeaders,
        credentials: 'same-origin',
        body: '{}',
      }).catch(() => null)

      if (!resp || !resp.ok) {
        if (resp) {
          const nodeBody = await safeJson(resp).catch(() => ({}))
          appendConsole(`[deploy] Node proxy response: HTTP ${resp.status}${nodeBody?.error ? ` - ${nodeBody.error}` : ''}`)
        }
        const adminHeaders: Record<string, string> = { 'Accept': 'application/json', 'Content-Type': 'application/json' }
        if (adminToken) adminHeaders['X-Admin-Token'] = String(adminToken)
        appendConsole('[deploy] Falling back to Admin API endpoint…')
        resp = await fetchWithRetry('/admin/deploy-edge-functions', {
          method: 'GET',
          headers: adminHeaders,
          credentials: 'same-origin',
        }).catch(() => null)

        if (resp && resp.status === 405) {
          resp = await fetchWithRetry('/admin/deploy-edge-functions', {
            method: 'POST',
            headers: adminHeaders,
            credentials: 'same-origin',
            body: '{}',
          }).catch(() => null)
        }
      }

      if (!resp) {
        throw new Error('Failed to connect to deployment API. Please check your connection and try again.')
      }

      const body = await safeJson(resp)

      const logTail = (value: unknown, prefix: string, limit = 80) => {
        if (!value) return
        const lines = String(value).split('\n').map(line => line.trimEnd()).filter(line => line.length > 0)
        if (lines.length === 0) return
        const slice = lines.slice(-limit)
        slice.forEach(line => appendConsole(`${prefix}${line}`))
        if (lines.length > slice.length) {
          appendConsole(`${prefix}… (${lines.length - slice.length} more line${lines.length - slice.length === 1 ? '' : 's'} omitted)`)
        }
      }

      if (!resp.ok || body?.ok === false) {
        const errorMessage = body?.error || `HTTP ${resp.status}`
        appendConsole(`[deploy] ✗ Deployment failed: ${errorMessage}`)
        logTail(body?.stdout, '[deploy]   ')
        logTail(body?.stderr, '[deploy] ✗ ')
        if (typeof body?.returncode === 'number') {
          appendConsole(`[deploy] Return code: ${body.returncode}`)
        }
        return
      }

      logTail(body?.stdout, '[deploy]   ')
      logTail(body?.stderr, '[deploy] ⚠ ')
      if (typeof body?.returncode === 'number') {
        appendConsole(`[deploy] Return code: ${body.returncode}`)
      }
      appendConsole('[deploy] ✓ Supabase Edge Functions deployment complete.')
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : String(e)
      appendConsole(`[deploy] ✗ Deployment failed: ${message}`)
    } finally {
      setDeployingEdge(false)
    }
  }

  const restartServer = async () => {
    if (restarting) return;
    setRestarting(true);
    // Enable Sentry maintenance mode to suppress expected 502/400 errors during restart
    enableMaintenanceMode(90000, 'restart-services'); // 90 seconds should be enough for restart + health checks
    try {
      setConsoleOpen(true);
      appendConsole("[restart] Restart services requested?");
      setReloadReady(false);
      setPreRestartNotice(false);
      const session = (await supabase.auth.getSession()).data.session;
      const token = session?.access_token;
      if (!token) {
        appendConsole("[restart] You must be signed in to restart services");
        return;
      }
      // First attempt: restart via Node API (preserves Authorization)
      const nodeHeaders = (() => {
        const h: Record<string, string> = { Accept: "application/json" };
        if (token) h["Authorization"] = `Bearer ${token}`;
        const adminToken = (globalThis as EnvWithAdminToken)?.__ENV__
          ?.VITE_ADMIN_STATIC_TOKEN;
        if (adminToken) h["X-Admin-Token"] = String(adminToken);
        return h;
      })();
      const nodePostHeaders = {
        ...nodeHeaders,
        "Content-Type": "application/json",
      };

      let nodeResp: Response | null = null;
      try {
        nodeResp = await fetch("/api/admin/restart-all", {
          method: "POST",
          headers: nodePostHeaders,
          credentials: "same-origin",
          body: "{}",
        });
      } catch {}
      // restart-all is POST-only on the Node API; no GET fallback here

      let ok = false;
      let nodeErrorMsg = "Restart request failed";
      if (nodeResp) {
        const b = await safeJson(nodeResp);
        ok = nodeResp.ok && b?.ok === true;
        if (!ok)
          nodeErrorMsg = b?.error || `Request failed (${nodeResp.status})`;
      }

      // Fallback: call local Admin API via nginx if Node endpoint not reachable/forbidden
      if (!ok) {
        const adminToken = (globalThis as EnvWithAdminToken)?.__ENV__
          ?.VITE_ADMIN_STATIC_TOKEN;
        if (adminToken) {
          const adminHeaders: Record<string, string> = {
            "Content-Type": "application/json",
            Accept: "application/json",
            "X-Admin-Token": String(adminToken),
          };
          // Best-effort: reload nginx to minimize 502s during service restarts
          try {
            const reloadResp = await fetch("/admin/reload-nginx", {
              method: "POST",
              headers: adminHeaders,
              credentials: "same-origin",
              body: "{}",
            });
            await safeJson(reloadResp).catch(() => null);
          } catch {}
          // Then restart the Admin API and Node services via Admin API
          const services = ["admin-api", "plant-swipe-node"];
          for (const svc of services) {
            const r = await fetch("/admin/restart-app", {
              method: "POST",
              headers: adminHeaders,
              credentials: "same-origin",
              body: JSON.stringify({ service: svc }),
            });
            const jb = await safeJson(r);
            if (!r.ok || jb?.ok !== true) {
              throw new Error(
                jb?.error || `Admin restart failed for ? ${svc} (${r.status})`,
              );
            }
          }
        } else {
          throw new Error(nodeErrorMsg);
        }
      }

      // Wait for API to come back healthy to avoid 502s; do NOT auto-reload
      const deadline = Date.now() + 30_000;
      let healthy = false;
      while (Date.now() < deadline) {
        try {
          const r = await fetch("/api/health", {
            headers: { Accept: "application/json" },
            credentials: "same-origin",
          });
          const b = await safeJson(r);
          if (r.ok && b?.ok === true) {
            healthy = true;
            break;
          }
        } catch {}
        await new Promise((res) => setTimeout(res, 1000));
      }
      if (healthy) {
        appendConsole(
          "[restart] Services healthy. You can reload the page when ready.",
        );
      } else {
        appendConsole(
          "[restart] Timed out waiting for service health. You may try reloading manually.",
        );
      }
      setReloadReady(true);
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : String(e);
      appendConsole(`[restart] Failed to restart services: ? ${message}`);
    } finally {
      setRestarting(false);
      // Disable maintenance mode now that restart is complete (or failed)
      disableMaintenanceMode();
    }
  };

  // --- Server Controls: Restart Server with Password ---
  const restartServerWithPassword = async () => {
    if (restarting) return;
    if (!setupPassword.trim()) {
      setConsoleOpen(true);
      appendConsole("[restart] Root password is required to restart server");
      return;
    }
    setRestarting(true);
    // Enable Sentry maintenance mode to suppress expected 502/400 errors during restart
    enableMaintenanceMode(120000, 'restart-server-with-password'); // 2 minutes for server restart operations
    try {
      setConsoleLines([]);
      setConsoleOpen(true);
      appendConsole("[restart] Starting server restart...");

      const adminToken = (globalThis as EnvWithAdminToken)?.__ENV__?.VITE_ADMIN_STATIC_TOKEN;
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
        Accept: "text/event-stream",
      };
      if (adminToken) headers["X-Admin-Token"] = String(adminToken);

      const response = await fetch("/admin/restart-server", {
        method: "POST",
        headers,
        credentials: "same-origin",
        body: JSON.stringify({ password: setupPassword }),
      });

      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(err?.error || `HTTP ${response.status}`);
      }

      const reader = response.body?.getReader();
      if (!reader) throw new Error("No stream reader");

      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";
        for (const line of lines) {
          if (line.startsWith("data: ")) {
            const data = line.slice(6);
            if (data.startsWith("{")) {
              try {
                const json = JSON.parse(data);
                if (json.ok === false && json.code) {
                  appendConsole(`[restart] Completed with exit code ${json.code}`);
                }
              } catch {}
            } else if (data.trim()) {
              appendConsole(data);
            }
          }
        }
      }
      appendConsole("[restart] Server restart completed");
      setReloadReady(true);
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : String(e);
      appendConsole(`[restart] Failed: ${message}`);
    } finally {
      setRestarting(false);
      // Disable maintenance mode now that restart is complete (or failed)
      disableMaintenanceMode();
    }
  };

  // --- Server Controls: Run Setup.sh ---
  const runSetup = async () => {
    if (runningSetup) return;
    if (!setupPassword.trim()) {
      setConsoleOpen(true);
      appendConsole("[setup] Root password is required to run setup.sh");
      return;
    }
    setRunningSetup(true);
    try {
      setConsoleLines([]);
      setConsoleOpen(true);
      appendConsole("[setup] Starting setup.sh...");

      const adminToken = (globalThis as EnvWithAdminToken)?.__ENV__?.VITE_ADMIN_STATIC_TOKEN;
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
        Accept: "text/event-stream",
      };
      if (adminToken) headers["X-Admin-Token"] = String(adminToken);

      const response = await fetch("/admin/run-setup", {
        method: "POST",
        headers,
        credentials: "same-origin",
        body: JSON.stringify({ password: setupPassword }),
      });

      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(err?.error || `HTTP ${response.status}`);
      }

      const reader = response.body?.getReader();
      if (!reader) throw new Error("No stream reader");

      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";
        for (const line of lines) {
          if (line.startsWith("data: ")) {
            const data = line.slice(6);
            if (data.startsWith("{")) {
              try {
                const json = JSON.parse(data);
                if (json.ok === false && json.code) {
                  appendConsole(`[setup] Completed with exit code ${json.code}`);
                }
              } catch {}
            } else if (data.trim()) {
              appendConsole(data);
            }
          }
        }
      }
      appendConsole("[setup] Setup.sh completed");
      setSetupPassword(""); // Clear password after use
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : String(e);
      appendConsole(`[setup] Failed: ${message}`);
    } finally {
      setRunningSetup(false);
    }
  };

  // --- Server Controls: Clear Memory ---
  const clearMemory = async () => {
    if (clearingMemory) return;
    setClearingMemory(true);
    try {
      setConsoleOpen(true);
      appendConsole("[memory] Clearing system memory cache...");

      const adminToken = (globalThis as EnvWithAdminToken)?.__ENV__?.VITE_ADMIN_STATIC_TOKEN;
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
        Accept: "application/json",
      };
      if (adminToken) headers["X-Admin-Token"] = String(adminToken);

      const response = await fetch("/admin/clear-memory", {
        method: "POST",
        headers,
        credentials: "same-origin",
        body: "{}",
      });

      const data = await response.json().catch(() => ({}));
      if (response.ok && data?.ok) {
        appendConsole("[memory] Memory cache cleared successfully");
      } else {
        throw new Error(data?.error || `HTTP ${response.status}`);
      }
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : String(e);
      appendConsole(`[memory] Failed to clear memory: ${message}`);
    } finally {
      setClearingMemory(false);
    }
  };

  // --- Server Controls: Git Pull Only ---
  const gitPullOnly = async () => {
    if (gitPulling) return;
    setGitPulling(true);
    try {
      setConsoleLines([]);
      setConsoleOpen(true);
      appendConsole("[git] Starting git pull...");

      const adminToken = (globalThis as EnvWithAdminToken)?.__ENV__?.VITE_ADMIN_STATIC_TOKEN;
      const headers: Record<string, string> = {
        Accept: "text/event-stream",
      };
      if (adminToken) headers["X-Admin-Token"] = String(adminToken);

      const response = await fetch("/admin/git-pull/stream", {
        method: "GET",
        headers,
        credentials: "same-origin",
      });

      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(err?.error || `HTTP ${response.status}`);
      }

      const reader = response.body?.getReader();
      if (!reader) throw new Error("No stream reader");

      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";
        for (const line of lines) {
          if (line.startsWith("data: ")) {
            const data = line.slice(6);
            if (data.startsWith("{")) {
              try {
                const json = JSON.parse(data);
                if (json.ok === false && json.code) {
                  appendConsole(`[git] Completed with exit code ${json.code}`);
                }
              } catch {}
            } else if (data.trim()) {
              appendConsole(data);
            }
          }
        }
      }
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : String(e);
      appendConsole(`[git] Failed: ${message}`);
    } finally {
      setGitPulling(false);
    }
  };

  // --- Server Controls: Fetch Sitemap Info ---
  const fetchSitemapInfo = React.useCallback(async () => {
    try {
      const response = await fetch("/api/admin/sitemap-info", {
        headers: { Accept: "application/json" },
        credentials: "same-origin",
      });
      if (response.ok) {
        const data = await response.json();
        setSitemapInfo(data);
      }
    } catch {
      // Silently fail - not critical
    }
  }, []);

  // Load sitemap info on mount (when server controls are first opened)
  React.useEffect(() => {
    if (serverControlsOpen && !sitemapInfo) {
      fetchSitemapInfo();
    }
  }, [serverControlsOpen, sitemapInfo, fetchSitemapInfo]);

  // --- Server Controls: Regenerate Sitemap ---
  const regenerateSitemap = async () => {
    if (regeneratingSitemap) return;
    setRegeneratingSitemap(true);
    try {
      setConsoleOpen(true);
      appendConsole("[sitemap] Regenerating sitemap...");

      const adminToken = (globalThis as EnvWithAdminToken)?.__ENV__?.VITE_ADMIN_STATIC_TOKEN;
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
        Accept: "application/json",
      };
      if (adminToken) headers["X-Admin-Token"] = String(adminToken);

      const response = await fetch("/admin/regenerate-sitemap", {
        method: "POST",
        headers,
        credentials: "same-origin",
        body: "{}",
      });

      const data = await response.json().catch(() => ({}));
      if (response.ok && data?.ok) {
        appendConsole("[sitemap] Sitemap regenerated successfully");
        if (data?.stdout) {
          // Show last few lines of output
          const lines = data.stdout.split("\n").filter((l: string) => l.trim());
          lines.slice(-10).forEach((line: string) => appendConsole(`[sitemap] ${line}`));
        }
        // Refresh sitemap info after regeneration
        setTimeout(() => fetchSitemapInfo(), 1000);
      } else {
        throw new Error(data?.error || `HTTP ${response.status}`);
      }
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : String(e);
      appendConsole(`[sitemap] Failed to regenerate sitemap: ${message}`);
    } finally {
      setRegeneratingSitemap(false);
    }
  };

  const [onlineUsers, setOnlineUsers] = React.useState<number>(0);
    const [registeredCount, setRegisteredCount] = React.useState<number | null>(
      null,
    );
    const [registeredLoading, setRegisteredLoading] =
      React.useState<boolean>(true);
    const [registeredRefreshing, setRegisteredRefreshing] =
      React.useState<boolean>(false);
    const [registeredUpdatedAt, setRegisteredUpdatedAt] = React.useState<
      number | null
    >(null);
    const [plantsCount, setPlantsCount] = React.useState<number | null>(null);
    const [plantsLoading, setPlantsLoading] = React.useState<boolean>(true);
    const [plantsRefreshing, setPlantsRefreshing] =
      React.useState<boolean>(false);
    const [plantsUpdatedAt, setPlantsUpdatedAt] = React.useState<number | null>(
      null,
    );
  const [onlineLoading, setOnlineLoading] = React.useState<boolean>(true);
  const [onlineRefreshing, setOnlineRefreshing] =
    React.useState<boolean>(false);
  const [onlineUpdatedAt, setOnlineUpdatedAt] = React.useState<number | null>(
    null,
  );
  const [visitorsLoading, setVisitorsLoading] = React.useState<boolean>(true);
  const [visitorsRefreshing, setVisitorsRefreshing] =
    React.useState<boolean>(false);
  const [visitorsUpdatedAt, setVisitorsUpdatedAt] = React.useState<
    number | null
  >(null);
  const [visitorsSeries, setVisitorsSeries] = React.useState<
    Array<{ date: string; uniqueVisitors: number }>
  >([]);
  const [visitorsTotalUnique7d, setVisitorsTotalUnique7d] =
    React.useState<number>(0);
  const [topCountries, setTopCountries] = React.useState<
    Array<{ country: string; visits: number; pct?: number }>
  >([]);
  type OtherCountriesBucket = {
    count: number;
    visits: number;
    pct?: number;
    codes?: string[];
    items?: Array<{ country: string; visits: number }>;
  };
  const [otherCountries, setOtherCountries] =
    React.useState<OtherCountriesBucket | null>(null);
  const [topReferrers, setTopReferrers] = React.useState<
    Array<{ source: string; visits: number; pct?: number }>
  >([]);
  const [otherReferrers, setOtherReferrers] = React.useState<{
    count: number;
    visits: number;
    pct?: number;
  } | null>(null);
  // Distinct, high-contrast palette for readability
  const countryColors = [
    "#10b981",
    "#3b82f6",
    "#ef4444",
    "#f59e0b",
    "#8b5cf6",
    "#14b8a6",
    "#6366f1",
    "#d946ef",
    "#06b6d4",
    "#84cc16",
    "#fb7185",
    "#f97316",
  ];
  const referrerColors = [
    "#111827",
    "#3b82f6",
    "#ef4444",
    "#10b981",
    "#f59e0b",
    "#8b5cf6",
  ];
  // Floating tooltip for the "Other countries" legend item
  const [otherCountriesTooltip, setOtherCountriesTooltip] = React.useState<{
    top: number;
    left: number;
    names: string[];
  } | null>(null);
  const showOtherCountriesTooltip = React.useCallback(
    (el: HTMLElement) => {
      try {
        if (
          !otherCountries ||
          !Array.isArray(otherCountries.codes) ||
          otherCountries.codes.length === 0
        )
          return;
        const rect = el.getBoundingClientRect();
        const names = otherCountries.codes
          .map((c) => countryCodeToName(c))
          .filter((n) => !!n)
          .sort((a, b) => a.localeCompare(b));
        setOtherCountriesTooltip({
          top: Math.max(8, rect.top - 8),
          left: rect.left + rect.width / 2,
          names,
        });
      } catch {}
    },
    [otherCountries, countryCodeToName],
  );
  const hideOtherCountriesTooltip = React.useCallback(
    () => setOtherCountriesTooltip(null),
    [],
  );
  // Connected IPs (last 60 minutes)
  const [ips, setIps] = React.useState<string[]>([]);
  const [ipsLoading, setIpsLoading] = React.useState<boolean>(true);
  const [ipsRefreshing, setIpsRefreshing] = React.useState<boolean>(false);
  const [ipsOpen, setIpsOpen] = React.useState<boolean>(false);
  // Tick every minute to update the "Updated X ago" label without refetching
  const [nowMs, setNowMs] = React.useState<number>(() => Date.now());
  React.useEffect(() => {
    const id = setInterval(() => setNowMs(Date.now()), 60_000);
    return () => clearInterval(id);
  }, []);
  // No subtitle needed below the card

  const formatTimeAgo = (ts: number): string => {
    const diff = Math.max(0, nowMs - ts);
    const s = Math.floor(diff / 1000);
    if (s < 45) return "just now";
    const m = Math.floor(s / 60);
    if (m < 60) return `${m}m ago`;
    const h = Math.floor(m / 60);
    if (h < 24) return `${h}h ago`;
    const d = Math.floor(h / 24);
    return `${d}d ago`;
  };

  type PlantRequestRow = {
    id: string;
    plant_name: string;
    plant_name_normalized: string;
    request_count: number;
    created_at: string | null;
    updated_at: string | null;
    requested_by: string | null;
    requester_name: string | null;
    requester_email: string | null;
    /** Whether the requester has admin or editor roles (can create plants themselves) */
    requester_is_staff: boolean | null;
  };
  type BulkPlantRequestSummary = {
    totalInput: number;
    uniqueCount: number;
    duplicateCount: number;
    addedCount: number;
    skippedExistingCount: number;
    errorCount: number;
    addedSamples: string[];
    skippedExistingSamples: string[];
    errorSamples: Array<{ name: string; error: string }>;
  };
  const PLANT_REQUESTS_INITIAL_LIMIT = 100;
  const PLANT_REQUESTS_PAGE_SIZE = 50;

  const [plantRequests, setPlantRequests] = React.useState<PlantRequestRow[]>(
    [],
  );
  const [plantRequestsLoading, setPlantRequestsLoading] =
    React.useState<boolean>(false);
  const [plantRequestsRefreshing, setPlantRequestsRefreshing] =
    React.useState<boolean>(false);
  const [plantRequestsError, setPlantRequestsError] = React.useState<
    string | null
  >(null);
  const [plantRequestsInitialized, setPlantRequestsInitialized] =
    React.useState<boolean>(false);
  // Accurate total counts (from separate count query, not capped by row limit)
  const [plantRequestsTotalCount, setPlantRequestsTotalCount] =
    React.useState<number>(0);
  const [plantRequestsTotalRequestsSum, setPlantRequestsTotalRequestsSum] =
    React.useState<number>(0);
  const [plantRequestsHasMore, setPlantRequestsHasMore] =
    React.useState<boolean>(false);
  const [plantRequestsLoadingMore, setPlantRequestsLoadingMore] =
    React.useState<boolean>(false);

  // Toggle to hide requests made by admins/editors (who can create plants themselves)
  const [hideStaffRequests, setHideStaffRequests] = React.useState<boolean>(true);
  // Cache of staff (admin/editor) user IDs for filtering
  const staffUserIdsRef = React.useRef<Set<string>>(new Set());

  // Count unique requested plants - use accurate count from DB, not loaded rows
  const uniqueRequestedPlantsCount = plantRequestsTotalCount;
  const [completingRequestId, setCompletingRequestId] = React.useState<
    string | null
  >(null);
  const [requestSearchQuery, setRequestSearchQuery] =
    React.useState<string>("");
  const [infoDialogOpen, setInfoDialogOpen] = React.useState<boolean>(false);
  const [selectedRequestInfo, setSelectedRequestInfo] =
    React.useState<PlantRequestRow | null>(null);
  const [requestUsersLoading, setRequestUsersLoading] =
    React.useState<boolean>(false);
  const [requestUsers, setRequestUsers] = React.useState<
    Array<{ id: string; display_name: string | null; email: string | null }>
  >([]);

  // Bulk request state
  const [bulkRequestDialogOpen, setBulkRequestDialogOpen] = React.useState(false);
  const [bulkRequestInput, setBulkRequestInput] = React.useState("");
  const [bulkRequestSubmitting, setBulkRequestSubmitting] = React.useState(false);
  const [bulkRequestError, setBulkRequestError] = React.useState<string | null>(null);
  const [bulkRequestSummary, setBulkRequestSummary] =
    React.useState<BulkPlantRequestSummary | null>(null);
  const [bulkRequestProgress, setBulkRequestProgress] = React.useState<{
    current: number;
    total: number;
  }>({ current: 0, total: 0 });
  const [bulkRequestStep, setBulkRequestStep] = React.useState<
    "edit" | "review"
  >("edit");
  const [bulkRequestLiveResults, setBulkRequestLiveResults] = React.useState<
    Array<{ name: string; status: "added" | "skipped" | "error"; error?: string }>
  >([]);
  const [bulkRequestLiveCounts, setBulkRequestLiveCounts] = React.useState({
    added: 0,
    skipped: 0,
    error: 0,
  });
  
  // Plant request editing state
  const [editingRequestId, setEditingRequestId] = React.useState<string | null>(null);
  const [editingRequestName, setEditingRequestName] = React.useState<string>("");
  const [savingRequestName, setSavingRequestName] = React.useState<boolean>(false);
  const [translatingRequestId, setTranslatingRequestId] = React.useState<string | null>(null);
  const requestViewMode: RequestViewMode = React.useMemo(() => {
    if (currentPath.includes("/admin/plants/requests")) return "requests";
    if (currentPath.includes("/admin/plants/reports")) return "reports";
    return "plants";
  }, [currentPath]);
  const bulkRequestParsed = React.useMemo(() => {
    const rawEntries = bulkRequestInput
      .split(/[\n,]+/)
      .map((entry) => entry.trim())
      .filter(Boolean);
    const seen = new Map<string, string>();
    const duplicates: string[] = [];
    rawEntries.forEach((name) => {
      const normalized = name.toLowerCase().trim();
      if (!normalized) return;
      if (seen.has(normalized)) {
        duplicates.push(name);
      } else {
        seen.set(normalized, name);
      }
    });
    const items = Array.from(seen.entries()).map(([normalized, displayName]) => ({
      displayName,
      normalized,
    }));
    return {
      rawCount: rawEntries.length,
      uniqueCount: items.length,
      duplicateCount: duplicates.length,
      duplicateSamples: duplicates.slice(0, 6),
      previewSamples: items.slice(0, 8).map((item) => item.displayName),
      items,
    };
  }, [bulkRequestInput]);
  const [plantDashboardRows, setPlantDashboardRows] = React.useState<
    PlantDashboardRow[]
  >([]);
  const [plantDashboardLoading, setPlantDashboardLoading] =
    React.useState<boolean>(false);
  const [plantDashboardError, setPlantDashboardError] = React.useState<
    string | null
  >(null);
  const [plantDashboardInitialized, setPlantDashboardInitialized] =
    React.useState<boolean>(false);
  
  // Initialize plant list filter state from sessionStorage for persistence
  const savedPlantsState = React.useMemo(() => loadAdminPlantsState(), []);
  const [visiblePlantStatuses, setVisiblePlantStatuses] = React.useState<
    NormalizedPlantStatus[]
  >(savedPlantsState.statuses ?? DEFAULT_VISIBLE_PLANT_STATUSES);
  const [selectedPromotionMonth, setSelectedPromotionMonth] = React.useState<
    PromotionMonthSlug | "none" | "all"
  >(savedPlantsState.promotionMonth ?? "all");
  const [plantSearchQuery, setPlantSearchQuery] =
    React.useState<string>(savedPlantsState.searchQuery ?? "");
  const [plantSortOption, setPlantSortOption] = React.useState<PlantSortOption>(
    savedPlantsState.sortOption ?? "status"
  );
  const [plantToDelete, setPlantToDelete] = React.useState<{ id: string; name: string } | null>(null);
  const [deletePlantDialogOpen, setDeletePlantDialogOpen] = React.useState(false);
  const [deletingPlant, setDeletingPlant] = React.useState(false);
  const [isAnalyticsPanelCollapsed, setIsAnalyticsPanelCollapsed] =
    React.useState<boolean>(true);
  const [addFromDialogOpen, setAddFromDialogOpen] = React.useState(false);
  const [addFromSearchQuery, setAddFromSearchQuery] = React.useState("");
  const [addFromSearchResults, setAddFromSearchResults] = React.useState<
    Array<{ id: string; name: string; scientific_name_species?: string | null; status?: string | null }>
  >([]);
  const [addFromSearchLoading, setAddFromSearchLoading] = React.useState(false);
  const [addButtonExpanded, setAddButtonExpanded] = React.useState(false);
  const [addFromDuplicating, setAddFromDuplicating] = React.useState(false);
  const [addFromDuplicateError, setAddFromDuplicateError] = React.useState<string | null>(null);
  const [addFromDuplicateSuccess, setAddFromDuplicateSuccess] = React.useState<{ id: string; name: string; originalName: string } | null>(null);

  // Bulk selection state
  const [selectedPlantIds, setSelectedPlantIds] = React.useState<Set<string>>(new Set());
  const [bulkStatusDialogOpen, setBulkStatusDialogOpen] = React.useState(false);
  const [bulkDeleteDialogOpen, setBulkDeleteDialogOpen] = React.useState(false);
  const [bulkActionLoading, setBulkActionLoading] = React.useState(false);

  // Track whether we've restored the scroll position (to avoid doing it multiple times)
  const scrollRestoredRef = React.useRef(false);
  
  // Restore scroll position when returning to the plants tab AFTER data has loaded
  React.useEffect(() => {
    // Only restore once, and only when on plants tab with data loaded
    if (scrollRestoredRef.current) return;
    if (!currentPath.includes("/admin/plants")) return;
    if (!plantDashboardInitialized) return;
    
    // Check if we have a saved scroll position
    const saved = loadAdminPlantsState();
    if (saved.scrollPosition && saved.scrollPosition > 0) {
      // Mark as restored before scrolling
      scrollRestoredRef.current = true;
      
      // Use setTimeout to ensure the DOM has rendered with the data
      setTimeout(() => {
        window.scrollTo(0, saved.scrollPosition!);
        // Clear the scroll position after restoring (but keep other state)
        saveAdminPlantsState({
          searchQuery: plantSearchQuery,
          sortOption: plantSortOption,
          promotionMonth: selectedPromotionMonth,
          statuses: visiblePlantStatuses,
          scrollPosition: 0,
        });
      }, 100);
    } else {
      // No scroll to restore, but mark as done
      scrollRestoredRef.current = true;
    }
  }, [currentPath, plantDashboardInitialized, plantSearchQuery, plantSortOption, selectedPromotionMonth, visiblePlantStatuses]);

  // AI Prefill All state
  const [aiPrefillRunning, setAiPrefillRunning] = React.useState<boolean>(false);
  const [aiPrefillAbortController, setAiPrefillAbortController] = React.useState<AbortController | null>(null);
  const [aiPrefillCurrentPlant, setAiPrefillCurrentPlant] = React.useState<string | null>(null);
  const [aiPrefillProgress, setAiPrefillProgress] = React.useState<{ current: number; total: number }>({ current: 0, total: 0 });
  const [aiPrefillError, setAiPrefillError] = React.useState<string | null>(null);
  const [aiPrefillStatus, setAiPrefillStatus] = React.useState<'idle' | 'filling' | 'saving' | 'translating' | 'translating_name' | 'fetching_images' | 'uploading_images'>('idle');
  const [aiPrefillCurrentField, setAiPrefillCurrentField] = React.useState<string | null>(null);
  const [aiPrefillFieldProgress, setAiPrefillFieldProgress] = React.useState<{ completed: number; total: number }>({ completed: 0, total: 0 });
  const [aiPrefillCategoryProgress, setAiPrefillCategoryProgress] = React.useState<CategoryProgress>(() => createEmptyCategoryProgress());
  const [aiPrefillCompletedPlants, setAiPrefillCompletedPlants] = React.useState<Array<{ name: string; success: boolean; error?: string; durationMs?: number }>>([]);
  const [aiPrefillStartTime, setAiPrefillStartTime] = React.useState<number | null>(null);
  const [aiPrefillElapsedTime, setAiPrefillElapsedTime] = React.useState<number>(0);
  const [aiPrefillImageSources, setAiPrefillImageSources] = React.useState<Record<ExternalImageSource, SourceResult>>(() => {
    const initial: Record<string, SourceResult> = {};
    for (const s of IMAGE_SOURCES) {
      initial[s.key] = { source: s.key, label: s.label, images: [], status: 'idle' };
    }
    return initial as Record<ExternalImageSource, SourceResult>;
  });
  const [aiPrefillImageUpload, setAiPrefillImageUpload] = React.useState<{ current: number; total: number; uploaded: number; failed: number }>({ current: 0, total: 0, uploaded: 0, failed: 0 });

  // Timer effect for elapsed time
  React.useEffect(() => {
    if (!aiPrefillRunning || !aiPrefillStartTime) {
      return;
    }
    const interval = setInterval(() => {
      setAiPrefillElapsedTime(Date.now() - aiPrefillStartTime);
    }, 1000);
    return () => clearInterval(interval);
  }, [aiPrefillRunning, aiPrefillStartTime]);

  // Helper to format duration
  const formatDuration = (ms: number) => {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    if (hours > 0) {
      return `${hours}h ${minutes % 60}m ${seconds % 60}s`;
    }
    if (minutes > 0) {
      return `${minutes}m ${seconds % 60}s`;
    }
    return `${seconds}s`;
  };

  // Category labels for display
  const aiPrefillCategoryLabels: Record<PlantFormCategory, string> = {
    basics: 'Basics',
    identity: 'Identity',
    plantCare: 'Plant Care',
    growth: 'Growth',
    usage: 'Usage',
    ecology: 'Ecology',
    danger: 'Danger',
    miscellaneous: 'Miscellaneous',
    meta: 'Meta',
  };

  const parseRequestRows = React.useCallback((data: unknown[]): PlantRequestRow[] => {
    return (data ?? [])
      .map((row: unknown) => {
        const r = row as Record<string, unknown>;
        const id = r?.id ? String(r.id) : null;
        if (!id) return null;
        const requestCountRaw = r?.request_count;
        const requestCount =
          typeof requestCountRaw === "number"
            ? requestCountRaw
            : Number(requestCountRaw ?? 0);
        const requestedBy = r?.requested_by ? String(r.requested_by) : null;
        return {
          id,
          plant_name: r?.plant_name
            ? String(r.plant_name)
            : r?.plant_name_normalized
              ? String(r.plant_name_normalized)
              : "Unknown request",
          plant_name_normalized: r?.plant_name_normalized
            ? String(r.plant_name_normalized)
            : r?.plant_name
              ? String(r.plant_name).toLowerCase().trim()
              : "",
          request_count: Number.isFinite(requestCount) ? requestCount : 0,
          created_at: r?.created_at ?? null,
          updated_at: r?.updated_at ?? null,
          requested_by: requestedBy,
          requester_name: null as string | null,
          requester_email: null as string | null,
          requester_is_staff: requestedBy ? staffUserIdsRef.current.has(requestedBy) : null,
        };
      })
      .filter((row): row is PlantRequestRow => row !== null);
  }, []);

  /** Fetch all admin/editor user IDs once and cache them */
  const loadStaffUserIds = React.useCallback(async () => {
    try {
      // Query profiles that have admin or editor roles, or is_admin = true
      // This is a small set (handful of users), so no pagination needed
      const { data, error } = await supabase
        .from("profiles")
        .select("id, is_admin, roles")
        .or("is_admin.eq.true,roles.cs.{admin},roles.cs.{editor}");
      if (error) {
        console.warn("Failed to load staff user IDs:", error.message);
        return;
      }
      const ids = new Set<string>();
      for (const row of data ?? []) {
        if (!row?.id) continue;
        const isAdmin = row.is_admin === true;
        const roles = Array.isArray(row.roles) ? row.roles : [];
        if (isAdmin || roles.includes("admin") || roles.includes("editor")) {
          ids.add(String(row.id));
        }
      }
      staffUserIdsRef.current = ids;
    } catch (err) {
      console.warn("Failed to load staff user IDs:", err);
    }
  }, []);

  /** Enrich rows with staff status from cached staff IDs */
  const enrichRowsWithStaffStatus = React.useCallback(
    (rows: PlantRequestRow[]): PlantRequestRow[] => {
      const staffIds = staffUserIdsRef.current;
      if (staffIds.size === 0) return rows;
      return rows.map((row) => ({
        ...row,
        requester_is_staff: row.requested_by
          ? staffIds.has(row.requested_by)
          : null,
      }));
    },
    [],
  );

  const loadPlantRequests = React.useCallback(
    async ({ initial = false }: { initial?: boolean } = {}) => {
      setPlantRequestsError(null);
      if (initial) {
        setPlantRequestsLoading(true);
      } else {
        setPlantRequestsRefreshing(true);
      }
      try {
        // 0. Ensure staff user IDs are loaded (for admin/editor filter)
        if (staffUserIdsRef.current.size === 0) {
          await loadStaffUserIds();
        }

        // 1. Get accurate total count (not capped by row limit)
        const { count: totalCount, error: countError } = await supabase
          .from("requested_plants")
          .select("id", { head: true, count: "exact" })
          .is("completed_at", null);

        if (countError) throw new Error(countError.message);
        const accurateCount = totalCount ?? 0;
        setPlantRequestsTotalCount(accurateCount);

        // 2. Get accurate sum of all request_count values (paginate to avoid 1000 row cap)
        let totalSum = 0;
        let sumOffset = 0;
        const sumPageSize = 1000;
        let hasMoreSum = true;
        while (hasMoreSum) {
          const { data: sumData, error: sumError } = await supabase
            .from("requested_plants")
            .select("request_count")
            .is("completed_at", null)
            .range(sumOffset, sumOffset + sumPageSize - 1);
          if (sumError) break;
          if (!sumData || sumData.length === 0) {
            hasMoreSum = false;
          } else {
            totalSum += sumData.reduce(
              (sum: number, row: unknown) => sum + (Number((row as Record<string, unknown>)?.request_count) || 0),
              0,
            );
            sumOffset += sumData.length;
            if (sumData.length < sumPageSize) hasMoreSum = false;
          }
        }
        setPlantRequestsTotalRequestsSum(totalSum);

        // 3. Fetch rows — when hiding staff, keep fetching pages until
        //    non-staff rows reach the desired limit (or DB is exhausted).
        const targetVisible = PLANT_REQUESTS_INITIAL_LIMIT;
        const batchSize = PLANT_REQUESTS_INITIAL_LIMIT;
        let allRows: PlantRequestRow[] = [];
        let fetchOffset = 0;
        let exhausted = false;

        while (true) {
          const { data, error } = await supabase
            .from("requested_plants")
            .select(
              "id, plant_name, plant_name_normalized, request_count, created_at, updated_at, requested_by",
            )
            .is("completed_at", null)
            .order("request_count", { ascending: false })
            .order("updated_at", { ascending: false })
            .range(fetchOffset, fetchOffset + batchSize - 1);

          if (error) throw new Error(error.message);

          const batch = enrichRowsWithStaffStatus(parseRequestRows(data));
          allRows = [...allRows, ...batch];
          fetchOffset += (data?.length ?? 0);

          if (!data || data.length < batchSize) {
            exhausted = true;
            break;
          }

          if (!hideStaffRequests) break;

          const nonStaffCount = allRows.filter(
            (r) => r.requester_is_staff !== true,
          ).length;
          if (nonStaffCount >= targetVisible) break;
        }

        setPlantRequests(allRows);
        setPlantRequestsHasMore(!exhausted && fetchOffset < accurateCount);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        setPlantRequestsError(msg);
        if (initial) setPlantRequests([]);
      } finally {
        if (initial) {
          setPlantRequestsLoading(false);
        } else {
          setPlantRequestsRefreshing(false);
        }
        if (initial) {
          setPlantRequestsInitialized(true);
        }
      }
    },
    [parseRequestRows, enrichRowsWithStaffStatus, loadStaffUserIds, hideStaffRequests],
  );

  const loadMorePlantRequests = React.useCallback(async () => {
    if (plantRequestsLoadingMore || !plantRequestsHasMore) return;
    setPlantRequestsLoadingMore(true);
    setPlantRequestsError(null);
    try {
      const startOffset = plantRequests.length;
      const targetNew = PLANT_REQUESTS_PAGE_SIZE;
      const batchSize = PLANT_REQUESTS_PAGE_SIZE;
      let newRows: PlantRequestRow[] = [];
      let fetchOffset = startOffset;
      let exhausted = false;

      while (true) {
        const { data, error } = await supabase
          .from("requested_plants")
          .select(
            "id, plant_name, plant_name_normalized, request_count, created_at, updated_at, requested_by",
          )
          .is("completed_at", null)
          .order("request_count", { ascending: false })
          .order("updated_at", { ascending: false })
          .range(fetchOffset, fetchOffset + batchSize - 1);

        if (error) throw new Error(error.message);

        const batch = enrichRowsWithStaffStatus(parseRequestRows(data));
        newRows = [...newRows, ...batch];
        fetchOffset += (data?.length ?? 0);

        if (!data || data.length < batchSize) {
          exhausted = true;
          break;
        }

        if (!hideStaffRequests) break;

        const newNonStaff = newRows.filter(
          (r) => r.requester_is_staff !== true,
        ).length;
        if (newNonStaff >= targetNew) break;
      }

      setPlantRequests((prev) => [...prev, ...newRows]);
      setPlantRequestsHasMore(
        !exhausted && startOffset + newRows.length < plantRequestsTotalCount,
      );
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setPlantRequestsError(msg);
    } finally {
      setPlantRequestsLoadingMore(false);
    }
  }, [
    plantRequestsLoadingMore,
    plantRequestsHasMore,
    plantRequests.length,
    plantRequestsTotalCount,
    parseRequestRows,
    enrichRowsWithStaffStatus,
    hideStaffRequests,
  ]);

  const loadRequestUsers = React.useCallback(
    async (plantNameNormalized: string) => {
      setRequestUsersLoading(true);
      setRequestUsers([]);
      try {
        // First get the requested_plant_id from the normalized name
        const { data: plantRequest, error: plantError } = await supabase
          .from("requested_plants")
          .select("id")
          .eq("plant_name_normalized", plantNameNormalized)
          .is("completed_at", null)
          .single();

        if (plantError || !plantRequest?.id) {
          setRequestUsers([]);
          return;
        }

        // Fetch all users who requested this plant from the junction table
        const { data: requestUsersData, error: usersError } = await supabase
          .from("plant_request_users")
          .select("user_id")
          .eq("requested_plant_id", plantRequest.id)
          .order("created_at", { ascending: false });

        if (usersError) throw new Error(usersError.message);

        if (!requestUsersData || requestUsersData.length === 0) {
          setRequestUsers([]);
          return;
        }

        // Get unique user IDs
        const userIds = [
          ...new Set(requestUsersData.map((row: unknown) => String((row as Record<string, unknown>).user_id))),
        ];

        // Fetch profiles for these user IDs
        const { data: profilesData, error: profilesError } = await supabase
          .from("profiles")
          .select("id, display_name")
          .in("id", userIds);

        if (profilesError) throw new Error(profilesError.message);

        // Fetch emails for each user using RPC function
        const usersWithEmails = await Promise.all(
          (profilesData ?? []).map(async (profile: unknown) => {
            const p = profile as Record<string, unknown>;
            let email: string | null = null;
            try {
              const { data: emailData } = await supabase.rpc(
                "get_friend_email",
                { _friend_id: p.id },
              );
              email = emailData || null;
            } catch (err) {
              console.warn("Failed to fetch email for user:", p.id, err);
            }
            return {
              id: String(p.id),
              display_name: p?.display_name
                ? String(p.display_name)
                : null,
              email: email,
            };
          }),
        );

        setRequestUsers(usersWithEmails);
      } catch (err) {
        console.error("Failed to load request users:", err);
        setRequestUsers([]);
      } finally {
        setRequestUsersLoading(false);
      }
    },
    [],
  );

  const handleOpenInfoDialog = React.useCallback(
    (req: PlantRequestRow) => {
      setSelectedRequestInfo(req);
      setInfoDialogOpen(true);
      if (req.plant_name_normalized) {
        loadRequestUsers(req.plant_name_normalized);
      }
    },
    [loadRequestUsers],
  );

  const completePlantRequest = React.useCallback(
    async (id: string) => {
      if (!id || completingRequestId) return;
      if (!user?.id) {
        setPlantRequestsError("You must be signed in to complete requests.");
        return;
      }
      setCompletingRequestId(id);
      setPlantRequestsError(null);
      try {
        // Delete the request (cascade will also delete related plant_request_users entries)
        const { error } = await supabase
          .from("requested_plants")
          .delete()
          .eq("id", id);

        if (error) throw new Error(error.message);

        await loadPlantRequests({ initial: false });
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        setPlantRequestsError(msg);
      } finally {
        setCompletingRequestId(null);
      }
    },
    [completingRequestId, loadPlantRequests, user?.id],
  );

  const handleOpenCreatePlantDialog = React.useCallback(
    (req: PlantRequestRow) => {
      // Navigate to the create plant page with the requested plant name as a query parameter
      const encodedName = encodeURIComponent(req.plant_name);
      const encodedRequestId = encodeURIComponent(req.id);
      navigate(`/create?name=${encodedName}&requestId=${encodedRequestId}`);
    },
    [navigate],
  );

  // Start editing a plant request name
  const handleStartEditRequest = React.useCallback((req: PlantRequestRow) => {
    setEditingRequestId(req.id);
    setEditingRequestName(req.plant_name);
  }, []);

  // Cancel editing
  const handleCancelEditRequest = React.useCallback(() => {
    setEditingRequestId(null);
    setEditingRequestName("");
  }, []);

  // Save edited plant request name
  const handleSaveRequestName = React.useCallback(async (requestId: string) => {
    const trimmedName = editingRequestName.trim();
    if (!trimmedName) return;
    
    setSavingRequestName(true);
    try {
      const { error } = await supabase
        .from("requested_plants")
        .update({ 
          plant_name: trimmedName,
          plant_name_normalized: trimmedName.toLowerCase().trim(),
          updated_at: new Date().toISOString()
        })
        .eq("id", requestId);
      
      if (error) throw new Error(error.message);
      
      // Update local state
      setPlantRequests((prev) => 
        prev.map((req) => 
          req.id === requestId 
            ? { ...req, plant_name: trimmedName, plant_name_normalized: trimmedName.toLowerCase().trim() }
            : req
        )
      );
      
      setEditingRequestId(null);
      setEditingRequestName("");
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setPlantRequestsError(`Failed to update name: ${msg}`);
    } finally {
      setSavingRequestName(false);
    }
  }, [editingRequestName]);

  // Translate plant request name to English using AI (auto-detects language)
  const handleTranslateRequestName = React.useCallback(async (req: PlantRequestRow) => {
    setTranslatingRequestId(req.id);
    try {
      // Use AI to get the English common name (auto-detects source language)
      const result = await getEnglishPlantName(req.plant_name);
      const translatedName = result.englishName;
      
      // If translation is different, update the database
      if (translatedName && translatedName.toLowerCase() !== req.plant_name.toLowerCase()) {
        const { error } = await supabase
          .from("requested_plants")
          .update({ 
            plant_name: translatedName,
            plant_name_normalized: translatedName.toLowerCase().trim(),
            updated_at: new Date().toISOString()
          })
          .eq("id", req.id);
        
        if (error) throw new Error(error.message);
        
        // Update local state
        setPlantRequests((prev) => 
          prev.map((r) => 
            r.id === req.id 
              ? { ...r, plant_name: translatedName, plant_name_normalized: translatedName.toLowerCase().trim() }
              : r
          )
        );
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setPlantRequestsError(`Failed to translate: ${msg}`);
    } finally {
      setTranslatingRequestId(null);
    }
  }, []);

  const handleBulkRequestOpenChange = React.useCallback(
    (open: boolean) => {
      if (!open) {
        if (bulkRequestSubmitting) return;
        setBulkRequestError(null);
        setBulkRequestSummary(null);
        setBulkRequestProgress({ current: 0, total: 0 });
        setBulkRequestInput("");
        setBulkRequestStep("edit");
        setBulkRequestLiveResults([]);
        setBulkRequestLiveCounts({ added: 0, skipped: 0, error: 0 });
        setBulkRequestDialogOpen(false);
        return;
      }
      setBulkRequestStep("edit");
      setBulkRequestDialogOpen(true);
    },
    [bulkRequestSubmitting],
  );

  const handleBulkRequestSubmit = React.useCallback(async () => {
    if (!user?.id) {
      setBulkRequestError("You must be signed in to add requests.");
      return;
    }
    if (bulkRequestParsed.items.length === 0) {
      setBulkRequestError("Add at least one plant name to continue.");
      return;
    }

    setBulkRequestSubmitting(true);
    setBulkRequestError(null);
    setBulkRequestSummary(null);
    setBulkRequestProgress({ current: 0, total: bulkRequestParsed.items.length });
    setBulkRequestLiveResults([]);
    setBulkRequestLiveCounts({ added: 0, skipped: 0, error: 0 });

    try {
      const existingNormalized = new Set<string>();
      const chunkSize = 150;
      for (let i = 0; i < bulkRequestParsed.items.length; i += chunkSize) {
        const chunk = bulkRequestParsed.items
          .slice(i, i + chunkSize)
          .map((item) => item.normalized);
        const { data, error } = await supabase
          .from("requested_plants")
          .select("plant_name_normalized")
          .is("completed_at", null)
          .in("plant_name_normalized", chunk);
        if (error) throw new Error(error.message);
        (data ?? []).forEach((row: unknown) => {
          const r = row as Record<string, unknown>;
          if (r?.plant_name_normalized) {
            existingNormalized.add(String(r.plant_name_normalized));
          }
        });
      }

      const skippedExisting = new Set<string>();
      const added: string[] = [];
      const errors: Array<{ name: string; error: string }> = [];
      let current = 0;
      const recordStatus = (
        name: string,
        status: "added" | "skipped" | "error",
        error?: string,
      ) => {
        setBulkRequestLiveResults((prev) => {
          const next = [...prev, { name, status, error }];
          if (next.length > 40) next.shift();
          return next;
        });
        setBulkRequestLiveCounts((prev) => ({
          added: prev.added + (status === "added" ? 1 : 0),
          skipped: prev.skipped + (status === "skipped" ? 1 : 0),
          error: prev.error + (status === "error" ? 1 : 0),
        }));
      };

      for (const item of bulkRequestParsed.items) {
        if (existingNormalized.has(item.normalized)) {
          skippedExisting.add(item.displayName);
          recordStatus(item.displayName, "skipped");
          current += 1;
          setBulkRequestProgress({
            current,
            total: bulkRequestParsed.items.length,
          });
          continue;
        }

        try {
          // Insert directly to avoid rate-limited plant_request_users trigger.
          const { error } = await supabase.from("requested_plants").insert({
            plant_name: item.displayName,
            plant_name_normalized: item.normalized,
            requested_by: user.id,
            request_count: 1,
          });
          if (error) {
            const message = error.message || "Failed to add request";
            if (
              error.code === "23505" ||
              message.includes("requested_plants_active_name_unique_idx")
            ) {
              skippedExisting.add(item.displayName);
              recordStatus(item.displayName, "skipped");
            } else {
              errors.push({ name: item.displayName, error: message });
              recordStatus(item.displayName, "error", message);
            }
          } else {
            added.push(item.displayName);
            recordStatus(item.displayName, "added");
          }
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          errors.push({ name: item.displayName, error: msg });
          recordStatus(item.displayName, "error", msg);
        } finally {
          current += 1;
          setBulkRequestProgress({
            current,
            total: bulkRequestParsed.items.length,
          });
        }
      }

      setBulkRequestSummary({
        totalInput: bulkRequestParsed.rawCount,
        uniqueCount: bulkRequestParsed.uniqueCount,
        duplicateCount: bulkRequestParsed.duplicateCount,
        addedCount: added.length,
        skippedExistingCount: skippedExisting.size,
        errorCount: errors.length,
        addedSamples: added.slice(0, 8),
        skippedExistingSamples: Array.from(skippedExisting).slice(0, 8),
        errorSamples: errors.slice(0, 5),
      });

      if (added.length > 0) {
        await loadPlantRequests({ initial: false });
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setBulkRequestError(msg);
    } finally {
      setBulkRequestSubmitting(false);
    }
  }, [bulkRequestParsed, loadPlantRequests, user?.id]);

  const handleOpenPlantEditor = React.useCallback(
    (plantId: string) => {
      if (!plantId) return;
      // Save all filter state and scroll position before navigating to plant editor
      saveAdminPlantsState({
        searchQuery: plantSearchQuery,
        sortOption: plantSortOption,
        promotionMonth: selectedPromotionMonth,
        statuses: visiblePlantStatuses,
        scrollPosition: window.scrollY,
      });
      navigate(`/create/${plantId}`);
    },
    [navigate, plantSearchQuery, plantSortOption, selectedPromotionMonth, visiblePlantStatuses],
  );
  const togglePlantStatusFilter = React.useCallback(
    (status: NormalizedPlantStatus) => {
      setVisiblePlantStatuses((prev) => {
        if (prev.includes(status)) {
          return prev.filter((s) => s !== status);
        }
        return [...prev, status];
      });
    },
    [],
  );

  const searchPlantsForAddFrom = React.useCallback(async (query: string) => {
    const trimmed = query.trim();
    if (!trimmed) {
      setAddFromSearchResults([]);
      return;
    }
    setAddFromSearchLoading(true);
    try {
      // Search by name, scientific_name, or given_names (common names from translations)
      // First, search plants by name or scientific_name
      const { data: directMatches, error: directError } = await supabase
        .from("plants")
        .select("id, name, scientific_name_species, status")
        .or(`name.ilike.%${trimmed}%,scientific_name_species.ilike.%${trimmed}%`)
        .order("name")
        .limit(20);
      if (directError) throw directError;

      // Also search by given_names in translations table
      const { data: translationMatches, error: transError } = await supabase
        .from("plant_translations")
        .select("plant_id, given_names, plants!inner(id, name, scientific_name_species, status)")
        .eq("language", "en")
        .limit(100);
      if (transError) throw transError;

      // Filter translation matches where given_names contains the search term
      const termLower = trimmed.toLowerCase();
      const translationPlantIds = new Set<string>();
      const translationPlants: Array<{ id: string; name: string; scientific_name_species?: string | null; status?: string | null }> = [];
      
      (translationMatches || []).forEach((row: unknown) => {
        const r = row as Record<string, unknown>;
        const givenNames = Array.isArray(r?.given_names) ? r.given_names : [];
        const matchesGivenName = givenNames.some(
          (gn: unknown) => typeof gn === "string" && gn.toLowerCase().includes(termLower)
        );
        if (matchesGivenName && r?.plants && typeof r.plants === "object" && r.plants !== null && "id" in r.plants && !translationPlantIds.has(String((r.plants as Record<string, unknown>).id))) {
          const plants = r.plants as Record<string, unknown>;
          translationPlantIds.add(String(plants.id));
          translationPlants.push({
            id: String(plants.id),
            name: String(plants.name || ""),
            scientific_name_species: plants.scientific_name_species || null,
            status: plants.status || null,
          });
        }
      });

      // Merge results, avoiding duplicates
      const seenIds = new Set<string>();
      const merged: Array<{ id: string; name: string; scientific_name_species?: string | null; status?: string | null }> = [];
      
      (directMatches || []).forEach((plant: unknown) => {
        const p = plant as Record<string, unknown>;
        if (p?.id && !seenIds.has(String(p.id))) {
          seenIds.add(String(p.id));
          merged.push({
            id: String(p.id),
            name: String(p.name || ""),
            scientific_name_species: p.scientific_name_species ?? null,
            status: p.status ?? null,
          });
        }
      });
      
      translationPlants.forEach((plant) => {
        if (!seenIds.has(plant.id)) {
          seenIds.add(plant.id);
          merged.push(plant);
        }
      });

      // Sort by name and limit to 20
      merged.sort((a, b) => (a.name || "").localeCompare(b.name || ""));
      setAddFromSearchResults(merged.slice(0, 20));
    } catch (err) {
      console.error("Failed to search plants:", err);
      setAddFromSearchResults([]);
    } finally {
      setAddFromSearchLoading(false);
    }
  }, []);

  const handleSelectPlantForPrefill = React.useCallback(
    async (plantId: string, plantName: string) => {
      setAddFromDuplicating(true);
      setAddFromDuplicateError(null);
      setAddFromDuplicateSuccess(null);
      
      try {
        // Generate new UUID for the duplicated plant
        const newId = crypto.randomUUID?.() || 
          'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
            const r = Math.random() * 16 | 0;
            const v = c === 'x' ? r : (r & 0x3 | 0x8);
            return v.toString(16);
          });
        
        // Create new name: original name + short uuid
        const shortUuid = newId.split('-')[0]; // First 8 characters
        const newName = `${plantName} ${shortUuid}`;
        
        // Step 1: Load the source plant base data
        const { data: sourcePlant, error: plantError } = await supabase
          .from('plants')
          .select('*')
          .eq('id', plantId)
          .single();
        
        if (plantError || !sourcePlant) {
          throw new Error('Source plant not found');
        }
        
        // Step 2: Load all translations for the source plant
        const { data: sourceTranslations, error: translationsError } = await supabase
          .from('plant_translations')
          .select('*')
          .eq('plant_id', plantId);
        
        if (translationsError) {
          console.error('Failed to load translations:', translationsError);
          // Continue without translations if they fail to load
        }
        
        // Step 3: Load related data (colors, images, watering schedules, sources, infusion mixes)
        const { data: colorLinks } = await supabase
          .from('plant_colors')
          .select('color_id')
          .eq('plant_id', plantId);
        
        const { data: plantImages } = await supabase
          .from('plant_images')
          .select('link, use')
          .eq('plant_id', plantId);
        
        const { data: wateringSchedules } = await supabase
          .from('plant_watering_schedules')
          .select('season, quantity, time_period')
          .eq('plant_id', plantId);
        
        const { data: plantSources } = await supabase
          .from('plant_sources')
          .select('name, url')
          .eq('plant_id', plantId);
        
        const { data: infusionMixes } = await supabase
          .from('plant_infusion_mixes')
          .select('mix_name, benefit')
          .eq('plant_id', plantId);
        
        // Step 3b: Load pro advices for the source plant
        const { data: proAdvices } = await supabase
          .from('plant_pro_advices')
          .select('author_id, author_display_name, author_username, author_avatar_url, author_roles, content, original_language, translations, image_url, reference_url, metadata')
          .eq('plant_id', plantId);
        
        // Step 4: Create the new plant record (copy all non-translatable fields)
        const timestamp = new Date().toISOString();
        const newPlantPayload = {
          ...sourcePlant,
          id: newId,
          name: newName,
          // Keep scientific_name - no unique constraint exists on this field
          // Update meta fields
          status: 'in progres',
          created_by: profile?.display_name || sourcePlant.created_by,
          created_time: timestamp,
          updated_by: profile?.display_name || null,
          updated_time: timestamp,
        };
        
        const { error: insertError } = await supabase
          .from('plants')
          .insert(newPlantPayload);
        
        if (insertError) {
          throw new Error(`Failed to create plant: ${insertError.message}`);
        }
        
        // Step 5: Copy all translations to the new plant
        if (sourceTranslations && sourceTranslations.length > 0) {
          const newTranslations = sourceTranslations.map((t) => {
            // Destructure to remove id so Supabase auto-generates a new one
            const { id: _oldId, ...translationData } = t;
            return {
              ...translationData,
              plant_id: newId,
              // Update the name in each translation to the new name
              name: newName,
              created_at: timestamp,
              updated_at: timestamp,
            };
          });
          
          const { error: translationInsertError } = await supabase
            .from('plant_translations')
            .insert(newTranslations);
          
          if (translationInsertError) {
            console.error('Failed to copy translations:', translationInsertError);
            // Continue even if translations fail
          }
        }
        
        // Step 6: Copy color links
        if (colorLinks && colorLinks.length > 0) {
          const newColorLinks = colorLinks.map((c) => ({
            plant_id: newId,
            color_id: c.color_id,
          }));
          
          await supabase.from('plant_colors').insert(newColorLinks);
        }
        
        // Step 7: Copy plant images
        if (plantImages && plantImages.length > 0) {
          const newImages = plantImages.map((img) => ({
            plant_id: newId,
            link: img.link,
            use: img.use,
          }));
          
          const { error: imagesInsertError } = await supabase.from('plant_images').insert(newImages);
          if (imagesInsertError) {
            console.error('Failed to copy plant images:', imagesInsertError);
            // Continue even if images fail
          }
        }
        
        // Step 8: Copy watering schedules
        if (wateringSchedules && wateringSchedules.length > 0) {
          const newSchedules = wateringSchedules.map((s) => ({
            plant_id: newId,
            season: s.season,
            quantity: s.quantity,
            time_period: s.time_period,
          }));
          
          await supabase.from('plant_watering_schedules').insert(newSchedules);
        }
        
        // Step 9: Copy plant sources
        if (plantSources && plantSources.length > 0) {
          const newSources = plantSources.map((s) => ({
            plant_id: newId,
            name: s.name,
            url: s.url,
          }));
          
          await supabase.from('plant_sources').insert(newSources);
        }
        
        // Step 10: Copy infusion mixes
        if (infusionMixes && infusionMixes.length > 0) {
          const newMixes = infusionMixes.map((m) => ({
            plant_id: newId,
            mix_name: m.mix_name,
            benefit: m.benefit,
          }));
          
          await supabase.from('plant_infusion_mixes').insert(newMixes);
        }
        
        // Step 11: Copy pro advices (plant care tips from experts)
        if (proAdvices && proAdvices.length > 0) {
          const newProAdvices = proAdvices.map((advice) => ({
            plant_id: newId,
            author_id: advice.author_id,
            author_display_name: advice.author_display_name,
            author_username: advice.author_username,
            author_avatar_url: advice.author_avatar_url,
            author_roles: advice.author_roles,
            content: advice.content,
            original_language: advice.original_language,
            translations: advice.translations,
            image_url: advice.image_url,
            reference_url: advice.reference_url,
            metadata: advice.metadata,
            created_at: timestamp,
          }));
          
          const { error: proAdvicesInsertError } = await supabase.from('plant_pro_advices').insert(newProAdvices);
          if (proAdvicesInsertError) {
            console.error('Failed to copy pro advices:', proAdvicesInsertError);
            // Continue even if pro advices fail
          }
        }
        
        // Success! Show success message and navigate
        setAddFromDuplicateSuccess({
          id: newId,
          name: newName,
          originalName: plantName,
        });
        
        // Mark plant dashboard as needing refresh so it reloads when user visits it
        setPlantDashboardInitialized(false);
        
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to duplicate plant';
        setAddFromDuplicateError(message);
        console.error('Duplicate plant error:', err);
      } finally {
        setAddFromDuplicating(false);
      }
    },
    [profile?.display_name],
  );

  const loadPlantDashboard = React.useCallback(async () => {
    setPlantDashboardError(null);
    setPlantDashboardLoading(true);
    try {
      // First, get all plants
      const { data: plantsData, error: plantsError } = await supabase
        .from("plants")
        .select(
          `
            id,
            name,
            status,
            featured_month,
            updated_time,
            created_time,
            plant_images (
              link,
              use
            )
          `,
        )
        .order("name", { ascending: true });

      if (plantsError) throw new Error(plantsError.message);

      // Fetch all English translations at once (no .in() filter) to avoid
      // Supabase URL length limits. Since we already load every plant above,
      // we need translations for all of them anyway.
      const plantIds = (plantsData || []).map((p: unknown) => (p as Record<string, unknown>).id);
      const plantIdSet = new Set(plantIds.map(String));
      const allTranslations: unknown[] = [];
      {
        let offset = 0;
        const pageSize = 1000;
        let hasMore = true;
        while (hasMore) {
          const { data, error: trError } = await supabase
            .from("plant_translations")
            .select("plant_id, given_names")
            .eq("language", "en")
            .range(offset, offset + pageSize - 1);
          if (trError) break;
          if (!data || data.length === 0) { hasMore = false; break; }
          allTranslations.push(...data);
          offset += data.length;
          if (data.length < pageSize) hasMore = false;
        }
      }
      // Filter to only the plant IDs we care about
      const translationsData = allTranslations.filter((t: unknown) => {
        const tr = t as Record<string, unknown>;
        return tr?.plant_id && plantIdSet.has(String(tr.plant_id));
      });

      // Build a map of plant_id -> given_names
      const givenNamesMap = new Map<string, string[]>();
      (translationsData || []).forEach((t: unknown) => {
        const tr = t as Record<string, unknown>;
        if (tr?.plant_id && Array.isArray(tr.given_names)) {
          givenNamesMap.set(String(tr.plant_id), (tr.given_names as unknown[]).map((n: unknown) => String(n || "")));
        }
      });

      // Fetch garden counts per plant (how many gardens each plant appears in)
      const gardensCountMap = new Map<string, number>();
      {
        let offset = 0;
        const pageSize = 1000;
        let hasMore = true;
        while (hasMore) {
          const { data: gpData, error: gpError } = await supabase
            .from("garden_plants")
            .select("plant_id")
            .range(offset, offset + pageSize - 1);
          if (gpError) break;
          if (!gpData || gpData.length === 0) { hasMore = false; break; }
          for (const gp of gpData) {
            if (gp?.plant_id) {
              gardensCountMap.set(gp.plant_id, (gardensCountMap.get(gp.plant_id) ?? 0) + 1);
            }
          }
          offset += gpData.length;
          if (gpData.length < pageSize) hasMore = false;
        }
      }

      // Fetch likes counts via the top_liked_plants RPC (server-side aggregation)
      const likesCountMap = new Map<string, number>();
      {
        const { data: likesData } = await supabase
          .rpc("top_liked_plants", { limit_count: 100000 });
        if (Array.isArray(likesData)) {
          for (const row of likesData) {
            if (row?.plant_id) {
              likesCountMap.set(String(row.plant_id), Number(row.likes) || 0);
            }
          }
        }
      }

      // Fetch permanent impression-based view counts (from the impressions table)
      const viewsCountMap = new Map<string, number>();
      {
        const impressionsData = await fetchAllImpressions("plant");
        if (impressionsData) {
          for (const [entityId, count] of Object.entries(impressionsData)) {
            viewsCountMap.set(entityId, count);
          }
        }
      }

      // Now combine the data
      const data = plantsData;
      const error = plantsError;

      if (error) throw new Error(error.message);

      const rows: PlantDashboardRow[] = (data ?? [])
        .map((row: unknown) => {
          const r = row as Record<string, unknown>;
          if (!r?.id) return null;
          const images = Array.isArray(r?.plant_images)
            ? r.plant_images
            : [];
          const primaryImage =
            images.find((img: unknown) => (img as Record<string, unknown>)?.use === "primary") ??
            images.find((img: unknown) => (img as Record<string, unknown>)?.use === "discovery") ??
            images[0];

          // Get given_names from the map
          const plantId = String(r.id);
          const givenNames = givenNamesMap.get(plantId) || [];

            return {
              id: plantId,
              name: r?.name ? String(r.name) : "Unnamed plant",
              givenNames,
              status: normalizePlantStatus(r?.status),
              promotionMonth: toPromotionMonthSlug(r?.featured_month),
              primaryImage: (primaryImage as Record<string, unknown>)?.link
                ? String((primaryImage as Record<string, unknown>).link)
                : null,
              updatedAt: (() => {
                const timestamp =
                  r?.updated_time ??
                  r?.updated_at ??
                  r?.updatedTime ??
                  null;
                if (!timestamp) return null;
                const parsed = Date.parse(String(timestamp));
                return Number.isFinite(parsed) ? parsed : null;
              })(),
              createdAt: (() => {
                const timestamp =
                  r?.created_time ??
                  r?.created_at ??
                  r?.createdTime ??
                  null;
                if (!timestamp) return null;
                const parsed = Date.parse(String(timestamp));
                return Number.isFinite(parsed) ? parsed : null;
              })(),
              gardensCount: gardensCountMap.get(plantId) ?? 0,
              likesCount: likesCountMap.get(plantId) ?? 0,
              viewsCount: viewsCountMap.get(plantId) ?? 0,
              imagesCount: images.length,
            } as PlantDashboardRow;
        })
        .filter((row): row is PlantDashboardRow => row !== null);

      setPlantDashboardRows(rows);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setPlantDashboardError(message);
    } finally {
      setPlantDashboardInitialized(true);
      setPlantDashboardLoading(false);
    }
  }, []);

  const handleDeletePlant = React.useCallback(async () => {
    if (!plantToDelete) return;
    
    setDeletingPlant(true);
    try {
      const plantId = plantToDelete.id;
      
      // Delete related data first (in order to respect foreign key constraints)
      // Delete plant translations
      await supabase.from('plant_translations').delete().eq('plant_id', plantId);
      
      // Delete plant colors
      await supabase.from('plant_colors').delete().eq('plant_id', plantId);
      
      // Delete plant images
      await supabase.from('plant_images').delete().eq('plant_id', plantId);
      
      // Delete watering schedules
      await supabase.from('plant_watering_schedules').delete().eq('plant_id', plantId);
      
      // Delete plant sources
      await supabase.from('plant_sources').delete().eq('plant_id', plantId);
      
      // Delete infusion mixes
      await supabase.from('plant_infusion_mixes').delete().eq('plant_id', plantId);
      
      // Finally delete the plant itself
      const { error } = await supabase.from('plants').delete().eq('id', plantId);
      
      if (error) {
        throw new Error(error.message);
      }
      
      // Remove from local state
      setPlantDashboardRows((prev) => prev.filter((p) => p.id !== plantId));
      
      // Close the dialog
      setDeletePlantDialogOpen(false);
      setPlantToDelete(null);
      
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to delete plant';
      setPlantDashboardError(message);
      console.error('Delete plant error:', err);
    } finally {
      setDeletingPlant(false);
    }
  }, [plantToDelete]);

  // Clear selection when filters change (selected items might no longer be visible)
  React.useEffect(() => {
    setSelectedPlantIds(new Set());
  }, [visiblePlantStatuses, selectedPromotionMonth, plantSearchQuery]);

  const togglePlantSelection = React.useCallback((plantId: string) => {
    setSelectedPlantIds((prev) => {
      const next = new Set(prev);
      if (next.has(plantId)) {
        next.delete(plantId);
      } else {
        next.add(plantId);
      }
      return next;
    });
  }, []);

  const toggleSelectAllPlants = React.useCallback(
    (filteredIds: string[]) => {
      setSelectedPlantIds((prev) => {
        const allSelected = filteredIds.length > 0 && filteredIds.every((id) => prev.has(id));
        if (allSelected) {
          return new Set();
        }
        return new Set(filteredIds);
      });
    },
    [],
  );

  const handleBulkStatusChange = React.useCallback(
    async (newStatus: NormalizedPlantStatus) => {
      if (selectedPlantIds.size === 0) return;
      setBulkActionLoading(true);
      try {
        const ids = Array.from(selectedPlantIds);
        const dbStatus = normalizedStatusToDb[newStatus] ?? newStatus;
        // Update in batches of 50 to avoid URL length issues
        const batchSize = 50;
        for (let i = 0; i < ids.length; i += batchSize) {
          const batch = ids.slice(i, i + batchSize);
          const { error } = await supabase
            .from('plants')
            .update({ status: dbStatus })
            .in('id', batch);
          if (error) throw new Error(error.message);
        }
        // Update local state
        setPlantDashboardRows((prev) =>
          prev.map((p) =>
            selectedPlantIds.has(p.id) ? { ...p, status: newStatus } : p
          )
        );
        setSelectedPlantIds(new Set());
        setBulkStatusDialogOpen(false);
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to update status';
        setPlantDashboardError(message);
        console.error('Bulk status change error:', err);
      } finally {
        setBulkActionLoading(false);
      }
    },
    [selectedPlantIds],
  );

  const handleBulkDelete = React.useCallback(async () => {
    if (selectedPlantIds.size === 0) return;
    setBulkActionLoading(true);
    try {
      const ids = Array.from(selectedPlantIds);
      // Delete related data first, then plants - in batches
      const batchSize = 50;
      const relatedTables = [
        'plant_translations',
        'plant_colors',
        'plant_images',
        'plant_watering_schedules',
        'plant_sources',
        'plant_infusion_mixes',
      ];
      for (const table of relatedTables) {
        for (let i = 0; i < ids.length; i += batchSize) {
          const batch = ids.slice(i, i + batchSize);
          await supabase.from(table).delete().in('plant_id', batch);
        }
      }
      // Delete the plants themselves
      for (let i = 0; i < ids.length; i += batchSize) {
        const batch = ids.slice(i, i + batchSize);
        const { error } = await supabase.from('plants').delete().in('id', batch);
        if (error) throw new Error(error.message);
      }
      // Update local state
      setPlantDashboardRows((prev) => prev.filter((p) => !selectedPlantIds.has(p.id)));
      setSelectedPlantIds(new Set());
      setBulkDeleteDialogOpen(false);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to delete plants';
      setPlantDashboardError(message);
      console.error('Bulk delete error:', err);
    } finally {
      setBulkActionLoading(false);
    }
  }, [selectedPlantIds]);

  const plantStatusCounts = React.useMemo(() => {
    return plantDashboardRows.reduce(
      (acc, plant) => {
        acc[plant.status] = (acc[plant.status] ?? 0) + 1;
        return acc;
      },
      {
        "in progres": 0,
        review: 0,
        rework: 0,
        approved: 0,
        other: 0,
      } as Record<NormalizedPlantStatus, number>,
    );
  }, [plantDashboardRows]);

  const approvedPlantsCount = plantStatusCounts.approved ?? 0;

  const plantStatusDonutData = React.useMemo(
    () =>
      STATUS_DONUT_SEGMENTS.map((status) => ({
        key: status,
        label: PLANT_STATUS_LABELS[status],
        value: plantStatusCounts[status] ?? 0,
        color: PLANT_STATUS_COLORS[status],
      })).filter((entry) => entry.value > 0),
    [plantStatusCounts],
  );

  const promotionMonthData = React.useMemo(() => {
    const counts = PROMOTION_MONTH_SLUGS.reduce(
      (acc, slug) => {
        acc[slug] = 0;
        return acc;
      },
      {} as Record<PromotionMonthSlug, number>,
    );
    plantDashboardRows.forEach((plant) => {
      if (plant.promotionMonth) {
        counts[plant.promotionMonth] += 1;
      }
    });
    return PROMOTION_MONTH_SLUGS.map((slug) => ({
      slug,
      label: PROMOTION_MONTH_LABELS[slug],
      value: counts[slug],
    }));
  }, [plantDashboardRows]);

  const hasPromotionMonthData = React.useMemo(
    () => promotionMonthData.some((entry) => entry.value > 0),
    [promotionMonthData],
  );

  // Use accurate counts from DB (not limited by pagination)
  const totalPlantRequestsCount = plantRequestsTotalRequestsSum;
  const totalUniquePlantRequests = plantRequestsTotalCount;

  const requestsVsApproved = React.useMemo(() => {
    const denominator = approvedPlantsCount > 0 ? approvedPlantsCount : null;
    const numerator =
      totalUniquePlantRequests > 0
        ? totalUniquePlantRequests
        : totalPlantRequestsCount > 0
          ? totalPlantRequestsCount
          : null;
    const ratio =
      denominator !== null && numerator !== null
        ? numerator / denominator
        : null;
    const percent =
      ratio !== null
        ? ratio * 100
        : totalPlantRequestsCount > 0
          ? 100
          : 0;
    const normalizedPercent = Number.isFinite(percent) ? percent : 0;
    const domainMax = Math.max(100, Math.ceil(normalizedPercent / 25) * 25);
    return {
      ratio,
      percent: normalizedPercent,
      gaugeValue: Math.min(normalizedPercent, domainMax),
      domainMax,
      approved: approvedPlantsCount,
      requests: totalPlantRequestsCount,
    };
  }, [approvedPlantsCount, totalPlantRequestsCount, totalUniquePlantRequests]);

  const filteredPlantRows = React.useMemo(() => {
    const term = plantSearchQuery.trim().toLowerCase();
    const statuses = new Set(visiblePlantStatuses);
    return plantDashboardRows
      .filter((plant) => {
        const matchesStatus =
          statuses.size === 0 ? false : statuses.has(plant.status);
        if (!matchesStatus) return false;
        const matchesPromotion =
          selectedPromotionMonth === "all"
            ? true
            : selectedPromotionMonth === "none"
              ? !plant.promotionMonth
              : plant.promotionMonth === selectedPromotionMonth;
        if (!matchesPromotion) return false;
        // Search by name OR givenNames (common names)
        const matchesSearch = term
          ? plant.name.toLowerCase().includes(term) ||
            plant.givenNames.some((gn) => gn.toLowerCase().includes(term))
          : true;
        return matchesSearch;
      })
      .sort((a, b) => {
        switch (plantSortOption) {
          case "updated": {
            const updatedA = a.updatedAt ?? 0;
            const updatedB = b.updatedAt ?? 0;
            if (updatedB !== updatedA) return updatedB - updatedA;
            return a.name.localeCompare(b.name);
          }
          case "created": {
            const createdA = a.createdAt ?? 0;
            const createdB = b.createdAt ?? 0;
            if (createdB !== createdA) return createdB - createdA;
            return a.name.localeCompare(b.name);
          }
          case "name":
            return a.name.localeCompare(b.name);
          case "gardens":
            if (b.gardensCount !== a.gardensCount) return b.gardensCount - a.gardensCount;
            return a.name.localeCompare(b.name);
          case "likes":
            if (b.likesCount !== a.likesCount) return b.likesCount - a.likesCount;
            return a.name.localeCompare(b.name);
          case "views":
            if (b.viewsCount !== a.viewsCount) return b.viewsCount - a.viewsCount;
            return a.name.localeCompare(b.name);
          case "images":
            if (a.imagesCount !== b.imagesCount) return a.imagesCount - b.imagesCount;
            return a.name.localeCompare(b.name);
          case "status":
          default: {
            const statusDiff =
              getStatusSortPriority(a.status) - getStatusSortPriority(b.status);
            if (statusDiff !== 0) return statusDiff;
            return a.name.localeCompare(b.name);
          }
        }
      });
  }, [plantDashboardRows, visiblePlantStatuses, selectedPromotionMonth, plantSearchQuery, plantSortOption]);

  const plantViewIsPlants = requestViewMode === "plants";
  const plantViewIsReports = requestViewMode === "reports";
  const plantTableLoading =
    plantDashboardLoading && !plantDashboardInitialized;
  const visiblePlantStatusesSet = React.useMemo(
    () => new Set(visiblePlantStatuses),
    [visiblePlantStatuses],
  );
  const noPlantStatusesSelected = visiblePlantStatusesSet.size === 0;


  // AI Prefill All functionality
  const aiFieldOrder = React.useMemo(() => [
    'plantType', 'utility', 'comestiblePart', 'fruitType', 'seasons', 'description',
    'identity', 'plantCare', 'growth', 'usage', 'ecology', 'danger', 'miscellaneous'
  ], []);

  const initAiPrefillCategoryProgress = React.useCallback(() => {
    const progress = buildCategoryProgress(aiFieldOrder);
    setAiPrefillCategoryProgress(progress);
  }, [aiFieldOrder]);

  const markAiPrefillFieldComplete = React.useCallback((fieldKey: string) => {
    const category = mapFieldToCategory(fieldKey);
    setAiPrefillCategoryProgress((prev) => {
      const current = prev[category] || { total: 0, completed: 0, status: 'idle' };
      const total = current.total || 1;
      const completed = Math.min((current.completed || 0) + 1, total);
      const nextStatus = completed >= total ? 'done' : 'filling';
      return {
        ...prev,
        [category]: { total, completed, status: nextStatus },
      };
    });
  }, []);

  const runAiPrefillAll = React.useCallback(async () => {
    if (aiPrefillRunning || plantRequests.length === 0) return;
    
    const abortController = new AbortController();
    const overallStartTime = Date.now();
    let plantStartTime = Date.now();
    
    setAiPrefillAbortController(abortController);
    setAiPrefillRunning(true);
    setAiPrefillError(null);
    setAiPrefillProgress({ current: 0, total: plantRequests.length });
    setAiPrefillStatus('idle');
    setAiPrefillCurrentField(null);
    setAiPrefillFieldProgress({ completed: 0, total: 0 });
    setAiPrefillCompletedPlants([]);
    setAiPrefillStartTime(overallStartTime);
    setAiPrefillElapsedTime(0);
    setAiPrefillPlantStartTime(plantStartTime);
    initAiPrefillCategoryProgress();
    
    try {
      await processAllPlantRequests(
        plantRequests.map((req) => ({ id: req.id, plant_name: req.plant_name })),
        profile?.display_name || undefined,
        {
          signal: abortController.signal,
          onProgress: ({ stage, plantName }) => {
            setAiPrefillCurrentPlant(plantName);
            setAiPrefillStatus(stage);
            // Reset category progress for new plant
            if (stage === 'filling' || stage === 'translating_name') {
              initAiPrefillCategoryProgress();
              setAiPrefillCurrentField(null);
              setAiPrefillFieldProgress({ completed: 0, total: 0 });
            }
            // Reset image sources when entering fetching_images stage
            if (stage === 'fetching_images') {
              setAiPrefillImageUpload({ current: 0, total: 0, uploaded: 0, failed: 0 });
              setAiPrefillImageSources((prev) => {
                const next = { ...prev };
                for (const s of IMAGE_SOURCES) {
                  next[s.key] = { source: s.key, label: s.label, images: [], status: 'idle' };
                }
                return next;
              });
            }
          },
          onFieldStart: ({ field, fieldsCompleted, totalFields }) => {
            setAiPrefillCurrentField(field);
            setAiPrefillFieldProgress({ completed: fieldsCompleted, total: totalFields });
          },
          onFieldComplete: ({ field, fieldsCompleted, totalFields }) => {
            markAiPrefillFieldComplete(field);
            setAiPrefillFieldProgress({ completed: fieldsCompleted, total: totalFields });
          },
          onImageSourceStart: (source) => {
            setAiPrefillImageSources((prev) => ({
              ...prev,
              [source]: { ...prev[source], status: 'loading', images: [], error: undefined },
            }));
          },
          onImageSourceDone: (result) => {
            setAiPrefillImageSources((prev) => ({
              ...prev,
              [result.source]: result,
            }));
          },
          onImageUploadProgress: (info) => {
            setAiPrefillImageUpload(info);
          },
          onPlantProgress: ({ current, total, plantName }) => {
            setAiPrefillProgress({ current, total });
            setAiPrefillCurrentPlant(plantName);
            // Track start time for new plant
            plantStartTime = Date.now();
            setAiPrefillPlantStartTime(plantStartTime);
          },
          onPlantComplete: ({ plantName, requestId, success, error }) => {
            const durationMs = Date.now() - plantStartTime;
            setAiPrefillCompletedPlants((prev) => [...prev, { name: plantName, success, error, durationMs }]);
            if (success) {
              // Remove completed plant from the local list immediately for visual feedback
              setPlantRequests((prev) => prev.filter((req) => req.id !== requestId));
              // Decrease accurate counts
              setPlantRequestsTotalCount((prev) => Math.max(0, prev - 1));
            } else if (error && !isCancellationError(error)) {
              // Only log real errors, not cancellations (which are intentional user actions)
              console.error(`Failed to process ${plantName}:`, error);
            }
          },
          onError: (error) => {
            if (!abortController.signal.aborted) {
              setAiPrefillError(error);
            }
          },
        }
      );
      
      // Refresh the requests list after completion
      await loadPlantRequests({ initial: false });
      
    } catch (err) {
      // Only set error for non-cancellation errors
      if (!abortController.signal.aborted && !isCancellationError(err)) {
        const msg = err instanceof Error ? err.message : String(err);
        setAiPrefillError(msg);
      }
    } finally {
      setAiPrefillRunning(false);
      setAiPrefillAbortController(null);
      setAiPrefillCurrentPlant(null);
      setAiPrefillProgress({ current: 0, total: 0 });
      setAiPrefillStatus('idle');
      setAiPrefillCurrentField(null);
      setAiPrefillFieldProgress({ completed: 0, total: 0 });
      setAiPrefillStartTime(null);
      setAiPrefillPlantStartTime(null);
    }
  }, [aiPrefillRunning, plantRequests, profile?.display_name, loadPlantRequests, initAiPrefillCategoryProgress, markAiPrefillFieldComplete]);

  const stopAiPrefill = React.useCallback(() => {
    if (aiPrefillAbortController) {
      aiPrefillAbortController.abort();
      setAiPrefillError('AI Prefill was cancelled by user');
    }
  }, [aiPrefillAbortController]);

  // Presence fallback removed by request: rely on DB-backed API only

  // --- Health monitor: ping API, Admin, DB every minute ---
  type ProbeResult = {
    ok: boolean | null;
    latencyMs: number | null;
    updatedAt: number | null;
    status: number | null;
    errorCode: string | null;
    errorMessage: string | null;
  };
  const emptyProbe: ProbeResult = {
    ok: null,
    latencyMs: null,
    updatedAt: null,
    status: null,
    errorCode: null,
    errorMessage: null,
  };
  const [apiProbe, setApiProbe] = React.useState<ProbeResult>(emptyProbe);
  const [adminProbe, setAdminProbe] = React.useState<ProbeResult>(emptyProbe);
  const [dbProbe, setDbProbe] = React.useState<ProbeResult>(emptyProbe);
  const [healthRefreshing, setHealthRefreshing] =
    React.useState<boolean>(false);

  // --- System Health Stats ---
  type SystemHealthStats = {
    uptime: number | null; // seconds
    memory: { used: number; total: number; percent: number } | null;
    cpu: { percent: number; cores: number } | null;
    disk: { used: number; total: number; percent: number; path: string } | null;
    connections: number | null;
    nodeVersion: string | null;
    platform: string | null;
    loadAvg: number[] | null;
  };
  const emptySystemHealth: SystemHealthStats = {
    uptime: null,
    memory: null,
    cpu: null,
    disk: null,
    connections: null,
    nodeVersion: null,
    platform: null,
    loadAvg: null,
  };
  const [systemHealth, setSystemHealth] = React.useState<SystemHealthStats>(emptySystemHealth);
  const [systemHealthLoading, setSystemHealthLoading] = React.useState<boolean>(true);
  const [systemHealthError, setSystemHealthError] = React.useState<string | null>(null);

  // Track mount state to avoid setState on unmounted component during async probes
  const isMountedRef = React.useRef(true);
  React.useEffect(() => {
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const probeEndpoint = React.useCallback(
    async (
      url: string,
      okCheck?: (body: unknown) => boolean,
    ): Promise<ProbeResult> => {
      const started = Date.now();
      try {
        const headers: Record<string, string> = { Accept: "application/json" };
        try {
          const token = (await supabase.auth.getSession()).data.session
            ?.access_token;
          if (token) headers["Authorization"] = `Bearer ${token}`;
          const staticToken = (globalThis as EnvWithAdminToken)?.__ENV__
            ?.VITE_ADMIN_STATIC_TOKEN;
          if (staticToken) headers["X-Admin-Token"] = staticToken;
        } catch {}
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10000);
        try {
          const resp = await fetch(url, {
            headers,
            credentials: "same-origin",
            signal: controller.signal,
          });
          clearTimeout(timeoutId);
          const body = await safeJson(resp);
          const isOk =
            typeof okCheck === "function"
              ? resp.ok && okCheck(body)
              : resp.ok && body?.ok === true;
          const latency = Date.now() - started;
          if (isOk) {
            return {
              ok: true,
              latencyMs: latency,
              updatedAt: Date.now(),
              status: resp.status,
              errorCode: null,
              errorMessage: null,
            };
          }
          const errorCodeFromBody =
            typeof body?.errorCode === "string" && body.errorCode
              ? body.errorCode
              : null;
          const errorMessageFromBody =
            typeof body?.error === "string" && body.error ? body.error : null;
          const fallbackCode = !resp.ok
            ? `HTTP_${resp.status}`
            : errorCodeFromBody || "CHECK_FAILED";
          return {
            ok: false,
            latencyMs: null,
            updatedAt: Date.now(),
            status: resp.status,
            errorCode: errorCodeFromBody || fallbackCode,
            errorMessage: errorMessageFromBody,
          };
        } catch (fetchError: unknown) {
          clearTimeout(timeoutId);
          if (fetchError instanceof Error && fetchError.name === "AbortError") {
            return {
              ok: false,
              latencyMs: null,
              updatedAt: Date.now(),
              status: null,
              errorCode: "TIMEOUT",
              errorMessage: "Request timed out",
            };
          }
          throw fetchError;
        }
      } catch {
        return {
          ok: false,
          latencyMs: null,
          updatedAt: Date.now(),
          status: null,
          errorCode: "NETWORK_ERROR",
          errorMessage: null,
        };
      }
    },
    [safeJson],
  );

  const probeDbWithFallback =
    React.useCallback(async (): Promise<ProbeResult> => {
      const started = Date.now();
      try {
        const resp = await fetch("/api/health/db", {
          headers: { Accept: "application/json" },
          credentials: "same-origin",
        });
        const elapsedMs = Date.now() - started;
        const body = await safeJson(resp);
        if (resp.ok && body?.ok === true) {
          return {
            ok: true,
            latencyMs: Number.isFinite(body?.latencyMs)
              ? body.latencyMs
              : elapsedMs,
            updatedAt: Date.now(),
            status: resp.status,
            errorCode: null,
            errorMessage: null,
          };
        }
        const errorCodeFromBody =
          typeof body?.errorCode === "string" && body.errorCode
            ? body.errorCode
            : null;
        const errorMessageFromBody =
          typeof body?.error === "string" && body.error ? body.error : null;
        const fallbackCode = !resp.ok
          ? `HTTP_${resp.status}`
          : errorCodeFromBody || "CHECK_FAILED";
        const t2Start = Date.now();
        const { error } = await supabase
          .from("plants")
          .select("id", { head: true, count: "exact" })
          .limit(1);
        const t2 = Date.now() - t2Start;
        if (!error) {
          return {
            ok: true,
            latencyMs: t2,
            updatedAt: Date.now(),
            status: null,
            errorCode: null,
            errorMessage: null,
          };
        }
        return {
          ok: false,
          latencyMs: null,
          updatedAt: Date.now(),
          status: resp.status,
          errorCode: errorCodeFromBody || fallbackCode,
          errorMessage: errorMessageFromBody,
        };
      } catch {
        try {
          await supabase.auth.getSession();
          return {
            ok: true,
            latencyMs: Date.now() - started,
            updatedAt: Date.now(),
            status: null,
            errorCode: null,
            errorMessage: null,
          };
        } catch {
          return {
            ok: false,
            latencyMs: null,
            updatedAt: Date.now(),
            status: null,
            errorCode: "NETWORK_ERROR",
            errorMessage: null,
          };
        }
      }
    }, [safeJson]);

  const runHealthProbes = React.useCallback(async () => {
    const [apiRes, adminRes, dbRes] = await Promise.all([
      probeEndpoint("/api/health", (b) => b?.ok === true).catch(() => ({
        ok: false,
        latencyMs: null,
        updatedAt: Date.now(),
        status: null,
        errorCode: "NETWORK_ERROR",
        errorMessage: "Failed to probe API",
      })),
      probeEndpoint(
        "/api/admin/stats",
        (b) => b?.ok === true && typeof b?.profilesCount === "number",
      ).catch(() => ({
        ok: false,
        latencyMs: null,
        updatedAt: Date.now(),
        status: null,
        errorCode: "NETWORK_ERROR",
        errorMessage: "Failed to probe Admin API",
      })),
      probeDbWithFallback().catch(() => ({
        ok: false,
        latencyMs: null,
        updatedAt: Date.now(),
        status: null,
        errorCode: "NETWORK_ERROR",
        errorMessage: "Failed to probe Database",
      })),
    ]);
    if (isMountedRef.current) {
      setApiProbe(apiRes);
      setAdminProbe(adminRes);
      setDbProbe(dbRes);
    }
  }, [probeEndpoint, probeDbWithFallback]);

  const refreshHealth = React.useCallback(async () => {
    if (healthRefreshing) return;
    setHealthRefreshing(true);
    try {
      await runHealthProbes();
    } finally {
      if (isMountedRef.current) setHealthRefreshing(false);
    }
  }, [healthRefreshing, runHealthProbes]);

  // Run health probes on initial load and periodically
  React.useEffect(() => {
    // Run immediately on mount (no delay)
    runHealthProbes();
    // Then every 60 seconds
    const intervalId = setInterval(() => {
      runHealthProbes();
    }, 60000);
    return () => clearInterval(intervalId);
  }, [runHealthProbes]);

  const softRefreshAdmin = React.useCallback(() => {
    try {
      refreshHealth();
    } catch {}
  }, [refreshHealth]);

  // --- System Health Stats fetching ---
  const loadSystemHealth = React.useCallback(async () => {
    try {
      const session = (await supabase.auth.getSession()).data.session;
      const token = session?.access_token;
      const headers: Record<string, string> = { Accept: "application/json" };
      if (token) headers["Authorization"] = `Bearer ${token}`;
      try {
        const adminToken = (globalThis as EnvWithAdminToken)?.__ENV__?.VITE_ADMIN_STATIC_TOKEN;
        if (adminToken) headers["X-Admin-Token"] = String(adminToken);
      } catch {}
      const resp = await fetch("/api/admin/system-health", {
        headers,
        credentials: "same-origin",
      });
      const data = await safeJson(resp);
      if (!resp.ok) throw new Error(data?.error || `HTTP ${resp.status}`);
      if (isMountedRef.current) {
        setSystemHealth({
          uptime: typeof data?.uptime === "number" ? data.uptime : null,
          memory: data?.memory && typeof data.memory.percent === "number" ? data.memory : null,
          cpu: data?.cpu && typeof data.cpu.percent === "number" ? data.cpu : null,
          disk: data?.disk && typeof data.disk.percent === "number" ? data.disk : null,
          connections: typeof data?.connections === "number" ? data.connections : null,
          nodeVersion: typeof data?.nodeVersion === "string" ? data.nodeVersion : null,
          platform: typeof data?.platform === "string" ? data.platform : null,
          loadAvg: Array.isArray(data?.loadAvg) ? data.loadAvg : null,
        });
        setSystemHealthError(null);
      }
    } catch (e: unknown) {
      if (isMountedRef.current) {
        setSystemHealthError(e instanceof Error ? e.message : "Failed to load system health");
      }
    } finally {
      if (isMountedRef.current) setSystemHealthLoading(false);
    }
  }, [safeJson]);

  // Load system health on mount and periodically
  React.useEffect(() => {
    loadSystemHealth();
    const intervalId = setInterval(() => {
      loadSystemHealth();
    }, 30000); // Every 30 seconds
    return () => clearInterval(intervalId);
  }, [loadSystemHealth]);

  // Helper to format uptime
  const formatUptime = (seconds: number | null): string => {
    if (seconds === null) return "-";
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    if (days > 0) return `${days}d ${hours}h ${mins}m`;
    if (hours > 0) return `${hours}h ${mins}m`;
    return `${mins}m`;
  };

  // Helper to format bytes
  const formatBytes = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
  };

  // Progress bar component for system health
  const HealthProgressBar: React.FC<{
    percent: number;
    colorClass?: string;
    showWarning?: boolean;
  }> = ({ percent, colorClass, showWarning = true }) => {
    const getColor = () => {
      if (colorClass) return colorClass;
      if (!showWarning) return "bg-emerald-500";
      if (percent >= 90) return "bg-rose-500";
      if (percent >= 75) return "bg-amber-500";
      return "bg-emerald-500";
    };
    return (
      <div className="h-2 w-full bg-stone-200 dark:bg-stone-700 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-500 ${getColor()}`}
          style={{ width: `${Math.min(100, Math.max(0, percent))}%` }}
        />
      </div>
    );
  };

  const StatusDot: React.FC<{ ok: boolean | null; title?: string }> = ({
    ok,
    title,
  }) => (
    <span
      className={`inline-block h-3 w-3 rounded-full ? ${ok === null ? "bg-zinc-400" : ok ? "bg-emerald-600 dark:bg-emerald-500" : "bg-rose-600 dark:bg-rose-500"}`}
      aria-label={ok === null ? "unknown" : ok ? "ok" : "error"}
      title={title}
    />
  );

  const ErrorBadge: React.FC<{ code: string | null }> = ({ code }) => {
    if (!code) return null;
    return (
      <span className="text-[11px] px-1.5 py-0.5 rounded border bg-rose-100 dark:bg-rose-900/40 text-rose-800 dark:text-rose-200 border-rose-300 dark:border-rose-700">
        {code}
      </span>
    );
  };

  // ---- Branch management state ----
  const [branchesLoading, setBranchesLoading] = React.useState<boolean>(true);
  const [branchesRefreshing, setBranchesRefreshing] =
    React.useState<boolean>(false);
  const [branchOptions, setBranchOptions] = React.useState<string[]>([]);
  const [currentBranch, setCurrentBranch] = React.useState<string>("");
  const [selectedBranch, setSelectedBranch] = React.useState<string>("");
  const [lastUpdateTime, setLastUpdateTime] = React.useState<string | null>(
    null,
  );

  // Add loading state timeouts to prevent infinite loading (moved after state declarations)
  // IMPORTANT: Only clear loading states, NEVER clear data values
  React.useEffect(() => {
    const MAX_LOADING_TIMEOUT = 30000; // 30 seconds max loading time (increased)
    const timeoutId = setTimeout(() => {
      // Only clear loading states if they're still loading - don't touch data
      if (branchesLoading) {
        console.warn(
          "[AdminPage] Branches loading timeout - clearing loading state only",
        );
        setBranchesLoading(false);
      }
      if (registeredLoading) {
        console.warn(
          "[AdminPage] Registered count loading timeout - clearing loading state only",
        );
        setRegisteredLoading(false);
      }
      if (onlineLoading) {
        console.warn(
          "[AdminPage] Online users loading timeout - clearing loading state only",
        );
        setOnlineLoading(false);
      }
      if (ipsLoading) {
        console.warn(
          "[AdminPage] IPs loading timeout - clearing loading state only",
        );
        setIpsLoading(false);
      }
      if (visitorsLoading) {
        console.warn(
          "[AdminPage] Visitors loading timeout - clearing loading state only",
        );
        setVisitorsLoading(false);
      }
    }, MAX_LOADING_TIMEOUT);

    return () => clearTimeout(timeoutId);
  }, [
    branchesLoading,
    registeredLoading,
    onlineLoading,
    ipsLoading,
    visitorsLoading,
  ]);

  const loadBranches = React.useCallback(
    async (opts?: { initial?: boolean }) => {
      const isInitial = !!opts?.initial;
      if (isInitial) setBranchesLoading(true);
      else setBranchesRefreshing(true);
      try {
        const headersNode: Record<string, string> = {
          Accept: "application/json",
          // Prevent browser caching to ensure fresh branch data
          "Cache-Control": "no-cache, no-store, must-revalidate",
          Pragma: "no-cache",
        };
        try {
          const session = (await supabase.auth.getSession()).data.session;
          const token = session?.access_token;
          if (token) headersNode["Authorization"] = `Bearer ${token}`;
        } catch {}
        // Add cache-busting query param and disable caching to ensure fresh data
        const cacheBuster = `_t=${Date.now()}`;
        const respNode = await fetchWithRetry(`/api/admin/branches?${cacheBuster}`, {
          headers: headersNode,
          credentials: "same-origin",
          cache: "no-store",
        }).catch(() => null);
        let data = await safeJson(respNode || new Response());
        // Guard against accidental inclusion of non-branch items
        if (Array.isArray(data?.branches)) {
          data.branches = data.branches.filter(
            (b: string) => b && b !== "origin" && b !== "HEAD",
          );
        }
        const ok = respNode?.ok && Array.isArray(data?.branches);
        if (!ok) {
          const adminHeaders: Record<string, string> = {
            Accept: "application/json",
            // Prevent browser caching to ensure fresh branch data
            "Cache-Control": "no-cache, no-store, must-revalidate",
            Pragma: "no-cache",
          };
          try {
            const adminToken = (globalThis as EnvWithAdminToken)?.__ENV__
              ?.VITE_ADMIN_STATIC_TOKEN;
            if (adminToken) adminHeaders["X-Admin-Token"] = String(adminToken);
          } catch {}
          // Add cache-busting query param and disable caching to ensure fresh data
          const adminCacheBuster = `_t=${Date.now()}`;
          const respAdmin = await fetchWithRetry(`/admin/branches?${adminCacheBuster}`, {
            headers: adminHeaders,
            credentials: "same-origin",
            cache: "no-store",
          }).catch(() => null);
          if (respAdmin) {
            data = await safeJson(respAdmin);
            if (Array.isArray(data?.branches)) {
              data.branches = data.branches.filter(
                (b: string) => b && b !== "origin" && b !== "HEAD",
              );
            }
            if (!respAdmin.ok || !Array.isArray(data?.branches))
              throw new Error(data?.error || `HTTP ${respAdmin.status}`);
          } else {
            throw new Error("Failed to connect to API");
          }
        }
        const branches: string[] = data.branches;
        const current: string = String(data.current || "");
        const lastUpdate: string | null = data.lastUpdateTime || null;
        setBranchOptions(branches);
        setCurrentBranch(current);
        setLastUpdateTime(lastUpdate);
        setSelectedBranch((prev) => {
          if (!prev) return current;
          return branches.includes(prev) ? prev : current;
        });
      } catch (e) {
        console.error("[AdminPage] Failed to load branches:", e);
        // Don't clear existing data on error - keep what we have
        // Only clear on initial load if we have no data yet
        if (isInitial && branchOptions.length === 0) {
          // Only clear if we truly have no data
        }
      } finally {
        if (isInitial) setBranchesLoading(false);
        else setBranchesRefreshing(false);
      }
    },
    [safeJson, fetchWithRetry, branchOptions.length],
  );

  React.useEffect(() => {
    // Stagger initial load to avoid blocking
    const timeoutId = setTimeout(() => {
      loadBranches({ initial: true });
    }, 150);
    return () => clearTimeout(timeoutId);
  }, [loadBranches]);

  const pullLatest = async () => {
    if (pulling) return;
    setPulling(true);
    // Enable Sentry maintenance mode to suppress expected 502/400 errors during pull and restart
    enableMaintenanceMode(300000, 'pull-and-build'); // 5 minutes for pull, build, and restart operations
    try {
      // Use streaming endpoint for live logs
      setConsoleLines([]);
      setConsoleOpen(true);
      appendConsole("[pull] Pull & Build: starting?");
      if (selectedBranch && selectedBranch !== currentBranch) {
        appendConsole(`[pull] Will switch to branch: ? ${selectedBranch}`);
      } else if (currentBranch) {
        appendConsole(`[pull] Staying on branch: ? ${currentBranch}`);
      }
        setReloadReady(false);
        const baselineUpdateTime = lastUpdateTime || null;
        const session = (await supabase.auth.getSession()).data.session;
        const token = session?.access_token;
        let adminToken: string | null = null;
        try {
          adminToken =
            ((globalThis as EnvWithAdminToken)?.__ENV__?.VITE_ADMIN_STATIC_TOKEN as
              | string
              | undefined
              | null) || null;
        } catch {
          adminToken = null;
        }
        const authHeaders: Record<string, string> = {};
        if (token) authHeaders["Authorization"] = `Bearer ${token}`;
        if (adminToken) authHeaders["X-Admin-Token"] = String(adminToken);
        const sseHeaders = { ...authHeaders };
        const nodeJsonHeaders = { ...authHeaders, Accept: "application/json" };
        const adminSseHeaders: Record<string, string> = {};
        if (adminToken) adminSseHeaders["X-Admin-Token"] = String(adminToken);
        const adminJsonHeaders = {
          ...adminSseHeaders,
          Accept: "application/json",
        };
        const adminJsonPostHeaders = {
          ...adminJsonHeaders,
          "Content-Type": "application/json",
        };

        const fetchLastUpdateTimestamp = async (): Promise<string | null> => {
          try {
            const respNode = await fetchWithRetry("/api/admin/branches", {
              headers: nodeJsonHeaders,
              credentials: "same-origin",
            }).catch(() => null);
            if (respNode && respNode.ok) {
              const data = await safeJson(respNode);
              if (data?.lastUpdateTime) return String(data.lastUpdateTime);
            }
          } catch {}
          try {
            const respAdmin = await fetchWithRetry("/admin/branches", {
              headers: adminJsonHeaders,
              credentials: "same-origin",
            }).catch(() => null);
            if (respAdmin && respAdmin.ok) {
              const data = await safeJson(respAdmin);
              if (data?.lastUpdateTime) return String(data.lastUpdateTime);
            }
          } catch {}
          return null;
        };

        const waitForBackgroundCompletion = async (): Promise<boolean> => {
          const timeoutMs = 4 * 60 * 1000;
          const pollMs = 4000;
          const started = Date.now();
          while (Date.now() - started < timeoutMs) {
            const ts = await fetchLastUpdateTimestamp();
            if (ts && ts !== baselineUpdateTime) {
              setLastUpdateTime(ts);
              return true;
            }
            await new Promise((resolve) => setTimeout(resolve, pollMs));
          }
          return false;
        };
      const branchParam =
        selectedBranch && selectedBranch !== currentBranch
          ? `?branch=${encodeURIComponent(selectedBranch)}`
          : "";
      let resp: Response | null = null;
      // Try Node server SSE first
        try {
          resp = await fetch(`/api/admin/pull-code/stream${branchParam}`, {
            method: "GET",
            headers: sseHeaders,
            credentials: "same-origin",
          });
        } catch {}
      // Fallback to Admin API SSE if Node is down or forbidden
      if (!resp || !resp.ok || !resp.body) {
        try {
          resp = await fetch(`/admin/pull-code/stream${branchParam}`, {
            method: "GET",
              headers: adminSseHeaders,
            credentials: "same-origin",
          });
        } catch {}
      }
      if (!resp || !resp.ok || !resp.body) {
        // Last resort: fire-and-forget refresh via Admin API without stream
        const bg = await fetch(`/admin/pull-code${branchParam}`, {
          method: "POST",
            headers: adminJsonPostHeaders,
          credentials: "same-origin",
          body: "{}",
        });
        const bgBody = await safeJson(bg);
        if (!bg.ok || bgBody?.ok !== true) {
          throw new Error(bgBody?.error || `Refresh failed (${bg.status})`);
        }
        appendConsole("[pull] Started background refresh via Admin API.");
        appendConsole(
          "[pull] Not restarting services automatically without build status. Use streamed mode to auto-restart.",
        );
        // Skip SSE consumption and do not restart services automatically
      } else {
        const reader = resp.body.getReader();
        const decoder = new TextDecoder();
        let buf = "";
        const append = (line: string) => appendConsole(line);
        let currentEvent: string | null = null;
        let sawDoneEvent = false;
        let buildOk = false;
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buf += decoder.decode(value, { stream: true });
          let idx;
          while ((idx = buf.indexOf("\n")) >= 0) {
            const raw = buf.slice(0, idx);
            buf = buf.slice(idx + 1);
            const line = raw.replace(/\r$/, "");
            if (!line) continue;
            if (line.startsWith("event:")) {
              currentEvent = line.slice(6).trim();
            } else if (line.startsWith("data:")) {
              const payload = line.slice(5).trimStart();
              if (currentEvent === "done") {
                try {
                  const obj = JSON.parse(payload);
                  if (obj && typeof obj.ok === "boolean") {
                    sawDoneEvent = true;
                    buildOk = !!obj.ok;
                  }
                } catch {}
              }
              append(payload);
            } else if (!/^(:|event:|id:|retry:)/.test(line)) {
              append(line);
            }
          }
        }
          let success = sawDoneEvent && buildOk;
          if (!success) {
            if (sawDoneEvent && !buildOk) {
              appendConsole(
                "[pull] Build or validation failed. Website remains on the previous version; not restarting services.",
              );
              return;
            }
            appendConsole(
              "[pull] Stream finished without a terminal result; waiting for background completion…",
            );
            const backgroundOk = await waitForBackgroundCompletion();
            if (!backgroundOk) {
              appendConsole(
                "[pull] Could not confirm background build completion. Please retry once logs are available.",
              );
              return;
            }
            appendConsole(
              "[pull] Background build finished. Proceeding to restart services.",
            );
            success = true;
          }
      }

      // Show a non-blocking orange notice just before restarts
      setPreRestartNotice(true);

      // Ensure both Admin API and Node API are restarted after successful build
        try {
          if (adminToken) {
            await fetch("/admin/restart-app", {
              method: "POST",
              headers: {
                "X-Admin-Token": String(adminToken),
                "Content-Type": "application/json",
                Accept: "application/json",
              },
              credentials: "same-origin",
              body: JSON.stringify({ service: "admin-api" }),
            }).catch(() => {});
          }
        } catch {}
      // Then restart the Node service via our API (includes health poll)
      try {
        await restartServer();
      } catch {}
      try {
        await loadBranches({ initial: false });
      } catch {}
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : String(e);
      appendConsole(`[pull] Failed to pull & build: ? ${message}`);
    } finally {
      setPulling(false);
      // Disable maintenance mode now that pull & build is complete (or failed)
      disableMaintenanceMode();
    }
  };

  // Backup UI disabled for now

    // Loader for total registered accounts & plants (DB first via admin API; fallback to client count)
    const loadRegisteredCount = React.useCallback(
      async (opts?: { initial?: boolean }) => {
        const isInitial = !!opts?.initial;
        if (isInitial) {
          setRegisteredLoading(true);
          setPlantsLoading(true);
        } else {
          setRegisteredRefreshing(true);
          setPlantsRefreshing(true);
        }
        try {
          const session = (await supabase.auth.getSession()).data.session;
          const token = session?.access_token;
          const headers: Record<string, string> = { Accept: "application/json" };
          if (token) headers["Authorization"] = `Bearer ${token}`;
          try {
            const adminToken = (globalThis as EnvWithAdminToken)?.__ENV__
              ?.VITE_ADMIN_STATIC_TOKEN;
            if (adminToken) headers["X-Admin-Token"] = String(adminToken);
          } catch {}
          const resp = await fetchWithRetry("/api/admin/stats", {
            headers,
            credentials: "same-origin",
          }).catch(() => null);
          let registeredUpdated = false;
          let plantsUpdated = false;
          if (resp && resp.ok) {
            const data = await safeJson(resp);
            if (typeof data?.profilesCount === "number") {
              setRegisteredCount(data.profilesCount);
              setRegisteredUpdatedAt(Date.now());
              registeredUpdated = true;
            }
            if (typeof data?.plantsCount === "number") {
              setPlantsCount(data.plantsCount);
              setPlantsUpdatedAt(Date.now());
              plantsUpdated = true;
            }
          }
          // Fallback: client-side counts (may be limited by RLS)
          if (!registeredUpdated) {
            const { count, error } = await supabase
              .from("profiles")
              .select("id", { count: "exact", head: true });
            if (!error && typeof count === "number") {
              setRegisteredCount(count);
              setRegisteredUpdatedAt(Date.now());
              registeredUpdated = true;
            }
          }
          if (!plantsUpdated) {
            const { count: totalPlants, error: plantsError } = await supabase
              .from("plants")
              .select("id", { count: "exact", head: true });
            if (!plantsError && typeof totalPlants === "number") {
              setPlantsCount(totalPlants);
              setPlantsUpdatedAt(Date.now());
            }
          }
          // Don't set to 0 on error - keep previous value
        } catch (e) {
          console.error("[AdminPage] Failed to load overview counts:", e);
          // Keep last known values on error - don't set to 0
        } finally {
          if (isInitial) {
            setRegisteredLoading(false);
            setPlantsLoading(false);
          } else {
            setRegisteredRefreshing(false);
            setPlantsRefreshing(false);
          }
        }
      },
      [safeJson, fetchWithRetry],
    );

  React.useEffect(() => {
    // Stagger initial load to avoid blocking
    const timeoutId = setTimeout(() => {
      loadRegisteredCount({ initial: true });
    }, 200);
    return () => clearTimeout(timeoutId);
  }, [loadRegisteredCount]);

  // Auto-refresh registered accounts every 60 seconds
  React.useEffect(() => {
    const id = setInterval(() => {
      loadRegisteredCount({ initial: false });
    }, 60_000);
    return () => clearInterval(id);
  }, [loadRegisteredCount]);

  // Loader for "Currently online" (unique IPs in the last 60 minutes, DB-only)
  const loadOnlineUsers = React.useCallback(
    async (opts?: { initial?: boolean }) => {
      const isInitial = !!opts?.initial;
      if (isInitial) setOnlineLoading(true);
      else setOnlineRefreshing(true);
      try {
        // Use dedicated endpoint backed by DB counts; forward Authorization so REST fallback can pass RLS
        const token = (await supabase.auth.getSession()).data.session
          ?.access_token;
        const resp = await fetchWithRetry("/api/admin/online-users", {
          headers: (() => {
            const h: Record<string, string> = { Accept: "application/json" };
            if (token) h["Authorization"] = `Bearer ${token}`;
            const adminToken = (globalThis as EnvWithAdminToken)?.__ENV__
              ?.VITE_ADMIN_STATIC_TOKEN;
            if (adminToken) h["X-Admin-Token"] = String(adminToken);
            return h;
          })(),
          credentials: "same-origin",
        }).catch(() => null);
        if (resp && resp.ok) {
          const data = await safeJson(resp);
          const num = Number(data?.onlineUsers ?? data?.count);
          if (Number.isFinite(num) && num >= 0) {
            setOnlineUsers(num);
            setOnlineUpdatedAt(Date.now());
            return;
          }
        }
        // Don't set to 0 on error - keep last known value
      } catch (e) {
        console.error("[AdminPage] Failed to load online users:", e);
        // Keep last known value on error - don't set to 0
      } finally {
        if (isInitial) setOnlineLoading(false);
        else setOnlineRefreshing(false);
      }
    },
    [fetchWithRetry, safeJson],
  );

  // Initial load (page load only) - staggered
  React.useEffect(() => {
    const timeoutId = setTimeout(() => {
      loadOnlineUsers({ initial: true });
    }, 250);
    return () => clearTimeout(timeoutId);
  }, [loadOnlineUsers]);

  // Auto-refresh the "Currently online" count every minute
  React.useEffect(() => {
    const intervalId = setInterval(() => {
      loadOnlineUsers({ initial: false });
    }, 60_000);
    return () => clearInterval(intervalId);
  }, [loadOnlineUsers]);

  // Loader for list of connected IPs (unique IPs past N minutes; default 60)
  const loadOnlineIpsList = React.useCallback(
    async (opts?: { initial?: boolean; minutes?: number }) => {
      const isInitial = !!opts?.initial;
      const minutes =
        Number.isFinite(opts?.minutes as number) &&
        (opts?.minutes as number)! > 0
          ? Math.floor(opts!.minutes as number)
          : 60;
      if (isInitial) setIpsLoading(true);
      else setIpsRefreshing(true);
      try {
        const session = (await supabase.auth.getSession()).data.session;
        const token = session?.access_token;
        const headers: Record<string, string> = { Accept: "application/json" };
        if (token) headers["Authorization"] = `Bearer ${token}`;
        try {
          const adminToken = (globalThis as EnvWithAdminToken)?.__ENV__
            ?.VITE_ADMIN_STATIC_TOKEN;
          if (adminToken) headers["X-Admin-Token"] = String(adminToken);
        } catch {}
        const resp = await fetchWithRetry(
          `/api/admin/online-ips?minutes=${encodeURIComponent(String(minutes))}`,
          { headers, credentials: "same-origin" },
        ).catch(() => null);
        if (resp && resp.ok) {
          const data = await safeJson(resp);
          const list: string[] = Array.isArray(data?.ips)
            ? data.ips.map((s: unknown) => String(s)).filter(Boolean)
            : [];
          setIps(list);
          return;
        }
        // Don't clear IPs on error - keep last known value
      } catch (e) {
        console.error("[AdminPage] Failed to load IPs:", e);
        // keep last known value
      } finally {
        if (isInitial) setIpsLoading(false);
        else setIpsRefreshing(false);
      }
    },
    [safeJson, fetchWithRetry],
  );

  // Initial load and auto-refresh every 60s - staggered
  React.useEffect(() => {
    const timeoutId = setTimeout(() => {
      loadOnlineIpsList({ initial: true });
    }, 300);
    return () => clearTimeout(timeoutId);
  }, [loadOnlineIpsList]);
  React.useEffect(() => {
    const id = setInterval(() => {
      loadOnlineIpsList({ initial: false });
    }, 60_000);
    return () => clearInterval(id);
  }, [loadOnlineIpsList]);

  // Load visitors stats (last 7 days)
  const [visitorsWindowDays, setVisitorsWindowDays] = React.useState<7 | 30>(7);
  const loadVisitorsStats = React.useCallback(
    async (opts?: { initial?: boolean }) => {
      const isInitial = !!opts?.initial;
      if (isInitial) setVisitorsLoading(true);
      else setVisitorsRefreshing(true);
      try {
        const resp = await fetchWithRetry(
          `/api/admin/visitors-stats?days=${visitorsWindowDays}`,
          {
            headers: { Accept: "application/json" },
            credentials: "same-origin",
          },
        ).catch(() => null);
        if (!resp || !resp.ok) {
          // Keep last known value on error
          return;
        }
        const data = await safeJson(resp);
        const series: Array<{ date: string; uniqueVisitors: number }> =
          Array.isArray(data?.series7d)
            ? data.series7d.map((d: unknown) => {
                const dd = d as Record<string, unknown>;
                return {
                date: String(dd.date),
                uniqueVisitors: Number(
                  dd.uniqueVisitors ?? dd.unique_visitors ?? 0,
                ),
              };
              })
            : [];
        setVisitorsSeries(series);
        // Fetch weekly unique total from dedicated endpoint to keep requests separate
        try {
          const totalResp = await fetchWithRetry(
            "/api/admin/visitors-unique-7d",
            {
              headers: { Accept: "application/json" },
              credentials: "same-origin",
            },
          ).catch(() => null);
          if (totalResp && totalResp.ok) {
            const totalData = await safeJson(totalResp);
            const total7d = Number(
              totalData?.uniqueIps7d ?? totalData?.weeklyUniqueIps7d ?? 0,
            );
            if (Number.isFinite(total7d) && total7d >= 0) {
              setVisitorsTotalUnique7d(total7d);
            }
          }
        } catch {}
        // Load sources breakdown in parallel
        try {
          const sb = await fetchWithRetry(
            `/api/admin/sources-breakdown?days=${visitorsWindowDays}`,
            {
              headers: { Accept: "application/json" },
              credentials: "same-origin",
            },
          ).catch(() => null);
          if (sb && sb.ok) {
            const sbd = await safeJson(sb);
            const tc = Array.isArray(sbd?.topCountries)
              ? sbd.topCountries
                  .map((r: { country?: string; visits?: number }) => ({
                    country: String(r.country || ""),
                    visits: Number(r.visits || 0),
                  }))
                  .filter((x: { country: string }) => !!x.country)
              : [];
            const oc =
              sbd?.otherCountries && typeof sbd.otherCountries === "object"
                ? {
                    count: Number(sbd.otherCountries.count || 0),
                    visits: Number(sbd.otherCountries.visits || 0),
                    codes: Array.isArray(sbd.otherCountries.codes)
                      ? sbd.otherCountries.codes
                          .map((x: unknown) => String(x || ""))
                          .filter(Boolean)
                      : undefined,
                    items: Array.isArray(sbd.otherCountries.items)
                      ? sbd.otherCountries.items
                          .map((it: unknown) => {
                            const item = it as Record<string, unknown>;
                            return {
                              country: String(item?.country || ""),
                              visits: Number(item?.visits || 0),
                            };
                          })
                          .filter((it: { country: string }) => !!it.country)
                      : undefined,
                  }
                : null;
            const totalCountryVisits =
              tc.reduce((a: number, b: { country: string; visits: number }) => a + (b.visits || 0), 0) +
              (oc?.visits || 0);
            const countriesWithPct =
              totalCountryVisits > 0
                ? tc.map((x: { country: string; visits: number }) => ({
                    ...x,
                    pct: (x.visits / totalCountryVisits) * 100,
                  }))
                : tc.map((x: { country: string; visits: number }) => ({
                    ...x,
                    pct: 0,
                  }));
            const ocWithPct = oc
              ? {
                  ...oc,
                  pct:
                    totalCountryVisits > 0
                      ? (oc.visits / totalCountryVisits) * 100
                      : 0,
                }
              : null;

            const tr = Array.isArray(sbd?.topReferrers)
              ? sbd.topReferrers.map(
                  (r: { source?: string; visits?: number }) => ({
                    source: String(r.source || "direct"),
                    visits: Number(r.visits || 0),
                  }),
                )
              : [];
            const orf =
              sbd?.otherReferrers && typeof sbd.otherReferrers === "object"
                ? {
                    count: Number(sbd.otherReferrers.count || 0),
                    visits: Number(sbd.otherReferrers.visits || 0),
                  }
                : null;
            const totalRefVisits =
              tr.reduce((a: number, b: { source: string; visits: number }) => a + (b.visits || 0), 0) +
              (orf?.visits || 0);
            const refsWithPct =
              totalRefVisits > 0
                ? tr.map((x: { source: string; visits: number }) => ({
                    ...x,
                    pct: (x.visits / totalRefVisits) * 100,
                  }))
                : tr.map((x: { source: string; visits: number }) => ({
                    ...x,
                    pct: 0,
                  }));
            const orfWithPct = orf
              ? {
                  ...orf,
                  pct:
                    totalRefVisits > 0
                      ? (orf.visits / totalRefVisits) * 100
                      : 0,
                }
              : null;

            setTopCountries(countriesWithPct);
            setOtherCountries(ocWithPct);
            setTopReferrers(refsWithPct);
            setOtherReferrers(orfWithPct);
          }
        } catch {}
        setVisitorsUpdatedAt(Date.now());
      } catch (e) {
        console.error("[AdminPage] Failed to load visitors stats:", e);
        // keep last known value
      } finally {
        if (isInitial) setVisitorsLoading(false);
        else setVisitorsRefreshing(false);
      }
    },
    [visitorsWindowDays, safeJson, fetchWithRetry],
  );

  React.useEffect(() => {
    // Stagger initial load to avoid blocking - visitors stats are heavy
    const timeoutId = setTimeout(() => {
      loadVisitorsStats({ initial: true });
    }, 400);
    return () => clearTimeout(timeoutId);
  }, [loadVisitorsStats]);

  // Auto-refresh visitors graph every 60 seconds
  React.useEffect(() => {
    const id = setInterval(() => {
      loadVisitorsStats({ initial: false });
    }, 60_000);
    return () => clearInterval(id);
  }, [loadVisitorsStats]);

  // ---- Members tab state ----
  // Check if user has full admin access (not just editor)
  const isFullAdmin = checkFullAdminAccess(profile);
  
  // Define all nav items with admin-only flag
  const allNavItems: Array<{
    key: AdminTab;
    label: string;
    Icon: React.ComponentType<{ className?: string }>;
    path: string;
    adminOnly?: boolean;
  }> = [
    { key: "overview", label: "Overview", Icon: LayoutDashboard, path: "/admin", adminOnly: true },
    { key: "members", label: "Members", Icon: Users, path: "/admin/members", adminOnly: true },
    { key: "plants", label: "Plants", Icon: Leaf, path: "/admin/plants" },
    { key: "bugs", label: "Bugs", Icon: Bug, path: "/admin/bugs", adminOnly: true },
    { key: "stocks", label: "Stocks", Icon: Package, path: "/admin/stocks", adminOnly: true },
    { key: "upload", label: "Upload and Media", Icon: CloudUpload, path: "/admin/upload" },
    { key: "notifications", label: "Notifications", Icon: BellRing, path: "/admin/notifications" },
    { key: "emails", label: "Emails", Icon: Mail, path: "/admin/emails" },
    { key: "admin_logs", label: "Advanced", Icon: ScrollText, path: "/admin/advanced", adminOnly: true },
  ];
  
  // Filter nav items based on user's access level (allNavItems excluded - constant in component, would defeat memo)
  const navItems = React.useMemo(() => {
    if (isFullAdmin) return allNavItems;
    return allNavItems.filter(item => !item.adminOnly);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isFullAdmin]);

  const activeTab: AdminTab = React.useMemo(() => {
    if (currentPath.includes("/admin/members")) return "members";
    if (currentPath.includes("/admin/plants")) return "plants";
    if (currentPath.includes("/admin/bugs")) return "bugs";
    if (currentPath.includes("/admin/stocks")) return "stocks";
    if (currentPath.includes("/admin/upload")) return "upload";
    if (currentPath.includes("/admin/notifications")) return "notifications";
    if (currentPath.includes("/admin/emails")) return "emails";
    if (currentPath.includes("/admin/advanced")) return "admin_logs";
    return "overview";
  }, [currentPath]);
  
  // Redirect editors away from admin-only tabs
  React.useEffect(() => {
    if (isFullAdmin) return; // Admins can access everything
    const adminOnlyTabs: AdminTab[] = ["overview", "members", "stocks", "admin_logs"];
    if (adminOnlyTabs.includes(activeTab)) {
      // Redirect to plants tab (default for editors)
      navigate("/admin/plants", { replace: true });
    }
  }, [activeTab, isFullAdmin, navigate]);
  const [sidebarCollapsed, setSidebarCollapsed] = React.useState(false);
  const toggleSidebarCollapsed = React.useCallback(
    () => setSidebarCollapsed((prev) => !prev),
    [],
  );

  // Load plant requests on mount to show count in menu
  React.useEffect(() => {
    if (!plantRequestsInitialized) {
      loadPlantRequests({ initial: true });
    }
  }, [plantRequestsInitialized, loadPlantRequests]);

  React.useEffect(() => {
    if (activeTab !== "plants" || plantRequestsInitialized) return;
    loadPlantRequests({ initial: true });
  }, [activeTab, plantRequestsInitialized, loadPlantRequests]);

  // Re-fetch when staff filter toggles so the visible list fills to the limit
  const hideStaffPrevRef = React.useRef(hideStaffRequests);
  React.useEffect(() => {
    if (hideStaffPrevRef.current === hideStaffRequests) return;
    hideStaffPrevRef.current = hideStaffRequests;
    if (plantRequestsInitialized) {
      loadPlantRequests({ initial: false });
    }
  }, [hideStaffRequests, plantRequestsInitialized, loadPlantRequests]);

  React.useEffect(() => {
    if (
      activeTab !== "plants" ||
      !plantViewIsPlants ||
      plantDashboardInitialized ||
      plantDashboardLoading
    ) {
      return;
    }
    loadPlantDashboard();
  }, [
    activeTab,
    plantViewIsPlants,
    plantDashboardInitialized,
    plantDashboardLoading,
    loadPlantDashboard,
  ]);

  // Auto-navigate to the new plant when duplication succeeds from the plant list (not via dialog)
  React.useEffect(() => {
    if (addFromDuplicateSuccess && !addFromDialogOpen) {
      const { id, originalName } = addFromDuplicateSuccess;
      // Clear the success state before navigating
      setAddFromDuplicateSuccess(null);
      // Navigate to the new plant's edit page
      navigate(`/create/${id}?duplicatedFrom=${encodeURIComponent(originalName)}`);
    }
  }, [addFromDuplicateSuccess, addFromDialogOpen, navigate]);

  const membersView: "search" | "list" | "reports" = React.useMemo(() => {
    if (currentPath.includes("/admin/members/reports")) return "reports";
    if (currentPath.includes("/admin/members/list")) return "list";
    return "search";
  }, [currentPath]);
  
  // Active reports count for showing danger indicator on Members nav
  const [activeReportsCount, setActiveReportsCount] = React.useState(0);
  
  // Pending bug reports count for showing indicator on Bugs nav
  const [pendingBugReportsCount, setPendingBugReportsCount] = React.useState(0);
  
  // Pending plant information reports count
  const [pendingPlantReportsCount, setPendingPlantReportsCount] = React.useState(0);
  
  // Load active reports count on mount (for full admins only)
  React.useEffect(() => {
    if (!isFullAdmin) return;
    const loadReportCounts = async () => {
      try {
        const counts = await getReportCounts();
        setActiveReportsCount(counts.review);
      } catch (e) {
        console.warn('[AdminPage] Failed to load report counts:', e);
      }
    };
    loadReportCounts();
  }, [isFullAdmin]);
  
  // Load pending bug reports count on mount (for full admins only)
  React.useEffect(() => {
    if (!isFullAdmin) return;
    const loadPendingBugReports = async () => {
      try {
        const { count, error } = await supabase
          .from('bug_reports')
          .select('*', { count: 'exact', head: true })
          .in('status', ['pending', 'reviewing']);
        if (!error && count !== null) {
          setPendingBugReportsCount(count);
        }
      } catch (e) {
        console.warn('[AdminPage] Failed to load pending bug reports count:', e);
      }
    };
    loadPendingBugReports();
  }, [isFullAdmin]);

  // Load pending plant information reports count on mount
  React.useEffect(() => {
    const loadPendingPlantReports = async () => {
      try {
        const { count, error } = await supabase
          .from('plant_reports')
          .select('*', { count: 'exact', head: true });
        if (!error && count !== null) {
          setPendingPlantReportsCount(count);
        }
      } catch (e) {
        console.warn('[AdminPage] Failed to load pending plant reports count:', e);
      }
    };
    loadPendingPlantReports();
  }, []);
  
  const [memberList, setMemberList] = React.useState<ListedMember[]>([]);
  const [memberListLoading, setMemberListLoading] = React.useState(false);
  const [memberListError, setMemberListError] = React.useState<string | null>(
    null,
  );
  const [memberListHasMore, setMemberListHasMore] = React.useState(true);
  const [memberListOffset, setMemberListOffset] = React.useState(0);
  const [memberListInitialized, setMemberListInitialized] =
    React.useState(false);
  const [memberListSort, setMemberListSort] =
    React.useState<MemberListSort>("newest");
  const [roleFilter, setRoleFilter] = React.useState<string | null>(null);
  const [roleStats, setRoleStats] = React.useState<RoleStats | null>(null);
  const [roleStatsLoading, setRoleStatsLoading] = React.useState(false);
  const [lookupEmail, setLookupEmail] = React.useState("");
  const [memberLoading, setMemberLoading] = React.useState(false);
  const [memberError, setMemberError] = React.useState<string | null>(null);
  const [memberData, setMemberData] = React.useState<{
    user: { id: string; email: string; created_at?: string } | null;
    profile: Record<string, unknown>;
    ips: string[];
    threatLevel?: number | null;
    lastOnlineAt?: string | null;
    lastIp?: string | null;
    visitsCount?: number;
    uniqueIpsCount?: number;
    plantsTotal?: number;
    isBannedEmail?: boolean;
    bannedReason?: string | null;
    bannedAt?: string | null;
    bannedById?: string | null;
    bannedByName?: string | null;
    bannedIps?: string[];
    topReferrers?: Array<{ source: string; visits: number }>;
    topCountries?: Array<{ country: string; visits: number }>;
    topDevices?: Array<{ device: string; visits: number }>;
    meanRpm5m?: number | null;
    adminNotes?: Array<{
      id: string;
      admin_id: string | null;
      admin_name: string | null;
      message: string;
      created_at: string | null;
    }>;
    files?: Array<{
      id: string;
      imageUrl: string | null;
      caption: string | null;
      uploadedAt: string | null;
      gardenPlantId: string | null;
      plantName: string | null;
      adminCommentary: string | null;
    }>;
    scansTotal?: number;
    scansThisMonth?: number;
    scans?: Array<{
      id: string;
      imageUrl: string | null;
      imagePath: string | null;
      imageBucket: string | null;
      apiStatus: string | null;
      isPlant: boolean | null;
      isPlantProbability: number | null;
      topMatchName: string | null;
      topMatchScientificName: string | null;
      topMatchProbability: number | null;
      classificationLevel: string | null;
      matchedPlantId: string | null;
      matchedPlantName: string | null;
      matchedPlantScientificName: string | null;
      matchedPlantImage: string | null;
      userNotes: string | null;
      createdAt: string | null;
    }>;
    mediaUploads?: Array<{
      id: string;
      url: string | null;
      bucket: string | null;
      path: string | null;
      mimeType: string | null;
      sizeBytes: number | null;
      uploadSource: string;
      createdAt: string | null;
    }>;
    mediaTotalCount?: number;
    mediaTotalSize?: number;
    userReports?: Array<{
      id: string;
      reason: string | null;
      status: string;
      createdAt: string | null;
      classifiedAt: string | null;
      reporterName: string;
      classifierName: string | null;
      type: string;
    }>;
    reportsAgainstCount?: number;
    reportsByCount?: number;
    bugPoints?: number | null;
    bugCatcherRank?: number | null;
    bugActionsCompleted?: number | null;
    bugCompletedActions?: Array<{
      id: string;
      actionId: string;
      title: string;
      description: string | null;
      questions: Array<{ id: string; title: string; required: boolean; type: string }>;
      answers: Record<string, string | boolean>;
      pointsEarned: number;
      completedAt: string;
      actionStatus: string;
    }>;
  } | null>(null);
  const [banReason, setBanReason] = React.useState("");
  const [banSubmitting, setBanSubmitting] = React.useState(false);
  const [banOpen, setBanOpen] = React.useState(false);
  const [promoteOpen, setPromoteOpen] = React.useState(false);
  const [promoteSubmitting, setPromoteSubmitting] = React.useState(false);
  const [demoteOpen, setDemoteOpen] = React.useState(false);
  const [demoteSubmitting, setDemoteSubmitting] = React.useState(false);
  const [threatLevelSelection, setThreatLevelSelection] = React.useState<number>(0);
  const [threatLevelUpdating, setThreatLevelUpdating] = React.useState(false);
  const [threatLevelConfirmOpen, setThreatLevelConfirmOpen] = React.useState(false);
  const [pendingThreatLevel, setPendingThreatLevel] = React.useState<number | null>(null);
  

  React.useEffect(() => {
    if (typeof memberData?.threatLevel === "number") {
      setThreatLevelSelection(memberData.threatLevel);
    } else {
      setThreatLevelSelection(0);
    }
  }, [memberData?.threatLevel]);

  // Threat level panel visibility
  const [threatLevelOpen, setThreatLevelOpen] = React.useState(false);

  // Roles management state
  const [memberRoles, setMemberRoles] = React.useState<UserRole[]>([]);
  const [roleSubmitting, setRoleSubmitting] = React.useState<string | null>(null);
  const [rolesOpen, setRolesOpen] = React.useState(false); // Default to collapsed
  const [confirmAdminOpen, setConfirmAdminOpen] = React.useState(false); // Confirmation dialog for admin role
  const [bugActionsDialogOpen, setBugActionsDialogOpen] = React.useState(false); // Bug catcher actions dialog

  // Container ref for Members tab to run form-field validation logs
  const membersContainerRef = React.useRef<HTMLDivElement | null>(null);

  // Email/username autocomplete state
  const [emailSuggestions, setEmailSuggestions] = React.useState<
    Array<{ id: string; email: string | null; display_name?: string | null }>
  >([]);
  const [suggestionsOpen, setSuggestionsOpen] = React.useState(false);
  const [suggestLoading, setSuggestLoading] = React.useState(false);
  const [highlightIndex, setHighlightIndex] = React.useState<number>(-1);

  // IP lookup state
  const [ipLookup, setIpLookup] = React.useState("");
  const [ipLoading, setIpLoading] = React.useState(false);
  const [ipError, setIpError] = React.useState<string | null>(null);
  const [ipResults, setIpResults] = React.useState<
    Array<{
      id: string;
      email: string | null;
      display_name: string | null;
      last_seen_at: string | null;
    }>
  >([]);
  const [ipUsed, setIpUsed] = React.useState<string | null>(null);
  const [ipUsersCount, setIpUsersCount] = React.useState<number | null>(null);
  const [ipConnectionsCount, setIpConnectionsCount] = React.useState<
    number | null
  >(null);
  const [ipLastSeenAt, setIpLastSeenAt] = React.useState<string | null>(null);
  const [ipTopReferrers, setIpTopReferrers] = React.useState<
    Array<{ source: string; visits: number }>
  >([]);
  const [ipTopDevices, setIpTopDevices] = React.useState<
    Array<{ device: string; visits: number }>
  >([]);
  const [ipCountry, setIpCountry] = React.useState<string | null>(null);
  const [ipMeanRpm5m, setIpMeanRpm5m] = React.useState<number | null>(null);

  // Ref to focus the IP input when jumping from overview
  const memberIpInputRef = React.useRef<HTMLInputElement | null>(null);

  // Member visits (last 30 days)
  const [memberVisitsLoading, setMemberVisitsLoading] =
    React.useState<boolean>(false);
  const [memberVisitsSeries, setMemberVisitsSeries] = React.useState<
    Array<{ date: string; visits: number }>
  >([]);
  const [memberVisitsTotal30d, setMemberVisitsTotal30d] =
    React.useState<number>(0);
  const [memberVisitsUpdatedAt, setMemberVisitsUpdatedAt] = React.useState<
    number | null
  >(null);
  const [memberVisitsWarning, setMemberVisitsWarning] = React.useState<
    string | null
  >(null);

  // Member messages dialog state
  const [memberMessagesOpen, setMemberMessagesOpen] = React.useState(false);
  const [memberMessagesStats, setMemberMessagesStats] = React.useState<{
    conversationCount: number;
    messageCount: number;
    loading: boolean;
  }>({ conversationCount: 0, messageCount: 0, loading: false });

  const loadMemberMessagesStats = React.useCallback(
    async (userId: string) => {
      if (!userId) return;
      setMemberMessagesStats((prev) => ({ ...prev, loading: true }));
      try {
        const session = (await supabase.auth.getSession()).data.session;
        const token = session?.access_token;
        const headers: Record<string, string> = { Accept: "application/json" };
        if (token) headers["Authorization"] = `Bearer ${token}`;
        try {
          const adminToken = (globalThis as EnvWithAdminToken)?.__ENV__?.VITE_ADMIN_STATIC_TOKEN;
          if (adminToken) headers["X-Admin-Token"] = String(adminToken);
        } catch {}
        const resp = await fetch(
          `/api/admin/member-messages?userId=${encodeURIComponent(userId)}&limit=1`,
          { headers, credentials: "same-origin" },
        );
        const data = await safeJson(resp);
        if (resp.ok) {
          setMemberMessagesStats({
            conversationCount: data?.totalConversations || 0,
            messageCount: data?.totalMessages || 0,
            loading: false,
          });
        } else {
          setMemberMessagesStats({ conversationCount: 0, messageCount: 0, loading: false });
        }
      } catch (e: unknown) {
        console.error("Failed to load member messages stats:", e);
        setMemberMessagesStats({ conversationCount: 0, messageCount: 0, loading: false });
      }
    },
    [safeJson],
  );

  const loadMemberVisitsSeries = React.useCallback(
    async (userId: string, opts?: { initial?: boolean }) => {
      if (!userId) return;
      const isInitial = !!opts?.initial;
      if (isInitial) setMemberVisitsLoading(true);
      try {
        const session = (await supabase.auth.getSession()).data.session;
        const token = session?.access_token;
        const headers: Record<string, string> = { Accept: "application/json" };
        if (token) headers["Authorization"] = `Bearer ${token}`;
        try {
          const adminToken = (globalThis as EnvWithAdminToken)?.__ENV__
            ?.VITE_ADMIN_STATIC_TOKEN;
          if (adminToken) headers["X-Admin-Token"] = String(adminToken);
        } catch {}
        const resp = await fetch(
          `/api/admin/member-visits-series?userId=${encodeURIComponent(userId)}`,
          { headers, credentials: "same-origin" },
        );
        const data = await safeJson(resp);
        if (!resp.ok) throw new Error(data?.error || `HTTP ? ${resp.status}`);

        // Debug: log response to help diagnose background task issues
        if (process.env.NODE_ENV === "development") {
          console.log("Member visits series API response:", {
            hasSeries30d: !!data?.series30d,
            hasStatus: !!data?.status,
            hasJobId: !!data?.jobId,
            keys: Object.keys(data || {}),
          });
        }

        // Handle background task response - check if data is still being generated
        if (data?.status === "pending" || data?.jobId) {
          // Background task is processing, return empty for now
          console.log("Visits series data is being generated in background");
          setMemberVisitsSeries([]);
          setMemberVisitsTotal30d(0);
          setMemberVisitsUpdatedAt(null);
          setMemberVisitsWarning(null);
          return;
        }

        // Check if response has the expected structure
        if (!data?.series30d || !Array.isArray(data?.series30d)) {
          console.warn("Unexpected API response format:", data);
          // If data structure changed, try to adapt
          if (data?.data?.series30d && Array.isArray(data.data.series30d)) {
            // Nested structure
            data.series30d = data.data.series30d;
            data.total30d = data.data.total30d;
          } else {
            throw new Error(
              "Invalid response format: missing or invalid series30d",
            );
          }
        }

        const series = Array.isArray(data?.series30d)
          ? data.series30d
              .map((d: unknown) => {
                const dd = d as Record<string, unknown>;
                // API returns dates in YYYY-MM-DD format from toISOString().slice(0,10)
                let dateStr = String(dd.date || "");
                // Extract date part if it's an ISO string (handles edge cases)
                if (dateStr.includes("T")) {
                  dateStr = dateStr.split("T")[0];
                }
                // If date is already in YYYY-MM-DD format, use it directly
                if (dateStr.match(/^\d{4}-\d{2}-\d{2}$/)) {
                  return { date: dateStr, visits: Number(dd.visits || 0) };
                }
                // Try to normalize if format is different
                if (dateStr) {
                  try {
                    const dateObj = new Date(dateStr + "T00:00:00Z");
                    if (!isNaN(dateObj.getTime())) {
                      dateStr = dateObj.toISOString().split("T")[0];
                      if (dateStr.match(/^\d{4}-\d{2}-\d{2}$/)) {
                        return { date: dateStr, visits: Number(dd.visits || 0) };
                      }
                    }
                  } catch {}
                }
                // Skip invalid dates
                return null;
              })
              .filter(
                (
                  item: { date: string; visits: number } | null,
                ): item is { date: string; visits: number } => item !== null,
              )
          : [];
        setMemberVisitsSeries(series);
        const total = Number(data?.total30d || 0);
        setMemberVisitsTotal30d(Number.isFinite(total) ? total : 0);
        setMemberVisitsUpdatedAt(Date.now());
        setMemberVisitsWarning(data?.warning || null);
      } catch (e: unknown) {
        // Log error but don't clear existing data if this is a refresh (only clear on initial load)
        console.error("Failed to load member visits series:", e);
        if (isInitial) {
          setMemberVisitsSeries([]);
          setMemberVisitsTotal30d(0);
          setMemberVisitsUpdatedAt(null);
          setMemberVisitsWarning(null);
        }
      } finally {
        if (isInitial) setMemberVisitsLoading(false);
      }
    },
    [safeJson],
  );

  const loadMemberList = React.useCallback(
    async (opts?: { reset?: boolean; sort?: MemberListSort; role?: string | null }) => {
      if (memberListLoading) return;
      const reset = !!opts?.reset;
      const limit = MEMBER_LIST_PAGE_SIZE;
      const offset = reset ? 0 : memberListOffset;
      const sortParam: MemberListSort = opts?.sort ?? memberListSort;
      const roleParam: string | null = opts?.role !== undefined ? opts.role : roleFilter;
      setMemberListLoading(true);
      setMemberListError(null);
      try {
        const session = (await supabase.auth.getSession()).data.session;
        const token = session?.access_token;
        const headers: Record<string, string> = { Accept: "application/json" };
        if (token) headers["Authorization"] = `Bearer ${token}`;
        try {
          const adminToken = (globalThis as EnvWithAdminToken)?.__ENV__
            ?.VITE_ADMIN_STATIC_TOKEN;
          if (adminToken) headers["X-Admin-Token"] = String(adminToken);
        } catch {}
        const roleQuery = roleParam ? `&role=${encodeURIComponent(roleParam)}` : "";
        const resp = await fetch(
          `/api/admin/member-list?limit=${limit}&offset=${offset}&sort=${encodeURIComponent(sortParam)}${roleQuery}`,
          { headers, credentials: "same-origin" },
        );
        const data = await safeJson(resp);
        if (!resp.ok) throw new Error(data?.error || `HTTP ? ${resp.status}`);
        const rawMembers = Array.isArray(data?.members) ? data.members : [];
        const normalized: ListedMember[] = rawMembers
          .map((m: unknown) => {
            const mm = m as Record<string, unknown>;
            const id = mm?.id ? String(mm.id) : "";
            if (!id) return null;
            const displayName =
              typeof mm?.display_name === "string"
                ? mm.display_name
                : typeof mm?.displayName === "string"
                  ? mm.displayName
                  : null;
            const email = typeof mm?.email === "string" ? mm.email : null;
            const createdAt =
              typeof mm?.created_at === "string"
                ? mm.created_at
                : typeof mm?.createdAt === "string"
                  ? mm.createdAt
                  : null;
            const isAdmin =
              mm?.is_admin === true || mm?.isAdmin === true ? true : false;
            const roles = Array.isArray(mm?.roles) ? mm.roles : [];
            return {
              id,
              email,
              displayName,
              createdAt,
              isAdmin,
              roles,
              rpm5m:
                typeof mm?.rpm5m === "number"
                  ? mm.rpm5m
                  : typeof mm?.rpm5m === "string" && mm.rpm5m.length > 0
                    ? Number(mm.rpm5m)
                    : null,
            } as ListedMember;
          })
          .filter(
            (item: ListedMember | null): item is ListedMember =>
              Boolean(item && item.id),
          );
        setMemberList((prev) => (reset ? normalized : [...prev, ...normalized]));
        const nextOffset =
          typeof data?.nextOffset === "number"
            ? data.nextOffset
            : offset + normalized.length;
        setMemberListOffset(nextOffset);
        const hasMore =
          typeof data?.hasMore === "boolean"
            ? data.hasMore
            : normalized.length >= limit;
        setMemberListHasMore(hasMore);
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e);
        setMemberListError(msg || "Failed to load member list");
      } finally {
        setMemberListLoading(false);
        setMemberListInitialized(true);
      }
    },
    [memberListLoading, memberListOffset, memberListSort, roleFilter, safeJson],
  );

  const loadRoleStats = React.useCallback(async () => {
    if (roleStatsLoading) return;
    setRoleStatsLoading(true);
    try {
      const session = (await supabase.auth.getSession()).data.session;
      const token = session?.access_token;
      const headers: Record<string, string> = { Accept: "application/json" };
      if (token) headers["Authorization"] = `Bearer ${token}`;
      try {
        const adminToken = (globalThis as EnvWithAdminToken)?.__ENV__?.VITE_ADMIN_STATIC_TOKEN;
        if (adminToken) headers["X-Admin-Token"] = String(adminToken);
      } catch {}
      const resp = await fetch("/api/admin/role-stats", {
        headers,
        credentials: "same-origin",
      });
      const data = await safeJson(resp);
      if (!resp.ok) throw new Error(data?.error || `HTTP ${resp.status}`);
      setRoleStats({
        totalMembers: typeof data?.totalMembers === "number" ? data.totalMembers : 0,
        roleCounts: typeof data?.roleCounts === "object" ? data.roleCounts : {},
      });
    } catch (e) {
      console.error("[AdminPage] Failed to load role stats:", e);
    } finally {
      setRoleStatsLoading(false);
    }
  }, [roleStatsLoading, safeJson]);

  const lookupMember = React.useCallback(
    async (override?: string) => {
      if (memberLoading) return;
      const raw = typeof override === "string" ? override : lookupEmail;
      const query = raw.trim();
      if (!query) return;
      if (query !== lookupEmail) setLookupEmail(query);
      setMemberLoading(true);
      setMemberError(null);
      setMemberData(null);
      try {
        const session = (await supabase.auth.getSession()).data.session;
        const token = session?.access_token;
        const url = `/api/admin/member?q=${encodeURIComponent(query)}`;
        const headers: Record<string, string> = { Accept: "application/json" };
        if (token) headers["Authorization"] = `Bearer ${token}`;
        try {
          const adminToken = (globalThis as EnvWithAdminToken)?.__ENV__
            ?.VITE_ADMIN_STATIC_TOKEN;
          if (adminToken) headers["X-Admin-Token"] = String(adminToken);
        } catch {}
        const resp = await fetch(url, { headers, credentials: "same-origin" });
        const data = await safeJson(resp);
        if (!resp.ok) throw new Error(data?.error || `HTTP ? ${resp.status}`);
        setMemberData({
          user: data?.user || null,
          profile: data?.profile || null,
          ips: Array.isArray(data?.ips) ? data.ips : [],
          threatLevel:
            typeof data?.threatLevel === "number"
              ? data.threatLevel
              : typeof data?.profile?.threat_level === "number"
                ? data.profile.threat_level
                : null,
          lastOnlineAt: data?.lastOnlineAt ?? null,
          lastIp: data?.lastIp ?? null,
          visitsCount:
            typeof data?.visitsCount === "number"
              ? data.visitsCount
              : undefined,
          uniqueIpsCount:
            typeof data?.uniqueIpsCount === "number"
              ? data.uniqueIpsCount
              : undefined,
          plantsTotal:
            typeof data?.plantsTotal === "number"
              ? data.plantsTotal
              : undefined,
          isBannedEmail: !!data?.isBannedEmail,
          bannedReason: data?.bannedReason ?? null,
          bannedAt: data?.bannedAt ?? null,
          bannedById: data?.bannedById ?? null,
          bannedByName: data?.bannedByName ?? null,
          bannedIps: Array.isArray(data?.bannedIps) ? data.bannedIps : [],
          topReferrers: Array.isArray(data?.topReferrers)
            ? data.topReferrers
            : [],
          topCountries: Array.isArray(data?.topCountries)
            ? data.topCountries
            : [],
          topDevices: Array.isArray(data?.topDevices) ? data.topDevices : [],
          meanRpm5m:
            typeof data?.meanRpm5m === "number" ? data.meanRpm5m : null,
          adminNotes: Array.isArray(data?.adminNotes)
            ? data.adminNotes.map((n: unknown) => {
                const nn = n as Record<string, unknown>;
                return {
                id: String(nn.id),
                admin_id: nn?.admin_id || null,
                admin_name: nn?.admin_name || null,
                message: String(nn?.message || ""),
                created_at: nn?.created_at || null,
              };
              })
            : [],
          files: Array.isArray(data?.files)
            ? data.files.map((file: unknown) => {
                const f = file as Record<string, unknown>;
                return {
                id: String(f.id),
                imageUrl: f?.imageUrl || f?.image_url || null,
                caption: f?.caption || null,
                uploadedAt: f?.uploadedAt || f?.uploaded_at || null,
                gardenPlantId: f?.gardenPlantId || f?.garden_plant_id || null,
                plantName: f?.plantName || f?.plant_name || null,
                adminCommentary: f?.adminCommentary || f?.admin_commentary || null,
              };
              })
            : [],
          scansTotal:
            typeof data?.scansTotal === "number" ? data.scansTotal : 0,
          scansThisMonth:
            typeof data?.scansThisMonth === "number"
              ? data.scansThisMonth
              : 0,
          scans: Array.isArray(data?.scans)
            ? data.scans.map((scan: unknown) => {
                const s = scan as Record<string, unknown>;
                return {
                id: String(s?.id || ""),
                imageUrl: s?.imageUrl || s?.image_url || null,
                imagePath: s?.imagePath || s?.image_path || null,
                imageBucket: s?.imageBucket || s?.image_bucket || null,
                apiStatus: s?.apiStatus || s?.api_status || null,
                isPlant:
                  typeof s?.isPlant === "boolean"
                    ? s.isPlant
                    : typeof s?.is_plant === "boolean"
                      ? s.is_plant
                      : null,
                isPlantProbability:
                  typeof s?.isPlantProbability === "number"
                    ? s.isPlantProbability
                    : typeof s?.is_plant_probability === "number"
                      ? s.is_plant_probability
                      : null,
                topMatchName: s?.topMatchName || s?.top_match_name || null,
                topMatchScientificName:
                  s?.topMatchScientificName ||
                  s?.top_match_scientific_name ||
                  null,
                topMatchProbability:
                  typeof s?.topMatchProbability === "number"
                    ? s.topMatchProbability
                    : typeof s?.top_match_probability === "number"
                      ? s.top_match_probability
                      : null,
                classificationLevel:
                  s?.classificationLevel || s?.classification_level || null,
                matchedPlantId:
                  s?.matchedPlantId || s?.matched_plant_id || null,
                matchedPlantName:
                  s?.matchedPlantName || s?.matched_plant_name || null,
                matchedPlantScientificName:
                  s?.matchedPlantScientificName ||
                  s?.matched_plant_scientific_name ||
                  null,
                matchedPlantImage:
                  s?.matchedPlantImage || s?.matched_plant_image || null,
                userNotes: s?.userNotes || s?.user_notes || null,
                createdAt: s?.createdAt || s?.created_at || null,
              };
              })
            : [],
          mediaUploads: Array.isArray(data?.mediaUploads)
            ? data.mediaUploads.map((media: unknown) => {
                const m = media as Record<string, unknown>;
                return {
                id: String(m.id),
                url: m?.url || m?.public_url || null,
                bucket: m?.bucket || null,
                path: m?.path || null,
                mimeType: m?.mimeType || m?.mime_type || null,
                sizeBytes: typeof m?.sizeBytes === "number" ? m.sizeBytes : (typeof m?.size_bytes === "number" ? m.size_bytes : null),
                uploadSource: m?.uploadSource || m?.upload_source || "unknown",
                createdAt: m?.createdAt || m?.created_at || null,
              };
              })
            : [],
          mediaTotalCount: typeof data?.mediaTotalCount === "number" ? data.mediaTotalCount : 0,
          mediaTotalSize: typeof data?.mediaTotalSize === "number" ? data.mediaTotalSize : 0,
          userReports: Array.isArray(data?.userReports)
            ? data.userReports.map((report: unknown) => {
                const r = report as Record<string, unknown>;
                return {
                id: String(r.id),
                reason: r?.reason || null,
                status: r?.status || "review",
                createdAt: r?.createdAt || r?.created_at || null,
                classifiedAt: r?.classifiedAt || r?.classified_at || null,
                reporterName: r?.reporterName || "Unknown",
                classifierName: r?.classifierName || null,
                type: r?.type || "against",
              };
              })
            : [],
          reportsAgainstCount: typeof data?.reportsAgainstCount === "number" ? data.reportsAgainstCount : 0,
          reportsByCount: typeof data?.reportsByCount === "number" ? data.reportsByCount : 0,
          bugPoints: typeof data?.bugPoints === "number" ? data.bugPoints : null,
          bugCatcherRank: typeof data?.bugCatcherRank === "number" ? data.bugCatcherRank : null,
          bugActionsCompleted: typeof data?.bugActionsCompleted === "number" ? data.bugActionsCompleted : null,
          bugCompletedActions: Array.isArray(data?.bugCompletedActions) 
            ? data.bugCompletedActions.map((action: unknown) => {
                const a = action as Record<string, unknown>;
                return {
                id: String(a.id || ''),
                actionId: String(a.actionId || ''),
                title: String(a.title || 'Unknown Action'),
                description: a.description || null,
                questions: Array.isArray(a.questions) ? a.questions : [],
                answers: a.answers || {},
                pointsEarned: typeof a.pointsEarned === 'number' ? a.pointsEarned : 0,
                completedAt: a.completedAt || null,
                actionStatus: a.actionStatus || 'unknown',
              };
              })
            : [],
        });
        // Extract and set member roles
        const profileRoles = Array.isArray(data?.profile?.roles) ? data.profile.roles : [];
        const isAdminRole = data?.profile?.is_admin === true;
        const effectiveRoles = [...profileRoles] as UserRole[];
        if (isAdminRole && !effectiveRoles.includes(USER_ROLES.ADMIN)) {
          effectiveRoles.push(USER_ROLES.ADMIN);
        }
        setMemberRoles(effectiveRoles);
        // Log lookup success (UI)
        try {
          const headers2: Record<string, string> = {
            Accept: "application/json",
            "Content-Type": "application/json",
          };
          if (token) headers2["Authorization"] = `Bearer ${token}`;
          try {
            const adminToken = (globalThis as EnvWithAdminToken)?.__ENV__
              ?.VITE_ADMIN_STATIC_TOKEN;
            if (adminToken) headers2["X-Admin-Token"] = String(adminToken);
          } catch {}
          await fetch("/api/admin/log-action", {
            method: "POST",
            headers: headers2,
            credentials: "same-origin",
            body: JSON.stringify({
              action: "admin_lookup",
              target: query,
              detail: { via: "ui" },
            }),
          });
        } catch {}
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e);
        setMemberError(msg || "Lookup failed");
        // Log failed lookup
        try {
          const session = (await supabase.auth.getSession()).data.session;
          const token = session?.access_token;
          const headers2: Record<string, string> = {
            Accept: "application/json",
            "Content-Type": "application/json",
          };
          if (token) headers2["Authorization"] = `Bearer ${token}`;
          try {
            const adminToken = (globalThis as EnvWithAdminToken)?.__ENV__
              ?.VITE_ADMIN_STATIC_TOKEN;
            if (adminToken) headers2["X-Admin-Token"] = String(adminToken);
          } catch {}
          await fetch("/api/admin/log-action", {
            method: "POST",
            headers: headers2,
            credentials: "same-origin",
            body: JSON.stringify({
              action: "admin_lookup_failed",
              target: query,
              detail: { error: msg },
            }),
          });
        } catch {}
      } finally {
        setMemberLoading(false);
      }
    },
    [lookupEmail, memberLoading, safeJson],
  );

  const handleSetThreatLevel = React.useCallback(async () => {
    if (!memberData?.user?.id) return;
    setThreatLevelUpdating(true);
    setMemberError(null);
    try {
      const result = await setUserThreatLevel(
        memberData.user.id,
        threatLevelSelection as ThreatLevel,
      );
      setMemberData((prev) => {
        if (!prev) return prev;
        const updatedLevel =
          typeof result?.threatLevel === "number"
            ? result.threatLevel
            : threatLevelSelection;
        return {
          ...prev,
          threatLevel: updatedLevel,
          profile: {
            ...(prev.profile || {}),
            threat_level: updatedLevel,
          },
          bannedAt: result?.bannedAt ?? prev.bannedAt ?? null,
          bannedIps: Array.isArray(result?.bannedIps)
            ? result.bannedIps
            : prev.bannedIps,
          bannedById: result?.bannedById ?? prev.bannedById ?? null,
          bannedByName: result?.bannedByName ?? prev.bannedByName ?? null,
        };
      });
      await lookupMember(memberData.user.id);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      setMemberError(msg || "Failed to update threat level");
    } finally {
      setThreatLevelUpdating(false);
    }
  }, [lookupMember, memberData?.user?.id, threatLevelSelection]);

  const lookupByIp = React.useCallback(
    async (overrideIp?: string) => {
      const ip = (overrideIp ?? ipLookup).trim();
      if (!ip || ipLoading) return;
      setIpLoading(true);
      setIpError(null);
      setIpResults([]);
      setIpUsed(null);
      setIpUsersCount(null);
      setIpConnectionsCount(null);
      setIpLastSeenAt(null);
      setIpTopReferrers([]);
      setIpTopDevices([]);
      setIpCountry(null);
      setIpMeanRpm5m(null);
      try {
        const session = (await supabase.auth.getSession()).data.session;
        const token = session?.access_token;
        const headers: Record<string, string> = { Accept: "application/json" };
        if (token) headers["Authorization"] = `Bearer ${token}`;
        try {
          const adminToken = (globalThis as EnvWithAdminToken)?.__ENV__
            ?.VITE_ADMIN_STATIC_TOKEN;
          if (adminToken) headers["X-Admin-Token"] = String(adminToken);
        } catch {}
        const resp = await fetch(
          `/api/admin/members-by-ip?ip=${encodeURIComponent(ip)}`,
          { headers, credentials: "same-origin" },
        );
        const data = await safeJson(resp);
        if (!resp.ok) throw new Error(data?.error || `HTTP ? ${resp.status}`);
        const users = Array.isArray(data?.users)
          ? data.users.map((u: unknown) => {
              const uu = u as Record<string, unknown>;
              return {
              id: String(uu.id),
              email: uu?.email ?? null,
              display_name: uu?.display_name ?? null,
              last_seen_at: uu?.last_seen_at ?? null,
            };
            })
          : [];
        setIpResults(users);
        setIpUsed(typeof data?.ip === "string" ? data.ip : ip);
        if (typeof data?.usersCount === "number")
          setIpUsersCount(data.usersCount);
        if (typeof data?.connectionsCount === "number")
          setIpConnectionsCount(data.connectionsCount);
        if (typeof data?.lastSeenAt === "string")
          setIpLastSeenAt(data.lastSeenAt);
        if (Array.isArray(data?.ipTopReferrers))
          setIpTopReferrers(data.ipTopReferrers);
        if (Array.isArray(data?.ipTopDevices))
          setIpTopDevices(data.ipTopDevices);
        if (typeof data?.ipCountry === "string") setIpCountry(data.ipCountry);
        if (typeof data?.ipMeanRpm5m === "number")
          setIpMeanRpm5m(data.ipMeanRpm5m);
        // Log IP lookup (success)
        try {
          const headers2: Record<string, string> = {
            Accept: "application/json",
            "Content-Type": "application/json",
          };
          if (token) headers2["Authorization"] = `Bearer ${token}`;
          try {
            const adminToken = (globalThis as EnvWithAdminToken)?.__ENV__
              ?.VITE_ADMIN_STATIC_TOKEN;
            if (adminToken) headers2["X-Admin-Token"] = String(adminToken);
          } catch {}
          await fetch("/api/admin/log-action", {
            method: "POST",
            headers: headers2,
            credentials: "same-origin",
            body: JSON.stringify({
              action: "ip_lookup",
              target: ip,
              detail: { via: "ui" },
            }),
          });
        } catch {}
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e);
        setIpError(msg || "IP lookup failed");
        // Log IP lookup failure
        try {
          const session = (await supabase.auth.getSession()).data.session;
          const token = session?.access_token;
          const headers2: Record<string, string> = {
            Accept: "application/json",
            "Content-Type": "application/json",
          };
          if (token) headers2["Authorization"] = `Bearer ${token}`;
          try {
            const adminToken = (globalThis as EnvWithAdminToken)?.__ENV__
              ?.VITE_ADMIN_STATIC_TOKEN;
            if (adminToken) headers2["X-Admin-Token"] = String(adminToken);
          } catch {}
          await fetch("/api/admin/log-action", {
            method: "POST",
            headers: headers2,
            credentials: "same-origin",
            body: JSON.stringify({
              action: "ip_lookup_failed",
              target: ip,
              detail: { error: msg },
            }),
          });
        } catch {}
      } finally {
        setIpLoading(false);
      }
    },
    [ipLookup, ipLoading, safeJson],
  );

  // Jump from overview IP badge to Members tab IP lookup
  const jumpToIpLookup = React.useCallback(
    (ip: string) => {
      const next = String(ip || "").trim();
      if (!next) return;
      navigate("/admin/members");
      setIpLookup(next);
      setTimeout(() => {
        try {
          memberIpInputRef.current?.focus();
        } catch {}
        // Trigger the same search flow as pressing Enter in the input
        lookupByIp(next);
      }, 0);
    },
    [lookupByIp, navigate],
  );

  const handleMemberCardClick = React.useCallback(
    (entry: ListedMember) => {
      const value =
        entry.displayName?.trim() ||
        entry.email?.trim() ||
        "";
      if (!value) return;
      navigate("/admin/members");
      setTimeout(() => {
        lookupMember(value);
      }, 0);
    },
    [lookupMember, navigate],
  );

  const handleMemberSortChange = React.useCallback(
    (nextSort: MemberListSort) => {
      if (nextSort === memberListSort) return;
      setMemberListSort(nextSort);
      setMemberList([]);
      setMemberListOffset(0);
      setMemberListHasMore(true);
      setMemberListError(null);
      loadMemberList({ reset: true, sort: nextSort });
    },
    [
      memberListSort,
      loadMemberList,
    ],
  );

  const handleRoleFilterChange = React.useCallback(
    (nextRole: string | null) => {
      if (nextRole === roleFilter) {
        // Toggle off if same role clicked
        setRoleFilter(null);
        setMemberList([]);
        setMemberListOffset(0);
        setMemberListHasMore(true);
        setMemberListError(null);
        loadMemberList({ reset: true, role: null });
      } else {
        setRoleFilter(nextRole);
        setMemberList([]);
        setMemberListOffset(0);
        setMemberListHasMore(true);
        setMemberListError(null);
        loadMemberList({ reset: true, role: nextRole });
      }
    },
    [roleFilter, loadMemberList],
  );

  // Auto-load visits series and messages stats when a member is selected
  React.useEffect(() => {
    const uid = memberData?.user?.id;
    if (uid) {
      loadMemberVisitsSeries(uid, { initial: true });
      loadMemberMessagesStats(uid);
    } else {
      setMemberVisitsSeries([]);
      setMemberVisitsTotal30d(0);
      setMemberVisitsUpdatedAt(null);
      setMemberVisitsWarning(null);
      setMemberMessagesStats({ conversationCount: 0, messageCount: 0, loading: false });
    }
    // Close messages dialog when member changes
    setMemberMessagesOpen(false);
  }, [memberData?.user?.id, loadMemberVisitsSeries, loadMemberMessagesStats]);

  // Refresh member list every time the list view is opened
  React.useEffect(() => {
    if (activeTab !== "members") return;
    if (membersView !== "list") return;
    if (memberListLoading) return;
    // Always refresh when opening the list view
    loadMemberList({ reset: true });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    activeTab,
    membersView,
  ]);

  // Refresh role stats every time the list view is opened
  React.useEffect(() => {
    if (activeTab !== "members") return;
    if (membersView !== "list") return;
    if (roleStatsLoading) return;
    // Always refresh when opening the list view
    loadRoleStats();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    activeTab,
    membersView,
  ]);

  const performBan = React.useCallback(async () => {
    if (!lookupEmail || banSubmitting) return;
    setBanSubmitting(true);
    try {
      const session = (await supabase.auth.getSession()).data.session;
      const token = session?.access_token;
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
        Accept: "application/json",
      };
      if (token) headers["Authorization"] = `Bearer ${token}`;
      try {
        const adminToken = (globalThis as EnvWithAdminToken)?.__ENV__
          ?.VITE_ADMIN_STATIC_TOKEN;
        if (adminToken) headers["X-Admin-Token"] = String(adminToken);
      } catch {}
      const resp = await fetch("/api/admin/ban", {
        method: "POST",
        headers,
        credentials: "same-origin",
        body: JSON.stringify({ email: lookupEmail, reason: banReason }),
      });
      const data = await safeJson(resp);
      if (!resp.ok) throw new Error(data?.error || `HTTP ? ${resp.status}`);
      alert("User banned successfully");
      setBanReason("");
      setBanOpen(false);
      // Refresh lookup data to reflect deletion
      setMemberData(null);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      alert(`Ban failed: ? ${msg}`);
    } finally {
      setBanSubmitting(false);
    }
  }, [lookupEmail, banReason, banSubmitting, safeJson]);

  const performPromote = React.useCallback(async () => {
    if (!lookupEmail || promoteSubmitting) return;
    setPromoteSubmitting(true);
    try {
      const session = (await supabase.auth.getSession()).data.session;
      const token = session?.access_token;
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
        Accept: "application/json",
      };
      if (token) headers["Authorization"] = `Bearer ${token}`;
      try {
        const adminToken = (globalThis as EnvWithAdminToken)?.__ENV__
          ?.VITE_ADMIN_STATIC_TOKEN;
        if (adminToken) headers["X-Admin-Token"] = String(adminToken);
      } catch {}
      const resp = await fetch("/api/admin/promote-admin", {
        method: "POST",
        headers,
        credentials: "same-origin",
        body: JSON.stringify({ email: lookupEmail }),
      });
      const data = await safeJson(resp);
      if (!resp.ok) throw new Error(data?.error || `HTTP ? ${resp.status}`);
      alert("User promoted to admin successfully");
      setPromoteOpen(false);
      // Refresh profile info
      setMemberData((prev) =>
        prev
          ? { ...prev, profile: { ...(prev.profile || {}), is_admin: true } }
          : prev,
      );
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      alert(`Promotion failed: ? ${msg}`);
    } finally {
      setPromoteSubmitting(false);
    }
  }, [lookupEmail, promoteSubmitting, safeJson]);

  const performDemote = React.useCallback(async () => {
    if (!lookupEmail || demoteSubmitting) return;
    setDemoteSubmitting(true);
    try {
      const session = (await supabase.auth.getSession()).data.session;
      const token = session?.access_token;
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
        Accept: "application/json",
      };
      if (token) headers["Authorization"] = `Bearer ${token}`;
      try {
        const adminToken = (globalThis as EnvWithAdminToken)?.__ENV__
          ?.VITE_ADMIN_STATIC_TOKEN;
        if (adminToken) headers["X-Admin-Token"] = String(adminToken);
      } catch {}
      const resp = await fetch("/api/admin/demote-admin", {
        method: "POST",
        headers,
        credentials: "same-origin",
        body: JSON.stringify({ email: lookupEmail }),
      });
      const data = await safeJson(resp);
      if (!resp.ok) throw new Error(data?.error || `HTTP ? ${resp.status}`);
      alert("Admin removed successfully");
      setDemoteOpen(false);
      // Refresh profile info
      setMemberData((prev) =>
        prev
          ? { ...prev, profile: { ...(prev.profile || {}), is_admin: false } }
          : prev,
      );
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      alert(`Demotion failed: ? ${msg}`);
    } finally {
      setDemoteSubmitting(false);
    }
  }, [lookupEmail, demoteSubmitting, safeJson]);

  // Add a role to the user (with confirmation for admin role)
  const addRole = React.useCallback(async (role: UserRole, skipConfirm = false) => {
    if (!memberData?.user?.id || roleSubmitting) return;
    
    // Show confirmation dialog for admin role
    if (role === USER_ROLES.ADMIN && !skipConfirm) {
      setConfirmAdminOpen(true);
      return;
    }
    
    setRoleSubmitting(role);
    try {
      const session = (await supabase.auth.getSession()).data.session;
      const token = session?.access_token;
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
        Accept: "application/json",
      };
      if (token) headers["Authorization"] = `Bearer ${token}`;
      try {
        const adminToken = (globalThis as EnvWithAdminToken)?.__ENV__
          ?.VITE_ADMIN_STATIC_TOKEN;
        if (adminToken) headers["X-Admin-Token"] = String(adminToken);
      } catch {}
      const resp = await fetch("/api/admin/roles/add", {
        method: "POST",
        headers,
        credentials: "same-origin",
        body: JSON.stringify({ userId: memberData.user.id, role }),
      });
      const data = await safeJson(resp);
      if (!resp.ok) throw new Error(data?.error || `HTTP ${resp.status}`);
      // Update local state
      setMemberRoles(data.roles || [...memberRoles, role]);
      // If admin role was added, update legacy is_admin field
      if (role === USER_ROLES.ADMIN) {
        setMemberData((prev) =>
          prev
            ? { ...prev, profile: { ...(prev.profile || {}), is_admin: true } }
            : prev,
        );
      }
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      alert(`Failed to add role: ${msg}`);
    } finally {
      setRoleSubmitting(null);
    }
  }, [memberData?.user?.id, memberRoles, roleSubmitting, safeJson]);
  
  // Confirm adding admin role
  const confirmAddAdmin = React.useCallback(() => {
    setConfirmAdminOpen(false);
    addRole(USER_ROLES.ADMIN, true);
  }, [addRole]);

  // Remove a role from the user
  const removeRole = React.useCallback(async (role: UserRole) => {
    if (!memberData?.user?.id || roleSubmitting) return;
    setRoleSubmitting(role);
    try {
      const session = (await supabase.auth.getSession()).data.session;
      const token = session?.access_token;
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
        Accept: "application/json",
      };
      if (token) headers["Authorization"] = `Bearer ${token}`;
      try {
        const adminToken = (globalThis as EnvWithAdminToken)?.__ENV__
          ?.VITE_ADMIN_STATIC_TOKEN;
        if (adminToken) headers["X-Admin-Token"] = String(adminToken);
      } catch {}
      const resp = await fetch("/api/admin/roles/remove", {
        method: "POST",
        headers,
        credentials: "same-origin",
        body: JSON.stringify({ userId: memberData.user.id, role }),
      });
      const data = await safeJson(resp);
      if (!resp.ok) throw new Error(data?.error || `HTTP ${resp.status}`);
      // Update local state
      setMemberRoles(data.roles || memberRoles.filter(r => r !== role));
      // If admin role was removed, update legacy is_admin field
      if (role === USER_ROLES.ADMIN) {
        setMemberData((prev) =>
          prev
            ? { ...prev, profile: { ...(prev.profile || {}), is_admin: false } }
            : prev,
        );
      }
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      alert(`Failed to remove role: ${msg}`);
    } finally {
      setRoleSubmitting(null);
    }
  }, [memberData?.user?.id, memberRoles, roleSubmitting, safeJson]);

  // Debounced email/username suggestions fetch
  React.useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const run = async () => {
      const q = lookupEmail.trim();
      if (q.length < 1) {
        setEmailSuggestions([]);
        setSuggestionsOpen(false);
        setHighlightIndex(-1);
        return;
      }
      setSuggestLoading(true);
      try {
        const token = (await supabase.auth.getSession()).data.session
          ?.access_token;
        const headers: Record<string, string> = { Accept: "application/json" };
        if (token) headers["Authorization"] = `Bearer ${token}`;
        try {
          const adminToken = (globalThis as EnvWithAdminToken)?.__ENV__
            ?.VITE_ADMIN_STATIC_TOKEN;
          if (adminToken) headers["X-Admin-Token"] = String(adminToken);
        } catch {}
        const resp = await fetch(
          `/api/admin/member-suggest?q=${encodeURIComponent(q)}`,
          {
            headers,
            credentials: "same-origin",
          },
        );
        const data = await safeJson(resp);
        if (cancelled) return;
        if (resp.ok && Array.isArray(data?.suggestions)) {
          setEmailSuggestions(
            data.suggestions.map((s: unknown) => {
              const ss = s as Record<string, unknown>;
              return {
              id: String(ss.id),
              email: ss?.email ? String(ss.email) : null,
              display_name: ss?.display_name ? String(ss.display_name) : null,
            };
            }),
          );
          setSuggestionsOpen(true);
          setHighlightIndex(-1);
        } else {
          setEmailSuggestions([]);
          setSuggestionsOpen(false);
          setHighlightIndex(-1);
        }
      } catch {
        if (!cancelled) {
          setEmailSuggestions([]);
          setSuggestionsOpen(false);
          setHighlightIndex(-1);
        }
      } finally {
        if (!cancelled) setSuggestLoading(false);
      }
    };
    timer = setTimeout(run, 200);
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [lookupEmail, safeJson]);

  // Console diagnostic: log any form fields missing both id and name within Members tab
  React.useEffect(() => {
    if (activeTab !== "members") return;
    const container = membersContainerRef.current;
    if (!container) return;
    const t = setTimeout(() => {
      const fields = Array.from(
        container.querySelectorAll("input, textarea, select"),
      ) as Array<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>;
      const violations = fields.filter(
        (el) => !(el.getAttribute("id") || el.getAttribute("name")),
      );
      if (violations.length > 0) {
        violations.forEach((el) => {
          console.warn(
            "A form field element has neither an id nor a name attribute:",
            el,
          );
        });
      } else {
        console.info("Member Lookup: all form fields have an id or a name.");
      }
    }, 0);
    return () => clearTimeout(t);
  }, [activeTab]);

  return (
    <div className="px-4 pb-6 md:px-8">
      <div className="max-w-6xl mx-auto mt-8 space-y-4 md:space-y-6">
        {/* Mobile Navigation */}
        <div className={`md:hidden ${mobileNavPanelClass}`}>
          <div className="p-4">
            <div className="flex items-center gap-2 mb-3">
              <ShieldCheck className="h-5 w-5" style={{ color: accentColor }} />
              <div className="text-sm font-semibold">Admin Panel</div>
              <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-md bg-emerald-500 text-white">
                v{(import.meta.env as Record<string, string>).VITE_APP_VERSION ?? '1.0.0'}
              </span>
            </div>
            <div className="grid grid-cols-2 gap-2">
                {navItems.map(({ key, label, Icon, path }) => {
                  const isActive = activeTab === key;
                  return (
                    <Link
                      key={key}
                      to={path}
                      className={`flex items-center justify-center gap-2 px-3 py-2 rounded-2xl text-sm transition ${
                        isActive
                          ? "bg-white text-black shadow-sm dark:bg-[#1f1f24] dark:text-stone-100"
                          : "text-stone-700 dark:text-stone-200 bg-stone-100 dark:bg-[#111116] hover:bg-stone-200 dark:hover:bg-[#1e1e22]"
                      }`}
                      style={
                        isActive
                          ? {
                              boxShadow: `0 6px 20px -15px ${accentColorWithOpacity}`,
                            }
                          : undefined
                      }
                    >
                      <Icon className="h-4 w-4" />
                      <span>{label}</span>
                      {key === "members" && activeReportsCount > 0 && (
                        <AlertTriangle className="h-3.5 w-3.5 text-red-500" title={`${activeReportsCount} active reports`} />
                      )}
                      {key === "plants" && (pendingPlantReportsCount > 0 || uniqueRequestedPlantsCount > 0) && (
                        <span className="flex items-center gap-1">
                          {pendingPlantReportsCount > 0 && (
                            <span className="px-1.5 py-0.5 text-[10px] font-semibold rounded-full bg-amber-500 text-white">
                              {pendingPlantReportsCount}
                            </span>
                          )}
                          {uniqueRequestedPlantsCount > 0 && (
                            <span className="px-1.5 py-0.5 text-[10px] font-semibold rounded-full bg-stone-200 dark:bg-stone-700 text-stone-700 dark:text-stone-200">
                              {uniqueRequestedPlantsCount}
                            </span>
                          )}
                        </span>
                      )}
                      {key === "bugs" && pendingBugReportsCount > 0 && (
                        <span className="px-1.5 py-0.5 text-[10px] font-semibold rounded-full bg-orange-100 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400">
                          {pendingBugReportsCount}
                        </span>
                      )}
                    </Link>
                  );
                })}
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-6 md:flex-row md:items-stretch md:min-h-[calc(100vh-96px)]">
          {/* Sidebar Navigation - Desktop Only */}
            <aside
              className={`hidden md:flex ${sidebarCollapsed ? "md:w-20" : "md:w-64 lg:w-72"} flex-shrink-0 md:sticky md:top-6 md:self-stretch transition-[width]`}
            >
              <div className={`${sidebarHeroClass} h-full`}>
                <div className="absolute inset-0 pointer-events-none">
                  <div className="absolute -top-8 -right-6 h-32 w-32 rounded-full bg-emerald-200/60 dark:bg-emerald-500/20 blur-3xl" />
                  <div className="absolute bottom-0 left-0 h-40 w-40 rounded-full bg-emerald-100/70 dark:bg-emerald-500/15 blur-[120px]" />
                </div>
                <div
                  className={`relative z-10 flex items-center ${sidebarCollapsed ? "justify-center" : "justify-between"} gap-3 p-4 border-b border-white/30 dark:border-white/10`}
                >
                  {!sidebarCollapsed && (
                    <div className="flex items-center gap-3">
                      <ShieldCheck className="h-6 w-6 text-emerald-600 dark:text-emerald-400" />
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-lg font-semibold">Admin Panel</span>
                          <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-md bg-emerald-500 text-white">
                            v{(import.meta.env as Record<string, string>).VITE_APP_VERSION ?? '1.0.0'}
                          </span>
                        </div>
                        <div className="text-xs text-stone-600 dark:text-stone-300">
                          Control Center
                        </div>
                      </div>
                    </div>
                  )}
                  <button
                    type="button"
                    onClick={toggleSidebarCollapsed}
                    className="rounded-full border border-white/40 dark:border-white/10 p-2 text-stone-600 dark:text-stone-200 hover:bg-white/70 dark:hover:bg-white/10 transition"
                    aria-label={sidebarCollapsed ? "Expand admin sidebar" : "Collapse admin sidebar"}
                  >
                    {sidebarCollapsed ? (
                      <ChevronRight className="h-4 w-4" />
                    ) : (
                      <ChevronLeft className="h-4 w-4" />
                    )}
                  </button>
                </div>
                <nav
                  className={`relative z-10 p-4 flex-1 overflow-y-auto ${sidebarCollapsed ? "space-y-3" : "space-y-2"}`}
                >
                  {navItems.map(({ key, label, Icon, path }) => {
                    const isActive = activeTab === key;
                    return (
                      <Link
                        key={key}
                        to={path}
                        title={sidebarCollapsed ? label : undefined}
                        className={`w-full flex ${
                          sidebarCollapsed ? "flex-col items-center gap-1 py-3" : "items-center gap-3 px-4 py-3"
                        } rounded-2xl transition ${
                          isActive
                            ? "bg-white/95 text-black shadow-sm dark:bg-[#1f1f24] dark:text-stone-100"
                            : "text-stone-700 dark:text-stone-200 hover:bg-white/70 dark:hover:bg-white/10"
                        }`}
                        style={
                          isActive
                            ? {
                                boxShadow: `0 12px 35px -20px ${accentColorWithOpacity}`,
                              }
                            : undefined
                        }
                      >
                        <Icon
                          className={`h-5 w-5 ${isActive ? "text-emerald-600 dark:text-emerald-400" : "opacity-80"}`}
                        />
                        {!sidebarCollapsed && <span className="font-medium">{label}</span>}
                        {key === "members" && activeReportsCount > 0 && (
                          <AlertTriangle 
                            className={`${sidebarCollapsed ? "h-3 w-3" : "h-4 w-4 ml-auto"} text-red-500`}
                            title={`${activeReportsCount} active reports`}
                          />
                        )}
                        {key === "plants" && (pendingPlantReportsCount > 0 || uniqueRequestedPlantsCount > 0) && (
                          <span className={`flex items-center gap-1 ${sidebarCollapsed ? "" : "ml-auto"}`}>
                            {pendingPlantReportsCount > 0 && (
                              <span
                                className={`${
                                  sidebarCollapsed ? "text-[10px]" : "text-xs"
                                } font-semibold rounded-full bg-amber-500 text-white px-2 py-0.5`}
                              >
                                {pendingPlantReportsCount}
                              </span>
                            )}
                            {uniqueRequestedPlantsCount > 0 && (
                              <span
                                className={`${
                                  sidebarCollapsed ? "text-[10px]" : "text-xs"
                                } font-semibold rounded-full bg-stone-200 dark:bg-stone-800 text-stone-700 dark:text-stone-100 px-2 py-0.5`}
                              >
                                {uniqueRequestedPlantsCount}
                              </span>
                            )}
                          </span>
                        )}
                        {key === "bugs" && pendingBugReportsCount > 0 && (
                          <span
                            className={`${
                              sidebarCollapsed ? "text-[10px]" : "ml-auto text-xs"
                            } font-semibold rounded-full bg-orange-100 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400 px-2 py-0.5`}
                          >
                            {pendingBugReportsCount}
                          </span>
                        )}
                      </Link>
                    );
                  })}
                </nav>
              </div>
            </aside>

          {/* Main Content Area */}
          <main className="flex-1 w-full">
            <div className="space-y-6">
            {/* Connection Status Banner - Show when APIs are down */}
            {(apiProbe.ok === false ||
              adminProbe.ok === false ||
              dbProbe.ok === false) && (
              <Card className="rounded-2xl mb-4 border-red-500 dark:border-red-500 bg-red-50 dark:bg-red-950/20">
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <AlertTriangle className="h-5 w-5 text-red-600 dark:text-red-400 flex-shrink-0" />
                    <div className="flex-1">
                      <div className="text-sm font-medium text-red-900 dark:text-red-100">
                        Connection Issues Detected
                      </div>
                      <div className="text-xs text-red-700 dark:text-red-300 mt-1">
                        {!apiProbe.ok && "API "}
                        {!adminProbe.ok && "Admin API "}
                        {!dbProbe.ok && "Database "}
                        {(!apiProbe.ok || !adminProbe.ok || !dbProbe.ok) &&
                          "may be unavailable. Some features may not work correctly."}
                      </div>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      className="rounded-xl border-red-300 dark:border-red-700 text-red-700 dark:text-red-300 hover:bg-red-100 dark:hover:bg-red-900/30"
                      onClick={refreshHealth}
                      disabled={healthRefreshing}
                    >
                      <RefreshCw
                        className={`h-4 w-4 mr-1 ${healthRefreshing ? "animate-spin" : ""}`}
                      />
                      Retry
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}

            <section className="space-y-6">
                <Card className="relative overflow-hidden rounded-[32px] border border-stone-200 dark:border-[#3e3e42] bg-gradient-to-br from-emerald-50 via-white to-stone-100 dark:from-[#252526] dark:via-[#1e1e1e] dark:to-[#171717] shadow-[0_35px_60px_-20px_rgba(16,185,129,0.35)]">
                <div className="absolute inset-0 pointer-events-none">
                    <div className="absolute -top-8 -right-4 h-48 w-48 rounded-full bg-emerald-200/50 dark:bg-emerald-500/10 blur-3xl" />
                    <div className="absolute bottom-0 left-0 h-48 w-48 rounded-full bg-emerald-100/50 dark:bg-emerald-500/10 blur-3xl" />
                </div>
                  <CardContent className="relative z-10 p-6 md:p-8 space-y-6">
                  <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                    <div>
                        <div className="text-2xl font-semibold tracking-tight">
                        Admin Controls
                      </div>
                        <div className="text-sm text-stone-600 dark:text-stone-300 mt-1 max-w-2xl">
                        Monitor services, manage members, and handle requests all in one place.
                      </div>
                    </div>
                  </div>

                  {/* Overview Tab */}
                  {activeTab === "overview" && (
                    <>
                      {/* Health monitor */}
                      <Card className={glassCardClass}>
                        <CardContent className="p-4">
                        <div className="flex items-center justify-between">
                          <div>
                            <div className="text-sm font-medium">
                              Health monitor
                            </div>
                            <div className="text-xs opacity-60">
                              Auto?ping every 60s
                            </div>
                          </div>
                          <Button
                            variant="outline"
                            size="icon"
                            aria-label="Refresh health"
                            onClick={refreshHealth}
                            disabled={healthRefreshing}
                            className="h-8 w-8 rounded-xl border bg-white text-black hover:bg-stone-50"
                          >
                            <RefreshCw
                              className={`h-4 w-4 ? ${healthRefreshing ? "animate-spin" : ""}`}
                            />
                          </Button>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-3">
                          <div className="flex items-center justify-between rounded-xl border p-3">
                            <div className="flex items-center gap-2 min-w-0">
                              <Server className="h-4 w-4 opacity-70" />
                              <div className="text-sm truncate">API</div>
                            </div>
                            <div className="flex items-center gap-2">
                              <div className="text-xs tabular-nums opacity-60">
                                {apiProbe.latencyMs !== null
                                  ? `${apiProbe.latencyMs} ms`
                                  : "-"}
                              </div>
                              <StatusDot
                                ok={apiProbe.ok}
                                title={
                                  !apiProbe.ok
                                    ? apiProbe.errorCode || undefined
                                    : undefined
                                }
                              />
                              {!apiProbe?.ok && (
                                <ErrorBadge code={apiProbe.errorCode} />
                              )}
                            </div>
                          </div>
                          <div className="flex items-center justify-between rounded-xl border p-3">
                            <div className="flex items-center gap-2 min-w-0">
                              <ShieldCheck className="h-4 w-4 opacity-70" />
                              <div className="text-sm truncate">Admin API</div>
                            </div>
                            <div className="flex items-center gap-2">
                              <div className="text-xs tabular-nums opacity-60">
                                {adminProbe.latencyMs !== null
                                  ? `${adminProbe.latencyMs} ms`
                                  : "-"}
                              </div>
                              <StatusDot
                                ok={adminProbe.ok}
                                title={
                                  !adminProbe.ok
                                    ? adminProbe.errorCode || undefined
                                    : undefined
                                }
                              />
                              {!adminProbe?.ok && (
                                <ErrorBadge code={adminProbe.errorCode} />
                              )}
                            </div>
                          </div>
                          <div className="flex items-center justify-between rounded-xl border p-3">
                            <div className="flex items-center gap-2 min-w-0">
                              <Database className="h-4 w-4 opacity-70" />
                              <div className="text-sm truncate">Database</div>
                            </div>
                            <div className="flex items-center gap-2">
                              <div className="text-xs tabular-nums opacity-60">
                                {dbProbe.latencyMs !== null
                                  ? `${dbProbe.latencyMs} ms`
                                  : "-"}
                              </div>
                              <StatusDot
                                ok={dbProbe.ok}
                                title={
                                  !dbProbe.ok
                                    ? dbProbe.errorCode || undefined
                                    : undefined
                                }
                              />
                              {!dbProbe?.ok && (
                                <ErrorBadge code={dbProbe.errorCode} />
                              )}
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>

                    {/* App Version Card */}
                    <Card className={`${glassCardClass} relative overflow-hidden`}>
                      {/* Subtle decorative glow from the badge */}
                      <div className="absolute -right-4 top-1/2 -translate-y-1/2 w-32 h-32 rounded-full bg-violet-500/10 dark:bg-violet-500/5 blur-3xl pointer-events-none" />
                      
                      <CardContent className="p-4 relative">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-4">
                            {/* Icon with enhanced styling */}
                            <div className="relative">
                              <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-violet-500 to-purple-600 blur-lg opacity-40" />
                              <div className="relative w-12 h-12 rounded-2xl bg-gradient-to-br from-violet-500 via-purple-500 to-purple-600 flex items-center justify-center shadow-xl shadow-violet-500/30 ring-1 ring-white/20">
                                <Sparkles className="h-6 w-6 text-white drop-shadow-sm" />
                              </div>
                            </div>
                            <div>
                              <div className="text-sm font-semibold">
                                App Version
                              </div>
                              <div className="text-xs text-violet-600/70 dark:text-violet-300/60">
                                Aphylia Release
                              </div>
                            </div>
                          </div>
                          
                          {/* Version badge section */}
                          <div className="flex flex-col items-end gap-1.5">
                            <div className="relative group">
                              <div className="absolute inset-0 rounded-xl bg-gradient-to-r from-violet-500 to-purple-600 blur-md opacity-50 group-hover:opacity-70 transition-opacity" />
                              <span className="relative inline-flex items-center px-4 py-1.5 rounded-xl bg-gradient-to-r from-violet-500 to-purple-600 text-white font-bold text-sm shadow-lg shadow-violet-500/25 ring-1 ring-white/20">
                                v{(import.meta.env as Record<string, string>).VITE_APP_VERSION ?? '1.0.0'}
                              </span>
                            </div>
                            <div className="flex items-center gap-1.5 text-xs opacity-60">
                              <GitBranch className="h-3.5 w-3.5" />
                              <span className="font-mono tracking-tight">
                                {(import.meta.env as Record<string, string>).VITE_COMMIT_SHA ?? 'dev'}
                              </span>
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>

                    {/* Quick Stats Cards */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                        {/* Currently Online Card */}
                        <div className="group relative rounded-2xl border border-emerald-200 dark:border-emerald-800/50 bg-gradient-to-br from-emerald-50 via-teal-50 to-cyan-50 dark:from-emerald-950/40 dark:via-teal-950/30 dark:to-cyan-950/20 p-5 shadow-sm hover:shadow-lg hover:shadow-emerald-500/10 transition-all duration-300 overflow-hidden">
                          {/* Decorative background element */}
                          <div className="absolute -right-6 -top-6 w-24 h-24 rounded-full bg-gradient-to-br from-emerald-200/40 to-teal-200/40 dark:from-emerald-800/20 dark:to-teal-800/20 blur-2xl" />
                          <div className="relative">
                            <div className="flex items-start justify-between gap-3 mb-4">
                              <div className="flex items-center gap-3">
                                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-500 flex items-center justify-center shadow-lg shadow-emerald-500/30">
                                  <Wifi className="h-6 w-6 text-white" />
                                </div>
                                <div>
                                  <div className="text-sm font-semibold text-emerald-900 dark:text-emerald-100">
                                    Currently Online
                                  </div>
                                  <div className="text-xs text-emerald-600/70 dark:text-emerald-400/70">
                                    {onlineUpdatedAt
                                      ? `${formatTimeAgo(onlineUpdatedAt)}`
                                      : "Updating..."}
                                  </div>
                                </div>
                              </div>
                              <Button
                                variant="ghost"
                                size="icon"
                                aria-label="Refresh currently online"
                                onClick={() => {
                                  loadOnlineUsers({ initial: false });
                                  loadOnlineIpsList({ initial: false });
                                }}
                                disabled={
                                  onlineLoading ||
                                  onlineRefreshing ||
                                  ipsLoading ||
                                  ipsRefreshing
                                }
                                className="h-8 w-8 rounded-xl bg-white/60 dark:bg-emerald-900/30 hover:bg-white dark:hover:bg-emerald-900/50 text-emerald-700 dark:text-emerald-300"
                              >
                                <RefreshCw
                                  className={`h-4 w-4 ${onlineLoading || onlineRefreshing || ipsLoading || ipsRefreshing ? "animate-spin" : ""}`}
                                />
                              </Button>
                            </div>
                            <div className="flex items-baseline gap-2">
                              <div className="text-4xl font-bold tabular-nums text-emerald-700 dark:text-emerald-300">
                                {onlineLoading ? (
                                  <span className="inline-block w-12 h-10 bg-emerald-200/50 dark:bg-emerald-800/30 rounded-lg animate-pulse" />
                                ) : (
                                  onlineUsers
                                )}
                              </div>
                              {!onlineLoading && onlineUsers > 0 && (
                                <div className="flex items-center gap-1">
                                  <span className="relative flex h-2.5 w-2.5">
                                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                                    <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500" />
                                  </span>
                                  <span className="text-xs font-medium text-emerald-600 dark:text-emerald-400">live</span>
                                </div>
                              )}
                            </div>
                            {/* Collapsible Connected IPs */}
                            <div className="mt-4 pt-3 border-t border-emerald-200/50 dark:border-emerald-800/30">
                              <button
                                type="button"
                                className="flex items-center gap-2 text-sm font-medium text-emerald-700 dark:text-emerald-300 hover:text-emerald-900 dark:hover:text-emerald-100 transition-colors"
                                onClick={() => setIpsOpen((o) => !o)}
                                aria-expanded={ipsOpen}
                                aria-controls="connected-ips"
                              >
                                <ChevronDown
                                  className={`h-4 w-4 transition-transform ${ipsOpen ? "rotate-180" : ""}`}
                                />
                                Connected IPs
                                {ips.length > 0 && (
                                  <span className="text-xs bg-emerald-200 dark:bg-emerald-800/50 px-2 py-0.5 rounded-full">
                                    {ips.length}
                                  </span>
                                )}
                              </button>
                              {ipsOpen && (
                                <div className="mt-3" id="connected-ips">
                                  <div className="rounded-xl bg-white/70 dark:bg-emerald-950/50 border border-emerald-200/50 dark:border-emerald-800/30 p-3 max-h-48 overflow-auto">
                                    {ipsLoading ? (
                                      <div className="text-sm text-emerald-600/70 dark:text-emerald-400/70">
                                        Loading...
                                      </div>
                                    ) : ips.length === 0 ? (
                                      <div className="text-sm text-emerald-600/70 dark:text-emerald-400/70">
                                        No IPs connected.
                                      </div>
                                    ) : (
                                      <div className="flex flex-wrap gap-2">
                                        {ips.map((ip) => (
                                          <Badge
                                            key={ip}
                                            role="button"
                                            tabIndex={0}
                                            onClick={() => jumpToIpLookup(ip)}
                                            onKeyDown={(e) => {
                                              if (e.key === "Enter" || e.key === " ") {
                                                e.preventDefault();
                                                jumpToIpLookup(ip);
                                              }
                                            }}
                                            title={`Lookup members for ${ip}`}
                                            aria-label={`Lookup members for ${ip}`}
                                            className="rounded-full px-2.5 py-1 text-xs font-mono cursor-pointer bg-emerald-100 dark:bg-emerald-900/50 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-200 dark:hover:bg-emerald-800/50 border-0 transition-colors"
                                          >
                                            {ip}
                                          </Badge>
                                        ))}
                                      </div>
                                    )}
                                  </div>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Registered Accounts Card */}
                        <div className="group relative rounded-2xl border border-violet-200 dark:border-violet-800/50 bg-gradient-to-br from-violet-50 via-purple-50 to-fuchsia-50 dark:from-violet-950/40 dark:via-purple-950/30 dark:to-fuchsia-950/20 p-5 shadow-sm hover:shadow-lg hover:shadow-violet-500/10 transition-all duration-300 overflow-hidden">
                          {/* Decorative background element */}
                          <div className="absolute -right-6 -top-6 w-24 h-24 rounded-full bg-gradient-to-br from-violet-200/40 to-purple-200/40 dark:from-violet-800/20 dark:to-purple-800/20 blur-2xl" />
                          <div className="relative">
                            <div className="flex items-start justify-between gap-3 mb-4">
                              <div className="flex items-center gap-3">
                                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-violet-500 to-purple-500 flex items-center justify-center shadow-lg shadow-violet-500/30">
                                  <Users className="h-6 w-6 text-white" />
                                </div>
                                <div>
                                  <div className="text-sm font-semibold text-violet-900 dark:text-violet-100">
                                    Registered Accounts
                                  </div>
                                  <div className="text-xs text-violet-600/70 dark:text-violet-400/70">
                                    {registeredUpdatedAt
                                      ? `${formatTimeAgo(registeredUpdatedAt)}`
                                      : "Updating..."}
                                  </div>
                                </div>
                              </div>
                              <Button
                                variant="ghost"
                                size="icon"
                                aria-label="Refresh registered accounts"
                                onClick={() =>
                                  loadRegisteredCount({ initial: false })
                                }
                                disabled={
                                  registeredLoading || registeredRefreshing
                                }
                                className="h-8 w-8 rounded-xl bg-white/60 dark:bg-violet-900/30 hover:bg-white dark:hover:bg-violet-900/50 text-violet-700 dark:text-violet-300"
                              >
                                <RefreshCw
                                  className={`h-4 w-4 ${registeredLoading || registeredRefreshing ? "animate-spin" : ""}`}
                                />
                              </Button>
                            </div>
                            <div className="flex items-baseline gap-2">
                              <div className="text-4xl font-bold tabular-nums text-violet-700 dark:text-violet-300">
                                {registeredLoading ? (
                                  <span className="inline-block w-16 h-10 bg-violet-200/50 dark:bg-violet-800/30 rounded-lg animate-pulse" />
                                ) : registeredUpdatedAt !== null ? (
                                  registeredCount ?? "-"
                                ) : (
                                  "-"
                                )}
                              </div>
                              <span className="text-sm font-medium text-violet-500 dark:text-violet-400">
                                users
                              </span>
                            </div>
                            {/* Progress indicator */}
                            <div className="mt-4 pt-3 border-t border-violet-200/50 dark:border-violet-800/30">
                              <div className="flex items-center justify-between text-xs">
                                <span className="text-violet-600/70 dark:text-violet-400/70">Total registered members</span>
                                <span className="font-medium text-violet-700 dark:text-violet-300">
                                  {registeredCount !== null && registeredCount > 0 ? "Active" : "—"}
                                </span>
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* Total Plants Card */}
                        <div className="group relative rounded-2xl border border-amber-200 dark:border-amber-800/50 bg-gradient-to-br from-amber-50 via-orange-50 to-yellow-50 dark:from-amber-950/40 dark:via-orange-950/30 dark:to-yellow-950/20 p-5 shadow-sm hover:shadow-lg hover:shadow-amber-500/10 transition-all duration-300 overflow-hidden">
                          {/* Decorative background element */}
                          <div className="absolute -right-6 -top-6 w-24 h-24 rounded-full bg-gradient-to-br from-amber-200/40 to-orange-200/40 dark:from-amber-800/20 dark:to-orange-800/20 blur-2xl" />
                          <div className="relative">
                            <div className="flex items-start justify-between gap-3 mb-4">
                              <div className="flex items-center gap-3">
                                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-amber-500 to-orange-500 flex items-center justify-center shadow-lg shadow-amber-500/30">
                                  <Leaf className="h-6 w-6 text-white" />
                                </div>
                                <div>
                                  <div className="text-sm font-semibold text-amber-900 dark:text-amber-100">
                                    Total Plants
                                  </div>
                                  <div className="text-xs text-amber-600/70 dark:text-amber-400/70">
                                    {plantsUpdatedAt
                                      ? `${formatTimeAgo(plantsUpdatedAt)}`
                                      : "Updating..."}
                                  </div>
                                </div>
                              </div>
                              <Button
                                variant="ghost"
                                size="icon"
                                aria-label="Refresh total plants"
                                onClick={() =>
                                  loadRegisteredCount({ initial: false })
                                }
                                disabled={plantsLoading || plantsRefreshing}
                                className="h-8 w-8 rounded-xl bg-white/60 dark:bg-amber-900/30 hover:bg-white dark:hover:bg-amber-900/50 text-amber-700 dark:text-amber-300"
                              >
                                <RefreshCw
                                  className={`h-4 w-4 ${plantsLoading || plantsRefreshing ? "animate-spin" : ""}`}
                                />
                              </Button>
                            </div>
                            <div className="flex items-baseline gap-2">
                              <div className="text-4xl font-bold tabular-nums text-amber-700 dark:text-amber-300">
                                {plantsLoading ? (
                                  <span className="inline-block w-14 h-10 bg-amber-200/50 dark:bg-amber-800/30 rounded-lg animate-pulse" />
                                ) : plantsUpdatedAt !== null ? (
                                  plantsCount ?? "-"
                                ) : (
                                  "-"
                                )}
                              </div>
                              <span className="text-sm font-medium text-amber-500 dark:text-amber-400">
                                plants
                              </span>
                            </div>
                            {/* Database indicator */}
                            <div className="mt-4 pt-3 border-t border-amber-200/50 dark:border-amber-800/30">
                              <div className="flex items-center justify-between text-xs">
                                <span className="text-amber-600/70 dark:text-amber-400/70">In database</span>
                                <div className="flex items-center gap-1.5">
                                  <Database className="h-3 w-3 text-amber-500 dark:text-amber-400" />
                                  <span className="font-medium text-amber-700 dark:text-amber-300">Synced</span>
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>

                    {/* System Health Stats */}
                    <Card className={glassCardClass}>
                      <CardContent className="p-4">
                        <div className="flex items-center justify-between mb-4">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-100 to-blue-100 dark:from-cyan-900/40 dark:to-blue-900/40 flex items-center justify-center">
                              <Server className="h-5 w-5 text-cyan-600 dark:text-cyan-400" />
                            </div>
                            <div>
                              <div className="text-sm font-semibold">System Health</div>
                              <div className="text-xs text-stone-500 dark:text-stone-400">
                                {systemHealth.platform || "Server"} • {systemHealth.nodeVersion || "Node.js"}
                              </div>
                            </div>
                          </div>
                          <Button
                            variant="outline"
                            size="icon"
                            aria-label="Refresh system health"
                            onClick={() => { setSystemHealthLoading(true); loadSystemHealth(); }}
                            disabled={systemHealthLoading}
                            className="h-8 w-8 rounded-xl"
                          >
                            <RefreshCw className={`h-4 w-4 ${systemHealthLoading ? "animate-spin" : ""}`} />
                          </Button>
                        </div>

                        {systemHealthError && !systemHealth.uptime && (
                          <div className="text-xs text-amber-600 dark:text-amber-400 mb-3 p-2 rounded-lg bg-amber-50 dark:bg-amber-900/20">
                            ⚠️ {systemHealthError}
                          </div>
                        )}

                        {/* Uptime & Connections Row - Compact */}
                        <div className="flex items-center gap-4 mb-4 py-2 px-3 rounded-xl bg-stone-50/80 dark:bg-stone-900/30 border border-stone-200/60 dark:border-stone-700/40">
                          <div className="flex items-center gap-2.5 flex-1">
                            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-emerald-500 to-teal-500 flex items-center justify-center shadow-sm">
                              <Clock className="h-4 w-4 text-white" />
                            </div>
                            <div className="flex flex-col">
                              <span className="text-[10px] uppercase tracking-wide font-medium text-stone-400 dark:text-stone-500">Uptime</span>
                              <span className="text-sm font-bold text-emerald-600 dark:text-emerald-400 tabular-nums">
                                {formatUptime(systemHealth.uptime)}
                              </span>
                            </div>
                          </div>
                          <div className="w-px h-8 bg-stone-200 dark:bg-stone-700" />
                          <div className="flex items-center gap-2.5 flex-1">
                            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-violet-500 to-purple-500 flex items-center justify-center shadow-sm">
                              <Users className="h-4 w-4 text-white" />
                            </div>
                            <div className="flex flex-col">
                              <span className="text-[10px] uppercase tracking-wide font-medium text-stone-400 dark:text-stone-500">Connections</span>
                              <span className="text-sm font-bold text-violet-600 dark:text-violet-400 tabular-nums">
                                {systemHealth.connections !== null ? systemHealth.connections : "-"}
                              </span>
                            </div>
                          </div>
                        </div>

                        {/* CPU Usage */}
                        <div className="mb-3">
                          <div className="flex items-center justify-between mb-1.5">
                            <div className="flex items-center gap-2">
                              <div className="w-5 h-5 rounded-md bg-blue-100 dark:bg-blue-900/40 flex items-center justify-center">
                                <Sparkles className="h-3 w-3 text-blue-600 dark:text-blue-400" />
                              </div>
                              <span className="text-xs font-medium">CPU</span>
                            </div>
                            <span className="text-xs font-semibold tabular-nums">
                              {systemHealth.cpu ? `${systemHealth.cpu.percent.toFixed(1)}%` : "-"}
                              {systemHealth.cpu?.cores && (
                                <span className="text-stone-400 font-normal ml-1">({systemHealth.cpu.cores} cores)</span>
                              )}
                            </span>
                          </div>
                          <HealthProgressBar percent={systemHealth.cpu?.percent ?? 0} />
                          {systemHealth.loadAvg && (
                            <div className="text-[10px] text-stone-400 mt-1">
                              Load avg: {systemHealth.loadAvg.map(l => l.toFixed(2)).join(" / ")}
                            </div>
                          )}
                        </div>

                        {/* Memory Usage */}
                        <div className="mb-3">
                          <div className="flex items-center justify-between mb-1.5">
                            <div className="flex items-center gap-2">
                              <div className="w-5 h-5 rounded-md bg-violet-100 dark:bg-violet-900/40 flex items-center justify-center">
                                <Database className="h-3 w-3 text-violet-600 dark:text-violet-400" />
                              </div>
                              <span className="text-xs font-medium">Memory</span>
                            </div>
                            <span className="text-xs font-semibold tabular-nums">
                              {systemHealth.memory
                                ? `${formatBytes(systemHealth.memory.used)} / ${formatBytes(systemHealth.memory.total)}`
                                : "-"}
                            </span>
                          </div>
                          <HealthProgressBar percent={systemHealth.memory?.percent ?? 0} />
                        </div>

                        {/* Disk Usage */}
                        <div>
                          <div className="flex items-center justify-between mb-1.5">
                            <div className="flex items-center gap-2">
                              <div className="w-5 h-5 rounded-md bg-amber-100 dark:bg-amber-900/40 flex items-center justify-center">
                                <Server className="h-3 w-3 text-amber-600 dark:text-amber-400" />
                              </div>
                              <span className="text-xs font-medium">Disk</span>
                              {systemHealth.disk?.path && (
                                <span className="text-[10px] text-stone-400 font-mono">{systemHealth.disk.path}</span>
                              )}
                            </div>
                            <span className="text-xs font-semibold tabular-nums">
                              {systemHealth.disk
                                ? `${formatBytes(systemHealth.disk.used)} / ${formatBytes(systemHealth.disk.total)}`
                                : "-"}
                            </span>
                          </div>
                          <HealthProgressBar percent={systemHealth.disk?.percent ?? 0} />
                        </div>

                        {/* Collapsible: Server Controls */}
                        <div className="mt-4 pt-3 border-t border-stone-200 dark:border-[#3e3e42]">
                          <button
                            type="button"
                            className="flex items-center gap-2 text-sm font-medium w-full"
                            onClick={() => setServerControlsOpen((o) => !o)}
                            aria-expanded={serverControlsOpen}
                            aria-controls="server-controls"
                          >
                            <ChevronDown
                              className={`h-4 w-4 transition-transform ${serverControlsOpen ? "rotate-180" : ""}`}
                            />
                            <Server className="h-4 w-4 opacity-70" />
                            Server Controls
                          </button>
                          {serverControlsOpen && (
                            <form className="mt-3 space-y-3" id="server-controls" onSubmit={(e) => e.preventDefault()} autoComplete="off">
                              {/* Root Password Input (shared) */}
                              <div className="rounded-xl border border-stone-200 dark:border-[#3e3e42] p-3 space-y-2 bg-stone-50/50 dark:bg-stone-900/20">
                                <div className="text-xs font-medium text-stone-600 dark:text-stone-400">
                                  Root Password (required for most actions)
                                </div>
                                <Input
                                  type="password"
                                  placeholder="Enter root password"
                                  value={setupPassword}
                                  onChange={(e) => setSetupPassword(e.target.value)}
                                  className="rounded-xl text-sm"
                                  disabled={runningSetup || restarting}
                                  autoComplete="off"
                                />
                              </div>

                              {/* Restart Server Button */}
                              <Button
                                variant="outline"
                                className="w-full rounded-xl justify-start gap-2"
                                onClick={restartServerWithPassword}
                                disabled={restarting || !setupPassword.trim()}
                              >
                                <RefreshCw className={`h-4 w-4 ${restarting ? "animate-spin" : ""}`} />
                                {restarting ? "Restarting..." : "Restart Server"}
                              </Button>

                              {/* Git Pull Button */}
                              <Button
                                variant="outline"
                                className="w-full rounded-xl justify-start gap-2"
                                onClick={gitPullOnly}
                                disabled={gitPulling}
                              >
                                <Github className={`h-4 w-4 ${gitPulling ? "animate-pulse" : ""}`} />
                                {gitPulling ? "Pulling..." : "Git Pull Only"}
                              </Button>

                              {/* Clear Memory Button */}
                              <Button
                                variant="outline"
                                className="w-full rounded-xl justify-start gap-2"
                                onClick={clearMemory}
                                disabled={clearingMemory}
                              >
                                <Database className={`h-4 w-4 ${clearingMemory ? "animate-pulse" : ""}`} />
                                {clearingMemory ? "Clearing..." : "Clear Memory"}
                              </Button>

                              {/* Regenerate Sitemap Button */}
                              <Button
                                variant="outline"
                                className="w-full rounded-xl justify-start gap-2"
                                onClick={regenerateSitemap}
                                disabled={regeneratingSitemap}
                              >
                                <FileText className={`h-4 w-4 ${regeneratingSitemap ? "animate-pulse" : ""}`} />
                                {regeneratingSitemap ? "Regenerating..." : "Regenerate Sitemap"}
                              </Button>
                              {/* Sitemap Info */}
                              {sitemapInfo && (
                                <div className="text-[10px] text-stone-400 space-y-0.5 pl-1">
                                  {sitemapInfo.exists ? (
                                    <>
                                      <div className="flex items-center gap-1">
                                        <span className="opacity-70">Last updated:</span>
                                        <span className="font-medium text-stone-500 dark:text-stone-300">
                                          {new Date(sitemapInfo.lastModified!).toLocaleString()}
                                        </span>
                                      </div>
                                      {sitemapInfo.urlCount !== null && sitemapInfo.urlCount !== undefined && (
                                        <div className="flex items-center gap-1">
                                          <span className="opacity-70">URLs:</span>
                                          <span className="font-medium">{sitemapInfo.urlCount.toLocaleString()}</span>
                                          <span className="opacity-70">•</span>
                                          <span className="opacity-70">Size:</span>
                                          <span className="font-medium">{(sitemapInfo.size! / 1024).toFixed(1)} KB</span>
                                        </div>
                                      )}
                                    </>
                                  ) : (
                                    <div className="text-amber-500">{sitemapInfo.message || "Sitemap not found"}</div>
                                  )}
                                </div>
                              )}

                              {/* Run Setup Button */}
                              <Button
                                variant="outline"
                                className="w-full rounded-xl justify-start gap-2"
                                onClick={runSetup}
                                disabled={runningSetup || !setupPassword.trim()}
                              >
                                <Package className={`h-4 w-4 ${runningSetup ? "animate-spin" : ""}`} />
                                {runningSetup ? "Running Setup..." : "Execute setup.sh"}
                              </Button>
                              <div className="text-[10px] text-stone-400">
                                setup.sh runs the full server provisioning script with root privileges
                              </div>
                            </form>
                          )}
                        </div>
                      </CardContent>
                    </Card>

                    {/* Actions */}
                    <Card className={glassCardClass}>
                      <CardContent className="p-4">
                        <div className="flex items-center justify-between gap-3">
                          <div className="text-sm font-medium truncate">
                            Actions
                          </div>
                        </div>

                        {/* Collapsible: Broadcast message creation */}
                        <div className="mt-2">
                          <button
                            type="button"
                            className="flex items-center gap-2 text-sm font-medium"
                            onClick={() => setBroadcastOpen((o) => !o)}
                            aria-expanded={broadcastOpen}
                            aria-controls="broadcast-create"
                          >
                            <ChevronDown
                              className={`h-4 w-4 transition-transform ? ${broadcastOpen ? "rotate-180" : ""}`}
                            />
                            Broadcast message
                          </button>
                          {broadcastOpen && (
                            <div className="mt-2" id="broadcast-create">
                              <BroadcastControls
                                inline
                                onExpired={() => setBroadcastOpen(true)}
                                onActive={() => setBroadcastOpen(true)}
                              />
                            </div>
                          )}
                        </div>

                        {/* Divider between Broadcast and the action controls/buttons */}
                        <div className="my-4 border-t" />

                        {/* Branch selection */}
                        <div className="mt-4 flex items-center justify-between gap-3">
                          <div className="flex items-center gap-2 min-w-0">
                            <GitBranch className="h-4 w-4 opacity-70" />
                            <div className="text-sm font-medium truncate">
                              Branch
                            </div>
                          </div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <div className="text-xs opacity-60 hidden sm:block">
                              Current:
                            </div>
                            <Badge
                              variant="outline"
                              className="rounded-full max-w-[360px] truncate"
                              title={currentBranch || undefined}
                            >
                              {branchesLoading
                                ? "?"
                                : shortenMiddle(
                                    currentBranch || "unknown",
                                    branchMaxChars,
                                  )}
                            </Badge>
                            {lastUpdateTime && (
                              <div
                                className="text-xs opacity-50"
                                title={lastUpdateTime}
                              >
                                ({formatLastUpdateTime(lastUpdateTime)})
                              </div>
                            )}
                          </div>
                        </div>
                        <div className="mt-3 flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                          <div className="flex-1 min-w-0">
                            <select
                              className="w-full rounded-xl border border-stone-300 dark:border-[#3e3e42] px-3 py-2 text-sm bg-white dark:bg-[#2d2d30] text-black dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 transition-colors"
                              value={selectedBranch}
                              onChange={(e) =>
                                setSelectedBranch(e.target.value)
                              }
                              disabled={branchesLoading || branchesRefreshing}
                              aria-label="Select branch"
                            >
                              {branchesLoading ? (
                                <option value="">Loading...</option>
                              ) : branchOptions.length === 0 ? (
                                <option value="">No branches found</option>
                              ) : (
                                branchOptions.map((b) => (
                                  <option key={b} value={b} title={b}>
                                    {shortenMiddle(b, branchMaxChars)}
                                  </option>
                                ))
                              )}
                            </select>
                          </div>
                          <Button
                            variant="outline"
                            className="rounded-xl w-full sm:w-auto px-2 sm:px-3"
                            onClick={() => loadBranches({ initial: false })}
                            disabled={branchesLoading || branchesRefreshing}
                            aria-label="Refresh branches"
                          >
                            <RefreshCw
                              className={`h-4 w-4 ? ${branchesRefreshing ? "animate-spin" : ""}`}
                            />
                            <span className="hidden sm:inline">
                              Refresh branches
                            </span>
                            <span className="sm:hidden inline">Refresh</span>
                          </Button>
                        </div>
                        <div className="text-xs opacity-60 mt-2">
                          Changing branch takes effect when you run Pull &
                          Build.
                        </div>

                          {/* Action buttons */}
                          <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                          <Button
                            className="rounded-2xl w-full"
                            onClick={restartServer}
                            disabled={restarting}
                          >
                            <Server className="h-4 w-4" />
                            <RefreshCw className="h-4 w-4" />
                            <span>
                              {restarting ? "Restarting?" : "Restart Services"}
                            </span>
                          </Button>
                          <Button
                            className="rounded-2xl w-full"
                            variant="secondary"
                            onClick={pullLatest}
                            disabled={pulling}
                          >
                            <Github className="h-4 w-4" />
                            <RefreshCw className="h-4 w-4" />
                            <span>
                              {pulling ? "Pulling..." : "Pull & Build"}
                            </span>
                          </Button>
                          <Button
                              className="rounded-2xl w-full"
                              variant="outline"
                              onClick={deployEdgeFunctions}
                              disabled={deployingEdge}
                            >
                              <CloudUpload className="h-4 w-4" />
                                <span>
                                  {deployingEdge
                                    ? "Deploying..."
                                    : "Deploy Edge"}
                                </span>
                            </Button>
                            <Button
                            className="rounded-2xl w-full"
                            variant="destructive"
                            onClick={runSyncSchema}
                            disabled={syncing}
                          >
                            <Database className="h-4 w-4" />
                            <span>
                              {syncing ? "Syncing..." : "Sync DB Schema"}
                            </span>
                          </Button>
                        </div>

                        {/* Reload notices */}
                        {preRestartNotice && (
                          <div className="mb-4 mt-4 rounded-xl border bg-yellow-100 dark:bg-yellow-900/40 border-yellow-300 dark:border-yellow-700 p-3 flex items-center justify-between gap-3">
                            <div className="text-sm text-yellow-900 dark:text-yellow-100">
                              New version built. Page info may be outdated. We
                              will restart services now; the site will stay up.
                              You can reload anytime.
                            </div>
                            <Button
                              className="rounded-xl"
                              variant="outline"
                              onClick={reloadPage}
                            >
                              Reload now
                            </Button>
                          </div>
                        )}
                        {reloadReady && (
                          <div className="mb-4 mt-4 rounded-xl border bg-yellow-100 dark:bg-yellow-900/40 border-yellow-300 dark:border-yellow-700 p-3 flex items-center justify-between gap-3">
                            <div className="text-sm text-yellow-900 dark:text-yellow-100">
                              Services restart complete. Reload when convenient.
                            </div>
                            <Button className="rounded-xl" onClick={reloadPage}>
                              Reload page
                            </Button>
                          </div>
                        )}

                        {/* Divider before Admin Console */}
                        <div className="my-4 border-t" />

                        {/* Admin Console (moved inside Actions card) */}
                        <div>
                          <div className="flex items-center justify-between">
                            <button
                              type="button"
                              className="flex items-center gap-2 text-sm font-medium"
                              onClick={() => setConsoleOpen((o) => !o)}
                              aria-expanded={consoleOpen}
                              aria-controls="admin-console"
                            >
                              <ChevronDown
                                className={`h-4 w-4 transition-transform ? ${consoleOpen ? "rotate-180" : ""}`}
                              />
                              Admin Console
                              {consoleLines.length > 0 && (
                                <span className="text-xs opacity-60">
                                  ({consoleLines.length} lines)
                                </span>
                              )}
                            </button>
                            <Button
                              variant="outline"
                              size="sm"
                              className="rounded-xl h-8 px-3"
                              onClick={softRefreshAdmin}
                              aria-label="Refresh admin data"
                              title="Soft reload (won't lose edits)"
                            >
                              <RefreshCw className="h-4 w-4" />
                              Reload
                            </Button>
                          </div>
                          {consoleOpen && (
                            <div className="mt-2" id="admin-console">
                              <div
                                className={`relative rounded-xl border ? ${hasConsoleError ? "border-4 border-rose-600 ring-8 ring-rose-500/40 shadow-lg shadow-rose-500/30" : ""}`}
                              >
                                <div
                                  ref={consoleRef}
                                  className="h-48 overflow-auto bg-black text-white text-xs p-3 pr-8 font-mono whitespace-pre-wrap rounded-xl"
                                  aria-live="polite"
                                >
                                  {consoleLines.length === 0
                                    ? "No messages yet."
                                    : consoleLines.join("\n")}
                                </div>
                                <div className="pointer-events-none absolute bottom-2 right-3 z-10 flex items-center gap-1">
                                  <Button
                                    size="icon"
                                    variant="ghost"
                                    className="pointer-events-auto h-7 w-7 rounded-md bg-white/10 text-white hover:bg-white/20"
                                    onClick={() => setConsoleOpen(false)}
                                    title="Hide console"
                                    aria-label="Hide console"
                                  >
                                    <EyeOff className="h-4 w-4" />
                                  </Button>
                                  <Button
                                    size="icon"
                                    variant="ghost"
                                    className="pointer-events-auto h-7 w-7 rounded-md bg-white/10 text-white hover:bg-white/20"
                                    onClick={() => {
                                      setConsoleLines([]);
                                      setConsoleOpen(true);
                                    }}
                                    title="Clear console"
                                    aria-label="Clear console"
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                  <Button
                                    size="icon"
                                    variant="ghost"
                                    className="pointer-events-auto h-7 w-7 rounded-md bg-white/10 text-white hover:bg-white/20"
                                    onClick={async () => {
                                      const ok =
                                        await copyTextToClipboard(
                                          getAllLogsText(),
                                        );
                                      if (!ok)
                                        alert(
                                          "Copy failed. You can still select and copy manually.",
                                        );
                                    }}
                                    title="Copy console"
                                    aria-label="Copy console"
                                  >
                                    <Copy className="h-4 w-4" />
                                  </Button>
                                </div>
                              </div>
                            </div>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                      <Card className={glassCardClass}>
                        <CardContent className="p-4">
                          <div className="flex items-center justify-between gap-2 mb-2">
                            <div>
                              <div className="flex items-center gap-2">
                                <div className="text-sm font-medium">
                                  Unique visitors - last {visitorsWindowDays}{" "}
                                  days
                                </div>
                                <div className="flex items-center gap-1">
                                  <button
                                    type="button"
                                    className={`text-xs px-2 py-1 rounded-lg border ${visitorsWindowDays === 7 ? "bg-black dark:bg-white text-white dark:text-black" : "bg-white dark:bg-[#2d2d30]"}`}
                                    onClick={() => setVisitorsWindowDays(7)}
                                    aria-pressed={visitorsWindowDays === 7}
                                  >
                                    7d
                                  </button>
                                  <button
                                    type="button"
                                    className={`text-xs px-2 py-1 rounded-lg border ${visitorsWindowDays === 30 ? "bg-black dark:bg-white text-white dark:text-black" : "bg-white dark:bg-[#2d2d30]"}`}
                                    onClick={() => setVisitorsWindowDays(30)}
                                    aria-pressed={visitorsWindowDays === 30}
                                  >
                                    30d
                                  </button>
                                </div>
                              </div>
                              <div className="text-xs opacity-60">
                                {visitorsUpdatedAt
                                  ? `Updated ? ${formatTimeAgo(visitorsUpdatedAt)}`
                                  : "Updated -"}
                              </div>
                            </div>
                            <Button
                              variant="outline"
                              size="icon"
                              aria-label="Refresh visitors"
                              onClick={() =>
                                loadVisitorsStats({ initial: false })
                              }
                              disabled={visitorsLoading || visitorsRefreshing}
                              className="h-8 w-8 rounded-xl border bg-white text-black hover:bg-stone-50"
                            >
                              <RefreshCw
                                className={`h-4 w-4 ? ${visitorsLoading || visitorsRefreshing ? "animate-spin" : ""}`}
                              />
                            </Button>
                          </div>

                          {visitorsLoading ? (
                            <div className="flex items-center gap-2 text-sm opacity-60">
                              <Loader2 className="h-4 w-4 animate-spin" />
                              <span>Loading...</span>
                            </div>
                          ) : visitorsSeries.length === 0 ? (
                            <div className="text-sm opacity-60">
                              No data yet.
                            </div>
                          ) : (
                            (() => {
                              const values = visitorsSeries.map(
                                (d) => d.uniqueVisitors,
                              );
                              const maxVal = Math.max(...values, 1);
                              // Prefer unique total across the full week from API; fallback to sum
                              const totalVal =
                                visitorsTotalUnique7d &&
                                Number.isFinite(visitorsTotalUnique7d)
                                  ? visitorsTotalUnique7d
                                  : values.reduce((acc, val) => acc + val, 0);
                              const avgVal = Math.round(
                                totalVal / values.length,
                              );

                              const formatDow = (isoDate: string) => {
                                try {
                                  if (visitorsWindowDays === 30) return "";
                                  const dt = new Date(isoDate + "T00:00:00Z");
                                  return [
                                    "Sun",
                                    "Mon",
                                    "Tue",
                                    "Wed",
                                    "Thu",
                                    "Fri",
                                    "Sat",
                                  ][dt.getUTCDay()];
                                } catch {
                                  return isoDate;
                                }
                              };

                              const formatFullDate = (isoDate: string) => {
                                try {
                                  const dt = new Date(isoDate + "T00:00:00Z");
                                  return new Intl.DateTimeFormat(undefined, {
                                    weekday: "short",
                                    month: "short",
                                    day: "numeric",
                                    year: "numeric",
                                    timeZone: "UTC",
                                  }).format(dt);
                                } catch {
                                  return isoDate;
                                }
                              };

                              const TooltipContent = ({
                                active,
                                payload,
                                label,
                              }: { active?: boolean; payload?: Array<{ value?: number }>; label?: string }) => {
                                if (!active || !payload || payload.length === 0)
                                  return null;
                                const current = payload[0]?.value as number;
                                const idx = visitorsSeries.findIndex(
                                  (d) => d.date === label,
                                );
                                const prev =
                                  idx > 0
                                    ? (visitorsSeries[idx - 1]
                                        ?.uniqueVisitors ?? 0)
                                    : 0;
                                const delta = current - prev;
                                const pct =
                                  prev > 0
                                    ? Math.round((delta / prev) * 100)
                                    : null;
                                const up = delta > 0;
                                const down = delta < 0;
                                return (
                                  <div className="rounded-xl border bg-white/90 dark:bg-[#252526] dark:border-[#3e3e42] backdrop-blur p-3 shadow-lg">
                                    <div className="text-xs opacity-60 dark:opacity-70">
                                      {formatFullDate(label)}
                                    </div>
                                    <div className="mt-1 text-base font-semibold tabular-nums">
                                      {current}
                                    </div>
                                    <div className="text-xs mt-0.5">
                                      <span
                                        className={
                                          up
                                            ? "text-emerald-600 dark:text-emerald-400"
                                            : down
                                              ? "text-rose-600 dark:text-rose-400"
                                              : "text-neutral-600 dark:text-neutral-400"
                                        }
                                      >
                                        {delta === 0
                                          ? "No change"
                                          : `${up ? "+" : ""}${delta}${pct !== null ? ` (${pct}%)` : ""}`}
                                      </span>
                                      <span className="opacity-60 dark:opacity-70">
                                        {" "}
                                        vs previous day
                                      </span>
                                    </div>
                                    <div className="text-[11px] opacity-70 dark:opacity-80 mt-1">
                                      7-day avg:{" "}
                                      <span className="font-medium">
                                        {avgVal}
                                      </span>
                                    </div>
                                  </div>
                                );
                              };

                              return (
                                <div>
                                  <div className="text-sm font-medium mb-2">
                                    Total for the whole week:{" "}
                                    <span className="tabular-nums">
                                      {totalVal}
                                    </span>
                                  </div>
                                  <div className="h-72 w-full max-w-none mx-0">
                                    <ChartSuspense
                                      fallback={
                                        <div className="h-full w-full flex items-center justify-center text-sm text-gray-400">
                                          Loading chart...
                                        </div>
                                      }
                                    >
                                      <ResponsiveContainer
                                        width="100%"
                                        height="100%"
                                      >
                                        <ComposedChart
                                          data={visitorsSeries}
                                          margin={{
                                            top: 10,
                                            right: 8,
                                            bottom: 14,
                                            left: 8,
                                          }}
                                        >
                                          <defs>
                                            <linearGradient
                                              id="visitsLineGrad"
                                              x1="0"
                                              y1="0"
                                              x2="1"
                                              y2="0"
                                            >
                                              <stop
                                                offset="0%"
                                                stopColor={
                                                  isDark ? "#60a5fa" : "#111827"
                                                }
                                              />
                                              <stop
                                                offset="100%"
                                                stopColor={
                                                  isDark ? "#a78bfa" : "#6b7280"
                                                }
                                              />
                                            </linearGradient>
                                            <linearGradient
                                              id="visitsAreaGrad"
                                              x1="0"
                                              y1="0"
                                              x2="0"
                                              y2="1"
                                            >
                                              <stop
                                                offset="0%"
                                                stopColor={
                                                  isDark ? "#60a5fa" : "#111827"
                                                }
                                                stopOpacity={
                                                  isDark ? 0.4 : 0.35
                                                }
                                              />
                                              <stop
                                                offset="100%"
                                                stopColor={
                                                  isDark ? "#60a5fa" : "#111827"
                                                }
                                                stopOpacity={
                                                  isDark ? 0.1 : 0.05
                                                }
                                              />
                                            </linearGradient>
                                          </defs>

                                          <CartesianGrid
                                            strokeDasharray="3 3"
                                            stroke={
                                              isDark
                                                ? "rgba(255,255,255,0.1)"
                                                : "rgba(0,0,0,0.06)"
                                            }
                                          />
                                          <XAxis
                                            dataKey="date"
                                            tickFormatter={formatDow}
                                            tick={{
                                              fontSize: 11,
                                              fill: isDark
                                                ? "#d1d5db"
                                                : "#525252",
                                            }}
                                            axisLine={false}
                                            tickLine={false}
                                            interval={0}
                                            padding={{ left: 0, right: 0 }}
                                          />
                                          <YAxis
                                            allowDecimals={false}
                                            domain={[0, Math.max(maxVal, 5)]}
                                            tick={{
                                              fontSize: 11,
                                              fill: isDark
                                                ? "#d1d5db"
                                                : "#525252",
                                            }}
                                            axisLine={false}
                                            tickLine={false}
                                            width={28}
                                          />
                                          <Tooltip
                                            content={<TooltipContent />}
                                            cursor={{
                                              stroke: isDark
                                                ? "rgba(255,255,255,0.2)"
                                                : "rgba(0,0,0,0.1)",
                                            }}
                                          />
                                          <ReferenceLine
                                            y={avgVal}
                                            stroke={
                                              isDark ? "#9ca3af" : "#a3a3a3"
                                            }
                                            strokeDasharray="4 4"
                                            ifOverflow="extendDomain"
                                            label={{
                                              value: "avg",
                                              position: "insideRight",
                                              fill: isDark
                                                ? "#d1d5db"
                                                : "#737373",
                                              fontSize: 11,
                                              dx: -6,
                                            }}
                                          />

                                          <Area
                                            type="monotone"
                                            dataKey="uniqueVisitors"
                                            fill="url(#visitsAreaGrad)"
                                            stroke="none"
                                            animationDuration={600}
                                          />
                                          <Line
                                            type="monotone"
                                            dataKey="uniqueVisitors"
                                            stroke="url(#visitsLineGrad)"
                                            strokeWidth={3}
                                            dot={false}
                                            activeDot={{
                                              r: 5,
                                              strokeWidth: 2,
                                              stroke: isDark
                                                ? "#60a5fa"
                                                : "#111827",
                                              fill: isDark
                                                ? "#1e1e1e"
                                                : "#ffffff",
                                            }}
                                            animationDuration={700}
                                          />
                                        </ComposedChart>
                                      </ResponsiveContainer>
                                    </ChartSuspense>
                                  </div>
                                  {/* Sources breakdown */}
                                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-4">
                                    <div className="rounded-xl border p-3 md:col-span-2">
                                      <div className="text-sm font-medium mb-2">
                                        Top countries
                                      </div>
                                      {topCountries.length === 0 ? (
                                        <div className="text-sm opacity-60">
                                          No data.
                                        </div>
                                      ) : (
                                        <div className="grid grid-cols-1 md:grid-cols-3 gap-1">
                                          <div className="col-span-2 min-h-[150px]">
                                            <ChartSuspense
                                              fallback={
                                                <div className="h-[150px] w-full flex items-center justify-center text-sm text-gray-400">
                                                  Loading chart...
                                                </div>
                                              }
                                            >
                                              <ResponsiveContainer
                                                width="100%"
                                                height={150}
                                              >
                                                <PieChart
                                                  margin={{
                                                    top: 0,
                                                    right: 0,
                                                    bottom: 0,
                                                    left: 0,
                                                  }}
                                                >
                                                  {(() => {
                                                    const pieData: Array<{
                                                      country: string;
                                                      visits: number;
                                                      pct?: number;
                                                      isOther?: boolean;
                                                      fill?: string;
                                                    }> = topCountries
                                                      .slice(0, 5)
                                                      .map((c, idx) => ({
                                                        ...c,
                                                        fill: countryColors[
                                                          idx %
                                                            countryColors.length
                                                        ],
                                                      }));
                                                    if (
                                                      otherCountries &&
                                                      otherCountries.visits > 0
                                                    ) {
                                                      pieData.push({
                                                        country: "Other",
                                                        visits:
                                                          otherCountries.visits,
                                                        pct: otherCountries.pct,
                                                        isOther: true,
                                                        fill: countryColors[
                                                          5 %
                                                            countryColors.length
                                                        ],
                                                      });
                                                    }
                                                    const totalVisits =
                                                      pieData.reduce(
                                                        (s, x) =>
                                                          s + (x.visits || 0),
                                                        0,
                                                      );
                                                    const CountryPieTooltip = ({
                                                      active,
                                                      payload,
                                                    }: {
                                                      active?: boolean;
                                                      payload?: Array<{ payload?: { country: string; visits: number; pct?: number; isOther?: boolean } }>;
                                                    }) => {
                                                      if (
                                                        !active ||
                                                        !payload ||
                                                        !payload.length
                                                      )
                                                        return null;
                                                      const d = payload[0]
                                                        ?.payload as {
                                                        country: string;
                                                        visits: number;
                                                        pct?: number;
                                                        isOther?: boolean;
                                                      };
                                                      if (!d) return null;
                                                      if (d.isOther) {
                                                        const items: Array<{
                                                          country: string;
                                                          visits: number;
                                                        }> = Array.isArray(
                                                          otherCountries?.items,
                                                        )
                                                          ? (otherCountries!
                                                              .items as Array<{
                                                              country: string;
                                                              visits: number;
                                                            }>)
                                                          : [];
                                                        const otherTotal =
                                                          Math.max(
                                                            0,
                                                            otherCountries?.visits ||
                                                              0,
                                                          );
                                                        const rows: Array<{
                                                          name: string;
                                                          visits: number;
                                                          pctTotal: number;
                                                          pctOther: number;
                                                        }> = items
                                                          .map(
                                                            (it: {
                                                              country: string;
                                                              visits: number;
                                                            }) => ({
                                                              name: countryCodeToName(
                                                                it.country,
                                                              ),
                                                              visits: it.visits,
                                                              pctTotal:
                                                                totalVisits > 0
                                                                  ? (it.visits /
                                                                      totalVisits) *
                                                                    100
                                                                  : 0,
                                                              pctOther:
                                                                otherTotal > 0
                                                                  ? (it.visits /
                                                                      otherTotal) *
                                                                    100
                                                                  : 0,
                                                            }),
                                                          )
                                                          .sort(
                                                            (
                                                              a: {
                                                                visits: number;
                                                              },
                                                              b: {
                                                                visits: number;
                                                              },
                                                            ) =>
                                                              (b.visits || 0) -
                                                              (a.visits || 0),
                                                          );
                                                        return (
                                                          <div className="rounded-xl border bg-white dark:bg-[#252526] dark:border-[#3e3e42] shadow px-3 py-2 max-w-[480px]">
                                                            <div className="text-xs font-medium mb-1">
                                                              Countries in Other
                                                            </div>
                                                            <div className="text-[11px] opacity-80 dark:opacity-70 space-y-0.5">
                                                              {rows.map(
                                                                (
                                                                  r: {
                                                                    name: string;
                                                                    visits: number;
                                                                    pctTotal: number;
                                                                    pctOther: number;
                                                                  },
                                                                  idx: number,
                                                                ) => (
                                                                  <div
                                                                    key={`${r.name}-${idx}`}
                                                                    className="flex items-center justify-between gap-3"
                                                                  >
                                                                    <div className="truncate">
                                                                      {r.name}
                                                                    </div>
                                                                    <div className="text-[11px] tabular-nums whitespace-nowrap">
                                                                      {Math.round(
                                                                        r.pctOther,
                                                                      )}
                                                                      % of Other
                                                                      ?{" "}
                                                                      {Math.round(
                                                                        r.pctTotal,
                                                                      )}
                                                                      % ?{" "}
                                                                      {r.visits}
                                                                    </div>
                                                                  </div>
                                                                ),
                                                              )}
                                                            </div>
                                                          </div>
                                                        );
                                                      }
                                                      const name =
                                                        countryCodeToName(
                                                          d.country,
                                                        );
                                                      const pct = Math.round(
                                                        d.pct ??
                                                          (totalVisits > 0
                                                            ? (d.visits /
                                                                totalVisits) *
                                                              100
                                                            : 0),
                                                      );
                                                      return (
                                                        <div className="rounded-xl border bg-white dark:bg-[#252526] dark:border-[#3e3e42] shadow px-3 py-2">
                                                          <div className="text-xs font-medium">
                                                            {name}
                                                          </div>
                                                          <div className="text-[11px] opacity-80 dark:opacity-70">
                                                            {pct}% ? {d.visits}
                                                          </div>
                                                        </div>
                                                      );
                                                    };
                                                    return (
                                                      <>
                                                        <Pie
                                                          data={pieData}
                                                          dataKey="visits"
                                                          nameKey="country"
                                                          innerRadius={36}
                                                          outerRadius={64}
                                                          paddingAngle={3}
                                                          cx="40%"
                                                          cy="50%"
                                                          isAnimationActive={
                                                            false
                                                          }
                                                        >
                                                          {pieData.map(
                                                            (entry, index) => {
                                                              // Use color index 5 for "Other", otherwise use the index (0-4 for top countries)
                                                              const colorIndex =
                                                                entry.isOther
                                                                  ? 5
                                                                  : index;
                                                              const color =
                                                                entry.fill ||
                                                                countryColors[
                                                                  colorIndex %
                                                                    countryColors.length
                                                                ];
                                                              return (
                                                                <Cell
                                                                  key={`cell-${entry.country}-${index}-${color}`}
                                                                  fill={color}
                                                                  stroke={
                                                                    isDark
                                                                      ? color
                                                                      : color
                                                                  }
                                                                  strokeWidth={
                                                                    isDark
                                                                      ? 0
                                                                      : 2
                                                                  }
                                                                />
                                                              );
                                                            },
                                                          )}
                                                        </Pie>
                                                        <Tooltip
                                                          content={
                                                            <CountryPieTooltip />
                                                          }
                                                          cursor={{
                                                            stroke: isDark
                                                              ? "rgba(255,255,255,0.2)"
                                                              : "rgba(0,0,0,0.1)",
                                                          }}
                                                        />
                                                      </>
                                                    );
                                                  })()}
                                                </PieChart>
                                              </ResponsiveContainer>
                                            </ChartSuspense>
                                          </div>
                                          <div className="flex flex-col gap-1">
                                            {topCountries
                                              .slice(0, 5)
                                              .map((c, idx) => (
                                                <div
                                                  key={c.country}
                                                  className="flex items-center justify-between"
                                                >
                                                  <div className="flex-1 flex items-center gap-1.5 min-w-0">
                                                    <span
                                                      className="inline-block h-3 w-3 rounded-full"
                                                      style={{
                                                        backgroundColor:
                                                          countryColors[
                                                            idx %
                                                              countryColors.length
                                                          ],
                                                      }}
                                                    />
                                                    <span className="text-sm truncate">
                                                      {countryCodeToName(
                                                        c.country,
                                                      )}
                                                    </span>
                                                  </div>
                                                  <span className="text-sm tabular-nums">
                                                    {Math.round(c.pct || 0)}%
                                                  </span>
                                                </div>
                                              ))}
                                            {otherCountries &&
                                              otherCountries.visits > 0 && (
                                                <div className="flex items-center justify-between">
                                                  <div
                                                    className="flex-1 flex items-center gap-1.5 min-w-0"
                                                    onMouseEnter={(e) =>
                                                      showOtherCountriesTooltip(
                                                        e.currentTarget as HTMLElement,
                                                      )
                                                    }
                                                    onMouseLeave={
                                                      hideOtherCountriesTooltip
                                                    }
                                                    onFocus={(e) =>
                                                      showOtherCountriesTooltip(
                                                        e.currentTarget as HTMLElement,
                                                      )
                                                    }
                                                    onBlur={
                                                      hideOtherCountriesTooltip
                                                    }
                                                  >
                                                    <span
                                                      className="inline-block h-3 w-3 rounded-full"
                                                      style={{
                                                        backgroundColor:
                                                          countryColors[
                                                            5 %
                                                              countryColors.length
                                                          ],
                                                      }}
                                                    />
                                                    <span className="text-sm truncate">
                                                      Other (
                                                      {otherCountries.count})
                                                    </span>
                                                  </div>
                                                  <span className="text-sm tabular-nums">
                                                    {Math.round(
                                                      otherCountries?.pct || 0,
                                                    )}
                                                    %
                                                  </span>
                                                </div>
                                              )}
                                          </div>
                                        </div>
                                      )}
                                    </div>
                                    <div className="rounded-xl border p-3 md:col-span-1">
                                      <div className="text-sm font-medium mb-2">
                                        Top referrers
                                      </div>
                                      {topReferrers.length === 0 ? (
                                        <div className="text-sm opacity-60">
                                          No data.
                                        </div>
                                      ) : (
                                        <div className="flex flex-col gap-2">
                                          {topReferrers
                                            .slice(0, 5)
                                            .map((r, idx) => (
                                              <div
                                                key={r.source}
                                                className="flex items-center justify-between"
                                              >
                                                <div className="flex-1 flex items-center gap-2 min-w-0">
                                                  <span
                                                    className="inline-block h-3 w-3 rounded-full"
                                                    style={{
                                                      backgroundColor:
                                                        referrerColors[
                                                          idx %
                                                            referrerColors.length
                                                        ],
                                                    }}
                                                  />
                                                  <span className="text-sm truncate">
                                                    {r.source}
                                                  </span>
                                                </div>
                                                <span className="text-sm tabular-nums">
                                                  {Math.round(r.pct || 0)}%
                                                </span>
                                              </div>
                                            ))}
                                          {otherReferrers &&
                                            otherReferrers.visits > 0 && (
                                              <div className="flex items-center justify-between">
                                                <div className="flex-1 flex items-center gap-2 min-w-0">
                                                  <span
                                                    className="inline-block h-3 w-3 rounded-full"
                                                    style={{
                                                      backgroundColor:
                                                        referrerColors[
                                                          4 %
                                                            referrerColors.length
                                                        ],
                                                    }}
                                                  />
                                                  <span className="text-sm truncate">
                                                    Other (
                                                    {otherReferrers.count})
                                                  </span>
                                                </div>
                                                <span className="text-sm tabular-nums">
                                                  {Math.round(
                                                    otherReferrers.pct || 0,
                                                  )}
                                                  %
                                                </span>
                                              </div>
                                            )}
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                </div>
                              );
                            })()
                          )}
                        </CardContent>
                      </Card>
                      <div className="text-xs font-medium uppercase tracking-wide opacity-60 mt-6 mb-2">
                        Quick Links
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <Button
                          asChild
                          variant="outline"
                          className="rounded-2xl"
                        >
                          <a
                            href="https://github.com/Duckxel/PlantSwipe"
                            target="_blank"
                            rel="noreferrer"
                          >
                            <Github className="h-4 w-4" />
                            <span>GitHub</span>
                            <ExternalLink className="h-3 w-3 opacity-70" />
                          </a>
                        </Button>
                        <Button
                          asChild
                          variant="outline"
                          className="rounded-2xl"
                        >
                          <a
                            href="https://resend.com/emails"
                            target="_blank"
                            rel="noreferrer"
                          >
                            <span className="inline-block h-3 w-3 rounded-sm bg-purple-600 dark:bg-purple-500" />
                            <span>Resend</span>
                            <ExternalLink className="h-3 w-3 opacity-70" />
                          </a>
                        </Button>
                        <Button
                          asChild
                          variant="outline"
                          className="rounded-2xl"
                        >
                          <a
                            href="https://supabase.com/dashboard/project/lxnkcguwewrskqnyzjwi"
                            target="_blank"
                            rel="noreferrer"
                          >
                            <span className="inline-block h-3 w-3 rounded-sm bg-emerald-600 dark:bg-emerald-500" />
                            <span>Supabase</span>
                            <ExternalLink className="h-3 w-3 opacity-70" />
                          </a>
                        </Button>
                        <Button
                          asChild
                          variant="outline"
                          className="rounded-2xl"
                        >
                          <a
                            href="https://cloud.linode.com/linodes/84813440/metrics"
                            target="_blank"
                            rel="noreferrer"
                          >
                            <span className="inline-block h-3 w-3 rounded-sm bg-blue-600 dark:bg-blue-500" />
                            <span>Linode</span>
                            <ExternalLink className="h-3 w-3 opacity-70" />
                          </a>
                        </Button>
                        <Button
                          asChild
                          variant="outline"
                          className="rounded-2xl"
                        >
                          <a
                            href="https://analytics.google.com/analytics/web"
                            target="_blank"
                            rel="noreferrer"
                          >
                            <span className="inline-block h-3 w-3 rounded-sm bg-orange-500 dark:bg-orange-400" />
                            <span>Analytics</span>
                            <ExternalLink className="h-3 w-3 opacity-70" />
                          </a>
                        </Button>
                      </div>
                  </>
                )}

                {/* Stocks Tab */}
                {activeTab === "stocks" && (
                  <AdminStocksPanel />
                )}

                {/* Bugs Tab */}
                {activeTab === "bugs" && (
                  <AdminBugsPanel />
                )}

                {/* Plants Tab */}
                  {activeTab === "plants" && (
                    <div className="space-y-4">
                      <div className="flex justify-center">
                        <div className="inline-flex items-center gap-1 rounded-full border border-stone-200 dark:border-[#3e3e42] bg-white/80 dark:bg-[#1a1a1d]/80 px-1 py-1 backdrop-blur">
                          {REQUEST_VIEW_TABS.map((tab) => {
                            const isActive = requestViewMode === tab.key;
                            const tabPath = tab.key === "requests" ? "/admin/plants/requests" : tab.key === "reports" ? "/admin/plants/reports" : "/admin/plants";
                            return (
                              <Link
                                key={tab.key}
                                to={tabPath}
                                className={`px-4 py-1.5 text-sm font-semibold rounded-full transition-colors ${
                                  isActive
                                    ? "bg-emerald-600 text-white shadow"
                                    : "text-stone-600 dark:text-stone-300 hover:text-black dark:hover:text-white"
                                }`}
                              >
                                {tab.label}
                                {tab.key === "reports" && pendingPlantReportsCount > 0 && (
                                  <span className={`ml-1.5 px-1.5 py-0.5 text-[10px] font-bold rounded-full ${
                                    isActive
                                      ? "bg-white/25 text-white"
                                      : "bg-amber-500 text-white"
                                  }`}>
                                    {pendingPlantReportsCount}
                                  </span>
                                )}
                              </Link>
                            );
                          })}
                        </div>
                      </div>
                        {plantViewIsReports ? (
                          <AdminPlantReportsPanel />
                        ) : plantViewIsPlants ? (
                          <div className="space-y-6 sm:space-y-8">
                            {/* Header Section */}
                            <div className="flex flex-col gap-4 sm:gap-6">
                              <div>
                                <h1 className="text-xl sm:text-2xl font-bold text-stone-900 dark:text-white">Plant Inventory</h1>
                                <p className="text-xs sm:text-sm text-stone-500 dark:text-stone-400 mt-1">
                                  Manage plant statuses, track progress, and view analytics
                                </p>
                              </div>
                            </div>

                            {/* Error Display */}
                            {plantDashboardError && (
                              <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900/60 dark:bg-red-900/30 dark:text-red-200 flex items-center gap-2">
                                <AlertTriangle className="h-4 w-4 flex-shrink-0" />
                                {plantDashboardError}
                              </div>
                            )}

                            {/* Quick Stats Cards */}
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
                              <div className="group relative rounded-xl sm:rounded-2xl border border-stone-200 dark:border-[#3e3e42] bg-white dark:bg-[#1e1e20] p-4 sm:p-5 transition-all hover:border-emerald-300 dark:hover:border-emerald-800 hover:shadow-lg hover:shadow-emerald-500/5">
                                <div className="flex items-center gap-3">
                                  <div className="flex-shrink-0 w-10 h-10 sm:w-11 sm:h-11 rounded-xl bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center">
                                    <Check className="h-5 w-5 sm:h-5 sm:w-5 text-emerald-600 dark:text-emerald-400" />
                                  </div>
                                  <div>
                                    <div className="text-xs text-stone-500 dark:text-stone-400">Approved</div>
                                    <div className="text-xl sm:text-2xl font-bold text-stone-900 dark:text-white">{approvedPlantsCount}</div>
                                  </div>
                                </div>
                              </div>
                              <div className="group relative rounded-xl sm:rounded-2xl border border-stone-200 dark:border-[#3e3e42] bg-white dark:bg-[#1e1e20] p-4 sm:p-5 transition-all hover:border-rose-300 dark:hover:border-rose-800 hover:shadow-lg hover:shadow-rose-500/5">
                                <div className="flex items-center gap-3">
                                  <div className="flex-shrink-0 w-10 h-10 sm:w-11 sm:h-11 rounded-xl bg-rose-100 dark:bg-rose-900/30 flex items-center justify-center">
                                    <AlertTriangle className="h-5 w-5 sm:h-5 sm:w-5 text-rose-600 dark:text-rose-400" />
                                  </div>
                                  <div>
                                    <div className="text-xs text-stone-500 dark:text-stone-400">Rework</div>
                                    <div className="text-xl sm:text-2xl font-bold text-stone-900 dark:text-white">
                                      {plantStatusDonutData.find(d => d.key === "rework")?.value || 0}
                                    </div>
                                  </div>
                                </div>
                              </div>
                              <div className="group relative rounded-xl sm:rounded-2xl border border-stone-200 dark:border-[#3e3e42] bg-white dark:bg-[#1e1e20] p-4 sm:p-5 transition-all hover:border-sky-300 dark:hover:border-sky-800 hover:shadow-lg hover:shadow-sky-500/5">
                                <div className="flex items-center gap-3">
                                  <div className="flex-shrink-0 w-10 h-10 sm:w-11 sm:h-11 rounded-xl bg-sky-100 dark:bg-sky-900/30 flex items-center justify-center">
                                    <Sparkles className="h-5 w-5 sm:h-5 sm:w-5 text-sky-600 dark:text-sky-400" />
                                  </div>
                                  <div>
                                    <div className="text-xs text-stone-500 dark:text-stone-400">In Review</div>
                                    <div className="text-xl sm:text-2xl font-bold text-stone-900 dark:text-white">
                                      {plantStatusDonutData.find(d => d.key === "review")?.value || 0}
                                    </div>
                                  </div>
                                </div>
                              </div>
                              <div className="group relative rounded-xl sm:rounded-2xl border border-stone-200 dark:border-[#3e3e42] bg-white dark:bg-[#1e1e20] p-4 sm:p-5 transition-all hover:border-amber-300 dark:hover:border-amber-800 hover:shadow-lg hover:shadow-amber-500/5">
                                <div className="flex items-center gap-3">
                                  <div className="flex-shrink-0 w-10 h-10 sm:w-11 sm:h-11 rounded-xl bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center">
                                    <TrendingUp className="h-5 w-5 sm:h-5 sm:w-5 text-amber-600 dark:text-amber-400" />
                                  </div>
                                  <div>
                                    <div className="text-xs text-stone-500 dark:text-stone-400">In Progress</div>
                                    <div className="text-xl sm:text-2xl font-bold text-stone-900 dark:text-white">
                                      {plantStatusDonutData.find(d => d.key === "in progres")?.value || 0}
                                    </div>
                                  </div>
                                </div>
                              </div>
                            </div>

                            {/* Collapsible Analytics Panel */}
                            <div className="rounded-xl sm:rounded-2xl border border-stone-200 dark:border-[#3e3e42] bg-white dark:bg-[#1e1e20] overflow-hidden transition-all">
                              <button
                                onClick={() => setIsAnalyticsPanelCollapsed(!isAnalyticsPanelCollapsed)}
                                className="w-full flex items-center justify-between gap-4 p-4 sm:p-5 hover:bg-stone-50 dark:hover:bg-[#252528] transition-colors"
                              >
                                <div className="flex items-center gap-3 sm:gap-4">
                                  <div className="flex-shrink-0 w-10 h-10 sm:w-11 sm:h-11 rounded-xl bg-gradient-to-br from-emerald-100 to-teal-100 dark:from-emerald-900/30 dark:to-teal-900/30 flex items-center justify-center">
                                    <BarChart3 className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
                                  </div>
                                  <div className="text-left">
                                    <div className="font-semibold text-stone-900 dark:text-white text-sm sm:text-base">Analytics & Charts</div>
                                    <div className="text-xs sm:text-sm text-stone-500 dark:text-stone-400">
                                      Status distribution, progress gauge, and promotion calendar
                                    </div>
                                  </div>
                                </div>
                                <div className="flex items-center gap-2 sm:gap-3">
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    className="rounded-xl h-8 px-3 text-xs hidden sm:flex"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      loadPlantDashboard();
                                    }}
                                    disabled={plantDashboardLoading}
                                  >
                                    <RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${plantDashboardLoading ? "animate-spin" : ""}`} />
                                    Refresh
                                  </Button>
                                  <div className={`p-2 rounded-lg transition-colors ${isAnalyticsPanelCollapsed ? "bg-stone-100 dark:bg-[#2a2a2d]" : "bg-emerald-100 dark:bg-emerald-900/30"}`}>
                                    {isAnalyticsPanelCollapsed ? (
                                      <ChevronDown className="h-4 w-4 text-stone-500 dark:text-stone-400" />
                                    ) : (
                                      <ChevronUp className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                                    )}
                                  </div>
                                </div>
                              </button>

                              {!isAnalyticsPanelCollapsed && (
                                <div className="p-4 sm:p-5 pt-0 space-y-4">
                                  <div className="grid gap-4 md:grid-cols-2">
                                    {/* Status Distribution Chart */}
                                    <div className="rounded-xl border border-stone-200/80 dark:border-[#3e3e42] bg-stone-50/50 dark:bg-[#17171d] p-4 flex flex-col">
                                      <div className="flex items-center justify-between gap-2 mb-4">
                                        <div className="flex items-center gap-3">
                                          <div className="w-8 h-8 rounded-lg bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center">
                                            <PieChartIcon className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
                                          </div>
                                          <div>
                                            <div className="text-sm font-semibold text-stone-900 dark:text-white">Status Distribution</div>
                                            <div className="text-xs text-stone-500 dark:text-stone-400">In progress, review, rework</div>
                                          </div>
                                        </div>
                                        <span className="text-lg font-bold text-stone-900 dark:text-white">
                                          {plantStatusDonutData.reduce((sum, slice) => sum + slice.value, 0)}
                                        </span>
                                      </div>
                                      <div className="relative h-48">
                                        {plantTableLoading ? (
                                          <div className="flex h-full items-center justify-center text-sm text-stone-500 dark:text-stone-400">
                                            Loading chart...
                                          </div>
                                        ) : plantStatusDonutData.length === 0 ? (
                                          <div className="flex h-full items-center justify-center text-sm text-stone-500 dark:text-stone-400">
                                            No status data yet.
                                          </div>
                                        ) : (
                                          <ChartSuspense
                                            fallback={
                                              <div className="flex h-full items-center justify-center text-sm text-stone-500 dark:text-stone-400">
                                                Loading chart...
                                              </div>
                                            }
                                          >
                                            <ResponsiveContainer width="100%" height="100%">
                                              <PieChart>
                                                <Pie
                                                  data={plantStatusDonutData}
                                                  dataKey="value"
                                                  nameKey="label"
                                                  innerRadius="60%"
                                                  outerRadius="90%"
                                                  startAngle={90}
                                                  endAngle={-270}
                                                  paddingAngle={3}
                                                  isAnimationActive={false}
                                                >
                                                  {plantStatusDonutData.map((slice) => (
                                                    <Cell
                                                      key={slice.key}
                                                      fill={slice.color}
                                                      stroke={isDark ? slice.color : slice.color}
                                                      strokeWidth={isDark ? 0 : 2}
                                                    />
                                                  ))}
                                                </Pie>
                                                <Tooltip
                                                  formatter={(value: number, name: string) => [
                                                    `${value} plants`,
                                                    name,
                                                  ]}
                                                />
                                              </PieChart>
                                            </ResponsiveContainer>
                                          </ChartSuspense>
                                        )}
                                        {plantStatusDonutData.length > 0 && (
                                          <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">
                                            <span className="text-xs uppercase tracking-wide text-stone-500 dark:text-stone-400">
                                              Total
                                            </span>
                                            <span className="text-2xl font-bold text-stone-900 dark:text-white">
                                              {plantStatusDonutData.reduce((sum, slice) => sum + slice.value, 0)}
                                            </span>
                                          </div>
                                        )}
                                      </div>
                                    </div>

                                    {/* Coverage Ratio Gauge */}
                                    <div className="rounded-xl border border-stone-200/80 dark:border-[#3e3e42] bg-stone-50/50 dark:bg-[#17171d] p-4 flex flex-col">
                                      <div className="flex items-center justify-between gap-2 mb-4">
                                        <div className="flex items-center gap-3">
                                          <div className="w-8 h-8 rounded-lg bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center">
                                            <Target className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                                          </div>
                                          <div>
                                            <div className="text-sm font-semibold text-stone-900 dark:text-white">Coverage Ratio</div>
                                            <div className="text-xs text-stone-500 dark:text-stone-400">Requests vs approved</div>
                                          </div>
                                        </div>
                                        <span className="text-lg font-bold text-emerald-600 dark:text-emerald-400">
                                          {requestsVsApproved.ratio !== null
                                            ? `${requestsVsApproved.percent.toFixed(0)}%`
                                            : requestsVsApproved.approved === 0 && requestsVsApproved.requests > 0
                                              ? "∞"
                                              : "0%"}
                                        </span>
                                      </div>
                                      <div className="flex-1">
                                        {plantTableLoading && totalPlantRequestsCount === 0 ? (
                                          <div className="flex h-full items-center justify-center text-sm text-stone-500 dark:text-stone-400">
                                            Loading gauge...
                                          </div>
                                        ) : requestsVsApproved.requests === 0 && requestsVsApproved.approved === 0 ? (
                                          <div className="flex h-full items-center justify-center text-sm text-stone-500 dark:text-stone-400">
                                            No requests or approved plants yet.
                                          </div>
                                        ) : (
                                          <div className="relative h-40 sm:h-48">
                                            <ChartSuspense
                                              fallback={
                                                <div className="flex h-full items-center justify-center text-sm text-stone-500 dark:text-stone-400">
                                                  Loading gauge...
                                                </div>
                                              }
                                            >
                                              <ResponsiveContainer width="100%" height="100%">
                                                <RadialBarChart
                                                  data={[{ name: "ratio", value: requestsVsApproved.gaugeValue }]}
                                                  startAngle={180}
                                                  endAngle={0}
                                                  innerRadius="70%"
                                                  outerRadius="100%"
                                                  margin={{ top: 0, bottom: 0, left: 0, right: 0 }}
                                                >
                                                  <PolarAngleAxis
                                                    type="number"
                                                    domain={[0, Math.max(1, requestsVsApproved.domainMax)]}
                                                    tick={false}
                                                  />
                                                  <RadialBar
                                                    dataKey="value"
                                                    cornerRadius={10}
                                                    fill={accentColor}
                                                    clockWise
                                                    background
                                                  />
                                                </RadialBarChart>
                                              </ResponsiveContainer>
                                            </ChartSuspense>
                                            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                                              <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">
                                                {requestsVsApproved.ratio !== null
                                                  ? `${requestsVsApproved.percent.toFixed(0)}%`
                                                  : requestsVsApproved.approved === 0 && requestsVsApproved.requests > 0
                                                    ? "∞"
                                                    : "0%"}
                                              </div>
                                            </div>
                                          </div>
                                        )}
                                      </div>
                                      <div className="mt-1 text-center">
                                        <div className="text-sm text-stone-600 dark:text-stone-300">
                                          {requestsVsApproved.requests} requests / {requestsVsApproved.approved} approved
                                        </div>
                                        {requestsVsApproved.ratio === null && requestsVsApproved.approved === 0 && requestsVsApproved.requests > 0 && (
                                          <div className="text-xs text-stone-500 dark:text-stone-400 mt-1">
                                            Approve at least one plant to compute the ratio.
                                          </div>
                                        )}
                                      </div>
                                    </div>
                                  </div>

                                  {/* Promotion Calendar Chart */}
                                  <div className="rounded-xl border border-stone-200/80 dark:border-[#3e3e42] bg-stone-50/50 dark:bg-[#17171d] p-4 flex flex-col">
                                    <div className="flex items-center gap-3 mb-4">
                                      <div className="w-8 h-8 rounded-lg bg-cyan-100 dark:bg-cyan-900/30 flex items-center justify-center">
                                        <Calendar className="h-4 w-4 text-cyan-600 dark:text-cyan-400" />
                                      </div>
                                      <div>
                                        <div className="text-sm font-semibold text-stone-900 dark:text-white">Promotion Calendar</div>
                                        <div className="text-xs text-stone-500 dark:text-stone-400">Plants promoted per month</div>
                                      </div>
                                    </div>
                                    <div className="w-full h-[280px] sm:h-[320px]">
                                      {plantTableLoading ? (
                                        <div className="flex h-full items-center justify-center text-sm text-stone-500 dark:text-stone-400">
                                          Loading chart...
                                        </div>
                                      ) : !hasPromotionMonthData ? (
                                        <div className="flex h-full items-center justify-center text-sm text-stone-500 dark:text-stone-400">
                                          No promotion data yet.
                                        </div>
                                      ) : (
                                        <ChartSuspense
                                          fallback={
                                            <div className="flex h-full items-center justify-center text-sm text-stone-500 dark:text-stone-400">
                                              Loading chart...
                                            </div>
                                          }
                                        >
                                          <ResponsiveContainer width="100%" height="100%">
                                            <BarChart data={promotionMonthData} barCategoryGap="10%" margin={{ left: 16, right: 16, top: 16, bottom: 12 }}>
                                              <CartesianGrid
                                                strokeDasharray="3 3"
                                                stroke={isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.06)"}
                                              />
                                              <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                                              <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                                              <Tooltip
                                                cursor={{ fill: isDark ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.03)" }}
                                                formatter={(value: number) => [`${value} plants`, "Promotions"]}
                                              />
                                              <Bar 
                                                dataKey="value" 
                                                fill={accentColor} 
                                                radius={6}
                                                cursor="pointer"
                                                onClick={(data: { slug?: string }) => {
                                                  if (data?.slug) {
                                                    setSelectedPromotionMonth(data.slug as PromotionMonthSlug);
                                                  }
                                                }}
                                              />
                                            </BarChart>
                                          </ResponsiveContainer>
                                        </ChartSuspense>
                                      )}
                                    </div>
                                  </div>
                                </div>
                              )}
                            </div>

                            {/* Plant Inventory Section */}
                            <div className="rounded-xl sm:rounded-2xl border border-stone-200 dark:border-[#3e3e42] bg-white dark:bg-[#1e1e20] overflow-hidden">
                              <div className="p-4 sm:p-5 border-b border-stone-100 dark:border-[#2a2a2d]">
                                <div className="flex flex-col gap-4">
                                  {/* Header Row */}
                                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                                    <div className="flex items-center gap-3">
                                      <div className="flex-shrink-0 w-10 h-10 sm:w-11 sm:h-11 rounded-xl bg-gradient-to-br from-teal-100 to-emerald-100 dark:from-teal-900/30 dark:to-emerald-900/30 flex items-center justify-center">
                                        <Package className="h-5 w-5 text-teal-600 dark:text-teal-400" />
                                      </div>
                                      <div className="flex flex-col gap-2 md:flex-row md:items-center md:gap-3 w-full lg:w-auto">
                                        <div className="flex-1">
                                          <SearchInput
                                            value={plantSearchQuery}
                                            onChange={(e) => setPlantSearchQuery(e.target.value)}
                                            placeholder="Search by plant name..."
                                            className="rounded-xl"
                                          />
                                        </div>
                                        <div className="w-full md:w-52">
                                          <select
                                            className="w-full rounded-xl border border-stone-300 dark:border-[#3e3e42] bg-white dark:bg-[#111116] px-3 py-2 text-sm text-stone-800 dark:text-stone-100 focus:outline-none focus:ring-2 focus:ring-emerald-500/40"
                                            value={selectedPromotionMonth}
                                            onChange={(e) =>
                                              setSelectedPromotionMonth(e.target.value as PromotionMonthSlug | "none" | "all")
                                            }
                                          >
                                            <option value="all">All promotion months</option>
                                            <option value="none">None assigned</option>
                                            {PROMOTION_MONTH_SLUGS.map((slug) => (
                                              <option key={slug} value={slug}>
                                                {PROMOTION_MONTH_LABELS[slug]}
                                              </option>
                                            ))}
                                          </select>
                                        </div>
                                        <div className="w-full md:w-44">
                                          <select
                                            className="w-full rounded-xl border border-stone-300 dark:border-[#3e3e42] bg-white dark:bg-[#111116] px-3 py-2 text-sm text-stone-800 dark:text-stone-100 focus:outline-none focus:ring-2 focus:ring-emerald-500/40"
                                            value={plantSortOption}
                                            onChange={(e) =>
                                              setPlantSortOption(e.target.value as PlantSortOption)
                                            }
                                          >
                                            <option value="status">Sort by Status</option>
                                            <option value="updated">Last Updated</option>
                                            <option value="created">Last Created</option>
                                            <option value="name">Name (A-Z)</option>
                                            <option value="gardens">Most in Gardens</option>
                                            <option value="likes">Most Likes</option>
                                            <option value="views">Most Views</option>
                                            <option value="images">Image Count</option>
                                          </select>
                                        </div>
                                      </div>
                                    </div>
                                  </div>

                                  {/* Status Filter Pills */}
                                  <div className="flex flex-wrap gap-2">
                                    {PLANT_STATUS_FILTER_OPTIONS.map((option) => {
                                      const selected = visiblePlantStatusesSet.has(option.value);
                                      const statusColor = PLANT_STATUS_COLORS[option.value];
                                      const selectedClasses = PLANT_STATUS_BUTTON_SELECTED_CLASSES[option.value];
                                      return (
                                        <button
                                          key={option.value}
                                          type="button"
                                          aria-pressed={selected}
                                          onClick={() => togglePlantStatusFilter(option.value)}
                                          className={`flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-all ${
                                            selected
                                              ? selectedClasses
                                              : "border-stone-200 dark:border-[#3e3e42] text-stone-600 dark:text-stone-300 hover:border-stone-300 dark:hover:border-stone-500 bg-white dark:bg-[#1a1a1d]"
                                          }`}
                                        >
                                          <span
                                            className={`w-2 h-2 rounded-full ${selected ? "bg-white" : ""}`}
                                            style={{ backgroundColor: selected ? undefined : statusColor }}
                                          />
                                          <span>{option.label}</span>
                                          {selected && <Check className="h-3 w-3" />}
                                        </button>
                                      );
                                    })}
                                  </div>
                                </div>
                              </div>

                              {/* Bulk Action Bar */}
                              {selectedPlantIds.size > 0 && (
                                <div className="flex items-center gap-3 px-4 sm:px-5 py-3 bg-emerald-50 dark:bg-emerald-950/30 border-b border-emerald-200 dark:border-emerald-800">
                                  <div className="flex items-center gap-2 flex-1 min-w-0">
                                    <span className="text-sm font-medium text-emerald-800 dark:text-emerald-200">
                                      {selectedPlantIds.size} {selectedPlantIds.size === 1 ? "plant" : "plants"} selected
                                    </span>
                                    <button
                                      type="button"
                                      onClick={() => setSelectedPlantIds(new Set())}
                                      className="text-xs text-emerald-600 dark:text-emerald-400 hover:text-emerald-800 dark:hover:text-emerald-200 underline"
                                    >
                                      Clear
                                    </button>
                                  </div>
                                  <div className="flex items-center gap-2">
                                    <button
                                      type="button"
                                      onClick={() => setBulkStatusDialogOpen(true)}
                                      className="flex items-center gap-1.5 rounded-lg border border-emerald-300 dark:border-emerald-700 bg-white dark:bg-[#1a1a1d] px-3 py-1.5 text-xs font-medium text-emerald-700 dark:text-emerald-300 hover:bg-emerald-100 dark:hover:bg-emerald-900/40 transition-colors"
                                    >
                                      <Pencil className="h-3.5 w-3.5" />
                                      Change Status
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => setBulkDeleteDialogOpen(true)}
                                      className="flex items-center gap-1.5 rounded-lg border border-red-300 dark:border-red-700 bg-white dark:bg-[#1a1a1d] px-3 py-1.5 text-xs font-medium text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30 transition-colors"
                                    >
                                      <Trash2 className="h-3.5 w-3.5" />
                                      Delete
                                    </button>
                                  </div>
                                </div>
                              )}

                              {/* Plant List */}
                              {plantTableLoading ? (
                                <div className="flex items-center justify-center py-16">
                                  <div className="flex items-center gap-3 text-stone-500 dark:text-stone-400">
                                    <RefreshCw className="h-5 w-5 animate-spin" />
                                    <span className="text-sm">Loading plants...</span>
                                  </div>
                                </div>
                              ) : filteredPlantRows.length === 0 ? (
                                <div className="flex flex-col items-center justify-center py-16 px-4">
                                  <div className="w-12 h-12 rounded-2xl bg-stone-100 dark:bg-[#2a2a2d] flex items-center justify-center mb-4">
                                    <Leaf className="h-6 w-6 text-stone-400" />
                                  </div>
                                  <h3 className="text-base font-semibold text-stone-900 dark:text-white mb-1">No plants found</h3>
                                  <p className="text-sm text-stone-500 dark:text-stone-400 text-center max-w-sm">
                                    {plantDashboardRows.length === 0
                                      ? "No plants available yet. Start adding plants to see them here."
                                      : noPlantStatusesSelected
                                        ? "Select at least one status filter to see plants."
                                        : "No plants match your current filters. Try adjusting your search or filters."}
                                  </p>
                                </div>
                              ) : (
                                <div className="divide-y divide-stone-100 dark:divide-[#2a2a2d]">
                                  {/* Select All Row */}
                                  <div className="flex items-center gap-3 px-4 sm:px-5 py-2 bg-stone-50/50 dark:bg-[#1a1a1d]">
                                    <button
                                      type="button"
                                      onClick={() => toggleSelectAllPlants(filteredPlantRows.map((p) => p.id))}
                                      className={`flex items-center justify-center w-5 h-5 rounded border-2 transition-colors flex-shrink-0 ${
                                        filteredPlantRows.length > 0 && filteredPlantRows.every((p) => selectedPlantIds.has(p.id))
                                          ? 'border-emerald-500 bg-emerald-500'
                                          : selectedPlantIds.size > 0
                                            ? 'border-emerald-500 bg-emerald-500/30'
                                            : 'border-stone-300 dark:border-stone-600 hover:border-emerald-400'
                                      }`}
                                      title={filteredPlantRows.every((p) => selectedPlantIds.has(p.id)) ? "Deselect all" : "Select all"}
                                    >
                                      {filteredPlantRows.length > 0 && filteredPlantRows.every((p) => selectedPlantIds.has(p.id)) ? (
                                        <Check className="h-3.5 w-3.5 text-white" />
                                      ) : selectedPlantIds.size > 0 ? (
                                        <span className="block w-2 h-0.5 bg-emerald-500 rounded" />
                                      ) : null}
                                    </button>
                                    <span className="text-xs text-stone-500 dark:text-stone-400">
                                      {selectedPlantIds.size > 0
                                        ? `${selectedPlantIds.size} of ${filteredPlantRows.length} selected`
                                        : `${filteredPlantRows.length} ${filteredPlantRows.length === 1 ? "plant" : "plants"}`}
                                    </span>
                                  </div>
                                  {filteredPlantRows.map((plant) => (
                                    <div
                                      key={plant.id}
                                      role="button"
                                      tabIndex={0}
                                      onClick={() => handleOpenPlantEditor(plant.id)}
                                      onKeyDown={(event) => {
                                        if (event.key === "Enter" || event.key === " ") {
                                          event.preventDefault();
                                          handleOpenPlantEditor(plant.id);
                                        }
                                      }}
                                      className={`group flex items-center gap-3 sm:gap-4 px-4 sm:px-5 py-3 sm:py-4 cursor-pointer transition-all ${
                                        selectedPlantIds.has(plant.id)
                                          ? 'bg-emerald-50/50 dark:bg-emerald-950/20 hover:bg-emerald-50 dark:hover:bg-emerald-950/30'
                                          : 'hover:bg-stone-50 dark:hover:bg-[#252528]'
                                      }`}
                                    >
                                      {/* Checkbox */}
                                      <button
                                        type="button"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          togglePlantSelection(plant.id);
                                        }}
                                        className={`flex items-center justify-center w-5 h-5 rounded border-2 transition-colors flex-shrink-0 ${
                                          selectedPlantIds.has(plant.id)
                                            ? 'border-emerald-500 bg-emerald-500'
                                            : selectedPlantIds.size > 0
                                              ? 'border-stone-300 dark:border-stone-600 hover:border-emerald-400'
                                              : 'border-stone-300 dark:border-stone-600 hover:border-emerald-400 opacity-0 group-hover:opacity-100'
                                        }`}
                                        title={selectedPlantIds.has(plant.id) ? "Deselect" : "Select"}
                                      >
                                        {selectedPlantIds.has(plant.id) && (
                                          <Check className="h-3.5 w-3.5 text-white" />
                                        )}
                                      </button>
                                      {/* Plant Image */}
                                      <div className="relative h-12 w-12 sm:h-14 sm:w-14 flex-shrink-0 overflow-hidden rounded-xl bg-gradient-to-br from-stone-100 to-stone-200 dark:from-[#2d2d30] dark:to-[#252528] flex items-center justify-center">
                                        {plant.primaryImage ? (
                                          <img
                                            src={plant.primaryImage}
                                            alt={plant.name}
                                            className="h-full w-full object-cover transition-transform group-hover:scale-105"
                                            loading="lazy"
                                          />
                                        ) : (
                                          <Sprout className="h-6 w-6 text-stone-400" />
                                        )}
                                      </div>

                                      {/* Plant Info */}
                                      <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2">
                                          <span className="font-medium text-stone-900 dark:text-white text-sm sm:text-base truncate group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors">
                                            {plant.name}
                                          </span>
                                        </div>
                                        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-0.5">
                                          <span className="text-xs text-stone-500 dark:text-stone-400 flex items-center gap-1">
                                            <Calendar className="h-3 w-3" />
                                            {plant.promotionMonth ? PROMOTION_MONTH_LABELS[plant.promotionMonth] : "No month"}
                                          </span>
                                          {plantSortOption === "created" && plant.createdAt && (
                                            <span className="text-xs text-stone-400 dark:text-stone-500">
                                              Created {formatTimeAgo(plant.createdAt)}
                                            </span>
                                          )}
                                          {plantSortOption !== "created" && plantSortOption !== "gardens" && plantSortOption !== "likes" && plantSortOption !== "views" && plantSortOption !== "images" && plant.updatedAt && (
                                            <span className="text-xs text-stone-400 dark:text-stone-500">
                                              Updated {formatTimeAgo(plant.updatedAt)}
                                            </span>
                                          )}
                                          {plantSortOption === "gardens" && (
                                            <span className="text-xs font-medium text-emerald-600 dark:text-emerald-400">
                                              {plant.gardensCount} {plant.gardensCount === 1 ? "garden" : "gardens"}
                                            </span>
                                          )}
                                          {plantSortOption === "likes" && (
                                            <span className="text-xs font-medium text-pink-600 dark:text-pink-400">
                                              {plant.likesCount} {plant.likesCount === 1 ? "like" : "likes"}
                                            </span>
                                          )}
                                          {plantSortOption === "views" && (
                                            <span className="text-xs font-medium text-blue-600 dark:text-blue-400">
                                              {plant.viewsCount} {plant.viewsCount === 1 ? "view" : "views"}
                                            </span>
                                          )}
                                          {plantSortOption === "images" && (
                                            <span className="text-xs font-medium text-orange-600 dark:text-orange-400">
                                              {plant.imagesCount} {plant.imagesCount === 1 ? "image" : "images"}
                                            </span>
                                          )}
                                        </div>
                                      </div>

                                      {/* Status Badge & Actions */}
                                      <div className="flex items-center gap-2">
                                        <span
                                          className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${PLANT_STATUS_BADGE_CLASSES[plant.status]}`}
                                        >
                                          <span
                                            className="w-1.5 h-1.5 rounded-full"
                                            style={{ backgroundColor: PLANT_STATUS_COLORS[plant.status] }}
                                          />
                                          {PLANT_STATUS_LABELS[plant.status]}
                                        </span>
                                        <a
                                          href={`/plants/${plant.id}`}
                                          target="_blank"
                                          rel="noopener noreferrer"
                                          onClick={(e) => e.stopPropagation()}
                                          className="p-1.5 rounded-lg opacity-0 group-hover:opacity-100 hover:bg-blue-100 dark:hover:bg-blue-900/30 text-stone-400 hover:text-blue-600 dark:hover:text-blue-400 transition-all"
                                          title="Open plant info page"
                                        >
                                          <ArrowUpRight className="h-4 w-4" />
                                        </a>
                                        <button
                                          type="button"
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            handleSelectPlantForPrefill(plant.id, plant.name);
                                          }}
                                          className="p-1.5 rounded-lg opacity-0 group-hover:opacity-100 hover:bg-emerald-100 dark:hover:bg-emerald-900/30 text-stone-400 hover:text-emerald-600 dark:hover:text-emerald-400 transition-all"
                                          title="Duplicate plant (Add From)"
                                          disabled={addFromDuplicating}
                                        >
                                          <Copy className="h-4 w-4" />
                                        </button>
                                        <button
                                          type="button"
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            setPlantToDelete({ id: plant.id, name: plant.name });
                                            setDeletePlantDialogOpen(true);
                                          }}
                                          className="p-1.5 rounded-lg opacity-0 group-hover:opacity-100 hover:bg-red-100 dark:hover:bg-red-900/30 text-stone-400 hover:text-red-600 dark:hover:text-red-400 transition-all"
                                          title="Delete plant"
                                        >
                                          <Trash2 className="h-4 w-4" />
                                        </button>
                                        <ChevronRight className="h-4 w-4 text-stone-300 dark:text-stone-600 group-hover:text-emerald-500 group-hover:translate-x-0.5 transition-all flex-shrink-0" />
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          </div>
                        ) : (
                      <Card className="rounded-2xl">
                      <CardContent className="p-4 space-y-4">
                        <div className="flex flex-col gap-3">
                          <div>
                            <div className="text-sm font-medium">
                              Pending plant requests
                            </div>
                            <div className="text-xs opacity-60">
                              Sorted by request count and most recent updates.
                            </div>
                          </div>
                          <div className="flex flex-wrap items-center justify-end gap-2">
                            <Button
                              variant="outline"
                              className="rounded-xl"
                              onClick={() =>
                                loadPlantRequests({ initial: false })
                              }
                              disabled={
                                plantRequestsLoading || plantRequestsRefreshing || aiPrefillRunning
                              }
                            >
                              <RefreshCw
                                className={`h-4 w-4 mr-2 ${plantRequestsLoading || plantRequestsRefreshing ? "animate-spin" : ""}`}
                              />
                              <span className="hidden sm:inline">Refresh</span>
                              <span className="sm:hidden inline">Reload</span>
                            </Button>
                            {/* AI Prefill Button - Neomorphic */}
                            {aiPrefillRunning ? (
                              <Button
                                variant="outline"
                                className="rounded-xl border-red-200 dark:border-red-800/50 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300 hover:bg-red-100 dark:hover:bg-red-900/30 shadow-sm"
                                onClick={stopAiPrefill}
                              >
                                <Square className="h-4 w-4 mr-2" />
                                <span className="hidden sm:inline">Stop AI Prefill</span>
                                <span className="sm:hidden inline">Stop</span>
                              </Button>
                            ) : (
                              <Button
                                variant="outline"
                                className="rounded-xl border-emerald-200 dark:border-emerald-800/50 bg-gradient-to-r from-emerald-50 to-teal-50 dark:from-emerald-900/20 dark:to-teal-900/20 text-emerald-700 dark:text-emerald-300 hover:from-emerald-100 hover:to-teal-100 dark:hover:from-emerald-900/30 dark:hover:to-teal-900/30 shadow-sm hover:shadow-md transition-all"
                                onClick={runAiPrefillAll}
                                disabled={
                                  plantRequestsLoading || plantRequests.length === 0
                                }
                                title={`Automatically AI fill, save, and translate the ${plantRequests.length} loaded plant requests`}
                              >
                                <Sparkles className="h-4 w-4 mr-2" />
                                <span className="hidden sm:inline">AI Prefill All</span>
                                <span className="sm:hidden inline">AI Fill</span>
                              </Button>
                            )}
                            <Button
                              variant="outline"
                              className="rounded-xl border-sky-200 dark:border-sky-800/50 bg-sky-50/70 dark:bg-sky-900/20 text-sky-700 dark:text-sky-300 hover:bg-sky-100 dark:hover:bg-sky-900/30 shadow-sm"
                              onClick={() => setBulkRequestDialogOpen(true)}
                              disabled={bulkRequestSubmitting}
                              title="Bulk add plant requests"
                            >
                              <ScrollText className="h-4 w-4 mr-2" />
                              <span className="hidden sm:inline">Bulk Requests</span>
                              <span className="sm:hidden inline">Bulk</span>
                            </Button>
                            <div className="relative">
                              <div className="flex">
                                <Button
                                  className="rounded-l-xl rounded-r-none bg-emerald-600 hover:bg-emerald-700 text-white"
                                  onClick={() => navigate("/create")}
                                >
                                  <Plus className="h-4 w-4 mr-1" />
                                  <span className="hidden sm:inline">Add Plant</span>
                                  <span className="sm:hidden inline">Add</span>
                                </Button>
                                <Button
                                  className="rounded-l-none rounded-r-xl bg-emerald-600 hover:bg-emerald-700 text-white border-l border-emerald-500 px-2"
                                  onClick={() => setAddButtonExpanded(!addButtonExpanded)}
                                >
                                  <ChevronDown className={`h-4 w-4 transition-transform ${addButtonExpanded ? "rotate-180" : ""}`} />
                                </Button>
                              </div>
                              {addButtonExpanded && (
                                <div className="absolute right-0 top-full mt-1 z-50 min-w-[160px] rounded-xl border border-stone-200 dark:border-[#3e3e42] bg-white dark:bg-[#1a1a1d] shadow-lg overflow-hidden">
                                  <button
                                    type="button"
                                    className="w-full px-4 py-2.5 text-sm text-left hover:bg-stone-100 dark:hover:bg-[#2a2a2d] transition-colors flex items-center gap-2"
                                    onClick={() => {
                                      setAddButtonExpanded(false);
                                      setAddFromDialogOpen(true);
                                    }}
                                  >
                                    <Copy className="h-4 w-4 opacity-60" />
                                    Add FROM...
                                  </button>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Statistics */}
                        {!plantRequestsLoading && plantRequestsTotalCount > 0 && (() => {
                          const loadedUserOnly = plantRequests.filter((r) => r.requester_is_staff !== true);
                          const loadedStaff = plantRequests.length - loadedUserOnly.length;
                          return (
                            <div className="flex flex-wrap gap-4 text-sm">
                              <div className="flex items-center gap-2">
                                <span className="opacity-60">
                                  Total Requests:
                                </span>
                                <span className="font-medium">
                                  {plantRequestsTotalRequestsSum}
                                </span>
                              </div>
                              <div className="flex items-center gap-2">
                                <span className="opacity-60">Unique Plants:</span>
                                <span className="font-medium">
                                  {plantRequestsTotalCount}
                                </span>
                              </div>
                              {plantRequests.length < plantRequestsTotalCount && (
                                <div className="flex items-center gap-2">
                                  <span className="opacity-60">Loaded:</span>
                                  <span className="font-medium">
                                    {plantRequests.length} / {plantRequestsTotalCount}
                                  </span>
                                </div>
                              )}
                              {hideStaffRequests && loadedStaff > 0 && (
                                <div className="flex items-center gap-2">
                                  <span className="opacity-60">Visible (users only):</span>
                                  <span className="font-medium text-purple-600 dark:text-purple-400">
                                    {loadedUserOnly.length}
                                  </span>
                                  <span className="opacity-40 text-xs">
                                    ({loadedStaff} staff hidden)
                                  </span>
                                </div>
                              )}
                            </div>
                          );
                        })()}

                        {/* AI Prefill Progress - Neomorphic Design */}
                        {aiPrefillRunning && (
                          <div className="rounded-2xl border border-stone-200 dark:border-[#3e3e42] bg-white dark:bg-[#1e1e20] p-5 space-y-5 shadow-lg shadow-stone-200/50 dark:shadow-black/20">
                            {/* Header with overall progress */}
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-400 to-teal-500 flex items-center justify-center shadow-lg shadow-emerald-500/25">
                                  <Sparkles className="h-5 w-5 text-white animate-pulse" />
                                </div>
                                <div>
                                  <h3 className="text-sm font-semibold text-stone-800 dark:text-stone-100">
                                    AI Prefill Running
                                  </h3>
                                  <p className="text-xs text-stone-500 dark:text-stone-400">
                                    Processing plant requests automatically
                                  </p>
                                </div>
                              </div>
                              <div className="flex items-center gap-2">
                                <span className="text-xs font-mono bg-stone-100 dark:bg-[#2a2a2d] px-2.5 py-1 rounded-lg text-stone-600 dark:text-stone-300">
                                  {formatDuration(aiPrefillElapsedTime)}
                                </span>
                              </div>
                            </div>

                            {/* Overall progress bar */}
                            <div className="space-y-2">
                              <div className="flex justify-between items-center">
                                <span className="text-xs font-medium text-stone-600 dark:text-stone-300">
                                  Overall Progress
                                </span>
                                <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                                  {aiPrefillCompletedPlants.length} / {aiPrefillProgress.total} plants
                                </span>
                              </div>
                              <div className="h-2.5 w-full rounded-full bg-stone-100 dark:bg-[#2a2a2d] overflow-hidden">
                                <div
                                  className="h-full bg-gradient-to-r from-emerald-400 to-teal-500 transition-all duration-500 ease-out rounded-full"
                                  style={{
                                    width: aiPrefillProgress.total > 0
                                      ? `${Math.round((aiPrefillCompletedPlants.length / aiPrefillProgress.total) * 100)}%`
                                      : '0%'
                                  }}
                                />
                              </div>
                            </div>

                            {/* Current plant card */}
                            {aiPrefillCurrentPlant && (
                              <div className="rounded-xl border border-stone-100 dark:border-[#2a2a2d] bg-stone-50/50 dark:bg-[#252528] p-4 space-y-4">
                                <div className="flex items-center justify-between">
                                  <div className="flex items-center gap-3">
                                    <div className="w-9 h-9 rounded-lg bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center">
                                      <Leaf className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                                    </div>
                                    <div>
                                      <span className="font-medium text-sm text-stone-800 dark:text-stone-100">{aiPrefillCurrentPlant}</span>
                                      <p className="text-[11px] text-stone-500 dark:text-stone-400">
                                        Plant {aiPrefillCompletedPlants.length + 1} of {aiPrefillProgress.total}
                                      </p>
                                    </div>
                                  </div>
                                  <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium ${
                                    aiPrefillStatus === 'filling' 
                                      ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300' 
                                      : aiPrefillStatus === 'saving'
                                        ? 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300'
                                        : aiPrefillStatus === 'translating' || aiPrefillStatus === 'translating_name'
                                          ? 'bg-violet-100 dark:bg-violet-900/30 text-violet-700 dark:text-violet-300'
                                          : aiPrefillStatus === 'fetching_images'
                                            ? 'bg-cyan-100 dark:bg-cyan-900/30 text-cyan-700 dark:text-cyan-300'
                                            : aiPrefillStatus === 'uploading_images'
                                              ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300'
                                              : 'bg-stone-100 dark:bg-stone-800 text-stone-600 dark:text-stone-300'
                                  }`}>
                                    {(aiPrefillStatus === 'filling' || aiPrefillStatus === 'fetching_images' || aiPrefillStatus === 'uploading_images') && <Loader2 className="h-3 w-3 animate-spin" />}
                                    {aiPrefillStatus === 'translating_name' ? 'Getting Name' : 
                                     aiPrefillStatus === 'filling' ? 'AI Filling' : 
                                     aiPrefillStatus === 'fetching_images' ? 'Searching Images' :
                                     aiPrefillStatus === 'uploading_images' ? 'Uploading Images' :
                                     aiPrefillStatus === 'saving' ? 'Saving' : 
                                     aiPrefillStatus === 'translating' ? 'Translating' : 'Processing'}
                                  </div>
                                </div>

                                {/* Field progress */}
                                {aiPrefillStatus === 'filling' && (
                                  <div className="space-y-2">
                                    <div className="flex justify-between items-center text-xs">
                                      <span className="text-stone-500 dark:text-stone-400">
                                        {aiPrefillCurrentField && (
                                          <>Filling <span className="font-medium text-stone-700 dark:text-stone-200">{aiPrefillCurrentField}</span></>
                                        )}
                                      </span>
                                      <span className="text-stone-600 dark:text-stone-300 font-medium">
                                        {aiPrefillFieldProgress.completed}/{aiPrefillFieldProgress.total} fields
                                      </span>
                                    </div>
                                    <div className="h-1.5 w-full rounded-full bg-stone-200 dark:bg-[#1a1a1d] overflow-hidden">
                                      <div
                                        className="h-full bg-blue-500 transition-all duration-300 rounded-full"
                                        style={{
                                          width: `${Math.round((aiPrefillFieldProgress.completed / aiPrefillFieldProgress.total) * 100)}%`
                                        }}
                                      />
                                    </div>
                                  </div>
                                )}

                                {/* Per-source image fetch progress */}
                                {aiPrefillStatus === 'fetching_images' && (
                                  <div className="space-y-2">
                                    {IMAGE_SOURCES.map(({ key, label }) => {
                                      const src = aiPrefillImageSources[key];
                                      const isLoading = src.status === 'loading';
                                      const isDone = src.status === 'done';
                                      const isError = src.status === 'error';
                                      const isSkipped = src.status === 'skipped';
                                      const count = src.images.length;
                                      return (
                                        <div key={key} className="flex items-center gap-3">
                                          <div className="w-28 shrink-0 text-[11px] font-medium text-stone-600 dark:text-stone-300">
                                            {label}
                                          </div>
                                          <div className="flex-1 h-1.5 rounded-full bg-stone-100 dark:bg-[#2a2a2d] overflow-hidden">
                                            <div
                                              className={`h-full rounded-full transition-all duration-500 ease-out ${
                                                isLoading
                                                  ? 'bg-cyan-400 dark:bg-cyan-500 animate-pulse'
                                                  : isDone && count > 0
                                                    ? 'bg-emerald-500 dark:bg-emerald-400'
                                                    : isDone
                                                      ? 'bg-stone-300 dark:bg-stone-600'
                                                      : isError
                                                        ? 'bg-red-400 dark:bg-red-500'
                                                        : isSkipped
                                                          ? 'bg-amber-300 dark:bg-amber-500'
                                                          : 'bg-stone-200 dark:bg-stone-700'
                                              }`}
                                              style={{ width: (isLoading || isDone || isError || isSkipped) ? '100%' : '0%' }}
                                            />
                                          </div>
                                          <div className="w-20 shrink-0 text-right">
                                            {isLoading && (
                                              <span className="text-[11px] text-cyan-600 dark:text-cyan-400 flex items-center justify-end gap-1">
                                                <Loader2 className="h-3 w-3 animate-spin" /> Searching
                                              </span>
                                            )}
                                            {isDone && count > 0 && (
                                              <span className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">
                                                {count} {count === 1 ? 'image' : 'images'}
                                              </span>
                                            )}
                                            {isDone && count === 0 && (
                                              <span className="text-[11px] text-stone-400 dark:text-stone-500">0 images</span>
                                            )}
                                            {isError && (
                                              <span className="text-[11px] text-red-500 dark:text-red-400" title={src.error}>Failed</span>
                                            )}
                                            {isSkipped && (
                                              <span className="text-[11px] text-amber-500 dark:text-amber-400" title={src.error}>Skipped</span>
                                            )}
                                            {src.status === 'idle' && (
                                              <span className="text-[11px] text-stone-300 dark:text-stone-600">Waiting</span>
                                            )}
                                          </div>
                                        </div>
                                      );
                                    })}
                                  </div>
                                )}

                                {/* Image upload progress */}
                                {aiPrefillStatus === 'uploading_images' && aiPrefillImageUpload.total > 0 && (
                                  <div className="space-y-2">
                                    <div className="flex items-center justify-between text-[11px]">
                                      <span className="text-stone-500 dark:text-stone-400 flex items-center gap-1">
                                        <Loader2 className="h-3 w-3 animate-spin" />
                                        Uploading image {aiPrefillImageUpload.current} of {aiPrefillImageUpload.total}
                                      </span>
                                      <span className="font-medium text-stone-700 dark:text-stone-200">
                                        {aiPrefillImageUpload.uploaded} saved{aiPrefillImageUpload.failed > 0 ? `, ${aiPrefillImageUpload.failed} failed` : ''}
                                      </span>
                                    </div>
                                    <div className="h-1.5 w-full rounded-full bg-stone-100 dark:bg-[#2a2a2d] overflow-hidden">
                                      <div
                                        className="h-full bg-gradient-to-r from-emerald-400 to-teal-500 rounded-full transition-all duration-300 ease-out"
                                        style={{ width: `${Math.round((aiPrefillImageUpload.current / aiPrefillImageUpload.total) * 100)}%` }}
                                      />
                                    </div>
                                  </div>
                                )}

                                {/* Image upload progress */}
                                {aiPrefillStatus === 'uploading_images' && aiPrefillImageUpload.total > 0 && (
                                  <div className="space-y-2">
                                    <div className="flex items-center justify-between text-[11px]">
                                      <span className="text-stone-500 dark:text-stone-400 flex items-center gap-1">
                                        <Loader2 className="h-3 w-3 animate-spin" />
                                        Uploading image {aiPrefillImageUpload.current} of {aiPrefillImageUpload.total}
                                      </span>
                                      <span className="font-medium text-stone-700 dark:text-stone-200">
                                        {aiPrefillImageUpload.uploaded} saved{aiPrefillImageUpload.failed > 0 ? `, ${aiPrefillImageUpload.failed} failed` : ''}
                                      </span>
                                    </div>
                                    <div className="h-1.5 w-full rounded-full bg-stone-100 dark:bg-[#2a2a2d] overflow-hidden">
                                      <div
                                        className="h-full bg-gradient-to-r from-emerald-400 to-teal-500 rounded-full transition-all duration-300 ease-out"
                                        style={{ width: `${Math.round((aiPrefillImageUpload.current / aiPrefillImageUpload.total) * 100)}%` }}
                                      />
                                    </div>
                                  </div>
                                )}

                                {/* Category progress grid */}
                                {aiPrefillStatus === 'filling' && (
                                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                                    {plantFormCategoryOrder.filter(cat => cat !== 'meta').map((cat) => {
                                      const info = aiPrefillCategoryProgress[cat];
                                      if (!info?.total) return null;
                                      const percent = info.total ? Math.round((info.completed / info.total) * 100) : 0;
                                      const isDone = info.status === 'done';
                                      const isFilling = info.status === 'filling';
                                      return (
                                        <div 
                                          key={cat} 
                                          className={`rounded-lg p-2 transition-all ${
                                            isDone 
                                              ? 'bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800/50' 
                                              : isFilling
                                                ? 'bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800/50'
                                                : 'bg-white dark:bg-[#1e1e20] border border-stone-100 dark:border-[#2a2a2d]'
                                          }`}
                                        >
                                          <div className="flex items-center justify-between mb-1">
                                            <span className={`text-[10px] font-medium truncate ${
                                              isDone ? 'text-emerald-700 dark:text-emerald-300' : 
                                              isFilling ? 'text-blue-700 dark:text-blue-300' : 
                                              'text-stone-500 dark:text-stone-400'
                                            }`}>
                                              {aiPrefillCategoryLabels[cat]}
                                            </span>
                                            {isDone && <Check className="h-3 w-3 text-emerald-500 flex-shrink-0" />}
                                            {isFilling && <Loader2 className="h-3 w-3 animate-spin text-blue-500 flex-shrink-0" />}
                                          </div>
                                          <div className="h-1 w-full rounded-full bg-stone-200 dark:bg-stone-700/50 overflow-hidden">
                                            <div
                                              className={`h-full transition-all duration-300 rounded-full ${
                                                isDone ? 'bg-emerald-500' : isFilling ? 'bg-blue-500' : 'bg-stone-300 dark:bg-stone-600'
                                              }`}
                                              style={{ width: `${percent}%` }}
                                            />
                                          </div>
                                        </div>
                                      );
                                    })}
                                  </div>
                                )}
                              </div>
                            )}

                            {/* Recently completed plants - shown during running */}
                            {aiPrefillCompletedPlants.length > 0 && (
                              <div className="space-y-2">
                                <div className="text-[11px] uppercase tracking-wider font-medium text-stone-400 dark:text-stone-500">
                                  Completed ({aiPrefillCompletedPlants.length})
                                </div>
                                <div className="space-y-1.5 max-h-48 overflow-y-auto">
                                  {aiPrefillCompletedPlants.slice().reverse().map((plant, idx) => (
                                    <div
                                      key={`${plant.name}-${idx}`}
                                      className={`flex items-center gap-2.5 text-xs rounded-lg px-3 py-2 transition-all ${
                                        plant.success 
                                          ? 'bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-100 dark:border-emerald-800/30'
                                          : 'bg-red-50 dark:bg-red-900/20 border border-red-100 dark:border-red-800/30'
                                      }`}
                                    >
                                      <div className={`w-5 h-5 rounded-md flex items-center justify-center flex-shrink-0 ${
                                        plant.success 
                                          ? 'bg-emerald-500/20 dark:bg-emerald-500/30' 
                                          : 'bg-red-500/20 dark:bg-red-500/30'
                                      }`}>
                                        {plant.success ? (
                                          <Check className="h-3 w-3 text-emerald-600 dark:text-emerald-400" />
                                        ) : (
                                          <X className="h-3 w-3 text-red-600 dark:text-red-400" />
                                        )}
                                      </div>
                                      <span className={`truncate font-medium ${
                                        plant.success 
                                          ? 'text-emerald-800 dark:text-emerald-200' 
                                          : 'text-red-800 dark:text-red-200'
                                      }`}>{plant.name}</span>
                                      {plant.durationMs && (
                                        <span className="ml-auto text-[10px] font-mono text-stone-500 dark:text-stone-400 bg-white dark:bg-[#1e1e20] px-1.5 py-0.5 rounded">
                                          {formatDuration(plant.durationMs)}
                                        </span>
                                      )}
                                      {!plant.success && plant.error && (
                                        <span className="truncate text-[10px] text-red-500 dark:text-red-400 ml-2" title={plant.error}>{plant.error}</span>
                                      )}
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        )}

                        {/* AI Prefill Error - Neomorphic */}
                        {aiPrefillError && !aiPrefillRunning && (
                          <div className="rounded-xl border border-stone-200 dark:border-[#3e3e42] bg-white dark:bg-[#1e1e20] px-4 py-3 shadow-sm flex items-center gap-3">
                            <div className="w-8 h-8 rounded-lg bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center flex-shrink-0">
                              <AlertCircle className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                            </div>
                            <span className="text-sm text-stone-700 dark:text-stone-300 flex-1">{aiPrefillError}</span>
                            <button
                              type="button"
                              className="w-7 h-7 rounded-lg bg-stone-100 dark:bg-[#2a2a2d] flex items-center justify-center text-stone-500 hover:text-stone-700 dark:hover:text-stone-300 hover:bg-stone-200 dark:hover:bg-[#3a3a3d] transition-colors"
                              onClick={() => setAiPrefillError(null)}
                            >
                              <X className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        )}

                        {/* AI Prefill Completed Plants - Shown after completion/cancellation */}
                        {aiPrefillCompletedPlants.length > 0 && !aiPrefillRunning && (
                          <div className="rounded-xl border border-stone-200 dark:border-[#3e3e42] bg-white dark:bg-[#1e1e20] p-4 shadow-sm space-y-3">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <div className="text-xs font-medium text-stone-600 dark:text-stone-300">
                                  Processed Plants
                                </div>
                                <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-stone-100 dark:bg-[#2a2a2d] text-stone-500 dark:text-stone-400">
                                  {aiPrefillCompletedPlants.filter(p => p.success).length} success / {aiPrefillCompletedPlants.filter(p => !p.success).length} failed
                                </span>
                              </div>
                              <button
                                type="button"
                                className="text-[10px] text-stone-400 hover:text-stone-600 dark:hover:text-stone-300 transition-colors"
                                onClick={() => setAiPrefillCompletedPlants([])}
                              >
                                Clear
                              </button>
                            </div>
                            <div className="space-y-1.5 max-h-64 overflow-y-auto">
                              {aiPrefillCompletedPlants.slice().reverse().map((plant, idx) => (
                                <div
                                  key={`${plant.name}-${idx}`}
                                  className={`flex items-center gap-2.5 text-xs rounded-lg px-3 py-2 transition-all ${
                                    plant.success 
                                      ? 'bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-100 dark:border-emerald-800/30'
                                      : 'bg-red-50 dark:bg-red-900/20 border border-red-100 dark:border-red-800/30'
                                  }`}
                                >
                                  <div className={`w-5 h-5 rounded-md flex items-center justify-center flex-shrink-0 ${
                                    plant.success 
                                      ? 'bg-emerald-500/20 dark:bg-emerald-500/30' 
                                      : 'bg-red-500/20 dark:bg-red-500/30'
                                  }`}>
                                    {plant.success ? (
                                      <Check className="h-3 w-3 text-emerald-600 dark:text-emerald-400" />
                                    ) : (
                                      <X className="h-3 w-3 text-red-600 dark:text-red-400" />
                                    )}
                                  </div>
                                  <span className={`truncate font-medium ${
                                    plant.success 
                                      ? 'text-emerald-800 dark:text-emerald-200' 
                                      : 'text-red-800 dark:text-red-200'
                                  }`}>{plant.name}</span>
                                  {plant.durationMs && (
                                    <span className="ml-auto text-[10px] font-mono text-stone-500 dark:text-stone-400 bg-white dark:bg-[#1e1e20] px-1.5 py-0.5 rounded">
                                      {formatDuration(plant.durationMs)}
                                    </span>
                                  )}
                                  {!plant.success && plant.error && (
                                    <span className="truncate text-[10px] text-red-500 dark:text-red-400 ml-2" title={plant.error}>{plant.error}</span>
                                  )}
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Search & Filters */}
                        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                          <SearchInput
                            placeholder="Search requests by plant name..."
                            value={requestSearchQuery}
                            onChange={(e) =>
                              setRequestSearchQuery(e.target.value)
                            }
                            className="rounded-xl flex-1"
                          />
                          <button
                            type="button"
                            onClick={() => setHideStaffRequests((prev) => !prev)}
                            className={`flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-medium transition-all whitespace-nowrap border ${
                              hideStaffRequests
                                ? "bg-purple-50 dark:bg-purple-900/20 border-purple-200 dark:border-purple-800/50 text-purple-700 dark:text-purple-300"
                                : "bg-stone-50 dark:bg-[#252528] border-stone-200 dark:border-[#3e3e42] text-stone-500 dark:text-stone-400"
                            }`}
                            title={hideStaffRequests ? "Showing only user requests (admins/editors hidden)" : "Showing all requests including admins/editors"}
                          >
                            <ShieldX className={`h-3.5 w-3.5 ${hideStaffRequests ? "text-purple-600 dark:text-purple-400" : "opacity-50"}`} />
                            {hideStaffRequests ? "Staff hidden" : "Show all"}
                          </button>
                        </div>

                        {plantRequestsError && (
                          <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900/60 dark:bg-red-900/30 dark:text-red-200">
                            {plantRequestsError}
                          </div>
                        )}
                        {plantRequestsLoading ? (
                          <div className="text-sm opacity-60">
                            Loading requests...
                          </div>
                        ) : (
                          (() => {
                            // Apply staff filter first, then search filter
                            const staffFiltered = hideStaffRequests
                              ? plantRequests.filter((req) => req.requester_is_staff !== true)
                              : plantRequests;
                            const filteredRequests = requestSearchQuery.trim()
                              ? staffFiltered.filter((req) =>
                                  req.plant_name
                                    .toLowerCase()
                                    .includes(
                                      requestSearchQuery.toLowerCase().trim(),
                                    ),
                                )
                              : staffFiltered;

                            return filteredRequests.length === 0 ? (
                              <div className="text-sm opacity-60">
                                {requestSearchQuery.trim()
                                  ? "No requests match your search."
                                  : "No pending requests."}
                              </div>
                            ) : (
                              <div className="flex flex-col gap-3">
                                {filteredRequests.map((req) => {
                                  const updatedSource =
                                    req.updated_at ?? req.created_at;
                                  const updatedMs = updatedSource
                                    ? Date.parse(updatedSource)
                                    : NaN;
                                  const hasTimestamp =
                                    Number.isFinite(updatedMs);
                                  const timeLabel = hasTimestamp
                                    ? `Last update ${formatTimeAgo(updatedMs)}`
                                    : "Last update unknown";
                                  const updatedTitle = hasTimestamp
                                    ? new Date(updatedMs).toLocaleString()
                                    : undefined;
                                  return (
                                    <div
                                      key={req.id}
                                      className="flex flex-col gap-3 rounded-xl border bg-white p-3 dark:bg-[#252526] dark:border-[#3e3e42] md:flex-row md:items-center md:justify-between"
                                    >
                                      <div className="flex items-start gap-2 flex-1">
                                        <div className="flex-1">
                                          {editingRequestId === req.id ? (
                                            <div className="flex items-center gap-2">
                                              <Input
                                                value={editingRequestName}
                                                onChange={(e) => setEditingRequestName(e.target.value)}
                                                className="h-8 text-sm"
                                                autoFocus
                                                onKeyDown={(e) => {
                                                  if (e.key === 'Enter') {
                                                    handleSaveRequestName(req.id);
                                                  } else if (e.key === 'Escape') {
                                                    handleCancelEditRequest();
                                                  }
                                                }}
                                              />
                                              <Button
                                                variant="ghost"
                                                size="sm"
                                                className="h-8 w-8 p-0"
                                                onClick={() => handleSaveRequestName(req.id)}
                                                disabled={savingRequestName}
                                              >
                                                {savingRequestName ? (
                                                  <Loader2 className="h-4 w-4 animate-spin" />
                                                ) : (
                                                  <Check className="h-4 w-4 text-green-600" />
                                                )}
                                              </Button>
                                              <Button
                                                variant="ghost"
                                                size="sm"
                                                className="h-8 w-8 p-0"
                                                onClick={handleCancelEditRequest}
                                              >
                                                <X className="h-4 w-4 text-red-600" />
                                              </Button>
                                            </div>
                                          ) : (
                                            <div className="flex items-center gap-1">
                                              <div className="text-sm font-medium">
                                                {req.plant_name}
                                              </div>
                                              <Button
                                                variant="ghost"
                                                size="sm"
                                                className="h-6 w-6 p-0 opacity-40 hover:opacity-100"
                                                onClick={() => handleStartEditRequest(req)}
                                                title="Edit name"
                                              >
                                                <Pencil className="h-3 w-3" />
                                              </Button>
                                              <Button
                                                variant="ghost"
                                                size="sm"
                                                className="h-6 w-6 p-0 opacity-40 hover:opacity-100"
                                                onClick={() => handleTranslateRequestName(req)}
                                                disabled={translatingRequestId === req.id}
                                                title="Translate to English (DeepL)"
                                              >
                                                {translatingRequestId === req.id ? (
                                                  <Loader2 className="h-3 w-3 animate-spin" />
                                                ) : (
                                                  <Languages className="h-3 w-3" />
                                                )}
                                              </Button>
                                            </div>
                                          )}
                                          <div className="flex items-center gap-2">
                                            <div
                                              className="text-xs opacity-60"
                                              title={updatedTitle}
                                            >
                                              {timeLabel}
                                            </div>
                                            {req.requester_is_staff === true && (
                                              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10px] font-medium bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400 border border-purple-200 dark:border-purple-800/40" title="Requested by an admin or editor">
                                                <Shield className="h-2.5 w-2.5" />
                                                Staff
                                              </span>
                                            )}
                                          </div>
                                        </div>
                                        <Button
                                          variant="ghost"
                                          size="sm"
                                          className="rounded-full h-6 w-6 p-0 opacity-60 hover:opacity-100"
                                          onClick={() =>
                                            handleOpenInfoDialog(req)
                                          }
                                          title="View request details"
                                        >
                                          <Info className="h-4 w-4" />
                                        </Button>
                                      </div>
                                      <div className="flex items-center gap-3">
                                        <Badge
                                          variant="secondary"
                                          className="rounded-xl px-2 py-1 text-xs"
                                        >
                                          {req.request_count}{" "}
                                          {req.request_count === 1
                                            ? "request"
                                            : "requests"}
                                        </Badge>
                                        <Button
                                          variant="default"
                                          className="rounded-2xl"
                                          onClick={() =>
                                            handleOpenCreatePlantDialog(req)
                                          }
                                        >
                                          <Plus className="h-4 w-4 mr-2" />
                                          Add Plant
                                        </Button>
                                        <Button
                                          variant="outline"
                                          className="rounded-2xl"
                                          onClick={() =>
                                            completePlantRequest(req.id)
                                          }
                                          disabled={
                                            completingRequestId === req.id
                                          }
                                        >
                                          {completingRequestId === req.id
                                            ? "Completing..."
                                            : "Complete"}
                                        </Button>
                                      </div>
                                    </div>
                                  );
                                })}
                                {/* Load More button - only show when not searching and there are more items */}
                                {!requestSearchQuery.trim() && plantRequestsHasMore && (
                                  <div className="flex justify-center pt-2">
                                    <Button
                                      variant="outline"
                                      className="rounded-xl"
                                      onClick={loadMorePlantRequests}
                                      disabled={plantRequestsLoadingMore}
                                    >
                                      {plantRequestsLoadingMore ? (
                                        <>
                                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                          Loading...
                                        </>
                                      ) : (
                                        <>
                                          Load More ({hideStaffRequests ? staffFiltered.length : plantRequests.length} / {plantRequestsTotalCount})
                                        </>
                                      )}
                                    </Button>
                                  </div>
                                )}
                              </div>
                            );
                          })()
                        )}
                      </CardContent>
                    </Card>
                        )}

                    {/* Bulk Request Dialog */}
                    <Dialog
                      open={bulkRequestDialogOpen}
                      onOpenChange={handleBulkRequestOpenChange}
                    >
                      <DialogContent className="rounded-2xl max-w-2xl">
                        <DialogHeader>
                          <DialogTitle>Bulk Plant Requests</DialogTitle>
                          <DialogDescription>
                            Paste a list of plant names separated by commas or
                            new lines. Each unique name will be added one by
                            one without hitting request limits.
                          </DialogDescription>
                        </DialogHeader>
                        <div className="space-y-4">
                          {bulkRequestStep === "edit" ? (
                            <>
                              <div className="rounded-2xl border border-stone-200 dark:border-[#3e3e42] bg-stone-50/70 dark:bg-[#1e1e20] p-4 space-y-3">
                                <div className="flex items-center justify-between">
                                  <span className="text-[11px] uppercase tracking-wider font-medium text-stone-500 dark:text-stone-400">
                                    Plant list
                                  </span>
                                  {bulkRequestParsed.rawCount > 0 && (
                                    <span className="text-[11px] text-stone-400 dark:text-stone-500">
                                      {bulkRequestParsed.rawCount} entries
                                    </span>
                                  )}
                                </div>
                                <Textarea
                                  className="min-h-[220px] resize-y rounded-xl bg-white dark:bg-[#252528]"
                                  placeholder={`Monstera deliciosa, Snake plant\nFiddle leaf fig`}
                                  value={bulkRequestInput}
                                  onChange={(e) => {
                                    setBulkRequestInput(e.target.value);
                                    if (bulkRequestError) setBulkRequestError(null);
                                    if (bulkRequestSummary) setBulkRequestSummary(null);
                                  }}
                                  disabled={bulkRequestSubmitting}
                                />
                                <div className="text-xs text-stone-500 dark:text-stone-400">
                                  Tip: One plant per line works best for long lists.
                                </div>
                              </div>

                              <div className="grid gap-3 sm:grid-cols-3">
                                <div className="rounded-xl border border-stone-200 dark:border-[#3e3e42] bg-white dark:bg-[#252528] p-3">
                                  <div className="text-[11px] uppercase tracking-wider text-stone-400 dark:text-stone-500">
                                    Unique
                                  </div>
                                  <div className="text-lg font-semibold text-stone-800 dark:text-stone-100">
                                    {bulkRequestParsed.uniqueCount}
                                  </div>
                                </div>
                                <div className="rounded-xl border border-stone-200 dark:border-[#3e3e42] bg-white dark:bg-[#252528] p-3">
                                  <div className="text-[11px] uppercase tracking-wider text-stone-400 dark:text-stone-500">
                                    Duplicates
                                  </div>
                                  <div className="text-lg font-semibold text-stone-800 dark:text-stone-100">
                                    {bulkRequestParsed.duplicateCount}
                                  </div>
                                </div>
                                <div className="rounded-xl border border-stone-200 dark:border-[#3e3e42] bg-white dark:bg-[#252528] p-3">
                                  <div className="text-[11px] uppercase tracking-wider text-stone-400 dark:text-stone-500">
                                    Ready
                                  </div>
                                  <div className="text-lg font-semibold text-stone-800 dark:text-stone-100">
                                    {bulkRequestParsed.uniqueCount}
                                  </div>
                                </div>
                              </div>

                              {bulkRequestParsed.previewSamples.length > 0 && (
                                <div className="space-y-2">
                                  <div className="text-xs font-medium text-stone-500 dark:text-stone-400">
                                    Preview
                                  </div>
                                  <div className="flex flex-wrap gap-2">
                                    {bulkRequestParsed.previewSamples.map((name) => (
                                      <span
                                        key={name}
                                        className="rounded-full bg-stone-100 dark:bg-[#2a2a2d] px-2.5 py-1 text-xs text-stone-600 dark:text-stone-300"
                                      >
                                        {name}
                                      </span>
                                    ))}
                                    {bulkRequestParsed.uniqueCount > bulkRequestParsed.previewSamples.length && (
                                      <span className="rounded-full bg-stone-100 dark:bg-[#2a2a2d] px-2.5 py-1 text-xs text-stone-500 dark:text-stone-400">
                                        +{bulkRequestParsed.uniqueCount - bulkRequestParsed.previewSamples.length} more
                                      </span>
                                    )}
                                  </div>
                                </div>
                              )}

                              {bulkRequestParsed.duplicateCount > 0 && (
                                <div className="rounded-xl border border-amber-200 dark:border-amber-900/40 bg-amber-50/70 dark:bg-amber-900/20 p-3 space-y-2">
                                  <div className="text-xs font-medium text-amber-700 dark:text-amber-300">
                                    Duplicates will be skipped
                                  </div>
                                  <div className="flex flex-wrap gap-2">
                                    {bulkRequestParsed.duplicateSamples.map((name, idx) => (
                                      <span
                                        key={`${name}-${idx}`}
                                        className="rounded-full bg-amber-100/80 dark:bg-amber-900/30 px-2.5 py-1 text-xs text-amber-700 dark:text-amber-200"
                                      >
                                        {name}
                                      </span>
                                    ))}
                                    {bulkRequestParsed.duplicateCount > bulkRequestParsed.duplicateSamples.length && (
                                      <span className="rounded-full bg-amber-100/80 dark:bg-amber-900/30 px-2.5 py-1 text-xs text-amber-600 dark:text-amber-200">
                                        +{bulkRequestParsed.duplicateCount - bulkRequestParsed.duplicateSamples.length} more
                                      </span>
                                    )}
                                  </div>
                                </div>
                              )}
                            </>
                          ) : (
                            <>
                              <div className="rounded-2xl border border-stone-200 dark:border-[#3e3e42] bg-white dark:bg-[#252528] p-4 space-y-4">
                                <div className="flex items-center justify-between">
                                  <span className="text-[11px] uppercase tracking-wider font-medium text-stone-500 dark:text-stone-400">
                                    Separated plants
                                  </span>
                                  <span className="text-[11px] text-stone-400 dark:text-stone-500">
                                    {bulkRequestParsed.uniqueCount} requests
                                  </span>
                                </div>
                                <div className="grid gap-3 sm:grid-cols-3">
                                  <div className="rounded-lg bg-stone-50 dark:bg-[#1e1e20] px-3 py-2">
                                    <div className="text-[11px] text-stone-400 dark:text-stone-500">
                                      Entries
                                    </div>
                                    <div className="font-semibold text-stone-700 dark:text-stone-200">
                                      {bulkRequestParsed.rawCount}
                                    </div>
                                  </div>
                                  <div className="rounded-lg bg-stone-50 dark:bg-[#1e1e20] px-3 py-2">
                                    <div className="text-[11px] text-stone-400 dark:text-stone-500">
                                      Unique requests
                                    </div>
                                    <div className="font-semibold text-stone-700 dark:text-stone-200">
                                      {bulkRequestParsed.uniqueCount}
                                    </div>
                                  </div>
                                  <div className="rounded-lg bg-stone-50 dark:bg-[#1e1e20] px-3 py-2">
                                    <div className="text-[11px] text-stone-400 dark:text-stone-500">
                                      Duplicates
                                    </div>
                                    <div className="font-semibold text-stone-700 dark:text-stone-200">
                                      {bulkRequestParsed.duplicateCount}
                                    </div>
                                  </div>
                                </div>
                                <div className="rounded-xl border border-stone-100 dark:border-[#2a2a2d] bg-stone-50/60 dark:bg-[#1e1e20] p-3">
                                  <div className="text-xs text-stone-500 dark:text-stone-400 mb-2">
                                    These are the requests that will be created:
                                  </div>
                                  <div className="max-h-64 overflow-y-auto divide-y divide-stone-100 dark:divide-[#2a2a2d]">
                                    {bulkRequestParsed.items.map((item, idx) => (
                                      <div
                                        key={item.normalized}
                                        className="flex items-center gap-3 py-2 text-sm"
                                      >
                                        <span className="w-6 text-right text-[11px] text-stone-400 dark:text-stone-500">
                                          {idx + 1}
                                        </span>
                                        <span className="font-medium text-stone-700 dark:text-stone-200">
                                          {item.displayName}
                                        </span>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              </div>

                              {bulkRequestParsed.duplicateCount > 0 && (
                                <div className="rounded-xl border border-amber-200 dark:border-amber-900/40 bg-amber-50/70 dark:bg-amber-900/20 p-3 space-y-2">
                                  <div className="text-xs font-medium text-amber-700 dark:text-amber-300">
                                    Duplicate entries will be ignored
                                  </div>
                                  <div className="flex flex-wrap gap-2">
                                    {bulkRequestParsed.duplicateSamples.map((name, idx) => (
                                      <span
                                        key={`${name}-${idx}`}
                                        className="rounded-full bg-amber-100/80 dark:bg-amber-900/30 px-2.5 py-1 text-xs text-amber-700 dark:text-amber-200"
                                      >
                                        {name}
                                      </span>
                                    ))}
                                    {bulkRequestParsed.duplicateCount > bulkRequestParsed.duplicateSamples.length && (
                                      <span className="rounded-full bg-amber-100/80 dark:bg-amber-900/30 px-2.5 py-1 text-xs text-amber-600 dark:text-amber-200">
                                        +{bulkRequestParsed.duplicateCount - bulkRequestParsed.duplicateSamples.length} more
                                      </span>
                                    )}
                                  </div>
                                </div>
                              )}

                              {bulkRequestSubmitting && bulkRequestProgress.total > 0 && (
                                <div className="space-y-2">
                                  <div className="flex items-center justify-between text-xs text-stone-500 dark:text-stone-400">
                                    <span>Creating requests...</span>
                                    <span>
                                      {bulkRequestProgress.current} / {bulkRequestProgress.total}
                                    </span>
                                  </div>
                                  <div className="h-2 w-full rounded-full bg-stone-100 dark:bg-[#2a2a2d] overflow-hidden">
                                    <div
                                      className="h-full bg-gradient-to-r from-emerald-400 to-teal-500 transition-all duration-300"
                                      style={{
                                        width: bulkRequestProgress.total > 0
                                          ? `${Math.round(
                                              (bulkRequestProgress.current / bulkRequestProgress.total) * 100,
                                            )}%`
                                          : "0%",
                                      }}
                                    />
                                  </div>
                                </div>
                              )}

                              {(bulkRequestSubmitting || bulkRequestLiveResults.length > 0) && (
                                <div className="rounded-xl border border-stone-200 dark:border-[#3e3e42] bg-white dark:bg-[#252528] p-3 space-y-2">
                                  <div className="flex items-center justify-between text-xs text-stone-500 dark:text-stone-400">
                                    <span className="font-medium">Live results</span>
                                    <span>
                                      Added {bulkRequestLiveCounts.added} · Skipped{" "}
                                      {bulkRequestLiveCounts.skipped} · Errors{" "}
                                      {bulkRequestLiveCounts.error}
                                    </span>
                                  </div>
                                  <div className="max-h-40 overflow-y-auto space-y-1 text-xs">
                                    {bulkRequestLiveResults
                                      .slice()
                                      .reverse()
                                      .map((entry, idx) => (
                                        <div
                                          key={`${entry.name}-${idx}`}
                                          className="flex items-center justify-between rounded-lg bg-stone-50 dark:bg-[#1e1e20] px-2.5 py-1.5"
                                        >
                                          <span className="truncate text-stone-600 dark:text-stone-300">
                                            {entry.name}
                                          </span>
                                          <span
                                            className={`ml-3 rounded-full px-2 py-0.5 text-[10px] font-medium ${
                                              entry.status === "added"
                                                ? "bg-emerald-100/80 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-200"
                                                : entry.status === "skipped"
                                                  ? "bg-amber-100/80 text-amber-700 dark:bg-amber-900/30 dark:text-amber-200"
                                                  : "bg-red-100/80 text-red-700 dark:bg-red-900/30 dark:text-red-200"
                                            }`}
                                            title={entry.error}
                                          >
                                            {entry.status === "added"
                                              ? "Added"
                                              : entry.status === "skipped"
                                                ? "Skipped"
                                                : "Error"}
                                          </span>
                                        </div>
                                      ))}
                                  </div>
                                </div>
                              )}

                              {bulkRequestError && (
                                <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900/60 dark:bg-red-900/30 dark:text-red-200">
                                  {bulkRequestError}
                                </div>
                              )}

                              {bulkRequestSummary && (
                                <div className="rounded-xl border border-stone-200 dark:border-[#3e3e42] bg-white dark:bg-[#252528] p-4 space-y-3">
                                  <div className="flex items-center justify-between">
                                    <div className="text-sm font-semibold text-stone-700 dark:text-stone-200">
                                      Bulk request summary
                                    </div>
                                    <Badge variant="secondary" className="rounded-full text-xs">
                                      {bulkRequestSummary.addedCount} added
                                    </Badge>
                                  </div>
                                  <div className="grid gap-3 sm:grid-cols-3 text-sm">
                                    <div className="rounded-lg bg-stone-50 dark:bg-[#1e1e20] px-3 py-2">
                                      <div className="text-[11px] text-stone-400 dark:text-stone-500">
                                        Added
                                      </div>
                                      <div className="font-semibold text-stone-700 dark:text-stone-200">
                                        {bulkRequestSummary.addedCount}
                                      </div>
                                    </div>
                                    <div className="rounded-lg bg-stone-50 dark:bg-[#1e1e20] px-3 py-2">
                                      <div className="text-[11px] text-stone-400 dark:text-stone-500">
                                        Already requested
                                      </div>
                                      <div className="font-semibold text-stone-700 dark:text-stone-200">
                                        {bulkRequestSummary.skippedExistingCount}
                                      </div>
                                    </div>
                                    <div className="rounded-lg bg-stone-50 dark:bg-[#1e1e20] px-3 py-2">
                                      <div className="text-[11px] text-stone-400 dark:text-stone-500">
                                        Errors
                                      </div>
                                      <div className="font-semibold text-stone-700 dark:text-stone-200">
                                        {bulkRequestSummary.errorCount}
                                      </div>
                                    </div>
                                  </div>

                                  {bulkRequestSummary.addedSamples.length > 0 && (
                                    <div className="space-y-2">
                                      <div className="text-xs font-medium text-emerald-700 dark:text-emerald-300">
                                        Added
                                      </div>
                                      <div className="flex flex-wrap gap-2">
                                        {bulkRequestSummary.addedSamples.map((name) => (
                                          <span
                                            key={name}
                                            className="rounded-full bg-emerald-50 dark:bg-emerald-900/30 px-2.5 py-1 text-xs text-emerald-700 dark:text-emerald-200"
                                          >
                                            {name}
                                          </span>
                                        ))}
                                      </div>
                                    </div>
                                  )}

                                  {bulkRequestSummary.skippedExistingSamples.length > 0 && (
                                    <div className="space-y-2">
                                      <div className="text-xs font-medium text-stone-500 dark:text-stone-400">
                                        Already requested
                                      </div>
                                      <div className="flex flex-wrap gap-2">
                                        {bulkRequestSummary.skippedExistingSamples.map((name) => (
                                          <span
                                            key={name}
                                            className="rounded-full bg-stone-100 dark:bg-[#2a2a2d] px-2.5 py-1 text-xs text-stone-600 dark:text-stone-300"
                                          >
                                            {name}
                                          </span>
                                        ))}
                                      </div>
                                    </div>
                                  )}

                                  {bulkRequestSummary.errorSamples.length > 0 && (
                                    <div className="space-y-2">
                                      <div className="text-xs font-medium text-red-600 dark:text-red-300">
                                        Errors
                                      </div>
                                      <div className="space-y-1 text-xs text-red-600 dark:text-red-300">
                                        {bulkRequestSummary.errorSamples.map((entry, idx) => (
                                          <div key={`${entry.name}-${idx}`}>
                                            {entry.name}: {entry.error}
                                          </div>
                                        ))}
                                      </div>
                                    </div>
                                  )}
                                </div>
                              )}
                            </>
                          )}
                        </div>
                        <DialogFooter>
                          {bulkRequestStep === "edit" ? (
                            <>
                              <Button
                                variant="secondary"
                                onClick={() => handleBulkRequestOpenChange(false)}
                                disabled={bulkRequestSubmitting}
                                className="rounded-xl"
                              >
                                Close
                              </Button>
                              <Button
                                onClick={() => {
                                  setBulkRequestStep("review");
                                  setBulkRequestError(null);
                                  setBulkRequestSummary(null);
                                  setBulkRequestProgress({ current: 0, total: 0 });
                                  setBulkRequestLiveResults([]);
                                  setBulkRequestLiveCounts({
                                    added: 0,
                                    skipped: 0,
                                    error: 0,
                                  });
                                }}
                                disabled={
                                  bulkRequestSubmitting ||
                                  bulkRequestParsed.uniqueCount === 0
                                }
                                className="rounded-xl"
                              >
                                Review
                              </Button>
                            </>
                          ) : (
                            <>
                              <Button
                                variant="secondary"
                                onClick={() => {
                                  if (bulkRequestSubmitting) return;
                                  setBulkRequestStep("edit");
                                  setBulkRequestError(null);
                                  setBulkRequestSummary(null);
                                  setBulkRequestProgress({ current: 0, total: 0 });
                                  setBulkRequestLiveResults([]);
                                  setBulkRequestLiveCounts({
                                    added: 0,
                                    skipped: 0,
                                    error: 0,
                                  });
                                }}
                                disabled={bulkRequestSubmitting}
                                className="rounded-xl"
                              >
                                Cancel
                              </Button>
                              <Button
                                onClick={handleBulkRequestSubmit}
                                disabled={
                                  bulkRequestSubmitting ||
                                  bulkRequestParsed.uniqueCount === 0
                                }
                                className="rounded-xl"
                              >
                                {bulkRequestSubmitting ? "Adding..." : "Confirm & Add"}
                              </Button>
                            </>
                          )}
                        </DialogFooter>
                      </DialogContent>
                    </Dialog>

                    {/* Info Dialog */}
                    <Dialog
                      open={infoDialogOpen}
                      onOpenChange={setInfoDialogOpen}
                    >
                      <DialogContent className="rounded-2xl max-w-md">
                        <DialogHeader>
                          <DialogTitle>Request Details</DialogTitle>
                          <DialogDescription>
                            Information about this plant request
                          </DialogDescription>
                        </DialogHeader>
                        {selectedRequestInfo && (
                          <div className="space-y-4 py-4">
                            <div>
                              <div className="text-sm font-medium mb-1">
                                Plant Name
                              </div>
                              <div className="text-base">
                                {selectedRequestInfo.plant_name}
                              </div>
                            </div>
                            <div>
                              <div className="text-sm font-medium mb-2">
                                Users who requested this plant
                              </div>
                              {requestUsersLoading ? (
                                <div className="text-sm opacity-60">
                                  Loading users...
                                </div>
                              ) : requestUsers.length === 0 ? (
                                <div className="text-sm opacity-60">
                                  No users have requested this plant yet.
                                </div>
                              ) : (
                                <div className="space-y-2 max-h-60 overflow-y-auto">
                                  {requestUsers.map((user) => (
                                    <div
                                      key={user.id}
                                      className="text-sm p-2 rounded-lg bg-neutral-100 dark:bg-[#2d2d30]"
                                    >
                                      <div className="font-medium">
                                        {user.display_name ||
                                          user.email ||
                                          `User ${user.id.slice(0, 8)}`}
                                      </div>
                                      {user.email && user.display_name && (
                                        <div className="text-xs opacity-60">
                                          {user.email}
                                        </div>
                                      )}
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          </div>
                        )}
                        <DialogFooter>
                          <Button
                            variant="secondary"
                            onClick={() => setInfoDialogOpen(false)}
                            className="rounded-xl"
                          >
                            Close
                          </Button>
                        </DialogFooter>
                      </DialogContent>
                    </Dialog>

                    </div>
                  )}

                    {/* Upload & Media Tab */}
                    {activeTab === "upload" && <AdminUploadMediaPanel />}

                    {/* Notifications Tab */}
                    {activeTab === "notifications" && <AdminNotificationsPanel />}

                    {/* Emails Tab */}
                    {activeTab === "emails" && <AdminEmailsPanel />}

                  {/* Advanced Tab */}
                  {activeTab === "admin_logs" && <AdminAdvancedPanel />}

                {/* Members Tab */}
                {activeTab === "members" && (
                  <div className="space-y-4" ref={membersContainerRef}>
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div className="flex items-center gap-2 text-sm font-semibold">
                        <Link
                          to="/admin/members"
                          className={`px-3 py-1.5 rounded-full transition-colors ${membersView === "search" ? "bg-emerald-600 text-white shadow" : "text-stone-600 dark:text-stone-300 hover:text-black dark:hover:text-white"}`}
                        >
                          Search
                        </Link>
                        <span className="text-xs opacity-50">|</span>
                        <Link
                          to="/admin/members/list"
                          className={`px-3 py-1.5 rounded-full transition-colors ${membersView === "list" ? "bg-emerald-600 text-white shadow" : "text-stone-600 dark:text-stone-300 hover:text-black dark:hover:text-white"}`}
                        >
                          List
                        </Link>
                        <span className="text-xs opacity-50">|</span>
                        <Link
                          to="/admin/members/reports"
                          className={`px-3 py-1.5 rounded-full transition-colors flex items-center gap-1.5 ${membersView === "reports" ? "bg-emerald-600 text-white shadow" : "text-stone-600 dark:text-stone-300 hover:text-black dark:hover:text-white"}`}
                        >
                          Reports
                          {activeReportsCount > 0 && (
                            <span className={`px-1.5 py-0.5 text-[10px] font-semibold rounded-full ${membersView === "reports" ? "bg-white/20 text-white" : "bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400"}`}>
                              {activeReportsCount}
                            </span>
                          )}
                        </Link>
                      </div>
                      {membersView === "list" && (
                        <Button
                          variant="outline"
                          size="sm"
                          className="rounded-2xl"
                          onClick={() => loadMemberList({ reset: true })}
                          disabled={memberListLoading}
                        >
                          <RefreshCw
                            className={`h-4 w-4 mr-2 ${memberListLoading ? "animate-spin" : ""}`}
                          />
                          Refresh list
                        </Button>
                      )}
                    </div>

                    {membersView === "search" && (
                      <>
                    <Card className="rounded-2xl">
                      <CardContent className="p-4 space-y-3">
                        <div className="text-sm font-medium flex items-center gap-2">
                          <UserSearch className="h-4 w-4" /> Find member by
                          email or username
                        </div>
                        <div className="flex gap-2 relative">
                          <div className="flex-1 relative">
                            <Input
                              id="member-email"
                              name="member-email"
                              autoComplete="off"
                              aria-label="Member email or username"
                              className="rounded-xl"
                              placeholder="user@example.com or username"
                              value={lookupEmail}
                              onChange={(
                                e: React.ChangeEvent<HTMLInputElement>,
                              ) => setLookupEmail(e.target.value)}
                              onFocus={() => {
                                if (emailSuggestions.length > 0)
                                  setSuggestionsOpen(true);
                              }}
                              onBlur={() =>
                                setTimeout(() => setSuggestionsOpen(false), 120)
                              }
                              onKeyDown={(e) => {
                                if (e.key === "Enter") {
                                  if (
                                    suggestionsOpen &&
                                    emailSuggestions.length > 0 &&
                                    highlightIndex >= 0 &&
                                    highlightIndex < emailSuggestions.length
                                  ) {
                                    e.preventDefault();
                                    const chosen =
                                      emailSuggestions[highlightIndex];
                                    const typed = lookupEmail.trim();
                                    const nextVal = typed.includes("@")
                                      ? chosen.email ||
                                        chosen.display_name ||
                                        ""
                                      : chosen.display_name ||
                                        chosen.email ||
                                        "";
                                    setLookupEmail(nextVal);
                                    setSuggestionsOpen(false);
                                  } else {
                                    e.preventDefault();
                                    lookupMember();
                                  }
                                  return;
                                }
                                if (
                                  !suggestionsOpen ||
                                  emailSuggestions.length === 0
                                )
                                  return;
                                if (e.key === "ArrowDown") {
                                  e.preventDefault();
                                  setHighlightIndex(
                                    (prev) =>
                                      (prev + 1) % emailSuggestions.length,
                                  );
                                } else if (e.key === "ArrowUp") {
                                  e.preventDefault();
                                  setHighlightIndex(
                                    (prev) =>
                                      (prev - 1 + emailSuggestions.length) %
                                      emailSuggestions.length,
                                  );
                                }
                              }}
                            />
                            {suggestionsOpen && emailSuggestions.length > 0 && (
                              <div
                                className="absolute z-10 mt-1 w-full rounded-xl border border-stone-300 dark:border-[#3e3e42] bg-white dark:bg-[#252526] shadow-md max-h-60 overflow-auto"
                                role="listbox"
                              >
                                {emailSuggestions.map((s, idx) => (
                                  <button
                                    key={s.id}
                                    type="button"
                                    className={`w-full text-left px-3 py-2 text-sm rounded-xl ${idx === highlightIndex ? "bg-neutral-100 dark:bg-[#2d2d30]" : ""}`}
                                    role="option"
                                    aria-selected={idx === highlightIndex}
                                    onMouseEnter={() => setHighlightIndex(idx)}
                                    onMouseDown={(e) => {
                                      e.preventDefault();
                                      const typed = lookupEmail.trim();
                                      const nextVal = typed.includes("@")
                                        ? s.email || s.display_name || ""
                                        : s.display_name || s.email || "";
                                      setLookupEmail(nextVal);
                                      setSuggestionsOpen(false);
                                    }}
                                  >
                                    <div className="truncate">
                                      {s.display_name || s.email || ""}
                                    </div>
                                    {s.display_name &&
                                      s.email &&
                                      s.display_name !== s.email && (
                                        <div className="text-xs opacity-60 truncate">
                                          {s.email}
                                        </div>
                                      )}
                                  </button>
                                ))}
                                {suggestLoading && (
                                  <div className="px-3 py-2 text-xs opacity-60">
                                    Loading...
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                          <Button
                            className="rounded-2xl"
                            onClick={() => lookupMember()}
                            disabled={memberLoading || !lookupEmail}
                          >
                            <Search className="h-4 w-4" /> Lookup
                          </Button>
                        </div>
                        {memberError && (
                          <div className="text-sm text-rose-600">
                            {memberError}
                          </div>
                        )}
                        {memberLoading && (
                          <div className="space-y-3" aria-live="polite">
                            <div className="flex items-center gap-3">
                              <div className="h-12 w-12 rounded-full bg-neutral-200 animate-pulse" />
                              <div className="flex-1 space-y-2">
                                <div className="h-4 bg-neutral-200 rounded w-40 animate-pulse" />
                                <div className="h-3 bg-neutral-200 rounded w-60 animate-pulse" />
                              </div>
                            </div>
                            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                              {Array.from({ length: 6 }).map((_, i) => (
                                <div
                                  key={i}
                                  className="h-16 rounded-xl border bg-white animate-pulse"
                                />
                              ))}
                            </div>
                          </div>
                        )}
                        {!memberLoading && !memberError && !memberData && (
                          <div className="text-sm opacity-60">
                            Search for a member to see details.
                          </div>
                        )}
                        {memberData && (
                          <div className="space-y-4">
                            {(() => {
                              const nameOrEmail = (
                                memberData.profile?.display_name ||
                                memberData.user?.email ||
                                ""
                              ).trim();
                              const initial = (
                                nameOrEmail[0] || "-"
                              ).toUpperCase();
                              return (
                                <div className="flex items-start justify-between gap-3">
                                  <div className="flex items-center gap-3 min-w-0">
                                    <div className="h-14 w-14 rounded-full bg-emerald-600 dark:bg-emerald-500 text-white flex items-center justify-center font-semibold shadow-inner">
                                      {initial}
                                    </div>
                                    <div className="min-w-0">
                                      <div className="text-base md:text-lg font-semibold truncate">
                                        {memberData.profile?.display_name ||
                                          memberData.user?.email ||
                                          "-"}
                                      </div>
                                      <div className="text-xs opacity-70 truncate">
                                        {memberData.user?.email || "-"}
                                        {memberData.user?.id ? (
                                          <span className="opacity-60">
                                            {" "}
                                            ? id {memberData.user.id}
                                          </span>
                                        ) : null}
                                      </div>
                                      <div className="flex flex-wrap gap-1 mt-1 items-center">
                                        {/* Role Badges */}
                                      {memberRoles.map((role) => (
                                        <UserRoleBadge
                                          key={role}
                                          role={role}
                                          size="sm"
                                          showLabel
                                        />
                                      ))}
                                      {/* Add/Manage Roles Button */}
                                      <button
                                        type="button"
                                        onClick={() => setRolesOpen(!rolesOpen)}
                                        className={cn(
                                          "inline-flex items-center justify-center h-5 w-5 rounded-full border-2 border-dashed transition-all",
                                          rolesOpen 
                                            ? "border-emerald-500 bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400" 
                                            : "border-stone-300 dark:border-stone-600 text-stone-400 dark:text-stone-500 hover:border-stone-400 dark:hover:border-stone-500 hover:text-stone-500 dark:hover:text-stone-400"
                                        )}
                                        title={rolesOpen ? "Close role management" : "Manage roles"}
                                      >
                                        <Plus className={cn("h-3 w-3 transition-transform", rolesOpen && "rotate-45")} />
                                      </button>
                                      {(() => {
                                        const level =
                                          typeof memberData.threatLevel ===
                                          "number"
                                            ? memberData.threatLevel
                                            : 0;
                                        const meta =
                                          THREAT_LEVEL_META[level] ||
                                          THREAT_LEVEL_META[0];
                                        return (
                                          <button
                                            type="button"
                                            onClick={() => setThreatLevelOpen(!threatLevelOpen)}
                                            className={cn(
                                              "rounded-full px-2 py-0.5 text-[11px] font-semibold inline-flex items-center gap-1 cursor-pointer hover:ring-2 hover:ring-offset-1 transition-all",
                                              meta.badge,
                                              threatLevelOpen && "ring-2 ring-offset-1"
                                            )}
                                            title="Click to modify threat level"
                                          >
                                            <Shield className="h-3 w-3" />
                                            Lvl {level} - {meta.label}
                                          </button>
                                        );
                                      })()}
                                      {memberData.isBannedEmail && (
                                        <Badge
                                          variant="destructive"
                                          className="rounded-full px-2 py-0.5"
                                          >
                                            Banned
                                          </Badge>
                                        )}
                                        {memberData.lastOnlineAt && (
                                          <Badge
                                            variant="outline"
                                            className="rounded-full px-2 py-0.5"
                                          >
                                            Last online{" "}
                                            {new Date(
                                              memberData.lastOnlineAt,
                                            ).toLocaleString()}
                                          </Badge>
                                        )}
                                        {(memberData as Record<string, unknown>)?.lastCountry && (
                                          <Badge
                                            variant="outline"
                                            className="rounded-full px-2 py-0.5"
                                          >
                                            {countryCodeToName(
                                              String((memberData as Record<string, unknown>).lastCountry),
                                            )}
                                          </Badge>
                                        )}
                                        {(memberData as Record<string, unknown>)?.lastReferrer && (
                                          <Badge
                                            variant="outline"
                                            className="rounded-full px-2 py-0.5"
                                          >
                                            Referrer{" "}
                                            {String((memberData as Record<string, unknown>).lastReferrer)}
                                          </Badge>
                                        )}
                                        {memberData.user?.created_at && (
                                          <Badge
                                            variant="outline"
                                            className="rounded-full px-2 py-0.5"
                                          >
                                            Joined{" "}
                                            {new Date(
                                              memberData.user.created_at,
                                            ).toLocaleDateString()}
                                          </Badge>
                                        )}
                                      </div>
                                    </div>
                                  </div>
                                  <div className="flex items-center gap-2">
                                    {memberData.profile?.display_name && (
                                      <Button
                                        variant="secondary"
                                        size="icon"
                                        className="rounded-xl"
                                        title="View profile"
                                        aria-label="View profile"
                                        onClick={() =>
                                          navigate(
                                            `/u/${encodeURIComponent(memberData.profile.display_name)}`,
                                          )
                                        }
                                      >
                                        <ArrowUpRight className="h-4 w-4" />
                                      </Button>
                                    )}
                                    {memberData.profile?.is_admin ? (
                                      <Dialog
                                        open={demoteOpen}
                                        onOpenChange={setDemoteOpen}
                                      >
                                        <DialogTrigger asChild>
                                          <Button
                                            variant="destructive"
                                            size="icon"
                                            className="rounded-xl"
                                            title="Remove admin"
                                            aria-label="Remove admin"
                                            disabled={!lookupEmail}
                                          >
                                            <ShieldX className="h-4 w-4" />
                                          </Button>
                                        </DialogTrigger>
                                        <DialogContent>
                                          <DialogHeader>
                                            <DialogTitle>
                                              Remove admin from{" "}
                                              {lookupEmail || "user"}
                                            </DialogTitle>
                                            <DialogDescription>
                                              This will revoke administrative
                                              privileges and make the user a
                                              normal member.
                                            </DialogDescription>
                                          </DialogHeader>
                                          <DialogFooter>
                                            <DialogClose asChild>
                                              <Button variant="secondary">
                                                Cancel
                                              </Button>
                                            </DialogClose>
                                            <Button
                                              variant="destructive"
                                              onClick={performDemote}
                                              disabled={
                                                !lookupEmail || demoteSubmitting
                                              }
                                            >
                                              {demoteSubmitting
                                                ? "Removing?"
                                                : "Confirm remove"}
                                            </Button>
                                          </DialogFooter>
                                        </DialogContent>
                                      </Dialog>
                                    ) : (
                                      <Dialog
                                        open={promoteOpen}
                                        onOpenChange={setPromoteOpen}
                                      >
                                        <DialogTrigger asChild>
                                          <Button
                                            variant="secondary"
                                            size="icon"
                                            className="rounded-xl"
                                            title="Promote to admin"
                                            aria-label="Promote to admin"
                                            disabled={!lookupEmail}
                                          >
                                            <ShieldCheck className="h-4 w-4" />
                                          </Button>
                                        </DialogTrigger>
                                        <DialogContent>
                                          <DialogHeader>
                                            <DialogTitle>
                                              Promote {lookupEmail || "user"} to
                                              Admin
                                            </DialogTitle>
                                            <DialogDescription>
                                              This grants full administrative
                                              privileges. Are you sure?
                                            </DialogDescription>
                                          </DialogHeader>
                                          <DialogFooter>
                                            <DialogClose asChild>
                                              <Button variant="secondary">
                                                Cancel
                                              </Button>
                                            </DialogClose>
                                            <Button
                                              onClick={performPromote}
                                              disabled={
                                                !lookupEmail ||
                                                promoteSubmitting
                                              }
                                            >
                                              {promoteSubmitting
                                                ? "Promoting?"
                                                : "Confirm promote"}
                                            </Button>
                                          </DialogFooter>
                                        </DialogContent>
                                      </Dialog>
                                    )}
                                    <Dialog
                                      open={banOpen}
                                      onOpenChange={setBanOpen}
                                    >
                                      <DialogTrigger asChild>
                                        <Button
                                          variant="destructive"
                                          size="icon"
                                          className="rounded-xl"
                                          title="Ban user"
                                          aria-label="Ban user"
                                          disabled={!lookupEmail}
                                        >
                                          <Gavel className="h-4 w-4" />
                                        </Button>
                                      </DialogTrigger>
                                      <DialogContent>
                                        <DialogHeader>
                                          <DialogTitle>
                                            Ban {lookupEmail || "user"}
                                          </DialogTitle>
                                          <DialogDescription>
                                            This will delete the account and ban
                                            all known IPs for this user.
                                          </DialogDescription>
                                        </DialogHeader>
                                        <div className="grid gap-2 mt-2">
                                          <label
                                            htmlFor="ban-reason"
                                            className="text-xs opacity-60"
                                          >
                                            Reason
                                          </label>
                                          <Textarea
                                            id="ban-reason"
                                            name="ban-reason"
                                            className="min-h-[100px]"
                                            placeholder="Reason for ban"
                                            value={banReason}
                                            onChange={(e) =>
                                              setBanReason(e.target.value)
                                            }
                                          />
                                        </div>
                                        <DialogFooter>
                                          <DialogClose asChild>
                                            <Button variant="secondary">
                                              Cancel
                                            </Button>
                                          </DialogClose>
                                          <Button
                                            variant="destructive"
                                            onClick={performBan}
                                            disabled={
                                              !lookupEmail || banSubmitting
                                            }
                                          >
                                            {banSubmitting
                                              ? "Banning?"
                                              : "Confirm ban"}
                                          </Button>
                                        </DialogFooter>
                                      </DialogContent>
                                    </Dialog>
                                  </div>
                                </div>
                              );
                            })()}

                            {/* Threat Level Section - Collapsible, opens on badge click */}
                            {threatLevelOpen && (
                              <div className="rounded-xl border border-stone-200 dark:border-[#3e3e42] bg-white dark:bg-[#1e1e20] overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">
                                {/* Header */}
                                <div 
                                  className="px-4 py-3 bg-gradient-to-r from-stone-50 to-stone-100 dark:from-[#252526] dark:to-[#2d2d30] border-b border-stone-200 dark:border-[#3e3e42] cursor-pointer"
                                  onClick={() => setThreatLevelOpen(false)}
                                >
                                  <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                      <Shield className="h-4 w-4 text-stone-600 dark:text-stone-400" />
                                      <span className="text-sm font-semibold">Change Threat Level</span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                      {(() => {
                                        const currentLevel = typeof memberData.threatLevel === "number" ? memberData.threatLevel : 0;
                                        const meta = THREAT_LEVEL_META[currentLevel] || THREAT_LEVEL_META[0];
                                        return (
                                          <span className={cn("rounded-full px-2.5 py-1 text-[11px] font-semibold", meta.badge)}>
                                            Level {currentLevel} – {meta.label}
                                          </span>
                                        );
                                      })()}
                                      <ChevronDown className="h-4 w-4 text-stone-500 rotate-180" />
                                    </div>
                                  </div>
                                  {memberData.threatLevel === 3 && (memberData.bannedByName || memberData.bannedAt) && (
                                    <div className="mt-2 text-xs text-stone-500 dark:text-stone-400 flex items-center gap-1.5">
                                      <Ban className="h-3 w-3" />
                                      Banned by {memberData.bannedByName || "admin"}
                                      {memberData.bannedAt ? ` on ${new Date(memberData.bannedAt).toLocaleString()}` : ""}
                                    </div>
                                  )}
                                </div>
                                
                                {/* Threat Level Cards */}
                                <div className="p-4 space-y-3">
                                  <div className="grid grid-cols-2 gap-2">
                                    {([0, 1, 2, 3] as const).map((level) => {
                                      const meta = THREAT_LEVEL_META[level];
                                      const isSelected = threatLevelSelection === level;
                                      const isCurrent = memberData.threatLevel === level;
                                      const ThreatIcon = level === 0 ? CircleCheck : level === 1 ? AlertTriangle : level === 2 ? ShieldAlert : Ban;
                                      
                                      return (
                                        <button
                                          key={level}
                                          type="button"
                                          onClick={() => {
                                            if (level === 3 && level !== threatLevelSelection) {
                                              setPendingThreatLevel(3);
                                              setThreatLevelConfirmOpen(true);
                                            } else {
                                              setThreatLevelSelection(level);
                                            }
                                          }}
                                          className={cn(
                                            "relative p-3 rounded-xl border-2 text-left transition-all",
                                            isSelected 
                                              ? `${meta.cardBg} ${meta.cardBorder} ring-2 ring-offset-1 ring-offset-white dark:ring-offset-[#1e1e20]`
                                              : "border-stone-200 dark:border-[#3e3e42] hover:border-stone-300 dark:hover:border-[#4e4e52] bg-white dark:bg-[#252526]",
                                            isSelected && level === 0 && "ring-emerald-400",
                                            isSelected && level === 1 && "ring-amber-400",
                                            isSelected && level === 2 && "ring-red-400",
                                            isSelected && level === 3 && "ring-stone-600"
                                          )}
                                        >
                                          {isCurrent && (
                                            <div className="absolute -top-1.5 -right-1.5 bg-blue-500 text-white text-[9px] font-bold px-1.5 py-0.5 rounded-full uppercase tracking-wide">
                                              Current
                                            </div>
                                          )}
                                          <div className="flex items-start gap-2">
                                            <div className={cn(
                                              "p-1.5 rounded-lg",
                                              isSelected ? meta.cardBg : "bg-stone-100 dark:bg-[#2d2d30]"
                                            )}>
                                              <ThreatIcon className={cn("h-4 w-4", isSelected ? meta.iconColor : "text-stone-500 dark:text-stone-400")} />
                                            </div>
                                            <div className="min-w-0 flex-1">
                                              <div className="flex items-center gap-1.5">
                                                <span className={cn(
                                                  "text-sm font-semibold",
                                                  level === 3 && isSelected && "text-white"
                                                )}>
                                                  {meta.label}
                                                </span>
                                                <span className={cn(
                                                  "text-[10px] opacity-60 font-medium",
                                                  level === 3 && isSelected && "text-white/70"
                                                )}>
                                                  Lvl {level}
                                                </span>
                                              </div>
                                              <p className={cn(
                                                "text-[11px] leading-tight mt-0.5 line-clamp-2",
                                                level === 3 && isSelected ? "text-white/80" : "text-stone-500 dark:text-stone-400"
                                              )}>
                                                {meta.text}
                                              </p>
                                            </div>
                                          </div>
                                          {isSelected && (
                                            <div className="absolute bottom-2 right-2">
                                              <Check className={cn("h-4 w-4", level === 3 ? "text-white" : meta.iconColor)} />
                                            </div>
                                          )}
                                        </button>
                                      );
                                    })}
                                  </div>
                                  
                                  {/* Update Button */}
                                  <div className="flex items-center gap-2 pt-2 border-t border-stone-100 dark:border-[#3e3e42]">
                                    <Button
                                      onClick={handleSetThreatLevel}
                                      disabled={threatLevelUpdating || !memberData?.user?.id || threatLevelSelection === memberData.threatLevel}
                                      className={cn(
                                        "flex-1 rounded-xl transition-all",
                                        threatLevelSelection === 3 
                                          ? "bg-red-600 hover:bg-red-700 text-white" 
                                          : threatLevelSelection === memberData.threatLevel 
                                            ? "bg-stone-200 text-stone-500 dark:bg-stone-700 dark:text-stone-400"
                                            : ""
                                      )}
                                    >
                                      {threatLevelUpdating ? (
                                        <>
                                          <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                                          Updating...
                                        </>
                                      ) : threatLevelSelection === memberData.threatLevel ? (
                                        "No changes"
                                      ) : threatLevelSelection === 3 ? (
                                        <>
                                          <Ban className="h-4 w-4 mr-2" />
                                          Set to Banned
                                        </>
                                      ) : (
                                        <>
                                          <Shield className="h-4 w-4 mr-2" />
                                          Update Threat Level
                                        </>
                                      )}
                                    </Button>
                                  </div>
                                </div>
                              </div>
                            )}
                            
                            {/* Ban Confirmation Dialog */}
                            <Dialog open={threatLevelConfirmOpen} onOpenChange={setThreatLevelConfirmOpen}>
                              <DialogContent className="max-w-md">
                                <DialogHeader>
                                  <DialogTitle className="flex items-center gap-2 text-red-600 dark:text-red-400">
                                    <Ban className="h-5 w-5" />
                                    Confirm Ban Level
                                  </DialogTitle>
                                  <DialogDescription className="space-y-3 pt-2">
                                    <p>
                                      You are about to set the threat level to <strong className="text-red-600">Banned</strong> for{" "}
                                      <span className="font-medium text-stone-900 dark:text-stone-100">
                                        {memberData?.profile?.display_name || memberData?.user?.email || "this user"}
                                      </span>.
                                    </p>
                                    <div className="rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 p-3">
                                      <div className="flex items-start gap-2">
                                        <AlertTriangle className="h-4 w-4 text-red-600 dark:text-red-400 mt-0.5 shrink-0" />
                                        <div className="text-xs text-red-800 dark:text-red-200">
                                          <strong>This action will:</strong>
                                          <ul className="mt-1 ml-3 list-disc space-y-0.5">
                                            <li>Mark the user as permanently banned</li>
                                            <li>Restrict their access to platform features</li>
                                            <li>Record this action in admin logs</li>
                                          </ul>
                                        </div>
                                      </div>
                                    </div>
                                  </DialogDescription>
                                </DialogHeader>
                                <DialogFooter className="gap-2 sm:gap-0">
                                  <DialogClose asChild>
                                    <Button variant="secondary" className="rounded-xl">
                                      Cancel
                                    </Button>
                                  </DialogClose>
                                  <Button
                                    variant="destructive"
                                    onClick={() => {
                                      if (pendingThreatLevel !== null) {
                                        setThreatLevelSelection(pendingThreatLevel);
                                      }
                                      setThreatLevelConfirmOpen(false);
                                      setPendingThreatLevel(null);
                                    }}
                                    className="rounded-xl"
                                  >
                                    <Ban className="h-4 w-4 mr-2" />
                                    Confirm Ban Level
                                  </Button>
                                </DialogFooter>
                              </DialogContent>
                            </Dialog>

                            {/* Bug Catcher Stats Card - Only shown for bug_catcher role */}
                            {memberRoles.includes('bug_catcher' as UserRole) && (
                              <div className="rounded-xl border-2 border-orange-200 dark:border-orange-800/50 overflow-hidden bg-gradient-to-r from-orange-50 to-amber-50 dark:from-orange-900/20 dark:to-amber-900/20">
                                <div className="px-4 py-3 flex items-center gap-2 border-b border-orange-200/50 dark:border-orange-800/30">
                                  <Bug className="h-4 w-4 text-orange-600 dark:text-orange-400" />
                                  <span className="text-sm font-semibold text-orange-800 dark:text-orange-200">Bug Catcher Stats</span>
                                </div>
                                <div className="p-4 flex items-center justify-around gap-4">
                                  {/* Bug Points */}
                                  <div className="text-center">
                                    <div className="flex items-center justify-center gap-1.5 mb-1">
                                      <Zap className="h-5 w-5 text-orange-500" />
                                      <span className="text-2xl font-bold text-orange-700 dark:text-orange-300 tabular-nums">
                                        {typeof memberData.bugPoints === 'number' ? memberData.bugPoints : 0}
                                      </span>
                                    </div>
                                    <div className="text-xs text-orange-600/70 dark:text-orange-400/70 font-medium">Bug Points</div>
                                  </div>
                                  
                                  {/* Divider */}
                                  <div className="h-10 w-px bg-orange-200 dark:bg-orange-700/50" />
                                  
                                  {/* Rank */}
                                  <div className="text-center">
                                    <div className="flex items-center justify-center gap-1.5 mb-1">
                                      <Trophy className="h-5 w-5 text-amber-500" />
                                      <span className="text-2xl font-bold text-amber-700 dark:text-amber-300 tabular-nums">
                                        {typeof memberData.bugCatcherRank === 'number' && memberData.bugCatcherRank > 0 ? `#${memberData.bugCatcherRank}` : '-'}
                                      </span>
                                    </div>
                                    <div className="text-xs text-amber-600/70 dark:text-amber-400/70 font-medium">Rank</div>
                                  </div>
                                  
                                  {/* Divider */}
                                  <div className="h-10 w-px bg-orange-200 dark:bg-orange-700/50" />
                                  
                                  {/* Actions Completed - Clickable */}
                                  <button
                                    type="button"
                                    onClick={() => setBugActionsDialogOpen(true)}
                                    className="text-center p-2 -m-2 rounded-xl hover:bg-emerald-100/50 dark:hover:bg-emerald-900/30 transition-colors cursor-pointer"
                                    disabled={!memberData.bugActionsCompleted}
                                  >
                                    <div className="flex items-center justify-center gap-1.5 mb-1">
                                      <CheckCircle2 className="h-5 w-5 text-emerald-500" />
                                      <span className="text-2xl font-bold text-emerald-700 dark:text-emerald-300 tabular-nums">
                                        {typeof memberData.bugActionsCompleted === 'number' ? memberData.bugActionsCompleted : 0}
                                      </span>
                                    </div>
                                    <div className="text-xs text-emerald-600/70 dark:text-emerald-400/70 font-medium">
                                      Actions
                                      {(memberData.bugActionsCompleted || 0) > 0 && (
                                        <span className="ml-1 opacity-60">(click to view)</span>
                                      )}
                                    </div>
                                  </button>
                                </div>
                              </div>
                            )}

                            {/* Bug Catcher Completed Actions Dialog */}
                            <Dialog open={bugActionsDialogOpen} onOpenChange={setBugActionsDialogOpen}>
                              <DialogContent className="max-w-2xl max-h-[80vh] overflow-hidden flex flex-col">
                                <DialogHeader>
                                  <DialogTitle className="flex items-center gap-2">
                                    <Bug className="h-5 w-5 text-orange-500" />
                                    Completed Actions
                                    <Badge variant="secondary" className="ml-2 bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300">
                                      {memberData?.bugCompletedActions?.length || 0}
                                    </Badge>
                                  </DialogTitle>
                                  <DialogDescription>
                                    Actions completed by {memberData?.profile?.display_name || 'this user'}
                                  </DialogDescription>
                                </DialogHeader>
                                
                                <div className="flex-1 overflow-y-auto space-y-4 pr-2">
                                  {(!memberData?.bugCompletedActions || memberData.bugCompletedActions.length === 0) ? (
                                    <div className="text-center py-8 text-stone-500">
                                      <CheckCircle2 className="h-12 w-12 mx-auto mb-3 opacity-30" />
                                      <p>No completed actions yet</p>
                                    </div>
                                  ) : (
                                    memberData.bugCompletedActions.map((action) => (
                                      <div
                                        key={action.id}
                                        className="rounded-xl border border-stone-200 dark:border-[#3e3e42] overflow-hidden"
                                      >
                                        {/* Action Header */}
                                        <div className="px-4 py-3 bg-stone-50 dark:bg-[#252526] border-b border-stone-200 dark:border-[#3e3e42]">
                                          <div className="flex items-start justify-between gap-3">
                                            <div className="flex-1 min-w-0">
                                              <h4 className="font-semibold text-sm truncate">{action.title}</h4>
                                              {action.description && (
                                                <p className="text-xs text-stone-500 dark:text-stone-400 mt-0.5 line-clamp-2">{action.description}</p>
                                              )}
                                            </div>
                                            <div className="flex items-center gap-2 shrink-0">
                                              <Badge className="bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300">
                                                +{action.pointsEarned} pts
                                              </Badge>
                                              {action.actionStatus === 'closed' && (
                                                <Badge variant="secondary" className="text-stone-500">Closed</Badge>
                                              )}
                                            </div>
                                          </div>
                                          <div className="text-xs text-stone-400 mt-2">
                                            Completed {action.completedAt ? new Date(action.completedAt).toLocaleString() : 'Unknown date'}
                                          </div>
                                        </div>
                                        
                                        {/* Action Answers */}
                                        {action.questions && action.questions.length > 0 && (
                                          <div className="p-4 space-y-3">
                                            <div className="text-xs font-semibold text-stone-500 dark:text-stone-400 uppercase tracking-wide">
                                              Answers
                                            </div>
                                            {action.questions.map((question) => {
                                              const answer = action.answers[question.id];
                                              return (
                                                <div key={question.id} className="space-y-1">
                                                  <div className="text-sm font-medium flex items-center gap-1.5">
                                                    {question.title}
                                                    {question.required && <span className="text-red-500 text-xs">*</span>}
                                                  </div>
                                                  <div className="text-sm bg-stone-100 dark:bg-[#1e1e1e] rounded-lg px-3 py-2 break-words">
                                                    {answer === undefined || answer === null || answer === '' ? (
                                                      <span className="text-stone-400 italic">No answer provided</span>
                                                    ) : typeof answer === 'boolean' ? (
                                                      <span className={answer ? 'text-emerald-600' : 'text-red-500'}>
                                                        {answer ? 'Yes' : 'No'}
                                                      </span>
                                                    ) : (
                                                      String(answer)
                                                    )}
                                                  </div>
                                                </div>
                                              );
                                            })}
                                          </div>
                                        )}
                                        
                                        {/* No questions case */}
                                        {(!action.questions || action.questions.length === 0) && (
                                          <div className="p-4 text-sm text-stone-500 italic">
                                            This action had no questions to answer
                                          </div>
                                        )}
                                      </div>
                                    ))
                                  )}
                                </div>
                              </DialogContent>
                            </Dialog>

                            {/* Roles Management Section - Only shown when rolesOpen is true */}
                            {rolesOpen && (
                              <div className="rounded-xl border border-stone-200 dark:border-[#3e3e42] overflow-hidden bg-white dark:bg-[#1e1e1e] animate-in fade-in slide-in-from-top-2 duration-200">
                                {/* Header */}
                                <div 
                                  className="flex items-center justify-between px-4 py-3 bg-gradient-to-r from-stone-50 to-stone-100 dark:from-[#252526] dark:to-[#2d2d30] cursor-pointer"
                                  onClick={() => setRolesOpen(false)}
                                >
                                  <div className="flex items-center gap-2">
                                    <ShieldCheck className="h-4 w-4 text-stone-600 dark:text-stone-400" />
                                    <span className="text-sm font-medium">Manage User Roles</span>
                                    <span className="text-xs px-1.5 py-0.5 rounded-full bg-stone-200 dark:bg-stone-700 text-stone-600 dark:text-stone-300">
                                      {memberRoles.length} active
                                    </span>
                                  </div>
                                  <ChevronDown className="h-4 w-4 text-stone-500 rotate-180" />
                                </div>
                                
                                {/* Role Cards Grid */}
                                <div className="p-4 space-y-3">
                                  {/* Active Roles Summary */}
                                  {memberRoles.length > 0 && (
                                    <div className="flex flex-wrap gap-1.5 pb-3 border-b border-stone-100 dark:border-[#3e3e42]">
                                      {memberRoles.map((role) => (
                                        <UserRoleBadge key={role} role={role} size="sm" showLabel />
                                      ))}
                                    </div>
                                  )}
                                  
                                  {/* Role Toggle Cards */}
                                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                    {ADMIN_ASSIGNABLE_ROLES.map((role) => {
                                      const config = ROLE_CONFIG[role];
                                      const isActive = memberRoles.includes(role);
                                      const isLoading = roleSubmitting === role;
                                      
                                      return (
                                        <div
                                          key={role}
                                          className={`relative rounded-xl border-2 p-3 transition-all ${
                                            isActive 
                                              ? `${config.borderColor} ${config.darkBorderColor} ${config.bgColor} ${config.darkBgColor}` 
                                              : "border-stone-200 dark:border-[#3e3e42] hover:border-stone-300 dark:hover:border-[#4e4e52]"
                                          }`}
                                        >
                                          <div className="flex items-start justify-between gap-2">
                                            <div className="flex items-start gap-2 min-w-0">
                                              <UserRoleBadge role={role} size="md" />
                                              <div className="min-w-0">
                                                <div className="text-sm font-medium truncate">{config.label}</div>
                                                <div className="text-[11px] opacity-60 leading-tight">{config.description}</div>
                                              </div>
                                            </div>
                                            
                                            {/* Toggle Button */}
                                            <button
                                              type="button"
                                              onClick={() => isActive ? removeRole(role) : addRole(role)}
                                              disabled={isLoading}
                                              className={`shrink-0 relative w-11 h-6 rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 ${
                                                isActive 
                                                  ? "bg-emerald-500 focus:ring-emerald-500" 
                                                  : "bg-stone-300 dark:bg-stone-600 focus:ring-stone-400"
                                              } ${isLoading ? "opacity-50 cursor-wait" : ""}`}
                                              aria-label={isActive ? `Remove ${config.label} role` : `Add ${config.label} role`}
                                            >
                                              <span
                                                className={`absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white shadow-sm transition-transform flex items-center justify-center ${
                                                  isActive ? "translate-x-5" : "translate-x-0"
                                                }`}
                                              >
                                                {isLoading && (
                                                  <RefreshCw className="h-3 w-3 animate-spin text-stone-400" />
                                                )}
                                              </span>
                                            </button>
                                          </div>
                                          
                                          {/* Admin Warning Badge */}
                                          {role === USER_ROLES.ADMIN && (
                                            <div className="mt-2 flex items-center gap-1 text-[10px] text-amber-600 dark:text-amber-400">
                                              <AlertTriangle className="h-3 w-3" />
                                              <span>Full system access</span>
                                            </div>
                                          )}
                                        </div>
                                      );
                                    })}
                                  </div>
                                  
                                  {/* Plus Role Notice */}
                                  <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-stone-50 dark:bg-[#252526] text-[11px] text-stone-500 dark:text-stone-400">
                                    <Info className="h-3.5 w-3.5 shrink-0" />
                                    <span>
                                      <strong>Plus</strong> role is assigned automatically through paid subscriptions.
                                      {memberRoles.includes(USER_ROLES.PLUS) && (
                                        <span className="ml-1 text-emerald-600 dark:text-emerald-400">✓ Active subscriber</span>
                                      )}
                                    </span>
                                  </div>
                                </div>
                              </div>
                            )}
                            
                            {/* Confirm Admin Role Dialog */}
                            <Dialog open={confirmAdminOpen} onOpenChange={setConfirmAdminOpen}>
                              <DialogContent>
                                <DialogHeader>
                                  <DialogTitle className="flex items-center gap-2">
                                    <ShieldCheck className="h-5 w-5 text-purple-600" />
                                    Grant Admin Access
                                  </DialogTitle>
                                  <DialogDescription className="space-y-3 pt-2">
                                    <p>
                                      You are about to grant <strong>full administrative privileges</strong> to{" "}
                                      <span className="font-medium text-stone-900 dark:text-stone-100">
                                        {memberData?.profile?.display_name || memberData?.user?.email || "this user"}
                                      </span>.
                                    </p>
                                    <div className="rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 p-3">
                                      <div className="flex items-start gap-2">
                                        <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400 mt-0.5 shrink-0" />
                                        <div className="text-xs text-amber-800 dark:text-amber-200">
                                          <strong>Admin users can:</strong>
                                          <ul className="mt-1 ml-3 list-disc space-y-0.5">
                                            <li>Access and modify all user data</li>
                                            <li>Create, edit, and delete plants</li>
                                            <li>Manage all system settings</li>
                                            <li>Grant or revoke roles for other users</li>
                                            <li>Ban users and manage content</li>
                                          </ul>
                                        </div>
                                      </div>
                                    </div>
                                  </DialogDescription>
                                </DialogHeader>
                                <DialogFooter className="gap-2 sm:gap-0">
                                  <DialogClose asChild>
                                    <Button variant="secondary" className="rounded-xl">
                                      Cancel
                                    </Button>
                                  </DialogClose>
                                  <Button
                                    onClick={confirmAddAdmin}
                                    disabled={roleSubmitting === USER_ROLES.ADMIN}
                                    className="rounded-xl bg-purple-600 hover:bg-purple-700 text-white"
                                  >
                                    {roleSubmitting === USER_ROLES.ADMIN ? (
                                      <>
                                        <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                                        Granting...
                                      </>
                                    ) : (
                                      <>
                                        <ShieldCheck className="h-4 w-4 mr-2" />
                                        Confirm Grant Admin
                                      </>
                                    )}
                                  </Button>
                                </DialogFooter>
                              </DialogContent>
                            </Dialog>

                            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                              <div className="rounded-xl border p-3 text-center">
                                <div className="text-[11px] opacity-60">
                                  Visits
                                </div>
                                <div className="text-base font-semibold tabular-nums">
                                  {memberData.visitsCount ?? "-"}
                                </div>
                              </div>

                              <div className="rounded-xl border p-3 text-center">
                                <div className="text-[11px] opacity-60">
                                  Total plants
                                </div>
                                <div className="text-base font-semibold tabular-nums">
                                  {memberData.plantsTotal ?? "-"}
                                </div>
                              </div>
                              <div className="rounded-xl border p-3 text-center">
                                <div className="text-[11px] opacity-60">
                                  Scans total
                                </div>
                                <div className="text-base font-semibold tabular-nums">
                                  {memberData.scansTotal ?? "-"}
                                </div>
                              </div>
                              <div className="rounded-xl border p-3 text-center">
                                <div className="text-[11px] opacity-60">
                                  Scans this month
                                </div>
                                <div className="text-base font-semibold tabular-nums">
                                  {memberData.scansThisMonth ?? "-"}
                                </div>
                              </div>
                              <div className="rounded-xl border p-3 text-center">
                                <div className="text-[11px] opacity-60">
                                  Last IP
                                </div>
                                <div
                                  className="text-base font-semibold tabular-nums truncate"
                                  title={
                                    memberData.lastIp ||
                                    (memberData.ips && memberData.ips.length > 0
                                      ? memberData.ips[0]
                                      : undefined) ||
                                    undefined
                                  }
                                >
                                  {memberData.lastIp ||
                                    (memberData.ips && memberData.ips.length > 0
                                      ? memberData.ips[0]
                                      : null) ||
                                    "-"}
                                </div>
                              </div>
                              <div className="rounded-xl border p-3 text-center">
                                <div className="text-[11px] opacity-60">
                                  Mean RPM (5m)
                                </div>
                                <div className="text-base font-semibold tabular-nums">
                                  {typeof memberData.meanRpm5m === "number"
                                    ? memberData.meanRpm5m.toFixed(2)
                                    : "-"}
                                </div>
                              </div>
                              <div className="rounded-xl border p-3">
                                <div className="text-[11px] opacity-60 mb-1">
                                  Top referrers
                                </div>
                                {!memberData.topReferrers ||
                                memberData.topReferrers.length === 0 ? (
                                  <div className="text-xs opacity-60">?</div>
                                ) : (
                                  <div className="space-y-0.5">
                                    {memberData.topReferrers
                                      .slice(0, 1)
                                      .map((r, idx) => (
                                        <div
                                          key={`${r.source}-${idx}`}
                                          className="flex items-center justify-between text-sm"
                                        >
                                          <div className="truncate mr-2">
                                            {r.source || "direct"}
                                          </div>
                                          <div className="tabular-nums">
                                            {r.visits}
                                          </div>
                                        </div>
                                      ))}
                                  </div>
                                )}
                              </div>
                              <div className="rounded-xl border p-3">
                                <div className="text-[11px] opacity-60 mb-1">
                                  Top countries
                                </div>
                                {!memberData.topCountries ||
                                memberData.topCountries.length === 0 ? (
                                  <div className="text-xs opacity-60">-</div>
                                ) : (
                                  <div className="space-y-0.5">
                                    {memberData.topCountries
                                      .slice(0, 1)
                                      .map((c, idx) => (
                                        <div
                                          key={`${c.country}-${idx}`}
                                          className="flex items-center justify-between text-sm"
                                        >
                                          <div className="truncate mr-2">
                                            {countryCodeToName(c.country)}
                                          </div>
                                          <div className="tabular-nums">
                                            {c.visits}
                                          </div>
                                        </div>
                                      ))}
                                  </div>
                                )}
                              </div>
                              <div className="rounded-xl border p-3">
                                <div className="text-[11px] opacity-60 mb-1">
                                  Top devices
                                </div>
                                {!memberData.topDevices ||
                                memberData.topDevices.length === 0 ? (
                                  <div className="text-xs opacity-60">-</div>
                                ) : (
                                  <div className="space-y-0.5">
                                    {memberData.topDevices
                                      .slice(0, 1)
                                      .map((d, idx) => (
                                        <div
                                          key={`${d.device}-${idx}`}
                                          className="flex items-center justify-between text-sm"
                                        >
                                          <div className="truncate mr-2">
                                            {d.device}
                                          </div>
                                          <div className="tabular-nums">
                                            {d.visits}
                                          </div>
                                        </div>
                                      ))}
                                  </div>
                                )}
                              </div>
                            </div>

                            <div className="space-y-1">
                              <div className="text-xs font-medium uppercase tracking-wide opacity-60">
                                Known IPs
                              </div>
                              <div className="text-xs opacity-60">
                                Unique IPs:{" "}
                                <span className="tabular-nums">
                                  {memberData.ips.length}
                                </span>
                              </div>
                              <div className="flex flex-wrap gap-1">
                                {memberData.ips.map((ip) => (
                                  <Badge
                                    key={ip}
                                    role="button"
                                    tabIndex={0}
                                    onClick={() => jumpToIpLookup(ip)}
                                    onKeyDown={(e) => {
                                      if (e.key === "Enter" || e.key === " ") {
                                        e.preventDefault();
                                        jumpToIpLookup(ip);
                                      }
                                    }}
                                    title={`Lookup members for ? ${ip}`}
                                    aria-label={`Lookup members for ? ${ip}`}
                                    variant="outline"
                                    className="rounded-full cursor-pointer hover:bg-stone-50 focus:outline-none focus:ring-2 focus:ring-ring"
                                  >
                                    {ip}
                                  </Badge>
                                ))}
                                {memberData.ips.length === 0 && (
                                  <div className="text-xs opacity-60">
                                    No IPs recorded
                                  </div>
                                )}
                              </div>
                            </div>

                            <Card className={glassCardClass}>
                              <CardContent className="p-4">
                                <div className="flex items-center justify-between gap-2 mb-2">
                                  <div>
                                    <div className="text-sm font-medium">
                                      Visits - last 30 days
                                    </div>
                                    <div className="text-xs opacity-60">
                                      {memberVisitsUpdatedAt
                                        ? `Updated ? ${formatTimeAgo(memberVisitsUpdatedAt)}`
                                        : "Updated -"}
                                    </div>
                                  </div>
                                  <Button
                                    variant="outline"
                                    size="icon"
                                    aria-label="Refresh visits"
                                    onClick={() => {
                                      if (memberData?.user?.id)
                                        loadMemberVisitsSeries(
                                          memberData.user.id,
                                          { initial: true },
                                        );
                                    }}
                                    disabled={
                                      memberVisitsLoading ||
                                      !memberData?.user?.id
                                    }
                                    className="h-8 w-8 rounded-xl border bg-white text-black hover:bg-stone-50"
                                  >
                                    <RefreshCw
                                      className={`h-4 w-4 ? ${memberVisitsLoading ? "animate-spin" : ""}`}
                                    />
                                  </Button>
                                </div>

                                {memberVisitsLoading ? (
                                  <div className="text-sm opacity-60">
                                    Loading...
                                  </div>
                                ) : memberVisitsSeries.length === 0 ? (
                                  <div className="text-sm opacity-60">
                                    {memberVisitsWarning
                                      ? `Data unavailable: ${memberVisitsWarning}`
                                      : "No data yet."}
                                  </div>
                                ) : (
                                  (() => {
                                    const values = memberVisitsSeries.map(
                                      (d) => d.visits,
                                    );
                                    const maxVal = Math.max(...values, 1);
                                    const avgVal = Math.round(
                                      values.reduce((a, b) => a + b, 0) /
                                        values.length,
                                    );
                                    const formatShort = (iso: string) => {
                                      try {
                                        const dt = new Date(iso + "T00:00:00Z");
                                        return new Intl.DateTimeFormat(
                                          undefined,
                                          {
                                            month: "numeric",
                                            day: "numeric",
                                            timeZone: "UTC",
                                          },
                                        ).format(dt);
                                      } catch {
                                        return iso;
                                      }
                                    };
                                    const formatFull = (iso: string) => {
                                      try {
                                        const dt = new Date(iso + "T00:00:00Z");
                                        return new Intl.DateTimeFormat(
                                          undefined,
                                          {
                                            weekday: "short",
                                            month: "short",
                                            day: "numeric",
                                            year: "numeric",
                                            timeZone: "UTC",
                                          },
                                        ).format(dt);
                                      } catch {
                                        return iso;
                                      }
                                    };
                                    const TooltipContent = ({
                                      active,
                                      payload,
                                      label,
                                    }: { active?: boolean; payload?: Array<{ value?: number }>; label?: string }) => {
                                      if (
                                        !active ||
                                        !payload ||
                                        payload.length === 0
                                      )
                                        return null;
                                      const current = payload[0]
                                        ?.value as number;
                                      return (
                                        <div className="rounded-xl border bg-white/90 dark:bg-[#252526] dark:border-[#3e3e42] backdrop-blur p-3 shadow-lg">
                                          <div className="text-xs opacity-60 dark:opacity-70">
                                            {formatFull(label)}
                                          </div>
                                          <div className="mt-1 text-base font-semibold tabular-nums">
                                            {current}
                                          </div>
                                        </div>
                                      );
                                    };
                                    return (
                                      <div>
                                        <div className="text-sm font-medium mb-2">
                                          Total last 30 days:{" "}
                                          <span className="tabular-nums">
                                            {memberVisitsTotal30d}
                                          </span>
                                        </div>
                                        <div className="h-64">
                                          <ResponsiveContainer
                                            width="100%"
                                            height="100%"
                                          >
                                            <ComposedChart
                                              data={memberVisitsSeries}
                                              margin={{
                                                top: 10,
                                                right: 16,
                                                bottom: 14,
                                                left: 16,
                                              }}
                                            >
                                              <defs>
                                                <linearGradient
                                                  id="mVisitsLine"
                                                  x1="0"
                                                  y1="0"
                                                  x2="1"
                                                  y2="0"
                                                >
                                                  <stop
                                                    offset="0%"
                                                    stopColor="#065f46"
                                                  />
                                                  <stop
                                                    offset="100%"
                                                    stopColor="#10b981"
                                                  />
                                                </linearGradient>
                                                <linearGradient
                                                  id="mVisitsArea"
                                                  x1="0"
                                                  y1="0"
                                                  x2="0"
                                                  y2="1"
                                                >
                                                  <stop
                                                    offset="0%"
                                                    stopColor="#10b981"
                                                    stopOpacity={0.3}
                                                  />
                                                  <stop
                                                    offset="100%"
                                                    stopColor="#10b981"
                                                    stopOpacity={0.06}
                                                  />
                                                </linearGradient>
                                              </defs>
                                              <CartesianGrid
                                                strokeDasharray="3 3"
                                                stroke="rgba(0,0,0,0.06)"
                                              />
                                              <XAxis
                                                dataKey="date"
                                                tickFormatter={formatShort}
                                                tick={{
                                                  fontSize: 11,
                                                  fill: "#525252",
                                                }}
                                                axisLine={false}
                                                tickLine={false}
                                                interval={4}
                                                padding={{
                                                  left: 12,
                                                  right: 12,
                                                }}
                                              />
                                              <YAxis
                                                allowDecimals={false}
                                                domain={[
                                                  0,
                                                  Math.max(maxVal, 5),
                                                ]}
                                                tick={{
                                                  fontSize: 11,
                                                  fill: "#525252",
                                                }}
                                                axisLine={false}
                                                tickLine={false}
                                              />
                                              <Tooltip
                                                content={<TooltipContent />}
                                                cursor={{
                                                  stroke: "rgba(0,0,0,0.1)",
                                                }}
                                              />
                                              <ReferenceLine
                                                y={avgVal}
                                                stroke="#a3a3a3"
                                                strokeDasharray="4 4"
                                                ifOverflow="extendDomain"
                                                label={{
                                                  value: "avg",
                                                  position: "insideRight",
                                                  fill: "#737373",
                                                  fontSize: 11,
                                                  dx: -6,
                                                }}
                                              />
                                              <Area
                                                type="monotone"
                                                dataKey="visits"
                                                fill="url(#mVisitsArea)"
                                                stroke="none"
                                                animationDuration={600}
                                              />
                                              <Line
                                                type="monotone"
                                                dataKey="visits"
                                                stroke="url(#mVisitsLine)"
                                                strokeWidth={3}
                                                dot={false}
                                                activeDot={{
                                                  r: 5,
                                                  strokeWidth: 2,
                                                  stroke: "#065f46",
                                                  fill: "#ffffff",
                                                }}
                                                animationDuration={700}
                                              />
                                            </ComposedChart>
                                          </ResponsiveContainer>
                                        </div>
                                      </div>
                                    );
                                  })()
                                )}
                            </CardContent>
                          </Card>

                            {/* Plant Scans Section */}
                            <Card className="rounded-2xl overflow-hidden">
                              <CardContent className="p-0">
                                <div className="px-4 py-3 bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-900/20 dark:to-orange-900/20 border-b border-amber-200 dark:border-amber-800/50">
                                  <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                      <Leaf className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                                      <span className="text-sm font-semibold text-amber-900 dark:text-amber-100">
                                        Plant Scans
                                      </span>
                                      <span className="text-xs px-1.5 py-0.5 rounded-full bg-amber-200 dark:bg-amber-800 text-amber-700 dark:text-amber-200">
                                        {memberData.scansTotal || 0}
                                      </span>
                                      <span className="text-xs px-1.5 py-0.5 rounded-full bg-orange-200 dark:bg-orange-800 text-orange-700 dark:text-orange-200">
                                        {memberData.scansThisMonth || 0} this month
                                      </span>
                                    </div>
                                  </div>
                                  <p className="text-xs text-amber-700 dark:text-amber-300 mt-1">
                                    Shows recent scan results with uploaded image previews.
                                  </p>
                                </div>
                                <div className="p-4">
                                  {(!memberData.scans || memberData.scans.length === 0) ? (
                                    <div className="flex flex-col items-center justify-center py-8 text-center">
                                      <div className="w-12 h-12 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center mb-3">
                                        <Leaf className="h-6 w-6 text-amber-400" />
                                      </div>
                                      <p className="text-sm text-stone-500 dark:text-stone-400">
                                        No scans recorded for this user
                                      </p>
                                    </div>
                                  ) : (
                                    <div className="space-y-3 max-h-[28rem] overflow-y-auto pr-1">
                                      {memberData.scans.map((scan) => {
                                        const probabilityPct =
                                          typeof scan.topMatchProbability === "number"
                                            ? `${(scan.topMatchProbability * 100).toFixed(1)}%`
                                            : null;
                                        const statusLabel = (scan.apiStatus || "unknown").toLowerCase();
                                        const statusClasses =
                                          statusLabel === "completed"
                                            ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300"
                                            : statusLabel === "failed"
                                              ? "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300"
                                              : "bg-stone-100 text-stone-700 dark:bg-stone-800 dark:text-stone-300";
                                        return (
                                          <div
                                            key={scan.id}
                                            className="rounded-xl border border-stone-200 dark:border-stone-700 p-3 bg-white dark:bg-[#252526]"
                                          >
                                            <div className="flex gap-3">
                                              <div className="w-20 h-20 rounded-lg overflow-hidden border border-stone-200 dark:border-stone-700 bg-stone-100 dark:bg-stone-800 flex items-center justify-center shrink-0">
                                                {scan.imageUrl ? (
                                                  <a
                                                    href={scan.imageUrl}
                                                    target="_blank"
                                                    rel="noreferrer"
                                                    className="block w-full h-full"
                                                    title="Open scan image"
                                                  >
                                                    <img
                                                      src={scan.imageUrl}
                                                      alt={scan.topMatchName || "Plant scan"}
                                                      className="w-full h-full object-cover"
                                                      loading="lazy"
                                                    />
                                                  </a>
                                                ) : (
                                                  <FileImage className="h-6 w-6 text-stone-400" />
                                                )}
                                              </div>
                                              <div className="min-w-0 flex-1">
                                                <div className="flex items-start justify-between gap-2">
                                                  <div className="min-w-0">
                                                    <div className="text-sm font-semibold truncate">
                                                      {scan.topMatchName || "Unknown result"}
                                                    </div>
                                                    {scan.topMatchScientificName &&
                                                      scan.topMatchScientificName !== scan.topMatchName && (
                                                        <div className="text-xs italic text-stone-500 dark:text-stone-400 truncate">
                                                          {scan.topMatchScientificName}
                                                        </div>
                                                      )}
                                                  </div>
                                                  {scan.imageUrl && (
                                                    <a
                                                      href={scan.imageUrl}
                                                      target="_blank"
                                                      rel="noreferrer"
                                                      className="text-stone-500 hover:text-stone-800 dark:text-stone-400 dark:hover:text-stone-200"
                                                      title="Open image"
                                                    >
                                                      <ExternalLink className="h-4 w-4" />
                                                    </a>
                                                  )}
                                                </div>
                                                <div className="flex flex-wrap gap-1.5 mt-2">
                                                  <Badge className={cn("text-[10px] font-medium", statusClasses)}>
                                                    {statusLabel}
                                                  </Badge>
                                                  {probabilityPct && (
                                                    <Badge
                                                      variant="outline"
                                                      className="text-[10px] tabular-nums"
                                                    >
                                                      {probabilityPct}
                                                    </Badge>
                                                  )}
                                                  {scan.matchedPlantId && (
                                                    <Badge
                                                      variant="outline"
                                                      className="text-[10px] border-emerald-300 text-emerald-700 dark:border-emerald-700 dark:text-emerald-300"
                                                    >
                                                      In database
                                                    </Badge>
                                                  )}
                                                </div>
                                                <div className="mt-2 text-[11px] text-stone-500 dark:text-stone-400 space-y-0.5">
                                                  <div>
                                                    Scanned:{" "}
                                                    {scan.createdAt
                                                      ? new Date(scan.createdAt).toLocaleString()
                                                      : "-"}
                                                  </div>
                                                  {scan.matchedPlantName && (
                                                    <div className="truncate">
                                                      Matched plant:{" "}
                                                      <span className="font-medium text-stone-700 dark:text-stone-300">
                                                        {scan.matchedPlantName}
                                                      </span>
                                                    </div>
                                                  )}
                                                  {scan.userNotes && (
                                                    <div className="truncate">
                                                      Notes: {scan.userNotes}
                                                    </div>
                                                  )}
                                                </div>
                                              </div>
                                            </div>
                                          </div>
                                        );
                                      })}
                                    </div>
                                  )}
                                </div>
                              </CardContent>
                            </Card>

                            {/* Uploaded Media Files Section - Global Image Database */}
                            <Card className="rounded-2xl overflow-hidden">
                              <CardContent className="p-0">
                                {/* Header */}
                                <div className="px-4 py-3 bg-gradient-to-r from-emerald-50 to-teal-50 dark:from-emerald-900/20 dark:to-teal-900/20 border-b border-emerald-200 dark:border-emerald-800/50">
                                  <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                      <FolderOpen className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                                      <span className="text-sm font-semibold text-emerald-900 dark:text-emerald-100">Uploaded Media Files</span>
                                      <span className="text-xs px-1.5 py-0.5 rounded-full bg-emerald-200 dark:bg-emerald-800 text-emerald-700 dark:text-emerald-200">
                                        {memberData.mediaTotalCount || 0}
                                      </span>
                                    </div>
                                    <div className="flex items-center gap-3">
                                      {(memberData.mediaTotalSize || 0) > 0 && (
                                        <div className="flex items-center gap-1.5 text-xs text-emerald-700 dark:text-emerald-300">
                                          <HardDrive className="h-3 w-3" />
                                          <span className="font-medium">
                                            {memberData.mediaTotalSize && memberData.mediaTotalSize > 1024 * 1024 * 1024 
                                              ? `${(memberData.mediaTotalSize / (1024 * 1024 * 1024)).toFixed(2)} GB`
                                              : memberData.mediaTotalSize && memberData.mediaTotalSize > 1024 * 1024
                                                ? `${(memberData.mediaTotalSize / (1024 * 1024)).toFixed(2)} MB`
                                                : memberData.mediaTotalSize && memberData.mediaTotalSize > 1024
                                                  ? `${(memberData.mediaTotalSize / 1024).toFixed(1)} KB`
                                                  : `${memberData.mediaTotalSize || 0} B`
                                            }
                                          </span>
                                          <span className="text-emerald-600 dark:text-emerald-400">total</span>
                                        </div>
                                      )}
                                      {memberData.user?.id && (
                                        <Link
                                          to={`/admin/upload/library?userId=${memberData.user.id}`}
                                          className="flex items-center gap-1 text-xs font-medium text-emerald-600 dark:text-emerald-400 hover:text-emerald-700 dark:hover:text-emerald-300 hover:underline"
                                        >
                                          View all
                                          <ArrowRight className="h-3 w-3" />
                                        </Link>
                                      )}
                                    </div>
                                  </div>
                                </div>
                                
                                {/* Media Files Content */}
                                <div className="p-4">
                                  {(!memberData.mediaUploads || memberData.mediaUploads.length === 0) ? (
                                    <div className="flex flex-col items-center justify-center py-8 text-center">
                                      <div className="w-12 h-12 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center mb-3">
                                        <FileImage className="h-6 w-6 text-emerald-400" />
                                      </div>
                                      <p className="text-sm text-stone-500 dark:text-stone-400">No media files uploaded by this user</p>
                                      <p className="text-xs text-stone-400 dark:text-stone-500 mt-1">
                                        Media includes: blog images, messages, garden covers, etc.
                                      </p>
                                    </div>
                                  ) : (
                                    <>
                                      {/* Media Grid */}
                                      <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
                                        {memberData.mediaUploads.slice(0, 5).map((media) => {
                                          const isImage = (media.mimeType || "").startsWith("image/");
                                          // Source badge config
                                          const sourceConfig: Record<string, { label: string; color: string; icon: React.ComponentType<{ className?: string }> }> = {
                                            admin: { label: "Admin", color: "bg-purple-500", icon: Shield },
                                            blog: { label: "Blog", color: "bg-blue-500", icon: BookOpen },
                                            messages: { label: "Chat", color: "bg-green-500", icon: MessageSquareIcon },
                                            garden_cover: { label: "Garden", color: "bg-emerald-500", icon: Flower2 },
                                            garden_journal: { label: "Journal", color: "bg-teal-500", icon: BookOpen },
                                            garden_photo: { label: "Photo", color: "bg-lime-500", icon: Image },
                                            pro_advice: { label: "Pro", color: "bg-amber-500", icon: Sparkles },
                                            "pro-advice": { label: "Pro", color: "bg-amber-500", icon: Sparkles },
                                            contact_screenshot: { label: "Contact", color: "bg-indigo-500", icon: MessageSquareIcon },
                                          };
                                          const config = sourceConfig[media.uploadSource] || { label: media.uploadSource, color: "bg-stone-500", icon: FileImage };
                                          const SourceIcon = config.icon;
                                          
                                          return (
                                            <div
                                              key={media.id}
                                              className="group relative aspect-square rounded-xl overflow-hidden bg-stone-100 dark:bg-[#252526] border border-stone-200 dark:border-[#3e3e42] hover:border-emerald-300 dark:hover:border-emerald-700 transition-all"
                                            >
                                              {isImage && media.url ? (
                                                <a href={media.url} target="_blank" rel="noreferrer" className="block w-full h-full">
                                                  <img
                                                    src={media.url}
                                                    alt="Upload"
                                                    className="w-full h-full object-cover"
                                                    loading="lazy"
                                                    onError={(e) => {
                                                      // Replace with fallback icon if image fails to load
                                                      const target = e.currentTarget;
                                                      target.style.display = 'none';
                                                      const parent = target.parentElement;
                                                      if (parent) {
                                                        const fallback = document.createElement('div');
                                                        fallback.className = 'w-full h-full flex items-center justify-center bg-stone-100 dark:bg-[#252526]';
                                                        fallback.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="text-stone-300 dark:text-stone-600"><rect width="18" height="18" x="3" y="3" rx="2" ry="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"/></svg>';
                                                        parent.insertBefore(fallback, target);
                                                      }
                                                    }}
                                                  />
                                                  {/* Hover overlay */}
                                                  <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-colors flex items-center justify-center opacity-0 group-hover:opacity-100">
                                                    <div className="bg-white/90 dark:bg-black/80 rounded-full p-2">
                                                      <ExternalLink className="h-4 w-4 text-stone-700 dark:text-stone-200" />
                                                    </div>
                                                  </div>
                                                </a>
                                              ) : (
                                                <a href={media.url || "#"} target="_blank" rel="noreferrer" className="w-full h-full flex items-center justify-center">
                                                  <FileImage className="h-8 w-8 text-stone-300 dark:text-stone-600" />
                                                </a>
                                              )}
                                              {/* Source Badge */}
                                              <div className={cn("absolute top-1 left-1 px-1.5 py-0.5 rounded text-[9px] font-bold text-white flex items-center gap-0.5", config.color)}>
                                                <SourceIcon className="h-2.5 w-2.5" />
                                                {config.label}
                                              </div>
                                            </div>
                                          );
                                        })}
                                      </div>
                                      
                                      {/* View All Link */}
                                      {(memberData.mediaTotalCount || 0) > 5 && memberData.user?.id && (
                                        <Link
                                          to={`/admin/upload/library?userId=${memberData.user.id}`}
                                          className="mt-3 flex items-center justify-center gap-2 w-full py-2.5 rounded-xl bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400 text-sm font-medium hover:bg-emerald-100 dark:hover:bg-emerald-900/30 transition-colors"
                                        >
                                          View all {memberData.mediaTotalCount} media files
                                          <ArrowRight className="h-4 w-4" />
                                        </Link>
                                      )}
                                    </>
                                  )}
                                </div>
                              </CardContent>
                            </Card>

                            {/* Report Cases Section */}
                            <Card className="rounded-2xl overflow-hidden">
                              <CardContent className="p-0">
                                {/* Header */}
                                <div className="px-4 py-3 bg-gradient-to-r from-red-50 to-rose-50 dark:from-red-900/20 dark:to-rose-900/20 border-b border-red-200 dark:border-red-800/50">
                                  <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                      <ShieldAlert className="h-4 w-4 text-red-600 dark:text-red-400" />
                                      <span className="text-sm font-semibold text-red-900 dark:text-red-100">Report Cases</span>
                                      <div className="flex items-center gap-1.5">
                                        {(memberData.reportsAgainstCount || 0) > 0 && (
                                          <span className="text-xs px-1.5 py-0.5 rounded-full bg-red-200 dark:bg-red-800 text-red-700 dark:text-red-200">
                                            {memberData.reportsAgainstCount} against
                                          </span>
                                        )}
                                        {(memberData.reportsByCount || 0) > 0 && (
                                          <span className="text-xs px-1.5 py-0.5 rounded-full bg-blue-200 dark:bg-blue-800 text-blue-700 dark:text-blue-200">
                                            {memberData.reportsByCount} filed
                                          </span>
                                        )}
                                      </div>
                                    </div>
                                    <Link
                                      to="/admin/members/reports"
                                      className="text-xs font-medium text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 hover:underline flex items-center gap-1"
                                    >
                                      View all reports
                                      <ArrowRight className="h-3 w-3" />
                                    </Link>
                                  </div>
                                  <p className="text-xs text-red-600 dark:text-red-400 mt-1">
                                    Reports filed against this user for review
                                  </p>
                                </div>
                                
                                {/* Reports Content */}
                                <div className="p-4">
                                  {(!memberData.userReports || memberData.userReports.length === 0) ? (
                                    <div className="flex flex-col items-center justify-center py-8 text-center">
                                      <div className="w-12 h-12 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center mb-3">
                                        <CircleCheck className="h-6 w-6 text-green-500" />
                                      </div>
                                      <p className="text-sm font-medium text-green-700 dark:text-green-400">No reports against this user</p>
                                      <p className="text-xs text-stone-400 dark:text-stone-500 mt-1">
                                        This user has a clean record
                                      </p>
                                    </div>
                                  ) : (
                                    <div className="space-y-3">
                                      {memberData.userReports.slice(0, 5).map((report) => (
                                        <div
                                          key={report.id}
                                          className={cn(
                                            "p-3 rounded-xl border",
                                            report.status === 'review'
                                              ? "bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800"
                                              : "bg-stone-50 dark:bg-stone-800/50 border-stone-200 dark:border-stone-700"
                                          )}
                                        >
                                          <div className="flex items-start justify-between gap-2">
                                            <div className="flex-1 min-w-0">
                                              <div className="flex items-center gap-2 flex-wrap">
                                                <Badge
                                                  variant={report.status === 'review' ? 'default' : 'secondary'}
                                                  className={cn(
                                                    "text-xs",
                                                    report.status === 'review' 
                                                      ? "bg-amber-500" 
                                                      : "bg-emerald-500"
                                                  )}
                                                >
                                                  {report.status === 'review' ? (
                                                    <><Clock className="h-3 w-3 mr-1" /> Open</>
                                                  ) : (
                                                    <><Check className="h-3 w-3 mr-1" /> Closed</>
                                                  )}
                                                </Badge>
                                                <span className="text-xs text-stone-500">
                                                  {report.createdAt ? new Date(report.createdAt).toLocaleDateString() : '-'}
                                                </span>
                                              </div>
                                              <p className="text-sm mt-2 line-clamp-2">{report.reason || 'No reason provided'}</p>
                                              <div className="flex items-center gap-3 mt-2 text-xs text-stone-500">
                                                <span>Reported by: <span className="font-medium">{report.reporterName}</span></span>
                                                {report.classifierName && (
                                                  <span>Handled by: <span className="font-medium">{report.classifierName}</span></span>
                                                )}
                                              </div>
                                            </div>
                                          </div>
                                        </div>
                                      ))}
                                      
                                      {(memberData.reportsAgainstCount || 0) > 5 && (
                                        <Link
                                          to="/admin/members/reports"
                                          className="flex items-center justify-center gap-2 w-full py-2.5 rounded-xl bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 text-sm font-medium hover:bg-red-100 dark:hover:bg-red-900/30 transition-colors"
                                        >
                                          View all {memberData.reportsAgainstCount} reports
                                          <ArrowRight className="h-4 w-4" />
                                        </Link>
                                      )}
                                    </div>
                                  )}
                                </div>
                              </CardContent>
                            </Card>

                            {/* User Messages Section - For report verification */}
                            <Card className="rounded-2xl overflow-hidden">
                              <CardContent className="p-0">
                                <div className="px-4 py-3 bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 border-b border-blue-200 dark:border-blue-800/50">
                                  <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                      <MessageSquareIcon className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                                      <span className="text-sm font-semibold text-blue-900 dark:text-blue-100">User Messages</span>
                                      {memberMessagesStats.loading ? (
                                        <RefreshCw className="h-3 w-3 animate-spin text-blue-400" />
                                      ) : (
                                        <div className="flex items-center gap-1.5">
                                          <span className="text-xs px-1.5 py-0.5 rounded-full bg-blue-200 dark:bg-blue-800 text-blue-700 dark:text-blue-200">
                                            {memberMessagesStats.messageCount} sent
                                          </span>
                                          <span className="text-xs px-1.5 py-0.5 rounded-full bg-indigo-200 dark:bg-indigo-800 text-indigo-700 dark:text-indigo-200">
                                            {memberMessagesStats.conversationCount} chats
                                          </span>
                                        </div>
                                      )}
                                    </div>
                                    <Button
                                      variant="secondary"
                                      size="sm"
                                      className="rounded-xl bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 hover:bg-blue-200 dark:hover:bg-blue-900/60"
                                      onClick={() => setMemberMessagesOpen(true)}
                                      disabled={memberMessagesStats.conversationCount === 0 && !memberMessagesStats.loading}
                                    >
                                      <MessageSquareIcon className="h-4 w-4 mr-2" />
                                      View Messages
                                    </Button>
                                  </div>
                                  <p className="text-xs text-blue-600 dark:text-blue-400 mt-1">
                                    Browse conversations from this user's perspective to verify reports
                                  </p>
                                </div>
                              </CardContent>
                            </Card>

                            {/* Messages Dialog */}
                            <AdminUserMessagesDialog
                              open={memberMessagesOpen}
                              onOpenChange={setMemberMessagesOpen}
                              userId={memberData?.user?.id || ''}
                              userName={memberData?.profile?.display_name || memberData?.user?.email || null}
                            />

                            {(memberData.isBannedEmail ||
                              (memberData.bannedIps &&
                                memberData.bannedIps.length > 0)) && (
                              <div className="rounded-xl border p-3 bg-rose-100 dark:bg-rose-900/40 border-rose-300 dark:border-rose-800">
                                <div className="text-sm font-medium text-rose-800 dark:text-rose-200 flex items-center gap-2">
                                  <AlertTriangle className="h-4 w-4" /> Banned
                                  details
                                </div>
                                {memberData.isBannedEmail && (
                                  <div className="text-sm mt-1">
                                    Email banned{" "}
                                    {memberData.bannedAt
                                      ? `on ${new Date(memberData.bannedAt).toLocaleString()}`
                                      : ""}
                                    {memberData.bannedReason
                                      ? ` — ${memberData.bannedReason}`
                                      : ""}
                                  </div>
                                )}
                                {memberData.bannedByName && (
                                  <div className="text-xs text-stone-700 dark:text-stone-300 mt-1">
                                    Banned by {memberData.bannedByName}
                                  </div>
                                )}
                                {memberData.bannedIps &&
                                  memberData.bannedIps.length > 0 && (
                                    <div className="text-sm mt-1">
                                      Blocked IPs:
                                      <div className="mt-1 flex flex-wrap gap-1">
                                        {memberData.bannedIps.map((ip) => (
                                          <Badge
                                            key={ip}
                                            role="button"
                                            tabIndex={0}
                                            onClick={() => jumpToIpLookup(ip)}
                                            onKeyDown={(e) => {
                                              if (
                                                e.key === "Enter" ||
                                                e.key === " "
                                              ) {
                                                e.preventDefault();
                                                jumpToIpLookup(ip);
                                              }
                                            }}
                                            title={`Lookup members for ? ${ip}`}
                                            aria-label={`Lookup members for ? ${ip}`}
                                            variant="outline"
                                            className="rounded-full bg-white cursor-pointer hover:bg-stone-50 focus:outline-none focus:ring-2 focus:ring-ring"
                                          >
                                            {ip}
                                          </Badge>
                                        ))}
                                      </div>
                                    </div>
                                  )}
                              </div>
                            )}

                            {/* Admin Commentary - Last Element */}
                            <Card className="rounded-2xl">
                              <CardContent className="p-4 space-y-3">
                                <div className="text-sm font-medium flex items-center gap-2">
                                  <MessageSquareText className="h-4 w-4 text-stone-500" />
                                  Admin Commentary
                                </div>
                                <AddAdminNote
                                  profileId={memberData.user?.id || ""}
                                  onAdded={() => lookupMember()}
                                />
                                <div className="space-y-2">
                                  {(memberData.adminNotes || []).length ===
                                  0 ? (
                                    <div className="text-sm opacity-60">
                                      No notes yet.
                                    </div>
                                  ) : (
                                    (memberData.adminNotes || []).map((n) => (
                                      <NoteRow
                                        key={n.id}
                                        note={n}
                                        onRemoved={() => lookupMember()}
                                      />
                                    ))
                                  )}
                                </div>
                              </CardContent>
                            </Card>
                          </div>
                        )}
                      </CardContent>
                    </Card>

                      {/* Ban action moved into member card header via hammer button */}

                      {/* IP Search Card */}
                      <Card className="rounded-2xl">
                        <CardContent className="p-4 space-y-3">
                          <div className="text-sm font-medium flex items-center gap-2">
                            <UserSearch className="h-4 w-4" /> Find users by IP
                            address
                          </div>
                          <div className="flex gap-2">
                            <Input
                              id="member-ip"
                              name="member-ip"
                              autoComplete="off"
                              aria-label="IP address"
                              className="rounded-xl"
                              placeholder="e.g. 203.0.113.42"
                              value={ipLookup}
                              onChange={(
                                e: React.ChangeEvent<HTMLInputElement>,
                              ) => setIpLookup(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === "Enter") {
                                  e.preventDefault();
                                  lookupByIp();
                                }
                              }}
                              ref={memberIpInputRef}
                            />
                            <Button
                              className="rounded-2xl"
                              onClick={() => lookupByIp()}
                              disabled={ipLoading || !ipLookup.trim()}
                            >
                              <Search className="h-4 w-4" /> Search IP
                            </Button>
                          </div>
                          {ipError && (
                            <div className="text-sm text-rose-600">{ipError}</div>
                          )}
                          {ipLoading && (
                            <div className="space-y-2" aria-live="polite">
                              <div className="h-4 bg-neutral-200 rounded w-52 animate-pulse" />
                              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
                                {Array.from({ length: 6 }).map((_, i) => (
                                  <div
                                    key={i}
                                    className="h-20 rounded-xl border bg-white animate-pulse"
                                  />
                                ))}
                              </div>
                            </div>
                          )}
                          {!ipLoading && !ipError && !ipUsed && (
                            <div className="text-sm opacity-60">
                              Search for an IP address to see details.
                            </div>
                          )}
                          {!ipLoading && ipUsed && (
                            <div className="space-y-2">
                              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                                <div className="rounded-xl border border-stone-300 dark:border-[#3e3e42] p-3 text-center bg-white dark:bg-[#252526]">
                                  <div className="text-[11px] opacity-60">IP</div>
                                  <div
                                    className="text-base font-semibold tabular-nums truncate"
                                    title={ipUsed || undefined}
                                  >
                                    {ipUsed || "-"}
                                  </div>
                                </div>
                                <div className="rounded-xl border border-stone-300 dark:border-[#3e3e42] p-3 text-center bg-white dark:bg-[#252526]">
                                  <div className="text-[11px] opacity-60">
                                    Users
                                  </div>
                                  <div className="text-base font-semibold tabular-nums">
                                    {ipUsersCount ?? ipResults.length}
                                  </div>
                                </div>
                                <div className="rounded-xl border border-stone-300 dark:border-[#3e3e42] p-3 text-center bg-white dark:bg-[#252526]">
                                  <div className="text-[11px] opacity-60">
                                    Connections
                                  </div>
                                  <div className="text-base font-semibold tabular-nums">
                                    {ipConnectionsCount ?? "-"}
                                  </div>
                                </div>
                              </div>
                              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                                <div className="rounded-xl border border-stone-300 dark:border-[#3e3e42] p-3 text-center bg-white dark:bg-[#252526]">
                                  <div className="text-[11px] opacity-60">
                                    Mean RPM (5m)
                                  </div>
                                  <div className="text-base font-semibold tabular-nums">
                                    {typeof ipMeanRpm5m === "number"
                                      ? ipMeanRpm5m.toFixed(2)
                                      : "-"}
                                  </div>
                                </div>
                                <div className="rounded-xl border border-stone-300 dark:border-[#3e3e42] p-3 text-center bg-white dark:bg-[#252526]">
                                  <div className="text-[11px] opacity-60">
                                    Country
                                  </div>
                                  <div className="text-base font-semibold tabular-nums">
                                    {ipCountry ? countryCodeToName(ipCountry) : "-"}
                                  </div>
                                </div>
                                <div className="rounded-xl border border-stone-300 dark:border-[#3e3e42] p-3 bg-white dark:bg-[#252526]">
                                  <div className="text-[11px] opacity-60 mb-1">
                                    Top referrers
                                  </div>
                                  {ipTopReferrers.length === 0 ? (
                                    <div className="text-xs opacity-60">-</div>
                                  ) : (
                                    <div className="space-y-0.5">
                                      {ipTopReferrers.slice(0, 1).map((r, idx) => (
                                        <div
                                          key={`${r.source}-${idx}`}
                                          className="flex items-center justify-between text-sm"
                                        >
                                          <div className="truncate mr-2">
                                            {r.source || "direct"}
                                          </div>
                                          <div className="tabular-nums">
                                            {r.visits}
                                          </div>
                                        </div>
                                      ))}
                                    </div>
                                  )}
                                </div>
                                {otherCountriesTooltip &&
                                  createPortal(
                                    <div
                                      className="fixed z-[70] pointer-events-none"
                                      style={{
                                        top: otherCountriesTooltip.top,
                                        left: otherCountriesTooltip.left,
                                        transform: "translate(-50%, -100%)",
                                      }}
                                    >
                                      <div className="rounded-xl border border-stone-300 dark:border-[#3e3e42] bg-white dark:bg-[#252526] shadow px-3 py-2 max-w-[280px]">
                                        <div className="text-xs font-medium mb-1">
                                          Countries in Other
                                        </div>
                                        <div className="text-[11px] opacity-80 space-y-0.5 max-h-48 overflow-auto">
                                          {otherCountriesTooltip.names.map(
                                            (n, idx) => (
                                              <div
                                                key={`${n}-${idx}`}
                                                className="truncate"
                                              >
                                                {n}
                                              </div>
                                            ),
                                          )}
                                        </div>
                                      </div>
                                    </div>,
                                    document.body,
                                  )}
                              </div>
                              <div className="rounded-xl border border-stone-300 dark:border-[#3e3e42] p-3 bg-white dark:bg-[#252526]">
                                <div className="text-[11px] opacity-60 mb-1">
                                  Top devices
                                </div>
                                {ipTopDevices.length === 0 ? (
                                  <div className="text-xs opacity-60">-</div>
                                ) : (
                                  <div className="space-y-0.5">
                                    {ipTopDevices.slice(0, 1).map((d, idx) => (
                                      <div
                                        key={`${d.device}-${idx}`}
                                        className="flex items-center justify-between text-sm"
                                      >
                                        <div className="truncate mr-2">
                                          {d.device}
                                        </div>
                                        <div className="tabular-nums">
                                          {d.visits}
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </div>
                              <div className="text-xs opacity-60">
                                Last seen:{" "}
                                {ipLastSeenAt
                                  ? new Date(ipLastSeenAt).toLocaleString()
                                  : "-"}
                              </div>
                              {ipResults.length === 0 ? (
                                <div className="text-sm opacity-60">
                                  No users found for this IP.
                                </div>
                              ) : (
                                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
                                  {ipResults.map((u) => (
                                    <button
                                      key={u.id}
                                      type="button"
                                      className="text-left rounded-2xl border border-stone-300 dark:border-[#3e3e42] p-3 bg-white dark:bg-[#252526] hover:bg-stone-50 dark:hover:bg-[#2d2d30]"
                                      onClick={() => {
                                        const nextVal = (
                                          u.email ||
                                          u.display_name ||
                                          ""
                                        ).trim();
                                        if (!nextVal) return;
                                        lookupMember(nextVal);
                                      }}
                                    >
                                      <div className="text-sm font-semibold truncate">
                                        {u.display_name || u.email || "User"}
                                      </div>
                                      <div className="text-xs opacity-70 truncate">
                                        {u.email || "-"}
                                      </div>
                                      {u.last_seen_at && (
                                        <div className="text-[11px] opacity-60 mt-0.5">
                                          Last seen{" "}
                                          {new Date(
                                            u.last_seen_at,
                                          ).toLocaleString()}
                                        </div>
                                      )}
                                    </button>
                                  ))}
                                </div>
                              )}
                            </div>
                          )}
                        </CardContent>
                      </Card>
                      </>
                    )}

                    {membersView === "list" && (
                      <div className="space-y-4">
                        {/* Role Stats Cards - Grid layout with equal-width cells */}
                        <div className="grid grid-cols-3 sm:grid-cols-5 lg:grid-cols-9 gap-2 pb-2">
                          {[
                            { key: null, label: "All", tooltip: "All Members", count: roleStats?.totalMembers ?? "-", icon: Users, color: "stone" },
                            { key: "admin", label: "Admin", tooltip: "Administrators", count: roleStats?.roleCounts?.admin ?? 0, icon: Shield, color: "purple" },
                            { key: "editor", label: "Editor", tooltip: "Editors", count: roleStats?.roleCounts?.editor ?? 0, icon: Pencil, color: "blue" },
                            { key: "pro", label: "Pro", tooltip: "Pro Members", count: roleStats?.roleCounts?.pro ?? 0, icon: Check, color: "emerald" },
                            { key: "vip", label: "VIP", tooltip: "VIP Members", count: roleStats?.roleCounts?.vip ?? 0, icon: Crown, color: "amber" },
                            { key: "plus", label: "Plus", tooltip: "Plus Members", count: roleStats?.roleCounts?.plus ?? 0, icon: Plus, color: "slate" },
                            { key: "creator", label: "Creator", tooltip: "Creators", count: roleStats?.roleCounts?.creator ?? 0, icon: Sparkles, color: "pink" },
                            { key: "merchant", label: "Merch", tooltip: "Merchants", count: roleStats?.roleCounts?.merchant ?? 0, icon: Store, color: "sky" },
                            { key: "bug_catcher", label: "Bugs", tooltip: "Bug Catchers", count: roleStats?.roleCounts?.bug_catcher ?? 0, icon: Bug, color: "orange" },
                          ].map((item) => {
                            const Icon = item.icon;
                            const isSelected = roleFilter === item.key;
                            const colorClasses: Record<string, { bg: string; icon: string; border: string; selectedBg: string; selectedBorder: string }> = {
                              stone: { bg: "bg-stone-100 dark:bg-stone-800", icon: "text-stone-600 dark:text-stone-400", border: "hover:border-stone-300 dark:hover:border-stone-600", selectedBg: "bg-stone-50 dark:bg-stone-800/50", selectedBorder: "border-stone-400 dark:border-stone-500 ring-2 ring-stone-400/30" },
                              purple: { bg: "bg-purple-100 dark:bg-purple-900/30", icon: "text-purple-600 dark:text-purple-400", border: "hover:border-purple-300 dark:hover:border-purple-700", selectedBg: "bg-purple-50 dark:bg-purple-900/30", selectedBorder: "border-purple-400 dark:border-purple-500 ring-2 ring-purple-400/30" },
                              blue: { bg: "bg-blue-100 dark:bg-blue-900/30", icon: "text-blue-600 dark:text-blue-400", border: "hover:border-blue-300 dark:hover:border-blue-700", selectedBg: "bg-blue-50 dark:bg-blue-900/30", selectedBorder: "border-blue-400 dark:border-blue-500 ring-2 ring-blue-400/30" },
                              emerald: { bg: "bg-emerald-100 dark:bg-emerald-900/30", icon: "text-emerald-600 dark:text-emerald-400", border: "hover:border-emerald-300 dark:hover:border-emerald-700", selectedBg: "bg-emerald-50 dark:bg-emerald-900/30", selectedBorder: "border-emerald-400 dark:border-emerald-500 ring-2 ring-emerald-400/30" },
                              amber: { bg: "bg-amber-100 dark:bg-amber-900/30", icon: "text-amber-600 dark:text-amber-400", border: "hover:border-amber-300 dark:hover:border-amber-700", selectedBg: "bg-amber-50 dark:bg-amber-900/30", selectedBorder: "border-amber-400 dark:border-amber-500 ring-2 ring-amber-400/30" },
                              slate: { bg: "bg-slate-100 dark:bg-slate-800", icon: "text-slate-600 dark:text-slate-400", border: "hover:border-slate-300 dark:hover:border-slate-600", selectedBg: "bg-slate-50 dark:bg-slate-800/50", selectedBorder: "border-slate-400 dark:border-slate-500 ring-2 ring-slate-400/30" },
                              pink: { bg: "bg-pink-100 dark:bg-pink-900/30", icon: "text-pink-600 dark:text-pink-400", border: "hover:border-pink-300 dark:hover:border-pink-700", selectedBg: "bg-pink-50 dark:bg-pink-900/30", selectedBorder: "border-pink-400 dark:border-pink-500 ring-2 ring-pink-400/30" },
                              sky: { bg: "bg-sky-100 dark:bg-sky-900/30", icon: "text-sky-600 dark:text-sky-400", border: "hover:border-sky-300 dark:hover:border-sky-700", selectedBg: "bg-sky-50 dark:bg-sky-900/30", selectedBorder: "border-sky-400 dark:border-sky-500 ring-2 ring-sky-400/30" },
                              orange: { bg: "bg-orange-100 dark:bg-orange-900/30", icon: "text-orange-600 dark:text-orange-400", border: "hover:border-orange-300 dark:hover:border-orange-700", selectedBg: "bg-orange-50 dark:bg-orange-900/30", selectedBorder: "border-orange-400 dark:border-orange-500 ring-2 ring-orange-400/30" },
                            };
                            const colors = colorClasses[item.color];
                            return (
                              <button
                                key={item.key ?? "all"}
                                type="button"
                                title={item.tooltip}
                                onClick={() => handleRoleFilterChange(item.key)}
                                className={`w-full flex items-center justify-center gap-1.5 px-2 py-2 rounded-xl border transition-all ${
                                  isSelected
                                    ? `${colors.selectedBg} ${colors.selectedBorder}`
                                    : `bg-white dark:bg-[#1e1e20] border-stone-200 dark:border-[#3e3e42] ${colors.border}`
                                }`}
                              >
                                <div className={`w-6 h-6 rounded-lg ${colors.bg} flex items-center justify-center flex-shrink-0`}>
                                  <Icon className={`h-3 w-3 ${colors.icon}`} />
                                </div>
                                <div className="text-left min-w-0">
                                  <div className="text-sm font-bold text-stone-900 dark:text-white leading-tight">{item.count}</div>
                                  <div className="text-[10px] text-stone-500 dark:text-stone-400 leading-tight truncate">{item.label}</div>
                                </div>
                              </button>
                            );
                          })}
                        </div>

                        <Card className="rounded-2xl">
                          <CardContent className="p-4 space-y-4">
                            <div className="flex flex-wrap items-center justify-between gap-3">
                              <div className="flex flex-col gap-1">
                                <div className="text-sm font-semibold flex items-center gap-2">
                                  <Users className="h-4 w-4" /> Members
                                </div>
                                <div className="text-xs opacity-60">
                                  Browse members in batches of 20 and load more as
                                  needed.
                                </div>
                              </div>
                              <div className="flex flex-wrap items-center gap-3">
                                <div className="flex flex-wrap items-center gap-2">
                                  <span className="text-[11px] uppercase tracking-wide opacity-60">
                                    Sort
                                  </span>
                                  <div className="flex flex-wrap gap-1.5">
                                    {memberListSortOptions.map((option) => (
                                      <Button
                                        key={option.value}
                                        size="sm"
                                        variant={
                                          memberListSort === option.value
                                            ? "default"
                                            : "outline"
                                        }
                                        className="rounded-2xl text-xs"
                                        onClick={() =>
                                          handleMemberSortChange(option.value)
                                        }
                                      >
                                        {option.label}
                                      </Button>
                                    ))}
                                  </div>
                                </div>
                                {roleFilter && (
                                  <div className="flex items-center gap-2">
                                    <span className="text-[11px] uppercase tracking-wide opacity-60">
                                      Filter
                                    </span>
                                    <Button
                                      size="sm"
                                      variant="secondary"
                                      className="rounded-2xl text-xs gap-1.5 capitalize"
                                      onClick={() => handleRoleFilterChange(null)}
                                    >
                                      {roleFilter}
                                      <Trash2 className="h-3 w-3" />
                                    </Button>
                                  </div>
                                )}
                              </div>
                            </div>
                            {memberListError && (
                              <div className="flex flex-wrap items-center gap-3 text-sm text-rose-600">
                                {memberListError}
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="rounded-2xl"
                                  onClick={() =>
                                    loadMemberList({
                                      reset: memberList.length === 0,
                                    })
                                  }
                                  disabled={memberListLoading}
                                >
                                  Retry
                                </Button>
                              </div>
                            )}
                            {memberList.length === 0 && memberListLoading && (
                              <div className="space-y-2">
                                {Array.from({ length: 3 }).map((_, idx) => (
                                  <div
                                    key={`member-list-skeleton-${idx}`}
                                    className="h-20 rounded-2xl border border-dashed animate-pulse"
                                  />
                                ))}
                              </div>
                            )}
                            {memberList.length === 0 &&
                              !memberListLoading &&
                              memberListInitialized &&
                              !memberListError && (
                                <div className="text-sm opacity-60">
                                  No members to show yet.
                                </div>
                              )}
                            {memberList.length > 0 && (
                              <div className="grid gap-2">
                                {memberList.map((member) => (
                                  <button
                                    key={member.id}
                                    type="button"
                                    className="text-left rounded-2xl border border-stone-200 dark:border-[#3e3e42] p-4 bg-white dark:bg-[#252526] hover:bg-stone-50 dark:hover:bg-[#2d2d30]"
                                    onClick={() => handleMemberCardClick(member)}
                                  >
                                    <div className="flex items-center justify-between gap-3">
                                      <div className="flex items-center gap-2 flex-1 min-w-0">
                                        <div className="min-w-0">
                                          <div className="flex items-center gap-1.5">
                                            <span className="font-semibold truncate">
                                              {member.displayName ||
                                                member.email ||
                                                `User ${member.id.slice(0, 8)}`}
                                            </span>
                                            {/* Role badges next to name like Profile page */}
                                            <ProfileNameBadges 
                                              roles={member.roles as UserRole[]} 
                                              isAdmin={member.isAdmin} 
                                              size="sm" 
                                            />
                                          </div>
                                          <div className="text-xs opacity-70 truncate">
                                            {member.email || "No email"}
                                          </div>
                                        </div>
                                      </div>
                                      {/* Show "Member" badge if no special roles */}
                                      {!member.isAdmin && member.roles.length === 0 && (
                                        <Badge variant="outline" className="rounded-full px-2 py-0.5 text-[10px] flex-shrink-0">
                                          Member
                                        </Badge>
                                      )}
                                    </div>
                                      <div className="text-xs opacity-60 mt-1 flex flex-wrap items-center gap-2">
                                        <span>
                                          Joined {formatMemberJoinDate(member.createdAt)}
                                        </span>
                                        <span className="hidden sm:inline">•</span>
                                        <span className="tabular-nums">
                                          RPM (5m): {formatRpmValue(member.rpm5m)}
                                        </span>
                                      </div>
                                  </button>
                                ))}
                              </div>
                            )}
                            {memberList.length > 0 && (
                              <Button
                                variant="secondary"
                                className="w-full rounded-2xl"
                                onClick={() => loadMemberList()}
                                disabled={memberListLoading || !memberListHasMore}
                              >
                                {memberListLoading
                                  ? "Loading..."
                                  : memberListHasMore
                                    ? "Load 20 more"
                                    : "No more members"}
                            </Button>
                          )}
                        </CardContent>
                      </Card>
                  </div>
                )}

                    {membersView === "reports" && (
                      <AdminReportsPanel />
                    )}
                  </div>
                )}

                </CardContent>
              </Card>
            </section>
          </div>
        </main>
      </div>
    </div>

    {/* Add FROM Plant Dialog */}
    <Dialog open={addFromDialogOpen} onOpenChange={(open) => {
      setAddFromDialogOpen(open);
      if (!open) {
        setAddFromSearchQuery("");
        setAddFromSearchResults([]);
        setAddFromDuplicateError(null);
        setAddFromDuplicateSuccess(null);
      }
    }}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Add Plant FROM Existing</DialogTitle>
          <DialogDescription>
            Search for an existing plant to duplicate. All data including translations will be copied to a new plant.
          </DialogDescription>
        </DialogHeader>
        
        {/* Success State */}
        {addFromDuplicateSuccess ? (
          <div className="space-y-4">
            <div className="flex items-start gap-3 p-4 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800">
              <Check className="h-5 w-5 text-emerald-600 dark:text-emerald-400 flex-shrink-0 mt-0.5" />
              <div className="space-y-1">
                <div className="font-medium text-emerald-900 dark:text-emerald-100">
                  Plant duplicated successfully!
                </div>
                <div className="text-sm text-emerald-700 dark:text-emerald-300">
                  Created "<span className="font-medium">{addFromDuplicateSuccess.name}</span>"
                </div>
                <div className="text-xs text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5 mt-2">
                  <Info className="h-3.5 w-3.5" />
                  From original plant: {addFromDuplicateSuccess.originalName}
                </div>
              </div>
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                className="flex-1 rounded-xl"
                onClick={() => {
                  setAddFromDuplicateSuccess(null);
                  setAddFromSearchQuery("");
                  setAddFromSearchResults([]);
                }}
              >
                Duplicate Another
              </Button>
              <Button
                className="flex-1 rounded-xl"
                onClick={() => {
                  const successId = addFromDuplicateSuccess.id;
                  const originalName = addFromDuplicateSuccess.originalName;
                  setAddFromDialogOpen(false);
                  setAddFromSearchQuery("");
                  setAddFromSearchResults([]);
                  setAddFromDuplicateSuccess(null);
                  navigate(`/create/${successId}?duplicatedFrom=${encodeURIComponent(originalName)}`);
                }}
              >
                Edit Plant
                <ArrowUpRight className="h-4 w-4 ml-1" />
              </Button>
            </div>
          </div>
        ) : addFromDuplicating ? (
          /* Duplicating State */
          <div className="flex flex-col items-center justify-center py-8 space-y-3">
            <RefreshCw className="h-8 w-8 text-emerald-600 dark:text-emerald-400 animate-spin" />
            <div className="text-sm font-medium">Duplicating plant...</div>
            <div className="text-xs opacity-60">Copying all data and translations</div>
          </div>
        ) : (
          /* Search State */
          <div className="space-y-4">
            {addFromDuplicateError && (
              <div className="flex items-start gap-3 p-4 rounded-xl bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800">
                <AlertTriangle className="h-5 w-5 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <div className="font-medium text-red-900 dark:text-red-100">
                    Duplication failed
                  </div>
                  <div className="text-sm text-red-700 dark:text-red-300">
                    {addFromDuplicateError}
                  </div>
                </div>
              </div>
            )}
            <SearchInput
              value={addFromSearchQuery}
              onChange={(e) => {
                setAddFromSearchQuery(e.target.value);
                searchPlantsForAddFrom(e.target.value);
              }}
              placeholder="Search plants by name..."
            />
            <div className="max-h-[300px] overflow-y-auto rounded-xl border border-stone-200 dark:border-[#3e3e42]">
              {addFromSearchLoading ? (
                <div className="p-4 text-sm text-center opacity-60">Searching...</div>
              ) : addFromSearchQuery.trim() && addFromSearchResults.length === 0 ? (
                <div className="p-4 text-sm text-center opacity-60">No plants found</div>
              ) : addFromSearchResults.length === 0 ? (
                <div className="p-4 text-sm text-center opacity-60">Type to search for plants</div>
              ) : (
                <div className="divide-y divide-stone-200 dark:divide-[#2f2f35]">
                  {addFromSearchResults.map((plant) => (
                    <button
                      key={plant.id}
                      type="button"
                      onClick={() => handleSelectPlantForPrefill(plant.id, plant.name)}
                      className="w-full px-4 py-3 text-left hover:bg-stone-100 dark:hover:bg-[#2a2a2d] transition-colors"
                    >
                      <div className="font-medium text-sm">{plant.name}</div>
                      {plant.scientific_name_species && (
                        <div className="text-xs italic opacity-60">{plant.scientific_name_species}</div>
                      )}
                      {plant.status && (
                        <Badge variant="outline" className="mt-1 text-[10px]">
                          {plant.status}
                        </Badge>
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
        
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline" className="rounded-xl" disabled={addFromDuplicating}>
              {addFromDuplicateSuccess ? 'Close' : 'Cancel'}
            </Button>
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    {/* Delete Plant Confirmation Dialog */}
    <Dialog open={deletePlantDialogOpen} onOpenChange={(open) => {
      if (!deletingPlant) {
        setDeletePlantDialogOpen(open);
        if (!open) {
          setPlantToDelete(null);
        }
      }
    }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-red-600 dark:text-red-400">
            <AlertTriangle className="h-5 w-5" />
            Delete Plant
          </DialogTitle>
          <DialogDescription>
            Are you sure you want to delete this plant? This action cannot be undone.
          </DialogDescription>
        </DialogHeader>
        
        {plantToDelete && (
          <div className="space-y-4">
            <div className="p-4 rounded-xl bg-stone-100 dark:bg-[#2a2a2d] border border-stone-200 dark:border-[#3e3e42]">
              <div className="font-medium text-stone-900 dark:text-white">
                {plantToDelete.name}
              </div>
              <div className="text-xs text-stone-500 dark:text-stone-400 mt-1 font-mono">
                ID: {plantToDelete.id}
              </div>
            </div>
            
            <div className="flex items-start gap-2 p-3 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800">
              <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
              <div className="text-sm text-amber-800 dark:text-amber-200">
                This will permanently delete the plant and all associated data including translations, images, and schedules.
              </div>
            </div>
          </div>
        )}
        
        <DialogFooter className="gap-2 sm:gap-0">
          <DialogClose asChild>
            <Button variant="outline" className="rounded-xl" disabled={deletingPlant}>
              Cancel
            </Button>
          </DialogClose>
          <Button
            variant="destructive"
            className="rounded-xl"
            onClick={handleDeletePlant}
            disabled={deletingPlant}
          >
            {deletingPlant ? (
              <>
                <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                Deleting...
              </>
            ) : (
              <>
                <Trash2 className="h-4 w-4 mr-2" />
                Delete Plant
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    {/* Bulk Status Change Dialog */}
    <Dialog open={bulkStatusDialogOpen} onOpenChange={(open) => {
      if (!bulkActionLoading) {
        setBulkStatusDialogOpen(open);
      }
    }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Pencil className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
            Change Status
          </DialogTitle>
          <DialogDescription>
            Change the status of {selectedPlantIds.size} selected {selectedPlantIds.size === 1 ? "plant" : "plants"}.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-2 py-2">
          {PLANT_STATUS_FILTER_OPTIONS.map((option) => (
            <button
              key={option.value}
              type="button"
              disabled={bulkActionLoading}
              onClick={() => handleBulkStatusChange(option.value)}
              className="flex items-center gap-3 w-full px-4 py-3 rounded-xl text-left hover:bg-stone-100 dark:hover:bg-[#2a2a2d] transition-colors disabled:opacity-50"
            >
              <span
                className="w-3 h-3 rounded-full flex-shrink-0"
                style={{ backgroundColor: PLANT_STATUS_COLORS[option.value] }}
              />
              <span className="text-sm font-medium text-stone-900 dark:text-white">
                {option.label}
              </span>
            </button>
          ))}
        </div>

        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline" className="rounded-xl" disabled={bulkActionLoading}>
              Cancel
            </Button>
          </DialogClose>
        </DialogFooter>
        {bulkActionLoading && (
          <div className="absolute inset-0 flex items-center justify-center bg-white/60 dark:bg-black/40 rounded-xl">
            <RefreshCw className="h-5 w-5 animate-spin text-emerald-600" />
          </div>
        )}
      </DialogContent>
    </Dialog>

    {/* Bulk Delete Confirmation Dialog */}
    <Dialog open={bulkDeleteDialogOpen} onOpenChange={(open) => {
      if (!bulkActionLoading) {
        setBulkDeleteDialogOpen(open);
      }
    }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-red-600 dark:text-red-400">
            <AlertTriangle className="h-5 w-5" />
            Delete {selectedPlantIds.size} {selectedPlantIds.size === 1 ? "Plant" : "Plants"}
          </DialogTitle>
          <DialogDescription>
            Are you sure you want to delete {selectedPlantIds.size} selected {selectedPlantIds.size === 1 ? "plant" : "plants"}? This action cannot be undone.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="max-h-48 overflow-y-auto rounded-xl bg-stone-100 dark:bg-[#2a2a2d] border border-stone-200 dark:border-[#3e3e42] divide-y divide-stone-200 dark:divide-[#3e3e42]">
            {plantDashboardRows
              .filter((p) => selectedPlantIds.has(p.id))
              .map((plant) => (
                <div key={plant.id} className="px-4 py-2">
                  <div className="font-medium text-sm text-stone-900 dark:text-white">
                    {plant.name}
                  </div>
                  <div className="text-xs text-stone-500 dark:text-stone-400 font-mono">
                    {plant.id.slice(0, 8)}...
                  </div>
                </div>
              ))}
          </div>

          <div className="flex items-start gap-2 p-3 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800">
            <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
            <div className="text-sm text-amber-800 dark:text-amber-200">
              This will permanently delete all selected plants and their associated data including translations, images, and schedules.
            </div>
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <DialogClose asChild>
            <Button variant="outline" className="rounded-xl" disabled={bulkActionLoading}>
              Cancel
            </Button>
          </DialogClose>
          <Button
            variant="destructive"
            className="rounded-xl"
            onClick={handleBulkDelete}
            disabled={bulkActionLoading}
          >
            {bulkActionLoading ? (
              <>
                <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                Deleting...
              </>
            ) : (
              <>
                <Trash2 className="h-4 w-4 mr-2" />
                Delete {selectedPlantIds.size} {selectedPlantIds.size === 1 ? "Plant" : "Plants"}
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  </div>
);
};

// --- Broadcast controls (Overview tab) ---
const BroadcastControls: React.FC<{
  inline?: boolean;
  onExpired?: () => void;
  onActive?: () => void;
}> = ({ inline = false, onExpired: _onExpired, onActive }) => {
  const [active, setActive] = React.useState<BroadcastRecord | null>(() =>
    loadPersistedBroadcast(),
  );
  const [message, setMessage] = React.useState("");
  // Default to warning requested, but server/UI sometimes using info; keep 'warning' default selectable
  const [severity, setSeverity] = React.useState<"info" | "warning" | "danger">(
    "warning",
  );
  // Duration selector (default 5 minutes for send; empty string keeps current on edit)
  const [duration, setDuration] = React.useState<string>("5m");
  // Duration removed; default used on send
  const [submitting, setSubmitting] = React.useState(false);
  const [removing, setRemoving] = React.useState(false);
  const [now, setNow] = React.useState(() => Date.now());
  // Prevent flashing the create UI before we know if an active broadcast exists
  const [initializing, setInitializing] = React.useState(true);

  // Default duration behavior:
  // - Create mode (no active): default to 5m
  // - Edit mode (active): default to "Keep current" (empty string) so we don't override
  React.useEffect(() => {
    setDuration(active ? "" : "5m");
  }, [active]);

  React.useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const [clockOffset, setClockOffset] = React.useState(0);

  const msRemaining = React.useCallback(
    (expiresAt: string | null): number | null => {
      if (!expiresAt) return null;
      const end = Date.parse(expiresAt);
      if (!Number.isFinite(end)) return null;
      return Math.max(0, end - (now + clockOffset));
    },
    [now, clockOffset],
  );

  const formatDuration = (ms: number): string => {
    const totalSeconds = Math.floor(Math.max(0, ms) / 1000);
    const s = totalSeconds % 60;
    const totalMinutes = Math.floor(totalSeconds / 60);
    const m = totalMinutes % 60;
    const h = Math.floor(totalMinutes / 60);
    const d = Math.floor(h / 24);
    if (d > 0) return `${d}d ? ${h % 24}h ? ${m}m`;
    if (h > 0) return `${h}h ? ${m}m`;
    if (m > 0) return `${m}m ? ${s}s`;
    return `${s}s`;
  };

  const loadActive = React.useCallback(async () => {
    try {
      const r = await fetch("/api/broadcast/active", {
        headers: { Accept: "application/json" },
        credentials: "same-origin",
      });
      if (r.ok) {
        const b = await r.json().catch(() => ({}));
        if (b?.serverTime) {
          const serverMs = Date.parse(b.serverTime);
          if (Number.isFinite(serverMs)) {
            setClockOffset(serverMs - Date.now());
          }
        }
        if (b?.broadcast) {
          setActive(b.broadcast);
          savePersistedBroadcast(b.broadcast);
          // Pre-fill edit fields so admin can immediately edit
          setMessage(b.broadcast.message || "");
          setSeverity(
            b.broadcast.severity === "warning" || b.broadcast.severity === "danger"
              ? b.broadcast.severity
              : "info",
          );
          // Inform parent to open the section if collapsed
          onActive?.();
        } else {
          setActive((prev) => {
            if (prev) {
              return prev;
            }
            savePersistedBroadcast(null);
            return null;
          });
        }
      }
    } catch {
    } finally {
      setInitializing(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // On load, if an active message exists, go straight to edit mode
  React.useEffect(() => {
    loadActive();
  }, [loadActive]);

  // Live updates via SSE to keep admin panel in sync with user toasts
  React.useEffect(() => {
    let es: EventSource | null = null;
    try {
      es = new EventSource("/api/broadcast/stream", { withCredentials: true });
      es.addEventListener("broadcast", (ev: MessageEvent) => {
        try {
          const data =
            typeof ev.data === "string" ? JSON.parse(ev.data) : ev.data;
          const next: BroadcastRecord = {
            id: String(data?.id || ""),
            message: String(data?.message || ""),
            severity:
              data?.severity === "warning" || data?.severity === "danger"
                ? data.severity
                : "info",
            expiresAt: data?.expiresAt || null,
            adminName: data?.adminName || null,
            createdAt: data?.createdAt || null,
          };
          setActive(next);
          savePersistedBroadcast(next);
          // Pre-fill edit values if none entered yet
          setMessage((prev) =>
            prev && prev.trim().length > 0 ? prev : String(data?.message || ""),
          );
          setSeverity(
            (data?.severity === "warning" || data?.severity === "danger"
              ? data.severity
              : "info") as "info" | "warning" | "danger",
          );
          if (data?.serverTime) {
            const serverMs = Date.parse(data.serverTime);
            if (Number.isFinite(serverMs)) {
              setClockOffset(serverMs - Date.now());
            }
          }
          // Ask parent to open the section so admin sees edit/delete UI
          onActive?.();
        } catch {}
      });
      es.addEventListener("clear", () => {
        setActive(null);
        savePersistedBroadcast(null);
      });
    } catch {}
    return () => {
      try {
        es?.close();
      } catch {}
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // When current broadcast expires, revert to create form and notify parent (to re-open section)
  // DISABLED: Keep the edit form active even if expired on client, so admin can extend/edit easily.
  // The server is the authority on whether it's truly active for users.
  /*
  React.useEffect(() => {
    if (!active?.expiresAt) return;
    const remain = msRemaining(active.expiresAt);
    if (remain === null) return;
    const id = window.setTimeout(
      () => {
        setActive(null);
        savePersistedBroadcast(null);
        onExpired?.();
      },
      Math.max(0, remain),
    );
    return () => window.clearTimeout(id);
  }, [active?.expiresAt, onExpired, msRemaining]);
  */

  const onSubmit = React.useCallback(async () => {
    if (submitting) return;
    if (!message.trim()) return;
    setSubmitting(true);
    try {
      const session = (await supabase.auth.getSession()).data.session;
      const token = session?.access_token;
      const headers: Record<string, string> = {
        Accept: "application/json",
        "Content-Type": "application/json",
      };
      if (token) headers["Authorization"] = `Bearer ${token}`;
      try {
        const staticToken = (globalThis as EnvWithAdminToken)?.__ENV__
          ?.VITE_ADMIN_STATIC_TOKEN;
        if (staticToken) headers["X-Admin-Token"] = String(staticToken);
      } catch {}
      const resp = await fetch("/api/admin/broadcast", {
        method: "POST",
        headers,
        credentials: "same-origin",
        body: JSON.stringify({
          message: message.trim(),
          severity,
          durationMs: (() => {
            const v = duration;
            if (v === "unlimited" || !v) return null;
            const m = v.match(/^(\d+)([smhd])$/);
            if (!m) return null;
            const n = Number(m[1]);
            const u = m[2];
            const mult =
              u === "s"
                ? 1000
                : u === "m"
                  ? 60000
                  : u === "h"
                    ? 3600000
                    : 86400000;
            return n * mult;
          })(),
        }),
      });
      const b = await resp.json().catch(() => ({}));
      if (!resp.ok) throw new Error(b?.error || `HTTP ? ${resp.status}`);
      setActive(b?.broadcast || null);
      savePersistedBroadcast(b?.broadcast || null);
      setMessage("");
      setSeverity("warning");
    } catch (e) {
      alert((e as Error)?.message || "Failed to create broadcast");
    } finally {
      setSubmitting(false);
    }
  }, [message, submitting, duration, severity]);

  const onRemove = React.useCallback(async () => {
    if (removing) return;
    setRemoving(true);
    try {
      const session = (await supabase.auth.getSession()).data.session;
      const token = session?.access_token;
      const headers: Record<string, string> = { Accept: "application/json" };
      if (token) headers["Authorization"] = `Bearer ${token}`;
      try {
        const staticToken = (globalThis as EnvWithAdminToken)?.__ENV__
          ?.VITE_ADMIN_STATIC_TOKEN;
        if (staticToken) headers["X-Admin-Token"] = String(staticToken);
      } catch {}
      const resp = await fetch("/api/admin/broadcast", {
        method: "DELETE",
        headers,
        credentials: "same-origin",
      });
      const b = await resp.json().catch(() => ({}));
      if (!resp.ok) throw new Error(b?.error || `HTTP ? ${resp.status}`);
      setActive(null);
      savePersistedBroadcast(null);
    } catch (e) {
      alert((e as Error)?.message || "Failed to remove broadcast");
    } finally {
      setRemoving(false);
    }
  }, [removing]);

  // Duration selection removed; default send duration is 5 minutes

  const content = (
    <div>
      <div className="flex items-center justify-between">
        <div className="text-sm font-medium">Global broadcast message</div>
      </div>
      {initializing && !active ? (
        <div className="mt-3 text-sm opacity-70">
          Checking current broadcast?
        </div>
      ) : active ? (
        <div className="mt-3 grid gap-2 sm:grid-cols-[1fr_auto_auto_auto]">
          <Input
            placeholder="Edit message"
            value={message.length ? message : active.message}
            onChange={(e) => setMessage(e.target.value)}
            maxLength={200}
          />
          <select
            className="rounded-xl border border-stone-300 dark:border-[#3e3e42] px-3 py-2 text-sm bg-white dark:bg-[#2d2d30] text-black dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 transition-colors"
            value={severity || "warning"}
            onChange={(e) => {
              const v = e.target.value;
              setSeverity(
                v === "info" || v === "warning" || v === "danger" ? v : "warning",
              );
            }}
            aria-label="Type"
          >
            <option value="info">Information</option>
            <option value="warning">Warning</option>
            <option value="danger">Danger</option>
          </select>
          <select
            className="rounded-xl border border-stone-300 dark:border-[#3e3e42] px-3 py-2 text-sm bg-white dark:bg-[#2d2d30] text-black dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 transition-colors"
            value={duration}
            onChange={(e) => setDuration(e.target.value)}
            aria-label="Display time"
          >
            <option value="">Keep current</option>
            <option value="1m">1 min</option>
            <option value="5m">5 mins</option>
            <option value="30m">30 mins</option>
            <option value="1h">1 hour</option>
            <option value="5h">5 hours</option>
            <option value="1d">1 day</option>
            <option value="unlimited">Unlimited</option>
          </select>
          <div className="flex gap-2">
            <Button
              className="rounded-2xl"
              variant="secondary"
              onClick={async () => {
                try {
                  const session = (await supabase.auth.getSession()).data
                    .session;
                  const token = session?.access_token;
                  const headers: Record<string, string> = {
                    Accept: "application/json",
                    "Content-Type": "application/json",
                  };
                  if (token) headers["Authorization"] = `Bearer ${token}`;
                  try {
                    const staticToken = (globalThis as EnvWithAdminToken)?.__ENV__
                      ?.VITE_ADMIN_STATIC_TOKEN;
                    if (staticToken)
                      headers["X-Admin-Token"] = String(staticToken);
                  } catch {}
                  const resp = await fetch("/api/admin/broadcast", {
                    method: "PUT",
                    headers,
                    credentials: "same-origin",
                    body: JSON.stringify({
                      message: (message.length
                        ? message
                        : active.message
                      ).trim(),
                      severity,
                      durationMs: (() => {
                        const v = duration;
                        if (v === "" || v === "unlimited") return null;
                        const m = v.match(/^(\d+)([smhd])$/);
                        if (!m) return null;
                        const n = Number(m[1]);
                        const u = m[2];
                        const mult =
                          u === "s"
                            ? 1000
                            : u === "m"
                              ? 60000
                              : u === "h"
                                ? 3600000
                                : 86400000;
                        return n * mult;
                      })(),
                    }),
                  });
                  const b = await resp.json().catch(() => ({}));
                  if (!resp.ok)
                    throw new Error(b?.error || `HTTP ? ${resp.status}`);
                  setActive(b?.broadcast || null);
                  savePersistedBroadcast(b?.broadcast || null);
                  setMessage("");
                } catch (e) {
                  alert((e as Error)?.message || "Failed to update broadcast");
                }
              }}
            >
              Save
            </Button>
            <Button
              className="rounded-2xl"
              variant="destructive"
              onClick={onRemove}
              disabled={removing}
            >
              <Trash2 className="h-4 w-4 mr-1" /> Remove
            </Button>
          </div>
          <div className="sm:col-span-4 text-xs opacity-60">
            Submitted by {active.adminName ? active.adminName : "Admin"}
            {active.expiresAt && (
              <>
                {" "}
                ? Expires in{" "}
                {formatDuration(msRemaining(active.expiresAt) || 0)}
              </>
            )}
          </div>
        </div>
      ) : (
        <div className="mt-3 grid gap-2 sm:grid-cols-[1fr_auto_auto_auto]">
          <Input
            placeholder="Write a short message (single line)"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            maxLength={200}
          />
          <select
            className="rounded-xl border border-stone-300 dark:border-[#3e3e42] px-3 py-2 text-sm bg-white dark:bg-[#2d2d30] text-black dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 transition-colors"
            value={severity}
            onChange={(e) => {
              const v = e.target.value;
              setSeverity(
                v === "info" || v === "warning" || v === "danger" ? v : "warning",
              );
            }}
            aria-label="Type"
          >
            <option value="info">Information</option>
            <option value="warning">Warning</option>
            <option value="danger">Danger</option>
          </select>
          <select
            className="rounded-xl border border-stone-300 dark:border-[#3e3e42] px-3 py-2 text-sm bg-white dark:bg-[#2d2d30] text-black dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 transition-colors"
            value={duration}
            onChange={(e) => setDuration(e.target.value)}
            aria-label="Display time"
          >
            <option value="1m">1 min</option>
            <option value="5m">5 mins</option>
            <option value="10m">10 mins</option>
            <option value="30m">30 mins</option>
            <option value="1h">1 hour</option>
            <option value="5h">5 hours</option>
            <option value="1d">1 day</option>
            <option value="unlimited">Unlimited</option>
          </select>
          <Button
            className="rounded-2xl"
            onClick={onSubmit}
            disabled={submitting || !message.trim()}
          >
            Send
          </Button>
        </div>
      )}
    </div>
  );
  if (inline) return content;
  return (
    <Card className="rounded-2xl">
      <CardContent className="p-4">{content}</CardContent>
    </Card>
  );
};

// parseDurationToMs removed

export default AdminPage;

function AddAdminNote({
  profileId,
  onAdded,
}: {
  profileId: string;
  onAdded: () => void;
}) {
  const [value, setValue] = React.useState("");
  const [submitting, setSubmitting] = React.useState(false);
  const [open, setOpen] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const submit = async () => {
    if (!profileId || !value.trim() || submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      const session = (await supabase.auth.getSession()).data.session;
      const token = session?.access_token;
      const headers: Record<string, string> = {
        Accept: "application/json",
        "Content-Type": "application/json",
      };
      if (token) headers["Authorization"] = `Bearer ${token}`;
      try {
        const adminToken = (globalThis as EnvWithAdminToken)?.__ENV__
          ?.VITE_ADMIN_STATIC_TOKEN;
        if (adminToken) headers["X-Admin-Token"] = String(adminToken);
      } catch {}
      const resp = await fetch("/api/admin/member-note", {
        method: "POST",
        headers,
        credentials: "same-origin",
        body: JSON.stringify({ profileId, message: value.trim() }),
      });
      const data = await resp.json().catch(() => ({}));
      if (!resp.ok) throw new Error(data?.error || `HTTP ${resp.status}`);
      // Log note create (UI)
      try {
        const headers2: Record<string, string> = {
          Accept: "application/json",
          "Content-Type": "application/json",
        };
        if (token) headers2["Authorization"] = `Bearer ${token}`;
        try {
          const adminToken = (globalThis as EnvWithAdminToken)?.__ENV__
            ?.VITE_ADMIN_STATIC_TOKEN;
          if (adminToken) headers2["X-Admin-Token"] = String(adminToken);
        } catch {}
        await fetch("/api/admin/log-action", {
          method: "POST",
          headers: headers2,
          credentials: "same-origin",
          body: JSON.stringify({
            action: "add_note",
            target: profileId,
            detail: { source: "ui" },
          }),
        });
      } catch {}
      setValue("");
      setOpen(false);
      onAdded();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save note");
    } finally {
      setSubmitting(false);
    }
  };

  const disabled = !profileId || !value.trim() || submitting;

  return (
    <div className="w-full">
      {!open ? (
        <Button onClick={() => setOpen(true)} className="rounded-2xl" size="sm">
          Add note
        </Button>
      ) : (
        <div className="space-y-2">
          <Textarea
            placeholder="Add a note for other admins (visible only to admins)"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            className="min-h-[80px] w-full"
          />
          {error && (
            <div className="text-sm text-red-500">{error}</div>
          )}
          <div className="flex gap-2">
            <Button
              onClick={submit}
              disabled={disabled}
              className="rounded-2xl"
              size="sm"
            >
              {submitting ? "Saving..." : "Save"}
            </Button>
            <Button
              variant="secondary"
              onClick={() => {
                setOpen(false);
                setValue("");
                setError(null);
              }}
              className="rounded-2xl"
              size="sm"
            >
              Cancel
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

function NoteRow({
  note,
  onRemoved,
}: {
  note: {
    id: string;
    admin_id: string | null;
    admin_name: string | null;
    message: string;
    created_at: string | null;
  };
  onRemoved: () => void;
}) {
  const [removing, setRemoving] = React.useState(false);
  const remove = React.useCallback(async () => {
    if (removing) return;
    setRemoving(true);
    try {
      const session = (await supabase.auth.getSession()).data.session;
      const token = session?.access_token;
      const headers: Record<string, string> = { Accept: "application/json" };
      if (token) headers["Authorization"] = `Bearer ${token}`;
      try {
        const adminToken = (globalThis as EnvWithAdminToken)?.__ENV__
          ?.VITE_ADMIN_STATIC_TOKEN;
        if (adminToken) headers["X-Admin-Token"] = String(adminToken);
      } catch {}
      const resp = await fetch(
        `/api/admin/member-note/${encodeURIComponent(note.id)}`,
        { method: "DELETE", headers, credentials: "same-origin" },
      );
      if (!resp.ok) {
        // ignore error UI for now
      }
      // Log note delete (UI)
      try {
        const headers2: Record<string, string> = {
          Accept: "application/json",
          "Content-Type": "application/json",
        };
        if (token) headers2["Authorization"] = `Bearer ${token}`;
        try {
          const adminToken = (globalThis as EnvWithAdminToken)?.__ENV__
            ?.VITE_ADMIN_STATIC_TOKEN;
          if (adminToken) headers2["X-Admin-Token"] = String(adminToken);
        } catch {}
        await fetch("/api/admin/log-action", {
          method: "POST",
          headers: headers2,
          credentials: "same-origin",
          body: JSON.stringify({
            action: "delete_note",
            target: note.id,
            detail: { source: "ui" },
          }),
        });
      } catch {}
      onRemoved();
    } catch {
      // noop
    } finally {
      setRemoving(false);
    }
  }, [note?.id, removing, onRemoved]);
  const [confirming, setConfirming] = React.useState(false);
  return (
    <div className="rounded-xl border border-stone-300 dark:border-[#3e3e42] p-3 bg-white dark:bg-[#252526]">
      <div className="text-xs opacity-60 flex items-center justify-between">
        <span>{note.admin_name || "Admin"}</span>
        <div className="flex items-center gap-2">
          <span>
            {note.created_at ? new Date(note.created_at).toLocaleString() : ""}
          </span>
          {!confirming ? (
            <button
              type="button"
              aria-label="Delete note"
              className="px-2 py-1 rounded hover:bg-rose-50 dark:hover:bg-rose-950/30 text-rose-600 dark:text-rose-400"
              onClick={() => setConfirming(true)}
            >
              <Trash2 className="h-4 w-4" />
            </button>
          ) : (
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                variant="destructive"
                onClick={remove}
                disabled={removing}
                className="h-7 px-2 rounded-xl"
              >
                Confirm
              </Button>
              <Button
                size="sm"
                variant="secondary"
                onClick={() => setConfirming(false)}
                className="h-7 px-2 rounded-xl"
              >
                Cancel
              </Button>
            </div>
          )}
        </div>
      </div>
      <div className="text-xs mt-1 font-mono whitespace-pre-wrap break-words text-black dark:text-white">
        {note.message}
      </div>
    </div>
  );
}
