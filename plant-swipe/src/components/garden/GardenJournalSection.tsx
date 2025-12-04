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
  Smile,
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
  Meh,
  Frown,
  X,
  Upload,
  Tag,
  Lock,
  Globe,
  RefreshCw,
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

// Mood configuration
const MOODS = [
  { key: "great", emoji: "🌟", label: "Great", color: "text-yellow-500", bg: "bg-yellow-100 dark:bg-yellow-900/30" },
  { key: "good", emoji: "😊", label: "Good", color: "text-emerald-500", bg: "bg-emerald-100 dark:bg-emerald-900/30" },
  { key: "neutral", emoji: "😐", label: "Neutral", color: "text-stone-500", bg: "bg-stone-100 dark:bg-stone-800/50" },
  { key: "concerned", emoji: "😟", label: "Concerned", color: "text-amber-500", bg: "bg-amber-100 dark:bg-amber-900/30" },
  { key: "struggling", emoji: "😰", label: "Struggling", color: "text-red-500", bg: "bg-red-100 dark:bg-red-900/30" },
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

  // Generate AI feedback for entry
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
        </div>
      </div>

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
                    <Smile className="w-4 h-4" />
                    {t("gardenDashboard.journalSection.howFeeling", "How's your garden feeling today?")}
                  </label>
                  <div className="flex flex-wrap gap-2 mt-2">
                    {MOODS.map((mood) => (
                      <button
                        key={mood.key}
                        type="button"
                        onClick={() => setEntryMood(entryMood === mood.key ? null : mood.key)}
                        className={`flex items-center gap-2 px-4 py-2 rounded-xl border-2 transition-all ${
                          entryMood === mood.key
                            ? `${mood.bg} border-current ${mood.color} shadow-md`
                            : "border-stone-200 dark:border-stone-700 hover:border-stone-300 dark:hover:border-stone-600"
                        }`}
                      >
                        <span className="text-xl">{mood.emoji}</span>
                        <span className="text-sm font-medium">{t(`gardenDashboard.journalSection.moods.${mood.key}`, mood.label)}</span>
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
                          <div className="flex items-center gap-2 text-sm font-medium text-purple-700 dark:text-purple-300 mb-2">
                            <Sparkles className="w-4 h-4" />
                            {t("gardenDashboard.journalSection.aiFeedback", "AI Gardener Feedback")}
                          </div>
                          <p className="text-sm text-purple-800 dark:text-purple-200 leading-relaxed">
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
