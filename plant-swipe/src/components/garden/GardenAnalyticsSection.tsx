// @ts-nocheck
import React from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useTranslation } from "react-i18next";
import { supabase } from "@/lib/supabaseClient";
import { LazyCharts, ChartSuspense } from "@/components/admin/LazyChart";
import { useAuth } from "@/context/AuthContext";
import { motion, AnimatePresence } from "framer-motion";
import {
  TrendingUp,
  TrendingDown,
  Droplets,
  Leaf,
  Scissors,
  Sparkles,
  Activity,
  Calendar,
  Target,
  Award,
  Flame,
  Users,
  BarChart3,
  RefreshCw,
  Loader2,
  ChevronRight,
  AlertCircle,
  CheckCircle2,
  Info,
  Download,
  FileText,
  FileJson,
} from "lucide-react";
import type { Garden } from "@/types/garden";

const {
  ResponsiveContainer,
  ComposedChart,
  Line,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  PieChart,
  Pie,
  Cell,
  RadialBarChart,
  RadialBar,
  PolarAngleAxis,
} = LazyCharts;

interface AnalyticsData {
  dailyStats: Array<{
    date: string;
    due: number;
    completed: number;
    success: boolean;
    water?: number;
    fertilize?: number;
    harvest?: number;
    cut?: number;
    custom?: number;
  }>;
  weeklyStats: {
    tasksCompleted: number;
    tasksDue: number;
    completionRate: number;
    trend: "up" | "down" | "stable";
    trendValue: number;
    tasksByType: {
      water: number;
      fertilize: number;
      harvest: number;
      cut: number;
      custom: number;
    };
  };
  memberContributions: Array<{
    userId: string;
    displayName: string;
    tasksCompleted: number;
    percentage: number;
    color: string;
  }>;
  plantStats: {
    total: number;
    species: number;
    needingAttention: number;
    healthy: number;
  };
  streakInfo: {
    current: number;
    best: number;
    lastMissed: string | null;
  };
}

interface GardenerAdvice {
  id: string;
  weekStart: string;
  adviceText: string;
  adviceSummary: string | null;
  focusAreas: string[];
  plantSpecificTips: Array<{
    plantName: string;
    tip: string;
    priority: "high" | "medium" | "low";
    reason?: string;
  }>;
  improvementScore: number | null;
  generatedAt: string;
  // Enhanced fields
  weeklyFocus?: string | null;
  weatherAdvice?: string | null;
  encouragement?: string | null;
  weatherContext?: {
    current?: { temp?: number; condition?: string; humidity?: number };
    forecast?: Array<{ date: string; condition: string; tempMax: number; tempMin: number; precipProbability: number }>;
    location?: string;
  } | null;
  locationContext?: { city?: string; country?: string } | null;
}

interface GardenAnalyticsSectionProps {
  gardenId: string;
  garden: Garden | null;
  plants: any[];
  members: Array<{
    userId: string;
    displayName?: string | null;
    role: "owner" | "member";
    accentKey?: string | null;
  }>;
  dailyStats: Array<{
    date: string;
    due: number;
    completed: number;
    success: boolean;
  }>;
  serverToday?: string | null;
  streak?: number;
}

// Color palette for charts
const CHART_COLORS = {
  water: "#3b82f6",
  fertilize: "#a855f7",
  harvest: "#f59e0b",
  cut: "#ef4444",
  custom: "#10b981",
  primary: "#10b981",
  secondary: "#6366f1",
  success: "#22c55e",
  warning: "#f59e0b",
  danger: "#ef4444",
  muted: "#94a3b8",
};

const MEMBER_COLORS = [
  "#10b981",
  "#3b82f6",
  "#8b5cf6",
  "#ec4899",
  "#f59e0b",
  "#06b6d4",
  "#84cc16",
  "#f97316",
];

