/**
 * Garden AI Features Toggle
 * 
 * Toggle to enable/disable ALL AI features in this garden.
 * When disabled (hide_ai_chat = true):
 * - The AI chat bubble will not appear
 * - The Gardener Advice section will be hidden
 * Default is enabled (AI features visible).
 */

import React, { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Sparkles, Loader2, Check, X } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { supabase } from "@/lib/supabaseClient";
import type { Garden } from "@/types/garden";

interface GardenAiChatToggleProps {
  garden: Garden | null;
  onSaved: () => Promise<void>;
  canEdit: boolean;
}

export const GardenAiChatToggle: React.FC<GardenAiChatToggleProps> = ({
  garden,
  onSaved,
  canEdit,
}) => {
  const { t } = useTranslation("common");
  const [isUpdating, setIsUpdating] = useState(false);
  // AI features enabled means hide_ai_chat is false
  const [aiEnabled, setAiEnabled] = useState(!(garden?.hideAiChat ?? false));
  const [error, setError] = useState<string | null>(null);

  // Sync with garden prop when it changes
  useEffect(() => {
    setAiEnabled(!(garden?.hideAiChat ?? false));
  }, [garden?.hideAiChat]);

  const handleToggle = async (checked: boolean) => {
    if (!garden || !canEdit || isUpdating) return;

    // checked = true means AI is enabled, so hide_ai_chat = false
    const hideAiChat = !checked;
    setIsUpdating(true);
    setError(null);

    try {
      const { error: updateError } = await supabase
        .from("gardens")
        .update({ hide_ai_chat: hideAiChat })
        .eq("id", garden.id);

      if (updateError) throw updateError;

      setAiEnabled(checked);
      await onSaved();
    } catch (err: unknown) {
      console.error("Failed to update AI features setting:", err);
      setError(t("common.error", "Something went wrong"));
      // Revert on error
      setAiEnabled(!checked);
    } finally {
      setIsUpdating(false);
    }
  };

  if (!garden) return null;

  return (
    <div className="space-y-4">
      {/* Main toggle row */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-start gap-4">
          <div className={`p-2.5 rounded-xl flex-shrink-0 ${!aiEnabled ? 'bg-stone-100 dark:bg-stone-800' : 'bg-emerald-100 dark:bg-emerald-900/30'}`}>
            {isUpdating ? (
              <Loader2 className="w-5 h-5 animate-spin text-stone-400" />
            ) : (
              <Sparkles className={`w-5 h-5 ${!aiEnabled ? 'text-stone-400' : 'text-emerald-600 dark:text-emerald-400'}`} />
            )}
          </div>
          <div className="flex-1 min-w-0">
            <h4 className="font-medium text-sm">
              {t("gardenSettings.aiFeatures.label", "AI Features")}
            </h4>
            <p className="text-xs text-muted-foreground mt-0.5">
              {t(
                "gardenSettings.aiFeatures.description",
                "Control all AI-powered features including the chat assistant and weekly gardener advice"
              )}
            </p>
          </div>
        </div>
        
        <div className="flex items-center gap-3 flex-shrink-0">
          <Switch
            checked={aiEnabled}
            onCheckedChange={handleToggle}
            disabled={!canEdit || isUpdating}
            id="ai-features-toggle"
          />
        </div>
      </div>

      {/* Status indicator */}
      <div className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm ${
        aiEnabled 
          ? 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-300' 
          : 'bg-stone-100 dark:bg-stone-800 text-stone-600 dark:text-stone-400'
      }`}>
        {aiEnabled ? (
          <Check className="w-4 h-4" />
        ) : (
          <X className="w-4 h-4" />
        )}
        <span>
          {aiEnabled
            ? t("gardenSettings.aiFeatures.statusEnabled", "AI features are enabled")
            : t("gardenSettings.aiFeatures.statusDisabled", "AI features are disabled")}
        </span>
      </div>

      {/* Feature list showing what will be affected */}
      <div className="bg-stone-50 dark:bg-stone-800/50 rounded-xl p-3 space-y-2">
        <p className="text-xs font-medium text-stone-600 dark:text-stone-300">
          {t("gardenSettings.aiFeatures.affectedFeatures", "This setting affects:")}
        </p>
        <ul className="text-xs text-muted-foreground space-y-1">
          <li className="flex items-center gap-2">
            {!aiEnabled ? <X className="w-3 h-3 text-red-500" /> : <Check className="w-3 h-3 text-emerald-500" />}
            {t("gardenSettings.aiFeatures.chatBubble", "AI Chat Assistant (bottom right)")}
          </li>
          <li className="flex items-center gap-2">
            {!aiEnabled ? <X className="w-3 h-3 text-red-500" /> : <Check className="w-3 h-3 text-emerald-500" />}
            {t("gardenSettings.aiFeatures.gardenerAdvice", "Weekly Gardener Advice")}
          </li>
        </ul>
      </div>

      {error && (
        <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
      )}

      {!canEdit && (
        <p className="text-xs text-muted-foreground italic">
          {t("gardenSettings.aiFeatures.ownerOnly", "Only garden owners can change this setting")}
        </p>
      )}
    </div>
  );
};

export default GardenAiChatToggle;
