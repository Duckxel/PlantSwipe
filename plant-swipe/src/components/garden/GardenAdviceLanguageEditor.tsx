import React from "react";
import { Button } from "@/components/ui/button";
import { useTranslation } from "react-i18next";
import { supabase } from "@/lib/supabaseClient";
import { Loader2, Check } from "lucide-react";
import type { Garden } from "@/types/garden";

// Supported languages for gardening advice (matches website languages)
const ADVICE_LANGUAGES = [
  { code: "en", name: "English", flag: "🇬🇧" },
  { code: "fr", name: "Français", flag: "🇫🇷" },
];

interface GardenAdviceLanguageEditorProps {
  garden: Garden | null;
  userProfileLanguage?: string | null;
  onSaved: () => void;
  canEdit: boolean;
}

export const GardenAdviceLanguageEditor: React.FC<GardenAdviceLanguageEditorProps> = ({
  garden,
  userProfileLanguage,
  onSaved,
  canEdit,
}) => {
  const { t } = useTranslation("common");
  
  // Default to user's profile language, then garden's preferred language, then 'en'
  const defaultLanguage = garden?.preferredLanguage || userProfileLanguage || "en";
  
  const [preferredLanguage, setPreferredLanguage] = React.useState(defaultLanguage);
  const [saving, setSaving] = React.useState(false);
  const [saved, setSaved] = React.useState(false);
  
  // Update preferred language when garden data or user profile changes
  React.useEffect(() => {
    // If garden has a preferred language set, use it
    // Otherwise, default to user's profile language
    const newDefault = garden?.preferredLanguage || userProfileLanguage || "en";
    setPreferredLanguage(newDefault);
  }, [garden?.preferredLanguage, userProfileLanguage]);
  
  const languageChanged = preferredLanguage !== (garden?.preferredLanguage || userProfileLanguage || "en");
  
  // Get current language display info
  const currentLang = ADVICE_LANGUAGES.find(l => l.code === preferredLanguage) || ADVICE_LANGUAGES[0];
  
  const handleSave = async () => {
    if (!garden?.id || !canEdit || !languageChanged) return;
    
    setSaving(true);
    setSaved(false);
    
    try {
      const session = (await supabase.auth.getSession()).data.session;
      const token = session?.access_token;
      
      const resp = await fetch(`/api/garden/${garden.id}/language`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        credentials: "same-origin",
        body: JSON.stringify({ preferredLanguage }),
      });
      
      const data = await resp.json().catch(() => ({}));
      
      if (resp.ok && data.ok) {
        setSaved(true);
        onSaved();
        setTimeout(() => setSaved(false), 2000);
      } else {
        console.error("[language] Save failed:", data.error || "Unknown error");
        alert(data.error || "Failed to save language preference");
      }
    } catch (err) {
      console.error("[language] Failed to save:", err);
      alert("Failed to save language preference. Please try again.");
    } finally {
      setSaving(false);
    }
  };
  
  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        {t(
          "gardenDashboard.settingsSection.adviceLanguageDescription",
          "Choose the language for your personalized gardening advice."
        )}
      </p>
      
      {/* Language Selection */}
      <div className="space-y-2">
        <label className="text-sm font-medium">
          {t("gardenDashboard.settingsSection.selectLanguage", "Select Language")}
        </label>
        <select
          value={preferredLanguage}
          onChange={(e) => setPreferredLanguage(e.target.value)}
          disabled={!canEdit}
          className="w-full p-3 rounded-xl border border-stone-200 dark:border-stone-700 bg-white dark:bg-[#1f1f1f] text-base focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-colors"
        >
          {ADVICE_LANGUAGES.map((lang) => (
            <option key={lang.code} value={lang.code}>
              {lang.flag} {lang.name}
            </option>
          ))}
        </select>
      </div>
      
      {/* Current Selection Info */}
      <div className="flex items-center gap-3 p-3 rounded-xl bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800">
        <span className="text-2xl">{currentLang.flag}</span>
        <div className="flex-1">
          <div className="font-medium text-emerald-800 dark:text-emerald-200">
            {currentLang.name}
          </div>
          <div className="text-sm text-emerald-600 dark:text-emerald-400">
            {t("gardenDashboard.settingsSection.adviceWillBeIn", "Your gardening advice will be in {{language}}", { language: currentLang.name })}
          </div>
        </div>
      </div>
      
      {/* Save Button */}
      {canEdit && languageChanged && (
        <div className="flex justify-end pt-2">
          <Button
            onClick={handleSave}
            disabled={saving || !languageChanged}
            className="rounded-xl gap-2"
            size="sm"
          >
            {saving ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                {t("common.saving", "Saving...")}
              </>
            ) : saved ? (
              <>
                <Check className="w-4 h-4" />
                {t("common.saved", "Saved!")}
              </>
            ) : (
              t("common.save", "Save")
            )}
          </Button>
        </div>
      )}
      
    </div>
  );
};

export default GardenAdviceLanguageEditor;
