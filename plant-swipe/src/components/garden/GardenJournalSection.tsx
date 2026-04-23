import React from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ErrorBanner } from "@/components/ui/error-banner";
import { PillTabs } from "@/components/ui/pill-tabs";
import { useImageViewer, ImageViewer } from "@/components/ui/image-viewer";
import { ImageUploadArea } from "@/components/ui/image-upload-area";
import { ImageSourcePicker } from "@/components/ui/image-source-picker";
import { CameraCapture } from "@/components/messaging/CameraCapture";
import { useImageUpload } from "@/hooks/useImageUpload";
import { useTranslation } from "react-i18next";
import { supabase } from "@/lib/supabaseClient";
import { useAuth } from "@/context/AuthContext";
import { useLocation } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  Plus,
  Calendar,
  Camera,
  Pencil,
  Trash2,
  ChevronLeft,
  ChevronRight,
  Loader2,
  CheckCircle2,
  X,
  Lock,
  Globe,
  Play,
  Pause,
  Download,
  Film,
  Images,
  ArrowUpDown,
  Sprout,
  Search,
} from "lucide-react";
import type { Garden } from "@/types/garden";
import { getPrimaryPhotoUrl } from "@/lib/photos";

// Types
interface JournalEntry {
  id: string;
  gardenId: string;
  userId: string;
  entryDate: string;
  title: string | null;
  content: string;
  mood: "great" | "good" | "neutral" | "concerned" | "struggling" | null;
  weatherSnapshot: {
    temp?: number;
    condition?: string;
    humidity?: number;
    icon?: string;
  };
  plantsMentioned: string[];
  tags: string[];
  isPrivate: boolean;
  photos: JournalPhoto[];
  createdAt: string;
  updatedAt: string;
}

interface JournalPhoto {
  id: string;
  entryId: string;
  gardenPlantId: string | null;
  imageUrl: string;
  thumbnailUrl: string | null;
  caption: string | null;
  plantHealth: "thriving" | "healthy" | "okay" | "struggling" | "critical" | null;
  observations: string | null;
  takenAt: string | null;
  uploadedAt: string;
}

interface GardenPlantInfo {
  id: string;
  nickname?: string | null;
  plantId?: string;
  gardenPlantImageUrl?: string | null;
  healthStatus?: string | null;
  plant?: {
    id?: string;
    name?: string;
    image?: string | null;
    photos?: Array<{ link: string; use: string }>;
  };
  [key: string]: unknown;
}

interface GardenJournalSectionProps {
  gardenId: string;
  garden: Garden | null;
  plants: GardenPlantInfo[];
  members: Array<{
    userId: string;
    displayName?: string | null;
    role: "owner" | "member";
  }>;
}

// Garden-themed mood configuration
const MOODS = [
  { key: "blooming", emoji: "🌸", label: "Blooming", color: "text-pink-500", bg: "bg-pink-100 dark:bg-pink-900/30", desc: "Peak beauty" },
  { key: "thriving", emoji: "🌿", label: "Thriving", color: "text-emerald-500", bg: "bg-emerald-100 dark:bg-emerald-900/30", desc: "Growing strong" },
  { key: "sprouting", emoji: "🌱", label: "Sprouting", color: "text-lime-500", bg: "bg-lime-100 dark:bg-lime-900/30", desc: "New growth" },
  { key: "resting", emoji: "🍂", label: "Resting", color: "text-amber-600", bg: "bg-amber-100 dark:bg-amber-900/30", desc: "Seasonal pause" },
  { key: "wilting", emoji: "🥀", label: "Needs Care", color: "text-red-500", bg: "bg-red-100 dark:bg-red-900/30", desc: "Attention needed" },
];

const PLANT_HEALTH = [
  { key: "thriving", emoji: "🌱", label: "Thriving", color: "text-emerald-600" },
  { key: "healthy", emoji: "✅", label: "Healthy", color: "text-green-500" },
  { key: "okay", emoji: "😐", label: "Okay", color: "text-yellow-500" },
  { key: "struggling", emoji: "⚠️", label: "Struggling", color: "text-orange-500" },
  { key: "critical", emoji: "🆘", label: "Critical", color: "text-red-500" },
];

