// @ts-nocheck
import React from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useTranslation } from "react-i18next";
import { supabase } from "@/lib/supabaseClient";
import { useAuth } from "@/context/AuthContext";
import { motion, AnimatePresence } from "framer-motion";
import {
  Plus,
  Calendar,
  Camera,
  CloudSun,
  Leaf,
  Pencil,
  Trash2,
  ChevronLeft,
  ChevronRight,
  Clock,
  Image,
  Loader2,
  Sparkles,
  BookOpen,
  Heart,
  AlertCircle,
  CheckCircle2,
  X,
  Upload,
  Tag,
  Lock,
  Globe,
  RefreshCw,
  Play,
  Pause,
  Download,
  Film,
  Images,
  ZoomIn,
} from "lucide-react";
import type { Garden } from "@/types/garden";

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
  aiFeedback: string | null;
  aiFeedbackGeneratedAt: string | null;
  aiFeedbackImagesAnalyzed?: number;
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

interface GardenJournalSectionProps {
  gardenId: string;
  garden: Garden | null;
  plants: any[];
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
  plants,
  members,
}) => {
  const { t } = useTranslation("common");
  const { user } = useAuth();
  
  // State
  const [loading, setLoading] = React.useState(true);
  const [entries, setEntries] = React.useState<JournalEntry[]>([]);
  const [selectedDate, setSelectedDate] = React.useState<Date>(new Date());
  const [isEditing, setIsEditing] = React.useState(false);
  const [editingEntry, setEditingEntry] = React.useState<JournalEntry | null>(null);
  const [showNewEntry, setShowNewEntry] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [generatingFeedback, setGeneratingFeedback] = React.useState(false);
  
  // Entry form state
  const [entryTitle, setEntryTitle] = React.useState("");
  const [entryContent, setEntryContent] = React.useState("");
  const [entryMood, setEntryMood] = React.useState<string | null>(null);
  const [entryIsPrivate, setEntryIsPrivate] = React.useState(false);
  const [entryTags, setEntryTags] = React.useState<string[]>([]);
  const [newTag, setNewTag] = React.useState("");
  const [uploadingPhotos, setUploadingPhotos] = React.useState(false);
  const [pendingPhotos, setPendingPhotos] = React.useState<File[]>([]);
  const [photoPreviewUrls, setPhotoPreviewUrls] = React.useState<string[]>([]);
  
  const fileInputRef = React.useRef<HTMLInputElement>(null);

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

  // Get all photos sorted by date for timelapse
  const allPhotos = React.useMemo(() => {
    const photos: Array<{
      url: string;
      date: string;
      caption?: string;
      entryTitle?: string;
      mood?: string;
    }> = [];
    
    entries.forEach((entry) => {
      if (entry.photos && entry.photos.length > 0) {
        entry.photos.forEach((photo) => {
          photos.push({
            url: photo.imageUrl,
            date: entry.entryDate,
            caption: photo.caption || undefined,
            entryTitle: entry.title || undefined,
            mood: entry.mood || undefined,
          });
        });
      }
    });
    
    // Sort oldest to newest for timelapse
    return photos.sort((a, b) => a.date.localeCompare(b.date));
  }, [entries]);

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
      alert('Failed to generate video. Your browser may not support this feature.');
    } finally {
      setExporting(null);
      setShowExportMenu(false);
    }
  };

  // Fetch journal entries
  const fetchEntries = React.useCallback(async () => {
    if (!gardenId) return;
    setLoading(true);
    try {
      const session = (await supabase.auth.getSession()).data.session;
      const token = session?.access_token;
      const headers: Record<string, string> = { Accept: "application/json" };
      if (token) headers["Authorization"] = `Bearer ${token}`;

      const resp = await fetch(`/api/garden/${gardenId}/journal`, {
        headers,
        credentials: "same-origin",
      });

      if (resp.ok) {
        const data = await resp.json();
        if (data?.ok && data.entries) {
          setEntries(data.entries);
        }
      }
    } catch (err) {
      console.warn("[Journal] Failed to fetch entries:", err);
    } finally {
      setLoading(false);
    }
  }, [gardenId]);

  React.useEffect(() => {
    fetchEntries();
  }, [fetchEntries]);

  // Handle photo selection
  const handlePhotoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;
    
    // Create preview URLs
    const urls = files.map((file) => URL.createObjectURL(file));
    setPendingPhotos((prev) => [...prev, ...files]);
    setPhotoPreviewUrls((prev) => [...prev, ...urls]);
  };

  // Remove pending photo
  const removePendingPhoto = (index: number) => {
    URL.revokeObjectURL(photoPreviewUrls[index]);
    setPendingPhotos((prev) => prev.filter((_, i) => i !== index));
    setPhotoPreviewUrls((prev) => prev.filter((_, i) => i !== index));
  };

  // Add tag
  const handleAddTag = () => {
    if (newTag.trim() && !entryTags.includes(newTag.trim())) {
      setEntryTags((prev) => [...prev, newTag.trim()]);
      setNewTag("");
    }
  };

  // Remove tag
  const handleRemoveTag = (tag: string) => {
    setEntryTags((prev) => prev.filter((t) => t !== tag));
  };

  // Reset form
  const resetForm = () => {
    setEntryTitle("");
    setEntryContent("");
    setEntryMood(null);
    setEntryIsPrivate(false);
    setEntryTags([]);
    pendingPhotos.forEach((_, i) => URL.revokeObjectURL(photoPreviewUrls[i]));
    setPendingPhotos([]);
    setPhotoPreviewUrls([]);
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

      // First, upload photos if any
      let uploadedPhotoUrls: string[] = [];
      if (pendingPhotos.length > 0) {
        setUploadingPhotos(true);
        for (const file of pendingPhotos) {
          const formData = new FormData();
          formData.append("file", file);
          formData.append("folder", `journal`);
          
          const uploadResp = await fetch(`/api/garden/${gardenId}/upload`, {
            method: "POST",
            headers: { Authorization: headers.Authorization || "" },
            body: formData,
            credentials: "same-origin",
          });
          
          if (uploadResp.ok) {
            const uploadData = await uploadResp.json();
            if (uploadData?.url) {
              uploadedPhotoUrls.push(uploadData.url);
            }
          }
        }
        setUploadingPhotos(false);
      }

      const entryData = {
        entryId: editingEntry?.id || undefined,
        title: entryTitle.trim() || null,
        content: entryContent.trim(),
        mood: entryMood,
        isPrivate: entryIsPrivate,
        tags: entryTags,
        photos: uploadedPhotoUrls,
      };

      const resp = await fetch(`/api/garden/${gardenId}/journal`, {
        method: editingEntry ? "PUT" : "POST",
        headers,
        credentials: "same-origin",
        body: JSON.stringify(entryData),
      });

      if (resp.ok) {
        const data = await resp.json();
        if (data?.ok) {
          resetForm();
          setShowNewEntry(false);
          fetchEntries();
        }
      }
    } catch (err) {
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

  // Generate AI feedback for entry (with image analysis)
  const handleGenerateFeedback = async (entryId: string) => {
    setGeneratingFeedback(true);
    try {
      const session = (await supabase.auth.getSession()).data.session;
      const token = session?.access_token;
      const headers: Record<string, string> = { Accept: "application/json" };
      if (token) headers["Authorization"] = `Bearer ${token}`;

      const resp = await fetch(`/api/garden/${gardenId}/journal/${entryId}/feedback`, {
        method: "POST",
        headers,
        credentials: "same-origin",
      });

      if (resp.ok) {
        const data = await resp.json();
        // Store images analyzed count in entry metadata (will be updated on fetch)
        if (data.imagesAnalyzed > 0) {
          setEntries(prev => prev.map(e => 
            e.id === entryId 
              ? { ...e, aiFeedback: data.feedback, aiFeedbackImagesAnalyzed: data.imagesAnalyzed }
              : e
          ));
        }
        fetchEntries();
      }
    } catch (err) {
      console.warn("[Journal] Failed to generate feedback:", err);
    } finally {
      setGeneratingFeedback(false);
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

  // Get mood config
  const getMoodConfig = (mood: string | null) => {
    return MOODS.find((m) => m.key === mood) || MOODS[2]; // default to neutral
  };

  return (
    <div className="space-y-6">
      {/* Header with decorative elements */}
      <div className="relative overflow-hidden rounded-[28px] bg-gradient-to-br from-amber-50 via-orange-50 to-rose-50 dark:from-amber-900/20 dark:via-orange-900/20 dark:to-rose-900/20 p-6 md:p-8">
        <div className="absolute -right-10 -top-10 w-40 h-40 bg-gradient-to-br from-amber-200/40 to-rose-200/40 dark:from-amber-500/10 dark:to-rose-500/10 rounded-full blur-3xl" />
        <div className="absolute -left-10 -bottom-10 w-32 h-32 bg-gradient-to-br from-orange-200/40 to-amber-200/40 dark:from-orange-500/10 dark:to-amber-500/10 rounded-full blur-3xl" />
        
        <div className="relative flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h2 className="text-2xl md:text-3xl font-bold flex items-center gap-3">
              <span className="text-3xl">📔</span>
              {t("gardenDashboard.journalSection.title", "Garden Journal")}
            </h2>
            <p className="text-sm text-muted-foreground mt-1 max-w-md">
              {t("gardenDashboard.journalSection.subtitle", "Record your observations, track plant progress, and reflect on your gardening journey")}
            </p>
          </div>
          
          <Button
            onClick={() => {
              resetForm();
              setShowNewEntry(true);
            }}
            className="rounded-2xl bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white shadow-lg shadow-amber-500/25 gap-2"
            size="lg"
          >
            <Plus className="w-5 h-5" />
            {todayEntry 
              ? t("gardenDashboard.journalSection.addNote", "Add Note")
              : t("gardenDashboard.journalSection.writeToday", "Write Today's Entry")
            }
          </Button>
        </div>
        
        {/* Quick stats */}
        <div className="relative flex flex-wrap gap-4 mt-6">
          <div className="flex items-center gap-2 bg-white/60 dark:bg-black/20 backdrop-blur-sm rounded-full px-4 py-2">
            <BookOpen className="w-4 h-4 text-amber-600" />
            <span className="text-sm font-medium">{entries.length}</span>
            <span className="text-xs text-muted-foreground">{t("gardenDashboard.journalSection.entries", "entries")}</span>
          </div>
          <div className="flex items-center gap-2 bg-white/60 dark:bg-black/20 backdrop-blur-sm rounded-full px-4 py-2">
            <Camera className="w-4 h-4 text-rose-600" />
            <span className="text-sm font-medium">{entries.reduce((sum, e) => sum + (e.photos?.length || 0), 0)}</span>
            <span className="text-xs text-muted-foreground">{t("gardenDashboard.journalSection.photos", "photos")}</span>
          </div>
          {todayEntry && (
            <div className="flex items-center gap-2 bg-emerald-100 dark:bg-emerald-900/30 backdrop-blur-sm rounded-full px-4 py-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              <span className="text-xs text-emerald-700 dark:text-emerald-300">
                {t("gardenDashboard.journalSection.loggedToday", "Logged today!")}
              </span>
            </div>
          )}
          {allPhotos.length >= 2 && (
            <Button
              variant="outline"
              size="sm"
              className="rounded-full gap-2 bg-white/60 dark:bg-black/20 backdrop-blur-sm border-rose-200 dark:border-rose-800 text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-900/30"
              onClick={() => setShowTimelapse(true)}
            >
              <Film className="w-4 h-4" />
              {t("gardenDashboard.journalSection.viewTimelapse", "View Timelapse")}
            </Button>
          )}
        </div>
      </div>

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
                >
                  <ChevronLeft className="w-6 h-6" />
                </Button>

                {/* Play/Pause */}
                <Button
                  variant="ghost"
                  size="icon"
                  className="text-white hover:bg-white/20 rounded-full w-14 h-14"
                  onClick={() => setIsPlaying(!isPlaying)}
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
                            className="w-full flex items-start gap-3 p-3 rounded-xl hover:bg-stone-100 dark:hover:bg-stone-800 transition-colors text-left disabled:opacity-50"
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
                            className="w-full flex items-start gap-3 p-3 rounded-xl hover:bg-stone-100 dark:hover:bg-stone-800 transition-colors text-left disabled:opacity-50"
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
                            className="w-full flex items-start gap-3 p-3 rounded-xl hover:bg-stone-100 dark:hover:bg-stone-800 transition-colors text-left disabled:opacity-50"
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

                {/* Mood selector */}
                <div>
                  <label className="text-sm font-medium mb-2 flex items-center gap-2">
                    <Leaf className="w-4 h-4" />
                    {t("gardenDashboard.journalSection.gardenStatus", "How's your garden today?")}
                  </label>
                  <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 mt-2">
                    {MOODS.map((mood) => (
                      <button
                        key={mood.key}
                        type="button"
                        onClick={() => setEntryMood(entryMood === mood.key ? null : mood.key)}
                        className={`flex flex-col items-center gap-1 p-3 rounded-xl border-2 transition-all ${
                          entryMood === mood.key
                            ? `${mood.bg} border-current ${mood.color} shadow-md scale-105`
                            : "border-stone-200 dark:border-stone-700 hover:border-stone-300 dark:hover:border-stone-600 hover:scale-102"
                        }`}
                      >
                        <span className="text-2xl">{mood.emoji}</span>
                        <span className="text-xs font-medium">{t(`gardenDashboard.journalSection.moods.${mood.key}`, mood.label)}</span>
                        <span className="text-[10px] text-muted-foreground">{mood.desc}</span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Title (optional) */}
                <div>
                  <label className="text-sm font-medium mb-2 block">
                    {t("gardenDashboard.journalSection.titleOptional", "Title (optional)")}
                  </label>
                  <Input
                    value={entryTitle}
                    onChange={(e) => setEntryTitle(e.target.value)}
                    placeholder={t("gardenDashboard.journalSection.titlePlaceholder", "Give this entry a title...")}
                    className="rounded-xl"
                  />
                </div>

                {/* Content */}
                <div>
                  <label className="text-sm font-medium mb-2 block">
                    {t("gardenDashboard.journalSection.observations", "Your observations")}
                  </label>
                  <textarea
                    value={entryContent}
                    onChange={(e) => setEntryContent(e.target.value)}
                    placeholder={t("gardenDashboard.journalSection.contentPlaceholder", "What did you notice today? How are your plants doing? Any changes, blooms, or concerns?")}
                    className="w-full min-h-[150px] p-4 rounded-xl border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-900 focus:ring-2 focus:ring-amber-500 focus:border-transparent resize-y"
                  />
                </div>

                {/* Photo upload */}
                <div>
                  <label className="text-sm font-medium mb-2 flex items-center gap-2">
                    <Camera className="w-4 h-4" />
                    {t("gardenDashboard.journalSection.photos", "Photos")}
                  </label>
                  <div className="flex flex-wrap gap-3 mt-2">
                    {photoPreviewUrls.map((url, index) => (
                      <div key={index} className="relative group">
                        <img
                          src={url}
                          alt={`Photo ${index + 1}`}
                          className="w-24 h-24 object-cover rounded-xl border-2 border-stone-200 dark:border-stone-700"
                        />
                        <button
                          type="button"
                          onClick={() => removePendingPhoto(index)}
                          className="absolute -top-2 -right-2 w-6 h-6 bg-red-500 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="w-24 h-24 border-2 border-dashed border-stone-300 dark:border-stone-600 rounded-xl flex flex-col items-center justify-center gap-1 text-stone-400 hover:border-amber-400 hover:text-amber-500 transition-colors"
                    >
                      <Upload className="w-6 h-6" />
                      <span className="text-xs">{t("gardenDashboard.journalSection.addPhoto", "Add")}</span>
                    </button>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      multiple
                      onChange={handlePhotoSelect}
                      className="hidden"
                    />
                  </div>
                </div>

                {/* Tags */}
                <div>
                  <label className="text-sm font-medium mb-2 flex items-center gap-2">
                    <Tag className="w-4 h-4" />
                    {t("gardenDashboard.journalSection.tags", "Tags")}
                  </label>
                  <div className="flex flex-wrap gap-2 mt-2">
                    {entryTags.map((tag) => (
                      <span
                        key={tag}
                        className="inline-flex items-center gap-1 px-3 py-1 bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 rounded-full text-sm"
                      >
                        #{tag}
                        <button
                          type="button"
                          onClick={() => handleRemoveTag(tag)}
                          className="hover:text-red-500"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </span>
                    ))}
                    <div className="flex items-center gap-1">
                      <Input
                        value={newTag}
                        onChange={(e) => setNewTag(e.target.value)}
                        onKeyPress={(e) => e.key === "Enter" && (e.preventDefault(), handleAddTag())}
                        placeholder={t("gardenDashboard.journalSection.addTag", "Add tag...")}
                        className="w-24 h-8 text-sm rounded-full"
                      />
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        className="h-8 w-8 p-0 rounded-full"
                        onClick={handleAddTag}
                      >
                        <Plus className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                </div>

                {/* Privacy toggle */}
                <div className="flex items-center justify-between p-4 rounded-xl bg-stone-50 dark:bg-stone-800/50">
                  <div className="flex items-center gap-3">
                    {entryIsPrivate ? (
                      <Lock className="w-5 h-5 text-amber-500" />
                    ) : (
                      <Globe className="w-5 h-5 text-emerald-500" />
                    )}
                    <div>
                      <div className="font-medium text-sm">
                        {entryIsPrivate 
                          ? t("gardenDashboard.journalSection.privateEntry", "Private entry")
                          : t("gardenDashboard.journalSection.sharedEntry", "Shared with garden members")
                        }
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {entryIsPrivate 
                          ? t("gardenDashboard.journalSection.privateDesc", "Only you can see this entry")
                          : t("gardenDashboard.journalSection.sharedDesc", "Other garden members can read this")
                        }
                      </div>
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
                    {saving || uploadingPhotos ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        {uploadingPhotos 
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
      <div className="space-y-4">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-amber-500" />
          </div>
        ) : entries.length === 0 ? (
          <Card className="rounded-[28px] border border-stone-200/70 dark:border-[#3e3e42]/70 bg-white/80 dark:bg-[#1f1f1f]/80 backdrop-blur p-12 text-center">
            <div className="max-w-md mx-auto">
              <div className="text-6xl mb-4">📝</div>
              <h3 className="text-xl font-semibold mb-2">
                {t("gardenDashboard.journalSection.noEntries", "Your garden journal is empty")}
              </h3>
              <p className="text-muted-foreground mb-6">
                {t("gardenDashboard.journalSection.startJourney", "Start documenting your gardening journey. Record observations, track plant growth, and capture memories of your garden.")}
              </p>
              <Button
                onClick={() => setShowNewEntry(true)}
                className="rounded-2xl bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white gap-2"
              >
                <Plus className="w-5 h-5" />
                {t("gardenDashboard.journalSection.writeFirst", "Write Your First Entry")}
              </Button>
            </div>
          </Card>
        ) : (
          <div className="space-y-6">
            {entries.map((entry, index) => {
              const moodConfig = getMoodConfig(entry.mood);
              const isOwn = entry.userId === user?.id;
              
              return (
                <motion.div
                  key={entry.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.05 }}
                >
                  <Card className="rounded-[28px] border border-stone-200/70 dark:border-[#3e3e42]/70 bg-white dark:bg-[#1f1f1f] overflow-hidden">
                    {/* Entry header */}
                    <div className={`p-4 md:p-6 ${moodConfig.bg}`}>
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-3">
                          <div className="text-3xl">{moodConfig.emoji}</div>
                          <div>
                            <div className="font-semibold text-lg">
                              {entry.title || formatDate(entry.entryDate)}
                            </div>
                            {entry.title && (
                              <div className="text-sm text-muted-foreground">
                                {formatDate(entry.entryDate)}
                              </div>
                            )}
                          </div>
                        </div>
                        
                        <div className="flex items-center gap-2">
                          {entry.isPrivate && (
                            <div className="flex items-center gap-1 px-2 py-1 bg-white/50 dark:bg-black/20 rounded-full text-xs">
                              <Lock className="w-3 h-3" />
                              {t("gardenDashboard.journalSection.private", "Private")}
                            </div>
                          )}
                          {isOwn && (
                            <div className="flex items-center gap-1">
                              <Button
                                variant="ghost"
                                size="sm"
                                className="rounded-full h-8 w-8 p-0"
                                onClick={() => startEditEntry(entry)}
                              >
                                <Pencil className="w-4 h-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="rounded-full h-8 w-8 p-0 text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30"
                                onClick={() => handleDeleteEntry(entry.id)}
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                    
                    {/* Entry content */}
                    <div className="p-4 md:p-6 space-y-4">
                      <p className="text-stone-700 dark:text-stone-300 whitespace-pre-wrap leading-relaxed">
                        {entry.content}
                      </p>
                      
                      {/* Photos grid */}
                      {entry.photos && entry.photos.length > 0 && (
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                          {entry.photos.map((photo) => (
                            <div key={photo.id} className="relative group aspect-square rounded-xl overflow-hidden">
                              <img
                                src={photo.thumbnailUrl || photo.imageUrl}
                                alt={photo.caption || "Journal photo"}
                                className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                              />
                              {photo.caption && (
                                <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/60 to-transparent p-2">
                                  <p className="text-white text-xs truncate">{photo.caption}</p>
                                </div>
                              )}
                              {photo.plantHealth && (
                                <div className="absolute top-2 right-2">
                                  <span className={`text-lg ${PLANT_HEALTH.find(h => h.key === photo.plantHealth)?.color}`}>
                                    {PLANT_HEALTH.find(h => h.key === photo.plantHealth)?.emoji}
                                  </span>
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                      
                      {/* Tags */}
                      {entry.tags && entry.tags.length > 0 && (
                        <div className="flex flex-wrap gap-2">
                          {entry.tags.map((tag) => (
                            <span
                              key={tag}
                              className="px-3 py-1 bg-stone-100 dark:bg-stone-800 text-stone-600 dark:text-stone-400 rounded-full text-sm"
                            >
                              #{tag}
                            </span>
                          ))}
                        </div>
                      )}
                      
                      {/* Weather snapshot */}
                      {entry.weatherSnapshot && entry.weatherSnapshot.temp !== undefined && (
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <CloudSun className="w-4 h-4" />
                          <span>{entry.weatherSnapshot.temp}°</span>
                          {entry.weatherSnapshot.condition && (
                            <span>• {entry.weatherSnapshot.condition}</span>
                          )}
                        </div>
                      )}
                      
                      {/* AI Feedback section */}
                      {entry.aiFeedback ? (
                        <div className="p-4 rounded-xl bg-gradient-to-r from-purple-50 to-indigo-50 dark:from-purple-900/20 dark:to-indigo-900/20 border border-purple-200/50 dark:border-purple-800/50">
                          <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-2 text-sm font-medium text-purple-700 dark:text-purple-300">
                              <Sparkles className="w-4 h-4" />
                              {t("gardenDashboard.journalSection.aiFeedback", "AI Gardener Feedback")}
                            </div>
                            {entry.photos && entry.photos.length > 0 && (
                              <span className="text-xs bg-purple-200/50 dark:bg-purple-800/50 text-purple-600 dark:text-purple-300 px-2 py-0.5 rounded-full flex items-center gap-1">
                                <Camera className="w-3 h-3" />
                                {t("gardenDashboard.journalSection.photosAnalyzed", { 
                                  defaultValue: "{{count}} photo(s) analyzed",
                                  count: Math.min(entry.photos.length, 4)
                                })}
                              </span>
                            )}
                          </div>
                          <p className="text-sm text-purple-800 dark:text-purple-200 leading-relaxed whitespace-pre-wrap">
                            {entry.aiFeedback}
                          </p>
                          {entry.aiFeedbackGeneratedAt && (
                            <p className="text-xs text-purple-500 dark:text-purple-400 mt-2">
                              {new Date(entry.aiFeedbackGeneratedAt).toLocaleDateString()}
                            </p>
                          )}
                        </div>
                      ) : isOwn && (
                        <Button
                          variant="outline"
                          size="sm"
                          className="rounded-xl text-purple-600 border-purple-200 hover:bg-purple-50 dark:hover:bg-purple-900/30 gap-2"
                          onClick={() => handleGenerateFeedback(entry.id)}
                          disabled={generatingFeedback}
                        >
                          {generatingFeedback ? (
                            <>
                              <Loader2 className="w-4 h-4 animate-spin" />
                              {t("gardenDashboard.journalSection.generating", "Generating...")}
                            </>
                          ) : (
                            <>
                              <Sparkles className="w-4 h-4" />
                              {t("gardenDashboard.journalSection.getAIFeedback", "Get AI Feedback")}
                            </>
                          )}
                        </Button>
                      )}
                    </div>
                    
                    {/* Entry footer with timestamp */}
                    <div className="px-4 md:px-6 py-3 bg-stone-50 dark:bg-stone-800/50 border-t border-stone-200/50 dark:border-stone-700/50">
                      <div className="flex items-center justify-between text-xs text-muted-foreground">
                        <div className="flex items-center gap-2">
                          <Clock className="w-3 h-3" />
                          {new Date(entry.createdAt).toLocaleTimeString(undefined, {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </div>
                        {entry.photos && entry.photos.length > 0 && (
                          <div className="flex items-center gap-1">
                            <Image className="w-3 h-3" />
                            {entry.photos.length} {t("gardenDashboard.journalSection.photos", "photos")}
                          </div>
                        )}
                      </div>
                    </div>
                  </Card>
                </motion.div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default GardenJournalSection;
