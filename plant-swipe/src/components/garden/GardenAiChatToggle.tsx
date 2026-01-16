/**
 * Garden AI Chat Toggle
 * 
 * Toggle to show/hide the AI chat bubble in this garden.
 * When checked (hide_ai_chat = true), the chat bubble will not appear.
 * Default is unchecked (chat visible).
 */

import React, { useState } from "react";
import { useTranslation } from "react-i18next";
import { Sparkles, Loader2, Check } from "lucide-react";
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
  const [hideChat, setHideChat] = useState(garden?.hideAiChat ?? false);
  const [error, setError] = useState<string | null>(null);

  const handleToggle = async () => {
    if (!garden || !canEdit || isUpdating) return;

    const newValue = !hideChat;
    setIsUpdating(true);
    setError(null);

    try {
      const { error: updateError } = await supabase
        .from("gardens")
        .update({ hide_ai_chat: newValue })
        .eq("id", garden.id);

      if (updateError) throw updateError;

      setHideChat(newValue);
      await onSaved();
    } catch (err: unknown) {
      console.error("Failed to update AI chat setting:", err);
      setError(t("common.error", "Something went wrong"));
    } finally {
      setIsUpdating(false);
    }
  };

  if (!garden) return null;

  return (
    <div className="space-y-4">
      <div className="flex items-start gap-4">
        <div className="p-2.5 rounded-xl bg-emerald-100 dark:bg-emerald-900/30 flex-shrink-0">
          <Sparkles className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
        </div>
        <div className="flex-1 min-w-0">
          <h4 className="font-medium text-sm">
            {t("gardenSettings.aiChat.hideLabel", "Hide AI Chat")}
          </h4>
          <p className="text-xs text-muted-foreground mt-0.5">
            {t(
              "gardenSettings.aiChat.hideDescription",
              "When enabled, the AI assistant chat bubble will not appear in this garden"
            )}
          </p>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <Button
          variant={hideChat ? "default" : "outline"}
          size="sm"
          onClick={handleToggle}
          disabled={!canEdit || isUpdating}
          className={`rounded-xl gap-2 ${
            hideChat 
              ? "bg-stone-800 dark:bg-stone-200 text-white dark:text-stone-900" 
              : ""
          }`}
        >
          {isUpdating ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : hideChat ? (
            <Check className="w-4 h-4" />
          ) : null}
          {hideChat
            ? t("gardenSettings.aiChat.hidden", "Hidden")
            : t("gardenSettings.aiChat.visible", "Visible")}
        </Button>

        <span className="text-xs text-muted-foreground">
          {hideChat
            ? t("gardenSettings.aiChat.chatIsHidden", "Chat bubble is hidden")
            : t("gardenSettings.aiChat.chatIsVisible", "Chat bubble is visible")}
        </span>
      </div>

      {error && (
        <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
      )}

      {!canEdit && (
        <p className="text-xs text-muted-foreground italic">
          {t("gardenSettings.aiChat.ownerOnly", "Only garden owners can change this setting")}
        </p>
      )}
    </div>
  );
};

export default GardenAiChatToggle;
