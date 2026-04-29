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
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { LazyCharts, ChartSuspense } from "@/components/admin/LazyChart";
import { AdminUploadMediaPanel } from "@/components/admin/AdminUploadMediaPanel";
import { AdminNotificationsPanel } from "@/components/admin/AdminNotificationsPanel";
import { AdminEmailsPanel } from "@/components/admin/AdminEmailsPanel";
import { AdminAdvancedPanel } from "@/components/admin/AdminAdvancedPanel";
import { AdminEventsPanel } from "@/components/admin/AdminEventsPanel";
import { AdminStocksPanel } from "@/components/admin/AdminStocksPanel";
import { AdminReportsPanel } from "@/components/admin/AdminReportsPanel";
import { AdminBugsPanel } from "@/components/admin/AdminBugsPanel";
import { AdminPlantReportsPanel } from "@/components/admin/AdminPlantReportsPanel";
import { AdminUserMessagesDialog } from "@/components/admin/AdminUserMessagesDialog";
import { useTheme } from "@/context/ThemeContext";
import { useAuth } from "@/context/AuthContext";
import { getAccentOption, type AccentKey } from "@/lib/accent";
import { Link } from "@/components/i18n/Link";
import { useLanguageNavigate, useLanguage } from "@/lib/i18nRouting";
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
  ArrowDownUp,
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
  SlidersHorizontal,
  Globe,
  Smartphone,
  Monitor,
  Tablet,
  Activity,
  Eye,
  MousePointer,
  ArrowDownRight,
  Gamepad2,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuSub,
  DropdownMenuSubTrigger,
  DropdownMenuSubContent,
  DropdownMenuCheckboxItem,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { SearchInput } from "@/components/ui/search-input";
import { SearchItem, type SearchItemOption } from "@/components/ui/search-item";
import { PillTabs } from "@/components/ui/pill-tabs";
import { supabase } from "@/lib/supabaseClient";
import { cn } from "@/lib/utils";
import { setUserThreatLevel, getReportCounts } from "@/lib/moderation";
import { type ThreatLevel } from "@/types/moderation";
import {
  loadPersistedBroadcast,
  savePersistedBroadcast,
  type BroadcastRecord,
} from "@/lib/broadcastStorage";
import { processAllPlantRequests, aiFieldOrder as aiPrefillFieldOrder } from "@/lib/aiPrefillService";
import { logPlantHistory, logPlantHistoryBatch } from "@/lib/plantHistory";
import { labelForField } from "@/lib/plantHistoryDiff";
import { IMAGE_SOURCES, type SourceResult, type ExternalImageSource } from "@/lib/externalImages";
import { getEnglishPlantName } from "@/lib/aiPlantFill";
import { Languages, Settings, GraduationCap, ListChecks } from "lucide-react";
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
  | "events"
  | "admin_logs";

type ListedMember = {
  id: string;
  email: string | null;
  displayName: string | null;
  createdAt: string | null;
  isAdmin: boolean;
  roles: string[];
  rpm5m: number | null;
  lastVisitAt: string | null;
  visits7d: number;
};

type MemberListSort = "newest" | "oldest" | "rpm" | "role" | "active";

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

