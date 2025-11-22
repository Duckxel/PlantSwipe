import React from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { LazyCharts, ChartSuspense } from "@/components/admin/LazyChart";
import { AdminUploadMediaPanel } from "@/components/admin/AdminUploadMediaPanel";
import { AdminNotificationsPanel } from "@/components/admin/AdminNotificationsPanel";
import { useTheme } from "@/context/ThemeContext";
import { useAuth } from "@/context/AuthContext";
import { getAccentOption } from "@/lib/accent";
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
  Gavel,
  Search,
  ChevronDown,
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
  FileText,
  ScrollText,
    CloudUpload,
    Check,
  BellRing,
} from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import {
  loadPersistedBroadcast,
  savePersistedBroadcast,
  type BroadcastRecord,
} from "@/lib/broadcastStorage";
import { CreatePlantPage } from "@/pages/CreatePlantPage";
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

type AdminTab =
  | "overview"
  | "members"
  | "requests"
  | "upload"
  | "notifications"
  | "admin_logs";

type ListedMember = {
  id: string;
  email: string | null;
  displayName: string | null;
  createdAt: string | null;
  isAdmin: boolean;
  rpm5m: number | null;
};

type MemberListSort = "newest" | "oldest" | "rpm";

const MEMBER_LIST_PAGE_SIZE = 20;

type RequestViewMode = "requests" | "plants";
type NormalizedPlantStatus =
  | "in progres"
  | "review"
  | "rework"
  | "approved"
  | "other";
const REQUEST_VIEW_TABS: Array<{ key: RequestViewMode; label: string }> = [
  { key: "requests", label: "Request" },
  { key: "plants", label: "PLANTS" },
];

const PLANT_STATUS_LABELS: Record<NormalizedPlantStatus, string> = {
  "in progres": "In Progress",
  review: "Review",
  rework: "Rework",
  approved: "Approved",
  other: "Other",
};

const PLANT_STATUS_COLORS: Record<NormalizedPlantStatus, string> = {
  "in progres": "#ea580c",
  review: "#f59e0b",
  rework: "#dc2626",
  approved: "#059669",
  other: "#475569",
};

const PLANT_STATUS_BADGE_CLASSES: Record<NormalizedPlantStatus, string> = {
  "in progres":
    "bg-orange-100 text-orange-800 dark:bg-orange-500/30 dark:text-orange-100",
  review:
    "bg-amber-100 text-amber-800 dark:bg-amber-500/30 dark:text-amber-100",
  rework:
    "bg-rose-100 text-rose-800 dark:bg-rose-500/30 dark:text-rose-100",
  approved:
    "bg-emerald-100 text-emerald-800 dark:bg-emerald-500/30 dark:text-emerald-100",
  other:
    "bg-slate-200 text-slate-800 dark:bg-slate-600/40 dark:text-slate-100",
};

const PLANT_STATUS_KEYS: NormalizedPlantStatus[] = [
  "in progres",
  "review",
  "rework",
  "approved",
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
    review: 0,
    rework: 1,
    "in progres": 2,
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
  "in progres",
  "review",
  "rework",
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
  status: NormalizedPlantStatus;
  promotionMonth: PromotionMonthSlug | null;
  primaryImage: string | null;
  updatedAt: number | null;
};

const normalizePlantStatus = (
  status?: string | null,
): NormalizedPlantStatus => {
  if (!status) return "other";
  const normalized = status.toLowerCase();
  if (normalized === "in progres" || normalized === "in progress") {
    return "in progres";
  }
  if (normalized === "review") return "review";
  if (normalized === "rework") return "rework";
  if (normalized === "approved") return "approved";
  return "other";
};

const toPromotionMonthSlug = (
  value?: string | null,
): PromotionMonthSlug | null => {
  if (!value) return null;
  const normalized = value.toLowerCase() as PromotionMonthSlug;
  return (PROMOTION_MONTH_SLUGS as readonly string[]).includes(normalized)
    ? normalized
    : null;
};

