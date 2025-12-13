import React from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/context/AuthContext";
import { supabase } from "@/lib/supabaseClient";
import {
  MessageSquare,
  Send,
  ArrowLeft,
  Check,
  X,
  User,
  Clock,
  AlertCircle,
  Loader2,
  Search,
  MessageCircle,
  ChevronRight,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import { useLanguageNavigate } from "@/lib/i18nRouting";
import { useParams, useSearchParams } from "react-router-dom";
import { SearchInput } from "@/components/ui/search-input";
import { cn } from "@/lib/utils";

type Conversation = {
  id: string;
  type: string;
  status: string;
  initiatedBy: string;
  title: string | null;
  lastMessageAt: string | null;
  lastMessagePreview: string | null;
  createdAt: string;
  unreadCount: number;
  isMuted: boolean;
  lastReadAt: string | null;
  otherParticipant: {
    id: string;
    display_name: string | null;
    avatar_url: string | null;
  } | null;
  isPendingForMe: boolean;
};

type Message = {
  id: string;
  conversationId: string;
  senderId: string;
  senderName: string;
  senderAvatar: string | null;
  content: string | null;
  type: string;
  replyToId: string | null;
  metadata: Record<string, unknown>;
  isDeleted: boolean;
  editedAt: string | null;
  createdAt: string;
  isOwn: boolean;
};

async function buildAuthHeaders() {
  const session = (await supabase.auth.getSession()).data.session;
  const headers: Record<string, string> = {
    Accept: "application/json",
    "Content-Type": "application/json",
  };
  if (session?.access_token) {
    headers.Authorization = `Bearer ${session.access_token}`;
  }
  return headers;
}

export const MessagesPage: React.FC = () => {
  const { user } = useAuth();
  const navigate = useLanguageNavigate();
  const { t } = useTranslation("common");
  const { conversationId: paramConversationId } = useParams();
  const [searchParams] = useSearchParams();

  // State
  const [conversations, setConversations] = React.useState<Conversation[]>([]);
  const [selectedConversation, setSelectedConversation] =
    React.useState<Conversation | null>(null);
  const [messages, setMessages] = React.useState<Message[]>([]);
  const [newMessage, setNewMessage] = React.useState("");
  const [loading, setLoading] = React.useState(true);
  const [loadingMessages, setLoadingMessages] = React.useState(false);
  const [sending, setSending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [searchQuery, setSearchQuery] = React.useState("");

  const messagesEndRef = React.useRef<HTMLDivElement>(null);
  const inputRef = React.useRef<HTMLInputElement>(null);

  // Glass card styling
  const glassCard =
    "rounded-[28px] border border-stone-200/70 dark:border-[#3e3e42]/70 bg-white/80 dark:bg-[#1f1f1f]/80 backdrop-blur shadow-[0_25px_70px_-40px_rgba(15,23,42,0.65)]";

  // Load conversations
  const loadConversations = React.useCallback(async () => {
    if (!user?.id) return;
    try {
      const headers = await buildAuthHeaders();
      const response = await fetch("/api/messages/conversations", {
        headers,
        credentials: "same-origin",
      });
      const data = await response.json();
      if (response.ok) {
        setConversations(data.conversations || []);
      } else {
        setError(data.error || "Failed to load conversations");
      }
    } catch (e: unknown) {
      setError(
        e instanceof Error ? e.message : "Failed to load conversations"
      );
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  // Load messages for a conversation
  const loadMessages = React.useCallback(
    async (convId: string) => {
      if (!user?.id) return;
      setLoadingMessages(true);
      try {
        const headers = await buildAuthHeaders();
        const response = await fetch(
          `/api/messages/conversations/${convId}/messages`,
          {
            headers,
            credentials: "same-origin",
          }
        );
        const data = await response.json();
        if (response.ok) {
          setMessages(data.messages || []);
          // Mark as read
          fetch(`/api/messages/conversations/${convId}/read`, {
            method: "POST",
            headers,
            credentials: "same-origin",
          }).catch(() => {});
        } else {
          setError(data.error || "Failed to load messages");
        }
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : "Failed to load messages");
      } finally {
        setLoadingMessages(false);
      }
    },
    [user?.id]
  );

  // Initial load
  React.useEffect(() => {
    loadConversations();
  }, [loadConversations]);

  // Handle URL params for direct conversation access
  React.useEffect(() => {
    if (paramConversationId && conversations.length > 0) {
      const conv = conversations.find((c) => c.id === paramConversationId);
      if (conv) {
        setSelectedConversation(conv);
        loadMessages(conv.id);
      }
    } else if (searchParams.get("user")) {
      // Start conversation with specific user
      const targetUserId = searchParams.get("user");
      if (targetUserId) {
        startConversation(targetUserId);
      }
    }
  }, [paramConversationId, conversations, searchParams, loadMessages]);

  // Scroll to bottom when messages change
  React.useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Start a new conversation
  const startConversation = async (userId: string) => {
    try {
      const headers = await buildAuthHeaders();
      const response = await fetch("/api/messages/start", {
        method: "POST",
        headers,
        credentials: "same-origin",
        body: JSON.stringify({ userId }),
      });
      const data = await response.json();
      if (response.ok && data.conversationId) {
        await loadConversations();
        const conv = conversations.find((c) => c.id === data.conversationId);
        if (conv) {
          setSelectedConversation(conv);
          loadMessages(conv.id);
        } else if (data.conversation) {
          setSelectedConversation(data.conversation);
          loadMessages(data.conversationId);
        }
      }
    } catch (e) {
      console.error("Failed to start conversation:", e);
    }
  };

  // Send a message
  const sendMessage = async () => {
    if (!selectedConversation || !newMessage.trim() || sending) return;

    setSending(true);
    try {
      const headers = await buildAuthHeaders();
      const response = await fetch(
        `/api/messages/conversations/${selectedConversation.id}/messages`,
        {
          method: "POST",
          headers,
          credentials: "same-origin",
          body: JSON.stringify({ content: newMessage.trim() }),
        }
      );
      const data = await response.json();
      if (response.ok && data.message) {
        setMessages((prev) => [...prev, data.message]);
        setNewMessage("");
        inputRef.current?.focus();
        // Refresh conversations to update last message
        loadConversations();
      } else {
        setError(data.error || "Failed to send message");
      }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to send message");
    } finally {
      setSending(false);
    }
  };

  // Accept chat request
  const acceptChatRequest = async (convId: string) => {
    try {
      const headers = await buildAuthHeaders();
      await fetch(`/api/messages/conversations/${convId}/accept`, {
        method: "POST",
        headers,
        credentials: "same-origin",
      });
      await loadConversations();
      if (selectedConversation?.id === convId) {
        setSelectedConversation((prev) =>
          prev ? { ...prev, status: "accepted", isPendingForMe: false } : null
        );
      }
    } catch (e) {
      console.error("Failed to accept chat request:", e);
    }
  };

  // Reject chat request
  const rejectChatRequest = async (convId: string) => {
    try {
      const headers = await buildAuthHeaders();
      await fetch(`/api/messages/conversations/${convId}/reject`, {
        method: "POST",
        headers,
        credentials: "same-origin",
      });
      await loadConversations();
      if (selectedConversation?.id === convId) {
        setSelectedConversation(null);
        setMessages([]);
      }
    } catch (e) {
      console.error("Failed to reject chat request:", e);
    }
  };

  // Format timestamp
  const formatTime = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));

    if (days === 0) {
      return date.toLocaleTimeString(undefined, {
        hour: "2-digit",
        minute: "2-digit",
      });
    } else if (days === 1) {
      return t("messages.yesterday", "Yesterday");
    } else if (days < 7) {
      return date.toLocaleDateString(undefined, { weekday: "short" });
    } else {
      return date.toLocaleDateString(undefined, {
        month: "short",
        day: "numeric",
      });
    }
  };

  // Filter conversations
  const filteredConversations = React.useMemo(() => {
    if (!searchQuery.trim()) return conversations;
    const query = searchQuery.toLowerCase();
    return conversations.filter(
      (c) =>
        c.otherParticipant?.display_name?.toLowerCase().includes(query) ||
        c.lastMessagePreview?.toLowerCase().includes(query)
    );
  }, [conversations, searchQuery]);

  // Not logged in
  if (!user) {
    return (
      <div className="max-w-6xl mx-auto mt-8 px-4 md:px-0 pb-16 space-y-6">
        <Card className={glassCard}>
          <CardContent className="p-6 md:p-8 text-center text-sm text-stone-600 dark:text-stone-300">
            {t("messages.pleaseLogin", "Please log in to view your messages")}
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto mt-8 px-4 md:px-0 pb-16">
      <Card className={`${glassCard} overflow-hidden`}>
        <div className="flex h-[calc(100vh-200px)] min-h-[500px] max-h-[800px]">
          {/* Conversations List */}
          <div
            className={cn(
              "w-full md:w-80 lg:w-96 border-r border-stone-200/70 dark:border-[#3e3e42]/70 flex flex-col",
              selectedConversation ? "hidden md:flex" : "flex"
            )}
          >
            {/* Header */}
            <div className="p-4 border-b border-stone-200/70 dark:border-[#3e3e42]/70">
              <div className="flex items-center justify-between mb-3">
                <h1 className="text-xl font-semibold text-stone-900 dark:text-white flex items-center gap-2">
                  <MessageSquare className="h-5 w-5 text-emerald-600" />
                  {t("messages.title", "Messages")}
                </h1>
              </div>
              <SearchInput
                placeholder={t("messages.searchPlaceholder", "Search messages...")}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="h-9"
              />
            </div>

            {/* Conversation List */}
            <div className="flex-1 overflow-y-auto">
              {loading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="h-6 w-6 animate-spin text-stone-400" />
                </div>
              ) : filteredConversations.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
                  <MessageCircle className="h-12 w-12 text-stone-300 dark:text-stone-600 mb-3" />
                  <p className="text-sm text-stone-500 dark:text-stone-400">
                    {searchQuery
                      ? t("messages.noResults", "No conversations found")
                      : t("messages.noConversations", "No messages yet")}
                  </p>
                  <p className="text-xs text-stone-400 dark:text-stone-500 mt-1">
                    {t(
                      "messages.startHint",
                      "Start a conversation from a user's profile"
                    )}
                  </p>
                </div>
              ) : (
                <div>
                  {filteredConversations.map((conv) => (
                    <button
                      key={conv.id}
                      onClick={() => {
                        setSelectedConversation(conv);
                        loadMessages(conv.id);
                        navigate(`/messages/${conv.id}`);
                      }}
                      className={cn(
                        "w-full p-4 flex items-start gap-3 hover:bg-stone-50 dark:hover:bg-[#2a2a2d] transition-colors text-left border-b border-stone-100 dark:border-[#2a2a2d]",
                        selectedConversation?.id === conv.id &&
                          "bg-emerald-50 dark:bg-emerald-900/20",
                        conv.isPendingForMe &&
                          "bg-amber-50/50 dark:bg-amber-900/10"
                      )}
                    >
                      {/* Avatar */}
                      <div className="relative flex-shrink-0">
                        {conv.otherParticipant?.avatar_url ? (
                          <img
                            src={conv.otherParticipant.avatar_url}
                            alt=""
                            className="w-12 h-12 rounded-full object-cover"
                          />
                        ) : (
                          <div className="w-12 h-12 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center">
                            <User className="h-6 w-6 text-emerald-600 dark:text-emerald-400" />
                          </div>
                        )}
                        {conv.unreadCount > 0 && (
                          <span className="absolute -top-1 -right-1 w-5 h-5 bg-emerald-500 text-white text-xs font-bold rounded-full flex items-center justify-center">
                            {conv.unreadCount > 9 ? "9+" : conv.unreadCount}
                          </span>
                        )}
                      </div>

                      {/* Content */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between mb-1">
                          <span
                            className={cn(
                              "font-medium truncate",
                              conv.unreadCount > 0
                                ? "text-stone-900 dark:text-white"
                                : "text-stone-700 dark:text-stone-300"
                            )}
                          >
                            {conv.otherParticipant?.display_name ||
                              t("messages.unknown", "Unknown")}
                          </span>
                          {conv.lastMessageAt && (
                            <span className="text-xs text-stone-400 flex-shrink-0 ml-2">
                              {formatTime(conv.lastMessageAt)}
                            </span>
                          )}
                        </div>

                        {conv.isPendingForMe ? (
                          <div className="flex items-center gap-1 text-xs text-amber-600 dark:text-amber-400">
                            <AlertCircle className="h-3 w-3" />
                            {t("messages.chatRequest", "Chat request")}
                          </div>
                        ) : conv.status === "pending" ? (
                          <div className="flex items-center gap-1 text-xs text-stone-400">
                            <Clock className="h-3 w-3" />
                            {t("messages.pendingSent", "Pending acceptance")}
                          </div>
                        ) : conv.lastMessagePreview ? (
                          <p
                            className={cn(
                              "text-sm truncate",
                              conv.unreadCount > 0
                                ? "text-stone-600 dark:text-stone-300"
                                : "text-stone-400 dark:text-stone-500"
                            )}
                          >
                            {conv.lastMessagePreview}
                          </p>
                        ) : (
                          <p className="text-sm text-stone-400 italic">
                            {t("messages.noMessages", "No messages yet")}
                          </p>
                        )}
                      </div>

                      <ChevronRight className="h-4 w-4 text-stone-300 dark:text-stone-600 flex-shrink-0 mt-1" />
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Chat Area */}
          <div
            className={cn(
              "flex-1 flex flex-col",
              !selectedConversation ? "hidden md:flex" : "flex"
            )}
          >
            {selectedConversation ? (
              <>
                {/* Chat Header */}
                <div className="p-4 border-b border-stone-200/70 dark:border-[#3e3e42]/70 flex items-center gap-3">
                  <button
                    onClick={() => {
                      setSelectedConversation(null);
                      setMessages([]);
                      navigate("/messages");
                    }}
                    className="md:hidden p-2 -ml-2 hover:bg-stone-100 dark:hover:bg-[#2a2a2d] rounded-lg"
                  >
                    <ArrowLeft className="h-5 w-5" />
                  </button>

                  {selectedConversation.otherParticipant?.avatar_url ? (
                    <img
                      src={selectedConversation.otherParticipant.avatar_url}
                      alt=""
                      className="w-10 h-10 rounded-full object-cover"
                    />
                  ) : (
                    <div className="w-10 h-10 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center">
                      <User className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
                    </div>
                  )}

                  <div className="flex-1 min-w-0">
                    <h2 className="font-medium text-stone-900 dark:text-white truncate">
                      {selectedConversation.otherParticipant?.display_name ||
                        t("messages.unknown", "Unknown")}
                    </h2>
                    {selectedConversation.status === "pending" && (
                      <span className="text-xs text-amber-600 dark:text-amber-400">
                        {selectedConversation.isPendingForMe
                          ? t("messages.chatRequest", "Chat request")
                          : t("messages.pendingSent", "Pending acceptance")}
                      </span>
                    )}
                  </div>

                  {selectedConversation.otherParticipant?.display_name && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="rounded-lg"
                      onClick={() =>
                        navigate(
                          `/u/${encodeURIComponent(
                            selectedConversation.otherParticipant
                              ?.display_name || ""
                          )}`
                        )
                      }
                    >
                      {t("messages.viewProfile", "View Profile")}
                    </Button>
                  )}
                </div>

                {/* Chat Request Banner */}
                {selectedConversation.isPendingForMe && (
                  <div className="p-4 bg-amber-50 dark:bg-amber-900/20 border-b border-amber-200 dark:border-amber-800 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <AlertCircle className="h-5 w-5 text-amber-600 dark:text-amber-400" />
                      <span className="text-sm text-amber-800 dark:text-amber-200">
                        {t(
                          "messages.chatRequestInfo",
                          "This user wants to chat with you"
                        )}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        className="rounded-lg border-red-200 text-red-600 hover:bg-red-50 dark:border-red-800 dark:text-red-400 dark:hover:bg-red-900/20"
                        onClick={() =>
                          rejectChatRequest(selectedConversation.id)
                        }
                      >
                        <X className="h-4 w-4 mr-1" />
                        {t("messages.reject", "Reject")}
                      </Button>
                      <Button
                        size="sm"
                        className="rounded-lg bg-emerald-600 hover:bg-emerald-700"
                        onClick={() =>
                          acceptChatRequest(selectedConversation.id)
                        }
                      >
                        <Check className="h-4 w-4 mr-1" />
                        {t("messages.accept", "Accept")}
                      </Button>
                    </div>
                  </div>
                )}

                {/* Messages */}
                <div className="flex-1 overflow-y-auto p-4 space-y-4">
                  {loadingMessages ? (
                    <div className="flex items-center justify-center py-12">
                      <Loader2 className="h-6 w-6 animate-spin text-stone-400" />
                    </div>
                  ) : messages.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full text-center">
                      <MessageCircle className="h-12 w-12 text-stone-300 dark:text-stone-600 mb-3" />
                      <p className="text-sm text-stone-500 dark:text-stone-400">
                        {t("messages.startConversation", "Start the conversation!")}
                      </p>
                    </div>
                  ) : (
                    messages.map((msg, idx) => {
                      const showDate =
                        idx === 0 ||
                        new Date(msg.createdAt).toDateString() !==
                          new Date(messages[idx - 1].createdAt).toDateString();

                      return (
                        <React.Fragment key={msg.id}>
                          {showDate && (
                            <div className="flex items-center justify-center my-4">
                              <span className="px-3 py-1 bg-stone-100 dark:bg-[#2a2a2d] rounded-full text-xs text-stone-500 dark:text-stone-400">
                                {new Date(msg.createdAt).toLocaleDateString(
                                  undefined,
                                  {
                                    weekday: "long",
                                    month: "short",
                                    day: "numeric",
                                  }
                                )}
                              </span>
                            </div>
                          )}

                          <div
                            className={cn(
                              "flex",
                              msg.isOwn ? "justify-end" : "justify-start"
                            )}
                          >
                            <div
                              className={cn(
                                "max-w-[80%] md:max-w-[70%] rounded-2xl px-4 py-2",
                                msg.isOwn
                                  ? "bg-emerald-600 text-white rounded-br-sm"
                                  : "bg-stone-100 dark:bg-[#2a2a2d] text-stone-900 dark:text-white rounded-bl-sm"
                              )}
                            >
                              {msg.isDeleted ? (
                                <p className="text-sm italic opacity-60">
                                  {t("messages.deleted", "Message deleted")}
                                </p>
                              ) : (
                                <p className="text-sm whitespace-pre-wrap break-words">
                                  {msg.content}
                                </p>
                              )}
                              <div
                                className={cn(
                                  "flex items-center gap-1 mt-1",
                                  msg.isOwn ? "justify-end" : "justify-start"
                                )}
                              >
                                <span
                                  className={cn(
                                    "text-xs",
                                    msg.isOwn
                                      ? "text-emerald-200"
                                      : "text-stone-400 dark:text-stone-500"
                                  )}
                                >
                                  {new Date(msg.createdAt).toLocaleTimeString(
                                    undefined,
                                    {
                                      hour: "2-digit",
                                      minute: "2-digit",
                                    }
                                  )}
                                </span>
                                {msg.editedAt && (
                                  <span
                                    className={cn(
                                      "text-xs",
                                      msg.isOwn
                                        ? "text-emerald-200"
                                        : "text-stone-400 dark:text-stone-500"
                                    )}
                                  >
                                    · {t("messages.edited", "edited")}
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                        </React.Fragment>
                      );
                    })
                  )}
                  <div ref={messagesEndRef} />
                </div>

                {/* Message Input */}
                {selectedConversation.status === "accepted" && (
                  <div className="p-4 border-t border-stone-200/70 dark:border-[#3e3e42]/70">
                    <div className="flex items-center gap-2">
                      <Input
                        ref={inputRef}
                        value={newMessage}
                        onChange={(e) => setNewMessage(e.target.value)}
                        placeholder={t(
                          "messages.typePlaceholder",
                          "Type a message..."
                        )}
                        className="flex-1 rounded-xl border-stone-200 dark:border-[#3e3e42]"
                        onKeyDown={(e) => {
                          if (e.key === "Enter" && !e.shiftKey) {
                            e.preventDefault();
                            sendMessage();
                          }
                        }}
                        disabled={sending}
                      />
                      <Button
                        onClick={sendMessage}
                        disabled={!newMessage.trim() || sending}
                        className="rounded-xl bg-emerald-600 hover:bg-emerald-700 h-10 w-10 p-0"
                      >
                        {sending ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Send className="h-4 w-4" />
                        )}
                      </Button>
                    </div>
                  </div>
                )}
              </>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center text-center p-8">
                <div className="w-16 h-16 rounded-2xl bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center mb-4">
                  <MessageSquare className="h-8 w-8 text-emerald-600 dark:text-emerald-400" />
                </div>
                <h2 className="text-xl font-semibold text-stone-900 dark:text-white mb-2">
                  {t("messages.selectConversation", "Select a conversation")}
                </h2>
                <p className="text-sm text-stone-500 dark:text-stone-400 max-w-sm">
                  {t(
                    "messages.selectHint",
                    "Choose a conversation from the list or start a new one from a user's profile"
                  )}
                </p>
              </div>
            )}
          </div>
        </div>
      </Card>

      {/* Error Toast */}
      {error && (
        <div className="fixed bottom-4 right-4 p-4 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-xl shadow-lg flex items-center gap-3">
          <AlertCircle className="h-5 w-5 text-red-600 dark:text-red-400" />
          <span className="text-sm text-red-800 dark:text-red-200">{error}</span>
          <button
            onClick={() => setError(null)}
            className="p-1 hover:bg-red-100 dark:hover:bg-red-900/50 rounded"
          >
            <X className="h-4 w-4 text-red-600 dark:text-red-400" />
          </button>
        </div>
      )}
    </div>
  );
};

export default MessagesPage;