export const GardenAnalyticsSection: React.FC<GardenAnalyticsSectionProps> = ({
  gardenId,
  garden,
  plants,
  members,
  dailyStats,
  serverToday: serverTodayProp,
  streak: streakProp,
}) => {
  // Default serverToday to current date if not provided
  const serverToday = serverTodayProp || new Date().toISOString().slice(0, 10);
  
  // Compute streak from garden or default to 0
  const baseStreak = streakProp ?? garden?.streak ?? 0;
  const streak = React.useMemo(() => {
    if (!serverToday || !dailyStats.length) return baseStreak;
    const today = dailyStats.find((d) => d.date === serverToday);
    if (today && today.success) return baseStreak + 1;
    return baseStreak;
  }, [baseStreak, serverToday, dailyStats]);
  const { t } = useTranslation("common");
  const { user } = useAuth();
  const [loading, setLoading] = React.useState(true);
  const [adviceLoading, setAdviceLoading] = React.useState(false);
  const [advice, setAdvice] = React.useState<GardenerAdvice | null>(null);
  const [adviceError, setAdviceError] = React.useState<string | null>(null);
  const [analyticsData, setAnalyticsData] = React.useState<AnalyticsData | null>(null);
  const [activeTab, setActiveTab] = React.useState<"overview" | "tasks" | "plants" | "members">("overview");
  const [exportMenuOpen, setExportMenuOpen] = React.useState(false);
  const [exporting, setExporting] = React.useState(false);
  const exportMenuRef = React.useRef<HTMLDivElement>(null);

  // Close export menu when clicking outside
  React.useEffect(() => {
    if (!exportMenuOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (exportMenuRef.current && !exportMenuRef.current.contains(e.target as Node)) {
        setExportMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [exportMenuOpen]);

  // Check if garden is eligible for AI advice
  const gardenCreatedAt = garden?.createdAt ? new Date(garden.createdAt) : null;
  const gardenAgeInDays = gardenCreatedAt
    ? Math.floor((Date.now() - gardenCreatedAt.getTime()) / (1000 * 60 * 60 * 24))
    : 0;
  const isEligibleForAdvice = gardenAgeInDays >= 7 && plants.length >= 1;

  // Compute analytics from dailyStats
  const computedAnalytics = React.useMemo(() => {
    if (!dailyStats || dailyStats.length === 0) return null;

    const today = serverToday || new Date().toISOString().slice(0, 10);
    const todayDate = new Date(today);
    
    // Last 7 days for weekly stats
    const last7Days = dailyStats.filter((d) => {
      const diff = (todayDate.getTime() - new Date(d.date).getTime()) / (1000 * 60 * 60 * 24);
      return diff >= 0 && diff < 7;
    });

    // Previous 7 days for trend comparison
    const prev7Days = dailyStats.filter((d) => {
      const diff = (todayDate.getTime() - new Date(d.date).getTime()) / (1000 * 60 * 60 * 24);
      return diff >= 7 && diff < 14;
    });

    const currentWeekCompleted = last7Days.reduce((sum, d) => sum + (d.completed || 0), 0);
    const currentWeekDue = last7Days.reduce((sum, d) => sum + (d.due || 0), 0);
    const prevWeekCompleted = prev7Days.reduce((sum, d) => sum + (d.completed || 0), 0);

    const completionRate = currentWeekDue > 0 
      ? Math.round((currentWeekCompleted / currentWeekDue) * 100) 
      : 100;

    const trendValue = prevWeekCompleted > 0
      ? Math.round(((currentWeekCompleted - prevWeekCompleted) / prevWeekCompleted) * 100)
      : 0;

    let trend: "up" | "down" | "stable" = "stable";
    if (trendValue > 5) trend = "up";
    else if (trendValue < -5) trend = "down";

    // Calculate consecutive successful days for best streak
    let bestStreak = 0;
    let currentStreak = 0;
    const sortedStats = [...dailyStats].sort((a, b) => a.date.localeCompare(b.date));
    for (const stat of sortedStats) {
      if (stat.success) {
        currentStreak++;
        bestStreak = Math.max(bestStreak, currentStreak);
      } else {
        currentStreak = 0;
      }
    }

    // Find last missed day
    const lastMissed = sortedStats
      .filter((d) => !d.success && d.due > 0)
      .pop()?.date || null;

    // Estimate task breakdown (if we don't have detailed data)
    const tasksByType = {
      water: Math.round(currentWeekCompleted * 0.5),
      fertilize: Math.round(currentWeekCompleted * 0.15),
      harvest: Math.round(currentWeekCompleted * 0.15),
      cut: Math.round(currentWeekCompleted * 0.1),
      custom: Math.round(currentWeekCompleted * 0.1),
    };

    return {
      dailyStats: dailyStats,
      weeklyStats: {
        tasksCompleted: currentWeekCompleted,
        tasksDue: currentWeekDue,
        completionRate,
        trend,
        trendValue: Math.abs(trendValue),
        tasksByType,
      },
      memberContributions: members.map((m, idx) => ({
        userId: m.userId,
        displayName: m.displayName || "Member",
        tasksCompleted: Math.floor(currentWeekCompleted / members.length),
        percentage: Math.round(100 / members.length),
        color: MEMBER_COLORS[idx % MEMBER_COLORS.length],
      })),
      plantStats: {
        total: plants.length,
        species: new Set(plants.map((p) => p.plantId || p.plant?.id)).size,
        needingAttention: plants.filter((p) => (p.plantsOnHand || 0) < 1).length,
        healthy: plants.filter((p) => (p.plantsOnHand || 0) >= 1).length,
      },
      streakInfo: {
        current: streak,
        best: Math.max(bestStreak, streak),
        lastMissed,
      },
    } as AnalyticsData;
  }, [dailyStats, serverToday, plants, members, streak]);

  // Fetch detailed analytics from server
  const fetchAnalytics = React.useCallback(async () => {
    if (!gardenId) return;
    setLoading(true);
    try {
      const session = (await supabase.auth.getSession()).data.session;
      const token = session?.access_token;
      const headers: Record<string, string> = { Accept: "application/json" };
      if (token) headers["Authorization"] = `Bearer ${token}`;

      const resp = await fetch(`/api/garden/${gardenId}/analytics`, {
        headers,
        credentials: "same-origin",
      });

      if (resp.ok) {
        const data = await resp.json();
        if (data?.ok) {
          setAnalyticsData(data.analytics);
        }
      }
    } catch (err) {
      console.warn("[Analytics] Failed to fetch detailed analytics:", err);
    } finally {
      setLoading(false);
    }
  }, [gardenId]);

  // Fetch AI gardener advice
  const fetchAdvice = React.useCallback(async (forceRefresh = false) => {
    if (!gardenId || !isEligibleForAdvice) return;
    setAdviceLoading(true);
    setAdviceError(null);
    try {
      const session = (await supabase.auth.getSession()).data.session;
      const token = session?.access_token;
      const headers: Record<string, string> = { Accept: "application/json" };
      if (token) headers["Authorization"] = `Bearer ${token}`;

      const url = forceRefresh
        ? `/api/garden/${gardenId}/advice?refresh=true`
        : `/api/garden/${gardenId}/advice`;

      const resp = await fetch(url, {
        headers,
        credentials: "same-origin",
      });

      if (resp.ok) {
        const data = await resp.json();
        if (data?.ok && data.advice) {
          setAdvice(data.advice);
        } else if (data?.message) {
          setAdviceError(data.message);
        }
      } else {
        const data = await resp.json().catch(() => ({}));
        setAdviceError(data?.error || "Failed to load advice");
      }
    } catch (err: any) {
      console.warn("[Analytics] Failed to fetch advice:", err);
      setAdviceError(err?.message || "Failed to load advice");
    } finally {
      setAdviceLoading(false);
    }
  }, [gardenId, isEligibleForAdvice]);

  // Export analysis as a file
  const exportAnalysis = React.useCallback(async (format: "json" | "md" | "txt") => {
    setExporting(true);
    try {
      const session = (await supabase.auth.getSession()).data.session;
      const token = session?.access_token;
      const headers: Record<string, string> = { Accept: "*/*" };
      if (token) headers["Authorization"] = `Bearer ${token}`;

      const resp = await fetch(`/api/garden/${gardenId}/advice/export?format=${format}`, {
        headers,
        credentials: "same-origin",
      });

      if (!resp.ok) {
        throw new Error("Failed to export analysis");
      }

      // Get filename from Content-Disposition header or create default
      const contentDisposition = resp.headers.get("Content-Disposition");
      let filename = `garden-analysis.${format}`;
      if (contentDisposition) {
        const match = contentDisposition.match(/filename="?([^";\n]+)"?/);
        if (match) filename = match[1];
      }

      // Download the file
      const blob = await resp.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      
      setExportMenuOpen(false);
    } catch (err: any) {
      console.error("[Analytics] Export failed:", err);
      alert(t("gardenDashboard.analyticsSection.exportError", { defaultValue: "Failed to export analysis" }));
    } finally {
      setExporting(false);
    }
  }, [gardenId, t]);

  React.useEffect(() => {
    fetchAnalytics();
  }, [fetchAnalytics]);

  React.useEffect(() => {
    if (isEligibleForAdvice) {
      fetchAdvice();
    }
  }, [isEligibleForAdvice, fetchAdvice]);

  // Merge server analytics with computed analytics to ensure all fields are present
  const analytics = React.useMemo(() => {
    if (!computedAnalytics) return analyticsData;
    if (!analyticsData) return computedAnalytics;
    // Merge: prefer server data but fall back to computed for missing fields
    return {
      ...computedAnalytics,
      ...analyticsData,
      // Ensure streakInfo is always present (server might not send it)
      streakInfo: analyticsData.streakInfo || computedAnalytics.streakInfo,
      weeklyStats: analyticsData.weeklyStats || computedAnalytics.weeklyStats,
      plantStats: analyticsData.plantStats || computedAnalytics.plantStats,
    };
  }, [analyticsData, computedAnalytics]);

  if (!analytics) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center space-y-4">
          <Loader2 className="w-8 h-8 animate-spin mx-auto text-emerald-500" />
          <p className="text-sm text-muted-foreground">
            {t("gardenDashboard.analyticsSection.loading", { defaultValue: "Loading analytics..." })}
          </p>
        </div>
      </div>
    );
  }

  // Custom tooltip for charts
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload?.length) return null;
    return (
      <div className="bg-white dark:bg-[#1f1f1f] rounded-xl shadow-lg border border-stone-200 dark:border-stone-700 p-3 min-w-[140px]">
        <p className="text-sm font-medium mb-1">{label}</p>
        {payload.map((entry: any, idx: number) => (
          <p key={idx} className="text-xs" style={{ color: entry.color }}>
            {entry.name}: {entry.value}
          </p>
        ))}
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* Header with title and tabs */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <BarChart3 className="w-6 h-6 text-emerald-500" />
            {t("gardenDashboard.analyticsSection.title", { defaultValue: "Analytics & Insights" })}
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            {t("gardenDashboard.analyticsSection.subtitle", { defaultValue: "Track your garden's progress and health" })}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex bg-stone-100 dark:bg-stone-800 rounded-xl p-1">
            {(["overview", "tasks", "plants", "members"] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-3 py-1.5 text-sm font-medium rounded-lg transition-all ${
                  activeTab === tab
                    ? "bg-white dark:bg-stone-700 shadow-sm text-emerald-600 dark:text-emerald-400"
                    : "text-stone-600 dark:text-stone-400 hover:text-stone-900 dark:hover:text-stone-200"
                }`}
              >
                {t(`gardenDashboard.analyticsSection.tabs.${tab}`, { defaultValue: tab.charAt(0).toUpperCase() + tab.slice(1) })}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Overview Tab */}
      <AnimatePresence mode="wait">
        {activeTab === "overview" && (
          <motion.div
            key="overview"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
            className="space-y-6"
          >
            {/* Quick Stats Grid */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              {/* Completion Rate */}
              <Card className="rounded-[28px] border border-stone-200/70 dark:border-[#3e3e42]/70 bg-gradient-to-br from-emerald-50 to-teal-50 dark:from-emerald-900/20 dark:to-teal-900/20 p-5 relative overflow-hidden">
                <div className="absolute -right-4 -top-4 w-24 h-24 bg-emerald-200/30 dark:bg-emerald-500/10 rounded-full blur-2xl" />
                <div className="relative">
                  <div className="flex items-center gap-2 text-sm text-emerald-700 dark:text-emerald-300 mb-2">
                    <Target className="w-4 h-4" />
                    {t("gardenDashboard.analyticsSection.completionRate", { defaultValue: "Completion Rate" })}
                  </div>
                  <div className="text-3xl font-bold text-emerald-600 dark:text-emerald-400">
                    {analytics.weeklyStats.completionRate}%
                  </div>
                  <div className="flex items-center gap-1 mt-1 text-xs">
                    {analytics.weeklyStats.trend === "up" ? (
                      <>
                        <TrendingUp className="w-3 h-3 text-emerald-500" />
                        <span className="text-emerald-500">+{analytics.weeklyStats.trendValue}%</span>
                      </>
                    ) : analytics.weeklyStats.trend === "down" ? (
                      <>
                        <TrendingDown className="w-3 h-3 text-red-500" />
                        <span className="text-red-500">-{analytics.weeklyStats.trendValue}%</span>
                      </>
                    ) : (
                      <span className="text-stone-500">{t("gardenDashboard.analyticsSection.stable", { defaultValue: "Stable" })}</span>
                    )}
                    <span className="text-stone-400">{t("gardenDashboard.analyticsSection.vsLastWeek", { defaultValue: "vs last week" })}</span>
                  </div>
                </div>
              </Card>

              {/* Current Streak */}
              <Card className="rounded-[28px] border border-stone-200/70 dark:border-[#3e3e42]/70 bg-gradient-to-br from-orange-50 to-amber-50 dark:from-orange-900/20 dark:to-amber-900/20 p-5 relative overflow-hidden">
                <div className="absolute -right-4 -top-4 w-24 h-24 bg-orange-200/30 dark:bg-orange-500/10 rounded-full blur-2xl" />
                <div className="relative">
                  <div className="flex items-center gap-2 text-sm text-orange-700 dark:text-orange-300 mb-2">
                    <Flame className="w-4 h-4" />
                    {t("gardenDashboard.analyticsSection.currentStreak", { defaultValue: "Current Streak" })}
                  </div>
                  <div className="text-3xl font-bold text-orange-600 dark:text-orange-400">
                    {analytics.streakInfo?.current ?? 0}
                  </div>
                  <div className="text-xs text-stone-500 mt-1">
                    {t("gardenDashboard.analyticsSection.bestStreak", { defaultValue: "Best:" })} {analytics.streakInfo?.best ?? 0} {t("gardenDashboard.analyticsSection.days", { defaultValue: "days" })}
                  </div>
                </div>
              </Card>

              {/* Tasks This Week */}
              <Card className="rounded-[28px] border border-stone-200/70 dark:border-[#3e3e42]/70 bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 p-5 relative overflow-hidden">
                <div className="absolute -right-4 -top-4 w-24 h-24 bg-blue-200/30 dark:bg-blue-500/10 rounded-full blur-2xl" />
                <div className="relative">
                  <div className="flex items-center gap-2 text-sm text-blue-700 dark:text-blue-300 mb-2">
                    <Activity className="w-4 h-4" />
                    {t("gardenDashboard.analyticsSection.thisWeek", { defaultValue: "This Week" })}
                  </div>
                  <div className="text-3xl font-bold text-blue-600 dark:text-blue-400">
                    {analytics.weeklyStats?.tasksCompleted ?? 0}
                  </div>
                  <div className="text-xs text-stone-500 mt-1">
                    {t("gardenDashboard.analyticsSection.of", { defaultValue: "of" })} {analytics.weeklyStats?.tasksDue ?? 0} {t("gardenDashboard.analyticsSection.tasks", { defaultValue: "tasks" })}
                  </div>
                </div>
              </Card>

              {/* Plants Health */}
              <Card className="rounded-[28px] border border-stone-200/70 dark:border-[#3e3e42]/70 bg-gradient-to-br from-purple-50 to-pink-50 dark:from-purple-900/20 dark:to-pink-900/20 p-5 relative overflow-hidden">
                <div className="absolute -right-4 -top-4 w-24 h-24 bg-purple-200/30 dark:bg-purple-500/10 rounded-full blur-2xl" />
                <div className="relative">
                  <div className="flex items-center gap-2 text-sm text-purple-700 dark:text-purple-300 mb-2">
                    <Leaf className="w-4 h-4" />
                    {t("gardenDashboard.analyticsSection.plants", { defaultValue: "Plants" })}
                  </div>
                  <div className="text-3xl font-bold text-purple-600 dark:text-purple-400">
                    {analytics.plantStats?.total ?? 0}
                  </div>
                  <div className="text-xs text-stone-500 mt-1">
                    {analytics.plantStats?.species ?? 0} {t("gardenDashboard.analyticsSection.species", { defaultValue: "species" })}
                  </div>
                </div>
              </Card>
            </div>

            {/* Main Charts Row */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* 30-Day Activity Chart */}
              <Card className="rounded-[28px] border border-stone-200/70 dark:border-[#3e3e42]/70 bg-white/80 dark:bg-[#1f1f1f]/80 backdrop-blur p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-semibold text-lg flex items-center gap-2">
                    <Calendar className="w-5 h-5 text-emerald-500" />
                    {t("gardenDashboard.analyticsSection.activityHistory", { defaultValue: "Activity History" })}
                  </h3>
                  <span className="text-xs text-muted-foreground">
                    {t("gardenDashboard.analyticsSection.last30Days", { defaultValue: "Last 30 days" })}
                  </span>
                </div>
                <ChartSuspense>
                  <ResponsiveContainer width="100%" height={200}>
                    <ComposedChart
                      data={analytics.dailyStats.slice(-30).map((d) => ({
                        date: new Date(d.date).toLocaleDateString(undefined, { month: "short", day: "numeric" }),
                        completed: d.completed,
                        due: d.due,
                      }))}
                      margin={{ top: 5, right: 5, left: -20, bottom: 5 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" className="stroke-stone-200 dark:stroke-stone-700" />
                      <XAxis 
                        dataKey="date" 
                        tick={{ fontSize: 10 }} 
                        className="text-stone-500"
                        interval={4}
                      />
                      <YAxis tick={{ fontSize: 10 }} className="text-stone-500" />
                      <Tooltip content={<CustomTooltip />} />
                      <Area
                        type="monotone"
                        dataKey="due"
                        name={t("gardenDashboard.analyticsSection.due", { defaultValue: "Due" })}
                        fill={CHART_COLORS.muted}
                        fillOpacity={0.2}
                        stroke={CHART_COLORS.muted}
                        strokeWidth={2}
                      />
                      <Line
                        type="monotone"
                        dataKey="completed"
                        name={t("gardenDashboard.analyticsSection.completed", { defaultValue: "Completed" })}
                        stroke={CHART_COLORS.primary}
                        strokeWidth={3}
                        dot={{ r: 2 }}
                        activeDot={{ r: 4 }}
                      />
                    </ComposedChart>
                  </ResponsiveContainer>
                </ChartSuspense>
              </Card>

              {/* Task Type Distribution */}
              <Card className="rounded-[28px] border border-stone-200/70 dark:border-[#3e3e42]/70 bg-white/80 dark:bg-[#1f1f1f]/80 backdrop-blur p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-semibold text-lg flex items-center gap-2">
                    <Sparkles className="w-5 h-5 text-purple-500" />
                    {t("gardenDashboard.analyticsSection.taskBreakdown", { defaultValue: "Task Breakdown" })}
                  </h3>
                </div>
                <div className="flex items-center gap-6">
                  <ChartSuspense>
                    <div className="w-32 h-32">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={[
                              { name: "Water", value: analytics.weeklyStats.tasksByType.water, fill: CHART_COLORS.water },
                              { name: "Fertilize", value: analytics.weeklyStats.tasksByType.fertilize, fill: CHART_COLORS.fertilize },
                              { name: "Harvest", value: analytics.weeklyStats.tasksByType.harvest, fill: CHART_COLORS.harvest },
                              { name: "Cut", value: analytics.weeklyStats.tasksByType.cut, fill: CHART_COLORS.cut },
                              { name: "Custom", value: analytics.weeklyStats.tasksByType.custom, fill: CHART_COLORS.custom },
                            ].filter((d) => d.value > 0)}
                            cx="50%"
                            cy="50%"
                            innerRadius={35}
                            outerRadius={55}
                            paddingAngle={3}
                            dataKey="value"
                          >
                            {[CHART_COLORS.water, CHART_COLORS.fertilize, CHART_COLORS.harvest, CHART_COLORS.cut, CHART_COLORS.custom].map((color, index) => (
                              <Cell key={`cell-${index}`} fill={color} />
                            ))}
                          </Pie>
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                  </ChartSuspense>
                  <div className="flex-1 space-y-2">
                    {[
                      { key: "water", label: t("garden.taskTypes.water", { defaultValue: "Water" }), icon: Droplets, color: CHART_COLORS.water },
                      { key: "fertilize", label: t("garden.taskTypes.fertilize", { defaultValue: "Fertilize" }), icon: Leaf, color: CHART_COLORS.fertilize },
                      { key: "harvest", label: t("garden.taskTypes.harvest", { defaultValue: "Harvest" }), icon: Award, color: CHART_COLORS.harvest },
                      { key: "cut", label: t("garden.taskTypes.cut", { defaultValue: "Cut" }), icon: Scissors, color: CHART_COLORS.cut },
                      { key: "custom", label: t("garden.taskTypes.custom", { defaultValue: "Custom" }), icon: Sparkles, color: CHART_COLORS.custom },
                    ].map(({ key, label, icon: Icon, color }) => (
                      <div key={key} className="flex items-center justify-between text-sm">
                        <div className="flex items-center gap-2">
                          <div className="w-3 h-3 rounded-full" style={{ backgroundColor: color }} />
                          <Icon className="w-4 h-4" style={{ color }} />
                          <span>{label}</span>
                        </div>
                        <span className="font-medium">
                          {analytics.weeklyStats.tasksByType[key as keyof typeof analytics.weeklyStats.tasksByType]}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </Card>
            </div>

            {/* Gardener Advice Section */}
            <Card className="rounded-[28px] border border-stone-200/70 dark:border-[#3e3e42]/70 bg-gradient-to-br from-amber-50/50 via-white to-emerald-50/50 dark:from-amber-900/10 dark:via-[#1f1f1f] dark:to-emerald-900/10 backdrop-blur p-6 relative overflow-hidden">
              <div className="absolute -right-10 -top-10 w-40 h-40 bg-gradient-to-br from-amber-200/30 to-emerald-200/30 dark:from-amber-500/10 dark:to-emerald-500/10 rounded-full blur-3xl" />
              <div className="relative">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-semibold text-lg flex items-center gap-2">
                    <span className="text-2xl">🧑‍🌾</span>
                    {t("gardenDashboard.analyticsSection.gardenerAdvice", { defaultValue: "Gardener Advice" })}
                  </h3>
                  {isEligibleForAdvice && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="rounded-xl text-xs"
                      onClick={() => fetchAdvice(true)}
                      disabled={adviceLoading}
                    >
                      {adviceLoading ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <RefreshCw className="w-4 h-4" />
                      )}
                    </Button>
                  )}
                </div>

                {!isEligibleForAdvice ? (
                  <div className="text-center py-6">
                    <div className="w-16 h-16 rounded-full bg-stone-100 dark:bg-stone-800 flex items-center justify-center mx-auto mb-3">
                      <Info className="w-8 h-8 text-stone-400" />
                    </div>
                    <p className="text-sm text-muted-foreground max-w-md mx-auto">
                      {gardenAgeInDays < 7
                        ? t("gardenDashboard.analyticsSection.adviceRequiresAge", { 
                            defaultValue: "Your garden needs to be at least 1 week old to receive personalized advice. Come back in {{days}} days!",
                            days: 7 - gardenAgeInDays,
                          })
                        : t("gardenDashboard.analyticsSection.adviceRequiresPlants", { 
                            defaultValue: "Add at least 1 plant to your garden to receive personalized gardening advice.",
                          })
                      }
                    </p>
                  </div>
                ) : adviceLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="w-6 h-6 animate-spin text-emerald-500 mr-2" />
                    <span className="text-sm text-muted-foreground">
                      {t("gardenDashboard.analyticsSection.generatingAdvice", { defaultValue: "Analyzing your garden..." })}
                    </span>
                  </div>
                ) : adviceError ? (
                  <div className="text-center py-6">
                    <div className="w-12 h-12 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center mx-auto mb-3">
                      <AlertCircle className="w-6 h-6 text-red-500" />
                    </div>
                    <p className="text-sm text-red-600 dark:text-red-400">{adviceError}</p>
                    <Button
                      variant="outline"
                      size="sm"
                      className="mt-3 rounded-xl"
                      onClick={() => fetchAdvice(true)}
                    >
                      {t("gardenDashboard.analyticsSection.tryAgain", { defaultValue: "Try Again" })}
                    </Button>
                  </div>
                ) : advice ? (
                  <div className="space-y-5">
                    {/* Location & Weather Header */}
                    {advice.weatherContext && advice.weatherContext.current && (
                      <div className="flex items-center gap-4 p-3 rounded-xl bg-blue-50 dark:bg-blue-900/20 border border-blue-200/50 dark:border-blue-800/50">
                        <div className="flex items-center gap-2">
                          <span className="text-2xl">🌡️</span>
                          <div>
                            <div className="text-lg font-semibold text-blue-700 dark:text-blue-300">
                              {advice.weatherContext.current.temp}°C
                            </div>
                            <div className="text-xs text-blue-600 dark:text-blue-400">
                              {advice.weatherContext.current.condition}
                            </div>
                          </div>
                        </div>
                        {advice.locationContext?.city && (
                          <div className="text-sm text-blue-600 dark:text-blue-400">
                            📍 {advice.locationContext.city}
                            {advice.locationContext.country && `, ${advice.locationContext.country}`}
                          </div>
                        )}
                      </div>
                    )}

                    {/* Summary with Improvement Score */}
                    <div className="flex items-start gap-4">
                      {advice.improvementScore !== null && (
                        <div className="flex-shrink-0 w-16 h-16 rounded-full bg-gradient-to-br from-emerald-400 to-teal-500 flex items-center justify-center shadow-lg">
                          <span className="text-xl font-bold text-white">{advice.improvementScore}</span>
                        </div>
                      )}
                      <div className="flex-1">
                        {advice.adviceSummary && (
                          <p className="text-sm text-stone-700 dark:text-stone-300 leading-relaxed">
                            {advice.adviceSummary}
                          </p>
                        )}
                        {advice.encouragement && (
                          <p className="text-sm text-emerald-600 dark:text-emerald-400 mt-2 italic">
                            ✨ {advice.encouragement}
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Weekly Focus */}
                    {advice.weeklyFocus && (
                      <div className="p-4 rounded-xl bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-900/20 dark:to-orange-900/20 border border-amber-200/50 dark:border-amber-800/50">
                        <h4 className="text-sm font-semibold text-amber-700 dark:text-amber-300 flex items-center gap-2 mb-2">
                          🎯 {t("gardenDashboard.analyticsSection.weeklyFocus", { defaultValue: "This Week's Focus" })}
                        </h4>
                        <p className="text-sm text-amber-800 dark:text-amber-200">{advice.weeklyFocus}</p>
                      </div>
                    )}

                    {/* Weather Advice */}
                    {advice.weatherAdvice && (
                      <div className="p-4 rounded-xl bg-gradient-to-r from-sky-50 to-blue-50 dark:from-sky-900/20 dark:to-blue-900/20 border border-sky-200/50 dark:border-sky-800/50">
                        <h4 className="text-sm font-semibold text-sky-700 dark:text-sky-300 flex items-center gap-2 mb-2">
                          🌤️ {t("gardenDashboard.analyticsSection.weatherAdvice", { defaultValue: "Weather-Based Tips" })}
                        </h4>
                        <p className="text-sm text-sky-800 dark:text-sky-200">{advice.weatherAdvice}</p>
                      </div>
                    )}

                    {/* Focus Areas */}
                    {advice.focusAreas && advice.focusAreas.length > 0 && (
                      <div className="space-y-2">
                        <h4 className="text-sm font-medium text-stone-700 dark:text-stone-300">
                          {t("gardenDashboard.analyticsSection.focusAreas", { defaultValue: "Action Items" })}
                        </h4>
                        <div className="grid gap-2">
                          {advice.focusAreas.map((area, idx) => (
                            <div
                              key={idx}
                              className="flex items-center gap-3 p-3 rounded-xl bg-stone-50 dark:bg-stone-800/50 border border-stone-200/50 dark:border-stone-700/50"
                            >
                              <div className="w-6 h-6 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                                {idx + 1}
                              </div>
                              <span className="text-sm text-stone-700 dark:text-stone-300">{area}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Plant-Specific Tips */}
                    {advice.plantSpecificTips && advice.plantSpecificTips.length > 0 && (
                      <div className="space-y-2 pt-2">
                        <h4 className="text-sm font-medium text-stone-700 dark:text-stone-300">
                          {t("gardenDashboard.analyticsSection.plantTips", { defaultValue: "Plant-Specific Tips" })}
                        </h4>
                        <div className="grid gap-2">
                          {advice.plantSpecificTips.map((tip, idx) => (
                            <div
                              key={idx}
                              className={`flex items-start gap-3 p-3 rounded-xl ${
                                tip.priority === "high"
                                  ? "bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800"
                                  : tip.priority === "medium"
                                    ? "bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800"
                                    : "bg-stone-50 dark:bg-stone-800/50 border border-stone-200 dark:border-stone-700"
                              }`}
                            >
                              <div className="flex-shrink-0 mt-0.5">
                                {tip.priority === "high" ? (
                                  <AlertCircle className="w-4 h-4 text-red-500" />
                                ) : tip.priority === "medium" ? (
                                  <Info className="w-4 h-4 text-amber-500" />
                                ) : (
                                  <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                                )}
                              </div>
                              <div className="min-w-0 flex-1">
                                <div className="flex items-center justify-between">
                                  <div className="text-xs font-semibold text-stone-600 dark:text-stone-400">
                                    🌱 {tip.plantName}
                                  </div>
                                  {tip.priority === "high" && (
                                    <span className="text-xs px-2 py-0.5 rounded-full bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400">
                                      Priority
                                    </span>
                                  )}
                                </div>
                                <div className="text-sm text-stone-700 dark:text-stone-300 mt-1">
                                  {tip.tip}
                                </div>
                                {tip.reason && (
                                  <div className="text-xs text-stone-500 dark:text-stone-400 mt-1 italic">
                                    → {tip.reason}
                                  </div>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Full Advice Text */}
                    {advice.adviceText && (
                      <details className="group">
                        <summary className="flex items-center gap-2 text-sm font-medium text-emerald-600 dark:text-emerald-400 cursor-pointer hover:text-emerald-700 dark:hover:text-emerald-300">
                          <ChevronRight className="w-4 h-4 transition-transform group-open:rotate-90" />
                          {t("gardenDashboard.analyticsSection.fullAdvice", { defaultValue: "Read full advice" })}
                        </summary>
                        <div className="mt-3 p-4 rounded-xl bg-white/50 dark:bg-black/20 text-sm text-stone-700 dark:text-stone-300 leading-relaxed whitespace-pre-wrap">
                          {advice.adviceText}
                        </div>
                      </details>
                    )}

                    {/* Generated timestamp and export */}
                    <div className="flex items-center justify-between pt-3 border-t border-stone-200/50 dark:border-stone-700/50">
                      <p className="text-xs text-muted-foreground flex items-center gap-2">
                        <span>
                          {t("gardenDashboard.analyticsSection.generatedOn", { 
                            defaultValue: "Generated on {{date}}",
                            date: new Date(advice.generatedAt).toLocaleDateString(undefined, {
                              weekday: "long",
                              month: "long",
                              day: "numeric",
                            }),
                          })}
                        </span>
                        {advice.weatherContext?.location && (
                          <span className="text-blue-500">• Based on {advice.weatherContext.location} weather</span>
                        )}
                      </p>
                      
                      {/* Export button */}
                      <div className="relative" ref={exportMenuRef}>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="rounded-xl text-xs gap-1.5"
                          onClick={() => setExportMenuOpen(!exportMenuOpen)}
                          disabled={exporting}
                        >
                          {exporting ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            <Download className="w-3.5 h-3.5" />
                          )}
                          {t("gardenDashboard.analyticsSection.export", { defaultValue: "Export" })}
                        </Button>
                        
                        {exportMenuOpen && (
                          <div className="absolute right-0 bottom-full mb-1 z-50 bg-white dark:bg-stone-800 rounded-xl shadow-lg border border-stone-200 dark:border-stone-700 py-1 min-w-[160px]">
                            <button
                              className="w-full px-3 py-2 text-left text-sm hover:bg-stone-100 dark:hover:bg-stone-700 flex items-center gap-2"
                              onClick={() => exportAnalysis("md")}
                            >
                              <FileText className="w-4 h-4 text-emerald-500" />
                              {t("gardenDashboard.analyticsSection.exportMarkdown", { defaultValue: "Markdown (.md)" })}
                            </button>
                            <button
                              className="w-full px-3 py-2 text-left text-sm hover:bg-stone-100 dark:hover:bg-stone-700 flex items-center gap-2"
                              onClick={() => exportAnalysis("txt")}
                            >
                              <FileText className="w-4 h-4 text-blue-500" />
                              {t("gardenDashboard.analyticsSection.exportText", { defaultValue: "Plain Text (.txt)" })}
                            </button>
                            <button
                              className="w-full px-3 py-2 text-left text-sm hover:bg-stone-100 dark:hover:bg-stone-700 flex items-center gap-2"
                              onClick={() => exportAnalysis("json")}
                            >
                              <FileJson className="w-4 h-4 text-orange-500" />
                              {t("gardenDashboard.analyticsSection.exportJson", { defaultValue: "JSON (.json)" })}
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-6 text-sm text-muted-foreground">
                    {t("gardenDashboard.analyticsSection.noAdviceYet", { defaultValue: "No advice generated yet. Check back soon!" })}
                  </div>
                )}
              </div>
            </Card>
          </motion.div>
        )}

        {/* Tasks Tab */}
        {activeTab === "tasks" && (
          <motion.div
            key="tasks"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
            className="space-y-6"
          >
            {/* Weekly Performance */}
            <Card className="rounded-[28px] border border-stone-200/70 dark:border-[#3e3e42]/70 bg-white/80 dark:bg-[#1f1f1f]/80 backdrop-blur p-6">
              <h3 className="font-semibold text-lg flex items-center gap-2 mb-4">
                <Activity className="w-5 h-5 text-blue-500" />
                {t("gardenDashboard.analyticsSection.weeklyPerformance", { defaultValue: "Weekly Performance" })}
              </h3>
              <ChartSuspense>
                <ResponsiveContainer width="100%" height={250}>
                  <BarChart
                    data={analytics.dailyStats.slice(-7).map((d) => ({
                      day: new Date(d.date).toLocaleDateString(undefined, { weekday: "short" }),
                      completed: d.completed,
                      due: d.due - d.completed,
                    }))}
                    margin={{ top: 5, right: 5, left: -20, bottom: 5 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" className="stroke-stone-200 dark:stroke-stone-700" />
                    <XAxis dataKey="day" tick={{ fontSize: 12 }} className="text-stone-500" />
                    <YAxis tick={{ fontSize: 12 }} className="text-stone-500" />
                    <Tooltip content={<CustomTooltip />} />
                    <Bar
                      dataKey="completed"
                      name={t("gardenDashboard.analyticsSection.completed", { defaultValue: "Completed" })}
                      fill={CHART_COLORS.primary}
                      radius={[4, 4, 0, 0]}
                      stackId="stack"
                    />
                    <Bar
                      dataKey="due"
                      name={t("gardenDashboard.analyticsSection.remaining", { defaultValue: "Remaining" })}
                      fill={CHART_COLORS.muted}
                      radius={[4, 4, 0, 0]}
                      stackId="stack"
                    />
                  </BarChart>
                </ResponsiveContainer>
              </ChartSuspense>
            </Card>

            {/* Task Type Trends */}
            <Card className="rounded-[28px] border border-stone-200/70 dark:border-[#3e3e42]/70 bg-white/80 dark:bg-[#1f1f1f]/80 backdrop-blur p-6">
              <h3 className="font-semibold text-lg flex items-center gap-2 mb-4">
                <TrendingUp className="w-5 h-5 text-emerald-500" />
                {t("gardenDashboard.analyticsSection.taskTrends", { defaultValue: "Task Trends" })}
              </h3>
              <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                {[
                  { key: "water", label: t("garden.taskTypes.water", { defaultValue: "Water" }), icon: "💧", color: CHART_COLORS.water },
                  { key: "fertilize", label: t("garden.taskTypes.fertilize", { defaultValue: "Fertilize" }), icon: "🍽️", color: CHART_COLORS.fertilize },
                  { key: "harvest", label: t("garden.taskTypes.harvest", { defaultValue: "Harvest" }), icon: "🌾", color: CHART_COLORS.harvest },
                  { key: "cut", label: t("garden.taskTypes.cut", { defaultValue: "Cut" }), icon: "✂️", color: CHART_COLORS.cut },
                  { key: "custom", label: t("garden.taskTypes.custom", { defaultValue: "Custom" }), icon: "🪴", color: CHART_COLORS.custom },
                ].map(({ key, label, icon, color }) => (
                  <div
                    key={key}
                    className="p-4 rounded-2xl border border-stone-200/50 dark:border-stone-700/50 bg-stone-50/50 dark:bg-stone-800/30"
                  >
                    <div className="text-2xl mb-2">{icon}</div>
                    <div className="text-xs text-muted-foreground">{label}</div>
                    <div className="text-xl font-bold" style={{ color }}>
                      {analytics.weeklyStats.tasksByType[key as keyof typeof analytics.weeklyStats.tasksByType]}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {t("gardenDashboard.analyticsSection.thisWeek", { defaultValue: "this week" })}
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          </motion.div>
        )}

        {/* Plants Tab */}
        {activeTab === "plants" && (
          <motion.div
            key="plants"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
            className="space-y-6"
          >
            {/* Plant Health Overview */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <Card className="rounded-[28px] border border-stone-200/70 dark:border-[#3e3e42]/70 bg-white/80 dark:bg-[#1f1f1f]/80 backdrop-blur p-5 text-center">
                <div className="text-3xl mb-2">🌱</div>
                <div className="text-3xl font-bold text-emerald-600 dark:text-emerald-400">
                  {analytics.plantStats?.total ?? 0}
                </div>
                <div className="text-sm text-muted-foreground">
                  {t("gardenDashboard.analyticsSection.totalPlants", { defaultValue: "Total Plants" })}
                </div>
              </Card>
              <Card className="rounded-[28px] border border-stone-200/70 dark:border-[#3e3e42]/70 bg-white/80 dark:bg-[#1f1f1f]/80 backdrop-blur p-5 text-center">
                <div className="text-3xl mb-2">🌿</div>
                <div className="text-3xl font-bold text-teal-600 dark:text-teal-400">
                  {analytics.plantStats?.species ?? 0}
                </div>
                <div className="text-sm text-muted-foreground">
                  {t("gardenDashboard.analyticsSection.uniqueSpecies", { defaultValue: "Unique Species" })}
                </div>
              </Card>
              <Card className="rounded-[28px] border border-stone-200/70 dark:border-[#3e3e42]/70 bg-white/80 dark:bg-[#1f1f1f]/80 backdrop-blur p-5 text-center">
                <div className="text-3xl mb-2">✅</div>
                <div className="text-3xl font-bold text-green-600 dark:text-green-400">
                  {analytics.plantStats?.healthy ?? 0}
                </div>
                <div className="text-sm text-muted-foreground">
                  {t("gardenDashboard.analyticsSection.healthy", { defaultValue: "Healthy" })}
                </div>
              </Card>
              <Card className="rounded-[28px] border border-stone-200/70 dark:border-[#3e3e42]/70 bg-white/80 dark:bg-[#1f1f1f]/80 backdrop-blur p-5 text-center">
                <div className="text-3xl mb-2">⚠️</div>
                <div className="text-3xl font-bold text-amber-600 dark:text-amber-400">
                  {analytics.plantStats?.needingAttention ?? 0}
                </div>
                <div className="text-sm text-muted-foreground">
                  {t("gardenDashboard.analyticsSection.needsAttention", { defaultValue: "Needs Attention" })}
                </div>
              </Card>
            </div>

            {/* Plant Health Ring */}
            <Card className="rounded-[28px] border border-stone-200/70 dark:border-[#3e3e42]/70 bg-white/80 dark:bg-[#1f1f1f]/80 backdrop-blur p-6">
              <h3 className="font-semibold text-lg flex items-center gap-2 mb-4">
                <Leaf className="w-5 h-5 text-emerald-500" />
                {t("gardenDashboard.analyticsSection.plantHealth", { defaultValue: "Plant Health" })}
              </h3>
              <div className="flex items-center justify-center">
                <ChartSuspense>
                  <ResponsiveContainer width={200} height={200}>
                    <RadialBarChart
                      cx="50%"
                      cy="50%"
                      innerRadius="70%"
                      outerRadius="100%"
                      barSize={20}
                      data={[
                        {
                          name: "Health",
                          value: (analytics.plantStats?.total ?? 0) > 0
                            ? Math.round(((analytics.plantStats?.healthy ?? 0) / (analytics.plantStats?.total ?? 1)) * 100)
                            : 100,
                          fill: CHART_COLORS.primary,
                        },
                      ]}
                      startAngle={90}
                      endAngle={-270}
                    >
                      <PolarAngleAxis type="number" domain={[0, 100]} angleAxisId={0} tick={false} />
                      <RadialBar
                        background
                        dataKey="value"
                        cornerRadius={10}
                      />
                      <text
                        x="50%"
                        y="50%"
                        textAnchor="middle"
                        dominantBaseline="middle"
                        className="fill-current text-3xl font-bold"
                      >
                        {(analytics.plantStats?.total ?? 0) > 0
                          ? Math.round(((analytics.plantStats?.healthy ?? 0) / (analytics.plantStats?.total ?? 1)) * 100)
                          : 100}%
                      </text>
                    </RadialBarChart>
                  </ResponsiveContainer>
                </ChartSuspense>
              </div>
            </Card>
          </motion.div>
        )}

        {/* Members Tab */}
        {activeTab === "members" && (
          <motion.div
            key="members"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
            className="space-y-6"
          >
            {/* Member Contributions */}
            <Card className="rounded-[28px] border border-stone-200/70 dark:border-[#3e3e42]/70 bg-white/80 dark:bg-[#1f1f1f]/80 backdrop-blur p-6">
              <h3 className="font-semibold text-lg flex items-center gap-2 mb-4">
                <Users className="w-5 h-5 text-blue-500" />
                {t("gardenDashboard.analyticsSection.memberContributions", { defaultValue: "Member Contributions" })}
              </h3>
              {analytics.memberContributions.length > 1 ? (
                <>
                  <div className="flex items-center gap-6 mb-6">
                    <ChartSuspense>
                      <div className="w-32 h-32">
                        <ResponsiveContainer width="100%" height="100%">
                          <PieChart>
                            <Pie
                              data={analytics.memberContributions.map((m) => ({
                                name: m.displayName,
                                value: m.tasksCompleted,
                                fill: m.color,
                              }))}
                              cx="50%"
                              cy="50%"
                              innerRadius={35}
                              outerRadius={55}
                              paddingAngle={3}
                              dataKey="value"
                            >
                              {analytics.memberContributions.map((m, index) => (
                                <Cell key={`cell-${index}`} fill={m.color} />
                              ))}
                            </Pie>
                          </PieChart>
                        </ResponsiveContainer>
                      </div>
                    </ChartSuspense>
                    <div className="flex-1 space-y-3">
                      {analytics.memberContributions.map((member, idx) => (
                        <div key={member.userId} className="flex items-center gap-3">
                          <div
                            className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold"
                            style={{ backgroundColor: member.color }}
                          >
                            {member.displayName.slice(0, 2).toUpperCase()}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="text-sm font-medium truncate">{member.displayName}</div>
                            <div className="flex items-center gap-2">
                              <div className="h-2 flex-1 bg-stone-200 dark:bg-stone-700 rounded-full overflow-hidden">
                                <div
                                  className="h-full rounded-full transition-all"
                                  style={{
                                    width: `${member.percentage}%`,
                                    backgroundColor: member.color,
                                  }}
                                />
                              </div>
                              <span className="text-xs text-muted-foreground w-12 text-right">
                                {member.tasksCompleted}
                              </span>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </>
              ) : (
                <div className="text-center py-8">
                  <div className="text-4xl mb-3">👤</div>
                  <p className="text-sm text-muted-foreground">
                    {t("gardenDashboard.analyticsSection.soloGardener", { defaultValue: "You're the only gardener here. Invite friends to track contributions!" })}
                  </p>
                </div>
              )}
            </Card>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default GardenAnalyticsSection;