export const AdminPage: React.FC = () => {
  const navigate = useNavigate();
  const { effectiveTheme } = useTheme();
  const { user, profile } = useAuth();
  const isDark = effectiveTheme === "dark";

  // Get user's accent color (more subtle version)
  const accentColor = React.useMemo(() => {
    const accentKey = (profile as any)?.accent_key || "emerald";
    const accentOption = getAccentOption(accentKey as any);
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
    const accentKey = (profile as any)?.accent_key || "emerald";
    const accentOption = getAccentOption(accentKey as any);
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
      if ((Intl as any)?.DisplayNames) {
        try {
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
          } catch (fetchError: any) {
            clearTimeout(timeoutId);
            throw fetchError;
          }
        } catch (error: any) {
          lastError = error;

          // Network error or timeout - retry
          if (
            attempt < maxRetries &&
            (error.name === "AbortError" ||
              error.name === "TypeError" ||
              error.message?.includes("fetch") ||
              !error.message?.includes("4"))
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
  const safeJson = React.useCallback(async (resp: Response): Promise<any> => {
    try {
      const contentType = (
        resp.headers.get("content-type") || ""
      ).toLowerCase();
      const text = await resp.text().catch(() => "");
      if (
        contentType.includes("application/json") ||
        /^[\s\n]*[\[{]/.test(text)
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
      const adminToken = (globalThis as any)?.__ENV__?.VITE_ADMIN_STATIC_TOKEN;
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
        if (body?.stdoutTail) {
          const lines = String(body.stdoutTail).split("\n").filter(Boolean);
          if (lines.length) {
            appendConsole("[sync] SQL stdout (tail):");
            lines
              .slice(-25)
              .forEach((line) => appendConsole(`[sync]   ${line}`));
          }
        }
        if (body?.stderr) {
          const lines = String(body.stderr).split("\n").filter(Boolean);
          if (lines.length) {
            appendConsole("[sync] SQL stderr:");
            lines
              .slice(-25)
              .forEach((line) => appendConsole(`[sync] ✗ ${line}`));
          }
        }
        if (body?.detail) {
          appendConsole(`[sync] Detail: ${String(body.detail)}`);
        }
        const parts: string[] = [];
        if (body?.error) parts.push(String(body.error));
        if (body?.detail) parts.push(String(body.detail));
        if (body?.stderr) parts.push(String(body.stderr));
        const msg =
          parts.length > 0
            ? parts.join(" | ")
            : `Request failed (${resp.status})`;
        throw new Error(msg);
      }
      appendConsole("[sync] Schema synchronized successfully");

      // Show SQL execution output if available
      if (body?.stdoutTail) {
        appendConsole("[sync] SQL execution output:");
        const outputLines = String(body.stdoutTail)
          .split("\n")
          .filter((l) => l.trim());
        let hasErrors = false;
        outputLines.forEach((line) => {
          // Check for error patterns in SQL output
          const isError =
            /ERROR:|error:|failed|FAILED/i.test(line) && !/⚠/.test(line);
          if (isError) {
            hasErrors = true;
            appendConsole(`[sync] ✗ ERROR: ${line}`);
          } else if (/WARNING:|NOTICE:/i.test(line)) {
            appendConsole(`[sync] ⚠ ${line}`);
          } else {
            // Only show non-error lines if they're relevant (CREATE, ALTER, etc.)
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
          .filter((l) => l.trim());
        if (stderrLines.length > 0) {
          appendConsole("[sync] SQL execution stderr output:");
          stderrLines.forEach((line) => {
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
      const adminToken = (globalThis as any)?.__ENV__?.VITE_ADMIN_STATIC_TOKEN

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
        const adminToken = (globalThis as any)?.__ENV__
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
        const adminToken = (globalThis as any)?.__ENV__
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
  };
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

  // Count unique requested plants
  const uniqueRequestedPlantsCount = React.useMemo(() => {
    const uniqueNames = new Set(
      plantRequests.map((req) => req.plant_name_normalized).filter(Boolean),
    );
    return uniqueNames.size;
  }, [plantRequests]);
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
  const [createPlantDialogOpen, setCreatePlantDialogOpen] =
    React.useState<boolean>(false);
  const [createPlantRequestId, setCreatePlantRequestId] = React.useState<
    string | null
  >(null);
  const [createPlantName, setCreatePlantName] = React.useState<string>("");
  const [requestViewMode, setRequestViewMode] =
    React.useState<RequestViewMode>("requests");
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
  const [visiblePlantStatuses, setVisiblePlantStatuses] = React.useState<
    NormalizedPlantStatus[]
  >(DEFAULT_VISIBLE_PLANT_STATUSES);
  const [plantSearchQuery, setPlantSearchQuery] =
    React.useState<string>("");

  const loadPlantRequests = React.useCallback(
    async ({ initial = false }: { initial?: boolean } = {}) => {
      setPlantRequestsError(null);
      if (initial) {
        setPlantRequestsLoading(true);
      } else {
        setPlantRequestsRefreshing(true);
      }
      try {
        const { data, error } = await supabase
          .from("requested_plants")
          .select(
            "id, plant_name, plant_name_normalized, request_count, created_at, updated_at, requested_by",
          )
          .is("completed_at", null)
          .order("request_count", { ascending: false })
          .order("updated_at", { ascending: false });

        if (error) throw new Error(error.message);

        const rows: PlantRequestRow[] = (data ?? [])
          .map((row: any) => {
            const id = row?.id ? String(row.id) : null;
            if (!id) return null;
            const requestCountRaw = row?.request_count;
            const requestCount =
              typeof requestCountRaw === "number"
                ? requestCountRaw
                : Number(requestCountRaw ?? 0);
            return {
              id,
              plant_name: row?.plant_name
                ? String(row.plant_name)
                : row?.plant_name_normalized
                  ? String(row.plant_name_normalized)
                  : "Unknown request",
              plant_name_normalized: row?.plant_name_normalized
                ? String(row.plant_name_normalized)
                : row?.plant_name
                  ? String(row.plant_name).toLowerCase().trim()
                  : "",
              request_count: Number.isFinite(requestCount) ? requestCount : 0,
              created_at: row?.created_at ?? null,
              updated_at: row?.updated_at ?? null,
              requested_by: row?.requested_by ? String(row.requested_by) : null,
              requester_name: null as string | null,
              requester_email: null as string | null,
            };
          })
          .filter((row): row is PlantRequestRow => row !== null);

        setPlantRequests(rows);
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
    [supabase],
  );

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
          ...new Set(requestUsersData.map((row: any) => String(row.user_id))),
        ];

        // Fetch profiles for these user IDs
        const { data: profilesData, error: profilesError } = await supabase
          .from("profiles")
          .select("id, display_name")
          .in("id", userIds);

        if (profilesError) throw new Error(profilesError.message);

        // Fetch emails for each user using RPC function
        const usersWithEmails = await Promise.all(
          (profilesData ?? []).map(async (profile: any) => {
            let email: string | null = null;
            try {
              const { data: emailData } = await supabase.rpc(
                "get_friend_email",
                { _friend_id: profile.id },
              );
              email = emailData || null;
            } catch (err) {
              console.warn("Failed to fetch email for user:", profile.id, err);
            }
            return {
              id: String(profile.id),
              display_name: profile?.display_name
                ? String(profile.display_name)
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
    [supabase],
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
    [completingRequestId, loadPlantRequests, supabase, user?.id],
  );

  const handleOpenCreatePlantDialog = React.useCallback(
    (req: PlantRequestRow) => {
      setCreatePlantRequestId(req.id);
      setCreatePlantName(req.plant_name);
      setCreatePlantDialogOpen(true);
    },
    [],
  );
  const handleOpenPlantEditor = React.useCallback(
    (plantId: string) => {
      if (!plantId) return;
      navigate(`/create/${plantId}`);
    },
    [navigate],
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

  const loadPlantDashboard = React.useCallback(async () => {
    setPlantDashboardError(null);
    setPlantDashboardLoading(true);
    try {
      const { data, error } = await supabase
        .from("plants")
        .select(
          `
            id,
            name,
            status,
            promotion_month,
            updated_time,
            plant_images (
              link,
              use
            )
          `,
        )
        .order("name", { ascending: true });

      if (error) throw new Error(error.message);

      const rows: PlantDashboardRow[] = (data ?? [])
        .map((row: any) => {
          if (!row?.id) return null;
          const images = Array.isArray(row?.plant_images)
            ? row.plant_images
            : [];
          const primaryImage =
            images.find((img: any) => img?.use === "primary") ??
            images.find((img: any) => img?.use === "discovery") ??
            images[0];

            return {
              id: String(row.id),
              name: row?.name ? String(row.name) : "Unnamed plant",
              status: normalizePlantStatus(row?.status),
              promotionMonth: toPromotionMonthSlug(row?.promotion_month),
              primaryImage: primaryImage?.link
                ? String(primaryImage.link)
                : null,
              updatedAt: (() => {
                const timestamp =
                  row?.updated_time ??
                  row?.updated_at ??
                  row?.updatedTime ??
                  null;
                if (!timestamp) return null;
                const parsed = Date.parse(timestamp);
                return Number.isFinite(parsed) ? parsed : null;
              })(),
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
  }, [supabase]);

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

  const totalPlantRequestsCount = React.useMemo(
    () =>
      plantRequests.reduce(
        (sum, req) => sum + (Number(req.request_count) || 0),
        0,
      ),
    [plantRequests],
  );

  const requestsVsApproved = React.useMemo(() => {
    const ratio =
      approvedPlantsCount > 0
        ? totalPlantRequestsCount / approvedPlantsCount
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
  }, [approvedPlantsCount, totalPlantRequestsCount]);

  const filteredPlantRows = React.useMemo(() => {
    const term = plantSearchQuery.trim().toLowerCase();
    const statuses = new Set(visiblePlantStatuses);
    return plantDashboardRows
      .filter((plant) => {
        const matchesStatus =
          statuses.size === 0 ? false : statuses.has(plant.status);
        if (!matchesStatus) return false;
        const matchesSearch = term
          ? plant.name.toLowerCase().includes(term)
          : true;
        return matchesSearch;
      })
      .sort((a, b) => {
        const statusDiff =
          getStatusSortPriority(a.status) - getStatusSortPriority(b.status);
        if (statusDiff !== 0) return statusDiff;
        return a.name.localeCompare(b.name);
      });
  }, [plantDashboardRows, visiblePlantStatuses, plantSearchQuery]);

  const plantViewIsPlants = requestViewMode === "plants";
  const plantTableLoading =
    plantDashboardLoading && !plantDashboardInitialized;
  const visiblePlantStatusesSet = React.useMemo(
    () => new Set(visiblePlantStatuses),
    [visiblePlantStatuses],
  );
  const noPlantStatusesSelected = visiblePlantStatusesSet.size === 0;

  const handlePlantCreated = React.useCallback(async () => {
    // Optionally complete the request after plant is created
    if (createPlantRequestId) {
      try {
        await completePlantRequest(createPlantRequestId);
      } catch (err) {
        console.error("Failed to complete request after creating plant:", err);
      }
    }
    setCreatePlantDialogOpen(false);
    setCreatePlantRequestId(null);
    setCreatePlantName("");
    // Refresh the requests list
    await loadPlantRequests({ initial: false });
  }, [createPlantRequestId, completePlantRequest, loadPlantRequests]);

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
      okCheck?: (body: any) => boolean,
    ): Promise<ProbeResult> => {
      const started = Date.now();
      try {
        const headers: Record<string, string> = { Accept: "application/json" };
        try {
          const token = (await supabase.auth.getSession()).data.session
            ?.access_token;
          if (token) headers["Authorization"] = `Bearer ${token}`;
          const staticToken = (globalThis as any)?.__ENV__
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
        } catch (fetchError: any) {
          clearTimeout(timeoutId);
          if (fetchError.name === "AbortError") {
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
        };
        try {
          const session = (await supabase.auth.getSession()).data.session;
          const token = session?.access_token;
          if (token) headersNode["Authorization"] = `Bearer ${token}`;
        } catch {}
        const respNode = await fetchWithRetry("/api/admin/branches", {
          headers: headersNode,
          credentials: "same-origin",
        }).catch(() => null);
        let data = await safeJson(respNode || new Response());
        // Guard against accidental inclusion of non-branch items
        if (Array.isArray(data?.branches)) {
          data.branches = data.branches.filter(
            (b: string) => b && b !== "origin" && b !== "HEAD",
          );
        }
        let ok = respNode?.ok && Array.isArray(data?.branches);
        if (!ok) {
          const adminHeaders: Record<string, string> = {
            Accept: "application/json",
          };
          try {
            const adminToken = (globalThis as any)?.__ENV__
              ?.VITE_ADMIN_STATIC_TOKEN;
            if (adminToken) adminHeaders["X-Admin-Token"] = String(adminToken);
          } catch {}
          const respAdmin = await fetchWithRetry("/admin/branches", {
            headers: adminHeaders,
            credentials: "same-origin",
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
            ((globalThis as any)?.__ENV__?.VITE_ADMIN_STATIC_TOKEN as
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
            const adminToken = (globalThis as any)?.__ENV__
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
            const adminToken = (globalThis as any)?.__ENV__
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
          const adminToken = (globalThis as any)?.__ENV__
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
            ? data.ips.map((s: any) => String(s)).filter(Boolean)
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
            ? data.series7d.map((d: any) => ({
                date: String(d.date),
                uniqueVisitors: Number(
                  d.uniqueVisitors ?? d.unique_visitors ?? 0,
                ),
              }))
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
                          .map((x: any) => String(x || ""))
                          .filter(Boolean)
                      : undefined,
                    items: Array.isArray(sbd.otherCountries.items)
                      ? sbd.otherCountries.items
                          .map((it: any) => ({
                            country: String(it?.country || ""),
                            visits: Number(it?.visits || 0),
                          }))
                          .filter((it: { country: string }) => !!it.country)
                      : undefined,
                  }
                : null;
            const totalCountryVisits =
              tc.reduce((a: number, b: any) => a + (b.visits || 0), 0) +
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
              tr.reduce((a: number, b: any) => a + (b.visits || 0), 0) +
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
  const navItems: Array<{
    key: AdminTab;
    label: string;
    Icon: React.ComponentType<{ className?: string }>;
  }> = [
    { key: "overview", label: "Overview", Icon: LayoutDashboard },
    { key: "members", label: "Members", Icon: Users },
    { key: "requests", label: "Requests", Icon: FileText },
    { key: "upload", label: "Upload and Media", Icon: CloudUpload },
    { key: "notifications", label: "Notifications", Icon: BellRing },
    { key: "admin_logs", label: "Admin Logs", Icon: ScrollText },
  ];

  const [activeTab, setActiveTab] = React.useState<AdminTab>("overview");
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
    if (activeTab !== "requests" || plantRequestsInitialized) return;
    loadPlantRequests({ initial: true });
  }, [activeTab, plantRequestsInitialized, loadPlantRequests]);

  React.useEffect(() => {
    if (
      activeTab !== "requests" ||
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
  const [membersView, setMembersView] =
    React.useState<"search" | "list">("search");
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
  const [lookupEmail, setLookupEmail] = React.useState("");
  const [memberLoading, setMemberLoading] = React.useState(false);
  const [memberError, setMemberError] = React.useState<string | null>(null);
  const [memberData, setMemberData] = React.useState<{
    user: { id: string; email: string; created_at?: string } | null;
    profile: any;
    ips: string[];
    lastOnlineAt?: string | null;
    lastIp?: string | null;
    visitsCount?: number;
    uniqueIpsCount?: number;
    plantsTotal?: number;
    isBannedEmail?: boolean;
    bannedReason?: string | null;
    bannedAt?: string | null;
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
  } | null>(null);
  const [banReason, setBanReason] = React.useState("");
  const [banSubmitting, setBanSubmitting] = React.useState(false);
  const [banOpen, setBanOpen] = React.useState(false);
  const [promoteOpen, setPromoteOpen] = React.useState(false);
  const [promoteSubmitting, setPromoteSubmitting] = React.useState(false);
  const [demoteOpen, setDemoteOpen] = React.useState(false);
  const [demoteSubmitting, setDemoteSubmitting] = React.useState(false);

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
          const adminToken = (globalThis as any)?.__ENV__
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
              .map((d: any) => {
                // API returns dates in YYYY-MM-DD format from toISOString().slice(0,10)
                let dateStr = String(d.date || "");
                // Extract date part if it's an ISO string (handles edge cases)
                if (dateStr.includes("T")) {
                  dateStr = dateStr.split("T")[0];
                }
                // If date is already in YYYY-MM-DD format, use it directly
                if (dateStr.match(/^\d{4}-\d{2}-\d{2}$/)) {
                  return { date: dateStr, visits: Number(d.visits || 0) };
                }
                // Try to normalize if format is different
                if (dateStr) {
                  try {
                    const dateObj = new Date(dateStr + "T00:00:00Z");
                    if (!isNaN(dateObj.getTime())) {
                      dateStr = dateObj.toISOString().split("T")[0];
                      if (dateStr.match(/^\d{4}-\d{2}-\d{2}$/)) {
                        return { date: dateStr, visits: Number(d.visits || 0) };
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
    async (opts?: { reset?: boolean; sort?: MemberListSort }) => {
      if (memberListLoading) return;
      const reset = !!opts?.reset;
      const limit = MEMBER_LIST_PAGE_SIZE;
      const offset = reset ? 0 : memberListOffset;
      const sortParam: MemberListSort = opts?.sort ?? memberListSort;
      setMemberListLoading(true);
      setMemberListError(null);
      try {
        const session = (await supabase.auth.getSession()).data.session;
        const token = session?.access_token;
        const headers: Record<string, string> = { Accept: "application/json" };
        if (token) headers["Authorization"] = `Bearer ${token}`;
        try {
          const adminToken = (globalThis as any)?.__ENV__
            ?.VITE_ADMIN_STATIC_TOKEN;
          if (adminToken) headers["X-Admin-Token"] = String(adminToken);
        } catch {}
        const resp = await fetch(
          `/api/admin/member-list?limit=${limit}&offset=${offset}&sort=${encodeURIComponent(sortParam)}`,
          { headers, credentials: "same-origin" },
        );
        const data = await safeJson(resp);
        if (!resp.ok) throw new Error(data?.error || `HTTP ? ${resp.status}`);
        const rawMembers = Array.isArray(data?.members) ? data.members : [];
        const normalized: ListedMember[] = rawMembers
          .map((m: any) => {
            const id = m?.id ? String(m.id) : "";
            if (!id) return null;
            const displayName =
              typeof m?.display_name === "string"
                ? m.display_name
                : typeof m?.displayName === "string"
                  ? m.displayName
                  : null;
            const email = typeof m?.email === "string" ? m.email : null;
            const createdAt =
              typeof m?.created_at === "string"
                ? m.created_at
                : typeof m?.createdAt === "string"
                  ? m.createdAt
                  : null;
            const isAdmin =
              m?.is_admin === true || m?.isAdmin === true ? true : false;
            return {
              id,
              email,
              displayName,
              createdAt,
              isAdmin,
              rpm5m:
                typeof m?.rpm5m === "number"
                  ? m.rpm5m
                  : typeof m?.rpm5m === "string" && m.rpm5m.length > 0
                    ? Number(m.rpm5m)
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
    [memberListLoading, memberListOffset, memberListSort, safeJson],
  );

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
          const adminToken = (globalThis as any)?.__ENV__
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
            ? data.adminNotes.map((n: any) => ({
                id: String(n.id),
                admin_id: n?.admin_id || null,
                admin_name: n?.admin_name || null,
                message: String(n?.message || ""),
                created_at: n?.created_at || null,
              }))
            : [],
        });
        // Log lookup success (UI)
        try {
          const headers2: Record<string, string> = {
            Accept: "application/json",
            "Content-Type": "application/json",
          };
          if (token) headers2["Authorization"] = `Bearer ${token}`;
          try {
            const adminToken = (globalThis as any)?.__ENV__
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
            const adminToken = (globalThis as any)?.__ENV__
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
          const adminToken = (globalThis as any)?.__ENV__
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
          ? data.users.map((u: any) => ({
              id: String(u.id),
              email: u?.email ?? null,
              display_name: u?.display_name ?? null,
              last_seen_at: u?.last_seen_at ?? null,
            }))
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
            const adminToken = (globalThis as any)?.__ENV__
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
            const adminToken = (globalThis as any)?.__ENV__
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
      setActiveTab("members");
      setMembersView("search");
      setIpLookup(next);
      setTimeout(() => {
        try {
          memberIpInputRef.current?.focus();
        } catch {}
        // Trigger the same search flow as pressing Enter in the input
        lookupByIp(next);
      }, 0);
    },
    [lookupByIp],
  );

  const handleMemberCardClick = React.useCallback(
    (entry: ListedMember) => {
      const value =
        entry.displayName?.trim() ||
        entry.email?.trim() ||
        "";
      if (!value) return;
      setMembersView("search");
      setTimeout(() => {
        lookupMember(value);
      }, 0);
    },
    [lookupMember],
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

  // Auto-load visits series when a member is selected
  React.useEffect(() => {
    const uid = memberData?.user?.id;
    if (uid) {
      loadMemberVisitsSeries(uid, { initial: true });
    } else {
      setMemberVisitsSeries([]);
      setMemberVisitsTotal30d(0);
      setMemberVisitsUpdatedAt(null);
      setMemberVisitsWarning(null);
    }
  }, [memberData?.user?.id, loadMemberVisitsSeries]);

  React.useEffect(() => {
    if (activeTab !== "members") return;
    if (membersView !== "list") return;
    if (memberListInitialized || memberListLoading) return;
    loadMemberList({ reset: true });
  }, [
    activeTab,
    membersView,
    memberListInitialized,
    memberListLoading,
    loadMemberList,
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
        const adminToken = (globalThis as any)?.__ENV__
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
        const adminToken = (globalThis as any)?.__ENV__
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
        const adminToken = (globalThis as any)?.__ENV__
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

  // Debounced email/username suggestions fetch
  React.useEffect(() => {
    let cancelled = false;
    let timer: any = null;
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
          const adminToken = (globalThis as any)?.__ENV__
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
            data.suggestions.map((s: any) => ({
              id: String(s.id),
              email: s?.email ? String(s.email) : null,
              display_name: s?.display_name ? String(s.display_name) : null,
            })),
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
    <div className="px-4 py-6 md:px-8">
      <div className="max-w-6xl mx-auto space-y-4 md:space-y-6">
        {/* Mobile Navigation */}
        <div className={`md:hidden ${mobileNavPanelClass}`}>
          <div className="p-4">
            <div className="flex items-center gap-2 mb-3">
              <ShieldCheck className="h-5 w-5" style={{ color: accentColor }} />
              <div className="text-sm font-semibold">Admin Panel</div>
            </div>
            <div className="grid grid-cols-2 gap-2">
                {navItems.map(({ key, label, Icon }) => {
                  const isActive = activeTab === key;
                  return (
                    <button
                      key={key}
                      onClick={() => setActiveTab(key)}
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
                      {key === "requests" && uniqueRequestedPlantsCount > 0 && (
                        <span className="px-1.5 py-0.5 text-[10px] font-semibold rounded-full bg-stone-200 dark:bg-stone-700 text-stone-700 dark:text-stone-200">
                          {uniqueRequestedPlantsCount}
                        </span>
                      )}
                    </button>
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
                        <div className="text-lg font-semibold">Admin Panel</div>
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
                  {navItems.map(({ key, label, Icon }) => {
                    const isActive = activeTab === key;
                    return (
                      <button
                        key={key}
                        onClick={() => setActiveTab(key)}
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
                        {key === "requests" && uniqueRequestedPlantsCount > 0 && (
                          <span
                            className={`${
                              sidebarCollapsed ? "text-[10px]" : "ml-auto text-xs"
                            } font-semibold rounded-full bg-stone-200 dark:bg-stone-800 text-stone-700 dark:text-stone-100 px-2 py-0.5`}
                          >
                            {uniqueRequestedPlantsCount}
                          </span>
                        )}
                      </button>
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
                    <div className="pt-2">
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 mb-4">
                        <Card className="rounded-2xl">
                          <CardContent className="p-4 space-y-2">
                            <div className="flex items-center justify-between gap-2">
                              <div className="min-w-0">
                                <div className="text-sm opacity-60">
                                  Currently online
                                </div>
                                <div className="text-xs opacity-60">
                                  {onlineUpdatedAt
                                    ? `Updated ? ${formatTimeAgo(onlineUpdatedAt)}`
                                    : "Updated -"}
                                </div>
                              </div>
                              <Button
                                variant="outline"
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
                                className="h-8 w-8 rounded-xl border bg-white text-black hover:bg-stone-50"
                              >
                                <RefreshCw
                                  className={`h-4 w-4 ? ${onlineLoading || onlineRefreshing || ipsLoading || ipsRefreshing ? "animate-spin" : ""}`}
                                />
                              </Button>
                            </div>
                            <div className="text-2xl font-semibold tabular-nums mt-1">
                              {onlineLoading ? "-" : onlineUsers}
                            </div>
                            {/* Collapsible Connected IPs under Currently online */}
                            <div className="mt-3">
                              <div className="flex items-center justify-between">
                                <button
                                  type="button"
                                  className="flex items-center gap-2 text-sm font-medium"
                                  onClick={() => setIpsOpen((o) => !o)}
                                  aria-expanded={ipsOpen}
                                  aria-controls="connected-ips"
                                >
                                  <ChevronDown
                                    className={`h-4 w-4 transition-transform ? ${ipsOpen ? "rotate-180" : ""}`}
                                  />
                                  IPs
                                </button>
                                <div />
                              </div>
                              {ipsOpen && (
                                <div className="mt-2" id="connected-ips">
                                  <div className="rounded-xl border bg-white dark:bg-[#2d2d30] dark:border-[#3e3e42] p-3 max-h-48 overflow-auto">
                                    {ipsLoading ? (
                                      <div className="text-sm opacity-60">
                                        Loading...
                                      </div>
                                    ) : ips.length === 0 ? (
                                      <div className="text-sm opacity-60">
                                        No IPs.
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
                                            className="rounded-full px-2 py-1 text-xs cursor-pointer hover:bg-stone-50 dark:hover:bg-[#3e3e42] focus:outline-none focus:ring-2 focus:ring-ring"
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
                          </CardContent>
                        </Card>
                        <Card className="rounded-2xl">
                          <CardContent className="p-4">
                            <div className="flex items-center justify-between gap-2">
                              <div className="min-w-0">
                                <div className="text-sm opacity-60">
                                  Registered accounts
                                </div>
                                <div className="text-xs opacity-60">
                                  {registeredUpdatedAt
                                    ? `Updated ? ${formatTimeAgo(registeredUpdatedAt)}`
                                    : "Updated -"}
                                </div>
                              </div>
                              <Button
                                variant="outline"
                                size="icon"
                                aria-label="Refresh registered accounts"
                                onClick={() =>
                                  loadRegisteredCount({ initial: false })
                                }
                                disabled={
                                  registeredLoading || registeredRefreshing
                                }
                                className="h-8 w-8 rounded-xl border bg-white text-black hover:bg-stone-50"
                              >
                                <RefreshCw
                                  className={`h-4 w-4 ? ${registeredLoading || registeredRefreshing ? "animate-spin" : ""}`}
                                />
                              </Button>
                            </div>
                            <div className="text-2xl font-semibold tabular-nums mt-1">
                              {registeredLoading
                                ? "-"
                                : registeredUpdatedAt !== null
                                  ? (registeredCount ?? "-")
                                  : "-"}
                            </div>
                          </CardContent>
                        </Card>
                        <Card className="rounded-2xl">
                          <CardContent className="p-4">
                            <div className="flex items-center justify-between gap-2">
                              <div className="min-w-0">
                                <div className="text-sm opacity-60">
                                  Total plants
                                </div>
                                <div className="text-xs opacity-60">
                                  {plantsUpdatedAt
                                    ? `Updated ? ${formatTimeAgo(plantsUpdatedAt)}`
                                    : "Updated -"}
                                </div>
                              </div>
                              <Button
                                variant="outline"
                                size="icon"
                                aria-label="Refresh total plants"
                                onClick={() =>
                                  loadRegisteredCount({ initial: false })
                                }
                                disabled={plantsLoading || plantsRefreshing}
                                className="h-8 w-8 rounded-xl border bg-white text-black hover:bg-stone-50"
                              >
                                <RefreshCw
                                  className={`h-4 w-4 ? ${plantsLoading || plantsRefreshing ? "animate-spin" : ""}`}
                                />
                              </Button>
                            </div>
                            <div className="text-2xl font-semibold tabular-nums mt-1">
                              {plantsLoading
                                ? "-"
                                : plantsUpdatedAt !== null
                                  ? (plantsCount ?? "-")
                                  : "-"}
                            </div>
                          </CardContent>
                        </Card>
                      </div>
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
                            <div className="text-sm opacity-60">Loading...</div>
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
                              }: any) => {
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
                                                      payload?: any[];
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
                      </div>
                    </div>
                  </>
                )}

                {/* Requests Tab */}
                  {activeTab === "requests" && (
                    <div className="space-y-4">
                      <div className="flex justify-center">
                        <div className="inline-flex items-center gap-1 rounded-full border border-stone-200 dark:border-[#3e3e42] bg-white/80 dark:bg-[#1a1a1d]/80 px-1 py-1 backdrop-blur">
                          {REQUEST_VIEW_TABS.map((tab) => {
                            const isActive = requestViewMode === tab.key;
                            return (
                              <button
                                key={tab.key}
                                type="button"
                                className={`px-4 py-1.5 text-sm font-semibold rounded-full transition-colors ${
                                  isActive
                                    ? "bg-emerald-600 text-white shadow"
                                    : "text-stone-600 dark:text-stone-300 hover:text-black dark:hover:text-white"
                                }`}
                                onClick={() => setRequestViewMode(tab.key)}
                              >
                                {tab.label}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                        {plantViewIsPlants ? (
                          <>
                            {plantDashboardError && (
                              <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900/60 dark:bg-red-900/30 dark:text-red-200">
                                {plantDashboardError}
                              </div>
                            )}
                            <Card className="rounded-2xl">
                              <CardContent className="p-4 space-y-4">
                                <div className="flex flex-wrap items-center justify-between gap-3">
                                  <div>
                                    <div className="text-sm font-medium">
                                      Plant health overview
                                    </div>
                                    <div className="text-xs opacity-60">
                                      Status mix, promotion calendar and approval coverage.
                                    </div>
                                  </div>
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    className="rounded-xl"
                                    onClick={() => loadPlantDashboard()}
                                    disabled={plantDashboardLoading}
                                  >
                                    <RefreshCw
                                      className={`h-4 w-4 mr-2 ${plantDashboardLoading ? "animate-spin" : ""}`}
                                    />
                                    Refresh
                                  </Button>
                                </div>
                                <div className="grid gap-4 md:grid-cols-3">
                                  <div className="rounded-2xl border border-stone-200/80 dark:border-[#3e3e42] bg-white/95 dark:bg-[#17171d] p-4 flex flex-col">
                                    <div className="flex items-start justify-between gap-3">
                                      <div>
                                        <div className="text-sm font-semibold">
                                          Status repartition
                                        </div>
                                        <div className="text-xs opacity-60">
                                          In progress, review and rework.
                                        </div>
                                      </div>
                                      <div className="text-right">
                                        <div className="text-[11px] uppercase tracking-wide opacity-60">
                                          Approved
                                        </div>
                                        <div className="text-2xl font-semibold">
                                          {approvedPlantsCount}
                                        </div>
                                      </div>
                                    </div>
                                    <div className="relative mt-4 h-48">
                                      {plantTableLoading ? (
                                        <div className="flex h-full items-center justify-center text-sm opacity-60">
                                          Loading chart...
                                        </div>
                                      ) : plantStatusDonutData.length === 0 ? (
                                        <div className="flex h-full items-center justify-center text-sm opacity-60">
                                          No status data yet.
                                        </div>
                                      ) : (
                                        <ChartSuspense
                                          fallback={
                                            <div className="flex h-full items-center justify-center text-sm opacity-60">
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
                                              >
                                                {plantStatusDonutData.map((slice) => (
                                                  <Cell key={slice.key} fill={slice.color} />
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
                                          <span className="text-xs uppercase tracking-wide opacity-60">
                                            Total
                                          </span>
                                          <span className="text-2xl font-semibold">
                                            {plantStatusDonutData.reduce(
                                              (sum, slice) => sum + slice.value,
                                              0,
                                            )}
                                          </span>
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                  <div className="rounded-2xl border border-stone-200/80 dark:border-[#3e3e42] bg-white/90 dark:bg-[#131318] p-4 flex flex-col">
                                    <div className="text-sm font-semibold">
                                      Promotion cadence
                                    </div>
                                    <div className="text-xs opacity-60 mb-4">
                                      Number of plants promoted per month.
                                    </div>
                                    <div className="flex-1 min-h-[260px]">
                                      {plantTableLoading ? (
                                        <div className="flex h-full items-center justify-center text-sm opacity-60">
                                          Loading chart...
                                        </div>
                                      ) : !hasPromotionMonthData ? (
                                        <div className="flex h-full items-center justify-center text-sm opacity-60">
                                          No promotion data yet.
                                        </div>
                                      ) : (
                                        <ChartSuspense
                                          fallback={
                                            <div className="flex h-full items-center justify-center text-sm opacity-60">
                                              Loading chart...
                                            </div>
                                          }
                                        >
                                          <ResponsiveContainer width="100%" height="100%">
                                            <BarChart data={promotionMonthData}>
                                              <CartesianGrid
                                                strokeDasharray="3 3"
                                                stroke={
                                                  isDark
                                                    ? "rgba(255,255,255,0.08)"
                                                    : "rgba(0,0,0,0.06)"
                                                }
                                              />
                                              <XAxis dataKey="label" tick={{ fontSize: 12 }} />
                                              <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
                                              <Tooltip
                                                cursor={{
                                                  fill: isDark
                                                    ? "rgba(255,255,255,0.05)"
                                                    : "rgba(0,0,0,0.03)",
                                                }}
                                                formatter={(value: number) => [`${value} plants`, "Promotions"]}
                                              />
                                              <Bar
                                                dataKey="value"
                                                fill={accentColor}
                                                radius={[6, 6, 0, 0]}
                                              />
                                            </BarChart>
                                          </ResponsiveContainer>
                                        </ChartSuspense>
                                      )}
                                    </div>
                                  </div>
                                  <div className="rounded-2xl border border-stone-200/80 dark:border-[#3e3e42] bg-white/95 dark:bg-[#17171d] p-4 flex flex-col">
                                    <div className="text-sm font-semibold">
                                      Requests vs approved
                                    </div>
                                    <div className="text-xs opacity-60">
                                      Ratio between incoming requests and approved plants.
                                    </div>
                                    <div className="mt-4 flex-1">
                                      {plantTableLoading && totalPlantRequestsCount === 0 ? (
                                        <div className="flex h-full items-center justify-center text-sm opacity-60">
                                          Loading gauge...
                                        </div>
                                      ) : requestsVsApproved.requests === 0 &&
                                        requestsVsApproved.approved === 0 ? (
                                        <div className="flex h-full items-center justify-center text-sm opacity-60">
                                          No requests or approved plants yet.
                                        </div>
                                      ) : (
                                        <div className="h-48">
                                          <ChartSuspense
                                            fallback={
                                              <div className="flex h-full items-center justify-center text-sm opacity-60">
                                                Loading gauge...
                                              </div>
                                            }
                                          >
                                            <ResponsiveContainer width="100%" height="100%">
                                              <RadialBarChart
                                                data={[
                                                  {
                                                    name: "ratio",
                                                    value: requestsVsApproved.gaugeValue,
                                                  },
                                                ]}
                                                startAngle={180}
                                                endAngle={0}
                                                innerRadius="80%"
                                                outerRadius="100%"
                                              >
                                                <PolarAngleAxis
                                                  type="number"
                                                  domain={[
                                                    0,
                                                    Math.max(1, requestsVsApproved.domainMax),
                                                  ]}
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
                                        </div>
                                      )}
                                    </div>
                                    <div className="mt-4 text-center">
                                      <div className="text-3xl font-semibold">
                                        {requestsVsApproved.ratio !== null
                                          ? `${requestsVsApproved.percent.toFixed(0)}%`
                                          : requestsVsApproved.approved === 0 &&
                                              requestsVsApproved.requests > 0
                                            ? "∞"
                                            : "0%"}
                                      </div>
                                      <div className="text-xs uppercase tracking-wide opacity-60">
                                        Requests coverage
                                      </div>
                                      <div className="text-sm mt-2">
                                        {requestsVsApproved.requests} requests /{" "}
                                        {requestsVsApproved.approved} approved
                                      </div>
                                      {requestsVsApproved.ratio === null &&
                                        requestsVsApproved.approved === 0 &&
                                        requestsVsApproved.requests > 0 && (
                                          <div className="text-xs opacity-60 mt-1">
                                            Approve at least one plant to compute the ratio.
                                          </div>
                                        )}
                                    </div>
                                  </div>
                                </div>
                              </CardContent>
                            </Card>
                            <Card className="rounded-2xl">
                              <CardContent className="p-4 space-y-4">
                                  <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                                    <div>
                                      <div className="text-sm font-medium">
                                        Plant inventory
                                      </div>
                                      <div className="text-xs opacity-60">
                                        Toggle statuses or search to focus the list.
                                      </div>
                                    </div>
                                    <div className="w-full md:w-64 relative">
                                      <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 opacity-50" />
                                      <Input
                                        value={plantSearchQuery}
                                        onChange={(e) => setPlantSearchQuery(e.target.value)}
                                        placeholder="Search by plant name..."
                                        className="pl-10 rounded-xl"
                                      />
                                    </div>
                                  </div>
                                  <div className="flex flex-wrap gap-2">
                                    {PLANT_STATUS_FILTER_OPTIONS.map((option) => {
                                      const selected = visiblePlantStatusesSet.has(option.value);
                                      return (
                                        <button
                                          key={option.value}
                                          type="button"
                                          aria-pressed={selected}
                                          onClick={() => togglePlantStatusFilter(option.value)}
                                          className={`flex items-center gap-1 rounded-full border px-3 py-1.5 text-xs font-semibold transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-500 ${
                                            selected
                                              ? "bg-emerald-600 text-white border-emerald-600 shadow"
                                              : "border-stone-200 text-stone-600 dark:border-[#3e3e42] dark:text-stone-200 hover:border-emerald-400 hover:text-emerald-200"
                                          }`}
                                        >
                                          <Check
                                            className={`h-3 w-3 transition-opacity ${selected ? "opacity-100" : "opacity-0"}`}
                                          />
                                          <span>{option.label}</span>
                                        </button>
                                      );
                                    })}
                                  </div>
                                  <div className="text-[11px] text-stone-500 dark:text-stone-400">
                                    Approved plants are hidden by default—enable statuses to include them.
                                  </div>
                                <div className="rounded-2xl border border-stone-200 dark:border-[#3e3e42] overflow-hidden">
                                  <div className="grid grid-cols-[minmax(0,1fr)_120px] gap-4 bg-stone-50/60 dark:bg-[#1c1c1f] px-4 py-2 text-[11px] font-semibold uppercase tracking-wide text-stone-500 dark:text-stone-300">
                                    <span>Plant</span>
                                    <span className="text-right">Status</span>
                                  </div>
                                    {plantTableLoading ? (
                                      <div className="p-4 text-sm opacity-60">
                                        Loading plants...
                                      </div>
                                    ) : filteredPlantRows.length === 0 ? (
                                      <div className="p-4 text-sm opacity-60">
                                        {plantDashboardRows.length === 0
                                          ? "No plants available yet."
                                          : noPlantStatusesSelected
                                            ? "Select at least one status to see plants."
                                            : "No plants match the current filters."}
                                      </div>
                                    ) : (
                                    <div className="divide-y divide-stone-200 dark:divide-[#2f2f35]">
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
                                          className="grid grid-cols-[minmax(0,1fr)_120px] gap-4 px-4 py-3 items-center cursor-pointer transition-colors hover:bg-stone-50 dark:hover:bg-[#1f1f24]"
                                        >
                                          <div className="flex items-center gap-3 min-w-0">
                                            <div className="h-12 w-12 flex-shrink-0 overflow-hidden rounded-xl bg-neutral-100 dark:bg-[#2d2d30] text-sm font-semibold text-neutral-500 flex items-center justify-center">
                                              {plant.primaryImage ? (
                                                <img
                                                  src={plant.primaryImage}
                                                  alt={plant.name}
                                                  className="h-full w-full object-cover"
                                                  loading="lazy"
                                                />
                                              ) : (
                                                plant.name.charAt(0).toUpperCase()
                                              )}
                                            </div>
                                            <div className="min-w-0">
                                              <div className="text-sm font-medium truncate">
                                                {plant.name}
                                              </div>
                                              {plant.promotionMonth && (
                                                <div className="text-xs opacity-60">
                                                  Promotion:{" "}
                                                  {PROMOTION_MONTH_LABELS[plant.promotionMonth]}
                                                </div>
                                              )}
                                                {plant.updatedAt && (
                                                  <div className="text-xs text-stone-500 dark:text-stone-400">
                                                    Last update {formatTimeAgo(plant.updatedAt)}
                                                  </div>
                                                )}
                                            </div>
                                          </div>
                                          <div className="text-right">
                                            <span
                                              className={`inline-flex items-center justify-end rounded-full px-2 py-1 text-xs font-medium ${PLANT_STATUS_BADGE_CLASSES[plant.status]}`}
                                            >
                                              {PLANT_STATUS_LABELS[plant.status]}
                                            </span>
                                          </div>
                                        </div>
                                      ))}
                                    </div>
                                  )}
                                </div>
                              </CardContent>
                            </Card>
                          </>
                        ) : (
                      <Card className="rounded-2xl">
                      <CardContent className="p-4 space-y-4">
                        <div className="flex items-center justify-between gap-3">
                          <div>
                            <div className="text-sm font-medium">
                              Pending plant requests
                            </div>
                            <div className="text-xs opacity-60">
                              Sorted by request count and most recent updates.
                            </div>
                          </div>
                          <Button
                            variant="outline"
                            className="rounded-xl"
                            onClick={() =>
                              loadPlantRequests({ initial: false })
                            }
                            disabled={
                              plantRequestsLoading || plantRequestsRefreshing
                            }
                          >
                            <RefreshCw
                              className={`h-4 w-4 mr-2 ${plantRequestsLoading || plantRequestsRefreshing ? "animate-spin" : ""}`}
                            />
                            <span className="hidden sm:inline">Refresh</span>
                            <span className="sm:hidden inline">Reload</span>
                          </Button>
                        </div>

                        {/* Statistics */}
                        {!plantRequestsLoading && plantRequests.length > 0 && (
                          <div className="flex flex-wrap gap-4 text-sm">
                            <div className="flex items-center gap-2">
                              <span className="opacity-60">
                                Total Requests:
                              </span>
                              <span className="font-medium">
                                {plantRequests.reduce(
                                  (sum, req) => sum + req.request_count,
                                  0,
                                )}
                              </span>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="opacity-60">Unique Plants:</span>
                              <span className="font-medium">
                                {plantRequests.length}
                              </span>
                            </div>
                          </div>
                        )}

                        {/* Search */}
                        <div className="relative">
                          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 opacity-50 pointer-events-none" />
                          <Input
                            placeholder="Search requests by plant name..."
                            value={requestSearchQuery}
                            onChange={(e) =>
                              setRequestSearchQuery(e.target.value)
                            }
                            className="rounded-xl pl-10 pr-4"
                          />
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
                            const filteredRequests = requestSearchQuery.trim()
                              ? plantRequests.filter((req) =>
                                  req.plant_name
                                    .toLowerCase()
                                    .includes(
                                      requestSearchQuery.toLowerCase().trim(),
                                    ),
                                )
                              : plantRequests;

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
                                          <div className="text-sm font-medium">
                                            {req.plant_name}
                                          </div>
                                          <div
                                            className="text-xs opacity-60"
                                            title={updatedTitle}
                                          >
                                            {timeLabel}
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
                              </div>
                            );
                          })()
                        )}
                      </CardContent>
                    </Card>
                        )}

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

                    {/* Create Plant Dialog */}
                    <Dialog
                      open={createPlantDialogOpen}
                      onOpenChange={setCreatePlantDialogOpen}
                    >
                      <DialogContent className="rounded-2xl max-w-4xl max-h-[90vh] overflow-y-auto p-0">
                        <DialogHeader className="px-6 pt-6 pb-4">
                          <DialogTitle>Add Plant from Request</DialogTitle>
                          <DialogDescription>
                            Create a new plant entry for "{createPlantName}".
                            The plant name will be pre-filled.
                          </DialogDescription>
                        </DialogHeader>
                        <div className="px-6 pb-6 overflow-y-auto">
                          <CreatePlantPage
                            onCancel={() => {
                              setCreatePlantDialogOpen(false);
                              setCreatePlantRequestId(null);
                              setCreatePlantName("");
                            }}
                            onSaved={handlePlantCreated}
                            initialName={createPlantName}
                          />
                        </div>
                      </DialogContent>
                    </Dialog>
                    </div>
                  )}

                    {/* Upload & Media Tab */}
                    {activeTab === "upload" && <AdminUploadMediaPanel />}

                    {/* Notifications Tab */}
                    {activeTab === "notifications" && <AdminNotificationsPanel />}

                  {/* Admin Logs Tab */}
                  {activeTab === "admin_logs" && <AdminLogs />}

                {/* Members Tab */}
                {activeTab === "members" && (
                  <div className="space-y-4" ref={membersContainerRef}>
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div className="flex items-center gap-2 text-sm font-semibold">
                        <button
                          type="button"
                          className={`px-3 py-1.5 rounded-full transition-colors ${membersView === "search" ? "bg-emerald-600 text-white shadow" : "text-stone-600 dark:text-stone-300 hover:text-black dark:hover:text-white"}`}
                          onClick={() => setMembersView("search")}
                        >
                          Search
                        </button>
                        <span className="text-xs opacity-50">|</span>
                        <button
                          type="button"
                          className={`px-3 py-1.5 rounded-full transition-colors ${membersView === "list" ? "bg-emerald-600 text-white shadow" : "text-stone-600 dark:text-stone-300 hover:text-black dark:hover:text-white"}`}
                          onClick={() => setMembersView("list")}
                        >
                          List
                        </button>
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
                                      <div className="flex flex-wrap gap-1 mt-1">
                                        {memberData.profile?.is_admin && (
                                          <Badge
                                            variant="outline"
                                            className="rounded-full px-2 py-0.5 bg-emerald-200 dark:bg-emerald-800 text-emerald-900 dark:text-emerald-100 border-emerald-300 dark:border-emerald-700 flex items-center gap-1"
                                          >
                                            <ShieldCheck className="h-3 w-3" />{" "}
                                            Admin
                                          </Badge>
                                        )}
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
                                        {(memberData as any)?.lastCountry && (
                                          <Badge
                                            variant="outline"
                                            className="rounded-full px-2 py-0.5"
                                          >
                                            {countryCodeToName(
                                              (memberData as any).lastCountry,
                                            )}
                                          </Badge>
                                        )}
                                        {(memberData as any)?.lastReferrer && (
                                          <Badge
                                            variant="outline"
                                            className="rounded-full px-2 py-0.5"
                                          >
                                            Referrer{" "}
                                            {(memberData as any).lastReferrer}
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
                                    }: any) => {
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

                            <Card className="rounded-2xl">
                              <CardContent className="p-4 space-y-2">
                                <div className="flex items-start justify-between">
                                  <div className="text-sm font-medium">
                                    Admin notes
                                  </div>
                                  <AddAdminNote
                                    profileId={memberData.user?.id || ""}
                                    onAdded={() => lookupMember()}
                                  />
                                </div>
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
                                      ? `on ? ${new Date(memberData.bannedAt).toLocaleString()}`
                                      : ""}
                                    {memberData.bannedReason
                                      ? ` ? ? ${memberData.bannedReason}`
                                      : ""}
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
                                    <div>
                                      <div className="font-semibold truncate">
                                        {member.displayName ||
                                          member.email ||
                                          `User ${member.id.slice(0, 8)}`}
                                      </div>
                                      <div className="text-xs opacity-70 truncate">
                                        {member.email || "No email"}
                                      </div>
                                    </div>
                                    <Badge
                                      variant={
                                        member.isAdmin ? "default" : "outline"
                                      }
                                      className={`rounded-full px-3 py-0.5 ${member.isAdmin ? "bg-emerald-600 text-white" : ""}`}
                                    >
                                      {member.isAdmin ? "Admin" : "Member"}
                                    </Badge>
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
  </div>
);
};

// --- Broadcast controls (Overview tab) ---
const BroadcastControls: React.FC<{
  inline?: boolean;
  onExpired?: () => void;
  onActive?: () => void;
}> = ({ inline = false, onExpired, onActive }) => {
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

  const msRemaining = React.useCallback(
    (expiresAt: string | null): number | null => {
      if (!expiresAt) return null;
      const end = Date.parse(expiresAt);
      if (!Number.isFinite(end)) return null;
      return Math.max(0, end - now);
    },
    [now],
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
        if (b?.broadcast) {
          setActive(b.broadcast);
          savePersistedBroadcast(b.broadcast);
          // Pre-fill edit fields so admin can immediately edit
          setMessage(b.broadcast.message || "");
          setSeverity((b.broadcast.severity as any) || "info");
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
              : "info") as any,
          );
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
  }, []);

  // When current broadcast expires, revert to create form and notify parent (to re-open section)
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
        const staticToken = (globalThis as any)?.__ENV__
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
        const staticToken = (globalThis as any)?.__ENV__
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
            onChange={(e) => setSeverity((e.target.value as any) || "warning")}
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
                    const staticToken = (globalThis as any)?.__ENV__
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
            onChange={(e) => setSeverity((e.target.value as any) || "warning")}
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
  const disabled = !profileId || !value.trim() || submitting;
  const submit = React.useCallback(async () => {
    if (disabled) return;
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
        const adminToken = (globalThis as any)?.__ENV__
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
      if (!resp.ok) throw new Error(data?.error || `HTTP ? ${resp.status}`);
      // Log note create (UI)
      try {
        const headers2: Record<string, string> = {
          Accept: "application/json",
          "Content-Type": "application/json",
        };
        if (token) headers2["Authorization"] = `Bearer ${token}`;
        try {
          const adminToken = (globalThis as any)?.__ENV__
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
    } catch {
      // noop
    } finally {
      setSubmitting(false);
    }
  }, [profileId, value, submitting, onAdded]);
  return (
    <div>
      {!open ? (
        <Button onClick={() => setOpen(true)} className="rounded-2xl">
          Add note
        </Button>
      ) : (
        <div className="flex gap-2">
          <Textarea
            placeholder="Add a note for other admins (visible only to admins)"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            className="min-h-[56px]"
          />
          <div className="flex flex-col gap-2">
            <Button
              onClick={submit}
              disabled={disabled}
              className="rounded-2xl"
            >
              Save
            </Button>
            <Button
              variant="secondary"
              onClick={() => {
                setOpen(false);
                setValue("");
              }}
              className="rounded-2xl"
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
        const adminToken = (globalThis as any)?.__ENV__
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
          const adminToken = (globalThis as any)?.__ENV__
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

const AdminLogs: React.FC = () => {
  const [logs, setLogs] = React.useState<
    Array<{
      occurred_at: string;
      admin_id?: string | null;
      admin_name: string | null;
      action: string;
      target: string | null;
      detail: any;
    }>
  >([]);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [visibleCount, setVisibleCount] = React.useState<number>(20);

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

  const formatLogLine = React.useCallback(
    (l: {
      occurred_at: string;
      admin_id?: string | null;
      admin_name: string | null;
      action: string;
      target: string | null;
      detail: any;
    }): string => {
      const ts = l.occurred_at ? new Date(l.occurred_at).toLocaleString() : "";
      const who = (l.admin_name && String(l.admin_name).trim()) || "Admin";
      const act = l.action || "";
      const tgt = l.target ? ` ? ${l.target}` : "";
      const det = l.detail ? ` ? ${JSON.stringify(l.detail)}` : "";
      return `${ts} :: ? ${who} // ? ${act}${tgt}${det}`;
    },
    [],
  );

  const copyVisibleLogs = React.useCallback(async () => {
    const subset = logs.slice(0, visibleCount);
    const text = subset.map(formatLogLine).join("\n");
    await copyTextToClipboard(text);
  }, [logs, visibleCount, copyTextToClipboard, formatLogLine]);
  const load = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const session = (await supabase.auth.getSession()).data.session;
      const token = session?.access_token;
      const headers: Record<string, string> = { Accept: "application/json" };
      if (token) headers["Authorization"] = `Bearer ${token}`;
      try {
        const adminToken = (globalThis as any)?.__ENV__
          ?.VITE_ADMIN_STATIC_TOKEN;
        if (adminToken) headers["X-Admin-Token"] = String(adminToken);
      } catch {}
      const r = await fetch("/api/admin/admin-logs?days=30", {
        headers,
        credentials: "same-origin",
      });
      const data = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(data?.error || `HTTP ? ${r.status}`);
      const list = Array.isArray(data?.logs) ? data.logs : [];
      setLogs(list);
      setVisibleCount(Math.min(20, list.length || 20));
    } catch (e: any) {
      setError(e?.message || "Failed to load logs");
    } finally {
      setLoading(false);
    }
  }, []);
  React.useEffect(() => {
    load();
  }, [load]);

  // Live stream of admin logs via SSE
  React.useEffect(() => {
    let es: EventSource | null = null;
    let updating = false;
    (async () => {
      try {
        const session = (await supabase.auth.getSession()).data.session;
        const token = session?.access_token;
        // Static admin token if configured
        let adminToken: string | null = null;
        try {
          adminToken =
            String(
              (globalThis as any)?.__ENV__?.VITE_ADMIN_STATIC_TOKEN || "",
            ) || null;
        } catch {}
        const q: string[] = [];
        if (token) q.push(`token=${encodeURIComponent(token)}`);
        if (adminToken) q.push(`admin_token=${encodeURIComponent(adminToken)}`);
        const url = `/api/admin/admin-logs/stream${q.length ? "?" + q.join("&") : ""}`;
        es = new EventSource(url);
        es.addEventListener("snapshot", (ev: MessageEvent) => {
          try {
            const data = JSON.parse(String(ev.data || "{}"));
            const list = Array.isArray(data?.logs) ? data.logs : [];
            setLogs(list);
            setVisibleCount(Math.min(20, list.length || 20));
          } catch {}
        });
        es.addEventListener("append", (ev: MessageEvent) => {
          try {
            const row = JSON.parse(String(ev.data || "{}"));
            if (updating) return;
            updating = true;
            setLogs((prev) => [row, ...prev].slice(0, 2000));
            setTimeout(() => {
              updating = false;
            }, 0);
          } catch {}
        });
        es.onerror = () => {};
      } catch {}
    })();
    return () => {
      try {
        es?.close();
      } catch {}
    };
  }, []);
  return (
    <Card className="rounded-2xl">
      <CardContent className="p-4">
        <div className="flex items-center justify-between mb-2">
          <div className="text-sm font-medium">Admin logs - last 30 days</div>
          <div className="flex items-center gap-2">
            <Button
              variant="secondary"
              className="rounded-2xl h-8 px-3"
              onClick={copyVisibleLogs}
              disabled={loading}
              aria-label="Copy logs"
            >
              Copy
            </Button>
            <Button
              size="icon"
              variant="outline"
              className="rounded-2xl"
              onClick={load}
              disabled={loading}
              aria-label="Refresh logs"
            >
              <RefreshCw
                className={`h-4 w-4 ? ${loading ? "animate-spin" : ""}`}
              />
            </Button>
          </div>
        </div>
        {error && <div className="text-sm text-rose-600">{error}</div>}
        {loading ? (
          <div className="text-sm opacity-60">Loading...</div>
        ) : logs.length === 0 ? (
          <div className="text-sm opacity-60">No admin activity logged.</div>
        ) : (
          <>
            <div className="bg-black text-green-300 rounded-2xl p-3 text-[11px] font-mono overflow-y-auto overflow-x-hidden max-h-[480px] space-y-2">
              {logs.slice(0, visibleCount).map((l, idx) => (
                <div key={idx} className="whitespace-pre-wrap break-words">
                  {formatLogLine(l)}
                </div>
              ))}
            </div>
            {logs.length > visibleCount && (
              <div className="flex justify-end mt-2">
                <Button
                  variant="outline"
                  className="rounded-2xl h-8 px-3"
                  onClick={() =>
                    setVisibleCount((c) => Math.min(c + 50, logs.length))
                  }
                >
                  Show more
                </Button>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
};
