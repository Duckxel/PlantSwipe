/**
 * Garden AI Features Toggle
 * 
 * Toggle to enable/disable ALL AI features in this garden.
 * When disabled (hide_ai_chat = true):
 * - The AI chat bubble will not appear
 * - The Gardener Advice section will be hidden
 * Default is enabled (AI features visible).
 */

import React, { useState } from "react";
import { useTranslation } from "react-i18next";
import { Sparkles, Loader2, Check, X } from "lucide-react";
import { Button } from "@/components/ui/button";
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
  const [hideAiFeatures, setHideAiFeatures] = useState(garden?.hideAiChat ?? false);
  const [error, setError] = useState<string | null>(null);

  const handleToggle = async () => {
    if (!garden || !canEdit || isUpdating) return;

    const newValue = !hideAiFeatures;
    setIsUpdating(true);
    setError(null);

    try {
      const { error: updateError } = await supabase
        .from("gardens")
        .update({ hide_ai_chat: newValue })
        .eq("id", garden.id);

      if (updateError) throw updateError;

      setHideAiFeatures(newValue);
      await onSaved();
    } catch (err: unknown) {
      console.error("Failed to update AI features setting:", err);
      setError(t("common.error", "Something went wrong"));
    } finally {
      setIsUpdating(false);
    }
  };

  if (!garden) return null;

  return (
    <div className="space-y-4">
      <div className="flex items-start gap-4">
        <div className={`p-2.5 rounded-xl flex-shrink-0 ${hideAiFeatures ? 'bg-stone-100 dark:bg-stone-800' : 'bg-emerald-100 dark:bg-emerald-900/30'}`}>
          <Sparkles className={`w-5 h-5 ${hideAiFeatures ? 'text-stone-400' : 'text-emerald-600 dark:text-emerald-400'}`} />
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

      {/* Feature list showing what will be affected */}
      <div className="bg-stone-50 dark:bg-stone-800/50 rounded-xl p-3 space-y-2">
        <p className="text-xs font-medium text-stone-600 dark:text-stone-300">
          {t("gardenSettings.aiFeatures.affectedFeatures", "This setting affects:")}
        </p>
        <ul className="text-xs text-muted-foreground space-y-1">
          <li className="flex items-center gap-2">
            {hideAiFeatures ? <X className="w-3 h-3 text-red-500" /> : <Check className="w-3 h-3 text-emerald-500" />}
            {t("gardenSettings.aiFeatures.chatBubble", "AI Chat Assistant (bottom right)")}
          </li>
          <li className="flex items-center gap-2">
            {hideAiFeatures ? <X className="w-3 h-3 text-red-500" /> : <Check className="w-3 h-3 text-emerald-500" />}
            {t("gardenSettings.aiFeatures.gardenerAdvice", "Weekly Gardener Advice")}
          </li>
        </ul>
      </div>

      <div className="flex items-center gap-3">
        <Button
          variant={hideAiFeatures ? "outline" : "default"}
          size="sm"
          onClick={handleToggle}
          disabled={!canEdit || isUpdating}
          className={`rounded-xl gap-2 ${
            !hideAiFeatures 
              ? "bg-emerald-600 hover:bg-emerald-700 text-white" 
              : "border-stone-300 dark:border-stone-600"
          }`}
        >
          {isUpdating ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : !hideAiFeatures ? (
            <Check className="w-4 h-4" />
          ) : (
            <X className="w-4 h-4" />
          )}
          {hideAiFeatures
            ? t("gardenSettings.aiFeatures.disabled", "Disabled")
            : t("gardenSettings.aiFeatures.enabled", "Enabled")}
        </Button>

        <span className="text-xs text-muted-foreground">
          {hideAiFeatures
            ? t("gardenSettings.aiFeatures.statusDisabled", "AI features are disabled")
            : t("gardenSettings.aiFeatures.statusEnabled", "AI features are enabled")}
        </span>
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
