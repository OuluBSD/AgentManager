/**
 * AI Chat Component
 * Generic chat interface supporting multiple AI backends (qwen/claude/gemini/codex)
 */

"use client";

import { useCallback, useEffect, useRef, useState, type KeyboardEvent } from "react";
import type { AIBackendType } from "@nexus/shared/chat";
import { useAIChatBackend } from "../hooks/useAIChatBackend";

interface ChatMessage {
  id: number;
  role: "user" | "assistant" | "system" | "tool";
  content: string;
  timestamp: number;
  metadata?: Record<string, unknown>;
  displayRole?: string;
}

interface ChatSession {
  id: string;
  name: string;
  backend: AIBackendType;
}

interface AIChatProps {
  sessionToken?: string;
  onBackendConnect?: (backend: AIBackendType) => void;
  onBackendDisconnect?: () => void;
}

export function AIChat({ sessionToken, onBackendConnect, onBackendDisconnect }: AIChatProps) {
  const parseBool = (value: string | undefined, fallback: boolean) => {
    if (!value) return fallback;
    const lowered = value.trim().toLowerCase();
    if (["true", "1", "yes", "on"].includes(lowered)) return true;
    if (["false", "0", "no", "off"].includes(lowered)) return false;
    return fallback;
  };

  const [sessions, setSessions] = useState<ChatSession[]>(() => {
    // Try to load from localStorage first
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("ai-chat-sessions");
      if (saved) {
        try {
          const parsed = JSON.parse(saved);
          if (Array.isArray(parsed) && parsed.length > 0) {
            return parsed;
          }
        } catch (err) {
          console.error("Failed to load saved sessions:", err);
        }
      }
    }
    // Default: create initial session with timestamp ID
    return [
      {
        id: Date.now().toString(),
        name: "Chat 1",
        backend: "qwen",
      },
    ];
  });
  const [activeSessionId, setActiveSessionId] = useState(() => {
    // Set to the first session ID from loaded sessions
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("ai-chat-sessions");
      if (saved) {
        try {
          const parsed = JSON.parse(saved);
          if (Array.isArray(parsed) && parsed.length > 0 && parsed[0].id) {
            return parsed[0].id;
          }
        } catch (err) {
          // Fall through to default
        }
      }
    }
    // Default to first session (will be generated timestamp)
    return Date.now().toString();
  });
  const [selectedBackend, setSelectedBackend] = useState<AIBackendType>("qwen");
  const [inputValue, setInputValue] = useState("");
  const [allowChallenge, setAllowChallenge] = useState(() =>
    parseBool(process.env.NEXT_PUBLIC_ASSISTANT_CHALLENGE_ENABLED, true)
  );

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const activeSession = sessions.find((s) => s.id === activeSessionId);

  // Use the AI chat backend hook
  const {
    messages,
    status,
    statusMessage,
    statusContext,
    isStreaming,
    streamingContent,
    connect,
    disconnect,
    sendMessage,
    interrupt,
    isConnected,
  } = useAIChatBackend({
    backend: activeSession?.backend || "qwen",
    sessionId: activeSessionId,
    token: sessionToken || "",
    allowChallenge,
  });

  // Auto-connect when session token is available and disconnect on session change
  useEffect(() => {
    let cancelled = false;

    const reconnect = async () => {
      if (sessionToken && !cancelled) {
        // Disconnect any existing connection when session changes
        await disconnect();
        // Then connect to the new session (only if not cancelled)
        if (!cancelled) {
          connect();
        }
      }
    };

    reconnect();

    // Cleanup on unmount
    return () => {
      cancelled = true;
      disconnect();
    };
  }, [sessionToken, activeSessionId, connect, disconnect]);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
    }
  }, [inputValue]);

  // Persist sessions to localStorage
  useEffect(() => {
    if (typeof window !== "undefined") {
      localStorage.setItem("ai-chat-sessions", JSON.stringify(sessions));
    }
  }, [sessions]);

  const handleSend = useCallback(() => {
    if (!inputValue.trim() || !sessionToken) return;

    sendMessage(inputValue.trim());
    setInputValue("");
  }, [inputValue, sendMessage, sessionToken]);

  const handleStop = useCallback(() => {
    interrupt();
  }, [interrupt]);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        handleSend();
      }
    },
    [handleSend]
  );

  const handleNewSession = useCallback(() => {
    const newSession: ChatSession = {
      id: Date.now().toString(),
      name: `Chat ${sessions.length + 1}`,
      messages: [],
      backend: selectedBackend,
    };
    setSessions((prev) => [...prev, newSession]);
    setActiveSessionId(newSession.id);
  }, [sessions.length, selectedBackend]);

  const handleCloseSession = useCallback(
    (sessionId: string) => {
      setSessions((prev) => {
        const filtered = prev.filter((s) => s.id !== sessionId);
        if (filtered.length === 0) {
          // Always keep at least one session
          const newSession = {
            id: Date.now().toString(),
            name: "Chat 1",
            backend: selectedBackend,
          };
          // Update activeSessionId to match the new session
          setActiveSessionId(newSession.id);
          return [newSession];
        }
        return filtered;
      });

      // Switch to another session if we closed the active one
      if (sessionId === activeSessionId) {
        const remaining = sessions.filter((s) => s.id !== sessionId);
        if (remaining.length > 0) {
          setActiveSessionId(remaining[0].id);
        }
      }
    },
    [activeSessionId, sessions, selectedBackend]
  );

  const formatTime = (timestamp: number) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  };

  const statusText = (() => {
    if (statusContext === "system") {
      return statusMessage || "Processing system message";
    }
    let base = "";
    if (status === "idle") base = "Ready";
    if (status === "connecting") base = "Connecting...";
    if (status === "responding") base = "Responding...";
    if (status === "error") base = "Error";

    if (statusMessage) {
      const shouldCombine = base && statusMessage.trim() !== base;
      return shouldCombine ? `${base} - ${statusMessage}` : statusMessage;
    }
    return base;
  })();

  const renderMessageContent = (content: string, isStreamingBlock = false) => {
    const fenceCount = (content.match(/```/g) || []).length;
    const needsClosingFence = isStreamingBlock && fenceCount % 2 === 1;
    const toRender = needsClosingFence ? `${content}\n\`\`\`` : content;

    const textWithBreaks = (text: string) => {
      const lines = text.split("\n");
      return lines.map((line, idx) => (
        <span key={idx}>
          {line}
          {idx < lines.length - 1 ? <br /> : null}
        </span>
      ));
    };

    const segments: JSX.Element[] = [];
    const regex = /```([\w+-]*)\s*([\s\S]*?)```/g;
    let lastIndex = 0;
    let match: RegExpExecArray | null;
    let key = 0;

    while ((match = regex.exec(toRender)) !== null) {
      const textPart = toRender.slice(lastIndex, match.index);
      if (textPart) {
        segments.push(
          <div key={`text-${key}`} className="ai-chat-message-text">
            {textWithBreaks(textPart)}
          </div>
        );
        key += 1;
      }

      const language = match[1]?.trim();
      const code = match[2] ?? "";
      segments.push(
        <pre key={`code-${key}`} className="ai-chat-code-block">
          {language ? <div className="ai-chat-code-lang">{language}</div> : null}
          <code className={language ? `language-${language}` : undefined}>{code}</code>
        </pre>
      );
      key += 1;
      lastIndex = regex.lastIndex;
    }

    const trailing = toRender.slice(lastIndex);
    if (trailing || segments.length === 0) {
      segments.push(
        <div key={`text-${key}`} className="ai-chat-message-text">
          {textWithBreaks(trailing)}
        </div>
      );
    }

    return segments;
  };

  return (
    <div className="ai-chat-container">
      {/* Header with sessions and controls */}
      <div className="ai-chat-header">
        <div className="ai-chat-sessions">
          {sessions.map((session) => (
            <div
              key={session.id}
              className={`ai-chat-session-tab ${session.id === activeSessionId ? "active" : ""}`}
              onClick={() => setActiveSessionId(session.id)}
            >
              <span>{session.name}</span>
              {sessions.length > 1 && (
                <button
                  className="ai-chat-session-close"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleCloseSession(session.id);
                  }}
                >
                  ×
                </button>
              )}
            </div>
          ))}
          <button className="ghost" onClick={handleNewSession}>
            + New
          </button>
        </div>

        <div className="ai-chat-controls">
          <select
            className="ai-chat-backend-select"
            value={selectedBackend}
            onChange={(e) => setSelectedBackend(e.target.value as AIBackendType)}
          >
            <option value="qwen">Qwen</option>
            <option value="claude">Claude</option>
            <option value="gemini">Gemini</option>
            <option value="codex">Codex</option>
          </select>
          <label className="ai-chat-toggle">
            <input
              type="checkbox"
              checked={allowChallenge}
              onChange={(e) => setAllowChallenge(e.target.checked)}
            />
            Allow challenge
          </label>
        </div>
      </div>

      {/* Chat messages */}
      <div className="ai-chat-main">
        <div className="ai-chat-messages">
          {!sessionToken ? (
            <div className="ai-chat-empty">
              <div className="ai-chat-empty-icon">⚠️</div>
              <div className="ai-chat-empty-text">Not authenticated</div>
              <div className="ai-chat-empty-hint">Please log in to use AI chat</div>
            </div>
          ) : messages.length === 0 ? (
            <div className="ai-chat-empty">
              <div className="ai-chat-empty-icon">💬</div>
              <div className="ai-chat-empty-text">Start a conversation</div>
              <div className="ai-chat-empty-hint">
                Type a message below to chat with {selectedBackend}
              </div>
            </div>
          ) : (
            messages.map((msg) => (
              <div key={msg.id} className={`ai-chat-message ${msg.role}`}>
                <div className="ai-chat-message-header">
                  <span className={`ai-chat-message-role ${msg.role}`}>
                    {msg.displayRole || msg.role}
                  </span>
                  <span className="ai-chat-message-time">{formatTime(msg.timestamp)}</span>
                </div>
                <div className="ai-chat-message-content">{renderMessageContent(msg.content)}</div>
              </div>
            ))
          )}
          {isStreaming && streamingContent && (
            <div className="ai-chat-message assistant">
              <div className="ai-chat-message-header">
                <span className="ai-chat-message-role assistant">assistant</span>
                <span className="ai-chat-message-time">now</span>
              </div>
              <div className="ai-chat-message-content ai-chat-message-streaming">
                {renderMessageContent(streamingContent, true)}
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input area */}
        <div className="ai-chat-input-area">
          <div className="ai-chat-status-bar">
            <div className={`ai-chat-status-dot ${status}`} />
            <span>{statusText}</span>
          </div>

          <div className="ai-chat-input-container">
            <textarea
              ref={textareaRef}
              className="ai-chat-input"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Type your message... (Shift+Enter for new line)"
              rows={1}
              disabled={isStreaming || !sessionToken}
            />
            {isStreaming ? (
              <button className="ai-chat-button stop" onClick={handleStop}>
                ⏹ Stop
              </button>
            ) : (
              <button
                className="ai-chat-button"
                onClick={handleSend}
                disabled={!inputValue.trim() || !sessionToken}
              >
                Send
              </button>
            )}
          </div>

          <div className="ai-chat-hint">Press Enter to send, Shift+Enter for new line</div>
        </div>
      </div>
    </div>
  );
}
