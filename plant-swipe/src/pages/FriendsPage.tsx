import React from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { useAuth } from "@/context/AuthContext";
import { supabase } from "@/lib/supabaseClient";
import { 
  User, 
  UserPlus, 
  Check, 
  X, 
  Clock,
  Users,
  Inbox,
  SendHorizontal,
  Loader2,
  MoreHorizontal,
  ExternalLink,
  UserMinus
} from "lucide-react";
import { SearchInput } from "@/components/ui/search-input";
import { createPortal } from "react-dom";
import { useTranslation } from "react-i18next";
import { useLanguageNavigate } from "@/lib/i18nRouting";
import { sendFriendRequestPushNotification, refreshAppBadge } from "@/lib/notifications";
import { areUsersBlocked } from "@/lib/moderation";
import { cn } from "@/lib/utils";

type FriendRequest = {
  id: string;
  requester_id: string;
  recipient_id: string;
  created_at: string;
  status: "pending" | "accepted" | "rejected";
  requester_profile?: {
    id: string;
    display_name: string | null;
    email?: string | null;
  };
  recipient_profile?: {
    id: string;
    display_name: string | null;
    email?: string | null;
  };
};

type Friend = {
  id: string;
  user_id: string;
  friend_id: string;
  created_at: string;
  friend_profile?: {
    id: string;
    display_name: string | null;
    email?: string | null;
  };
};

type SearchResult = {
  id: string;
  display_name: string | null;
  email?: string | null;
  is_friend?: boolean;
  is_pending?: boolean;
};

/**
 * Format a date string to relative time
 */
