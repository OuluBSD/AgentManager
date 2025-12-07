/**
 * Hook for managing AI Chat backend connections - V2 with proper architecture
 * Uses MessageStore for clean state management
 */

import { useCallback, useEffect, useRef, useState } from "react";
import type { AIBackendType } from "@nexus/shared/chat";
import { resolveBackendBase, toWebSocketBase } from "../lib/backendBase";
import { MessageStore, type Message } from "../lib/messageStore";
import { PollingConnection } from "../lib/pollingConnection";

// Use HTTP polling by default until WebSocket issues are resolved
const USE_POLLING = process.env.NEXT_PUBLIC_USE_POLLING !== "false";

export type ChatStatus = "idle" | "connecting" | "responding" | "error";

interface UseAIChatBackendOptions {
  backend: AIBackendType;
  sessionId: string;
  token: string;
  disableTools?: boolean;
  disableFilesystem?: boolean;
  allowChallenge?: boolean;
  workspacePath?: string | null;
  initialMessages?: any[];
  onAssistantMessage?: (payload: { content: string; final: boolean }) => void;
  onStatusChange?: (payload: { status: ChatStatus; message?: string; context?: string }) => void;
  onInfo?: (payload: { message?: string; raw?: any }) => void;
  onToolMessage?: (payload: {
    content: string;
    displayRole?: string;
    final: boolean;
    messageId?: number;
  }) => void;
  onCompletionStats?: (payload: {
    promptTokens?: number;
    completionTokens?: number;
    totalTokens?: number;
    contextLimit?: number;
    contextRemaining?: number;
    raw?: any;
  }) => void;
}