const FEATURED_MONTH_SLUGS = [
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

type FeaturedMonthSlug = (typeof FEATURED_MONTH_SLUGS)[number];

const FEATURED_MONTH_LABELS: Record<FeaturedMonthSlug, string> = {
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

// -- Quick-action label maps --------------------------------------------------

const LIVING_SPACE_OPTIONS = [
  { value: "indoor", label: "Indoor" },
  { value: "outdoor", label: "Outdoor" },
  { value: "terrarium", label: "Terrarium" },
  { value: "greenhouse", label: "Greenhouse" },
] as const;

const PLANT_TYPE_OPTIONS = [
  { value: "herb", label: "Herb" },
  { value: "shrub", label: "Shrub" },
  { value: "tree", label: "Tree" },
  { value: "climber", label: "Climber" },
  { value: "succulent", label: "Succulent" },
  { value: "fern", label: "Fern" },
  { value: "moss", label: "Moss" },
  { value: "grass", label: "Grass" },
] as const;

const CLIMATE_OPTIONS = [
  { value: "polar", label: "Polar" },
  { value: "montane", label: "Montane" },
  { value: "oceanic", label: "Oceanic" },
  { value: "degraded_oceanic", label: "Degraded Oceanic" },
  { value: "temperate_continental", label: "Temperate Continental" },
  { value: "mediterranean", label: "Mediterranean" },
  { value: "tropical_dry", label: "Tropical Dry" },
  { value: "tropical_humid", label: "Tropical Humid" },
  { value: "tropical_volcanic", label: "Tropical Volcanic" },
  { value: "tropical_cyclonic", label: "Tropical Cyclonic" },
  { value: "humid_insular", label: "Humid Insular" },
  { value: "subtropical_humid", label: "Subtropical Humid" },
  { value: "equatorial", label: "Equatorial" },
  { value: "windswept_coastal", label: "Windswept Coastal" },
] as const;

const TOXICITY_OPTIONS = [
  { value: "non_toxic", label: "Non-toxic" },
  { value: "slightly_toxic", label: "Slightly Toxic" },
  { value: "very_toxic", label: "Very Toxic" },
  { value: "deadly", label: "Deadly" },
  { value: "undetermined", label: "Undetermined" },
] as const;

const SUNLIGHT_OPTIONS = [
  { value: "full_sun", label: "Full Sun" },
  { value: "partial_sun", label: "Partial Sun" },
  { value: "partial_shade", label: "Partial Shade" },
  { value: "light_shade", label: "Light Shade" },
  { value: "deep_shade", label: "Deep Shade" },
  { value: "direct_light", label: "Direct Light" },
  { value: "bright_indirect_light", label: "Bright Indirect Light" },
  { value: "medium_light", label: "Medium Light" },
  { value: "low_light", label: "Low Light" },
] as const;

const CARE_LEVEL_OPTIONS = [
  { value: "easy", label: "Easy" },
  { value: "moderate", label: "Moderate" },
  { value: "complex", label: "Complex" },
] as const;

type PlantDashboardRow = {
  id: string;
  name: string;
  variety: string | null;
  givenNames: string[];
  tags: string[];
  // Localized fields for the user's current language (used for search)
  localizedName: string | null;
  localizedVariety: string | null;
  localizedGivenNames: string[];
  localizedTags: string[];
  status: NormalizedPlantStatus;
  featuredMonths: FeaturedMonthSlug[];
  primaryImage: string | null;
  updatedAt: number | null;
  createdAt: number | null;
  gardensCount: number;
  likesCount: number;
  viewsCount: number;
  imagesCount: number;
  // Quick-action fields
  livingSpace: string[];
  plantType: string | null;
  climate: string[];
  toxicityHuman: string | null;
  toxicityPets: string | null;
  sunlight: string[];
  careLevel: string[];
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

const toFeaturedMonthSlugs = (
  value?: unknown,
): FeaturedMonthSlug[] => {
  if (!value) return [];
  // featured_month is a text[] in the DB – Supabase returns it as a JS array
  const items: unknown[] = Array.isArray(value) ? value : typeof value === 'string' ? [value] : [];
  return items
    .filter((v): v is string => typeof v === 'string' && v.length > 0)
    .map((v) => v.toLowerCase())
    .filter((v): v is FeaturedMonthSlug =>
      (FEATURED_MONTH_SLUGS as readonly string[]).includes(v),
    );
};

// Constants for persisting admin plants list state in sessionStorage
const ADMIN_PLANTS_STATE_KEY = "admin-plants-list-state";
const VALID_SORT_OPTIONS: PlantSortOption[] = ["status", "updated", "created", "name", "gardens", "likes", "views", "images"];

// Type for persisted plant list state
type AdminPlantsListState = {
  searchQuery: string;
  sortOption: PlantSortOption;
  featuredMonth: FeaturedMonthSlug | "none" | "all";
  statuses: NormalizedPlantStatus[];
  scrollPosition: number;
  pageSize: number;
};

const DEFAULT_PLANT_PAGE_SIZE = 50;
const PLANT_PAGE_SIZE_OPTIONS = [25, 50, 100, 200] as const;

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
    
    if (parsed.featuredMonth === "all" || parsed.featuredMonth === "none" || 
        (FEATURED_MONTH_SLUGS as readonly string[]).includes(parsed.featuredMonth)) {
      result.featuredMonth = parsed.featuredMonth;
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

    if (typeof parsed.pageSize === "number" && (PLANT_PAGE_SIZE_OPTIONS as readonly number[]).includes(parsed.pageSize)) {
      result.pageSize = parsed.pageSize;
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
  const currentLang = useLanguage();
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

  const formatCompactNumber = React.useCallback((value: number): string => {
    if (value >= 1_000_000_000) return `${(value / 1_000_000_000).toFixed(value % 1_000_000_000 === 0 ? 0 : 1)} B`;
    if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(value % 1_000_000 === 0 ? 0 : 1)} M`;
    if (value >= 1_000) return `${(value / 1_000).toFixed(value % 1_000 === 0 ? 0 : 1)} K`;
    return String(value);
  }, []);

  const formatRpmValue = React.useCallback((value?: number | null): string => {
    if (typeof value === "number" && Number.isFinite(value)) {
      return value.toFixed(2);
    }
    return "0.00";
  }, []);

  const formatLastVisit = React.useCallback((value?: string | null): string => {
    if (!value) return "Never";
    try {
      const date = new Date(value);
      if (Number.isNaN(date.getTime())) return value;
      const now = Date.now();
      const diff = now - date.getTime();
      const mins = Math.floor(diff / 60000);
      if (mins < 1) return "Just now";
      if (mins < 60) return `${mins}m ago`;
      const hrs = Math.floor(mins / 60);
      if (hrs < 24) return `${hrs}h ago`;
      const days = Math.floor(hrs / 24);
      if (days < 7) return `${days}d ago`;
      if (days < 30) return `${Math.floor(days / 7)}w ago`;
      return date.toLocaleDateString();
    } catch {
      return String(value);
    }
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
  const [refreshingAphydle, setRefreshingAphydle] = React.useState(false);
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
        { value: "active", label: "Active" },
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
    // Aphydle (sister daily plant guessing game) — players for today's puzzle
    const [aphydlePlayersToday, setAphydlePlayersToday] = React.useState<number | null>(null);
    const [aphydleVisitsToday, setAphydleVisitsToday] = React.useState<number | null>(null);
    const [aphydleStatsLoading, setAphydleStatsLoading] = React.useState<boolean>(true);
    const [aphydleStatsRefreshing, setAphydleStatsRefreshing] = React.useState<boolean>(false);
    const [aphydleStatsUpdatedAt, setAphydleStatsUpdatedAt] = React.useState<number | null>(null);

    // Aphydle full analytics (time series + last puzzles + totals) for the
    // analytics tab in the GA section. Only fetched when the user switches to
    // the "Aphydle" pill so we don't waste round-trips on the default view.
    type AphydleSeriesPoint = { date: string; visits: number; players: number; attempts: number; wins: number };
    type AphydlePuzzleRow = {
      puzzleNo: number;
      puzzleDate: string;
      plantId: string | null;
      plantName: string | null;
      players: number;
      wins: number;
      losses: number;
      totalPlayed: number;
      buckets: number[];
    };
    type AphydleAnalytics = {
      totals: { visits: number; plays: number; guesses: number; wins: number };
      timeSeries: AphydleSeriesPoint[];
      lastPuzzles: AphydlePuzzleRow[];
    };
    const [analyticsTab, setAnalyticsTab] = React.useState<"aphylia" | "aphydle">("aphylia");
    const [aphydleAnalytics, setAphydleAnalytics] = React.useState<AphydleAnalytics | null>(null);
    const [aphydleAnalyticsLoading, setAphydleAnalyticsLoading] = React.useState<boolean>(false);
    const [aphydleAnalyticsError, setAphydleAnalyticsError] = React.useState<string | null>(null);
    const [aphydleAnalyticsUpdatedAt, setAphydleAnalyticsUpdatedAt] = React.useState<number | null>(null);
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
  // Connected IPs (last 60 minutes) — enriched with visits, RPM, country, account linkage
  type EnrichedIp = { ip: string; visits: number; country: string | null; hasAccount: boolean; rpm: number };
  const [enrichedIps, setEnrichedIps] = React.useState<EnrichedIp[]>([]);
  const [ipsLoading, setIpsLoading] = React.useState<boolean>(true);
  const [ipsRefreshing, setIpsRefreshing] = React.useState<boolean>(false);
  const [ipsUpdatedAt, setIpsUpdatedAt] = React.useState<number | null>(null);

  // --- Google Analytics Data API state ---
  const [gaConfigured, setGaConfigured] = React.useState<boolean | null>(null);
  const [gaLoading, setGaLoading] = React.useState<boolean>(false);
  const [gaError, setGaError] = React.useState<string | null>(null);
  const [gaDays, setGaDays] = React.useState<7 | 14 | 30>(30);
  const [gaRealtime, setGaRealtime] = React.useState<{
    activeUsers: number;
    countries: Array<{ country: string; users: number }>;
    devices: Array<{ device: string; users: number }>;
  } | null>(null);
  const [gaOverview, setGaOverview] = React.useState<{
    metrics: Record<string, number>;
    deltas: Record<string, number | null>;
  } | null>(null);
  const [gaSeries, setGaSeries] = React.useState<
    Array<{ date: string; users: number; pageViews: number; sessions: number; newUsers: number }>
  >([]);
  const [gaTopPages, setGaTopPages] = React.useState<
    Array<{ path: string; views: number; users: number; avgDuration: number }>
  >([]);
  const [gaDevices, setGaDevices] = React.useState<{
    devices: Array<{ device: string; users: number; sessions: number }>;
    browsers: Array<{ browser: string; users: number }>;
  } | null>(null);
  const [gaAcquisition, setGaAcquisition] = React.useState<{
    channels: Array<{ channel: string; sessions: number; users: number; newUsers: number }>;
    sources: Array<{ source: string; sessions: number; users: number }>;
  } | null>(null);
  const [gaGeo, setGaGeo] = React.useState<{
    countries: Array<{ country: string; users: number; sessions: number }>;
    cities: Array<{ city: string; users: number }>;
  } | null>(null);
  const [gaUpdatedAt, setGaUpdatedAt] = React.useState<number | null>(null);
  const [mapTooltip, setMapTooltip] = React.useState<{ country: string; users: number; sessions: number; pct: number; color: string; x: number; y: number } | null>(null);
  const [gaRealtimeUpdatedAt, setGaRealtimeUpdatedAt] = React.useState<number | null>(null);
  const [gaOpen, setGaOpen] = React.useState<boolean>(true);
  const [gaChartMetrics, setGaChartMetrics] = React.useState<Set<string>>(() => new Set(["users", "pageViews", "sessions", "newUsers"]));
  const gaDeviceColors = ["#3b82f6", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6"];
  const gaChannelColors = ["#111827", "#3b82f6", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#06b6d4", "#d946ef"];

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
    /** Number of unique users who requested this plant */
    user_count: number;
    /** Display name of the sole requester (only populated when user_count === 1) */
    single_requester_name: string | null;
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
  /** Sort order for plant requests: "newest" (default) or "oldest" */
  const [requestSortOrder, setRequestSortOrder] = React.useState<"newest" | "oldest">("newest");
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

  // Filtered plant requests (staff filter + search) — shared by UI and AI Prefill
  const filteredPlantRequests = React.useMemo(() => {
    const staffFiltered = hideStaffRequests
      ? plantRequests.filter((req) => req.requester_is_staff !== true)
      : plantRequests;
    return requestSearchQuery.trim()
      ? staffFiltered.filter((req) =>
          req.plant_name
            .toLowerCase()
            .includes(requestSearchQuery.toLowerCase().trim()),
        )
      : staffFiltered;
  }, [plantRequests, hideStaffRequests, requestSearchQuery]);

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
  const [selectedFeaturedMonth, setSelectedFeaturedMonth] = React.useState<
    FeaturedMonthSlug | "none" | "all"
  >(savedPlantsState.featuredMonth ?? "all");
  const [plantSearchQuery, setPlantSearchQuery] =
    React.useState<string>(savedPlantsState.searchQuery ?? "");
  const [plantSortOption, setPlantSortOption] = React.useState<PlantSortOption>(
    savedPlantsState.sortOption ?? "status"
  );
  const [plantPageSize, setPlantPageSize] = React.useState<number>(
    savedPlantsState.pageSize ?? DEFAULT_PLANT_PAGE_SIZE
  );
  const [plantVisibleCount, setPlantVisibleCount] = React.useState<number>(
    savedPlantsState.pageSize ?? DEFAULT_PLANT_PAGE_SIZE
  );
  const [plantToDelete, setPlantToDelete] = React.useState<{ id: string; name: string } | null>(null);
  const [deletePlantDialogOpen, setDeletePlantDialogOpen] = React.useState(false);
  const [deletingPlant, setDeletingPlant] = React.useState(false);
  const [isAnalyticsPanelCollapsed, setIsAnalyticsPanelCollapsed] =
    React.useState<boolean>(true);
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
          featuredMonth: selectedFeaturedMonth,
          statuses: visiblePlantStatuses,
          scrollPosition: 0,
          pageSize: plantPageSize,
        });
      }, 100);
    } else {
      // No scroll to restore, but mark as done
      scrollRestoredRef.current = true;
    }
  }, [currentPath, plantDashboardInitialized, plantSearchQuery, plantSortOption, selectedFeaturedMonth, visiblePlantStatuses]);

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

  // Category labels for display — keys must match PlantFormCategory values
  const aiPrefillCategoryLabels: Record<PlantFormCategory, string> = {
    base: 'Base',
    identity: 'Identity',
    care: 'Care',
    growth: 'Growth',
    danger: 'Danger',
    ecology: 'Ecology',
    consumption: 'Consumption',
    misc: 'Misc',
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
          user_count: 0,
          single_requester_name: null as string | null,
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

  /** Enrich rows with user_count and single_requester_name from plant_request_users + profiles */
  const enrichRowsWithUserCounts = React.useCallback(
    async (rows: PlantRequestRow[]): Promise<PlantRequestRow[]> => {
      if (rows.length === 0) return rows;
      try {
        const requestIds = rows.map((r) => r.id);

        // Batch-fetch all junction rows for these request IDs
        const allJunctionRows: { requested_plant_id: string; user_id: string }[] = [];
        const batchSize = 50;
        for (let i = 0; i < requestIds.length; i += batchSize) {
          const batch = requestIds.slice(i, i + batchSize);
          const { data } = await supabase
            .from("plant_request_users")
            .select("requested_plant_id, user_id")
            .in("requested_plant_id", batch);
          if (data) allJunctionRows.push(...(data as { requested_plant_id: string; user_id: string }[]));
        }

        // Build a map: request_id -> Set of unique user_ids
        const usersByRequest = new Map<string, Set<string>>();
        for (const jr of allJunctionRows) {
          const set = usersByRequest.get(jr.requested_plant_id) ?? new Set();
          set.add(jr.user_id);
          usersByRequest.set(jr.requested_plant_id, set);
        }

        // Collect user IDs that are the sole requester (user_count === 1)
        const singleUserIds = new Set<string>();
        for (const row of rows) {
          const users = usersByRequest.get(row.id);
          const count = users?.size ?? 0;
          if (count === 1) {
            singleUserIds.add([...users!][0]);
          } else if (count === 0 && row.requested_by) {
            // Fallback: if no junction rows exist, use requested_by
            singleUserIds.add(row.requested_by);
          }
        }

        // Fetch display_name for single-requester user IDs
        const profileMap = new Map<string, string>();
        if (singleUserIds.size > 0) {
          const userIdArr = [...singleUserIds];
          for (let i = 0; i < userIdArr.length; i += batchSize) {
            const batch = userIdArr.slice(i, i + batchSize);
            const { data: profiles } = await supabase
              .from("profiles")
              .select("id, display_name")
              .in("id", batch);
            if (profiles) {
              for (const p of profiles as { id: string; display_name: string | null }[]) {
                if (p.display_name) profileMap.set(p.id, p.display_name);
              }
            }
          }
        }

        // Enrich rows
        return rows.map((row) => {
          const users = usersByRequest.get(row.id);
          const userCount = users?.size ?? (row.requested_by ? 1 : 0);
          let singleName: string | null = null;
          if (userCount === 1) {
            const userId = users ? [...users][0] : row.requested_by;
            if (userId) singleName = profileMap.get(userId) ?? null;
          }
          return { ...row, user_count: userCount, single_requester_name: singleName };
        });
      } catch (err) {
        console.error("Failed to enrich request rows with user counts:", err);
        return rows;
      }
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
            .order("created_at", { ascending: requestSortOrder === "oldest" })
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

        const enrichedRows = await enrichRowsWithUserCounts(allRows);
        setPlantRequests(enrichedRows);
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
    [parseRequestRows, enrichRowsWithStaffStatus, loadStaffUserIds, hideStaffRequests, enrichRowsWithUserCounts, requestSortOrder],
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
          .order("created_at", { ascending: requestSortOrder === "oldest" })
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

      const enrichedNewRows = await enrichRowsWithUserCounts(newRows);
      setPlantRequests((prev) => [...prev, ...enrichedNewRows]);
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
    enrichRowsWithUserCounts,
    requestSortOrder,
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
    async (id: string, plantName: string) => {
      if (!id || completingRequestId) return;
      if (!user?.id) {
        setPlantRequestsError("You must be signed in to complete requests.");
        return;
      }
      setCompletingRequestId(id);
      setPlantRequestsError(null);
      try {
        // Notify requesting users BEFORE deleting (delete cascades plant_request_users)
        try {
          const session = (await supabase.auth.getSession()).data.session
          if (session?.access_token) {
            await fetch('/api/admin/notify-plant-requesters', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${session.access_token}`,
              },
              credentials: 'same-origin',
              body: JSON.stringify({ requestId: id, plantName }),
            })
          }
        } catch (notifyErr) {
          console.warn('[completePlantRequest] Failed to notify requesters:', notifyErr)
        }

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

  const dismissPlantRequest = React.useCallback(
    async (id: string) => {
      if (!id || completingRequestId) return;
      setCompletingRequestId(id);
      setPlantRequestsError(null);
      try {
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
    [completingRequestId, loadPlantRequests],
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
      // Combine name + variety for display in the request list (requested_plants only has plant_name)
      const translatedName = result.variety
        ? `${result.englishName} '${result.variety}'`
        : result.englishName;
      
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
        featuredMonth: selectedFeaturedMonth,
        statuses: visiblePlantStatuses,
        scrollPosition: window.scrollY,
        pageSize: plantPageSize,
      });
      navigate(`/create/${plantId}`);
    },
    [navigate, plantSearchQuery, plantSortOption, selectedFeaturedMonth, visiblePlantStatuses],
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

  const searchPlantsForAddFrom = React.useCallback(async (query: string): Promise<SearchItemOption[]> => {
    const trimmed = query.trim();
    if (!trimmed) {
      return [];
    }
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

      // Also search by variety, common_names, or translated name in translations table (current language)
      const { data: translationMatches, error: transError } = await supabase
        .from("plant_translations")
        .select("plant_id, name, variety, common_names, plants!inner(id, name, scientific_name_species, status)")
        .eq("language", currentLang)
        .limit(100);
      if (transError) throw transError;

      // Filter translation matches where variety, common_names, or translated name contains the search term
      const termLower = trimmed.toLowerCase();
      const translationPlantIds = new Set<string>();
      const translationPlants: Array<{ id: string; name: string; translatedName?: string | null; scientific_name_species?: string | null; status?: string | null }> = [];
      // Build a map of plant_id -> translated name for display
      const translatedNameMap = new Map<string, string>();

      (translationMatches || []).forEach((row: unknown) => {
        const r = row as Record<string, unknown>;
        const givenNames = Array.isArray(r?.common_names) ? r.common_names : [];
        const varietyStr = typeof r?.variety === 'string' ? r.variety : '';
        const translatedName = typeof r?.name === 'string' ? r.name : '';
        const matchesTerm = givenNames.some(
          (gn: unknown) => typeof gn === "string" && gn.toLowerCase().includes(termLower)
        ) || varietyStr.toLowerCase().includes(termLower)
          || translatedName.toLowerCase().includes(termLower);

        // Store translated name for all entries regardless of match (for display of direct matches)
        if (r?.plants && typeof r.plants === "object" && r.plants !== null && "id" in r.plants) {
          const plants = r.plants as Record<string, unknown>;
          const pid = String(plants.id);
          if (translatedName) {
            translatedNameMap.set(pid, translatedName);
          }
        }

        if (matchesTerm && r?.plants && typeof r.plants === "object" && r.plants !== null && "id" in r.plants && !translationPlantIds.has(String((r.plants as Record<string, unknown>).id))) {
          const plants = r.plants as Record<string, unknown>;
          translationPlantIds.add(String(plants.id));
          translationPlants.push({
            id: String(plants.id),
            name: String(plants.name || ""),
            translatedName: translatedName || null,
            scientific_name_species: plants.scientific_name_species || null,
            status: plants.status || null,
          });
        }
      });

      // Merge results, avoiding duplicates
      const seenIds = new Set<string>();
      const merged: Array<{ id: string; name: string; translatedName?: string | null; scientific_name_species?: string | null; status?: string | null }> = [];

      (directMatches || []).forEach((plant: unknown) => {
        const p = plant as Record<string, unknown>;
        if (p?.id && !seenIds.has(String(p.id))) {
          seenIds.add(String(p.id));
          merged.push({
            id: String(p.id),
            name: String(p.name || ""),
            translatedName: translatedNameMap.get(String(p.id)) || null,
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

      // Sort by display name and limit to 20
      merged.sort((a, b) => {
        const nameA = a.translatedName || a.name || "";
        const nameB = b.translatedName || b.name || "";
        return nameA.localeCompare(nameB);
      });
      const limited = merged.slice(0, 20);

      // Fetch primary images for results
      const imageMap = new Map<string, string>();
      if (limited.length > 0) {
        const { data: imagesData } = await supabase
          .from('plant_images')
          .select('plant_id, link')
          .in('plant_id', limited.map(p => p.id))
          .eq('use', 'primary');
        if (imagesData) imagesData.forEach((img: any) => {
          if (img.plant_id && img.link) imageMap.set(img.plant_id, img.link);
        });
      }

      // Fetch variety from translations for results
      const varietyMap = new Map<string, string>();
      if (limited.length > 0) {
        const { data: varData } = await supabase
          .from('plant_translations')
          .select('plant_id, variety')
          .eq('language', currentLang)
          .in('plant_id', limited.map(p => p.id));
        if (varData) varData.forEach((v: any) => {
          if (v.plant_id && v.variety) varietyMap.set(v.plant_id, v.variety);
        });
      }

      return limited.map((plant) => ({
        id: plant.id,
        label: plant.translatedName || plant.name,
        // Store image URL in description (used by renderItem)
        description: imageMap.get(plant.id) || null,
        // Store variety, scientific name, and status as JSON in meta for renderItem
        meta: JSON.stringify({
          variety: varietyMap.get(plant.id) || null,
          scientificName: plant.scientific_name_species || null,
          status: plant.status || null,
        }),
      }));
    } catch (err) {
      console.error("Failed to search plants:", err);
      return [];
    }
  }, [currentLang]);

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
          status: 'in_progress',
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
            living_space,
            plant_type,
            climate,
            toxicity_human,
            toxicity_pets,
            sunlight,
            care_level,
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
            .select("plant_id, common_names, variety, plant_tags")
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

      // Build maps of plant_id -> common_names and plant_id -> variety
      const givenNamesMap = new Map<string, string[]>();
      const varietyMap = new Map<string, string>();
      const tagsMap = new Map<string, string[]>();
      (translationsData || []).forEach((t: unknown) => {
        const tr = t as Record<string, unknown>;
        if (tr?.plant_id) {
          if (Array.isArray(tr.common_names)) {
            givenNamesMap.set(String(tr.plant_id), (tr.common_names as unknown[]).map((n: unknown) => String(n || "")));
          }
          if (tr.variety && typeof tr.variety === "string") {
            varietyMap.set(String(tr.plant_id), tr.variety);
          }
          if (Array.isArray(tr.plant_tags)) {
            tagsMap.set(String(tr.plant_id), (tr.plant_tags as unknown[]).map((tag: unknown) => String(tag || "")));
          }
        }
      });

      // Fetch translations for the user's current language (if not English)
      // so admins can search plants in their own language
      const localizedNameMap = new Map<string, string>();
      const localizedGivenNamesMap = new Map<string, string[]>();
      const localizedVarietyMap = new Map<string, string>();
      const localizedTagsMap = new Map<string, string[]>();
      if (currentLang !== "en") {
        const allLocalizedTranslations: unknown[] = [];
        let offset = 0;
        const pageSize = 1000;
        let hasMore = true;
        while (hasMore) {
          const { data, error: trError } = await supabase
            .from("plant_translations")
            .select("plant_id, name, common_names, variety, plant_tags")
            .eq("language", currentLang)
            .range(offset, offset + pageSize - 1);
          if (trError) break;
          if (!data || data.length === 0) { hasMore = false; break; }
          allLocalizedTranslations.push(...data);
          offset += data.length;
          if (data.length < pageSize) hasMore = false;
        }
        const localizedTranslationsData = allLocalizedTranslations.filter((t: unknown) => {
          const tr = t as Record<string, unknown>;
          return tr?.plant_id && plantIdSet.has(String(tr.plant_id));
        });
        (localizedTranslationsData || []).forEach((t: unknown) => {
          const tr = t as Record<string, unknown>;
          if (tr?.plant_id) {
            const pid = String(tr.plant_id);
            if (tr.name && typeof tr.name === "string") {
              localizedNameMap.set(pid, tr.name);
            }
            if (Array.isArray(tr.common_names)) {
              localizedGivenNamesMap.set(pid, (tr.common_names as unknown[]).map((n: unknown) => String(n || "")));
            }
            if (tr.variety && typeof tr.variety === "string") {
              localizedVarietyMap.set(pid, tr.variety);
            }
            if (Array.isArray(tr.plant_tags)) {
              localizedTagsMap.set(pid, (tr.plant_tags as unknown[]).map((tag: unknown) => String(tag || "")));
            }
          }
        });
      }

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
          const tags = tagsMap.get(plantId) || [];

            return {
              id: plantId,
              name: r?.name ? String(r.name) : "Unnamed plant",
              variety: varietyMap.get(plantId) || null,
              givenNames,
              tags,
              localizedName: localizedNameMap.get(plantId) || null,
              localizedVariety: localizedVarietyMap.get(plantId) || null,
              localizedGivenNames: localizedGivenNamesMap.get(plantId) || [],
              localizedTags: localizedTagsMap.get(plantId) || [],
              status: normalizePlantStatus(r?.status),
              featuredMonths: toFeaturedMonthSlugs(r?.featured_month),
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
              livingSpace: Array.isArray(r?.living_space) ? (r.living_space as string[]) : [],
              plantType: r?.plant_type ? String(r.plant_type) : null,
              climate: Array.isArray(r?.climate) ? (r.climate as string[]) : [],
              toxicityHuman: r?.toxicity_human ? String(r.toxicity_human) : null,
              toxicityPets: r?.toxicity_pets ? String(r.toxicity_pets) : null,
              sunlight: Array.isArray(r?.sunlight) ? (r.sunlight as string[]) : [],
              careLevel: Array.isArray(r?.care_level) ? (r.care_level as string[]) : [],
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
  }, [currentLang]);

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
  }, [visiblePlantStatuses, selectedFeaturedMonth, plantSearchQuery]);

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
        const failedIds: string[] = [];
        // Update in batches of 50 to avoid URL length issues
        const batchSize = 50;
        for (let i = 0; i < ids.length; i += batchSize) {
          const batch = ids.slice(i, i + batchSize);
          const { error } = await supabase
            .from('plants')
            .update({ status: dbStatus })
            .in('id', batch);
          if (error) {
            // Batch failed (likely due to constraint violations on some rows).
            // Fall back to updating each plant individually so valid ones still succeed.
            for (const id of batch) {
              const { error: singleError } = await supabase
                .from('plants')
                .update({ status: dbStatus })
                .eq('id', id);
              if (singleError) {
                failedIds.push(id);
              }
            }
          }
        }
        // Update local state for successfully updated plants
        const failedSet = new Set(failedIds);
        const successIds = new Set(ids.filter((id) => !failedSet.has(id)));
        setPlantDashboardRows((prev) =>
          prev.map((p) =>
            successIds.has(p.id) ? { ...p, status: newStatus } : p
          )
        );
        setSelectedPlantIds(new Set());
        setBulkStatusDialogOpen(false);
        if (failedIds.length > 0) {
          setPlantDashboardError(
            `${successIds.size} plant(s) updated. ${failedIds.length} plant(s) failed due to invalid data (check sowing_method values).`
          );
        }
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

  // Quick-action: update a single plant field (single value or array toggle)
  const handleQuickPlantUpdate = React.useCallback(
    async (
      plantId: string,
      dbColumn: string,
      localKey: keyof PlantDashboardRow,
      value: unknown,
      mode: "set" | "toggle-array",
    ) => {
      try {
        let newValue: unknown;
        if (mode === "set") {
          newValue = value;
        } else {
          // toggle inside array
          const current = (() => {
            const row = plantDashboardRows.find((p) => p.id === plantId);
            if (!row) return [];
            const v = row[localKey];
            return Array.isArray(v) ? [...v] : [];
          })();
          const strVal = String(value);
          if (current.includes(strVal)) {
            newValue = current.filter((v: string) => v !== strVal);
          } else {
            newValue = [...current, strVal];
          }
        }
        const { error } = await supabase
          .from("plants")
          .update({ [dbColumn]: newValue })
          .eq("id", plantId);
        if (error) throw new Error(error.message);
        // Update local state
        setPlantDashboardRows((prev) =>
          prev.map((p) =>
            p.id === plantId ? { ...p, [localKey]: newValue } : p,
          ),
        );
        // History: single field_change entry per plant.
        const fieldKey = String(localKey);
        const label = labelForField(fieldKey);
        await logPlantHistory({
          plantId,
          authorId: profile?.id ?? null,
          action: fieldKey === "status" ? "status_change" : "field_change",
          field: fieldKey,
          summary: `Quick-edit: changed ${label}`,
        });
      } catch (err) {
        console.error("Quick plant update error:", err);
        setPlantDashboardError(
          err instanceof Error ? err.message : "Failed to update plant",
        );
      }
    },
    [plantDashboardRows, profile?.id],
  );

  // Bulk quick-action: update a field for all selected plants
  const handleBulkQuickUpdate = React.useCallback(
    async (
      dbColumn: string,
      localKey: keyof PlantDashboardRow,
      value: unknown,
      mode: "set" | "toggle-array",
    ) => {
      if (selectedPlantIds.size === 0) return;
      setBulkActionLoading(true);
      const fieldKey = String(localKey);
      const label = labelForField(fieldKey);
      const action: "status_change" | "field_change" =
        fieldKey === "status" ? "status_change" : "field_change";
      const touchedIds: string[] = [];
      try {
        const ids = Array.from(selectedPlantIds);
        if (mode === "set") {
          // Same value for all selected plants
          const batchSize = 50;
          for (let i = 0; i < ids.length; i += batchSize) {
            const batch = ids.slice(i, i + batchSize);
            const { error } = await supabase
              .from("plants")
              .update({ [dbColumn]: value })
              .in("id", batch);
            if (error) throw new Error(error.message);
            touchedIds.push(...batch);
          }
          setPlantDashboardRows((prev) =>
            prev.map((p) =>
              selectedPlantIds.has(p.id) ? { ...p, [localKey]: value } : p,
            ),
          );
        } else {
          // Toggle array: for each plant, toggle the value in the array individually
          const strVal = String(value);
          const updates: { id: string; newValue: string[] }[] = [];
          for (const id of ids) {
            const row = plantDashboardRows.find((p) => p.id === id);
            if (!row) continue;
            const current = Array.isArray(row[localKey]) ? [...(row[localKey] as string[])] : [];
            const newValue = current.includes(strVal)
              ? current.filter((v) => v !== strVal)
              : [...current, strVal];
            updates.push({ id, newValue });
          }
          // Batch update each plant individually for array toggles
          for (const { id, newValue } of updates) {
            const { error } = await supabase
              .from("plants")
              .update({ [dbColumn]: newValue })
              .eq("id", id);
            if (error) throw new Error(error.message);
            touchedIds.push(id);
          }
          setPlantDashboardRows((prev) =>
            prev.map((p) => {
              const upd = updates.find((u) => u.id === p.id);
              return upd ? { ...p, [localKey]: upd.newValue } : p;
            }),
          );
        }
        // History: one field_change entry per touched plant.
        if (touchedIds.length) {
          await logPlantHistoryBatch(
            touchedIds.map((plantId) => ({
              plantId,
              authorId: profile?.id ?? null,
              action,
              field: fieldKey,
              summary: `Bulk quick-edit: changed ${label}`,
            })),
          );
        }
      } catch (err) {
        console.error("Bulk quick update error:", err);
        setPlantDashboardError(
          err instanceof Error ? err.message : "Failed to bulk update plants",
        );
      } finally {
        setBulkActionLoading(false);
      }
    },
    [selectedPlantIds, plantDashboardRows, profile?.id],
  );

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

  const featuredMonthData = React.useMemo(() => {
    const counts = FEATURED_MONTH_SLUGS.reduce(
      (acc, slug) => {
        acc[slug] = 0;
        return acc;
      },
      {} as Record<FeaturedMonthSlug, number>,
    );
    plantDashboardRows.forEach((plant) => {
      plant.featuredMonths.forEach((month) => {
        counts[month] += 1;
      });
    });
    return FEATURED_MONTH_SLUGS.map((slug) => ({
      slug,
      label: FEATURED_MONTH_LABELS[slug],
      value: counts[slug],
    }));
  }, [plantDashboardRows]);

  const hasFeaturedMonthData = React.useMemo(
    () => featuredMonthData.some((entry) => entry.value > 0),
    [featuredMonthData],
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
        const matchesFeaturedMonth =
          selectedFeaturedMonth === "all"
            ? true
            : selectedFeaturedMonth === "none"
              ? plant.featuredMonths.length === 0
              : plant.featuredMonths.includes(selectedFeaturedMonth);
        if (!matchesFeaturedMonth) return false;
        // Search by name, variety, common names, or tags (in both English and user's language)
        const matchesSearch = term
          ? plant.name.toLowerCase().includes(term) ||
            (plant.variety && plant.variety.toLowerCase().includes(term)) ||
            plant.givenNames.some((gn) => gn.toLowerCase().includes(term)) ||
            plant.tags.some((tag) => tag.toLowerCase().includes(term)) ||
            (plant.localizedName && plant.localizedName.toLowerCase().includes(term)) ||
            (plant.localizedVariety && plant.localizedVariety.toLowerCase().includes(term)) ||
            plant.localizedGivenNames.some((gn) => gn.toLowerCase().includes(term)) ||
            plant.localizedTags.some((tag) => tag.toLowerCase().includes(term))
          : true;
        return matchesSearch;
      })
      .sort((a, b) => {
        // Compare by name, then variety (no variety first, then alphabetical)
        const cmpNameVariety = (x: PlantDashboardRow, y: PlantDashboardRow) => {
          const n = x.name.localeCompare(y.name);
          if (n !== 0) return n;
          if (!x.variety && y.variety) return -1;
          if (x.variety && !y.variety) return 1;
          if (x.variety && y.variety) return x.variety.localeCompare(y.variety);
          return 0;
        };
        switch (plantSortOption) {
          case "updated": {
            const updatedA = a.updatedAt ?? 0;
            const updatedB = b.updatedAt ?? 0;
            if (updatedB !== updatedA) return updatedB - updatedA;
            return cmpNameVariety(a, b);
          }
          case "created": {
            const createdA = a.createdAt ?? 0;
            const createdB = b.createdAt ?? 0;
            if (createdB !== createdA) return createdB - createdA;
            return cmpNameVariety(a, b);
          }
          case "name":
            return cmpNameVariety(a, b);
          case "gardens":
            if (b.gardensCount !== a.gardensCount) return b.gardensCount - a.gardensCount;
            return cmpNameVariety(a, b);
          case "likes":
            if (b.likesCount !== a.likesCount) return b.likesCount - a.likesCount;
            return cmpNameVariety(a, b);
          case "views":
            if (b.viewsCount !== a.viewsCount) return b.viewsCount - a.viewsCount;
            return cmpNameVariety(a, b);
          case "images":
            if (a.imagesCount !== b.imagesCount) return a.imagesCount - b.imagesCount;
            return cmpNameVariety(a, b);
          case "status":
          default: {
            const statusDiff =
              getStatusSortPriority(a.status) - getStatusSortPriority(b.status);
            if (statusDiff !== 0) return statusDiff;
            return cmpNameVariety(a, b);
          }
        }
      });
  }, [plantDashboardRows, visiblePlantStatuses, selectedFeaturedMonth, plantSearchQuery, plantSortOption]);

  // Reset visible count when filters change
  React.useEffect(() => {
    setPlantVisibleCount(plantPageSize);
  }, [visiblePlantStatuses, selectedFeaturedMonth, plantSearchQuery, plantSortOption, plantPageSize]);

  // Slice filtered rows to the visible count for pagination
  const visiblePlantRows = React.useMemo(
    () => filteredPlantRows.slice(0, plantVisibleCount),
    [filteredPlantRows, plantVisibleCount],
  );
  const hasMorePlants = plantVisibleCount < filteredPlantRows.length;

  const plantViewIsPlants = requestViewMode === "plants";
  const plantViewIsReports = requestViewMode === "reports";
  const plantTableLoading =
    plantDashboardLoading && !plantDashboardInitialized;
  const visiblePlantStatusesSet = React.useMemo(
    () => new Set(visiblePlantStatuses),
    [visiblePlantStatuses],
  );
  const noPlantStatusesSelected = visiblePlantStatusesSet.size === 0;


  // AI Prefill All functionality — use the same field order as aiPrefillService
  // so that buildCategoryProgress totals match what onFieldComplete reports
  const initAiPrefillCategoryProgress = React.useCallback(() => {
    const progress = buildCategoryProgress(aiPrefillFieldOrder);
    setAiPrefillCategoryProgress(progress);
  }, []);

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
    if (aiPrefillRunning || filteredPlantRequests.length === 0) return;

    const abortController = new AbortController();
    const overallStartTime = Date.now();
    let plantStartTime = Date.now();

    setAiPrefillAbortController(abortController);
    setAiPrefillRunning(true);
    setAiPrefillError(null);
    setAiPrefillProgress({ current: 0, total: filteredPlantRequests.length });
    setAiPrefillStatus('idle');
    setAiPrefillCurrentField(null);
    setAiPrefillFieldProgress({ completed: 0, total: 0 });
    setAiPrefillCompletedPlants([]);
    setAiPrefillStartTime(overallStartTime);
    setAiPrefillElapsedTime(0);
    initAiPrefillCategoryProgress();

    try {
      await processAllPlantRequests(
        filteredPlantRequests.map((req) => ({ id: req.id, plant_name: req.plant_name })),
        profile?.display_name || undefined,
        {
          signal: abortController.signal,
          onProgress: ({ stage, plantName }) => {
            setAiPrefillCurrentPlant(plantName);
            setAiPrefillStatus(stage);
            // Reset category progress only when starting a new plant
            if (stage === 'translating_name') {
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
        },
        profile?.id ?? null,
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
    }
  }, [aiPrefillRunning, filteredPlantRequests, profile?.display_name, profile?.id, loadPlantRequests, initAiPrefillCategoryProgress, markAiPrefillFieldComplete]);

  const stopAiPrefill = React.useCallback(() => {
    if (aiPrefillAbortController) {
      aiPrefillAbortController.abort();
      // Immediately update UI so the progress panel disappears
      setAiPrefillRunning(false);
      setAiPrefillAbortController(null);
      setAiPrefillCurrentPlant(null);
      setAiPrefillStatus('idle');
      setAiPrefillCurrentField(null);
      setAiPrefillFieldProgress({ completed: 0, total: 0 });
      setAiPrefillStartTime(null);
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
      if (ipsLoading) {
        console.warn(
          "[AdminPage] IPs loading timeout - clearing loading state only",
        );
        setIpsLoading(false);
      }
    }, MAX_LOADING_TIMEOUT);

    return () => clearTimeout(timeoutId);
  }, [
    branchesLoading,
    registeredLoading,
    ipsLoading,
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

  const refreshAphydle = async () => {
    if (refreshingAphydle) return;
    setRefreshingAphydle(true);
    try {
      setConsoleLines([]);
      setConsoleOpen(true);
      appendConsole("[aphydle] Refresh Aphydle: starting…");

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
      const sseHeaders: Record<string, string> = {};
      if (token) sseHeaders["Authorization"] = `Bearer ${token}`;
      if (adminToken) sseHeaders["X-Admin-Token"] = String(adminToken);
      const adminSseHeaders: Record<string, string> = {};
      if (adminToken) adminSseHeaders["X-Admin-Token"] = String(adminToken);
      const adminJsonPostHeaders = {
        ...adminSseHeaders,
        Accept: "application/json",
        "Content-Type": "application/json",
      };

      let resp: Response | null = null;
      try {
        resp = await fetch("/api/admin/refresh-aphydle/stream", {
          method: "GET",
          headers: sseHeaders,
          credentials: "same-origin",
        });
      } catch {}
      if (!resp || !resp.ok || !resp.body) {
        try {
          resp = await fetch("/admin/refresh-aphydle/stream", {
            method: "GET",
            headers: adminSseHeaders,
            credentials: "same-origin",
          });
        } catch {}
      }
      if (!resp || !resp.ok || !resp.body) {
        const bg = await fetch("/admin/refresh-aphydle", {
          method: "POST",
          headers: adminJsonPostHeaders,
          credentials: "same-origin",
          body: "{}",
        });
        const bgBody = await safeJson(bg);
        if (!bg.ok || bgBody?.ok !== true) {
          throw new Error(bgBody?.error || `Aphydle refresh failed (${bg.status})`);
        }
        appendConsole("[aphydle] Started background refresh via Admin API.");
        return;
      }

      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let buf = "";
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
            appendConsole(payload);
          } else if (!/^(:|event:|id:|retry:)/.test(line)) {
            appendConsole(line);
          }
        }
      }

      if (sawDoneEvent && buildOk) {
        appendConsole("[aphydle] ✓ Aphydle refresh complete.");
      } else if (sawDoneEvent && !buildOk) {
        appendConsole("[aphydle] ✗ Aphydle refresh failed. See logs above.");
      } else {
        appendConsole("[aphydle] Stream ended without terminal status.");
      }
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : String(e);
      appendConsole(`[aphydle] Failed to refresh Aphydle: ${message}`);
    } finally {
      setRefreshingAphydle(false);
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

  // Loader for Aphydle (sister daily plant guessing game) stats
  const loadAphydleStats = React.useCallback(
    async (opts?: { initial?: boolean }) => {
      const isInitial = !!opts?.initial;
      if (isInitial) setAphydleStatsLoading(true);
      else setAphydleStatsRefreshing(true);
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
        const resp = await fetchWithRetry("/api/admin/aphydle-stats", {
          headers,
          credentials: "same-origin",
        }).catch(() => null);
        if (resp && resp.ok) {
          const data = await safeJson(resp);
          if (typeof data?.playersToday === "number") setAphydlePlayersToday(data.playersToday);
          if (typeof data?.visitsToday === "number") setAphydleVisitsToday(data.visitsToday);
          setAphydleStatsUpdatedAt(Date.now());
        }
      } catch (e) {
        console.error("[AdminPage] Failed to load aphydle stats:", e);
      } finally {
        if (isInitial) setAphydleStatsLoading(false);
        else setAphydleStatsRefreshing(false);
      }
    },
    [safeJson, fetchWithRetry],
  );

  React.useEffect(() => {
    const timeoutId = setTimeout(() => {
      loadAphydleStats({ initial: true });
    }, 400);
    return () => clearTimeout(timeoutId);
  }, [loadAphydleStats]);

  React.useEffect(() => {
    const id = setInterval(() => {
      loadAphydleStats({ initial: false });
    }, 60_000);
    return () => clearInterval(id);
  }, [loadAphydleStats]);

  // Aphydle full analytics loader — pulls /api/admin/aphydle-analytics for
  // the chosen window. Lazy: only invoked once the user lands on the Aphydle
  // analytics pill, then re-runs whenever gaDays changes.
  const loadAphydleAnalytics = React.useCallback(
    async (days: number) => {
      setAphydleAnalyticsLoading(true);
      setAphydleAnalyticsError(null);
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
          `/api/admin/aphydle-analytics?days=${encodeURIComponent(String(days))}`,
          { headers, credentials: "same-origin" },
        ).catch(() => null);
        if (!resp || !resp.ok) {
          setAphydleAnalyticsError("Failed to load Aphydle analytics");
          return;
        }
        const data = await safeJson(resp);
        if (data?.ok === false) {
          setAphydleAnalyticsError(data?.error || "Failed to load Aphydle analytics");
          return;
        }
        setAphydleAnalytics({
          totals: data?.totals ?? { visits: 0, plays: 0, guesses: 0, wins: 0 },
          timeSeries: Array.isArray(data?.timeSeries) ? data.timeSeries : [],
          lastPuzzles: Array.isArray(data?.lastPuzzles) ? data.lastPuzzles : [],
        });
        setAphydleAnalyticsUpdatedAt(Date.now());
      } catch (e) {
        console.error("[AdminPage] Failed to load aphydle analytics:", e);
        setAphydleAnalyticsError(e instanceof Error ? e.message : String(e));
      } finally {
        setAphydleAnalyticsLoading(false);
      }
    },
    [safeJson, fetchWithRetry],
  );

  React.useEffect(() => {
    if (analyticsTab !== "aphydle") return;
    loadAphydleAnalytics(gaDays);
  }, [analyticsTab, gaDays, loadAphydleAnalytics]);


  // Loader for list of connected IPs (unique IPs past N minutes; default 60)
  const loadEnrichedIps = React.useCallback(
    async (opts?: { initial?: boolean }) => {
      const isInitial = !!opts?.initial;
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
          "/api/admin/online-ips-enriched",
          { headers, credentials: "same-origin" },
        ).catch(() => null);
        if (resp && resp.ok) {
          const data = await safeJson(resp);
          const list: EnrichedIp[] = Array.isArray(data?.ips)
            ? data.ips.map((r: Record<string, unknown>) => ({
                ip: String(r.ip || ""),
                visits: Number(r.visits || 0),
                country: r.country ? String(r.country) : null,
                hasAccount: !!r.hasAccount,
                rpm: Number(r.rpm || 0),
              })).filter((r: EnrichedIp) => !!r.ip)
            : [];
          setEnrichedIps(list);
          setIpsUpdatedAt(Date.now());
        }
      } catch (e) {
        console.error("[AdminPage] Failed to load enriched IPs:", e);
      } finally {
        if (isInitial) setIpsLoading(false);
        else setIpsRefreshing(false);
      }
    },
    [safeJson, fetchWithRetry],
  );

  // Initial load and auto-refresh every 60s
  React.useEffect(() => {
    const t = setTimeout(() => loadEnrichedIps({ initial: true }), 300);
    return () => clearTimeout(t);
  }, [loadEnrichedIps]);
  React.useEffect(() => {
    const id = setInterval(() => loadEnrichedIps({ initial: false }), 60_000);
    return () => clearInterval(id);
  }, [loadEnrichedIps]);


  // --- Google Analytics Data API loaders ---
  const gaAuthHeaders = React.useCallback(() => {
    const h: Record<string, string> = { Accept: "application/json" };
    const adminToken = (globalThis as EnvWithAdminToken)?.__ENV__?.VITE_ADMIN_STATIC_TOKEN;
    if (adminToken) h["X-Admin-Token"] = String(adminToken);
    return h;
  }, []);

  // Check if GA is configured on the server
  const checkGaStatus = React.useCallback(async () => {
    try {
      const resp = await fetchWithRetry("/api/admin/ga/status", {
        headers: gaAuthHeaders(),
        credentials: "same-origin",
      }).catch(() => null);
      if (resp?.ok) {
        const data = await safeJson(resp);
        setGaConfigured(!!data?.configured);
      } else {
        setGaConfigured(false);
      }
    } catch {
      setGaConfigured(false);
    }
  }, [fetchWithRetry, safeJson, gaAuthHeaders]);

  // Load GA realtime data
  const loadGaRealtime = React.useCallback(async () => {
    if (gaConfigured === false) return;
    try {
      const resp = await fetchWithRetry("/api/admin/ga/realtime", {
        headers: gaAuthHeaders(),
        credentials: "same-origin",
      }).catch(() => null);
      if (resp?.ok) {
        const data = await safeJson(resp);
        if (data?.ok) {
          setGaRealtime({
            activeUsers: data.activeUsers ?? 0,
            countries: data.countries ?? [],
            devices: data.devices ?? [],
          });
          setGaRealtimeUpdatedAt(Date.now());
        }
      }
    } catch (e) {
      console.error("[AdminPage] GA realtime error:", e);
    }
  }, [gaConfigured, fetchWithRetry, safeJson, gaAuthHeaders]);

  // Load all GA reports (overview, daily series, top pages, devices, acquisition, geo)
  const loadGaReports = React.useCallback(async (opts?: { initial?: boolean }) => {
    if (gaConfigured === false) return;
    if (opts?.initial) setGaLoading(true);
    setGaError(null);
    try {
      const days = gaDays;
      const headers = gaAuthHeaders();
      const fetchOpts = { headers, credentials: "same-origin" as RequestCredentials };
      const [overviewResp, seriesResp, pagesResp, devicesResp, acqResp, geoResp] = await Promise.all([
        fetchWithRetry(`/api/admin/ga/overview?days=${days}`, fetchOpts).catch(() => null),
        fetchWithRetry(`/api/admin/ga/daily-series?days=${days}`, fetchOpts).catch(() => null),
        fetchWithRetry(`/api/admin/ga/top-pages?days=${days}&limit=15`, fetchOpts).catch(() => null),
        fetchWithRetry(`/api/admin/ga/devices?days=${days}`, fetchOpts).catch(() => null),
        fetchWithRetry(`/api/admin/ga/acquisition?days=${days}`, fetchOpts).catch(() => null),
        fetchWithRetry(`/api/admin/ga/geo?days=${days}`, fetchOpts).catch(() => null),
      ]);
      const [overviewData, seriesData, pagesData, devicesData, acqData, geoData] = await Promise.all([
        overviewResp?.ok ? safeJson(overviewResp) : null,
        seriesResp?.ok ? safeJson(seriesResp) : null,
        pagesResp?.ok ? safeJson(pagesResp) : null,
        devicesResp?.ok ? safeJson(devicesResp) : null,
        acqResp?.ok ? safeJson(acqResp) : null,
        geoResp?.ok ? safeJson(geoResp) : null,
      ]);
      if (overviewData?.ok) setGaOverview({ metrics: overviewData.metrics, deltas: overviewData.deltas });
      if (seriesData?.ok) setGaSeries(seriesData.series ?? []);
      if (pagesData?.ok) setGaTopPages(pagesData.pages ?? []);
      if (devicesData?.ok) setGaDevices({ devices: devicesData.devices ?? [], browsers: devicesData.browsers ?? [] });
      if (acqData?.ok) setGaAcquisition({ channels: acqData.channels ?? [], sources: acqData.sources ?? [] });
      if (geoData?.ok) setGaGeo({ countries: geoData.countries ?? [], cities: geoData.cities ?? [] });
      setGaUpdatedAt(Date.now());
      // Check for errors
      const firstError = [overviewData, seriesData, pagesData, devicesData, acqData, geoData].find(d => d && !d.ok);
      if (firstError) setGaError(firstError.error || "Some GA reports failed");
    } catch (e) {
      console.error("[AdminPage] GA reports error:", e);
      setGaError(e instanceof Error ? e.message : String(e));
    } finally {
      setGaLoading(false);
    }
  }, [gaConfigured, gaDays, fetchWithRetry, safeJson, gaAuthHeaders]);

  // Initial GA check + load
  React.useEffect(() => {
    const timeoutId = setTimeout(() => {
      checkGaStatus();
    }, 500);
    return () => clearTimeout(timeoutId);
  }, [checkGaStatus]);

  // Once GA is confirmed configured, load data
  React.useEffect(() => {
    if (gaConfigured === true) {
      loadGaRealtime();
      loadGaReports({ initial: true });
    }
  }, [gaConfigured]); // eslint-disable-line react-hooks/exhaustive-deps

  // Reload GA reports when days change
  React.useEffect(() => {
    if (gaConfigured === true && gaUpdatedAt !== null) {
      loadGaReports({ initial: false });
    }
  }, [gaDays]); // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-refresh GA realtime every 60s
  React.useEffect(() => {
    if (gaConfigured !== true) return;
    const id = setInterval(() => loadGaRealtime(), 60_000);
    return () => clearInterval(id);
  }, [gaConfigured, loadGaRealtime]);

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
    { key: "events", label: "Events", Icon: Calendar, path: "/admin/events", adminOnly: true },
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
    if (currentPath.includes("/admin/events")) return "events";
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

  // Re-fetch when sort order changes
  const requestSortPrevRef = React.useRef(requestSortOrder);
  React.useEffect(() => {
    if (requestSortPrevRef.current === requestSortOrder) return;
    requestSortPrevRef.current = requestSortOrder;
    if (plantRequestsInitialized) {
      loadPlantRequests({ initial: false });
    }
  }, [requestSortOrder, plantRequestsInitialized, loadPlantRequests]);

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
    visits7d?: number;
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
    Array<{ id: string; email: string | null; display_name?: string | null; last_seen_at?: string | null; visits_7d?: number | null }>
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
      visits_7d: number;
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
              lastVisitAt:
                typeof mm?.last_visit_at === "string"
                  ? mm.last_visit_at
                  : typeof mm?.lastVisitAt === "string"
                    ? mm.lastVisitAt
                    : null,
              visits7d:
                typeof mm?.visits_7d === "number"
                  ? mm.visits_7d
                  : typeof mm?.visits7d === "number"
                    ? mm.visits7d
                    : 0,
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
          visits7d:
            typeof data?.visits7d === "number"
              ? data.visits7d
              : 0,
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
        // Fetch onboarding status fields (may not exist yet — best effort)
        if (data?.user?.id) {
          try {
            const { data: onb } = await supabase.from('profiles').select('setup_completed, email_verified, tutorial_completed').eq('id', data.user.id).maybeSingle();
            const actionIds = ['create_garden', 'add_plant', 'add_friend', 'complete_profile', 'add_bookmark'];
            const { data: actionRows } = await supabase.from('user_action_status').select('action_id, completed_at, skipped_at').eq('user_id', data.user.id).in('action_id', [...actionIds, '__all_done_dismissed']);
            const doneActions = actionRows ? actionRows.filter(r => actionIds.includes(r.action_id) && (r.completed_at != null || r.skipped_at != null)).length : 0;
            const allDoneDismissed = actionRows ? actionRows.some(r => r.action_id === '__all_done_dismissed' && r.completed_at != null) : false;
            const allActionsComplete = allDoneDismissed || doneActions >= actionIds.length;
            const completedActions = allActionsComplete ? actionIds.length : doneActions;
            if (onb) {
              setMemberData(prev => prev ? { ...prev, onboarding: { setupCompleted: onb.setup_completed ?? false, emailVerified: onb.email_verified ?? false, tutorialCompleted: onb.tutorial_completed ?? false, actionsCompleted: completedActions, actionsTotal: actionIds.length, allActionsComplete } } : prev);
            }
          } catch {}
        }
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
              visits_7d: typeof uu?.visits_7d === "number" ? uu.visits_7d : (uu?.visits_7d != null ? Number(uu.visits_7d) : 0),
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
              last_seen_at: ss?.last_seen_at ? String(ss.last_seen_at) : null,
              visits_7d: typeof ss?.visits_7d === "number" ? ss.visits_7d : null,
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
                <div className="space-y-4">

                  {/* Overview Tab */}
                  {activeTab === "overview" && (
                    <>
                      {/* ═══ AT A GLANCE ═══ */}

                      {/* Compact health status strip */}
                      <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-stone-200/60 dark:border-[#3e3e42]/60 bg-white/80 dark:bg-[#1a1a1d]/80 backdrop-blur px-4 py-2.5">
                        <div className="flex items-center gap-2 mr-auto">
                          <Activity className="h-4 w-4 opacity-50" />
                          <span className="text-xs font-medium opacity-60">Services</span>
                        </div>
                        {[
                          { label: "API", probe: apiProbe, icon: Server },
                          { label: "Admin", probe: adminProbe, icon: ShieldCheck },
                          { label: "Database", probe: dbProbe, icon: Database },
                        ].map(({ label, probe, icon: Icon }) => (
                          <div key={label} className="flex items-center gap-1.5 text-xs">
                            <StatusDot ok={probe.ok} title={!probe.ok ? probe.errorCode || undefined : undefined} />
                            <Icon className="h-3 w-3 opacity-50" />
                            <span className="font-medium">{label}</span>
                            {probe.latencyMs !== null && (
                              <span className="tabular-nums opacity-40">{probe.latencyMs}ms</span>
                            )}
                            {!probe.ok && <ErrorBadge code={probe.errorCode} />}
                          </div>
                        ))}
                        <Button
                          variant="ghost"
                          size="icon"
                          aria-label="Refresh health"
                          onClick={refreshHealth}
                          disabled={healthRefreshing}
                          className="h-6 w-6 rounded-lg ml-1"
                        >
                          <RefreshCw className={`h-3 w-3 ${healthRefreshing ? "animate-spin" : ""}`} />
                        </Button>
                        <div className="hidden sm:flex items-center gap-1.5 text-xs border-l border-stone-200 dark:border-[#3e3e42] pl-3 ml-1">
                          <span className="font-mono text-[10px] opacity-40">v{(import.meta.env as Record<string, string>).VITE_APP_VERSION ?? '1.0.0'}</span>
                          <span className="opacity-20">·</span>
                          <GitBranch className="h-3 w-3 opacity-30" />
                          <span className="font-mono text-[10px] opacity-40">{((import.meta.env as Record<string, string>).VITE_COMMIT_SHA ?? 'dev').slice(0, 7)}</span>
                        </div>
                      </div>

                      {/* Quick Stats Cards
                          Layout: 3 equal-width main cards + a compact Aphydle
                          card on the right at lg+. The custom grid template
                          keeps the 3 originals at their original width instead
                          of squashing them to fit a 4-equal-column layout. */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-[repeat(3,minmax(0,1fr))_auto] gap-3">
                        {/* Currently Online Card — powered by GA Realtime */}
                        <div className="group relative rounded-2xl border border-emerald-200/70 dark:border-emerald-800/40 bg-gradient-to-br from-emerald-50/80 to-teal-50/50 dark:from-emerald-950/30 dark:to-teal-950/20 p-4 shadow-sm hover:shadow-md hover:shadow-emerald-500/8 transition-all duration-200 overflow-hidden">
                          <div className="flex items-center justify-between mb-3">
                            <div className="flex items-center gap-2.5">
                              <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-emerald-500 to-teal-500 flex items-center justify-center shadow-sm shadow-emerald-500/20">
                                <Wifi className="h-4.5 w-4.5 text-white" />
                              </div>
                              <div>
                                <div className="text-xs font-semibold text-emerald-900 dark:text-emerald-100">Currently Online</div>
                                <div className="text-[10px] text-emerald-600/60 dark:text-emerald-400/60">
                                  {gaRealtimeUpdatedAt ? formatTimeAgo(gaRealtimeUpdatedAt) : "Updating..."}
                                </div>
                              </div>
                            </div>
                            <Button
                              variant="ghost"
                              size="icon"
                              aria-label="Refresh currently online"
                              onClick={() => { loadGaRealtime(); loadEnrichedIps({ initial: false }); }}
                              disabled={ipsLoading || ipsRefreshing}
                              className="h-7 w-7 rounded-lg text-emerald-600 dark:text-emerald-400"
                            >
                              <RefreshCw className={`h-3.5 w-3.5 ${ipsRefreshing ? "animate-spin" : ""}`} />
                            </Button>
                          </div>
                          <div className="flex items-baseline gap-2">
                            <div className="text-3xl font-bold tabular-nums text-emerald-700 dark:text-emerald-300">
                              {gaRealtime === null ? (
                                <span className="inline-block w-10 h-8 bg-emerald-200/50 dark:bg-emerald-800/30 rounded-lg animate-pulse" />
                              ) : (
                                gaRealtime.activeUsers
                              )}
                              </div>
                              {gaRealtime && gaRealtime.activeUsers > 0 && (
                                <div className="flex items-center gap-1">
                                  <span className="relative flex h-2 w-2">
                                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                                    <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
                                  </span>
                                  <span className="text-[10px] font-medium text-emerald-600 dark:text-emerald-400">live</span>
                                </div>
                              )}
                            </div>
                            {/* GA realtime breakdown: countries + devices */}
                            {gaRealtime && (gaRealtime.countries.length > 0 || gaRealtime.devices.length > 0) && (
                              <div className="mt-2 flex flex-wrap gap-1">
                                {gaRealtime.countries.slice(0, 4).map((c) => (
                                  <span key={c.country} className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full bg-emerald-100/70 dark:bg-emerald-900/40 text-[10px]">
                                    <Globe className="h-2.5 w-2.5 opacity-50" />
                                    <span className="font-medium">{c.country}</span>
                                    <span className="opacity-50">{c.users}</span>
                                  </span>
                                ))}
                                {gaRealtime.devices.map((d) => (
                                  <span key={d.device} className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full bg-emerald-100/70 dark:bg-emerald-900/40 text-[10px]">
                                    {d.device === "desktop" ? <Monitor className="h-2.5 w-2.5 opacity-50" /> : d.device === "tablet" ? <Tablet className="h-2.5 w-2.5 opacity-50" /> : <Smartphone className="h-2.5 w-2.5 opacity-50" />}
                                    <span className="font-medium capitalize">{d.device}</span>
                                    <span className="opacity-50">{d.users}</span>
                                  </span>
                                ))}
                              </div>
                            )}
                          </div>

                        {/* Registered Accounts Card */}
                        <div className="group relative rounded-2xl border border-violet-200/70 dark:border-violet-800/40 bg-gradient-to-br from-violet-50/80 to-purple-50/50 dark:from-violet-950/30 dark:to-purple-950/20 p-4 shadow-sm hover:shadow-md hover:shadow-violet-500/8 transition-all duration-200 overflow-hidden cursor-pointer" onClick={() => navigate("/admin/members/list")}>
                          <div className="flex items-center justify-between mb-3">
                            <div className="flex items-center gap-2.5">
                              <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-violet-500 to-purple-500 flex items-center justify-center shadow-sm shadow-violet-500/20">
                                <Users className="h-4.5 w-4.5 text-white" />
                              </div>
                              <div>
                                <div className="text-xs font-semibold text-violet-900 dark:text-violet-100">Registered</div>
                                <div className="text-[10px] text-violet-600/60 dark:text-violet-400/60">
                                  {registeredUpdatedAt ? formatTimeAgo(registeredUpdatedAt) : "Updating..."}
                                </div>
                              </div>
                            </div>
                            <Button variant="ghost" size="icon" aria-label="Refresh registered accounts" onClick={(e) => { e.stopPropagation(); loadRegisteredCount({ initial: false }); }} disabled={registeredLoading || registeredRefreshing} className="h-7 w-7 rounded-lg text-violet-600 dark:text-violet-400">
                              <RefreshCw className={`h-3.5 w-3.5 ${registeredLoading || registeredRefreshing ? "animate-spin" : ""}`} />
                            </Button>
                          </div>
                          <div className="flex items-baseline gap-1.5">
                            <div className="text-3xl font-bold tabular-nums text-violet-700 dark:text-violet-300">
                              {registeredLoading ? (
                                <span className="inline-block w-12 h-8 bg-violet-200/50 dark:bg-violet-800/30 rounded-lg animate-pulse" />
                              ) : registeredUpdatedAt !== null ? (registeredCount ?? "-") : "-"}
                            </div>
                            <span className="text-xs font-medium text-violet-500 dark:text-violet-400">users</span>
                          </div>
                        </div>

                        {/* Total Plants Card */}
                        <div className="group relative rounded-2xl border border-amber-200/70 dark:border-amber-800/40 bg-gradient-to-br from-amber-50/80 to-orange-50/50 dark:from-amber-950/30 dark:to-orange-950/20 p-4 shadow-sm hover:shadow-md hover:shadow-amber-500/8 transition-all duration-200 overflow-hidden cursor-pointer" onClick={() => navigate("/admin/plants")}>
                          <div className="flex items-center justify-between mb-3">
                            <div className="flex items-center gap-2.5">
                              <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-amber-500 to-orange-500 flex items-center justify-center shadow-sm shadow-amber-500/20">
                                <Leaf className="h-4.5 w-4.5 text-white" />
                              </div>
                              <div>
                                <div className="text-xs font-semibold text-amber-900 dark:text-amber-100">Plants</div>
                                <div className="text-[10px] text-amber-600/60 dark:text-amber-400/60">
                                  {plantsUpdatedAt ? formatTimeAgo(plantsUpdatedAt) : "Updating..."}
                                </div>
                              </div>
                            </div>
                            <Button variant="ghost" size="icon" aria-label="Refresh total plants" onClick={(e) => { e.stopPropagation(); loadRegisteredCount({ initial: false }); }} disabled={plantsLoading || plantsRefreshing} className="h-7 w-7 rounded-lg text-amber-600 dark:text-amber-400">
                              <RefreshCw className={`h-3.5 w-3.5 ${plantsLoading || plantsRefreshing ? "animate-spin" : ""}`} />
                            </Button>
                          </div>
                          <div className="flex items-baseline gap-1.5">
                            <div className="text-3xl font-bold tabular-nums text-amber-700 dark:text-amber-300">
                              {plantsLoading ? (
                                <span className="inline-block w-10 h-8 bg-amber-200/50 dark:bg-amber-800/30 rounded-lg animate-pulse" />
                              ) : plantsUpdatedAt !== null ? (plantsCount ?? "-") : "-"}
                            </div>
                            <span className="text-xs font-medium text-amber-500 dark:text-amber-400">plants</span>
                          </div>
                        </div>

                        {/* Aphydle Card — sister daily plant guessing game.
                            Matches the Registered / Plants cards' internal
                            dimensions (p-4, w-9 logo, text-3xl number) so all
                            four cards align; the grid template above gives it
                            its own auto-sized column so it doesn't squash the
                            three main cards. */}
                        <div className="group relative rounded-2xl border border-fuchsia-200/70 dark:border-fuchsia-800/40 bg-gradient-to-br from-fuchsia-50/80 to-violet-50/50 dark:from-fuchsia-950/30 dark:to-violet-950/20 p-4 shadow-sm hover:shadow-md hover:shadow-fuchsia-500/8 transition-all duration-200 overflow-hidden lg:w-52">
                          <div className="flex items-center justify-between mb-3">
                            <div className="flex items-center gap-2.5">
                              <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-fuchsia-500 to-violet-500 flex items-center justify-center shadow-sm shadow-fuchsia-500/20">
                                <Gamepad2 className="h-4.5 w-4.5 text-white" />
                              </div>
                              <div>
                                <div className="text-xs font-semibold text-fuchsia-900 dark:text-fuchsia-100">Aphydle</div>
                                <div className="text-[10px] text-fuchsia-600/60 dark:text-fuchsia-400/60">
                                  {aphydleStatsUpdatedAt ? formatTimeAgo(aphydleStatsUpdatedAt) : "Updating..."}
                                </div>
                              </div>
                            </div>
                            <Button
                              variant="ghost"
                              size="icon"
                              aria-label="Refresh aphydle players"
                              onClick={() => loadAphydleStats({ initial: false })}
                              disabled={aphydleStatsLoading || aphydleStatsRefreshing}
                              className="h-7 w-7 rounded-lg text-fuchsia-600 dark:text-fuchsia-400"
                            >
                              <RefreshCw className={`h-3.5 w-3.5 ${aphydleStatsLoading || aphydleStatsRefreshing ? "animate-spin" : ""}`} />
                            </Button>
                          </div>
                          <div className="flex items-baseline gap-1.5">
                            <div className="text-3xl font-bold tabular-nums text-fuchsia-700 dark:text-fuchsia-300">
                              {aphydleStatsLoading ? (
                                <span className="inline-block w-10 h-8 bg-fuchsia-200/50 dark:bg-fuchsia-800/30 rounded-lg animate-pulse" />
                              ) : aphydleStatsUpdatedAt !== null ? (aphydlePlayersToday ?? "-") : "-"}
                            </div>
                            <span className="text-xs font-medium text-fuchsia-500 dark:text-fuchsia-400">players</span>
                          </div>
                          {aphydleVisitsToday != null && (
                            <div className="mt-1 text-[10px] text-fuchsia-600/60 dark:text-fuchsia-400/60 tabular-nums">
                              {aphydleVisitsToday.toLocaleString()} visit{aphydleVisitsToday === 1 ? "" : "s"} today
                            </div>
                          )}
                        </div>
                      </div>

                      {/* ═══ SYSTEM & SERVER ═══ */}
                      <div className="flex items-center gap-2 mt-2">
                        <Server className="h-3.5 w-3.5 opacity-40" />
                        <span className="text-[10px] font-semibold uppercase tracking-widest opacity-40">System & Server</span>
                      </div>

                      {/* System health + Server controls in a 2-column layout */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {/* System Health - Compact */}
                        <Card className={glassCardClass}>
                          <CardContent className="p-4">
                            <div className="flex items-center justify-between mb-3">
                              <div className="flex items-center gap-2">
                                <Server className="h-4 w-4 text-cyan-600 dark:text-cyan-400" />
                                <span className="text-sm font-semibold">System Health</span>
                                <span className="text-[10px] opacity-40">{systemHealth.platform || ""}</span>
                              </div>
                              <Button variant="ghost" size="icon" aria-label="Refresh system health" onClick={() => { setSystemHealthLoading(true); loadSystemHealth(); }} disabled={systemHealthLoading} className="h-7 w-7 rounded-lg">
                                <RefreshCw className={`h-3.5 w-3.5 ${systemHealthLoading ? "animate-spin" : ""}`} />
                              </Button>
                            </div>

                            {systemHealthError && !systemHealth.uptime && (
                              <div className="text-[10px] text-amber-600 dark:text-amber-400 mb-2 p-1.5 rounded-lg bg-amber-50 dark:bg-amber-900/20">
                                {systemHealthError}
                              </div>
                            )}

                            {/* Uptime & Connections - inline */}
                            <div className="flex items-center gap-3 mb-3 text-xs">
                              <div className="flex items-center gap-1.5">
                                <Clock className="h-3 w-3 text-emerald-500" />
                                <span className="font-bold tabular-nums text-emerald-600 dark:text-emerald-400">{formatUptime(systemHealth.uptime)}</span>
                              </div>
                              <span className="opacity-20">|</span>
                              <div className="flex items-center gap-1.5">
                                <Users className="h-3 w-3 text-violet-500" />
                                <span className="font-bold tabular-nums text-violet-600 dark:text-violet-400">{systemHealth.connections !== null ? systemHealth.connections : "-"}</span>
                                <span className="opacity-50">conn</span>
                              </div>
                            </div>

                            {/* CPU */}
                            <div className="mb-2.5">
                              <div className="flex items-center justify-between mb-1">
                                <span className="text-[11px] font-medium">CPU</span>
                                <span className="text-[11px] font-semibold tabular-nums">
                                  {systemHealth.cpu ? `${systemHealth.cpu.percent.toFixed(1)}%` : "-"}
                                  {systemHealth.cpu?.cores && <span className="text-stone-400 font-normal ml-1">({systemHealth.cpu.cores}c)</span>}
                                </span>
                              </div>
                              <HealthProgressBar percent={systemHealth.cpu?.percent ?? 0} />
                              {systemHealth.loadAvg && (
                                <div className="text-[9px] text-stone-400 mt-0.5">Load: {systemHealth.loadAvg.map(l => l.toFixed(2)).join(" / ")}</div>
                              )}
                            </div>

                            {/* Memory */}
                            <div className="mb-2.5">
                              <div className="flex items-center justify-between mb-1">
                                <span className="text-[11px] font-medium">Memory</span>
                                <span className="text-[11px] font-semibold tabular-nums">
                                  {systemHealth.memory ? `${formatBytes(systemHealth.memory.used)} / ${formatBytes(systemHealth.memory.total)}` : "-"}
                                </span>
                              </div>
                              <HealthProgressBar percent={systemHealth.memory?.percent ?? 0} />
                            </div>

                            {/* Disk */}
                            <div>
                              <div className="flex items-center justify-between mb-1">
                                <div className="flex items-center gap-1">
                                  <span className="text-[11px] font-medium">Disk</span>
                                  {systemHealth.disk?.path && <span className="text-[9px] text-stone-400 font-mono">{systemHealth.disk.path}</span>}
                                </div>
                                <span className="text-[11px] font-semibold tabular-nums">
                                  {systemHealth.disk ? `${formatBytes(systemHealth.disk.used)} / ${formatBytes(systemHealth.disk.total)}` : "-"}
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

                              {/* Refresh Aphydle Button */}
                              <Button
                                variant="outline"
                                className="w-full rounded-xl justify-start gap-2"
                                onClick={refreshAphydle}
                                disabled={refreshingAphydle}
                                title="Pull latest Aphydle main and rebuild"
                              >
                                <Sprout className={`h-4 w-4 ${refreshingAphydle ? "animate-pulse" : ""}`} />
                                {refreshingAphydle ? "Refreshing..." : "Refresh Aphydle"}
                              </Button>

                              {/* Open Aphydle Export — Aphydle's /export route renders the
                                  share-card archive picker. Derive the host from the current
                                  domain (e.g. dev01.aphylia.app → aphydle.dev01.aphylia.app)
                                  so this Just Works on every deploy that registers the
                                  Aphydle subdomain in domain.json. */}
                              <Button
                                variant="outline"
                                className="w-full rounded-xl justify-start gap-2"
                                onClick={() => {
                                  const host = window.location.hostname;
                                  const isLocal = host === "localhost" || host === "127.0.0.1" || host.endsWith(".local");
                                  const url = isLocal
                                    ? `${window.location.protocol}//${host}:4173/export`
                                    : `https://aphydle.${host}/export`;
                                  window.open(url, "_blank", "noopener,noreferrer");
                                }}
                                title="Open Aphydle's admin export archive in a new tab"
                              >
                                <ExternalLink className="h-4 w-4" />
                                Open Aphydle Export
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

                        {/* Server Controls + Actions - Right column */}
                        <Card className={glassCardClass}>
                          <CardContent className="p-4">
                            <div className="flex items-center gap-2 mb-3">
                              <Zap className="h-4 w-4 text-amber-500" />
                              <span className="text-sm font-semibold">Broadcast & Branch</span>
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
                            <Select
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
                            </Select>
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
                          </CardContent>
                        </Card>
                      </div>

                      {/* Full-width Action Buttons + Console */}
                      <Card className={glassCardClass}>
                        <CardContent className="p-4">
                          <div className="flex items-center gap-2 mb-3">
                            <Zap className="h-4 w-4 text-amber-500" />
                            <span className="text-sm font-semibold">Quick Actions</span>
                          </div>
                          {/* Action buttons */}
                          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                          <Button
                            className="rounded-xl w-full text-xs px-2 py-2 h-auto"
                            size="sm"
                            onClick={restartServer}
                            disabled={restarting}
                          >
                            <RefreshCw className="h-3.5 w-3.5 flex-shrink-0" />
                            <span className="truncate">
                              {restarting ? "Restarting..." : "Restart"}
                            </span>
                          </Button>
                          <Button
                            className="rounded-xl w-full text-xs px-2 py-2 h-auto"
                            size="sm"
                            variant="secondary"
                            onClick={pullLatest}
                            disabled={pulling}
                          >
                            <Github className="h-3.5 w-3.5 flex-shrink-0" />
                            <span className="truncate">
                              {pulling ? "Pulling..." : "Pull & Build"}
                            </span>
                          </Button>
                          <Button
                            className="rounded-xl w-full text-xs px-2 py-2 h-auto"
                            size="sm"
                            variant="outline"
                            onClick={deployEdgeFunctions}
                            disabled={deployingEdge}
                          >
                            <CloudUpload className="h-3.5 w-3.5 flex-shrink-0" />
                            <span className="truncate">
                              {deployingEdge ? "Deploying..." : "Deploy Edge"}
                            </span>
                          </Button>
                          <Button
                            className="rounded-xl w-full text-xs px-2 py-2 h-auto"
                            size="sm"
                            variant="destructive"
                            onClick={runSyncSchema}
                            disabled={syncing}
                          >
                            <Database className="h-3.5 w-3.5 flex-shrink-0" />
                            <span className="truncate">
                              {syncing ? "Syncing..." : "Sync DB"}
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


                    {/* ─── Google Analytics Dashboard ─── */}
                    {gaConfigured !== false && (
                      <Card className={glassCardClass}>
                        <CardContent className="p-4">
                          <button
                            type="button"
                            className="flex items-center justify-between w-full"
                            onClick={() => setGaOpen((o) => !o)}
                            aria-expanded={gaOpen}
                          >
                            <div className="flex items-center gap-3">
                              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-orange-100 to-amber-100 dark:from-orange-900/40 dark:to-amber-900/40 flex items-center justify-center">
                                <Activity className="h-5 w-5 text-orange-600 dark:text-orange-400" />
                              </div>
                              <div className="text-left">
                                <div className="text-sm font-semibold">Analytics</div>
                                <div className="text-xs text-stone-500 dark:text-stone-400">
                                  {analyticsTab === "aphydle"
                                    ? "Aphydle · sister daily plant guessing game"
                                    : (gaConfigured === null ? "Checking..." : gaConfigured ? "Aphylia · GA4 Data API connected" : "Not configured")}
                                </div>
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              {gaRealtime && (
                                <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-100 dark:bg-emerald-900/30">
                                  <span className="relative flex h-2 w-2">
                                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                                    <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
                                  </span>
                                  <span className="text-xs font-bold text-emerald-700 dark:text-emerald-300 tabular-nums">
                                    {gaRealtime.activeUsers}
                                  </span>
                                  <span className="text-[10px] text-emerald-600 dark:text-emerald-400">live</span>
                                </div>
                              )}
                              <ChevronDown className={`h-4 w-4 transition-transform ${gaOpen ? "rotate-180" : ""}`} />
                            </div>
                          </button>

                          {gaOpen && gaConfigured === true && (
                            <div className="mt-4 space-y-4">
                              {/* Pill toggle: Aphylia (GA) ↔ Aphydle (sister daily plant guessing game) */}
                              <PillTabs
                                activeKey={analyticsTab}
                                onTabChange={(k) => setAnalyticsTab(k)}
                                tabs={[
                                  { key: "aphylia", label: "Aphylia" },
                                  { key: "aphydle", label: "Aphydle" },
                                ]}
                                className="!justify-start"
                              />

                              {analyticsTab === "aphylia" && (<>
                              {/* Period selector + refresh */}
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-1">
                                  {([7, 14, 30] as const).map((d) => (
                                    <button
                                      key={d}
                                      type="button"
                                      className={`text-xs px-2.5 py-1 rounded-lg border transition-colors ${gaDays === d ? "bg-black dark:bg-white text-white dark:text-black border-black dark:border-white" : "bg-white dark:bg-[#2d2d30] border-stone-200 dark:border-[#3e3e42] hover:bg-stone-50 dark:hover:bg-[#3e3e42]"}`}
                                      onClick={() => setGaDays(d)}
                                      aria-pressed={gaDays === d}
                                    >
                                      {d}d
                                    </button>
                                  ))}
                                </div>
                                <div className="flex items-center gap-2">
                                  {gaUpdatedAt && (
                                    <span className="text-[10px] opacity-50">{formatTimeAgo(gaUpdatedAt)}</span>
                                  )}
                                  <Button
                                    variant="outline"
                                    size="icon"
                                    aria-label="Refresh GA data"
                                    onClick={() => { loadGaRealtime(); loadGaReports({ initial: false }); }}
                                    disabled={gaLoading}
                                    className="h-7 w-7 rounded-lg"
                                  >
                                    <RefreshCw className={`h-3.5 w-3.5 ${gaLoading ? "animate-spin" : ""}`} />
                                  </Button>
                                </div>
                              </div>

                              {gaError && (
                                <div className="text-xs text-amber-600 dark:text-amber-400 p-2 rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800/40">
                                  {gaError}
                                </div>
                              )}

                              {/* Key metrics cards */}
                              {gaOverview && (
                                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                                  {[
                                    { key: "totalUsers", label: "Users", icon: Users, color: "blue" },
                                    { key: "sessions", label: "Sessions", icon: MousePointer, color: "violet" },
                                    { key: "pageViews", label: "Page Views", icon: Eye, color: "amber" },
                                    { key: "newUsers", label: "New Users", icon: Sparkles, color: "emerald" },
                                  ].map(({ key, label, icon: Icon, color }) => {
                                    const value = gaOverview.metrics[key] ?? 0;
                                    const delta = gaOverview.deltas[key];
                                    return (
                                      <div key={key} className="rounded-xl border p-3 bg-white/80 dark:bg-[#1e1e20]/80">
                                        <div className="flex items-center gap-2 mb-1">
                                          <Icon className={`h-4 w-4 text-${color}-500`} />
                                          <span className="text-xs text-stone-500 dark:text-stone-400">{label}</span>
                                        </div>
                                        <div className="text-xl font-bold tabular-nums">
                                          {key === "avgSessionDuration" ? `${Math.round(value)}s` : value.toLocaleString()}
                                        </div>
                                        {delta !== null && delta !== undefined && (
                                          <div className={`text-[10px] font-medium flex items-center gap-0.5 ${delta > 0 ? "text-emerald-600 dark:text-emerald-400" : delta < 0 ? "text-rose-600 dark:text-rose-400" : "text-stone-400"}`}>
                                            {delta > 0 ? <ArrowUpRight className="h-3 w-3" /> : delta < 0 ? <ArrowDownRight className="h-3 w-3" /> : null}
                                            {delta > 0 ? "+" : ""}{delta}% vs prev
                                          </div>
                                        )}
                                      </div>
                                    );
                                  })}
                                </div>
                              )}

                              {/* Engagement metrics row */}
                              {gaOverview && (
                                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                                  <div className="rounded-xl border p-3 bg-white/80 dark:bg-[#1e1e20]/80">
                                    <div className="text-xs text-stone-500 dark:text-stone-400 mb-1">Avg Session Duration</div>
                                    <div className="text-lg font-bold tabular-nums">
                                      {(() => {
                                        const secs = Math.round(gaOverview.metrics.avgSessionDuration ?? 0);
                                        const m = Math.floor(secs / 60);
                                        const s = secs % 60;
                                        return m > 0 ? `${m}m ${s}s` : `${s}s`;
                                      })()}
                                    </div>
                                    {gaOverview.deltas.avgSessionDuration !== null && gaOverview.deltas.avgSessionDuration !== undefined && (
                                      <div className={`text-[10px] ${(gaOverview.deltas.avgSessionDuration ?? 0) >= 0 ? "text-emerald-600" : "text-rose-600"}`}>
                                        {(gaOverview.deltas.avgSessionDuration ?? 0) > 0 ? "+" : ""}{gaOverview.deltas.avgSessionDuration}%
                                      </div>
                                    )}
                                  </div>
                                  <div className="rounded-xl border p-3 bg-white/80 dark:bg-[#1e1e20]/80">
                                    <div className="text-xs text-stone-500 dark:text-stone-400 mb-1">Bounce Rate</div>
                                    <div className="text-lg font-bold tabular-nums">
                                      {((gaOverview.metrics.bounceRate ?? 0) * 100).toFixed(1)}%
                                    </div>
                                    {gaOverview.deltas.bounceRate !== null && gaOverview.deltas.bounceRate !== undefined && (
                                      <div className={`text-[10px] ${(gaOverview.deltas.bounceRate ?? 0) <= 0 ? "text-emerald-600" : "text-rose-600"}`}>
                                        {(gaOverview.deltas.bounceRate ?? 0) > 0 ? "+" : ""}{gaOverview.deltas.bounceRate}%
                                      </div>
                                    )}
                                  </div>
                                  <div className="rounded-xl border p-3 bg-white/80 dark:bg-[#1e1e20]/80">
                                    <div className="text-xs text-stone-500 dark:text-stone-400 mb-1">Engaged Sessions</div>
                                    <div className="text-lg font-bold tabular-nums">
                                      {(gaOverview.metrics.engagedSessions ?? 0).toLocaleString()}
                                    </div>
                                  </div>
                                </div>
                              )}

                              {/* Daily traffic chart */}
                              {gaSeries.length > 0 && (() => {
                                  const metricOpts: Array<{ key: string; label: string; color: string }> = [
                                    { key: "users", label: "Users", color: "#3b82f6" },
                                    { key: "pageViews", label: "Page Views", color: "#f59e0b" },
                                    { key: "sessions", label: "Sessions", color: "#10b981" },
                                    { key: "newUsers", label: "New Users", color: "#8b5cf6" },
                                  ];
                                  const visibleMetrics = metricOpts.filter(m => gaChartMetrics.has(m.key));
                                  const toggleMetric = (key: string) => {
                                    setGaChartMetrics(prev => {
                                      const next = new Set(prev);
                                      if (next.has(key)) {
                                        if (next.size > 1) next.delete(key);
                                      } else {
                                        next.add(key);
                                      }
                                      return next;
                                    });
                                  };
                                  // Area fill only when a single metric is active
                                  const soloMetric = visibleMetrics.length === 1 ? visibleMetrics[0] : null;
                                  return (
                                    <div className="rounded-xl border p-3">
                                      <div className="flex items-center justify-between mb-2">
                                        <div className="text-sm font-medium">Daily Traffic - last {gaDays} days</div>
                                        <div className="flex items-center gap-1">
                                          {metricOpts.map((m) => {
                                            const on = gaChartMetrics.has(m.key);
                                            return (
                                              <button
                                                key={m.key}
                                                type="button"
                                                onClick={() => toggleMetric(m.key)}
                                                className={`text-[10px] px-2 py-0.5 rounded-full transition-colors ${
                                                  on
                                                    ? "text-white font-medium"
                                                    : "bg-stone-100 dark:bg-stone-800 opacity-40 hover:opacity-80"
                                                }`}
                                                style={on ? { backgroundColor: m.color } : undefined}
                                              >
                                                {m.label}
                                              </button>
                                            );
                                          })}
                                        </div>
                                      </div>
                                      <div className="h-56 w-full">
                                        <ChartSuspense fallback={<div className="h-full flex items-center justify-center text-sm text-gray-400">Loading chart...</div>}>
                                          <ResponsiveContainer width="100%" height="100%">
                                            <ComposedChart data={gaSeries} margin={{ top: 8, right: 8, bottom: 8, left: 8 }}>
                                              {soloMetric && (
                                                <defs>
                                                  <linearGradient id="gaMetricGrad" x1="0" y1="0" x2="0" y2="1">
                                                    <stop offset="0%" stopColor={soloMetric.color} stopOpacity={0.3} />
                                                    <stop offset="100%" stopColor={soloMetric.color} stopOpacity={0.05} />
                                                  </linearGradient>
                                                </defs>
                                              )}
                                              <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.06)" />
                                              <XAxis
                                                dataKey="date"
                                                tickFormatter={(d: string) => {
                                                  try {
                                                    const dt = new Date(d + "T00:00:00Z");
                                                    return gaDays <= 14 ? ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"][dt.getUTCDay()] : `${dt.getUTCMonth()+1}/${dt.getUTCDate()}`;
                                                  } catch { return d; }
                                                }}
                                                tick={{ fontSize: 10 }}
                                                axisLine={false}
                                                tickLine={false}
                                                interval={gaDays > 14 ? Math.floor(gaDays / 7) - 1 : 0}
                                              />
                                              <YAxis tick={{ fontSize: 10 }} axisLine={false} tickLine={false} width={32} />
                                              <Tooltip
                                                content={({ active: tActive, payload, label }: { active?: boolean; payload?: Array<{ dataKey?: string; value?: number; color?: string }>; label?: string }) => {
                                                  if (!tActive || !payload?.length) return null;
                                                  return (
                                                    <div className="rounded-xl border bg-white/95 dark:bg-[#252526] backdrop-blur p-2.5 shadow-lg text-xs">
                                                      <div className="font-medium opacity-70 mb-1">{label}</div>
                                                      {payload.map((p) => (
                                                        <div key={p.dataKey} className="flex items-center gap-2">
                                                          <span className="w-2 h-2 rounded-full" style={{ background: p.color }} />
                                                          <span className="capitalize">{p.dataKey === "pageViews" ? "Page Views" : p.dataKey === "newUsers" ? "New Users" : p.dataKey}</span>
                                                          <span className="font-bold tabular-nums ml-auto">{p.value?.toLocaleString()}</span>
                                                        </div>
                                                      ))}
                                                    </div>
                                                  );
                                                }}
                                              />
                                              {soloMetric && (
                                                <Area type="monotone" dataKey={soloMetric.key} fill="url(#gaMetricGrad)" stroke="none" />
                                              )}
                                              {visibleMetrics.map((m) => (
                                                <Line key={m.key} type="monotone" dataKey={m.key} stroke={m.color} strokeWidth={2} dot={false} />
                                              ))}
                                            </ComposedChart>
                                          </ResponsiveContainer>
                                        </ChartSuspense>
                                      </div>
                                    </div>
                                  );
                                })()}

                              {/* Bottom grid: Top pages, Devices, Acquisition, Geo */}
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                {/* Top Pages */}
                                {gaTopPages.length > 0 && (
                                  <div className="rounded-xl border p-3">
                                    <div className="text-sm font-medium mb-2">Top Pages</div>
                                    <div className="space-y-1.5 max-h-64 overflow-auto">
                                      {gaTopPages.map((p, i) => {
                                        const maxViews = gaTopPages[0]?.views || 1;
                                        return (
                                          <div key={p.path} className="flex items-center gap-2 text-xs">
                                            <span className="text-stone-400 w-4 text-right tabular-nums">{i + 1}</span>
                                            <div className="flex-1 min-w-0">
                                              <div className="flex items-center gap-2">
                                                <span className="truncate font-mono text-[11px]" title={p.path}>{p.path}</span>
                                                <span className="text-stone-400 tabular-nums flex-shrink-0">{p.views.toLocaleString()}</span>
                                              </div>
                                              <div className="h-1 rounded-full bg-stone-100 dark:bg-stone-800 mt-0.5">
                                                <div className="h-full rounded-full bg-blue-500/70" style={{ width: `${(p.views / maxViews) * 100}%` }} />
                                              </div>
                                            </div>
                                          </div>
                                        );
                                      })}
                                    </div>
                                  </div>
                                )}

                                {/* Acquisition: Channels + Top Referrers */}
                                {gaAcquisition && (gaAcquisition.channels.length > 0 || gaAcquisition.sources.length > 0) && (
                                  <div className="rounded-xl border p-3">
                                    <div className="text-sm font-medium mb-2">Traffic Channels</div>
                                    {gaAcquisition.channels.length > 0 && (
                                      <>
                                        <div className="h-40">
                                          <ChartSuspense fallback={<div className="h-full flex items-center justify-center text-sm text-gray-400">Loading...</div>}>
                                            <ResponsiveContainer width="100%" height="100%">
                                              <PieChart>
                                                <Pie
                                                  data={gaAcquisition.channels.map(c => ({ name: c.channel, value: c.sessions }))}
                                                  dataKey="value"
                                                  nameKey="name"
                                                  cx="50%"
                                                  cy="50%"
                                                  outerRadius={55}
                                                  innerRadius={30}
                                                  paddingAngle={2}
                                                >
                                                  {gaAcquisition.channels.map((_, i) => (
                                                    <Cell key={i} fill={gaChannelColors[i % gaChannelColors.length]} />
                                                  ))}
                                                </Pie>
                                                <Tooltip
                                                  content={({ active, payload }: { active?: boolean; payload?: Array<{ name?: string; value?: number }> }) => {
                                                    if (!active || !payload?.length) return null;
                                                    return (
                                                      <div className="rounded-lg border bg-white/95 dark:bg-[#252526] backdrop-blur p-2 shadow-lg text-xs">
                                                        <div className="font-medium">{payload[0]?.name}</div>
                                                        <div className="tabular-nums">{payload[0]?.value?.toLocaleString()} sessions</div>
                                                      </div>
                                                    );
                                                  }}
                                                />
                                              </PieChart>
                                            </ResponsiveContainer>
                                          </ChartSuspense>
                                        </div>
                                        <div className="flex flex-wrap gap-x-3 gap-y-1 mt-1 text-[10px]">
                                          {gaAcquisition.channels.slice(0, 6).map((c, i) => (
                                            <span key={c.channel} className="flex items-center gap-1">
                                              <span className="w-2 h-2 rounded-full" style={{ background: gaChannelColors[i % gaChannelColors.length] }} />
                                              {c.channel} ({c.sessions})
                                            </span>
                                          ))}
                                        </div>
                                      </>
                                    )}
                                    {gaAcquisition.sources.length > 0 && (
                                      <div className={gaAcquisition.channels.length > 0 ? "mt-3 pt-2 border-t" : ""}>
                                        <div className="text-[10px] font-medium opacity-60 mb-1">Top Referrers</div>
                                        <div className="space-y-1">
                                          {gaAcquisition.sources.slice(0, 8).map((s, i) => {
                                            const maxSessions = gaAcquisition!.sources[0]?.sessions || 1;
                                            return (
                                              <div key={s.source} className="flex items-center gap-2 text-xs">
                                                <span className="w-2 h-2 rounded-full" style={{ background: gaChannelColors[i % gaChannelColors.length] }} />
                                                <span className="flex-1 truncate">{s.source}</span>
                                                <span className="tabular-nums text-stone-500">{s.sessions}</span>
                                                <div className="w-16 h-1 rounded-full bg-stone-100 dark:bg-stone-800">
                                                  <div className="h-full rounded-full" style={{ width: `${(s.sessions / maxSessions) * 100}%`, background: gaChannelColors[i % gaChannelColors.length] }} />
                                                </div>
                                              </div>
                                            );
                                          })}
                                        </div>
                                      </div>
                                    )}
                                  </div>
                                )}

                                {/* Device Breakdown */}
                                {gaDevices && gaDevices.devices.length > 0 && (
                                  <div className="rounded-xl border p-3">
                                    <div className="text-sm font-medium mb-2">Devices</div>
                                    <div className="h-40">
                                      <ChartSuspense fallback={<div className="h-full flex items-center justify-center text-sm text-gray-400">Loading...</div>}>
                                        <ResponsiveContainer width="100%" height="100%">
                                          <PieChart>
                                            <Pie
                                              data={gaDevices.devices.map(d => ({ name: d.device, value: d.users }))}
                                              dataKey="value"
                                              nameKey="name"
                                              cx="50%"
                                              cy="50%"
                                              outerRadius={55}
                                              innerRadius={30}
                                              paddingAngle={2}
                                            >
                                              {gaDevices.devices.map((_, i) => (
                                                <Cell key={i} fill={gaDeviceColors[i % gaDeviceColors.length]} />
                                              ))}
                                            </Pie>
                                            <Tooltip
                                              content={({ active, payload }: { active?: boolean; payload?: Array<{ name?: string; value?: number }> }) => {
                                                if (!active || !payload?.length) return null;
                                                return (
                                                  <div className="rounded-lg border bg-white/95 dark:bg-[#252526] backdrop-blur p-2 shadow-lg text-xs">
                                                    <div className="font-medium capitalize">{payload[0]?.name}</div>
                                                    <div className="tabular-nums">{payload[0]?.value?.toLocaleString()} users</div>
                                                  </div>
                                                );
                                              }}
                                            />
                                          </PieChart>
                                        </ResponsiveContainer>
                                      </ChartSuspense>
                                    </div>
                                    <div className="flex flex-wrap gap-x-3 gap-y-1 mt-1 text-[10px]">
                                      {gaDevices.devices.map((d, i) => (
                                        <span key={d.device} className="flex items-center gap-1">
                                          <span className="w-2 h-2 rounded-full" style={{ background: gaDeviceColors[i % gaDeviceColors.length] }} />
                                          <span className="capitalize">{d.device}</span> ({d.users})
                                        </span>
                                      ))}
                                    </div>
                                    {gaDevices.browsers.length > 0 && (
                                      <div className="mt-3 pt-2 border-t">
                                        <div className="text-[10px] font-medium mb-1 opacity-60">Top Browsers</div>
                                        <div className="flex flex-wrap gap-1">
                                          {gaDevices.browsers.slice(0, 5).map((b) => (
                                            <span key={b.browser} className="text-[10px] px-2 py-0.5 rounded-full bg-stone-100 dark:bg-stone-800">
                                              {b.browser} ({b.users})
                                            </span>
                                          ))}
                                        </div>
                                      </div>
                                    )}
                                  </div>
                                )}

                                {/* Geographic Breakdown: Dot Map + Donut + Cities */}
                                {gaGeo && (gaGeo.countries.length > 0 || gaGeo.cities.length > 0) && (() => {
                                  // Country name → SVG [x, y] coordinates (centroids extracted from the actual SVG map)
                                  const countryCoords: Record<string, [number, number]> = {
                                    "United States": [215.6, 272.1], "United Kingdom": [472.2, 241.3], France: [482.6, 264.6],
                                    Germany: [502.1, 249.1], Netherlands: [490.4, 249.1], Canada: [259.8, 225.5], Australia: [828.6, 491.3],
                                    Brazil: [334.6, 444.6], India: [686.5, 336.7], China: [738.3, 296.1], Japan: [825.1, 291.9],
                                    "South Korea": [801.7, 295.8], Russia: [686.2, 221.3], Italy: [508.5, 272.4], Spain: [473.3, 283.3],
                                    Mexico: [207.4, 334.4], Argentina: [313.7, 519.8], Sweden: [513.7, 216.2], Norway: [502.1, 215.4],
                                    Denmark: [498.2, 233.5], Finland: [534.0, 210.2], Poland: [521.5, 245.2], Switzerland: [498.2, 264.6],
                                    Austria: [513.7, 264.6], Belgium: [490.4, 249.1], Portugal: [459.2, 284.1], Ireland: [459.2, 241.3],
                                    "Czech Republic": [513.7, 256.9], Czechia: [513.7, 256.9], Romania: [537.1, 266.6], Greece: [537.1, 280.2],
                                    Turkey: [564.7, 288.0], "South Africa": [542.7, 499.9], Nigeria: [499.0, 379.7], Egypt: [553.4, 326.2],
                                    Kenya: [579.9, 408.6], Morocco: [461.2, 311.4], Israel: [568.2, 311.4], "Saudi Arabia": [594.2, 333.6],
                                    "United Arab Emirates": [618.8, 334.7], Thailand: [747.2, 364.3], Vietnam: [758.9, 356.1],
                                    Indonesia: [801.4, 417.6], Philippines: [801.7, 361.9], Malaysia: [776.4, 400.9],
                                    Singapore: [776.4, 400.9], "New Zealand": [908.1, 534.5], Colombia: [280.8, 398.6],
                                    Chile: [298.2, 523.3], Peru: [276.3, 439.8], Ukraine: [550.9, 255.1], Hungary: [521.5, 264.6],
                                    Croatia: [513.7, 264.6], Bulgaria: [544.9, 272.4], Serbia: [529.3, 272.4], Slovakia: [525.4, 256.9],
                                    Lithuania: [533.2, 233.5], Latvia: [533.2, 233.5], Estonia: [537.1, 225.7], Iceland: [439.8, 210.2],
                                    Luxembourg: [490.4, 249.1], Taiwan: [794.0, 334.7], Pakistan: [653.8, 315.2], Bangladesh: [716.1, 334.7],
                                    "Sri Lanka": [692.8, 381.4], Nepal: [692.8, 319.1], Algeria: [483.9, 321.6], Tunisia: [498.2, 299.7],
                                    Ghana: [474.8, 385.3], Senegal: [439.8, 365.8], Ethiopia: [583.8, 381.4], Tanzania: [570.3, 430.9],
                                    // Additional countries
                                    "Côte d'Ivoire": [464.0, 385.3], Cameroon: [504.0, 391.0], "Democratic Republic of the Congo": [542.0, 415.0],
                                    Angola: [524.0, 446.0], Mozambique: [570.0, 470.0], Zimbabwe: [553.0, 468.0], Uganda: [570.3, 408.6],
                                    Rwanda: [565.0, 415.0], "Ivory Coast": [464.0, 385.3], Mali: [475.0, 355.0], "Burkina Faso": [478.0, 368.0],
                                    Niger: [500.0, 355.0], Chad: [520.0, 360.0], Sudan: [560.0, 355.0], Libya: [520.0, 320.0],
                                    Venezuela: [298.0, 381.0], Ecuador: [265.0, 415.0], Bolivia: [304.0, 465.0], Paraguay: [318.0, 480.0],
                                    Uruguay: [326.0, 508.0], "Costa Rica": [237.0, 370.0], Panama: [250.0, 375.0], Guatemala: [220.0, 350.0],
                                    Honduras: [230.0, 354.0], "El Salvador": [223.0, 358.0], Nicaragua: [235.0, 362.0], Cuba: [252.0, 330.0],
                                    "Dominican Republic": [278.0, 338.0], Jamaica: [261.0, 340.0], "Puerto Rico": [286.0, 338.0],
                                    "Trinidad and Tobago": [298.0, 368.0], Haiti: [273.0, 338.0],
                                    Iraq: [590.0, 305.0], Iran: [618.0, 308.0], Afghanistan: [644.0, 305.0], Myanmar: [733.0, 348.0],
                                    Cambodia: [756.0, 370.0], Laos: [750.0, 348.0], "North Korea": [801.0, 280.0], Mongolia: [740.0, 264.0],
                                    Kazakhstan: [645.0, 260.0], Uzbekistan: [635.0, 275.0], Turkmenistan: [625.0, 285.0],
                                    Kyrgyzstan: [658.0, 275.0], Tajikistan: [650.0, 285.0], Georgia: [568.0, 275.0], Armenia: [575.0, 280.0],
                                    Azerbaijan: [580.0, 278.0], Jordan: [568.0, 318.0], Lebanon: [565.0, 305.0], Syria: [573.0, 298.0],
                                    Kuwait: [600.0, 320.0], Bahrain: [607.0, 325.0], Qatar: [610.0, 328.0], Oman: [620.0, 345.0],
                                    Yemen: [600.0, 350.0], "Papua New Guinea": [868.0, 430.0], Fiji: [920.0, 465.0],
                                    Madagascar: [585.0, 470.0], Mauritius: [605.0, 468.0], Réunion: [600.0, 472.0],
                                    "Bosnia and Herzegovina": [521.0, 272.0], Slovenia: [513.0, 264.0], "North Macedonia": [533.0, 275.0],
                                    Albania: [529.0, 278.0], Montenegro: [525.0, 274.0], Kosovo: [530.0, 273.0], Moldova: [545.0, 258.0],
                                    Belarus: [540.0, 240.0], "Hong Kong": [778.0, 332.0], Macau: [775.0, 335.0],
                                  };
                                  const top6 = gaGeo.countries.slice(0, 6);
                                  const rest = gaGeo.countries.slice(6);
                                  const otherUsers = rest.reduce((s, c) => s + c.users, 0);
                                  const pieData = top6.map((c) => ({ name: c.country, value: c.users }));
                                  if (otherUsers > 0) pieData.push({ name: `Other (${rest.length})`, value: otherUsers });
                                  const totalUsers = pieData.reduce((s, d) => s + d.value, 0);
                                  const maxUsers = gaGeo.countries[0]?.users || 1;

                                  return (
                                    <div className="rounded-xl border p-3">
                                      <div className="text-sm font-medium mb-2">Top Countries</div>

                                      {/* World Map with country dots — single SVG, coordinates from actual SVG centroids */}
                                      {gaGeo.countries.length > 0 && (() => {
                                        const totalGeoUsers = gaGeo.countries.reduce((s, c) => s + c.users, 0);
                                        return (
                                        <div
                                          className="relative w-full mb-3 rounded-lg overflow-hidden bg-stone-50 dark:bg-stone-900/50 border"
                                          style={{ aspectRatio: "820.44 / 501.3" }}
                                          onMouseLeave={() => setMapTooltip(null)}
                                        >
                                          <svg className="absolute inset-0 w-full h-full" viewBox="103.51 165.78 820.44 501.3" preserveAspectRatio="xMidYMid meet" role="img" aria-label="World map showing user locations">
                                            {/* SVG world map background — themed fill via CSS filter */}
                                            <image
                                              href="https://media.aphylia.app/UTILITY/admin/uploads/svg/worldlow-pixels-46c63cb3-22eb-45ec-be41-55843a3b1093.svg"
                                              x="103.51" y="165.78" width="820.44" height="501.3"
                                              opacity={isDark ? 0.3 : 0.15}
                                              preserveAspectRatio="xMidYMid meet"
                                              style={{ filter: isDark ? "invert(1) brightness(0.6)" : "none" }}
                                            />
                                            {/* Country dots — using exact SVG coordinates from the map */}
                                            {gaGeo.countries.map((c, i) => {
                                              const coords = countryCoords[c.country];
                                              if (!coords) return null;
                                              const ratio = c.users / maxUsers;
                                              const r = 3 + ratio * 10;
                                              const color = i < countryColors.length ? countryColors[i] : "#9ca3af";
                                              const pct = totalGeoUsers > 0 ? Math.round((c.users / totalGeoUsers) * 100) : 0;
                                              return (
                                                <g
                                                  key={c.country}
                                                  style={{ cursor: "pointer" }}
                                                  onMouseEnter={(e) => {
                                                    setMapTooltip({ country: c.country, users: c.users, sessions: c.sessions, pct, color, x: e.clientX, y: e.clientY });
                                                  }}
                                                  onMouseMove={(e) => {
                                                    setMapTooltip((prev) => prev ? { ...prev, x: e.clientX, y: e.clientY } : null);
                                                  }}
                                                  onMouseLeave={() => setMapTooltip(null)}
                                                >
                                                  <circle cx={coords[0]} cy={coords[1]} r={r + 4} fill={color} opacity={0.2} />
                                                  <circle cx={coords[0]} cy={coords[1]} r={r} fill={color} opacity={0.9} />
                                                  {/* Larger invisible hit area for easier hover */}
                                                  <circle cx={coords[0]} cy={coords[1]} r={Math.max(r + 8, 14)} fill="transparent" />
                                                </g>
                                              );
                                            })}
                                          </svg>
                                          {/* HTML tooltip rendered via portal so it floats above all cards */}
                                          {mapTooltip && createPortal(
                                            <div
                                              className="fixed z-[9999] pointer-events-none rounded-lg border border-stone-200 dark:border-stone-700 bg-white dark:bg-[#252526] shadow-lg px-3 py-2 whitespace-nowrap"
                                              style={{ left: mapTooltip.x, top: mapTooltip.y, transform: "translate(-50%, calc(-100% - 12px))" }}
                                            >
                                              <div className="text-xs font-semibold mb-0.5" style={{ color: mapTooltip.color }}>{mapTooltip.country}</div>
                                              <div className="text-xs text-stone-600 dark:text-stone-300">
                                                {mapTooltip.users.toLocaleString()} user{mapTooltip.users !== 1 ? "s" : ""} · {mapTooltip.sessions.toLocaleString()} session{mapTooltip.sessions !== 1 ? "s" : ""} · {mapTooltip.pct}%
                                              </div>
                                            </div>,
                                            document.body
                                          )}
                                        </div>
                                        );
                                      })()}

                                      {/* Donut + Legend */}
                                      {gaGeo.countries.length > 0 && (
                                        <div className="grid grid-cols-1 md:grid-cols-3 gap-1">
                                          <div className="col-span-2 min-h-[150px]">
                                            <ChartSuspense fallback={<div className="h-[150px] w-full flex items-center justify-center text-sm text-gray-400">Loading chart...</div>}>
                                              <ResponsiveContainer width="100%" height={150}>
                                                <PieChart margin={{ top: 0, right: 0, bottom: 0, left: 0 }}>
                                                  <Pie
                                                    data={pieData}
                                                    dataKey="value"
                                                    nameKey="name"
                                                    innerRadius={36}
                                                    outerRadius={64}
                                                    paddingAngle={3}
                                                    cx="40%"
                                                    cy="50%"
                                                    isAnimationActive={false}
                                                  >
                                                    {pieData.map((_, i) => (
                                                      <Cell key={i} fill={countryColors[i % countryColors.length]} strokeWidth={isDark ? 0 : 2} stroke={countryColors[i % countryColors.length]} />
                                                    ))}
                                                  </Pie>
                                                  <Tooltip
                                                    content={({ active, payload }: { active?: boolean; payload?: Array<{ name?: string; value?: number }> }) => {
                                                      if (!active || !payload?.length) return null;
                                                      const pct = totalUsers > 0 ? Math.round(((payload[0]?.value || 0) / totalUsers) * 100) : 0;
                                                      return (
                                                        <div className="rounded-lg border bg-white/95 dark:bg-[#252526] backdrop-blur p-2 shadow-lg text-xs">
                                                          <div className="font-medium">{payload[0]?.name}</div>
                                                          <div className="tabular-nums">{pct}% &middot; {payload[0]?.value?.toLocaleString()} users</div>
                                                        </div>
                                                      );
                                                    }}
                                                  />
                                                </PieChart>
                                              </ResponsiveContainer>
                                            </ChartSuspense>
                                          </div>
                                          <div className="flex flex-col gap-1 justify-center">
                                            {pieData.map((d, i) => {
                                              const pct = totalUsers > 0 ? Math.round((d.value / totalUsers) * 100) : 0;
                                              return (
                                                <div key={d.name} className="flex items-center justify-between">
                                                  <div className="flex-1 flex items-center gap-1.5 min-w-0">
                                                    <span className="inline-block h-3 w-3 rounded-full flex-shrink-0" style={{ backgroundColor: countryColors[i % countryColors.length] }} />
                                                    <span className="text-xs truncate">{d.name}</span>
                                                  </div>
                                                  <span className="text-xs tabular-nums ml-2">{pct}%</span>
                                                </div>
                                              );
                                            })}
                                          </div>
                                        </div>
                                      )}

                                      {/* Top Cities */}
                                      {gaGeo.cities.length > 0 && (
                                        <div className="mt-3 pt-2 border-t">
                                          <div className="text-[10px] font-medium opacity-60 mb-1">Top Cities</div>
                                          <div className="flex flex-wrap gap-1">
                                            {gaGeo.cities.slice(0, 10).map((c) => (
                                              <span key={c.city} className="text-[10px] px-2 py-0.5 rounded-full bg-stone-100 dark:bg-stone-800">
                                                {c.city} ({c.users})
                                              </span>
                                            ))}
                                          </div>
                                        </div>
                                      )}
                                    </div>
                                  );
                                })()}
                              </div>

                              {/* Loading state */}
                              {gaLoading && !gaOverview && (
                                <div className="flex items-center gap-2 text-sm opacity-60 py-4 justify-center">
                                  <Loader2 className="h-4 w-4 animate-spin" />
                                  <span>Loading Google Analytics data...</span>
                                </div>
                              )}
                              </>)}

                              {/* ─── Aphydle analytics tab ─── */}
                              {analyticsTab === "aphydle" && (
                                <div className="space-y-4">
                                  {/* Period selector + refresh — reuses gaDays so the toggle sticks across tabs */}
                                  <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-1">
                                      {([7, 14, 30] as const).map((d) => (
                                        <button
                                          key={d}
                                          type="button"
                                          className={`text-xs px-2.5 py-1 rounded-lg border transition-colors ${gaDays === d ? "bg-black dark:bg-white text-white dark:text-black border-black dark:border-white" : "bg-white dark:bg-[#2d2d30] border-stone-200 dark:border-[#3e3e42] hover:bg-stone-50 dark:hover:bg-[#3e3e42]"}`}
                                          onClick={() => setGaDays(d)}
                                          aria-pressed={gaDays === d}
                                        >
                                          {d}d
                                        </button>
                                      ))}
                                    </div>
                                    <div className="flex items-center gap-2">
                                      {aphydleAnalyticsUpdatedAt && (
                                        <span className="text-[10px] opacity-50">{formatTimeAgo(aphydleAnalyticsUpdatedAt)}</span>
                                      )}
                                      <Button
                                        variant="outline"
                                        size="icon"
                                        aria-label="Refresh Aphydle analytics"
                                        onClick={() => loadAphydleAnalytics(gaDays)}
                                        disabled={aphydleAnalyticsLoading}
                                        className="h-7 w-7 rounded-lg"
                                      >
                                        <RefreshCw className={`h-3.5 w-3.5 ${aphydleAnalyticsLoading ? "animate-spin" : ""}`} />
                                      </Button>
                                    </div>
                                  </div>

                                  {aphydleAnalyticsError && (
                                    <div className="text-xs text-amber-600 dark:text-amber-400 p-2 rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800/40">
                                      {aphydleAnalyticsError}
                                    </div>
                                  )}

                                  {/* Summary stats: Visits / Plays / Guesses / Win rate.
                                      Tailwind JIT can't see classes built via template strings,
                                      so each colour ships its full set of explicit class names. */}
                                  {aphydleAnalytics && (() => {
                                    const t = aphydleAnalytics.totals;
                                    const winRate = t.plays > 0 ? Math.round((t.wins / t.plays) * 1000) / 10 : 0;
                                    const avgGuessesAcross = t.plays > 0 ? Math.round((t.guesses / t.plays) * 10) / 10 : 0;
                                    const cards = [
                                      {
                                        label: "Visits", value: t.visits.toLocaleString(), icon: Eye,
                                        wrap: "bg-blue-50/40 dark:bg-blue-950/20 border-blue-200/50 dark:border-blue-800/40",
                                        iconCls: "text-blue-600 dark:text-blue-400",
                                        valueCls: "text-blue-700 dark:text-blue-300",
                                      },
                                      {
                                        label: "Plays", value: t.plays.toLocaleString(), icon: Gamepad2,
                                        wrap: "bg-fuchsia-50/40 dark:bg-fuchsia-950/20 border-fuchsia-200/50 dark:border-fuchsia-800/40",
                                        iconCls: "text-fuchsia-600 dark:text-fuchsia-400",
                                        valueCls: "text-fuchsia-700 dark:text-fuchsia-300",
                                      },
                                      {
                                        label: "Total Guesses", value: t.guesses.toLocaleString(), icon: MousePointer,
                                        wrap: "bg-violet-50/40 dark:bg-violet-950/20 border-violet-200/50 dark:border-violet-800/40",
                                        iconCls: "text-violet-600 dark:text-violet-400",
                                        valueCls: "text-violet-700 dark:text-violet-300",
                                      },
                                      {
                                        label: "Win Rate", value: `${winRate}%`, icon: Trophy,
                                        wrap: "bg-emerald-50/40 dark:bg-emerald-950/20 border-emerald-200/50 dark:border-emerald-800/40",
                                        iconCls: "text-emerald-600 dark:text-emerald-400",
                                        valueCls: "text-emerald-700 dark:text-emerald-300",
                                      },
                                    ] as const;
                                    return (
                                      <>
                                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                                          {cards.map(({ label, value, icon: Icon, wrap, iconCls, valueCls }) => (
                                            <div key={label} className={`rounded-xl border p-3 ${wrap}`}>
                                              <div className="flex items-center gap-2 mb-1.5">
                                                <Icon className={`h-3.5 w-3.5 ${iconCls}`} />
                                                <span className="text-[10px] font-semibold uppercase tracking-wider opacity-60">{label}</span>
                                              </div>
                                              <div className={`text-2xl font-bold tabular-nums ${valueCls}`}>{value}</div>
                                            </div>
                                          ))}
                                        </div>
                                        {t.plays > 0 && (
                                          <div className="text-[11px] text-stone-500 dark:text-stone-400">
                                            Average <span className="font-bold tabular-nums">{avgGuessesAcross}</span> guesses per play across the last {aphydleAnalytics.timeSeries.length} day{aphydleAnalytics.timeSeries.length === 1 ? "" : "s"}.
                                          </div>
                                        )}
                                      </>
                                    );
                                  })()}

                                  {/* Visits over time */}
                                  {aphydleAnalytics && aphydleAnalytics.timeSeries.length > 0 && (
                                    <div className="rounded-xl border p-3">
                                      <div className="flex items-center justify-between mb-2">
                                        <div className="text-sm font-medium">Daily visits — last {gaDays} days</div>
                                        <span className="text-[10px] opacity-50">page_visits</span>
                                      </div>
                                      <div className="h-44 w-full">
                                        <ChartSuspense fallback={<div className="h-full flex items-center justify-center text-sm text-gray-400">Loading chart...</div>}>
                                          <ResponsiveContainer width="100%" height="100%">
                                            <ComposedChart data={aphydleAnalytics.timeSeries} margin={{ top: 8, right: 8, bottom: 8, left: 8 }}>
                                              <defs>
                                                <linearGradient id="aphydleVisitsGrad" x1="0" y1="0" x2="0" y2="1">
                                                  <stop offset="0%" stopColor="#3b82f6" stopOpacity={0.3} />
                                                  <stop offset="100%" stopColor="#3b82f6" stopOpacity={0.05} />
                                                </linearGradient>
                                              </defs>
                                              <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.06)" />
                                              <XAxis
                                                dataKey="date"
                                                tickFormatter={(d: string) => {
                                                  try {
                                                    const dt = new Date(d + "T00:00:00Z");
                                                    return gaDays <= 14 ? ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"][dt.getUTCDay()] : `${dt.getUTCMonth()+1}/${dt.getUTCDate()}`;
                                                  } catch { return d; }
                                                }}
                                                tick={{ fontSize: 10 }}
                                                axisLine={false}
                                                tickLine={false}
                                                interval={gaDays > 14 ? Math.floor(gaDays / 7) - 1 : 0}
                                              />
                                              <YAxis tick={{ fontSize: 10 }} axisLine={false} tickLine={false} width={32} allowDecimals={false} />
                                              <Tooltip
                                                content={({ active: tActive, payload, label }: { active?: boolean; payload?: Array<{ dataKey?: string; value?: number; color?: string }>; label?: string }) => {
                                                  if (!tActive || !payload?.length) return null;
                                                  return (
                                                    <div className="rounded-xl border bg-white/95 dark:bg-[#252526] backdrop-blur p-2.5 shadow-lg text-xs">
                                                      <div className="font-medium opacity-70 mb-1">{label}</div>
                                                      {payload.map((p) => (
                                                        <div key={p.dataKey} className="flex items-center gap-2">
                                                          <span className="w-2 h-2 rounded-full" style={{ background: p.color }} />
                                                          <span className="capitalize">{p.dataKey}</span>
                                                          <span className="font-bold tabular-nums ml-auto">{p.value?.toLocaleString()}</span>
                                                        </div>
                                                      ))}
                                                    </div>
                                                  );
                                                }}
                                              />
                                              <Area type="monotone" dataKey="visits" fill="url(#aphydleVisitsGrad)" stroke="none" />
                                              <Line type="monotone" dataKey="visits" stroke="#3b82f6" strokeWidth={2} dot={false} />
                                            </ComposedChart>
                                          </ResponsiveContainer>
                                        </ChartSuspense>
                                      </div>
                                    </div>
                                  )}

                                  {/* Plays + guesses + wins over time */}
                                  {aphydleAnalytics && aphydleAnalytics.timeSeries.length > 0 && (
                                    <div className="rounded-xl border p-3">
                                      <div className="flex items-center justify-between mb-2">
                                        <div className="text-sm font-medium">Plays, guesses &amp; wins — last {gaDays} days</div>
                                        <div className="flex items-center gap-3 text-[10px]">
                                          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-fuchsia-500" /> Plays</span>
                                          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-violet-500" /> Guesses</span>
                                          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-emerald-500" /> Wins</span>
                                        </div>
                                      </div>
                                      <div className="h-56 w-full">
                                        <ChartSuspense fallback={<div className="h-full flex items-center justify-center text-sm text-gray-400">Loading chart...</div>}>
                                          <ResponsiveContainer width="100%" height="100%">
                                            <ComposedChart data={aphydleAnalytics.timeSeries} margin={{ top: 8, right: 8, bottom: 8, left: 8 }}>
                                              <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.06)" />
                                              <XAxis
                                                dataKey="date"
                                                tickFormatter={(d: string) => {
                                                  try {
                                                    const dt = new Date(d + "T00:00:00Z");
                                                    return gaDays <= 14 ? ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"][dt.getUTCDay()] : `${dt.getUTCMonth()+1}/${dt.getUTCDate()}`;
                                                  } catch { return d; }
                                                }}
                                                tick={{ fontSize: 10 }}
                                                axisLine={false}
                                                tickLine={false}
                                                interval={gaDays > 14 ? Math.floor(gaDays / 7) - 1 : 0}
                                              />
                                              <YAxis tick={{ fontSize: 10 }} axisLine={false} tickLine={false} width={32} allowDecimals={false} />
                                              <Tooltip
                                                content={({ active: tActive, payload, label }: { active?: boolean; payload?: Array<{ dataKey?: string; value?: number; color?: string }>; label?: string }) => {
                                                  if (!tActive || !payload?.length) return null;
                                                  return (
                                                    <div className="rounded-xl border bg-white/95 dark:bg-[#252526] backdrop-blur p-2.5 shadow-lg text-xs">
                                                      <div className="font-medium opacity-70 mb-1">{label}</div>
                                                      {payload.map((p) => (
                                                        <div key={p.dataKey} className="flex items-center gap-2">
                                                          <span className="w-2 h-2 rounded-full" style={{ background: p.color }} />
                                                          <span className="capitalize">{p.dataKey === "players" ? "plays" : p.dataKey === "attempts" ? "guesses" : p.dataKey}</span>
                                                          <span className="font-bold tabular-nums ml-auto">{p.value?.toLocaleString()}</span>
                                                        </div>
                                                      ))}
                                                    </div>
                                                  );
                                                }}
                                              />
                                              <Line type="monotone" dataKey="players" stroke="#d946ef" strokeWidth={2} dot={false} />
                                              <Line type="monotone" dataKey="attempts" stroke="#8b5cf6" strokeWidth={2} dot={false} />
                                              <Line type="monotone" dataKey="wins" stroke="#10b981" strokeWidth={2} dot={false} />
                                            </ComposedChart>
                                          </ResponsiveContainer>
                                        </ChartSuspense>
                                      </div>
                                    </div>
                                  )}

                                  {/* Last 5 puzzles — one card each with a mini histogram */}
                                  {aphydleAnalytics && aphydleAnalytics.lastPuzzles.length > 0 && (
                                    <div>
                                      <div className="text-sm font-medium mb-2">Last {aphydleAnalytics.lastPuzzles.length} puzzles</div>
                                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
                                        {aphydleAnalytics.lastPuzzles.map((p) => {
                                          const peak = Math.max(1, ...p.buckets, p.losses);
                                          const winRatePuzzle = p.players > 0 ? Math.round((p.wins / p.players) * 100) : 0;
                                          // Avg guesses on a winning play: weighted average of bucket index (1..10) by bucket count
                                          const winningGuessSum = p.buckets.reduce((s, c, i) => s + c * (i + 1), 0);
                                          const avgWinGuesses = p.wins > 0 ? Math.round((winningGuessSum / p.wins) * 10) / 10 : null;
                                          return (
                                            <div key={p.puzzleNo} className="rounded-xl border p-3 bg-fuchsia-50/30 dark:bg-fuchsia-950/15 border-fuchsia-200/40 dark:border-fuchsia-800/30">
                                              <div className="flex items-baseline justify-between mb-1">
                                                <div className="text-xs font-semibold">#{p.puzzleNo}</div>
                                                <div className="text-[10px] opacity-50">{p.puzzleDate}</div>
                                              </div>
                                              {p.plantName && (
                                                <div className="text-[11px] text-fuchsia-700 dark:text-fuchsia-300 truncate" title={p.plantName}>{p.plantName}</div>
                                              )}
                                              <div className="mt-2 flex items-baseline gap-1">
                                                <span className="text-2xl font-bold tabular-nums text-fuchsia-700 dark:text-fuchsia-300">{p.players}</span>
                                                <span className="text-[10px] text-stone-500 dark:text-stone-400">plays</span>
                                              </div>
                                              <div className="text-[10px] text-stone-500 dark:text-stone-400">
                                                {p.wins} win{p.wins === 1 ? "" : "s"} · {p.losses} loss{p.losses === 1 ? "" : "es"}
                                                {p.players > 0 && ` · ${winRatePuzzle}%`}
                                              </div>
                                              {avgWinGuesses != null && (
                                                <div className="text-[10px] text-stone-500 dark:text-stone-400">avg {avgWinGuesses} guesses to win</div>
                                              )}
                                              {/* Mini histogram: 1..10 wins + losses bar */}
                                              <div className="mt-2 flex items-end gap-0.5 h-12" aria-hidden="true">
                                                {p.buckets.map((c, i) => (
                                                  <div
                                                    key={i}
                                                    className="flex-1 rounded-sm bg-emerald-400/80 dark:bg-emerald-500/70"
                                                    style={{ height: `${(c / peak) * 100}%`, minHeight: c > 0 ? 2 : 0 }}
                                                    title={`${i + 1} guess${i === 0 ? "" : "es"}: ${c}`}
                                                  />
                                                ))}
                                                <div
                                                  className="flex-1 rounded-sm bg-rose-400/80 dark:bg-rose-500/70"
                                                  style={{ height: `${(p.losses / peak) * 100}%`, minHeight: p.losses > 0 ? 2 : 0 }}
                                                  title={`Lost: ${p.losses}`}
                                                />
                                              </div>
                                              <div className="mt-0.5 flex justify-between text-[9px] opacity-50">
                                                <span>1</span>
                                                <span>10</span>
                                                <span>X</span>
                                              </div>
                                            </div>
                                          );
                                        })}
                                      </div>
                                    </div>
                                  )}

                                  {/* Loading state */}
                                  {aphydleAnalyticsLoading && !aphydleAnalytics && (
                                    <div className="flex items-center gap-2 text-sm opacity-60 py-4 justify-center">
                                      <Loader2 className="h-4 w-4 animate-spin" />
                                      <span>Loading Aphydle analytics...</span>
                                    </div>
                                  )}

                                  {/* Empty state */}
                                  {!aphydleAnalyticsLoading && !aphydleAnalyticsError && aphydleAnalytics && aphydleAnalytics.timeSeries.every((p) => p.visits === 0 && p.players === 0) && (
                                    <div className="text-xs text-stone-500 dark:text-stone-400 py-4 text-center">
                                      No Aphydle activity recorded in the last {gaDays} days.
                                    </div>
                                  )}
                                </div>
                              )}
                            </div>
                          )}

                          {gaOpen && gaConfigured === null && (
                            <div className="mt-3 flex items-center gap-2 text-xs opacity-50">
                              <Loader2 className="h-3 w-3 animate-spin" />
                              Checking GA configuration...
                            </div>
                          )}

                          {gaOpen && gaConfigured === false && (
                            <div className="mt-3 text-xs text-stone-500 dark:text-stone-400 space-y-1">
                              <p>To enable Google Analytics, set these environment variables on the server:</p>
                              <ul className="list-disc list-inside space-y-0.5 font-mono text-[10px]">
                                <li>GA4_PROPERTY_ID (numeric property ID)</li>
                                <li>GOOGLE_APPLICATION_CREDENTIALS or GA_SERVICE_ACCOUNT_JSON</li>
                              </ul>
                            </div>
                          )}
                        </CardContent>
                      </Card>
                    )}

                    {/* ─── Connected IPs Table ─── */}
                    <Card className={glassCardClass}>
                      <CardContent className="p-4">
                        <div className="flex items-center justify-between mb-3">
                          <div className="flex items-center gap-2">
                            <Wifi className="h-4 w-4 opacity-50" />
                            <span className="text-sm font-semibold">Connected IPs</span>
                            {enrichedIps.length > 0 && (
                              <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-stone-100 dark:bg-stone-800 tabular-nums">{enrichedIps.length}</span>
                            )}
                          </div>
                          <div className="flex items-center gap-2">
                            {ipsUpdatedAt && (
                              <span className="text-[10px] opacity-40">{formatTimeAgo(ipsUpdatedAt)}</span>
                            )}
                            <Button
                              variant="ghost"
                              size="icon"
                              aria-label="Refresh IPs"
                              onClick={() => loadEnrichedIps({ initial: false })}
                              disabled={ipsLoading || ipsRefreshing}
                              className="h-7 w-7 rounded-lg"
                            >
                              <RefreshCw className={`h-3.5 w-3.5 ${ipsRefreshing ? "animate-spin" : ""}`} />
                            </Button>
                          </div>
                        </div>
                        {ipsLoading ? (
                          <div className="flex items-center gap-2 text-sm opacity-60 py-4 justify-center">
                            <Loader2 className="h-4 w-4 animate-spin" />
                            <span>Loading connected IPs...</span>
                          </div>
                        ) : enrichedIps.length === 0 ? (
                          <div className="text-sm opacity-50 text-center py-4">No connected IPs in the last 60 minutes.</div>
                        ) : (
                          <div className="overflow-x-auto -mx-4">
                            <table className="w-full text-xs">
                              <thead>
                                <tr className="border-b text-left">
                                  <th className="px-4 py-2 font-medium opacity-50">IP Address</th>
                                  <th className="px-4 py-2 font-medium opacity-50">Country</th>
                                  <th className="px-4 py-2 font-medium opacity-50 text-center">Account</th>
                                  <th className="px-4 py-2 font-medium opacity-50 text-right">Visits</th>
                                  <th className="px-4 py-2 font-medium opacity-50 text-right">RPM (5m)</th>
                                </tr>
                              </thead>
                              <tbody>
                                {enrichedIps.map((row) => (
                                  <tr
                                    key={row.ip}
                                    className="border-b border-stone-100 dark:border-stone-800/50 hover:bg-stone-50 dark:hover:bg-stone-800/30 cursor-pointer transition-colors"
                                    onClick={() => jumpToIpLookup(row.ip)}
                                    title={`Lookup members for ${row.ip}`}
                                  >
                                    <td className="px-4 py-2 font-mono tabular-nums">{row.ip}</td>
                                    <td className="px-4 py-2">
                                      {row.country ? (
                                        <span className="inline-flex items-center gap-1">
                                          <Globe className="h-3 w-3 opacity-40" />
                                          {countryCodeToName(row.country)}
                                        </span>
                                      ) : (
                                        <span className="opacity-30">—</span>
                                      )}
                                    </td>
                                    <td className="px-4 py-2 text-center">
                                      {row.hasAccount ? (
                                        <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-emerald-100 dark:bg-emerald-900/50 text-emerald-600 dark:text-emerald-400">
                                          <Check className="h-3 w-3" />
                                        </span>
                                      ) : (
                                        <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-stone-100 dark:bg-stone-800 opacity-40">
                                          <X className="h-3 w-3" />
                                        </span>
                                      )}
                                    </td>
                                    <td className="px-4 py-2 text-right tabular-nums">{row.visits}</td>
                                    <td className="px-4 py-2 text-right tabular-nums">
                                      <span className={row.rpm >= 10 ? "text-amber-600 dark:text-amber-400 font-medium" : row.rpm >= 30 ? "text-rose-600 dark:text-rose-400 font-bold" : ""}>
                                        {row.rpm}
                                      </span>
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        )}
                      </CardContent>
                    </Card>

                      {/* ═══ QUICK LINKS ═══ */}
                      <div className="flex items-center gap-2 mt-2">
                        <ExternalLink className="h-3.5 w-3.5 opacity-40" />
                        <span className="text-[10px] font-semibold uppercase tracking-widest opacity-40">Quick Links</span>
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
                                      Status distribution, progress gauge, and featured month calendar
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

                                  {/* Featured Month Chart */}
                                  <div className="rounded-xl border border-stone-200/80 dark:border-[#3e3e42] bg-stone-50/50 dark:bg-[#17171d] p-4 flex flex-col">
                                    <div className="flex items-center gap-3 mb-4">
                                      <div className="w-8 h-8 rounded-lg bg-cyan-100 dark:bg-cyan-900/30 flex items-center justify-center">
                                        <Calendar className="h-4 w-4 text-cyan-600 dark:text-cyan-400" />
                                      </div>
                                      <div>
                                        <div className="text-sm font-semibold text-stone-900 dark:text-white">Featured Month</div>
                                        <div className="text-xs text-stone-500 dark:text-stone-400">Plants promoted per month</div>
                                      </div>
                                    </div>
                                    <div className="w-full h-[280px] sm:h-[320px]">
                                      {plantTableLoading ? (
                                        <div className="flex h-full items-center justify-center text-sm text-stone-500 dark:text-stone-400">
                                          Loading chart...
                                        </div>
                                      ) : !hasFeaturedMonthData ? (
                                        <div className="flex h-full items-center justify-center text-sm text-stone-500 dark:text-stone-400">
                                          No featured month data yet.
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
                                            <BarChart data={featuredMonthData} barCategoryGap="10%" margin={{ left: 16, right: 16, top: 16, bottom: 12 }}>
                                              <CartesianGrid
                                                strokeDasharray="3 3"
                                                stroke={isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.06)"}
                                              />
                                              <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                                              <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                                              <Tooltip
                                                cursor={{ fill: isDark ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.03)" }}
                                                formatter={(value: number) => [`${value} plants`, "Featured"]}
                                              />
                                              <Bar 
                                                dataKey="value" 
                                                fill={accentColor} 
                                                radius={6}
                                                cursor="pointer"
                                                onClick={(data: { slug?: string }) => {
                                                  if (data?.slug) {
                                                    setSelectedFeaturedMonth(data.slug as FeaturedMonthSlug);
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
                                          <Select
                                            value={selectedFeaturedMonth}
                                            onChange={(e) =>
                                              setSelectedFeaturedMonth(e.target.value as FeaturedMonthSlug | "none" | "all")
                                            }
                                          >
                                            <option value="all">All featured months</option>
                                            <option value="none">None assigned</option>
                                            {FEATURED_MONTH_SLUGS.map((slug) => (
                                              <option key={slug} value={slug}>
                                                {FEATURED_MONTH_LABELS[slug]}
                                              </option>
                                            ))}
                                          </Select>
                                        </div>
                                        <div className="w-full md:w-44">
                                          <Select
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
                                          </Select>
                                        </div>
                                        <div className="w-full md:w-32">
                                          <Select
                                            value={plantPageSize}
                                            onChange={(e) => setPlantPageSize(Number(e.target.value))}
                                          >
                                            {PLANT_PAGE_SIZE_OPTIONS.map((size) => (
                                              <option key={size} value={size}>
                                                {size} per page
                                              </option>
                                            ))}
                                          </Select>
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

                                    {/* Bulk Quick Edit Dropdown */}
                                    <DropdownMenu>
                                      <DropdownMenuTrigger asChild>
                                        <button
                                          type="button"
                                          className="flex items-center gap-1.5 rounded-lg border border-violet-300 dark:border-violet-700 bg-white dark:bg-[#1a1a1d] px-3 py-1.5 text-xs font-medium text-violet-700 dark:text-violet-300 hover:bg-violet-100 dark:hover:bg-violet-900/40 transition-colors"
                                          disabled={bulkActionLoading}
                                        >
                                          <SlidersHorizontal className="h-3.5 w-3.5" />
                                          Quick Edit
                                        </button>
                                      </DropdownMenuTrigger>
                                      <DropdownMenuContent align="end" className="w-56 max-h-[70vh] overflow-y-auto">
                                        <DropdownMenuLabel>
                                          Edit {selectedPlantIds.size} {selectedPlantIds.size === 1 ? "plant" : "plants"}
                                        </DropdownMenuLabel>
                                        <DropdownMenuSeparator />

                                        {/* Living Space */}
                                        <DropdownMenuSub>
                                          <DropdownMenuSubTrigger>Living Space</DropdownMenuSubTrigger>
                                          <DropdownMenuSubContent>
                                            {LIVING_SPACE_OPTIONS.map((opt) => (
                                              <DropdownMenuCheckboxItem
                                                key={opt.value}
                                                checked={false}
                                                onCheckedChange={() =>
                                                  handleBulkQuickUpdate("living_space", "livingSpace", opt.value, "toggle-array")
                                                }
                                              >
                                                {opt.label}
                                              </DropdownMenuCheckboxItem>
                                            ))}
                                          </DropdownMenuSubContent>
                                        </DropdownMenuSub>

                                        {/* Plant Type */}
                                        <DropdownMenuSub>
                                          <DropdownMenuSubTrigger>Plant Type</DropdownMenuSubTrigger>
                                          <DropdownMenuSubContent>
                                            <DropdownMenuRadioGroup
                                              value=""
                                              onValueChange={(v) =>
                                                handleBulkQuickUpdate("plant_type", "plantType", v, "set")
                                              }
                                            >
                                              {PLANT_TYPE_OPTIONS.map((opt) => (
                                                <DropdownMenuRadioItem key={opt.value} value={opt.value}>
                                                  {opt.label}
                                                </DropdownMenuRadioItem>
                                              ))}
                                            </DropdownMenuRadioGroup>
                                          </DropdownMenuSubContent>
                                        </DropdownMenuSub>

                                        {/* Climate */}
                                        <DropdownMenuSub>
                                          <DropdownMenuSubTrigger>Climate</DropdownMenuSubTrigger>
                                          <DropdownMenuSubContent className="max-h-60 overflow-y-auto">
                                            {CLIMATE_OPTIONS.map((opt) => (
                                              <DropdownMenuCheckboxItem
                                                key={opt.value}
                                                checked={false}
                                                onCheckedChange={() =>
                                                  handleBulkQuickUpdate("climate", "climate", opt.value, "toggle-array")
                                                }
                                              >
                                                {opt.label}
                                              </DropdownMenuCheckboxItem>
                                            ))}
                                          </DropdownMenuSubContent>
                                        </DropdownMenuSub>

                                        {/* Featured Month */}
                                        <DropdownMenuSub>
                                          <DropdownMenuSubTrigger>Featured Month</DropdownMenuSubTrigger>
                                          <DropdownMenuSubContent className="max-h-60 overflow-y-auto">
                                            {FEATURED_MONTH_SLUGS.map((slug) => (
                                              <DropdownMenuCheckboxItem
                                                key={slug}
                                                checked={false}
                                                onCheckedChange={() =>
                                                  handleBulkQuickUpdate("featured_month", "featuredMonths", slug, "toggle-array")
                                                }
                                              >
                                                {FEATURED_MONTH_LABELS[slug]}
                                              </DropdownMenuCheckboxItem>
                                            ))}
                                          </DropdownMenuSubContent>
                                        </DropdownMenuSub>

                                        <DropdownMenuSeparator />

                                        {/* Toxicity Human */}
                                        <DropdownMenuSub>
                                          <DropdownMenuSubTrigger>Toxicity (Human)</DropdownMenuSubTrigger>
                                          <DropdownMenuSubContent>
                                            <DropdownMenuRadioGroup
                                              value=""
                                              onValueChange={(v) =>
                                                handleBulkQuickUpdate("toxicity_human", "toxicityHuman", v, "set")
                                              }
                                            >
                                              {TOXICITY_OPTIONS.map((opt) => (
                                                <DropdownMenuRadioItem key={opt.value} value={opt.value}>
                                                  {opt.label}
                                                </DropdownMenuRadioItem>
                                              ))}
                                            </DropdownMenuRadioGroup>
                                          </DropdownMenuSubContent>
                                        </DropdownMenuSub>

                                        {/* Toxicity Pets */}
                                        <DropdownMenuSub>
                                          <DropdownMenuSubTrigger>Toxicity (Pets)</DropdownMenuSubTrigger>
                                          <DropdownMenuSubContent>
                                            <DropdownMenuRadioGroup
                                              value=""
                                              onValueChange={(v) =>
                                                handleBulkQuickUpdate("toxicity_pets", "toxicityPets", v, "set")
                                              }
                                            >
                                              {TOXICITY_OPTIONS.map((opt) => (
                                                <DropdownMenuRadioItem key={opt.value} value={opt.value}>
                                                  {opt.label}
                                                </DropdownMenuRadioItem>
                                              ))}
                                            </DropdownMenuRadioGroup>
                                          </DropdownMenuSubContent>
                                        </DropdownMenuSub>

                                        <DropdownMenuSeparator />

                                        {/* Sunlight */}
                                        <DropdownMenuSub>
                                          <DropdownMenuSubTrigger>Sunlight</DropdownMenuSubTrigger>
                                          <DropdownMenuSubContent className="max-h-60 overflow-y-auto">
                                            {SUNLIGHT_OPTIONS.map((opt) => (
                                              <DropdownMenuCheckboxItem
                                                key={opt.value}
                                                checked={false}
                                                onCheckedChange={() =>
                                                  handleBulkQuickUpdate("sunlight", "sunlight", opt.value, "toggle-array")
                                                }
                                              >
                                                {opt.label}
                                              </DropdownMenuCheckboxItem>
                                            ))}
                                          </DropdownMenuSubContent>
                                        </DropdownMenuSub>

                                        {/* Care Level */}
                                        <DropdownMenuSub>
                                          <DropdownMenuSubTrigger>Care Level</DropdownMenuSubTrigger>
                                          <DropdownMenuSubContent>
                                            {CARE_LEVEL_OPTIONS.map((opt) => (
                                              <DropdownMenuCheckboxItem
                                                key={opt.value}
                                                checked={false}
                                                onCheckedChange={() =>
                                                  handleBulkQuickUpdate("care_level", "careLevel", opt.value, "toggle-array")
                                                }
                                              >
                                                {opt.label}
                                              </DropdownMenuCheckboxItem>
                                            ))}
                                          </DropdownMenuSubContent>
                                        </DropdownMenuSub>
                                      </DropdownMenuContent>
                                    </DropdownMenu>

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
                              <>
                                <div className="divide-y divide-stone-100 dark:divide-[#2a2a2d]">
                                  {/* Select All Row */}
                                  <div className="flex items-center gap-3 px-4 sm:px-5 py-2 bg-stone-50/50 dark:bg-[#1a1a1d]">
                                    <button
                                      type="button"
                                      onClick={() => toggleSelectAllPlants(visiblePlantRows.map((p) => p.id))}
                                      className={`flex items-center justify-center w-5 h-5 rounded border-2 transition-colors flex-shrink-0 ${
                                        visiblePlantRows.length > 0 && visiblePlantRows.every((p) => selectedPlantIds.has(p.id))
                                          ? 'border-emerald-500 bg-emerald-500'
                                          : selectedPlantIds.size > 0
                                            ? 'border-emerald-500 bg-emerald-500/30'
                                            : 'border-stone-300 dark:border-stone-600 hover:border-emerald-400'
                                      }`}
                                      title={visiblePlantRows.every((p) => selectedPlantIds.has(p.id)) ? "Deselect all" : "Select all"}
                                    >
                                      {visiblePlantRows.length > 0 && visiblePlantRows.every((p) => selectedPlantIds.has(p.id)) ? (
                                        <Check className="h-3.5 w-3.5 text-white" />
                                      ) : selectedPlantIds.size > 0 ? (
                                        <span className="block w-2 h-0.5 bg-emerald-500 rounded" />
                                      ) : null}
                                    </button>
                                    <span className="text-xs text-stone-500 dark:text-stone-400">
                                      {selectedPlantIds.size > 0
                                        ? `${selectedPlantIds.size} of ${filteredPlantRows.length} selected`
                                        : hasMorePlants
                                          ? `Showing ${visiblePlantRows.length} of ${filteredPlantRows.length} ${filteredPlantRows.length === 1 ? "plant" : "plants"}`
                                          : `${filteredPlantRows.length} ${filteredPlantRows.length === 1 ? "plant" : "plants"}`}
                                    </span>
                                  </div>
                                  {visiblePlantRows.map((plant) => (
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
                                            alt={plant.localizedName || plant.name}
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
                                            {plant.localizedName || plant.name}
                                            {(plant.localizedVariety || plant.variety) && (
                                              <span className="ml-1.5 bg-gradient-to-r from-violet-500 to-fuchsia-500 bg-clip-text text-transparent text-xs sm:text-sm font-extrabold tracking-tight">
                                                &lsquo;{plant.localizedVariety || plant.variety}&rsquo;
                                              </span>
                                            )}
                                          </span>
                                        </div>
                                        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-0.5">
                                          <span className="text-xs text-stone-500 dark:text-stone-400 flex items-center gap-1">
                                            <Calendar className="h-3 w-3" />
                                            {plant.featuredMonths.length > 0 ? plant.featuredMonths.map((m) => FEATURED_MONTH_LABELS[m]).join(", ") : "No month"}
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

                                        {/* Quick Actions Dropdown */}
                                        <DropdownMenu>
                                          <DropdownMenuTrigger asChild>
                                            <button
                                              type="button"
                                              onClick={(e) => e.stopPropagation()}
                                              className="p-1.5 rounded-lg opacity-0 group-hover:opacity-100 hover:bg-violet-100 dark:hover:bg-violet-900/30 text-stone-400 hover:text-violet-600 dark:hover:text-violet-400 transition-all"
                                              title="Quick actions"
                                            >
                                              <SlidersHorizontal className="h-4 w-4" />
                                            </button>
                                          </DropdownMenuTrigger>
                                          <DropdownMenuContent
                                            align="end"
                                            className="w-56 max-h-[70vh] overflow-y-auto"
                                            onClick={(e) => e.stopPropagation()}
                                          >
                                            <DropdownMenuLabel>Quick Edit</DropdownMenuLabel>
                                            <DropdownMenuSeparator />

                                            {/* Living Space (array) */}
                                            <DropdownMenuSub>
                                              <DropdownMenuSubTrigger>
                                                Living Space
                                                {plant.livingSpace.length > 0 && (
                                                  <span className="ml-auto text-[10px] text-stone-400">{plant.livingSpace.length}</span>
                                                )}
                                              </DropdownMenuSubTrigger>
                                              <DropdownMenuSubContent>
                                                {LIVING_SPACE_OPTIONS.map((opt) => (
                                                  <DropdownMenuCheckboxItem
                                                    key={opt.value}
                                                    checked={plant.livingSpace.includes(opt.value)}
                                                    onCheckedChange={() =>
                                                      handleQuickPlantUpdate(plant.id, "living_space", "livingSpace", opt.value, "toggle-array")
                                                    }
                                                  >
                                                    {opt.label}
                                                  </DropdownMenuCheckboxItem>
                                                ))}
                                              </DropdownMenuSubContent>
                                            </DropdownMenuSub>

                                            {/* Plant Type (single) */}
                                            <DropdownMenuSub>
                                              <DropdownMenuSubTrigger>
                                                Plant Type
                                                {plant.plantType && (
                                                  <span className="ml-auto text-[10px] text-stone-400 capitalize">{plant.plantType}</span>
                                                )}
                                              </DropdownMenuSubTrigger>
                                              <DropdownMenuSubContent>
                                                <DropdownMenuRadioGroup
                                                  value={plant.plantType ?? ""}
                                                  onValueChange={(v) =>
                                                    handleQuickPlantUpdate(plant.id, "plant_type", "plantType", v, "set")
                                                  }
                                                >
                                                  {PLANT_TYPE_OPTIONS.map((opt) => (
                                                    <DropdownMenuRadioItem key={opt.value} value={opt.value}>
                                                      {opt.label}
                                                    </DropdownMenuRadioItem>
                                                  ))}
                                                </DropdownMenuRadioGroup>
                                              </DropdownMenuSubContent>
                                            </DropdownMenuSub>

                                            {/* Climate (array) */}
                                            <DropdownMenuSub>
                                              <DropdownMenuSubTrigger>
                                                Climate
                                                {plant.climate.length > 0 && (
                                                  <span className="ml-auto text-[10px] text-stone-400">{plant.climate.length}</span>
                                                )}
                                              </DropdownMenuSubTrigger>
                                              <DropdownMenuSubContent className="max-h-60 overflow-y-auto">
                                                {CLIMATE_OPTIONS.map((opt) => (
                                                  <DropdownMenuCheckboxItem
                                                    key={opt.value}
                                                    checked={plant.climate.includes(opt.value)}
                                                    onCheckedChange={() =>
                                                      handleQuickPlantUpdate(plant.id, "climate", "climate", opt.value, "toggle-array")
                                                    }
                                                  >
                                                    {opt.label}
                                                  </DropdownMenuCheckboxItem>
                                                ))}
                                              </DropdownMenuSubContent>
                                            </DropdownMenuSub>

                                            {/* Featured Month (array) */}
                                            <DropdownMenuSub>
                                              <DropdownMenuSubTrigger>
                                                Featured Month
                                                {plant.featuredMonths.length > 0 && (
                                                  <span className="ml-auto text-[10px] text-stone-400">{plant.featuredMonths.length}</span>
                                                )}
                                              </DropdownMenuSubTrigger>
                                              <DropdownMenuSubContent className="max-h-60 overflow-y-auto">
                                                {FEATURED_MONTH_SLUGS.map((slug) => (
                                                  <DropdownMenuCheckboxItem
                                                    key={slug}
                                                    checked={plant.featuredMonths.includes(slug)}
                                                    onCheckedChange={() =>
                                                      handleQuickPlantUpdate(plant.id, "featured_month", "featuredMonths", slug, "toggle-array")
                                                    }
                                                  >
                                                    {FEATURED_MONTH_LABELS[slug]}
                                                  </DropdownMenuCheckboxItem>
                                                ))}
                                              </DropdownMenuSubContent>
                                            </DropdownMenuSub>

                                            <DropdownMenuSeparator />

                                            {/* Toxicity - Human (single) */}
                                            <DropdownMenuSub>
                                              <DropdownMenuSubTrigger>
                                                Toxicity (Human)
                                                {plant.toxicityHuman && (
                                                  <span className="ml-auto text-[10px] text-stone-400 capitalize">{plant.toxicityHuman.replace(/_/g, " ")}</span>
                                                )}
                                              </DropdownMenuSubTrigger>
                                              <DropdownMenuSubContent>
                                                <DropdownMenuRadioGroup
                                                  value={plant.toxicityHuman ?? ""}
                                                  onValueChange={(v) =>
                                                    handleQuickPlantUpdate(plant.id, "toxicity_human", "toxicityHuman", v, "set")
                                                  }
                                                >
                                                  {TOXICITY_OPTIONS.map((opt) => (
                                                    <DropdownMenuRadioItem key={opt.value} value={opt.value}>
                                                      {opt.label}
                                                    </DropdownMenuRadioItem>
                                                  ))}
                                                </DropdownMenuRadioGroup>
                                              </DropdownMenuSubContent>
                                            </DropdownMenuSub>

                                            {/* Toxicity - Pets (single) */}
                                            <DropdownMenuSub>
                                              <DropdownMenuSubTrigger>
                                                Toxicity (Pets)
                                                {plant.toxicityPets && (
                                                  <span className="ml-auto text-[10px] text-stone-400 capitalize">{plant.toxicityPets.replace(/_/g, " ")}</span>
                                                )}
                                              </DropdownMenuSubTrigger>
                                              <DropdownMenuSubContent>
                                                <DropdownMenuRadioGroup
                                                  value={plant.toxicityPets ?? ""}
                                                  onValueChange={(v) =>
                                                    handleQuickPlantUpdate(plant.id, "toxicity_pets", "toxicityPets", v, "set")
                                                  }
                                                >
                                                  {TOXICITY_OPTIONS.map((opt) => (
                                                    <DropdownMenuRadioItem key={opt.value} value={opt.value}>
                                                      {opt.label}
                                                    </DropdownMenuRadioItem>
                                                  ))}
                                                </DropdownMenuRadioGroup>
                                              </DropdownMenuSubContent>
                                            </DropdownMenuSub>

                                            <DropdownMenuSeparator />

                                            {/* Sunlight Exposure (array) */}
                                            <DropdownMenuSub>
                                              <DropdownMenuSubTrigger>
                                                Sunlight
                                                {plant.sunlight.length > 0 && (
                                                  <span className="ml-auto text-[10px] text-stone-400">{plant.sunlight.length}</span>
                                                )}
                                              </DropdownMenuSubTrigger>
                                              <DropdownMenuSubContent className="max-h-60 overflow-y-auto">
                                                {SUNLIGHT_OPTIONS.map((opt) => (
                                                  <DropdownMenuCheckboxItem
                                                    key={opt.value}
                                                    checked={plant.sunlight.includes(opt.value)}
                                                    onCheckedChange={() =>
                                                      handleQuickPlantUpdate(plant.id, "sunlight", "sunlight", opt.value, "toggle-array")
                                                    }
                                                  >
                                                    {opt.label}
                                                  </DropdownMenuCheckboxItem>
                                                ))}
                                              </DropdownMenuSubContent>
                                            </DropdownMenuSub>

                                            {/* Care Level (array) */}
                                            <DropdownMenuSub>
                                              <DropdownMenuSubTrigger>
                                                Care Level
                                                {plant.careLevel.length > 0 && (
                                                  <span className="ml-auto text-[10px] text-stone-400">{plant.careLevel.length}</span>
                                                )}
                                              </DropdownMenuSubTrigger>
                                              <DropdownMenuSubContent>
                                                {CARE_LEVEL_OPTIONS.map((opt) => (
                                                  <DropdownMenuCheckboxItem
                                                    key={opt.value}
                                                    checked={plant.careLevel.includes(opt.value)}
                                                    onCheckedChange={() =>
                                                      handleQuickPlantUpdate(plant.id, "care_level", "careLevel", opt.value, "toggle-array")
                                                    }
                                                  >
                                                    {opt.label}
                                                  </DropdownMenuCheckboxItem>
                                                ))}
                                              </DropdownMenuSubContent>
                                            </DropdownMenuSub>
                                          </DropdownMenuContent>
                                        </DropdownMenu>

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
                                            handleSelectPlantForPrefill(plant.id, plant.localizedName || plant.name);
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
                                            setPlantToDelete({ id: plant.id, name: plant.localizedName || plant.name });
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
                                {hasMorePlants && (
                                  <div className="flex flex-col items-center gap-2 py-4 px-4 border-t border-stone-100 dark:border-[#2a2a2d]">
                                    <button
                                      type="button"
                                      onClick={() => setPlantVisibleCount((prev) => prev + plantPageSize)}
                                      className="w-full max-w-xs rounded-xl border border-stone-200 dark:border-stone-700 bg-white dark:bg-[#1a1a1d] px-4 py-2.5 text-sm font-medium text-stone-700 dark:text-stone-300 hover:bg-stone-50 dark:hover:bg-[#252528] hover:border-emerald-300 dark:hover:border-emerald-700 transition-all"
                                    >
                                      Load {Math.min(plantPageSize, filteredPlantRows.length - plantVisibleCount)} more
                                      <span className="ml-1.5 text-xs text-stone-400">
                                        ({filteredPlantRows.length - plantVisibleCount} remaining)
                                      </span>
                                    </button>
                                  </div>
                                )}
                              </>
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
                                  plantRequestsLoading || filteredPlantRequests.length === 0
                                }
                                title={`Automatically AI fill, save, and translate the ${filteredPlantRequests.length} visible plant requests`}
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
                                      const trigger = document.querySelector<HTMLButtonElement>('[data-add-from-trigger="true"]');
                                      if (trigger) trigger.click();
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
                                    {aiPrefillStatus !== 'idle' && <Loader2 className="h-3 w-3 animate-spin" />}
                                    {aiPrefillStatus === 'translating_name' ? 'Checking Name' :
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

                                {/* Category progress grid - only visible during AI filling stage */}
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
                                          <div className="text-[10px] text-stone-400 dark:text-stone-500 mt-1 text-right">
                                            {info.completed}/{info.total}
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
                          <button
                            type="button"
                            onClick={() => setRequestSortOrder((prev) => prev === "newest" ? "oldest" : "newest")}
                            className={`flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-medium transition-all whitespace-nowrap border ${
                              requestSortOrder === "oldest"
                                ? "bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800/50 text-amber-700 dark:text-amber-300"
                                : "bg-stone-50 dark:bg-[#252528] border-stone-200 dark:border-[#3e3e42] text-stone-500 dark:text-stone-400"
                            }`}
                            title={requestSortOrder === "newest" ? "Showing newest first — click to show oldest first" : "Showing oldest first — click to show newest first"}
                          >
                            <ArrowDownUp className={`h-3.5 w-3.5 ${requestSortOrder === "oldest" ? "text-amber-600 dark:text-amber-400" : "opacity-50"}`} />
                            {requestSortOrder === "newest" ? "Newest first" : "Oldest first"}
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
                            return filteredPlantRequests.length === 0 ? (
                              <div className="text-sm opacity-60">
                                {requestSearchQuery.trim()
                                  ? "No requests match your search."
                                  : "No pending requests."}
                              </div>
                            ) : (
                              <div className="flex flex-col gap-3">
                                {filteredPlantRequests.map((req) => {
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
                                        <div className="flex flex-col items-end gap-1">
                                          <Badge
                                            variant="secondary"
                                            className="rounded-xl px-2 py-1 text-xs"
                                          >
                                            {req.request_count}{" "}
                                            {req.request_count === 1
                                              ? "request"
                                              : "requests"}
                                          </Badge>
                                          {req.user_count > 0 && (
                                            <span className="text-[10px] text-stone-500 dark:text-stone-400 flex items-center gap-1">
                                              <Users className="h-3 w-3" />
                                              {req.user_count === 1 && req.single_requester_name
                                                ? req.single_requester_name
                                                : `${req.user_count} ${req.user_count === 1 ? "user" : "users"}`}
                                            </span>
                                          )}
                                        </div>
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
                                            completePlantRequest(req.id, req.plant_name)
                                          }
                                          disabled={
                                            completingRequestId === req.id
                                          }
                                        >
                                          {completingRequestId === req.id
                                            ? "Completing..."
                                            : "Complete"}
                                        </Button>
                                        <Button
                                          variant="ghost"
                                          size="icon"
                                          className="h-8 w-8 rounded-full text-stone-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30"
                                          onClick={() => dismissPlantRequest(req.id)}
                                          disabled={completingRequestId === req.id}
                                          title="Delete request without notifying"
                                        >
                                          <X className="h-4 w-4" />
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
                                          Load More ({filteredPlantRequests.length} / {plantRequestsTotalCount})
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

                    {/* Events Tab */}
                    {activeTab === "events" && <AdminEventsPanel />}

                  {/* Advanced Tab */}
                  {activeTab === "admin_logs" && <AdminAdvancedPanel />}

                {/* Members Tab */}
                {activeTab === "members" && (
                  <div className="space-y-4" ref={membersContainerRef}>
                    <div className="flex justify-center">
                      <div className="inline-flex items-center gap-1 rounded-full border border-stone-200 dark:border-[#3e3e42] bg-white/80 dark:bg-[#1a1a1d]/80 px-1 py-1 backdrop-blur">
                        <Link
                          to="/admin/members"
                          className={`px-4 py-1.5 text-sm font-semibold rounded-full transition-colors ${membersView === "search" ? "bg-emerald-600 text-white shadow" : "text-stone-600 dark:text-stone-300 hover:text-black dark:hover:text-white"}`}
                        >
                          Search
                        </Link>
                        <Link
                          to="/admin/members/list"
                          className={`px-4 py-1.5 text-sm font-semibold rounded-full transition-colors ${membersView === "list" ? "bg-emerald-600 text-white shadow" : "text-stone-600 dark:text-stone-300 hover:text-black dark:hover:text-white"}`}
                        >
                          List
                        </Link>
                        <Link
                          to="/admin/members/reports"
                          className={`px-4 py-1.5 text-sm font-semibold rounded-full transition-colors ${membersView === "reports" ? "bg-emerald-600 text-white shadow" : "text-stone-600 dark:text-stone-300 hover:text-black dark:hover:text-white"}`}
                        >
                          Reports
                          {activeReportsCount > 0 && (
                            <span className={`ml-1.5 px-1.5 py-0.5 text-[10px] font-bold rounded-full ${membersView === "reports" ? "bg-white/25 text-white" : "bg-amber-500 text-white"}`}>
                              {activeReportsCount}
                            </span>
                          )}
                        </Link>
                      </div>
                    </div>
                    {membersView === "list" && (
                      <div className="flex justify-center">
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
                      </div>
                    )}

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
                                    {(s.last_seen_at || s.visits_7d != null) && (
                                      <div className="text-[11px] opacity-50 mt-0.5 flex items-center gap-1.5">
                                        {s.last_seen_at && (
                                          <span>Last seen: {formatLastVisit(s.last_seen_at)}</span>
                                        )}
                                        {s.last_seen_at && s.visits_7d != null && (
                                          <span>•</span>
                                        )}
                                        {s.visits_7d != null && (
                                          <span>7d: {formatCompactNumber(s.visits_7d)} visit{s.visits_7d !== 1 ? "s" : ""}</span>
                                        )}
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
                                      <div className="text-xs opacity-70 truncate select-all cursor-text">
                                        {memberData.user?.email || "-"}
                                        {memberData.user?.id ? (
                                          <span className="opacity-60 select-text">
                                            {" "}
                                            · id {memberData.user.id}
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
                                      {/* Onboarding status icons — own row */}
                                      {(memberData as any).onboarding && (() => {
                                        const ob = (memberData as any).onboarding;
                                        return (
                                          <div className="flex items-center gap-1.5 mt-1.5">
                                            <span title={ob.setupCompleted ? "Setup completed" : "Setup not completed"} className={cn("inline-flex items-center justify-center h-6 w-6 rounded-full text-xs cursor-default transition-colors", ob.setupCompleted ? "bg-emerald-100 dark:bg-emerald-900/40 text-emerald-600 dark:text-emerald-400" : "bg-stone-100 dark:bg-stone-800 text-stone-400 dark:text-stone-600")}>
                                              <Settings className="h-3.5 w-3.5" />
                                            </span>
                                            <span title={ob.emailVerified ? "Email verified" : "Email not verified"} className={cn("inline-flex items-center justify-center h-6 w-6 rounded-full text-xs cursor-default transition-colors", ob.emailVerified ? "bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400" : "bg-stone-100 dark:bg-stone-800 text-stone-400 dark:text-stone-600")}>
                                              <Mail className="h-3.5 w-3.5" />
                                            </span>
                                            <span title={ob.tutorialCompleted ? "Tutorial completed" : "Tutorial not completed"} className={cn("inline-flex items-center justify-center h-6 w-6 rounded-full text-xs cursor-default transition-colors", ob.tutorialCompleted ? "bg-purple-100 dark:bg-purple-900/40 text-purple-600 dark:text-purple-400" : "bg-stone-100 dark:bg-stone-800 text-stone-400 dark:text-stone-600")}>
                                              <GraduationCap className="h-3.5 w-3.5" />
                                            </span>
                                            <span title={ob.allActionsComplete ? `Profile actions: ${ob.actionsCompleted}/${ob.actionsTotal} completed` : `Profile actions: ${ob.actionsCompleted ?? 0}/${ob.actionsTotal ?? 5} completed`} className={cn("inline-flex items-center justify-center h-6 w-6 rounded-full text-xs cursor-default transition-colors", ob.allActionsComplete ? "bg-amber-100 dark:bg-amber-900/40 text-amber-600 dark:text-amber-400" : "bg-stone-100 dark:bg-stone-800 text-stone-400 dark:text-stone-600")}>
                                              <ListChecks className="h-3.5 w-3.5" />
                                            </span>
                                          </div>
                                        );
                                      })()}
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
                                <div className="flex items-center gap-6">
                                  <div className="flex-1 min-w-0">
                                    <div className="text-xs uppercase tracking-wide opacity-50 mb-1">Last seen</div>
                                    <div className="text-lg font-semibold tabular-nums">
                                      {formatLastVisit(memberData.lastOnlineAt)}
                                    </div>
                                  </div>
                                  <div className="w-px h-10 bg-stone-300 dark:bg-stone-600" />
                                  <div className="flex-1 min-w-0">
                                    <div className="text-xs uppercase tracking-wide opacity-50 mb-1">Visits (7d)</div>
                                    <div className="text-lg font-semibold tabular-nums">
                                      {formatCompactNumber(memberData.visits7d ?? 0)}
                                    </div>
                                  </div>
                                </div>
                              </CardContent>
                            </Card>

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
                                      <div className="text-[11px] opacity-60 mt-0.5 flex items-center gap-1.5">
                                        {u.last_seen_at && (
                                          <span>Last seen: {formatLastVisit(u.last_seen_at)}</span>
                                        )}
                                        {u.last_seen_at && u.visits_7d != null && (
                                          <span>•</span>
                                        )}
                                        <span>7d: {formatCompactNumber(u.visits_7d)} visit{u.visits_7d !== 1 ? "s" : ""}</span>
                                      </div>
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
                                        <span className="hidden sm:inline">•</span>
                                        <span>
                                          Last seen: {formatLastVisit(member.lastVisitAt)}
                                        </span>
                                        <span className="hidden sm:inline">•</span>
                                        <span className="tabular-nums">
                                          7d: {formatCompactNumber(member.visits7d)} visit{member.visits7d !== 1 ? "s" : ""}
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

                </div>
            </section>
          </div>
        </main>
      </div>
    </div>

    {/* Add FROM Plant – SearchItem (hidden trigger, opened programmatically) */}
    <SearchItem
      value={null}
      onSelect={(option: SearchItemOption) => {
        handleSelectPlantForPrefill(option.id, option.label);
      }}
      onSearch={searchPlantsForAddFrom}
      title="Add Plant FROM Existing"
      description="Search for an existing plant to duplicate. All data including translations will be copied to a new plant."
      searchPlaceholder="Search plants by name..."
      emptyMessage="No plants found."
      placeholder="Add FROM..."
      disabled={addFromDuplicating}
      className="hidden"
      renderItem={(option, isSelected) => {
        let variety: string | null = null;
        let scientificName: string | null = null;
        let status: string | null = null;
        try {
          const parsed = JSON.parse(option.meta || '{}');
          variety = parsed.variety || null;
          scientificName = parsed.scientificName || null;
          status = parsed.status || null;
        } catch {}
        return (
          <div className="flex flex-col w-full h-full">
            <div className="aspect-[4/3] w-full overflow-hidden rounded-t-xl sm:rounded-t-2xl bg-stone-100 dark:bg-stone-800">
              {option.description ? (
                <img src={option.description} alt="" className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-stone-400">
                  <Leaf className="h-8 w-8" />
                </div>
              )}
            </div>
            <div className="flex-1 flex flex-col justify-center px-3 py-2 min-w-0">
              <p className={`text-sm font-medium truncate ${isSelected ? "text-emerald-700 dark:text-emerald-300" : "text-stone-900 dark:text-white"}`}>
                {option.label}
              </p>
              {variety && (
                <p className="text-xs font-extrabold bg-gradient-to-r from-violet-500 to-fuchsia-500 bg-clip-text text-transparent tracking-tight truncate">
                  &apos;{variety}&apos;
                </p>
              )}
              {scientificName && (
                <p className="text-xs italic text-stone-500 dark:text-stone-400 truncate">{scientificName}</p>
              )}
              {status && (
                <span className="mt-1 self-start px-1.5 py-0.5 rounded-md bg-stone-100 dark:bg-[#2a2a2d] text-[10px] text-stone-500 dark:text-stone-400">
                  {status}
                </span>
              )}
            </div>
          </div>
        );
      }}
      ref={(el) => {
        // Store ref so we can programmatically click to open the dialog
        if (el) (el as HTMLElement).setAttribute("data-add-from-trigger", "true");
      }}
    />

    {/* Add FROM – Duplication Status Dialog */}
    <Dialog open={addFromDuplicating || !!addFromDuplicateSuccess || !!addFromDuplicateError} onOpenChange={(open) => {
      if (!open && !addFromDuplicating) {
        setAddFromDuplicateError(null);
        setAddFromDuplicateSuccess(null);
      }
    }}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Add Plant FROM Existing</DialogTitle>
          <DialogDescription>
            {addFromDuplicateSuccess ? "Duplication complete" : addFromDuplicateError ? "Duplication failed" : "Duplicating plant..."}
          </DialogDescription>
        </DialogHeader>

        {addFromDuplicateSuccess ? (
          <div className="space-y-4">
            <div className="flex items-start gap-3 p-4 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800">
              <Check className="h-5 w-5 text-emerald-600 dark:text-emerald-400 flex-shrink-0 mt-0.5" />
              <div className="space-y-1">
                <div className="font-medium text-emerald-900 dark:text-emerald-100">
                  Plant duplicated successfully!
                </div>
                <div className="text-sm text-emerald-700 dark:text-emerald-300">
                  Created &ldquo;<span className="font-medium">{addFromDuplicateSuccess.name}</span>&rdquo;
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
                }}
              >
                Close
              </Button>
              <Button
                className="flex-1 rounded-xl"
                onClick={() => {
                  const successId = addFromDuplicateSuccess.id;
                  const originalName = addFromDuplicateSuccess.originalName;
                  setAddFromDuplicateSuccess(null);
                  navigate(`/create/${successId}?duplicatedFrom=${encodeURIComponent(originalName)}`);
                }}
              >
                Edit Plant
                <ArrowUpRight className="h-4 w-4 ml-1" />
              </Button>
            </div>
          </div>
        ) : addFromDuplicateError ? (
          <div className="space-y-4">
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
            <DialogFooter>
              <Button variant="outline" className="rounded-xl" onClick={() => setAddFromDuplicateError(null)}>
                Close
              </Button>
            </DialogFooter>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-8 space-y-3">
            <RefreshCw className="h-8 w-8 text-emerald-600 dark:text-emerald-400 animate-spin" />
            <div className="text-sm font-medium">Duplicating plant...</div>
            <div className="text-xs opacity-60">Copying all data and translations</div>
          </div>
        )}
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
                    {plant.localizedName || plant.name}
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
          <Select
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
          </Select>
          <Select
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
          </Select>
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
          <Select
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
          </Select>
          <Select
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
          </Select>
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