export const GardenJournalSection: React.FC<GardenJournalSectionProps> = ({
  gardenId,
  garden,
  plants: _plants,
  members: _members,
}) => {
  const { t } = useTranslation("common");
  const { user } = useAuth();
  const location = useLocation();

  // Tab state
  type JournalView = "journal" | "library";
  const [activeView, setActiveView] = React.useState<JournalView>("journal");
  const journalTabs = React.useMemo(() => [
    { key: "journal" as const, label: t("gardenDashboard.journalSection.journalTab", "Journal") },
    { key: "library" as const, label: t("gardenDashboard.journalSection.libraryTab", "Library") },
  ], [t]);

  // Owner check
  const isOwner = React.useMemo(
    () => _members.some((m) => m.userId === user?.id && m.role === "owner"),
    [_members, user?.id],
  );

  // Sort state
  type SortOrder = "newest" | "oldest";
  const [journalSort, setJournalSort] = React.useState<SortOrder>("newest");
  const [librarySort, setLibrarySort] = React.useState<SortOrder>("newest");

  // Filter & search state
  const [filterPlantId, setFilterPlantId] = React.useState<string | null>(null);
  const [searchQuery, setSearchQuery] = React.useState("");
  const [selectedBucket, setSelectedBucket] = React.useState<string | null>(null);
  const dateRefs = React.useRef<Map<string, HTMLDivElement>>(new Map());

  // State
  const [loading, setLoading] = React.useState(true);
  const [entries, setEntries] = React.useState<JournalEntry[]>([]);
  const [fetchError, setFetchError] = React.useState<string | null>(null);
  const [_selectedDate, _setSelectedDate] = React.useState<Date>(new Date());
  const [isEditing, setIsEditing] = React.useState(false);
  const [editingEntry, setEditingEntry] = React.useState<JournalEntry | null>(null);
  const [showNewEntry, setShowNewEntry] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  
  // Entry form state
  const [entryTitle, setEntryTitle] = React.useState("");
  const [entryContent, setEntryContent] = React.useState("");
  const [entryMood, setEntryMood] = React.useState<string | null>(null);
  const [entryIsPrivate, setEntryIsPrivate] = React.useState(false);
  const [entryTags, setEntryTags] = React.useState<string[]>([]);
  const [selectedPlantIds, setSelectedPlantIds] = React.useState<Set<string>>(new Set());
  const [entryHealthStatus, setEntryHealthStatus] = React.useState<string | null>(null);
  // Shared image upload hook – handles file picking, validation, preview & upload
  const imageUpload = useImageUpload({ maxFiles: 10, multiple: true });
  // Shared source picker (camera vs library)
  const [sourcePickerOpen, setSourcePickerOpen] = React.useState(false);
  const [cameraOpen, setCameraOpen] = React.useState(false);

  // Get today's entry if exists
  const todayEntry = React.useMemo(() => {
    const todayIso = new Date().toISOString().slice(0, 10);
    return entries.find((e) => e.entryDate === todayIso);
  }, [entries]);

  // Timelapse state
  const [showTimelapse, setShowTimelapse] = React.useState(false);
  const [timelapseIndex, setTimelapseIndex] = React.useState(0);
  const [isPlaying, setIsPlaying] = React.useState(false);
  const [timelapseSpeed, setTimelapseSpeed] = React.useState(2000); // ms per frame
  const timelapseRef = React.useRef<NodeJS.Timeout | null>(null);

  // Get all photos sorted by date (oldest first for timelapse)
  const allPhotos = React.useMemo(() => {
    const photos: Array<{
      id: string;
      entryId: string;
      userId: string;
      url: string;
      thumbnailUrl?: string;
      date: string;
      caption?: string;
      entryTitle?: string;
      mood?: string;
      plantHealth?: string | null;
    }> = [];
    
    entries.forEach((entry) => {
      if (entry.photos && entry.photos.length > 0) {
        entry.photos.forEach((photo) => {
          photos.push({
            id: photo.id,
            entryId: entry.id,
            userId: entry.userId,
            url: photo.imageUrl,
            thumbnailUrl: photo.thumbnailUrl || undefined,
            date: entry.entryDate,
            caption: photo.caption || undefined,
            entryTitle: entry.title || undefined,
            mood: entry.mood || undefined,
            plantHealth: photo.plantHealth,
          });
        });
      }
    });
    
    return photos.sort((a, b) => a.date.localeCompare(b.date));
  }, [entries]);

  // Library photos sorted by user preference
  const libraryPhotos = React.useMemo(
    () => librarySort === "newest" ? [...allPhotos].reverse() : [...allPhotos],
    [allPhotos, librarySort],
  );

  // Journal entries sorted by user preference
  // Filtered + sorted entries
  const filteredEntries = React.useMemo(() => {
    let result = entries;
    if (filterPlantId) {
      result = result.filter((e) => e.plantsMentioned?.includes(filterPlantId));
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        (e) =>
          (e.title || "").toLowerCase().includes(q) ||
          e.content.toLowerCase().includes(q),
      );
    }
    return result;
  }, [entries, filterPlantId, searchQuery]);

  const sortedEntries = React.useMemo(
    () => journalSort === "newest"
      ? [...filteredEntries].sort((a, b) => b.entryDate.localeCompare(a.entryDate))
      : [...filteredEntries].sort((a, b) => a.entryDate.localeCompare(b.entryDate)),
    [filteredEntries, journalSort],
  );

  // Detect mobile for month vs week buckets
  const [isMobile, setIsMobile] = React.useState(typeof window !== 'undefined' && window.innerWidth < 640);
  React.useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 640);
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  // Build timeline buckets (weeks on desktop, months on mobile) from ALL entries (not filtered by bucket)
  const timelineBuckets = React.useMemo(() => {
    const now = new Date();
    const today = now.toISOString().slice(0, 10);
    type Bucket = { start: string; end: string; label: string; count: number; plantIds: string[]; isCurrent: boolean };
    const buckets: Bucket[] = [];

    if (isMobile) {
      // Monthly buckets: past 12 months
      for (let m = 11; m >= 0; m--) {
        const d = new Date(now.getFullYear(), now.getMonth() - m, 1);
        const start = d.toISOString().slice(0, 10);
        const endD = new Date(d.getFullYear(), d.getMonth() + 1, 0);
        const end = endD.toISOString().slice(0, 10);
        const label = d.toLocaleString(undefined, { month: "short" });
        const bEntries = filteredEntries.filter((e) => e.entryDate >= start && e.entryDate <= end);
        buckets.push({ start, end, label, count: bEntries.length, plantIds: [...new Set(bEntries.flatMap((e) => e.plantsMentioned || []))], isCurrent: start <= today && today <= end });
      }
    } else {
      // Weekly buckets: past 52 weeks
      const dayOfWeek = (now.getDay() + 6) % 7;
      const thisMonday = new Date(now);
      thisMonday.setDate(thisMonday.getDate() - dayOfWeek);
      thisMonday.setHours(0, 0, 0, 0);
      for (let w = 51; w >= 0; w--) {
        const start = new Date(thisMonday);
        start.setDate(start.getDate() - w * 7);
        const end = new Date(start);
        end.setDate(end.getDate() + 6);
        const startStr = start.toISOString().slice(0, 10);
        const endStr = end.toISOString().slice(0, 10);
        const bEntries = filteredEntries.filter((e) => e.entryDate >= startStr && e.entryDate <= endStr);
        buckets.push({ start: startStr, end: endStr, label: "", count: bEntries.length, plantIds: [...new Set(bEntries.flatMap((e) => e.plantsMentioned || []))], isCurrent: startStr <= today && today <= endStr });
      }
    }
    return buckets;
  }, [filteredEntries, isMobile]);

  const maxBucketCount = React.useMemo(
    () => Math.max(1, ...timelineBuckets.map((b) => b.count)),
    [timelineBuckets],
  );

  // Toggle a single bucket on/off
  const handleBucketClick = React.useCallback((bucketStart: string, hasEntries: boolean) => {
    if (!hasEntries) return;
    setSelectedBucket((prev) => prev === bucketStart ? null : bucketStart);
  }, []);

  // Apply bucket filter on top of sorted entries for display
  const displayEntries = React.useMemo(() => {
    if (!selectedBucket) return sortedEntries;
    const bucket = timelineBuckets.find((b) => b.start === selectedBucket);
    if (!bucket) return sortedEntries;
    return sortedEntries.filter((e) => e.entryDate >= bucket.start && e.entryDate <= bucket.end);
  }, [sortedEntries, selectedBucket, timelineBuckets]);

  // Group entries by date for timeline
  const groupedByDate = React.useMemo(() => {
    const groups: Array<{ date: string; entries: typeof displayEntries }> = [];
    const map = new Map<string, typeof displayEntries>();
    for (const e of displayEntries) {
      const arr = map.get(e.entryDate) || [];
      arr.push(e);
      map.set(e.entryDate, arr);
    }
    for (const [date, ents] of map) {
      groups.push({ date, entries: ents });
    }
    return groups;
  }, [displayEntries]);

  // Image viewer for library
  const libraryViewer = useImageViewer();
  const libraryViewerImages = React.useMemo(
    () => libraryPhotos.map((p) => ({ src: p.url, alt: p.caption || p.entryTitle || "Journal photo" })),
    [libraryPhotos],
  );

  // Short date formatter: "15 Nov 25"
  const formatShortDate = (dateStr: string) => {
    const d = new Date(dateStr);
    const day = d.getDate();
    const month = d.toLocaleString(undefined, { month: "short" });
    const year = String(d.getFullYear()).slice(2);
    return `${day} ${month} ${year}`;
  };

  // Timelapse playback
  React.useEffect(() => {
    if (isPlaying && allPhotos.length > 1) {
      timelapseRef.current = setInterval(() => {
        setTimelapseIndex((prev) => {
          const next = prev + 1;
          if (next >= allPhotos.length) {
            setIsPlaying(false);
            return 0;
          }
          return next;
        });
      }, timelapseSpeed);
    }
    
    return () => {
      if (timelapseRef.current) {
        clearInterval(timelapseRef.current);
      }
    };
  }, [isPlaying, allPhotos.length, timelapseSpeed]);

  // Export state
  const [showExportMenu, setShowExportMenu] = React.useState(false);
  const [exporting, setExporting] = React.useState<'timelapse' | 'montage' | 'zip' | null>(null);
  const [exportProgress, setExportProgress] = React.useState(0);

  // Download photos as ZIP
  const downloadPhotosAsZip = async () => {
    if (allPhotos.length === 0) return;
    setExporting('zip');
    setExportProgress(0);
    
    try {
      const JSZip = (await import('jszip')).default;
      const zip = new JSZip();
      
      for (let i = 0; i < allPhotos.length; i++) {
        const photo = allPhotos[i];
        try {
          const response = await fetch(photo.url);
          const blob = await response.blob();
          const ext = photo.url.split('.').pop()?.split('?')[0] || 'jpg';
          const filename = `${String(i + 1).padStart(3, '0')}_${photo.date}.${ext}`;
          zip.file(filename, blob);
          setExportProgress(Math.round(((i + 1) / allPhotos.length) * 100));
        } catch (err) {
          console.warn(`Failed to download photo ${i}:`, err);
        }
      }
      
      const content = await zip.generateAsync({ type: 'blob' });
      const url = URL.createObjectURL(content);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${garden?.name || 'garden'}-photos.zip`;
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      setExporting(null);
      setShowExportMenu(false);
    }
  };

  // Generate video (timelapse or montage)
  const generateVideo = async (type: 'timelapse' | 'montage') => {
    if (allPhotos.length === 0) return;
    setExporting(type);
    setExportProgress(0);
    
    const frameDuration = type === 'timelapse' ? 500 : 2000; // ms per frame
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    // Set canvas size (1080p for quality)
    canvas.width = 1920;
    canvas.height = 1080;
    
    try {
      // Load all images first
      const loadedImages: HTMLImageElement[] = [];
      for (let i = 0; i < allPhotos.length; i++) {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        await new Promise<void>((resolve, reject) => {
          img.onload = () => resolve();
          img.onerror = () => reject();
          img.src = allPhotos[i].url;
        });
        loadedImages.push(img);
        setExportProgress(Math.round(((i + 1) / allPhotos.length) * 30)); // 0-30% for loading
      }

      // Setup MediaRecorder
      const stream = canvas.captureStream(30);
      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: 'video/webm;codecs=vp9',
        videoBitsPerSecond: 5000000,
      });
      
      const chunks: Blob[] = [];
      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunks.push(e.data);
      };
      
      mediaRecorder.start();

      // Draw each frame
      for (let i = 0; i < loadedImages.length; i++) {
        const img = loadedImages[i];
        const photo = allPhotos[i];
        
        // Clear canvas with black background
        ctx.fillStyle = '#000';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        
        // Calculate fit dimensions
        const scale = Math.min(canvas.width / img.width, canvas.height / img.height);
        const w = img.width * scale;
        const h = img.height * scale;
        const x = (canvas.width - w) / 2;
        const y = (canvas.height - h) / 2;
        
        // Draw image
        ctx.drawImage(img, x, y, w, h);
        
        // Add date overlay
        ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
        ctx.fillRect(0, canvas.height - 80, canvas.width, 80);
        
        ctx.fillStyle = '#fff';
        ctx.font = 'bold 32px system-ui, sans-serif';
        ctx.textAlign = 'left';
        const dateStr = new Date(photo.date).toLocaleDateString(undefined, {
          weekday: 'long',
          year: 'numeric',
          month: 'long',
          day: 'numeric',
        });
        ctx.fillText(dateStr, 40, canvas.height - 30);
        
        // Add mood emoji
        if (photo.mood) {
          const moodEmoji = MOODS.find(m => m.key === photo.mood)?.emoji || '';
          ctx.font = '48px system-ui, sans-serif';
          ctx.textAlign = 'right';
          ctx.fillText(moodEmoji, canvas.width - 40, canvas.height - 25);
        }
        
        // Add frame counter
        ctx.font = '24px system-ui, sans-serif';
        ctx.textAlign = 'right';
        ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
        ctx.fillText(`${i + 1} / ${loadedImages.length}`, canvas.width - 40, 50);
        
        // Wait for frame duration
        await new Promise(resolve => setTimeout(resolve, frameDuration));
        setExportProgress(30 + Math.round(((i + 1) / loadedImages.length) * 70)); // 30-100%
      }

      // Stop recording and save
      mediaRecorder.stop();
      
      await new Promise<void>(resolve => {
        mediaRecorder.onstop = () => resolve();
      });
      
      const blob = new Blob(chunks, { type: 'video/webm' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${garden?.name || 'garden'}-${type}.webm`;
      a.click();
      URL.revokeObjectURL(url);
      
    } catch (err) {
      console.error('Failed to generate video:', err);
      alert(t("gardenDashboard.journalSection.videoExportError", { defaultValue: "Failed to generate video. Your browser may not support this feature." }));
    } finally {
      setExporting(null);
      setShowExportMenu(false);
    }
  };

  // Fetch journal entries
  const fetchEntries = React.useCallback(async () => {
    if (!gardenId) return;
    setLoading(true);
    setFetchError(null);
    try {
      const session = (await supabase.auth.getSession()).data.session;
      const token = session?.access_token;
      const headers: Record<string, string> = { Accept: "application/json" };
      if (token) headers["Authorization"] = `Bearer ${token}`;

      const resp = await fetch(`/api/garden/${gardenId}/journal`, {
        headers,
        credentials: "same-origin",
      });

      const data = await resp.json().catch(() => null);
      if (resp.ok && data?.ok && data.entries) {
        setEntries(data.entries);
      } else {
        const errMsg = data?.error || `HTTP ${resp.status}`;
        const detail = [data?.code, data?.detail, data?.hint].filter(Boolean).join(" | ");
        setFetchError(detail ? `${errMsg} (${detail})` : errMsg);
        console.error("[Journal] Server error:", data);
      }
    } catch (err) {
      setFetchError(err instanceof Error ? err.message : "Network error");
      console.warn("[Journal] Failed to fetch entries:", err);
    } finally {
      setLoading(false);
    }
  }, [gardenId]);

  React.useEffect(() => {
    fetchEntries();
  }, [fetchEntries]);

  // Open new entry form with a preselected plant when navigated from plant manage dialog
  const preselectedHandled = React.useRef(false);
  React.useEffect(() => {
    const state = location.state as { preselectedPlantId?: string } | null;
    if (state?.preselectedPlantId && !preselectedHandled.current) {
      preselectedHandled.current = true;
      resetForm();
      setSelectedPlantIds(new Set([state.preselectedPlantId]));
      setShowNewEntry(true);
      // Clear the location state so it doesn't re-trigger on re-render
      window.history.replaceState({}, "");
    }
  }, [location.state]);

  // Photo selection & removal are now handled by imageUpload hook

  // Plant selection helpers
  const togglePlant = (plantId: string) => {
    setSelectedPlantIds((prev) => {
      const next = new Set(prev);
      if (next.has(plantId)) next.delete(plantId);
      else next.add(plantId);
      return next;
    });
  };
  const selectAllPlants = () => {
    setSelectedPlantIds(new Set(_plants.map((p) => p.id)));
  };
  const deselectAllPlants = () => {
    setSelectedPlantIds(new Set());
    setEntryHealthStatus(null);
  };

  // Helper to get plant image URL
  const getPlantImageUrl = (gp: GardenPlantInfo): string | null => {
    return (
      gp.gardenPlantImageUrl ||
      (gp.plant?.photos?.length ? getPrimaryPhotoUrl(gp.plant.photos as any) : null) ||
      gp.plant?.image ||
      null
    );
  };

  // Build a map of plant id -> plant info for display in entries
  const plantMap = React.useMemo(() => {
    const map = new Map<string, GardenPlantInfo>();
    for (const p of _plants) map.set(p.id, p);
    return map;
  }, [_plants]);

  // Reset form
  const resetForm = () => {
    setEntryTitle("");
    setEntryContent("");
    setEntryMood(null);
    setEntryIsPrivate(false);
    setEntryTags([]);
    setSelectedPlantIds(new Set());
    setEntryHealthStatus(null);
    imageUpload.clearAll();
    setEditingEntry(null);
    setIsEditing(false);
  };

  // Save entry
  const handleSaveEntry = async () => {
    if (!entryContent.trim() || !gardenId) return;
    setSaving(true);
    try {
      const session = (await supabase.auth.getSession()).data.session;
      const token = session?.access_token;
      const headers: Record<string, string> = { 
        "Content-Type": "application/json",
        Accept: "application/json" 
      };
      if (token) headers["Authorization"] = `Bearer ${token}`;

      // Upload photos via shared hook
      const uploadResults = await imageUpload.uploadAll({
        url: `/api/garden/${gardenId}/upload`,
        headers: { Authorization: headers.Authorization || "" },
        extraFields: { folder: "journal" },
      });
      const uploadedPhotoUrls = uploadResults.map((r) => r.url);

      const entryData = {
        entryId: editingEntry?.id || undefined,
        title: entryTitle.trim() || null,
        content: entryContent.trim(),
        mood: entryMood,
        isPrivate: entryIsPrivate,
        tags: entryTags,
        photos: uploadedPhotoUrls,
        plantsMentioned: Array.from(selectedPlantIds),
        healthStatus: selectedPlantIds.size > 0 ? entryHealthStatus : null,
      };

      const resp = await fetch(`/api/garden/${gardenId}/journal`, {
        method: editingEntry ? "PUT" : "POST",
        headers,
        credentials: "same-origin",
        body: JSON.stringify(entryData),
      });

      const data = await resp.json().catch(() => null);
      if (resp.ok && data?.ok) {
        resetForm();
        setShowNewEntry(false);
        fetchEntries();
      } else {
        const errMsg = data?.error || `HTTP ${resp.status}`;
        const detail = [data?.code, data?.detail, data?.hint].filter(Boolean).join(" | ");
        const fullErr = detail ? `${errMsg} (${detail})` : errMsg;
        alert(t("gardenDashboard.journalSection.saveEntryError", { defaultValue: "Failed to save entry: {{error}}", error: fullErr }));
        console.error("[Journal] Save error:", data);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : t("common.networkError", { defaultValue: "Network error" });
      alert(t("gardenDashboard.journalSection.saveEntryError", { defaultValue: "Failed to save entry: {{error}}", error: msg }));
      console.warn("[Journal] Failed to save entry:", err);
    } finally {
      setSaving(false);
    }
  };

  // Delete entry
  const handleDeleteEntry = async (entryId: string) => {
    if (!confirm(t("gardenDashboard.journalSection.confirmDelete", "Are you sure you want to delete this entry?"))) {
      return;
    }
    
    try {
      const session = (await supabase.auth.getSession()).data.session;
      const token = session?.access_token;
      const headers: Record<string, string> = { Accept: "application/json" };
      if (token) headers["Authorization"] = `Bearer ${token}`;

      const resp = await fetch(`/api/garden/${gardenId}/journal/${entryId}`, {
        method: "DELETE",
        headers,
        credentials: "same-origin",
      });

      if (resp.ok) {
        fetchEntries();
      }
    } catch (err) {
      console.warn("[Journal] Failed to delete entry:", err);
    }
  };


  // Delete a single photo (owner only)
  const [deletingPhotoId, setDeletingPhotoId] = React.useState<string | null>(null);
  const handleDeletePhoto = async (photoId: string) => {
    if (!confirm(t("gardenDashboard.journalSection.confirmDeletePhoto", "Delete this photo? This cannot be undone."))) return;
    setDeletingPhotoId(photoId);
    try {
      const session = (await supabase.auth.getSession()).data.session;
      const token = session?.access_token;
      const headers: Record<string, string> = { Accept: "application/json" };
      if (token) headers["Authorization"] = `Bearer ${token}`;

      const resp = await fetch(`/api/garden/${gardenId}/journal/photo/${photoId}`, {
        method: "DELETE",
        headers,
        credentials: "same-origin",
      });

      const data = await resp.json().catch(() => null);
      if (resp.ok && data?.ok) {
        fetchEntries();
      } else {
        alert(data?.error || t("gardenDashboard.journalSection.deletePhotoError", { defaultValue: "Failed to delete photo" }));
      }
    } catch (err) {
      console.warn("[Journal] Failed to delete photo:", err);
    } finally {
      setDeletingPhotoId(null);
    }
  };

  // Edit entry
  const startEditEntry = (entry: JournalEntry) => {
    setEditingEntry(entry);
    setEntryTitle(entry.title || "");
    setEntryContent(entry.content);
    setEntryMood(entry.mood);
    setEntryIsPrivate(entry.isPrivate);
    setEntryTags(entry.tags || []);
    setSelectedPlantIds(new Set(entry.plantsMentioned || []));
    setEntryHealthStatus(null);
    setIsEditing(true);
    setShowNewEntry(true);
  };

  // Format date for display
  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    
    if (dateStr === today.toISOString().slice(0, 10)) {
      return t("gardenDashboard.journalSection.today", "Today");
    }
    if (dateStr === yesterday.toISOString().slice(0, 10)) {
      return t("gardenDashboard.journalSection.yesterday", "Yesterday");
    }
    return date.toLocaleDateString(undefined, { 
      weekday: "long", 
      month: "long", 
      day: "numeric" 
    });
  };


  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <h2 className="text-xl font-bold flex items-center gap-2">
          <span className="text-2xl">📔</span>
          {t("gardenDashboard.journalSection.title", "Garden Journal")}
        </h2>
        <Button
          onClick={() => { setActiveView("journal"); resetForm(); setShowNewEntry(true); }}
          className="rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 text-white shadow-lg shadow-emerald-500/20 gap-2"
        >
          <Plus className="w-4 h-4" />
          {todayEntry
            ? t("gardenDashboard.journalSection.addNote", "Add Note")
            : t("gardenDashboard.journalSection.writeToday", "Write Today's Entry")}
        </Button>
      </div>

      {/* Activity timeline chart */}
      {!loading && entries.length > 0 && (() => {
        // Pre-compute month spans for desktop labels (mobile puts labels per-bucket)
        const monthSpans: Array<{ label: string; span: number }> = [];
        if (!isMobile) {
          let prevMonth = -1;
          for (const b of timelineBuckets) {
            const m = new Date(b.start).getMonth();
            if (m !== prevMonth) {
              monthSpans.push({ label: new Date(b.start).toLocaleString(undefined, { month: "short" }), span: 1 });
              prevMonth = m;
            } else {
              monthSpans[monthSpans.length - 1].span++;
            }
          }
        }

        return (
          <div className="rounded-2xl border border-stone-200/70 dark:border-stone-700/50 bg-white/80 dark:bg-[#1f1f1f]/80 overflow-hidden px-4 pt-3 pb-2">
            {/* Desktop: month labels spanning their weeks */}
            {!isMobile && (
              <div className="flex mb-2">
                {monthSpans.map((ms, i) => (
                  <div key={i} className="text-center overflow-hidden" style={{ flex: ms.span }}>
                    <span className="text-[10px] font-medium text-stone-400 dark:text-stone-500">{ms.label}</span>
                  </div>
                ))}
              </div>
            )}

            {/* Dots row + mobile labels below each dot */}
            <div className="relative flex items-center" style={{ height: 40 }}>
              {/* Connecting line */}
              <div className="absolute inset-x-0 top-1/2 -translate-y-px h-[2px] rounded-full bg-stone-200 dark:bg-stone-700" />

              {timelineBuckets.map((bucket) => {
                const count = bucket.count;
                const hasEntries = count > 0;
                const isSelected = selectedBucket === bucket.start;
                const dotSize = hasEntries ? Math.max(10, Math.min(28, 10 + Math.round((count / maxBucketCount) * 18))) : 0;

                return (
                  <div
                    key={bucket.start}
                    className={`flex-1 min-w-0 flex justify-center ${hasEntries ? "cursor-pointer" : ""}`}
                    onClick={() => handleBucketClick(bucket.start, hasEntries)}
                  >
                    {hasEntries ? (
                      <div className={`relative z-10 rounded-full transition-all duration-200 flex items-center justify-center ${
                        isSelected
                          ? "bg-emerald-500 shadow-[0_0_12px_4px_rgba(16,185,129,0.3)] ring-[3px] ring-emerald-200/50 dark:ring-emerald-800/50"
                          : bucket.isCurrent
                            ? "bg-emerald-500 hover:scale-110"
                            : "bg-emerald-400/60 dark:bg-emerald-600/40 hover:bg-emerald-500 hover:scale-110"
                      }`} style={{ width: dotSize, height: dotSize }}>
                        {count > 1 && dotSize >= 16 && (
                          <span className="text-[8px] font-bold text-white leading-none">{count}</span>
                        )}
                      </div>
                    ) : (
                      <div className="relative z-10 w-[5px] h-[5px] rounded-full bg-stone-300/60 dark:bg-stone-700/50" />
                    )}
                  </div>
                );
              })}
            </div>

            {/* Mobile: month label under each dot */}
            {isMobile && (
              <div className="flex mt-1">
                {timelineBuckets.map((bucket) => (
                  <div key={bucket.start} className="flex-1 min-w-0 text-center">
                    <span className={`text-[9px] font-medium ${
                      selectedBucket === bucket.start ? "text-emerald-600 dark:text-emerald-400" : "text-stone-400 dark:text-stone-500"
                    }`}>{bucket.label}</span>
                  </div>
                ))}
              </div>
            )}

            {/* Plant avatars for selected bucket — shown below the dots row */}
            {selectedBucket && (() => {
              const bucket = timelineBuckets.find((b) => b.start === selectedBucket);
              if (!bucket || bucket.plantIds.length === 0) return null;
              const bPlants = bucket.plantIds.map((pid) => plantMap.get(pid)).filter(Boolean) as GardenPlantInfo[];
              const show = bPlants.slice(0, 4);
              const extra = bPlants.length - 4;
              return (
                <div className="flex items-center justify-center gap-1 mt-2 pb-1">
                  {show.map((gp) => {
                    const img = getPlantImageUrl(gp);
                    return (
                      <div key={gp.id} className="w-6 h-6 rounded-full border-2 border-white dark:border-[#1f1f1f] overflow-hidden bg-stone-100 dark:bg-stone-800 shadow-sm">
                        {img ? <img src={img} alt={gp.nickname || gp.plant?.name || ""} className="w-full h-full object-cover" /> : <Sprout className="w-3 h-3 m-auto mt-1 text-stone-400" />}
                      </div>
                    );
                  })}
                  {extra > 0 && (
                    <div className="w-6 h-6 rounded-full border-2 border-white dark:border-[#1f1f1f] bg-stone-200 dark:bg-stone-700 flex items-center justify-center shadow-sm">
                      <span className="text-[8px] font-bold text-stone-500 dark:text-stone-400">+{extra}</span>
                    </div>
                  )}
                  <span className="text-[10px] text-stone-400 dark:text-stone-500 ml-1.5">
                    {bucket.count} {bucket.count === 1
                      ? t("gardenDashboard.journalSection.entry", { defaultValue: "entry" })
                      : t("gardenDashboard.journalSection.entries", { defaultValue: "entries" })}
                  </span>
                </div>
              );
            })()}
          </div>
        );
      })()}

      {/* Filter bar: plant chips + search */}
      <div className="space-y-3">
        {/* Plant filter row */}
        {_plants.length > 0 && (
          <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
            <button
              type="button"
              onClick={() => setFilterPlantId(null)}
              className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-medium border transition-all ${
                !filterPlantId
                  ? "border-emerald-400 bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300"
                  : "border-stone-200 dark:border-stone-700 text-stone-500 dark:text-stone-400 hover:border-stone-300"
              }`}
            >
              {t("gardenDashboard.journalSection.allPlants", "All plants")}
            </button>
            {_plants.map((gp) => {
              const imgUrl = getPlantImageUrl(gp);
              const name = gp.nickname || gp.plant?.name || "Plant";
              const active = filterPlantId === gp.id;
              const count = entries.filter((e) => e.plantsMentioned?.includes(gp.id)).length;
              return (
                <button
                  key={gp.id}
                  type="button"
                  onClick={() => setFilterPlantId(active ? null : gp.id)}
                  className={`shrink-0 flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border transition-all ${
                    active
                      ? "border-emerald-400 bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300"
                      : "border-stone-200 dark:border-stone-700 text-stone-500 dark:text-stone-400 hover:border-stone-300"
                  }`}
                >
                  {imgUrl ? (
                    <img src={imgUrl} alt="" className="w-5 h-5 rounded-full object-cover" />
                  ) : (
                    <Sprout className="w-3.5 h-3.5 opacity-50" />
                  )}
                  <span className="truncate max-w-[80px]">{name}</span>
                  {count > 0 && <span className="text-[10px] opacity-60">({count})</span>}
                </button>
              );
            })}
          </div>
        )}

        {/* Search + sort row */}
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={t("gardenDashboard.journalSection.searchEntries", "Search entries...")}
              className="w-full h-9 pl-9 pr-8 rounded-xl border border-stone-200 dark:border-stone-700 bg-white dark:bg-[#1f1f1f] text-sm placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-400"
            />
            {searchQuery && (
              <button type="button" onClick={() => setSearchQuery("")} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-600">
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="shrink-0 rounded-xl gap-1 text-xs text-stone-500 dark:text-stone-400"
            onClick={() => setJournalSort(journalSort === "newest" ? "oldest" : "newest")}
          >
            <ArrowUpDown className="w-3.5 h-3.5" />
            {journalSort === "newest"
              ? t("gardenDashboard.journalSection.newestFirst", "Newest")
              : t("gardenDashboard.journalSection.oldestFirst", "Oldest")}
          </Button>
          {allPhotos.length >= 2 && (
            <Button
              variant="ghost"
              size="sm"
              className="shrink-0 rounded-xl gap-1 text-xs text-rose-500 dark:text-rose-400"
              onClick={() => setShowTimelapse(true)}
            >
              <Film className="w-3.5 h-3.5" />
              {t("gardenDashboard.journalSection.timelapse", "Timelapse")}
            </Button>
          )}
        </div>
      </div>

      {/* Tab navigation */}
      <PillTabs tabs={journalTabs} activeKey={activeView} onTabChange={setActiveView} />

      {/* Timelapse Viewer Modal */}
      <AnimatePresence>
        {showTimelapse && allPhotos.length > 0 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-sm"
            onClick={() => {
              setShowTimelapse(false);
              setIsPlaying(false);
            }}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="relative max-w-4xl w-full mx-4"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Close button */}
              <button
                onClick={() => {
                  setShowTimelapse(false);
                  setIsPlaying(false);
                }}
                className="absolute -top-12 right-0 text-white/80 hover:text-white transition-colors"
                aria-label={t("common.close", "Close")}
                title={t("common.close", "Close")}
              >
                <X className="w-8 h-8" />
              </button>

              {/* Main image */}
              <div className="relative aspect-[4/3] bg-black rounded-2xl overflow-hidden">
                <img
                  src={allPhotos[timelapseIndex]?.url}
                  alt={`Photo ${timelapseIndex + 1}`}
                  className="w-full h-full object-contain"
                />
                
                {/* Photo info overlay */}
                <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/80 to-transparent p-4">
                  <div className="flex items-center justify-between text-white">
                    <div>
                      <div className="text-sm font-medium">
                        {allPhotos[timelapseIndex]?.entryTitle || 
                          new Date(allPhotos[timelapseIndex]?.date).toLocaleDateString(undefined, {
                            weekday: "long",
                            month: "long",
                            day: "numeric",
                            year: "numeric",
                          })
                        }
                      </div>
                      {allPhotos[timelapseIndex]?.caption && (
                        <div className="text-xs text-white/70 mt-1">
                          {allPhotos[timelapseIndex].caption}
                        </div>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      {allPhotos[timelapseIndex]?.mood && (
                        <span className="text-xl">
                          {MOODS.find(m => m.key === allPhotos[timelapseIndex]?.mood)?.emoji}
                        </span>
                      )}
                      <span className="text-sm text-white/70">
                        {timelapseIndex + 1} / {allPhotos.length}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Controls */}
              <div className="flex items-center justify-center gap-4 mt-4">
                {/* Previous */}
                <Button
                  variant="ghost"
                  size="icon"
                  className="text-white hover:bg-white/20 rounded-full"
                  onClick={() => setTimelapseIndex((prev) => Math.max(0, prev - 1))}
                  disabled={timelapseIndex === 0}
                  aria-label={t("common.previous", "Previous")}
                  title={t("common.previous", "Previous")}
                >
                  <ChevronLeft className="w-6 h-6" />
                </Button>

                {/* Play/Pause */}
                <Button
                  variant="ghost"
                  size="icon"
                  className="text-white hover:bg-white/20 rounded-full w-14 h-14"
                  onClick={() => setIsPlaying(!isPlaying)}
                  aria-label={isPlaying ? t("common.pause", "Pause") : t("common.play", "Play")}
                  title={isPlaying ? t("common.pause", "Pause") : t("common.play", "Play")}
                >
                  {isPlaying ? (
                    <Pause className="w-8 h-8" />
                  ) : (
                    <Play className="w-8 h-8 ml-1" />
                  )}
                </Button>

                {/* Next */}
                <Button
                  variant="ghost"
                  size="icon"
                  className="text-white hover:bg-white/20 rounded-full"
                  onClick={() => setTimelapseIndex((prev) => Math.min(allPhotos.length - 1, prev + 1))}
                  disabled={timelapseIndex === allPhotos.length - 1}
                  aria-label={t("common.next", "Next")}
                  title={t("common.next", "Next")}
                >
                  <ChevronRight className="w-6 h-6" />
                </Button>
              </div>

              {/* Speed control and export */}
              <div className="flex items-center justify-between mt-4">
                <div className="flex items-center gap-2 text-white/70">
                  <span className="text-xs">{t("gardenDashboard.journalSection.speed", "Speed")}:</span>
                  <select
                    value={timelapseSpeed}
                    onChange={(e) => setTimelapseSpeed(Number(e.target.value))}
                    className="bg-white/10 border border-white/20 rounded-lg px-2 py-1 text-xs text-white"
                  >
                    <option value={3000}>0.5x</option>
                    <option value={2000}>1x</option>
                    <option value={1000}>2x</option>
                    <option value={500}>4x</option>
                  </select>
                </div>

                <div className="relative">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-white hover:bg-white/20 rounded-xl gap-2"
                    onClick={() => setShowExportMenu(!showExportMenu)}
                  >
                    <Download className="w-4 h-4" />
                    {t("gardenDashboard.journalSection.export", "Export")}
                  </Button>

                  {/* Export Menu */}
                  <AnimatePresence>
                    {showExportMenu && (
                      <motion.div
                        initial={{ opacity: 0, y: 10, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 10, scale: 0.95 }}
                        className="absolute bottom-full right-0 mb-2 w-72 bg-white dark:bg-[#1f1f1f] rounded-2xl shadow-2xl border border-stone-200 dark:border-stone-700 overflow-hidden"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <div className="p-3 border-b border-stone-200 dark:border-stone-700">
                          <h4 className="font-semibold text-stone-900 dark:text-white text-sm">
                            {t("gardenDashboard.journalSection.exportOptions", "Export Options")}
                          </h4>
                          <p className="text-xs text-muted-foreground mt-1">
                            {allPhotos.length} {t("gardenDashboard.journalSection.photosToExport", "photos to export")}
                          </p>
                        </div>

                        <div className="p-2 space-y-1">
                          {/* Timelapse Video */}
                          <button
                            onClick={() => generateVideo('timelapse')}
                            disabled={exporting !== null}
                            className="w-full flex items-start gap-3 p-3 rounded-xl hover:bg-stone-100 dark:hover:bg-stone-800 transition-colors text-left disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500"
                          >
                            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center flex-shrink-0">
                              <Film className="w-5 h-5 text-white" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="font-medium text-stone-900 dark:text-white text-sm">
                                {t("gardenDashboard.journalSection.timelapse", "Timelapse Video")}
                              </div>
                              <div className="text-xs text-muted-foreground">
                                {t("gardenDashboard.journalSection.timelapseDesc", "Fast-paced video to show growth progress")}
                              </div>
                              {exporting === 'timelapse' && (
                                <div className="mt-2">
                                  <div className="h-1.5 bg-stone-200 dark:bg-stone-700 rounded-full overflow-hidden">
                                    <div 
                                      className="h-full bg-purple-500 transition-all" 
                                      style={{ width: `${exportProgress}%` }}
                                    />
                                  </div>
                                </div>
                              )}
                            </div>
                          </button>

                          {/* Montage Video */}
                          <button
                            onClick={() => generateVideo('montage')}
                            disabled={exporting !== null}
                            className="w-full flex items-start gap-3 p-3 rounded-xl hover:bg-stone-100 dark:hover:bg-stone-800 transition-colors text-left disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500"
                          >
                            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500 to-orange-500 flex items-center justify-center flex-shrink-0">
                              <Images className="w-5 h-5 text-white" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="font-medium text-stone-900 dark:text-white text-sm">
                                {t("gardenDashboard.journalSection.montage", "Montage Video")}
                              </div>
                              <div className="text-xs text-muted-foreground">
                                {t("gardenDashboard.journalSection.montageDesc", "Slower slideshow to appreciate each moment")}
                              </div>
                              {exporting === 'montage' && (
                                <div className="mt-2">
                                  <div className="h-1.5 bg-stone-200 dark:bg-stone-700 rounded-full overflow-hidden">
                                    <div 
                                      className="h-full bg-amber-500 transition-all" 
                                      style={{ width: `${exportProgress}%` }}
                                    />
                                  </div>
                                </div>
                              )}
                            </div>
                          </button>

                          {/* ZIP Download */}
                          <button
                            onClick={downloadPhotosAsZip}
                            disabled={exporting !== null}
                            className="w-full flex items-start gap-3 p-3 rounded-xl hover:bg-stone-100 dark:hover:bg-stone-800 transition-colors text-left disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500"
                          >
                            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-500 flex items-center justify-center flex-shrink-0">
                              <Download className="w-5 h-5 text-white" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="font-medium text-stone-900 dark:text-white text-sm">
                                {t("gardenDashboard.journalSection.zipDownload", "ZIP Download")}
                              </div>
                              <div className="text-xs text-muted-foreground">
                                {t("gardenDashboard.journalSection.zipDesc", "Download all photos as numbered files")}
                              </div>
                              {exporting === 'zip' && (
                                <div className="mt-2">
                                  <div className="h-1.5 bg-stone-200 dark:bg-stone-700 rounded-full overflow-hidden">
                                    <div 
                                      className="h-full bg-emerald-500 transition-all" 
                                      style={{ width: `${exportProgress}%` }}
                                    />
                                  </div>
                                </div>
                              )}
                            </div>
                          </button>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </div>

              {/* Thumbnail strip */}
              <div className="mt-4 flex gap-2 overflow-x-auto pb-2 px-1">
                {allPhotos.map((photo, idx) => (
                  <button
                    key={idx}
                    onClick={() => {
                      setTimelapseIndex(idx);
                      setIsPlaying(false);
                    }}
                    className={`flex-shrink-0 w-16 h-16 rounded-lg overflow-hidden border-2 transition-all ${
                      idx === timelapseIndex
                        ? "border-white scale-110 shadow-lg"
                        : "border-transparent opacity-60 hover:opacity-100"
                    }`}
                    aria-label={t("gardenDashboard.journalSection.viewPhoto", { count: idx + 1, defaultValue: `View photo ${idx + 1}` })}
                    title={t("gardenDashboard.journalSection.viewPhoto", { count: idx + 1, defaultValue: `View photo ${idx + 1}` })}
                  >
                    <img
                      src={photo.url}
                      alt={`Thumb ${idx + 1}`}
                      className="w-full h-full object-cover"
                    />
                  </button>
                ))}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ===== JOURNAL TAB ===== */}
      {activeView === "journal" && (
      <>
      {/* New/Edit Entry Form */}
      <AnimatePresence>
        {showNewEntry && (
          <motion.div
            initial={{ opacity: 0, y: -20, height: 0 }}
            animate={{ opacity: 1, y: 0, height: "auto" }}
            exit={{ opacity: 0, y: -20, height: 0 }}
            transition={{ duration: 0.3 }}
          >
            <Card className="rounded-[28px] border-2 border-amber-200 dark:border-amber-800/50 bg-white dark:bg-[#1f1f1f] p-6 shadow-xl shadow-amber-500/5">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-semibold flex items-center gap-2">
                  <Pencil className="w-5 h-5 text-amber-500" />
                  {isEditing 
                    ? t("gardenDashboard.journalSection.editEntry", "Edit Entry")
                    : t("gardenDashboard.journalSection.newEntry", "New Journal Entry")
                  }
                </h3>
                <Button
                  variant="ghost"
                  size="sm"
                  className="rounded-full"
                  onClick={() => {
                    resetForm();
                    setShowNewEntry(false);
                  }}
                  aria-label={t("common.close", "Close")}
                  title={t("common.close", "Close")}
                >
                  <X className="w-5 h-5" />
                </Button>
              </div>

              <div className="space-y-6">
                {/* Date display */}
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Calendar className="w-4 h-4" />
                  {new Date().toLocaleDateString(undefined, {
                    weekday: "long",
                    year: "numeric",
                    month: "long",
                    day: "numeric"
                  })}
                </div>

                {/* Plant picker – prominent circles at the top */}
                {_plants.length > 0 && (
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <label className="text-sm font-medium flex items-center gap-2">
                      <Sprout className="w-4 h-4" />
                      {t("gardenDashboard.journalSection.plantsAbout", "Which plants is this about?")}
                    </label>
                    <button
                      type="button"
                      onClick={selectedPlantIds.size === _plants.length ? deselectAllPlants : selectAllPlants}
                      className="text-xs font-medium text-emerald-600 dark:text-emerald-400 hover:underline"
                    >
                      {selectedPlantIds.size === _plants.length
                        ? t("gardenDashboard.journalSection.deselectAll", "Deselect all")
                        : t("gardenDashboard.journalSection.selectAll", "Select all")}
                    </button>
                  </div>
                  <div className="flex flex-wrap gap-3">
                    {_plants.map((gp) => {
                      const imgUrl = getPlantImageUrl(gp);
                      const name = gp.nickname || gp.plant?.name || "Plant";
                      const selected = selectedPlantIds.has(gp.id);
                      return (
                        <button
                          key={gp.id}
                          type="button"
                          onClick={() => togglePlant(gp.id)}
                          className="flex flex-col items-center gap-1.5 group"
                        >
                          <div className={`relative w-14 h-14 rounded-full overflow-hidden border-2 transition-all ${
                            selected
                              ? "border-emerald-500 shadow-lg shadow-emerald-500/20 scale-110"
                              : "border-stone-200 dark:border-stone-700 group-hover:border-stone-400 dark:group-hover:border-stone-500"
                          }`}>
                            {imgUrl ? (
                              <img src={imgUrl} alt={name} className="w-full h-full object-cover" />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center bg-stone-100 dark:bg-stone-800">
                                <Sprout className="w-6 h-6 text-stone-400" />
                              </div>
                            )}
                            {selected && (
                              <div className="absolute inset-0 bg-emerald-500/20 flex items-center justify-center">
                                <CheckCircle2 className="w-5 h-5 text-white drop-shadow-md" />
                              </div>
                            )}
                          </div>
                          <span className={`text-xs truncate max-w-[72px] ${
                            selected
                              ? "font-semibold text-emerald-700 dark:text-emerald-300"
                              : "text-stone-500 dark:text-stone-400"
                          }`}>{name}</span>
                        </button>
                      );
                    })}
                  </div>

                  {/* Health status selector - shown when plants are selected */}
                  {selectedPlantIds.size > 0 && (
                    <div className="mt-4 p-3 rounded-xl bg-stone-50 dark:bg-stone-800/50 border border-stone-200/50 dark:border-stone-700/50">
                      <label className="text-sm font-medium mb-2 block">
                        {t("gardenDashboard.journalSection.updateHealth", "Update plant health status")}
                      </label>
                      <p className="text-xs text-muted-foreground mb-2">
                        {t("gardenDashboard.journalSection.updateHealthDesc", "Optionally update the health status of the selected plants.")}
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {PLANT_HEALTH.map((h) => (
                          <button
                            key={h.key}
                            type="button"
                            onClick={() => setEntryHealthStatus(entryHealthStatus === h.key ? null : h.key)}
                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-sm transition-all ${
                              entryHealthStatus === h.key
                                ? `border-current ${h.color} bg-white dark:bg-stone-900 shadow-sm font-medium`
                                : "border-stone-200 dark:border-stone-700 text-stone-600 dark:text-stone-400 hover:border-stone-300"
                            }`}
                          >
                            <span>{h.emoji}</span>
                            <span>{t(`gardenDashboard.journalSection.health.${h.key}`, h.label)}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
                )}

                {/* Title (optional) */}
                <div>
                  <label htmlFor="entry-title" className="text-sm font-medium mb-2 block">
                    {t("gardenDashboard.journalSection.titleOptional", "Title (optional)")}
                  </label>
                  <Input
                    id="entry-title"
                    value={entryTitle}
                    onChange={(e) => setEntryTitle(e.target.value)}
                    placeholder={t("gardenDashboard.journalSection.titlePlaceholder", "Give this entry a title...")}
                    className="rounded-xl"
                  />
                </div>

                {/* Content */}
                <div>
                  <label htmlFor="entry-content" className="text-sm font-medium mb-2 block">
                    {t("gardenDashboard.journalSection.observations", "Your observations")}
                  </label>
                  <textarea
                    id="entry-content"
                    value={entryContent}
                    onChange={(e) => setEntryContent(e.target.value)}
                    placeholder={t("gardenDashboard.journalSection.contentPlaceholder", "What did you notice today? How are your plants doing? Any changes, blooms, or concerns?")}
                    className="w-full min-h-[150px] p-4 rounded-xl border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-900 focus:ring-2 focus:ring-amber-500 focus:border-transparent resize-y"
                  />
                </div>

                {/* Photo upload – shared component */}
                <div>
                  <label className="text-sm font-medium mb-2 flex items-center gap-2">
                    <Camera className="w-4 h-4" />
                    {t("gardenDashboard.journalSection.photos", "Photos")}
                  </label>
                  <div className="mt-2">
                    <ImageUploadArea
                      pending={imageUpload.pending}
                      uploading={imageUpload.uploading}
                      error={imageUpload.error}
                      onAdd={() => setSourcePickerOpen(true)}
                      onRemove={imageUpload.removePending}
                      onClearError={imageUpload.clearError}
                      addLabel={t("gardenDashboard.journalSection.addPhoto", "Add")}
                      removeLabel={t("common.remove", "Remove")}
                    />
                    {/* Hidden file input driven by shared hook */}
                    <input {...imageUpload.inputProps} />
                  </div>
                </div>
                {/* Camera vs library source picker */}
                <ImageSourcePicker
                  open={sourcePickerOpen}
                  onOpenChange={setSourcePickerOpen}
                  onCamera={() => setCameraOpen(true)}
                  onLibrary={imageUpload.openFilePicker}
                />
                <CameraCapture
                  open={cameraOpen}
                  onOpenChange={setCameraOpen}
                  onCapture={(file) => {
                    imageUpload.addFile(file);
                    setCameraOpen(false);
                  }}
                />

                {/* Privacy toggle */}
                <div className="flex items-center justify-between p-4 rounded-xl bg-stone-50 dark:bg-stone-800/50">
                  <div className="flex items-center gap-3">
                    {entryIsPrivate ? (
                      <Lock className="w-5 h-5 text-amber-500" />
                    ) : (
                      <Globe className="w-5 h-5 text-emerald-500" />
                    )}
                    <div className="font-medium text-sm">
                      {entryIsPrivate
                        ? t("gardenDashboard.journalSection.privateEntry", "Private")
                        : t("gardenDashboard.journalSection.sharedEntry", "Shared")
                      }
                    </div>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="rounded-xl"
                    onClick={() => setEntryIsPrivate(!entryIsPrivate)}
                  >
                    {entryIsPrivate ? t("gardenDashboard.journalSection.makeShared", "Share") : t("gardenDashboard.journalSection.makePrivate", "Make Private")}
                  </Button>
                </div>

                {/* Submit buttons */}
                <div className="flex items-center justify-end gap-3 pt-4 border-t border-stone-200 dark:border-stone-700">
                  <Button
                    variant="ghost"
                    className="rounded-xl"
                    onClick={() => {
                      resetForm();
                      setShowNewEntry(false);
                    }}
                    disabled={saving}
                  >
                    {t("common.cancel", "Cancel")}
                  </Button>
                  <Button
                    onClick={handleSaveEntry}
                    disabled={!entryContent.trim() || saving}
                    className="rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white gap-2"
                  >
                    {saving || imageUpload.uploading ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        {imageUpload.uploading
                          ? t("gardenDashboard.journalSection.uploadingPhotos", "Uploading photos...")
                          : t("gardenDashboard.journalSection.saving", "Saving...")
                        }
                      </>
                    ) : (
                      <>
                        <CheckCircle2 className="w-4 h-4" />
                        {isEditing 
                          ? t("gardenDashboard.journalSection.updateEntry", "Update Entry")
                          : t("gardenDashboard.journalSection.saveEntry", "Save Entry")
                        }
                      </>
                    )}
                  </Button>
                </div>
              </div>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Journal Entries Timeline */}
      <div>
        {fetchError && (
          <ErrorBanner
            title={t("gardenDashboard.journalSection.fetchError", "Failed to load journal")}
            message={fetchError}
          />
        )}
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-emerald-500" />
          </div>
        ) : !fetchError && entries.length === 0 ? (
          <Card className="rounded-[28px] border border-stone-200/70 dark:border-[#3e3e42]/70 bg-white/80 dark:bg-[#1f1f1f]/80 backdrop-blur p-12 text-center">
            <div className="max-w-md mx-auto">
              <div className="text-6xl mb-4">📝</div>
              <h3 className="text-xl font-semibold mb-2">
                {t("gardenDashboard.journalSection.noEntries", "Your garden journal is empty")}
              </h3>
              <p className="text-muted-foreground mb-6">
                {t("gardenDashboard.journalSection.startJourney", "Start documenting your gardening journey.")}
              </p>
              <Button
                onClick={() => setShowNewEntry(true)}
                className="rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 text-white gap-2"
              >
                <Plus className="w-5 h-5" />
                {t("gardenDashboard.journalSection.writeFirst", "Write Your First Entry")}
              </Button>
            </div>
          </Card>
        ) : displayEntries.length === 0 ? (
          <div className="py-10 text-center text-sm text-muted-foreground">
            {t("gardenDashboard.journalSection.noMatches", "No entries match your filters.")}
          </div>
        ) : (
          /* -------- Date-grouped timeline -------- */
          <div className="relative pl-6 sm:pl-8">
            {/* Timeline spine */}
            <div className="absolute left-[11px] sm:left-[15px] top-2 bottom-2 w-0.5 bg-stone-200 dark:bg-stone-700 rounded-full" />

            {groupedByDate.map((group) => (
              <div key={group.date} ref={(el) => { if (el) dateRefs.current.set(group.date, el); else dateRefs.current.delete(group.date); }} className="relative mb-8 last:mb-0 scroll-mt-4">
                {/* Date dot + label */}
                <div className="absolute -left-6 sm:-left-8 top-0 flex items-center gap-0">
                  <div className="w-[22px] sm:w-[30px] flex justify-center">
                    <div className="w-3 h-3 rounded-full bg-emerald-500 ring-4 ring-white dark:ring-[#121212] shrink-0" />
                  </div>
                </div>
                <div className="mb-3">
                  <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-stone-500 dark:text-stone-400 bg-stone-100 dark:bg-stone-800 px-3 py-1 rounded-full">
                    <Calendar className="w-3 h-3" />
                    {formatDate(group.date)}
                  </span>
                </div>

                {/* Entries for this date */}
                <div className="space-y-4">
                  {group.entries.map((entry) => {
                    const isOwn = entry.userId === user?.id;
                    const entryPlants = (entry.plantsMentioned || []).map((pid: string) => plantMap.get(pid)).filter(Boolean) as GardenPlantInfo[];

                    return (
                      <Card key={entry.id} className="rounded-2xl border border-stone-200/70 dark:border-[#3e3e42]/70 bg-white dark:bg-[#1f1f1f] overflow-hidden">
                        {/* Top row: plant avatars + title + actions */}
                        <div className="px-4 py-3 flex items-start gap-3">
                          {/* Plant avatars */}
                          {entryPlants.length > 0 && (
                            <div className="flex -space-x-2 shrink-0 mt-0.5">
                              {entryPlants.slice(0, 4).map((gp) => {
                                const img = getPlantImageUrl(gp);
                                return (
                                  <div key={gp.id} className="w-8 h-8 rounded-full border-2 border-white dark:border-[#1f1f1f] overflow-hidden bg-stone-100 dark:bg-stone-800" title={gp.nickname || gp.plant?.name || "Plant"}>
                                    {img ? <img src={img} alt="" className="w-full h-full object-cover" /> : <Sprout className="w-4 h-4 m-auto mt-1.5 text-stone-400" />}
                                  </div>
                                );
                              })}
                              {entryPlants.length > 4 && (
                                <div className="w-8 h-8 rounded-full border-2 border-white dark:border-[#1f1f1f] bg-stone-200 dark:bg-stone-700 flex items-center justify-center text-[10px] font-bold text-stone-600 dark:text-stone-300">
                                  +{entryPlants.length - 4}
                                </div>
                              )}
                            </div>
                          )}

                          {/* Title & meta */}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              {entry.title && (
                                <span className="font-semibold text-sm truncate">{entry.title}</span>
                              )}
                              {entry.isPrivate && <Lock className="w-3 h-3 text-stone-400 shrink-0" />}
                            </div>
                            <div className="flex items-center gap-2 text-[11px] text-muted-foreground mt-0.5">
                              <span>{new Date(entry.createdAt).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })}</span>
                              {entry.photos?.length > 0 && <><span>·</span><span>{entry.photos.length} 📷</span></>}
                              {entry.weatherSnapshot?.temp !== undefined && <><span>·</span><span>{entry.weatherSnapshot.temp}° {entry.weatherSnapshot.condition || ""}</span></>}
                            </div>
                          </div>

                          {/* Actions */}
                          {isOwn && (
                            <div className="flex items-center gap-0.5 shrink-0">
                              <Button variant="ghost" size="sm" className="rounded-full h-7 w-7 p-0" onClick={() => startEditEntry(entry)}>
                                <Pencil className="w-3.5 h-3.5" />
                              </Button>
                              <Button variant="ghost" size="sm" className="rounded-full h-7 w-7 p-0 text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30" onClick={() => handleDeleteEntry(entry.id)}>
                                <Trash2 className="w-3.5 h-3.5" />
                              </Button>
                            </div>
                          )}
                        </div>

                        {/* Content */}
                        <div className="px-4 pb-3">
                          <p className="text-sm text-stone-700 dark:text-stone-300 whitespace-pre-wrap leading-relaxed line-clamp-4">
                            {entry.content}
                          </p>
                        </div>

                        {/* Photos strip */}
                        {entry.photos && entry.photos.length > 0 && (
                          <div className="px-4 pb-3 flex gap-2 overflow-x-auto scrollbar-none">
                            {entry.photos.map((photo) => (
                              <div key={photo.id} className="shrink-0 w-20 h-20 rounded-xl overflow-hidden">
                                <img
                                  src={photo.thumbnailUrl || photo.imageUrl}
                                  alt={photo.caption || ""}
                                  className="w-full h-full object-cover"
                                />
                              </div>
                            ))}
                          </div>
                        )}

                        {/* Plant name pills */}
                        {entryPlants.length > 0 && (
                          <div className="px-4 pb-3 flex flex-wrap gap-1.5">
                            {entryPlants.map((gp) => (
                              <span key={gp.id} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-300 border border-emerald-200/50 dark:border-emerald-800/30">
                                {gp.nickname || gp.plant?.name}
                              </span>
                            ))}
                          </div>
                        )}
                      </Card>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
      </>
      )}

      {/* ===== LIBRARY TAB ===== */}
      {activeView === "library" && (
        <div className="space-y-4">
          {fetchError && (
            <ErrorBanner
              title={t("gardenDashboard.journalSection.fetchError", "Failed to load journal")}
              message={fetchError}
            />
          )}
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-amber-500" />
            </div>
          ) : libraryPhotos.length === 0 ? (
            <Card className="rounded-[28px] border border-stone-200/70 dark:border-[#3e3e42]/70 bg-white/80 dark:bg-[#1f1f1f]/80 backdrop-blur p-12 text-center">
              <div className="max-w-md mx-auto">
                <div className="text-6xl mb-4">📷</div>
                <h3 className="text-xl font-semibold mb-2">
                  {t("gardenDashboard.journalSection.noPhotos", "No photos yet")}
                </h3>
                <p className="text-muted-foreground mb-6">
                  {t("gardenDashboard.journalSection.noPhotosDesc", "Add photos to your journal entries and they will appear here.")}
                </p>
                <Button
                  onClick={() => { setActiveView("journal"); setShowNewEntry(true); }}
                  className="rounded-2xl bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white gap-2"
                >
                  <Plus className="w-5 h-5" />
                  {t("gardenDashboard.journalSection.writeFirst", "Write Your First Entry")}
                </Button>
              </div>
            </Card>
          ) : (
            <>
              <div className="flex items-center justify-between">
                <p className="text-sm text-muted-foreground">
                  {libraryPhotos.length} {t("gardenDashboard.journalSection.photos", "photos")}
                </p>
                <Button
                  variant="ghost"
                  size="sm"
                  className="rounded-xl gap-1.5 text-xs text-stone-500 dark:text-stone-400 hover:text-stone-900 dark:hover:text-white"
                  onClick={() => setLibrarySort(librarySort === "newest" ? "oldest" : "newest")}
                >
                  <ArrowUpDown className="w-3.5 h-3.5" />
                  {librarySort === "newest"
                    ? t("gardenDashboard.journalSection.newestFirst", "Newest first")
                    : t("gardenDashboard.journalSection.oldestFirst", "Oldest first")}
                </Button>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                {libraryPhotos.map((photo, idx) => (
                  <div key={photo.id} className="group relative aspect-square rounded-2xl overflow-hidden border border-stone-200/70 dark:border-[#3e3e42]/70 bg-stone-100 dark:bg-stone-800">
                    <button
                      type="button"
                      onClick={() => libraryViewer.openGallery(libraryViewerImages, idx)}
                      className="w-full h-full cursor-zoom-in focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500"
                      aria-label={t("gardenDashboard.journalSection.viewPhoto", { count: idx + 1, defaultValue: `View photo ${idx + 1}` })}
                      title={t("gardenDashboard.journalSection.viewPhoto", { count: idx + 1, defaultValue: `View photo ${idx + 1}` })}
                    >
                      <img
                        src={photo.thumbnailUrl || photo.url}
                        alt={photo.caption || photo.entryTitle || "Journal photo"}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                        loading="lazy"
                      />
                    </button>
                    {/* Date tag */}
                    <div className="absolute bottom-2 left-2 px-2 py-0.5 rounded-md bg-black/55 backdrop-blur-sm text-white text-[11px] font-medium pointer-events-none">
                      {formatShortDate(photo.date)}
                    </div>
                    {photo.mood && (
                      <div className="absolute top-2 left-2 pointer-events-none">
                        <span className="text-lg drop-shadow-md">
                          {MOODS.find(m => m.key === photo.mood)?.emoji}
                        </span>
                      </div>
                    )}
                    {photo.plantHealth && (
                      <div className="absolute top-2 right-2 pointer-events-none">
                        <span className="text-lg drop-shadow-md">
                          {PLANT_HEALTH.find(h => h.key === photo.plantHealth)?.emoji}
                        </span>
                      </div>
                    )}
                    {/* Owner delete button */}
                    {isOwner && (
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); handleDeletePhoto(photo.id); }}
                        disabled={deletingPhotoId === photo.id}
                        className="absolute top-2 right-2 w-7 h-7 rounded-full bg-black/50 backdrop-blur-sm text-white/80 hover:text-white hover:bg-red-600/80 flex items-center justify-center opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500"
                        aria-label={t("common.delete", "Delete")}
                        title={t("common.delete", "Delete")}
                      >
                        {deletingPhotoId === photo.id
                          ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          : <Trash2 className="w-3.5 h-3.5" />
                        }
                      </button>
                    )}
                  </div>
                ))}
              </div>
              <ImageViewer {...libraryViewer.props} enableZoom />
            </>
          )}
        </div>
      )}
    </div>
  );
};

export default GardenJournalSection;