export function useAIChatBackend(options: UseAIChatBackendOptions) {
  // Single source of truth for messages
  const messageStore = useRef(new MessageStore());

  // UI state
  const [messages, setMessages] = useState<Message[]>([]);
  const [status, setStatus] = useState<ChatStatus>("idle");
  const [statusMessage, setStatusMessage] = useState("");
  const [statusContext, setStatusContext] = useState<string | undefined>(undefined);
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamingContent, setStreamingContent] = useState("");
  const [isConnected, setIsConnected] = useState(false);

  // Connection state
  const wsRef = useRef<WebSocket | PollingConnection | null>(null);
  const autoApprovedToolsRef = useRef<Set<string>>(new Set());
  const pendingMessagesRef = useRef<string[]>([]);
  const reconnectAttemptsRef = useRef(0);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastErrorTimeRef = useRef<number>(0);
  const maxReconnectAttempts = 5;
  const baseReconnectDelay = 1000; // 1 second
  const errorCooldown = 5000; // 5 second cooldown between error messages

  // Store callback refs to avoid dependency issues
  const optionsRef = useRef(options);
  optionsRef.current = options;

  // Sync UI with message store - use ref pattern to avoid dependency issues
  const syncMessagesRef = useRef<() => void>();
  syncMessagesRef.current = () => {
    setMessages(messageStore.current.getMessages());
    const { content, isStreaming: streaming } = messageStore.current.getStreamingContent();
    setStreamingContent(content);
    setIsStreaming(streaming);
  };

  const syncMessages = useCallback(() => {
    syncMessagesRef.current?.();
  }, []);

  // Reset when switching sessions
  useEffect(() => {
    console.log("[useAIChatBackend] Session changed, resetting state");

    // Disconnect existing connection first
    if (wsRef.current) {
      const ws = wsRef.current;
      ws.onopen = null;
      ws.onmessage = null;
      ws.onerror = null;
      ws.onclose = null;
      if (ws.readyState !== WebSocket.CLOSED) {
        ws.close(1000, "Session changed");
      }
      wsRef.current = null;
    }

    // Clear reconnect state
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
    reconnectAttemptsRef.current = 0;
    lastErrorTimeRef.current = 0;

    messageStore.current.clear();
    syncMessagesRef.current?.();
    setStatus("idle");
    setStatusMessage("");
    setStatusContext(undefined);
    pendingMessagesRef.current = [];
    autoApprovedToolsRef.current.clear();
    setIsConnected(false);
  }, [options.sessionId]); // Only depend on sessionId

  // Connect to backend via WebSocket
  const connect = useCallback(() => {
    const opts = optionsRef.current;

    // Clear any pending reconnect timeout
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }

    // Check if already connected or connecting
    if (wsRef.current) {
      const state = wsRef.current.readyState;
      // WebSocket.CLOSED = 3, don't try to reconnect if already open/connecting/closing
      if (state === WebSocket.OPEN || state === WebSocket.CONNECTING || state === WebSocket.CLOSING) {
        console.log("[useAIChatBackend] Already connected or connecting, state:", state);
        return;
      }
    }

    // Check if max reconnect attempts exceeded
    if (reconnectAttemptsRef.current >= maxReconnectAttempts) {
      const now = Date.now();
      const timeSinceLastError = now - lastErrorTimeRef.current;

      // Only log error once every 5 seconds to prevent console flooding
      if (timeSinceLastError > errorCooldown) {
        console.error(
          `[useAIChatBackend] Max reconnect attempts (${maxReconnectAttempts}) exceeded`
        );
        lastErrorTimeRef.current = now;
      }

      setStatus("error");
      setStatusMessage(
        `Connection failed after ${maxReconnectAttempts} attempts. Please check your connection and try again.`
      );
      return;
    }

    reconnectAttemptsRef.current++;
    const attemptNumber = reconnectAttemptsRef.current;
    console.log(
      `[useAIChatBackend] Connection attempt ${attemptNumber}/${maxReconnectAttempts}`
    );

    setStatus("connecting");
    setStatusMessage(
      attemptNumber > 1
        ? `Reconnecting (${attemptNumber}/${maxReconnectAttempts})...`
        : `Connecting to ${opts.backend}...`
    );

    const backendUrl = resolveBackendBase();

    let ws: WebSocket | PollingConnection;

    if (USE_POLLING) {
      // Use HTTP polling
      console.log("[useAIChatBackend] Using HTTP polling (WebSocket disabled)");
      ws = new PollingConnection({
        sessionId: opts.sessionId,
        token: opts.token,
        backend: opts.backend,
        allowChallenge: opts.allowChallenge,
        workspacePath: opts.workspacePath,
        pollInterval: 500, // Poll every 500ms
      });
    } else {
      // Use WebSocket
      const wsBase = toWebSocketBase(backendUrl);
      const challengeParam =
        opts.allowChallenge === false ? "false" : opts.allowChallenge === true ? "true" : "";
      const workspaceParam =
        opts.workspacePath?.trim()
          ? `&workspace=${encodeURIComponent(opts.workspacePath.trim())}`
          : "";
      const wsUrl = `${wsBase}/api/ai-chat/${opts.sessionId}?backend=${
        opts.backend
      }&token=${opts.token}${
        challengeParam ? `&challenge=${encodeURIComponent(challengeParam)}` : ""
      }${workspaceParam}`;

      ws = new WebSocket(wsUrl);
    }

    ws.onopen = () => {
      console.log("[useAIChatBackend] Connection opened successfully (polling:", USE_POLLING, ")");

      // Check if we've been replaced by another connection attempt
      if (wsRef.current && wsRef.current !== ws) {
        console.log("[useAIChatBackend] Connection replaced, closing this one");
        ws.close();
        return;
      }

      // Reset reconnect attempts on successful connection
      reconnectAttemptsRef.current = 0;
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
        reconnectTimeoutRef.current = null;
      }

      setStatus("idle");
      setStatusMessage("Connected");
      setIsConnected(true);
      wsRef.current = ws;

      // Flush queued messages
      pendingMessagesRef.current.forEach((queued) => {
        ws.send(JSON.stringify({ type: "user_input", content: queued }));
      });
      pendingMessagesRef.current = [];
    };

    ws.onmessage = (event: { data: string }) => {
      try {
        const msg = JSON.parse(event.data);
        handleMessage(msg);
      } catch (err) {
        console.error("[useAIChatBackend] Failed to parse message:", err);
      }
    };

    ws.onerror = (error: any) => {
      console.error("[useAIChatBackend] WebSocket error:", error);
      setStatus("error");
      const attemptText =
        reconnectAttemptsRef.current < maxReconnectAttempts
          ? ` (attempt ${reconnectAttemptsRef.current}/${maxReconnectAttempts})`
          : " (max attempts reached)";
      setStatusMessage(`Connection error${attemptText}`);
      setIsConnected(false);
      optionsRef.current.onStatusChange?.({ status: "error", message: "Connection error" });
    };

    ws.onclose = (event: { code: number; reason: string }) => {
      console.log(
        `[useAIChatBackend] Connection closed: code=${event.code}, reason=${event.reason}`
      );

      // Check if this is still the active connection
      if (wsRef.current !== ws) {
        console.log("[useAIChatBackend] Closed connection was already replaced, ignoring");
        return;
      }

      setIsConnected(false);
      setIsStreaming(false);
      setStreamingContent("");
      wsRef.current = null;
      autoApprovedToolsRef.current.clear();

      // Only attempt reconnect if:
      // 1. Not a normal closure (code 1000)
      // 2. Not explicitly closed by user
      // 3. Haven't exceeded max attempts
      const wasAbnormalClose = event.code !== 1000 && event.code !== 1005;
      const canRetry = reconnectAttemptsRef.current < maxReconnectAttempts;

      if (wasAbnormalClose && canRetry) {
        // Exponential backoff: 1s, 2s, 4s, 8s, 16s
        const delay = Math.min(
          baseReconnectDelay * Math.pow(2, reconnectAttemptsRef.current),
          30000 // Cap at 30 seconds
        );
        console.log(
          `[useAIChatBackend] Scheduling reconnect in ${delay}ms (attempt ${reconnectAttemptsRef.current + 1}/${maxReconnectAttempts})`
        );
        setStatus("error");
        setStatusMessage(`Reconnecting in ${Math.round(delay / 1000)}s...`);

        reconnectTimeoutRef.current = setTimeout(() => {
          console.log("[useAIChatBackend] Attempting reconnect...");
          connect();
        }, delay);
      } else if (!canRetry) {
        setStatus("error");
        setStatusMessage(
          "Connection lost. Max reconnection attempts reached. Please refresh the page."
        );
      } else {
        setStatus("idle");
        setStatusMessage("Disconnected");
      }
    };
  }, []); // Use optionsRef.current instead of dependencies

  // Handle WebSocket messages
  const handleMessage = useCallback((msg: any) => {
    const opts = optionsRef.current;

    switch (msg.type) {
      case "init":
        setStatus("idle");
        setStatusMessage("");
        break;

      case "conversation":
        if (msg.role === "assistant") {
          if (msg.isStreaming !== false) {
            // Streaming chunk
            messageStore.current.addAssistantChunk(msg.content || "");
            syncMessages();
            setStatusMessage("");
            const { content } = messageStore.current.getStreamingContent();
            opts.onAssistantMessage?.({ content, final: false });
          } else {
            // Finalize streaming
            messageStore.current.finalizeAssistantMessage();
            syncMessages();
            setStatus("idle");
            setStatusMessage("");
            const messages = messageStore.current.getMessages();
            const lastMsg = messages[messages.length - 1];
            if (lastMsg?.role === "assistant") {
              opts.onAssistantMessage?.({ content: lastMsg.content, final: true });
            }
          }
        }
        break;

      case "status":
        setStatusContext(typeof msg.context === "string" ? msg.context : undefined);
        if (msg.state) {
          const stateMap: Record<string, ChatStatus> = {
            idle: "idle",
            responding: "responding",
            waiting_for_confirmation: "responding",
          };
          const nextStatus = stateMap[msg.state] || "idle";
          setStatus(nextStatus);
          opts.onStatusChange?.({
            status: nextStatus,
            message: msg.message,
            context: typeof msg.context === "string" ? msg.context : undefined,
          });

          if (nextStatus === "idle") {
            messageStore.current.completeToolExecution();
            syncMessages();
          }
        }
        if (msg.message) {
          setStatusMessage(msg.message);
        }
        break;

      case "error":
        setStatus("error");
        setStatusMessage(msg.message || "An error occurred");
        setIsStreaming(false);
        break;

      case "tool_group":
        if (Array.isArray(msg.tools) && msg.tools.length > 0) {
          // Auto-approve tools
          for (const tool of msg.tools) {
            const toolId = tool?.tool_id;
            const requiresApproval =
              tool?.confirmation_details?.requires_approval || tool?.requires_approval;

            if (
              requiresApproval &&
              typeof toolId === "string" &&
              !autoApprovedToolsRef.current.has(toolId) &&
              wsRef.current?.readyState === WebSocket.OPEN
            ) {
              wsRef.current.send(
                JSON.stringify({
                  type: "tool_approval",
                  approved: true,
                  tool_id: toolId,
                })
              );
              autoApprovedToolsRef.current.add(toolId);
            }
          }

          // Add tool message to store
          messageStore.current.startToolExecution(msg.id.toString(), msg.tools);
          syncMessages();
          setStatusMessage(`Executing ${msg.tools.length} tool(s)...`);
        }
        break;

      case "info":
        // Tool execution output
        if (msg.message && typeof msg.message === "string") {
          const content = msg.message.trim();
          if (content.length > 0) {
            // Check if this is a status message or actual output
            const isStatusMessage =
              content.startsWith("Tool ") &&
              (content.includes("executed successfully") || content.includes("failed"));

            if (!isStatusMessage) {
              messageStore.current.addToolOutput(content);
              syncMessages();
            }
          }
        }
        if (msg.message) {
          setStatusMessage(msg.message);
        }
        opts.onInfo?.({ message: msg.message, raw: msg });
        break;

      case "completion_stats":
        setIsStreaming(false);
        setStatus("idle");
        setStatusMessage("Ready");
        messageStore.current.completeToolExecution();
        syncMessages();

        // Call completion stats callback
        const toNumber = (value: any) =>
          typeof value === "number" && Number.isFinite(value) ? value : undefined;
        opts.onCompletionStats?.({
          promptTokens: toNumber(msg.prompt_tokens),
          completionTokens: toNumber(msg.completion_tokens),
          totalTokens: toNumber(msg.total_tokens),
          contextLimit: toNumber(msg.context_window) ?? toNumber(msg.context_limit),
          contextRemaining: toNumber(msg.context_tokens_left) ?? toNumber(msg.context_remaining),
          raw: msg,
        });
        break;
    }
  }, [syncMessages]); // Keep syncMessages but it's stable now

  // Disconnect from backend
  const disconnect = useCallback(() => {
    console.log("[useAIChatBackend] Disconnect called");

    // Clear reconnect timeout and reset attempts
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
    reconnectAttemptsRef.current = maxReconnectAttempts; // Prevent auto-reconnect

    if (wsRef.current) {
      const ws = wsRef.current;

      if (ws.readyState === WebSocket.OPEN) {
        try {
          ws.send(JSON.stringify({ type: "disconnect" }));
        } catch (err) {
          console.error("[useAIChatBackend] Failed to send disconnect:", err);
        }
      }

      ws.onmessage = null;
      ws.onerror = null;
      ws.onopen = null;
      ws.onclose = null;

      if (ws.readyState !== WebSocket.CLOSED) {
        ws.close(1000, "User disconnected"); // Normal closure
      }

      wsRef.current = null;
    }

    messageStore.current.clear();
    syncMessagesRef.current?.();
    setStatus("idle");
    setStatusMessage("");
    setIsConnected(false);
    pendingMessagesRef.current = [];
    autoApprovedToolsRef.current.clear();
  }, []); // No dependencies - use refs instead

  // Send message to backend
  const sendMessage = useCallback(
    (content: string) => {
      const ready = wsRef.current?.readyState === WebSocket.OPEN;

      // Add user message to store
      messageStore.current.addUserMessage(content);
      syncMessagesRef.current?.();

      setStatus("responding");
      setIsStreaming(true);

      if (ready && wsRef.current) {
        wsRef.current.send(JSON.stringify({ type: "user_input", content }));
      } else {
        pendingMessagesRef.current.push(content);
        if (!wsRef.current || wsRef.current.readyState === WebSocket.CLOSED) {
          connect();
        }
      }
    },
    [connect]
  );

  // Interrupt ongoing response
  const interrupt = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: "interrupt" }));
      messageStore.current.finalizeAssistantMessage();
      syncMessagesRef.current?.();
      setIsStreaming(false);
      setStatus("idle");
      setStatusMessage("Interrupted");
    }
  }, []); // No dependencies - use refs instead

  // Manual retry (resets reconnect attempts)
  const retry = useCallback(() => {
    console.log("[useAIChatBackend] Manual retry requested");
    reconnectAttemptsRef.current = 0;
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
    connect();
  }, [connect]);

  // Auto-disconnect on unmount (use ref to avoid dependency issues)
  const disconnectRef = useRef(disconnect);
  disconnectRef.current = disconnect;

  useEffect(() => {
    return () => {
      disconnectRef.current();
    };
  }, []); // Empty deps - only run on mount/unmount

  // Convert Message to legacy ChatMessage format for compatibility
  const legacyMessages = messages.map((msg, idx) => ({
    id: idx + 1,
    role: msg.role,
    content: msg.content,
    timestamp: msg.timestamp,
    displayRole: msg.displayRole,
    metadata: msg.metadata,
  }));

  return {
    messages: legacyMessages,
    status,
    statusMessage,
    statusContext,
    isStreaming,
    streamingContent,
    connect,
    disconnect,
    sendMessage,
    sendBackgroundMessage: sendMessage, // Simplified - same as sendMessage
    interrupt,
    retry,
    isConnected,
    canRetry: reconnectAttemptsRef.current >= maxReconnectAttempts,
  };
}