function formatRelativeTime(dateString: string): string {
  try {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffSeconds = Math.floor(diffMs / 1000);
    const diffMinutes = Math.floor(diffSeconds / 60);
    const diffHours = Math.floor(diffMinutes / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffSeconds < 60) return "Just now";
    if (diffMinutes < 60) return `${diffMinutes}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays === 1) return "Yesterday";
    if (diffDays < 7) return `${diffDays}d ago`;
    
    return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
  } catch {
    return "";
  }
}

/**
 * Get initials from a display name
 */
function getInitials(name: string | null | undefined): string {
  if (!name) return "?";
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }
  return name.charAt(0).toUpperCase();
}

export const FriendsPage: React.FC = () => {
  const { user, profile } = useAuth();
  const navigate = useLanguageNavigate();
  const { t } = useTranslation("common");
  const [friends, setFriends] = React.useState<Friend[]>([]);
  const [pendingRequests, setPendingRequests] = React.useState<FriendRequest[]>([]);
  const [sentPendingRequests, setSentPendingRequests] = React.useState<FriendRequest[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [processingId, setProcessingId] = React.useState<string | null>(null);
  const [menuOpenId, setMenuOpenId] = React.useState<string | null>(null);
  const [menuPos, setMenuPos] = React.useState<{ top: number; left: number } | null>(null);
  const [confirmingRemove, setConfirmingRemove] = React.useState<string | null>(null);
  const [addFriendDialogOpen, setAddFriendDialogOpen] = React.useState(false);
  const [dialogSearchQuery, setDialogSearchQuery] = React.useState("");
  const [dialogSearchResults, setDialogSearchResults] = React.useState<SearchResult[]>([]);
  const [dialogSearching, setDialogSearching] = React.useState(false);
  
  const menuButtonRefs = React.useRef<Map<string, HTMLButtonElement>>(new Map());
  const menuRef = React.useRef<HTMLDivElement>(null);

  // Load friends
  const loadFriends = React.useCallback(async () => {
    if (!user?.id) return;
    try {
      const { data, error: err } = await supabase
        .from("friends")
        .select("id, user_id, friend_id, created_at")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });

      if (err) throw err;

      const friendIds = (data || []).map((f) => f.friend_id);
      if (friendIds.length > 0) {
        const { data: profiles } = await supabase
          .from("profiles")
          .select("id, display_name")
          .in("id", friendIds);

        const profileMap = new Map((profiles || []).map((p) => [p.id, p]));
        const friendsWithProfiles = (data || []).map((f) => ({
          ...f,
          friend_profile: profileMap.get(f.friend_id) || { id: f.friend_id, display_name: null },
        }));
        setFriends(friendsWithProfiles as Friend[]);
      } else {
        setFriends([]);
      }
    } catch (e: any) {
      setError(e?.message || t("friends.errors.failedToLoad"));
    }
  }, [user?.id, t]);

  // Load sent pending requests
  const loadSentPendingRequests = React.useCallback(async () => {
    if (!user?.id) return;
    try {
      const { data, error: err } = await supabase
        .from("friend_requests")
        .select("id, requester_id, recipient_id, created_at, status")
        .eq("requester_id", user.id)
        .eq("status", "pending")
        .order("created_at", { ascending: false });

      if (err) throw err;

      const recipientIds = (data || []).map((r) => r.recipient_id);
      if (recipientIds.length > 0) {
        const { data: profiles } = await supabase
          .from("profiles")
          .select("id, display_name")
          .in("id", recipientIds);

        const profileMap = new Map((profiles || []).map((p) => [p.id, p]));
        const requestsWithProfiles = (data || []).map((r) => ({
          ...r,
          recipient_profile: {
            id: r.recipient_id,
            display_name: profileMap.get(r.recipient_id)?.display_name || null,
          },
        }));
        setSentPendingRequests(requestsWithProfiles as FriendRequest[]);
      } else {
        setSentPendingRequests([]);
      }
    } catch (e: any) {
      setError(e?.message || t("friends.errors.failedToLoadSentRequests"));
    }
  }, [user?.id, t]);

  // Load pending requests received
  const loadPendingRequests = React.useCallback(async () => {
    if (!user?.id) return;
    try {
      const { data, error: err } = await supabase
        .from("friend_requests")
        .select("id, requester_id, recipient_id, created_at, status")
        .eq("recipient_id", user.id)
        .eq("status", "pending")
        .order("created_at", { ascending: false });

      if (err) throw err;

      const requesterIds = (data || []).map((r) => r.requester_id);
      if (requesterIds.length > 0) {
        const { data: profiles } = await supabase
          .from("profiles")
          .select("id, display_name")
          .in("id", requesterIds);

        const profileMap = new Map((profiles || []).map((p) => [p.id, p]));
        const requestsWithProfiles = (data || []).map((r) => ({
          ...r,
          requester_profile: {
            id: r.requester_id,
            display_name: profileMap.get(r.requester_id)?.display_name || null,
          },
        }));
        setPendingRequests(requestsWithProfiles as FriendRequest[]);
      } else {
        setPendingRequests([]);
      }
    } catch (e: any) {
      setError(e?.message || t("friends.errors.failedToLoadRequests"));
    }
  }, [user?.id, t]);

  // Initial load
  React.useEffect(() => {
    if (!user?.id) {
      setLoading(false);
      return;
    }
    setLoading(true);
    Promise.all([loadFriends(), loadPendingRequests(), loadSentPendingRequests()])
      .finally(() => setLoading(false));
  }, [user?.id, loadFriends, loadPendingRequests, loadSentPendingRequests]);

  // Dialog search - uses RPC function to properly search profiles with RLS
  const handleDialogSearch = React.useCallback(async () => {
    if (!dialogSearchQuery.trim() || !user?.id) {
      setDialogSearchResults([]);
      return;
    }
    setDialogSearching(true);
    try {
      const query = dialogSearchQuery.trim();

      // Use the search_user_profiles RPC function which handles RLS properly
      const { data, error: err } = await supabase.rpc("search_user_profiles", {
        _term: query,
        _limit: 10,
      });

      if (err) {
        // Fallback to direct query if RPC doesn't exist
        console.warn("[FriendsPage] RPC search failed, trying direct query:", err.message);
        const { data: fallbackData, error: fallbackErr } = await supabase
          .from("profiles")
          .select("id, display_name")
          .ilike("display_name", `%${query}%`)
          .neq("id", user.id)
          .limit(10);
        
        if (fallbackErr) throw fallbackErr;
        
        const results: SearchResult[] = (fallbackData || []).map((p) => ({
          id: p.id,
          display_name: p.display_name || null,
          is_friend: false,
          is_pending: false,
        }));
        
        await markResultsWithFriendStatus(results);
        return;
      }

      // Map RPC results to SearchResult format
      let results: SearchResult[] = (data || [])
        .filter((p: any) => p.id !== user.id)
        .map((p: any) => ({
          id: p.id,
          display_name: p.display_name || p.username || null,
          is_friend: Boolean(p.is_friend),
          is_pending: false,
        }));

      // Check for email search (admin feature)
      if (query.includes("@")) {
        try {
          const response = await fetch(`/api/admin/member?q=${encodeURIComponent(query)}`, {
            credentials: "same-origin",
          });
          if (response.ok) {
            const memberData = await response.json();
            if (memberData.id && memberData.id !== user.id) {
              const existingIndex = results.findIndex((r) => r.id === memberData.id);
              if (existingIndex >= 0) {
                results[existingIndex].email = memberData.email || null;
              } else {
                results.unshift({
                  id: memberData.id,
                  display_name: memberData.profile?.display_name || null,
                  email: memberData.email || null,
                  is_friend: false,
                  is_pending: false,
                });
              }
            }
          }
        } catch {
          // Ignore email search errors
        }
      }

      await markResultsWithFriendStatus(results);
    } catch (e: any) {
      setError(e?.message || t("friends.errors.searchFailed"));
      setDialogSearching(false);
    }
  }, [dialogSearchQuery, user?.id, t]);

  // Helper function to mark search results with friend/pending status
  const markResultsWithFriendStatus = React.useCallback(async (results: SearchResult[]) => {
    if (!user?.id) {
      setDialogSearchResults(results.slice(0, 5));
      setDialogSearching(false);
      return;
    }

    try {
      // Get friend IDs
      const friendIds = new Set(friends.map((f) => f.friend_id));
      
      // Get pending sent requests
      const { data: sentRequests } = await supabase
        .from("friend_requests")
        .select("recipient_id")
        .eq("requester_id", user.id)
        .eq("status", "pending");

      const requestIds = new Set([
        ...pendingRequests.map((r) => r.requester_id),
        ...(sentRequests?.map((r) => r.recipient_id) || []),
      ]);

      const filteredResults = results
        .filter((r) => r.id !== user.id)
        .map((r) => ({
          ...r,
          is_friend: r.is_friend || friendIds.has(r.id),
          is_pending: requestIds.has(r.id),
        }))
        .slice(0, 5);

      setDialogSearchResults(filteredResults);
    } catch {
      // If marking fails, still show results
      setDialogSearchResults(results.slice(0, 5));
    } finally {
      setDialogSearching(false);
    }
  }, [user?.id, friends, pendingRequests]);

  React.useEffect(() => {
    const timeout = setTimeout(() => handleDialogSearch(), 300);
    return () => clearTimeout(timeout);
  }, [dialogSearchQuery, handleDialogSearch]);

  // Send friend request notification
  const sendFriendRequestNotification = React.useCallback(async (recipientId: string) => {
    const senderName = profile?.display_name || "Someone";
    const { data: recipientProfile } = await supabase
      .from("profiles")
      .select("language")
      .eq("id", recipientId)
      .maybeSingle();
    sendFriendRequestPushNotification(recipientId, senderName, recipientProfile?.language || "en").catch(() => {});
  }, [profile?.display_name]);

  // Send friend request
  const sendFriendRequest = React.useCallback(async (recipientId: string) => {
    if (!user?.id) return;
    setProcessingId(recipientId);
    try {
      const blocked = await areUsersBlocked(user.id, recipientId);
      if (blocked) {
        setError(t("friends.errors.cannotSendRequest", { defaultValue: "Cannot send friend request to this user" }));
        return;
      }

      const { data: existingFriend } = await supabase
        .from("friends")
        .select("id")
        .eq("user_id", user.id)
        .eq("friend_id", recipientId)
        .maybeSingle();

      if (existingFriend) {
        setError(t("friends.errors.alreadyFriends"));
        return;
      }

      // Check for existing requests in BOTH directions
      const { data: existingRequest } = await supabase
        .from("friend_requests")
        .select("id, status, requester_id")
        .or(`and(requester_id.eq.${user.id},recipient_id.eq.${recipientId}),and(requester_id.eq.${recipientId},recipient_id.eq.${user.id})`)
        .maybeSingle();

      if (existingRequest) {
        if (existingRequest.status === "pending") {
          // If there's a pending request FROM the other user TO us, we should accept it instead
          if (existingRequest.requester_id === recipientId) {
            // Accept their request instead of sending a new one
            const { error: acceptErr } = await supabase.rpc("accept_friend_request", { _request_id: existingRequest.id });
            if (acceptErr) throw acceptErr;
            handleDialogSearch();
            await Promise.all([loadFriends(), loadPendingRequests(), loadSentPendingRequests()]);
            setError(null);
            return;
          }
          setError(t("friends.errors.requestAlreadySent"));
          return;
        }
        
        // For rejected or accepted requests, delete the old one and create a new one
        // This works regardless of RLS policies since we're creating a new record
        if (existingRequest.status === "rejected" || existingRequest.status === "accepted") {
          // Delete the old request (we can delete our own requests)
          await supabase
            .from("friend_requests")
            .delete()
            .eq("id", existingRequest.id);
        }
      }

      // Create a new friend request
      const { error: insertError } = await supabase.from("friend_requests").insert({
        requester_id: user.id,
        recipient_id: recipientId,
        status: "pending",
      });

      if (insertError) {
        throw insertError;
      }

      sendFriendRequestNotification(recipientId);
      handleDialogSearch();
      await loadSentPendingRequests();
      setError(null);
    } catch (e: any) {
      setError(e?.message || t("friends.errors.failedToSend"));
    } finally {
      setProcessingId(null);
    }
  }, [user?.id, sendFriendRequestNotification, handleDialogSearch, loadFriends, loadPendingRequests, loadSentPendingRequests, t]);

  // Accept request
  const acceptRequest = React.useCallback(async (requestId: string) => {
    setProcessingId(requestId);
    try {
      const { error } = await supabase.rpc("accept_friend_request", { _request_id: requestId });
      if (error) throw error;
      await Promise.all([loadFriends(), loadPendingRequests(), loadSentPendingRequests()]);
      setError(null);
      // Refresh app badge after accepting request
      if (user?.id) {
        refreshAppBadge(user.id).catch(() => {});
      }
    } catch (e: any) {
      setError(e?.message || t("friends.errors.failedToAccept"));
    } finally {
      setProcessingId(null);
    }
  }, [loadFriends, loadPendingRequests, loadSentPendingRequests, t, user?.id]);

  // Reject request
  const rejectRequest = React.useCallback(async (requestId: string) => {
    setProcessingId(requestId);
    try {
      const { error } = await supabase.from("friend_requests").update({ status: "rejected" }).eq("id", requestId);
      if (error) throw error;
      await Promise.all([loadPendingRequests(), loadSentPendingRequests()]);
      setError(null);
      // Refresh app badge after rejecting request
      if (user?.id) {
        refreshAppBadge(user.id).catch(() => {});
      }
    } catch (e: any) {
      setError(e?.message || t("friends.errors.failedToReject"));
    } finally {
      setProcessingId(null);
    }
  }, [loadPendingRequests, loadSentPendingRequests, t, user?.id]);

  // Cancel sent request
  const cancelRequest = React.useCallback(async (requestId: string) => {
    setProcessingId(requestId);
    try {
      await supabase.from("friend_requests").delete().eq("id", requestId);
      await loadSentPendingRequests();
      setError(null);
    } catch (e: any) {
      setError(e?.message || t("friends.errors.failedToCancel", { defaultValue: "Failed to cancel request" }));
    } finally {
      setProcessingId(null);
    }
  }, [loadSentPendingRequests, t]);

  // Remove friend
  const removeFriend = React.useCallback(async (friendId: string) => {
    if (!user?.id) return;
    setConfirmingRemove(null);
    setMenuOpenId(null);
    setProcessingId(friendId);
    try {
      await Promise.all([
        supabase.from("friends").delete().eq("user_id", user.id).eq("friend_id", friendId),
        supabase.from("friends").delete().eq("user_id", friendId).eq("friend_id", user.id),
      ]);
      await Promise.all([
        supabase.from("friend_requests").delete().eq("requester_id", user.id).eq("recipient_id", friendId),
        supabase.from("friend_requests").delete().eq("requester_id", friendId).eq("recipient_id", user.id),
      ]);
      await loadFriends();
      setError(null);
    } catch (e: any) {
      setError(e?.message || t("friends.errors.failedToRemove"));
    } finally {
      setProcessingId(null);
    }
  }, [user?.id, loadFriends, t]);

  // Navigate to profile
  const handleViewProfile = (displayName: string | null | undefined) => {
    if (!displayName?.trim()) return;
    navigate(`/u/${encodeURIComponent(displayName)}`);
  };

  // Menu positioning
  React.useEffect(() => {
    if (!menuOpenId) return;

    const updatePosition = () => {
      const button = menuButtonRefs.current.get(menuOpenId);
      if (!button) return;
      const rect = button.getBoundingClientRect();
      setMenuPos({
        top: rect.bottom + 8,
        left: Math.min(rect.left, window.innerWidth - 180),
      });
    };

    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Node;
      if (menuRef.current?.contains(target)) return;
      if (menuButtonRefs.current.get(menuOpenId)?.contains(target)) return;
      setMenuOpenId(null);
      setConfirmingRemove(null);
    };

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setMenuOpenId(null);
        setConfirmingRemove(null);
      }
    };

    updatePosition();
    document.addEventListener("click", handleClickOutside);
    document.addEventListener("keydown", handleEscape);
    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);

    return () => {
      document.removeEventListener("click", handleClickOutside);
      document.removeEventListener("keydown", handleEscape);
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
    };
  }, [menuOpenId]);

  // Not logged in
  if (!user) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-12">
        <div className="rounded-2xl border border-stone-200 dark:border-[#3e3e42] bg-white dark:bg-[#1e1e20] p-8 text-center">
          <Users className="h-12 w-12 mx-auto mb-4 text-stone-300 dark:text-stone-600" />
          <p className="text-stone-600 dark:text-stone-400">{t("friends.pleaseLogin")}</p>
        </div>
      </div>
    );
  }

  const totalPending = pendingRequests.length + sentPendingRequests.length;

  return (
    <div className="max-w-6xl mx-auto px-4 py-6 pb-24 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-stone-900 dark:text-white flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-blue-400 to-indigo-500 flex items-center justify-center shadow-lg shadow-blue-500/25">
              <Users className="h-5 w-5 text-white" />
            </div>
            {t("friends.title")}
          </h1>
          <p className="text-sm text-stone-500 dark:text-stone-400 mt-1">
            {friends.length} {t("friends.friends", { defaultValue: "friends" })}
            {totalPending > 0 && ` • ${totalPending} ${t("notifications.pending", { defaultValue: "pending" })}`}
          </p>
        </div>
        <Button
          onClick={() => {
            setAddFriendDialogOpen(true);
            setDialogSearchQuery("");
            setDialogSearchResults([]);
          }}
          className="rounded-xl bg-blue-500 hover:bg-blue-600 text-white shadow-md shadow-blue-500/25"
        >
          <UserPlus className="h-4 w-4 mr-2" />
          {t("friends.addFriend")}
        </Button>
      </div>

      {/* Error */}
      {error && (
        <div className="p-4 rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800/50 text-sm text-red-600 dark:text-red-400">
          {error}
          <button onClick={() => setError(null)} className="ml-2 underline">
            {t("common.dismiss", { defaultValue: "Dismiss" })}
          </button>
        </div>
      )}

      {/* Main Content */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Pending Requests Received */}
        <div className="lg:col-span-1 space-y-3">
          <div className="flex items-center gap-2 px-1">
            <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center">
              <Inbox className="h-4 w-4 text-white" />
            </div>
            <h2 className="font-semibold text-stone-900 dark:text-white">
              {t("friends.pendingInvitations", { defaultValue: "Received" })}
            </h2>
            {pendingRequests.length > 0 && (
              <span className="ml-auto h-6 min-w-6 px-2 rounded-full bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400 text-xs font-bold flex items-center justify-center">
                {pendingRequests.length}
              </span>
            )}
          </div>

          <div className="rounded-2xl border border-stone-200 dark:border-[#3e3e42] bg-white dark:bg-[#1e1e20] overflow-hidden min-h-[200px]">
            {pendingRequests.length === 0 ? (
              <div className="p-8 text-center">
                <Inbox className="h-10 w-10 mx-auto mb-3 text-stone-200 dark:text-stone-700" />
                <p className="text-sm text-stone-400 dark:text-stone-500">
                  {t("friends.noPendingRequests", { defaultValue: "No pending requests" })}
                </p>
              </div>
            ) : (
              <div className="divide-y divide-stone-100 dark:divide-[#2a2a2d]">
                {pendingRequests.map((request) => {
                  const displayName = request.requester_profile?.display_name;
                  const hasProfile = displayName && displayName.trim();
                  const isProcessing = processingId === request.id;

                  return (
                    <div key={request.id} className="p-4">
                      <div className="flex items-start gap-3">
                        <button
                          onClick={() => hasProfile && handleViewProfile(displayName)}
                          disabled={!hasProfile}
                          className={cn(
                            "flex-shrink-0 w-11 h-11 rounded-full bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center text-white font-semibold text-sm shadow-md",
                            hasProfile && "cursor-pointer hover:ring-2 hover:ring-amber-400/50 hover:ring-offset-2 dark:hover:ring-offset-[#1e1e20] transition-all"
                          )}
                        >
                          {getInitials(displayName)}
                        </button>
                        <div className="flex-1 min-w-0">
                          {hasProfile ? (
                            <button
                              onClick={() => handleViewProfile(displayName)}
                              className="font-medium text-stone-900 dark:text-white truncate block text-left hover:text-amber-600 dark:hover:text-amber-400 transition-colors"
                            >
                              {displayName}
                            </button>
                          ) : (
                            <p className="font-medium text-stone-900 dark:text-white truncate">
                              {t("friends.unknown")}
                            </p>
                          )}
                          <p className="text-xs text-stone-500 dark:text-stone-400">
                            {t("notifications.wantsToBeYourFriend")}
                          </p>
                          <div className="flex items-center gap-1 mt-1 text-[10px] text-stone-400 dark:text-stone-500">
                            <Clock className="h-3 w-3" />
                            <span>{formatRelativeTime(request.created_at)}</span>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 mt-3">
                        {hasProfile && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 rounded-lg text-xs"
                            onClick={() => handleViewProfile(displayName)}
                          >
                            <ExternalLink className="h-3.5 w-3.5 mr-1" />
                            {t("notifications.viewProfile")}
                          </Button>
                        )}
                        <div className="flex-1" />
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 w-8 p-0 rounded-lg text-red-500 hover:bg-red-100 dark:hover:bg-red-900/30"
                          onClick={() => rejectRequest(request.id)}
                          disabled={isProcessing}
                        >
                          {isProcessing ? <Loader2 className="h-4 w-4 animate-spin" /> : <X className="h-4 w-4" />}
                        </Button>
                        <Button
                          size="sm"
                          className="h-8 rounded-lg text-xs bg-amber-500 hover:bg-amber-600 text-white"
                          onClick={() => acceptRequest(request.id)}
                          disabled={isProcessing}
                        >
                          {isProcessing ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <>
                              <Check className="h-3.5 w-3.5 mr-1" />
                              {t("common.accept")}
                            </>
                          )}
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Friends List */}
        <div className="lg:col-span-1 space-y-3">
          <div className="flex items-center gap-2 px-1">
            <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-emerald-400 to-teal-500 flex items-center justify-center">
              <Users className="h-4 w-4 text-white" />
            </div>
            <h2 className="font-semibold text-stone-900 dark:text-white">
              {t("friends.yourFriends", { defaultValue: "Your Friends" })}
            </h2>
            <span className="ml-auto text-sm text-stone-400 dark:text-stone-500">
              {friends.length}
            </span>
          </div>

          <div className="rounded-2xl border border-stone-200 dark:border-[#3e3e42] bg-white dark:bg-[#1e1e20] overflow-hidden min-h-[200px]">
            {loading ? (
              <div className="p-8 text-center">
                <Loader2 className="h-8 w-8 mx-auto mb-3 text-stone-300 dark:text-stone-600 animate-spin" />
                <p className="text-sm text-stone-400 dark:text-stone-500">{t("common.loading")}</p>
              </div>
            ) : friends.length === 0 ? (
              <div className="p-8 text-center">
                <Users className="h-10 w-10 mx-auto mb-3 text-stone-200 dark:text-stone-700" />
                <p className="text-sm text-stone-400 dark:text-stone-500 mb-3">
                  {t("friends.noFriendsYet")}
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  className="rounded-xl"
                  onClick={() => setAddFriendDialogOpen(true)}
                >
                  <UserPlus className="h-4 w-4 mr-2" />
                  {t("friends.addFriend")}
                </Button>
              </div>
            ) : (
              <div className="divide-y divide-stone-100 dark:divide-[#2a2a2d]">
                {friends.map((friend) => {
                  const displayName = friend.friend_profile?.display_name;
                  const hasProfile = displayName && displayName.trim();
                  const isProcessing = processingId === friend.friend_id;

                  return (
                    <div key={friend.id} className="p-4 flex items-center gap-3">
                      <button
                        onClick={() => hasProfile && handleViewProfile(displayName)}
                        disabled={!hasProfile}
                        className={cn(
                          "flex-shrink-0 w-11 h-11 rounded-full bg-gradient-to-br from-emerald-400 to-teal-500 flex items-center justify-center text-white font-semibold text-sm shadow-md",
                          hasProfile && "cursor-pointer hover:ring-2 hover:ring-emerald-400/50 hover:ring-offset-2 dark:hover:ring-offset-[#1e1e20] transition-all"
                        )}
                      >
                        {getInitials(displayName)}
                      </button>
                      <div className="flex-1 min-w-0">
                        {hasProfile ? (
                          <button
                            onClick={() => handleViewProfile(displayName)}
                            className="font-medium text-stone-900 dark:text-white truncate block text-left hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors"
                          >
                            {displayName}
                          </button>
                        ) : (
                          <p className="font-medium text-stone-900 dark:text-white truncate">
                            {t("friends.unknown")}
                          </p>
                        )}
                        <div className="flex items-center gap-1 text-[10px] text-stone-400 dark:text-stone-500">
                          <Clock className="h-3 w-3" />
                          <span>{t("friends.friendsSince", { defaultValue: "Friends since" })} {formatRelativeTime(friend.created_at)}</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-1">
                        {hasProfile && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 rounded-lg"
                            onClick={() => handleViewProfile(displayName)}
                          >
                            <ExternalLink className="h-4 w-4" />
                          </Button>
                        )}
                        <Button
                          ref={(el) => {
                            if (el) menuButtonRefs.current.set(friend.id, el);
                          }}
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 rounded-lg"
                          onClick={(e) => {
                            e.stopPropagation();
                            setMenuOpenId(menuOpenId === friend.id ? null : friend.id);
                            setConfirmingRemove(null);
                          }}
                          disabled={isProcessing}
                        >
                          {isProcessing ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <MoreHorizontal className="h-4 w-4" />
                          )}
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Sent Requests */}
        <div className="lg:col-span-1 space-y-3">
          <div className="flex items-center gap-2 px-1">
            <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-blue-400 to-indigo-500 flex items-center justify-center">
              <SendHorizontal className="h-4 w-4 text-white" />
            </div>
            <h2 className="font-semibold text-stone-900 dark:text-white">
              {t("friends.sentRequests", { defaultValue: "Sent" })}
            </h2>
            {sentPendingRequests.length > 0 && (
              <span className="ml-auto h-6 min-w-6 px-2 rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 text-xs font-bold flex items-center justify-center">
                {sentPendingRequests.length}
              </span>
            )}
          </div>

          <div className="rounded-2xl border border-stone-200 dark:border-[#3e3e42] bg-white dark:bg-[#1e1e20] overflow-hidden min-h-[200px]">
            {sentPendingRequests.length === 0 ? (
              <div className="p-8 text-center">
                <SendHorizontal className="h-10 w-10 mx-auto mb-3 text-stone-200 dark:text-stone-700" />
                <p className="text-sm text-stone-400 dark:text-stone-500">
                  {t("friends.noSentRequests", { defaultValue: "No sent requests" })}
                </p>
              </div>
            ) : (
              <div className="divide-y divide-stone-100 dark:divide-[#2a2a2d]">
                {sentPendingRequests.map((request) => {
                  const displayName = request.recipient_profile?.display_name;
                  const hasProfile = displayName && displayName.trim();
                  const isProcessing = processingId === request.id;

                  return (
                    <div key={request.id} className="p-4">
                      <div className="flex items-start gap-3">
                        <button
                          onClick={() => hasProfile && handleViewProfile(displayName)}
                          disabled={!hasProfile}
                          className={cn(
                            "flex-shrink-0 w-11 h-11 rounded-full bg-gradient-to-br from-blue-400 to-indigo-500 flex items-center justify-center text-white font-semibold text-sm shadow-md",
                            hasProfile && "cursor-pointer hover:ring-2 hover:ring-blue-400/50 hover:ring-offset-2 dark:hover:ring-offset-[#1e1e20] transition-all"
                          )}
                        >
                          {getInitials(displayName)}
                        </button>
                        <div className="flex-1 min-w-0">
                          {hasProfile ? (
                            <button
                              onClick={() => handleViewProfile(displayName)}
                              className="font-medium text-stone-900 dark:text-white truncate block text-left hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
                            >
                              {displayName}
                            </button>
                          ) : (
                            <p className="font-medium text-stone-900 dark:text-white truncate">
                              {t("friends.unknown")}
                            </p>
                          )}
                          <p className="text-xs text-stone-500 dark:text-stone-400">
                            {t("friends.awaitingResponse", { defaultValue: "Awaiting response" })}
                          </p>
                          <div className="flex items-center gap-1 mt-1 text-[10px] text-stone-400 dark:text-stone-500">
                            <Clock className="h-3 w-3" />
                            <span>{formatRelativeTime(request.created_at)}</span>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 mt-3">
                        {hasProfile && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 rounded-lg text-xs"
                            onClick={() => handleViewProfile(displayName)}
                          >
                            <ExternalLink className="h-3.5 w-3.5 mr-1" />
                            {t("notifications.viewProfile")}
                          </Button>
                        )}
                        <div className="flex-1" />
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-8 rounded-lg text-xs text-red-500 border-red-200 dark:border-red-800/50 hover:bg-red-50 dark:hover:bg-red-900/20"
                          onClick={() => cancelRequest(request.id)}
                          disabled={isProcessing}
                        >
                          {isProcessing ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <>
                              <X className="h-3.5 w-3.5 mr-1" />
                              {t("common.cancel")}
                            </>
                          )}
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Friend Options Menu Portal */}
      {menuOpenId && menuPos && createPortal(
        <div
          ref={menuRef}
          className="fixed z-[60] w-44 rounded-xl border border-stone-200 dark:border-[#3e3e42] bg-white dark:bg-[#1e1e20] shadow-xl p-1"
          style={{ top: menuPos.top, left: menuPos.left }}
        >
          {confirmingRemove === menuOpenId ? (
            <div className="p-3">
              <p className="text-xs text-stone-600 dark:text-stone-400 mb-3">
                {t("friends.confirmRemove", { defaultValue: "Remove this friend?" })}
              </p>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="ghost"
                  className="flex-1 h-8 rounded-lg text-xs"
                  onClick={() => {
                    setConfirmingRemove(null);
                    setMenuOpenId(null);
                  }}
                >
                  {t("common.cancel")}
                </Button>
                <Button
                  size="sm"
                  className="flex-1 h-8 rounded-lg text-xs bg-red-500 hover:bg-red-600 text-white"
                  onClick={() => {
                    const friend = friends.find(f => f.id === menuOpenId);
                    if (friend) removeFriend(friend.friend_id);
                  }}
                >
                  {t("common.remove", { defaultValue: "Remove" })}
                </Button>
              </div>
            </div>
          ) : (
            <button
              className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
              onClick={() => setConfirmingRemove(menuOpenId)}
            >
              <UserMinus className="h-4 w-4" />
              {t("friends.removeFriend")}
            </button>
          )}
        </div>,
        document.body
      )}

      {/* Add Friend Dialog */}
      <Dialog open={addFriendDialogOpen} onOpenChange={setAddFriendDialogOpen}>
        <DialogContent className="sm:max-w-md rounded-2xl border border-stone-200 dark:border-[#3e3e42] bg-white dark:bg-[#1e1e20]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-blue-400 to-indigo-500 flex items-center justify-center">
                <UserPlus className="h-5 w-5 text-white" />
              </div>
              {t("friends.addFriendDialog.title")}
            </DialogTitle>
            <DialogDescription>
              {t("friends.addFriendDialog.description")}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <SearchInput
              placeholder={t("friends.addFriendDialog.searchPlaceholder")}
              value={dialogSearchQuery}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setDialogSearchQuery(e.target.value)}
              onClear={() => setDialogSearchQuery("")}
              loading={dialogSearching}
            />

            {dialogSearchResults.length > 0 && (
              <div className="space-y-2 max-h-[300px] overflow-y-auto">
                {dialogSearchResults.map((result) => {
                  const isProcessing = processingId === result.id;
                  return (
                    <div
                      key={result.id}
                      className="flex items-center gap-3 p-3 rounded-xl bg-stone-50 dark:bg-[#2a2a2d] border border-stone-100 dark:border-[#3a3a3d]"
                    >
                      <div className="flex-shrink-0 w-10 h-10 rounded-full bg-gradient-to-br from-blue-400 to-indigo-500 flex items-center justify-center text-white font-semibold text-sm">
                        {getInitials(result.display_name)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-stone-900 dark:text-white truncate">
                          {result.display_name || t("friends.unknown")}
                        </p>
                        {result.email && (
                          <p className="text-xs text-stone-400 dark:text-stone-500 truncate">
                            {result.email}
                          </p>
                        )}
                      </div>
                      <Button
                        size="sm"
                        className={cn(
                          "rounded-xl text-xs h-8",
                          result.is_friend || result.is_pending
                            ? "bg-stone-100 dark:bg-[#3a3a3d] text-stone-500"
                            : "bg-blue-500 hover:bg-blue-600 text-white"
                        )}
                        onClick={() => !result.is_friend && !result.is_pending && sendFriendRequest(result.id)}
                        disabled={result.is_friend || result.is_pending || isProcessing}
                      >
                        {isProcessing ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : result.is_friend ? (
                          <>
                            <Check className="h-3.5 w-3.5 mr-1" />
                            {t("friends.friends")}
                          </>
                        ) : result.is_pending ? (
                          t("friends.pending")
                        ) : (
                          <>
                            <UserPlus className="h-3.5 w-3.5 mr-1" />
                            {t("friends.addFriendDialog.addFriend")}
                          </>
                        )}
                      </Button>
                    </div>
                  );
                })}
              </div>
            )}

            {dialogSearchQuery && !dialogSearching && dialogSearchResults.length === 0 && (
              <div className="py-8 text-center">
                <User className="h-10 w-10 mx-auto mb-3 text-stone-200 dark:text-stone-700" />
                <p className="text-sm text-stone-400 dark:text-stone-500">
                  {t("friends.addFriendDialog.noUsersFound")}
                </p>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};
