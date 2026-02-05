import React from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Settings,
  MapPin,
  Globe,
  Shield,
  Users,
  Trash2,
  LogOut,
  ChevronRight,
  Sparkles,
} from "lucide-react";
import type { Garden } from "@/types/garden";

// Settings category type
type SettingsCategory = "general" | "location" | "privacy" | "members" | "danger";

interface GardenSettingsSectionProps {
  garden: Garden;
  members: Array<{
    userId: string;
    displayName?: string | null;
    email?: string | null;
    role: "owner" | "member";
    joinedAt?: string;
    accentKey?: string | null;
    avatarUrl?: string | null;
  }>;
  profile: { language?: string | null; is_private?: boolean } | null;
  viewerIsOwner: boolean;
  isOwner: boolean;
  currentUserId: string | null;
  ownersCount: number;
  onSaved: () => Promise<void>;
  onRefreshGarden: () => Promise<void>;
  onDeleteGarden: () => Promise<void>;
  onQuitGarden: () => Promise<void>;
  onInviteMember: () => void;
  onMemberChanged: () => Promise<void>;
  /** When provided, the settings panel opens on this category instead of "general". */
  initialCategory?: SettingsCategory;
  // Editor components passed in
  GardenDetailsEditor: React.ComponentType<{ garden: Garden | null; onSaved: () => Promise<void>; canEdit: boolean }>;
  GardenLocationEditor: React.ComponentType<{ garden: Garden | null; onSaved: () => Promise<void>; canEdit: boolean }>;
  GardenAdviceLanguageEditor: React.ComponentType<{ garden: Garden | null; userProfileLanguage?: string | null; onSaved: () => Promise<void>; canEdit: boolean }>;
  GardenPrivacyToggle: React.ComponentType<{ garden: Garden | null; onSaved: () => Promise<void>; canEdit: boolean; ownerIsPrivate: boolean }>;
  GardenAiChatToggle: React.ComponentType<{ garden: Garden | null; onSaved: () => Promise<void>; canEdit: boolean }>;
  MemberCard: React.ComponentType<{ member: GardenSettingsSectionProps["members"][0]; gardenId: string; onChanged: () => Promise<void>; viewerIsOwner: boolean; ownerCount: number; currentUserId: string | null }>;
}

export const GardenSettingsSection: React.FC<GardenSettingsSectionProps> = ({
  garden,
  members,
  profile,
  viewerIsOwner,
  isOwner,
  currentUserId,
  ownersCount,
  onSaved,
  onRefreshGarden,
  onDeleteGarden,
  onQuitGarden,
  onInviteMember,
  onMemberChanged,
  initialCategory,
  GardenDetailsEditor,
  GardenLocationEditor,
  GardenAdviceLanguageEditor,
  GardenPrivacyToggle,
  GardenAiChatToggle,
  MemberCard,
}) => {
  const { t } = useTranslation("common");
  const [activeCategory, setActiveCategory] = React.useState<SettingsCategory>(initialCategory || "general");

  // Sync with prop when it changes (e.g. deep-link from Weather tab)
  React.useEffect(() => {
    if (initialCategory) setActiveCategory(initialCategory);
  }, [initialCategory]);

  const categories: Array<{
    id: SettingsCategory;
    label: string;
    icon: React.ReactNode;
    description: string;
  }> = [
    {
      id: "general",
      label: t("gardenDashboard.settingsSection.general", "General"),
      icon: <Settings className="w-5 h-5" />,
      description: t("gardenDashboard.settingsSection.generalDescription", "Name, cover image, language"),
    },
    {
      id: "location",
      label: t("gardenDashboard.settingsSection.location", "Location"),
      icon: <MapPin className="w-5 h-5" />,
      description: t("gardenDashboard.settingsSection.locationDescriptionShort", "Weather & forecasts"),
    },
    {
      id: "privacy",
      label: t("gardenDashboard.settingsSection.privacy", "Privacy"),
      icon: <Shield className="w-5 h-5" />,
      description: t("gardenDashboard.settingsSection.privacyDescriptionShort", "Who can see your garden"),
    },
    {
      id: "members",
      label: t("gardenDashboard.settingsSection.members", "Members"),
      icon: <Users className="w-5 h-5" />,
      description: t("gardenDashboard.settingsSection.membersDescriptionShort", "{{count}} members", { count: members.length }),
    },
    {
      id: "danger",
      label: t("gardenDashboard.settingsSection.dangerZone", "Danger Zone"),
      icon: <Trash2 className="w-5 h-5" />,
      description: t("gardenDashboard.settingsSection.dangerZoneDescription", "Delete or leave garden"),
    },
  ];

  return (
    <div className="flex flex-col lg:flex-row gap-6">
      {/* Sidebar Navigation */}
      <div className="lg:w-64 flex-shrink-0">
        <Card className="rounded-2xl border border-stone-200/70 dark:border-[#3e3e42]/70 bg-white/90 dark:bg-[#1f1f1f]/90 backdrop-blur overflow-hidden">
          <div className="p-4 border-b border-stone-200/50 dark:border-stone-700/50">
            <h2 className="font-semibold text-lg">{t("gardenDashboard.settings", "Settings")}</h2>
            <p className="text-sm text-muted-foreground mt-1">
              {t("gardenDashboard.settingsSection.subtitle", "Manage your garden")}
            </p>
          </div>
          <nav className="p-2">
            {categories.map((cat) => (
              <button
                key={cat.id}
                onClick={() => setActiveCategory(cat.id)}
                className={`w-full flex items-center gap-3 px-3 py-3 rounded-xl text-left transition-all ${
                  activeCategory === cat.id
                    ? "bg-emerald-100 dark:bg-emerald-900/30 text-emerald-800 dark:text-emerald-200"
                    : "hover:bg-stone-100 dark:hover:bg-stone-800/50 text-stone-700 dark:text-stone-300"
                }`}
              >
                <span className={activeCategory === cat.id ? "text-emerald-600 dark:text-emerald-400" : "text-stone-500"}>
                  {cat.icon}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-sm">{cat.label}</div>
                  <div className="text-xs text-muted-foreground truncate">{cat.description}</div>
                </div>
                <ChevronRight className={`w-4 h-4 transition-transform ${activeCategory === cat.id ? "rotate-90" : ""}`} />
              </button>
            ))}
          </nav>
        </Card>

        {/* Quick Info Card */}
        <Card className="mt-4 rounded-2xl border border-stone-200/70 dark:border-[#3e3e42]/70 bg-gradient-to-br from-emerald-50/80 to-white dark:from-emerald-900/20 dark:to-[#1f1f1f] p-4">
          <div className="text-xs text-muted-foreground mb-2">
            {t("garden.created", "Created")}
          </div>
          <div className="font-medium">
            {new Date(garden.createdAt).toLocaleDateString(undefined, {
              year: "numeric",
              month: "long",
              day: "numeric",
            })}
          </div>
          {(garden.streak ?? 0) > 0 && (
            <div className="mt-3 flex items-center gap-2 text-sm">
              <span className="text-orange-500">🔥</span>
              <span>{garden.streak} {t("gardenDashboard.streak", "day streak")}</span>
            </div>
          )}
        </Card>
      </div>

      {/* Main Content */}
      <div className="flex-1 min-w-0">
        {/* General Settings */}
        {activeCategory === "general" && (
          <div className="space-y-6">
            <div>
              <h3 className="text-xl font-semibold mb-2 flex items-center gap-2">
                <Settings className="w-5 h-5 text-emerald-600" />
                {t("gardenDashboard.settingsSection.gardenDetails", "Garden Details")}
              </h3>
              <p className="text-sm text-muted-foreground mb-4">
                {t("gardenDashboard.settingsSection.gardenDetailsDescription", "Update your garden's name and cover image")}
              </p>
              <Card className="rounded-2xl border border-stone-200/70 dark:border-[#3e3e42]/70 bg-white/90 dark:bg-[#1f1f1f]/90 backdrop-blur p-6">
                <GardenDetailsEditor
                  garden={garden}
                  onSaved={onSaved}
                  canEdit={viewerIsOwner}
                />
              </Card>
            </div>

            <div>
              <h3 className="text-xl font-semibold mb-2 flex items-center gap-2">
                <Globe className="w-5 h-5 text-blue-600" />
                {t("gardenDashboard.settingsSection.adviceLanguage", "Advice Language")}
              </h3>
              <p className="text-sm text-muted-foreground mb-4">
                {t("gardenDashboard.settingsSection.adviceLanguageDescription", "Choose the language for your personalized gardening advice.")}
              </p>
              <Card className="rounded-2xl border border-stone-200/70 dark:border-[#3e3e42]/70 bg-white/90 dark:bg-[#1f1f1f]/90 backdrop-blur p-6">
                <GardenAdviceLanguageEditor
                  garden={garden}
                  userProfileLanguage={profile?.language}
                  onSaved={onRefreshGarden}
                  canEdit={viewerIsOwner}
                />
              </Card>
            </div>

            <div>
              <h3 className="text-xl font-semibold mb-2 flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-emerald-600" />
                {t("gardenDashboard.settingsSection.aiFeatures", "AI Features")}
              </h3>
              <p className="text-sm text-muted-foreground mb-4">
                {t("gardenDashboard.settingsSection.aiFeaturesDescription", "Enable or disable all AI-powered features for this garden, including the chat assistant and gardener advice.")}
              </p>
              <Card className="rounded-2xl border border-stone-200/70 dark:border-[#3e3e42]/70 bg-white/90 dark:bg-[#1f1f1f]/90 backdrop-blur p-6">
                <GardenAiChatToggle
                  garden={garden}
                  onSaved={onRefreshGarden}
                  canEdit={viewerIsOwner}
                />
              </Card>
            </div>
          </div>
        )}

        {/* Location Settings */}
        {activeCategory === "location" && (
          <div>
            <h3 className="text-xl font-semibold mb-2 flex items-center gap-2">
              <MapPin className="w-5 h-5 text-emerald-600" />
              {t("gardenDashboard.settingsSection.location", "Location")}
            </h3>
            <p className="text-sm text-muted-foreground mb-4">
              {t("gardenDashboard.settingsSection.locationDescription", "Set your garden's location to get weather-based advice and forecasts.")}
            </p>
            <Card className="rounded-2xl border border-stone-200/70 dark:border-[#3e3e42]/70 bg-white/90 dark:bg-[#1f1f1f]/90 backdrop-blur p-6">
              <GardenLocationEditor
                garden={garden}
                onSaved={onRefreshGarden}
                canEdit={viewerIsOwner}
              />
            </Card>
          </div>
        )}

        {/* Privacy Settings */}
        {activeCategory === "privacy" && (
          <div>
            <h3 className="text-xl font-semibold mb-2 flex items-center gap-2">
              <Shield className="w-5 h-5 text-purple-600" />
              {t("gardenDashboard.settingsSection.privacy", "Privacy")}
            </h3>
            <p className="text-sm text-muted-foreground mb-4">
              {t("gardenDashboard.settingsSection.privacyDescription", "Control who can see and access your garden")}
            </p>
            <Card className="rounded-2xl border border-stone-200/70 dark:border-[#3e3e42]/70 bg-white/90 dark:bg-[#1f1f1f]/90 backdrop-blur p-6">
              <GardenPrivacyToggle
                garden={garden}
                onSaved={onSaved}
                canEdit={viewerIsOwner}
                ownerIsPrivate={profile?.is_private || false}
              />
            </Card>
          </div>
        )}

        {/* Members Settings */}
        {activeCategory === "members" && (
          <div>
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-xl font-semibold flex items-center gap-2">
                  <Users className="w-5 h-5 text-blue-600" />
                  {t("gardenDashboard.settingsSection.manageMembers", "Members")}
                </h3>
                <p className="text-sm text-muted-foreground mt-1">
                  {t("gardenDashboard.settingsSection.membersDescription", "Manage who can access and edit this garden")}
                </p>
              </div>
              {viewerIsOwner && (
                <Button
                  onClick={onInviteMember}
                  className="rounded-xl gap-2"
                >
                  <Users className="w-4 h-4" />
                  {t("gardenDashboard.settingsSection.addMember", "Add Member")}
                </Button>
              )}
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {members.map((m) => (
                <MemberCard
                  key={m.userId}
                  member={m}
                  gardenId={garden.id}
                  onChanged={onMemberChanged}
                  viewerIsOwner={viewerIsOwner}
                  ownerCount={ownersCount}
                  currentUserId={currentUserId}
                />
              ))}
            </div>
            
            {members.length === 0 && (
              <Card className="rounded-2xl border border-stone-200/70 dark:border-[#3e3e42]/70 bg-white/90 dark:bg-[#1f1f1f]/90 p-8 text-center">
                <Users className="w-12 h-12 mx-auto text-stone-400 mb-3" />
                <p className="text-muted-foreground">
                  {t("gardenDashboard.settingsSection.noMembers", "No members yet")}
                </p>
              </Card>
            )}
          </div>
        )}

        {/* Danger Zone */}
        {activeCategory === "danger" && (
          <div>
            <h3 className="text-xl font-semibold mb-2 flex items-center gap-2 text-red-600">
              <Trash2 className="w-5 h-5" />
              {t("gardenDashboard.settingsSection.dangerZone", "Danger Zone")}
            </h3>
            <p className="text-sm text-muted-foreground mb-4">
              {t("gardenDashboard.settingsSection.dangerZoneWarning", "These actions cannot be undone. Please proceed with caution.")}
            </p>
            
            <Card className="rounded-2xl border-2 border-red-200 dark:border-red-900/50 bg-red-50/50 dark:bg-red-900/10 p-6">
              {isOwner ? (
                <div className="space-y-4">
                  <div>
                    <h4 className="font-semibold text-red-800 dark:text-red-200 mb-2">
                      {t("gardenDashboard.settingsSection.deleteGardenTitle", "Delete this garden")}
                    </h4>
                    <p className="text-sm text-red-700 dark:text-red-300 mb-4">
                      {t("gardenDashboard.settingsSection.deleteGardenWarning", "This will permanently delete the garden, all its plants, tasks, and journal entries. This action cannot be undone.")}
                    </p>
                    <Button
                      variant="destructive"
                      onClick={onDeleteGarden}
                      className="rounded-xl gap-2"
                    >
                      <Trash2 className="w-4 h-4" />
                      {t("gardenDashboard.settingsSection.deleteGarden", "Delete Garden")}
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  <div>
                    <h4 className="font-semibold text-red-800 dark:text-red-200 mb-2">
                      {t("gardenDashboard.settingsSection.leaveGardenTitle", "Leave this garden")}
                    </h4>
                    <p className="text-sm text-red-700 dark:text-red-300 mb-4">
                      {t("gardenDashboard.settingsSection.leaveGardenWarning", "You will no longer have access to this garden. You can be re-invited by an owner.")}
                    </p>
                    <Button
                      variant="destructive"
                      onClick={onQuitGarden}
                      className="rounded-xl gap-2"
                    >
                      <LogOut className="w-4 h-4" />
                      {t("gardenDashboard.settingsSection.quitGarden", "Leave Garden")}
                    </Button>
                  </div>
                </div>
              )}
            </Card>
          </div>
        )}
      </div>
    </div>
  );
};

export default GardenSettingsSection;
