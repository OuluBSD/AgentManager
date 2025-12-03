/**
 * Debug Component
 * Displays process tree and I/O logs for debugging
 */

"use client";

import { useState, useEffect } from "react";

interface ProcessLogEntry {
  id: string;
  type: "qwen" | "terminal" | "git" | "other";
  name: string;
  pid?: number;
  command: string;
  args: string[];
  cwd: string;
  startTime: string;
  endTime?: string;
  exitCode?: number | null;
  signal?: string | null;
  status: "starting" | "running" | "exited" | "error";
  metadata?: Record<string, any>;
  purpose?: string;
  initiator?: {
    type: "user" | "system";
    userId?: string;
    sessionId?: string;
    username?: string;
  };
  attachments?: {
    webSocketId?: string;
    transport?: string;
    chainInfo?: {
      managerId?: string;
      workerId?: string;
      aiId?: string;
    };
  };
  sessionInfo?: {
    sessionId: string;
    reopenCount: number;
    firstOpened: string;
    lastOpened: string;
  };
}

interface ProcessIOEntry {
  processId: string;
  timestamp: string;
  direction: "stdin" | "stdout" | "stderr";
  content: string;
  metadata?: Record<string, any>;
}

interface WebSocketLogEntry {
  id: string;
  connectionId: string;
  timestamp: string;
  direction: "send" | "receive";
  messageType: string;
  content: any;
  metadata?: Record<string, any>;
}

interface ConversationMessageEntry {
  processId: string;
  messageId: number;
  timestamp: string;
  role: "user" | "assistant" | "system";
  content: string;
  isStreaming?: boolean;
  metadata?: Record<string, any>;
}

interface ToolUsageEntry {
  processId: string;
  timestamp: string;
  toolGroupId?: number;
  toolId: string;
  toolName: string;
  status: string;
  args: Record<string, any>;
  confirmationDetails?: {
    message: string;
    requires_approval: boolean;
  };
  approved?: boolean;
  metadata?: Record<string, any>;
}

interface DebugProps {
  sessionToken?: string;
}

type ViewMode = "processes" | "websockets";
type ProcessGrouping = "all" | "qwen" | "terminal" | "git" | "other";

export function Debug({ sessionToken }: DebugProps) {
  const [processes, setProcesses] = useState<ProcessLogEntry[]>([]);
  const [selectedProcess, setSelectedProcess] = useState<string | null>(null);
  const [ioLogs, setIOLogs] = useState<ProcessIOEntry[]>([]);
  const [wsLogs, setWSLogs] = useState<WebSocketLogEntry[]>([]);
  const [conversationMessages, setConversationMessages] = useState<ConversationMessageEntry[]>([]);
  const [toolUsage, setToolUsage] = useState<ToolUsageEntry[]>([]);
  const [viewMode, setViewMode] = useState<ViewMode>("processes");
  const [grouping, setGrouping] = useState<ProcessGrouping>("all");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [showContent, setShowContent] = useState(true);

  // Fetch processes
  const fetchProcesses = async () => {
    if (!sessionToken) return;

    try {
      const res = await fetch("/api/debug/processes", {
        headers: { Authorization: `Bearer ${sessionToken}` },
      });

      if (!res.ok) throw new Error("Failed to fetch processes");

      const data = await res.json();
      setProcesses(data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch processes");
    } finally {
      setLoading(false);
    }
  };

  // Fetch I/O logs for selected process
  const fetchIOLogs = async (processId: string) => {
    if (!sessionToken) return;

    try {
      const res = await fetch(`/api/debug/processes/${processId}/io?limit=1000`, {
        headers: { Authorization: `Bearer ${sessionToken}` },
      });

      if (!res.ok) throw new Error("Failed to fetch I/O logs");

      const data = await res.json();
      setIOLogs(data);
    } catch (err) {
      console.error("Failed to fetch I/O logs:", err);
    }
  };

  // Fetch WebSocket logs
  const fetchWSLogs = async () => {
    if (!sessionToken) return;

    try {
      const res = await fetch("/api/debug/websockets?limit=1000", {
        headers: { Authorization: `Bearer ${sessionToken}` },
      });

      if (!res.ok) throw new Error("Failed to fetch WebSocket logs");

      const data = await res.json();
      setWSLogs(data);
    } catch (err) {
      console.error("Failed to fetch WebSocket logs:", err);
    }
  };

  // Fetch conversation messages for selected process
  const fetchConversation = async (processId: string) => {
    if (!sessionToken) return;

    try {
      const res = await fetch(`/api/debug/processes/${processId}/conversation?limit=1000`, {
        headers: { Authorization: `Bearer ${sessionToken}` },
      });

      if (!res.ok) throw new Error("Failed to fetch conversation");

      const data = await res.json();
      setConversationMessages(data);
    } catch (err) {
      console.error("Failed to fetch conversation:", err);
    }
  };

  // Fetch tool usage for selected process
  const fetchTools = async (processId: string) => {
    if (!sessionToken) return;

    try {
      const res = await fetch(`/api/debug/processes/${processId}/tools?limit=1000`, {
        headers: { Authorization: `Bearer ${sessionToken}` },
      });

      if (!res.ok) throw new Error("Failed to fetch tools");

      const data = await res.json();
      setToolUsage(data);
    } catch (err) {
      console.error("Failed to fetch tools:", err);
    }
  };

  // Initial load and auto-refresh
  useEffect(() => {
    fetchProcesses();
    if (viewMode === "websockets") {
      fetchWSLogs();
    }

    if (autoRefresh) {
      const interval = setInterval(() => {
        fetchProcesses();
        if (viewMode === "websockets") {
          fetchWSLogs();
        }
        if (selectedProcess) {
          fetchIOLogs(selectedProcess);
          fetchConversation(selectedProcess);
          fetchTools(selectedProcess);
        }
      }, 2000); // Refresh every 2 seconds

      return () => clearInterval(interval);
    }
  }, [sessionToken, autoRefresh, viewMode, selectedProcess]);

  // Load data when process is selected
  useEffect(() => {
    if (selectedProcess) {
      fetchIOLogs(selectedProcess);
      fetchConversation(selectedProcess);
      fetchTools(selectedProcess);
    } else {
      setIOLogs([]);
      setConversationMessages([]);
      setToolUsage([]);
    }
  }, [selectedProcess, sessionToken]);

  const getStatusColor = (status: ProcessLogEntry["status"]) => {
    switch (status) {
      case "running":
        return "#10b981";
      case "starting":
        return "#3b82f6";
      case "exited":
        return "#6b7280";
      case "error":
        return "#ef4444";
      default:
        return "#9ca3af";
    }
  };

  const getIOColor = (direction: ProcessIOEntry["direction"]) => {
    switch (direction) {
      case "stdin":
        return "#3b82f6";
      case "stdout":
        return "#10b981";
      case "stderr":
        return "#ef4444";
    }
  };

  const filteredProcesses =
    grouping === "all" ? processes : processes.filter((p) => p.type === grouping);

  const formatTimestamp = (ts: string) => {
    const date = new Date(ts);
    return date.toLocaleTimeString() + "." + date.getMilliseconds().toString().padStart(3, "0");
  };

  const formatDuration = (start: string, end?: string) => {
    const startTime = new Date(start).getTime();
    const endTime = end ? new Date(end).getTime() : Date.now();
    const duration = endTime - startTime;

    if (duration < 1000) return `${duration}ms`;
    if (duration < 60000) return `${(duration / 1000).toFixed(1)}s`;
    return `${Math.floor(duration / 60000)}m ${Math.floor((duration % 60000) / 1000)}s`;
  };

  // Check if content is valid JSON
  const isValidJSON = (str: string): boolean => {
    const trimmed = str.trim();
    if (!trimmed.startsWith("{") && !trimmed.startsWith("[")) return false;
    try {
      JSON.parse(trimmed);
      return true;
    } catch {
      return false;
    }
  };

  // Syntax highlight JSON
  const syntaxHighlightJSON = (json: string): JSX.Element => {
    try {
      const obj = JSON.parse(json.trim());
      const formatted = JSON.stringify(obj, null, 2);

      // Escape HTML to prevent XSS
      const escaped = formatted.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

      // Simple regex-based syntax highlighting
      const highlighted = escaped
        .replace(/("(?:\\.|[^"\\])*?")\s*:/g, '<span class="json-key">$1</span>:')
        .replace(/:\s*("(?:\\.|[^"\\])*?")/g, ': <span class="json-string">$1</span>')
        .replace(/:\s*\b(true|false)\b/g, ': <span class="json-boolean">$1</span>')
        .replace(/:\s*\b(null)\b/g, ': <span class="json-null">$1</span>')
        .replace(/:\s*(-?\d+\.?\d*([eE][+-]?\d+)?)\b/g, ': <span class="json-number">$1</span>');

      return <pre className="debug-io-json" dangerouslySetInnerHTML={{ __html: highlighted }} />;
    } catch {
      return <pre className="debug-io-content">{json}</pre>;
    }
  };

  if (loading) {
    return (
      <div className="debug-view">
        <div style={{ padding: "20px", textAlign: "center" }}>Loading debug data...</div>
      </div>
    );
  }

  return (
    <div className="debug-view">
      {/* Tree View Sidebar */}
      <div className="debug-sidebar">
        <div className="debug-sidebar-header">
          <h2>Debug</h2>
          <div className="debug-controls">
            <button
              className={`btn-tab ${viewMode === "processes" ? "active" : ""}`}
              onClick={() => setViewMode("processes")}
            >
              Processes
            </button>
            <button
              className={`btn-tab ${viewMode === "websockets" ? "active" : ""}`}
              onClick={() => setViewMode("websockets")}
            >
              WebSockets
            </button>
          </div>
        </div>

        {viewMode === "processes" && (
          <>
            <div className="debug-filter">
              <select
                value={grouping}
                onChange={(e) => setGrouping(e.target.value as ProcessGrouping)}
              >
                <option value="all">All Processes</option>
                <option value="qwen">Qwen Processes</option>
                <option value="terminal">Terminal Processes</option>
                <option value="git">Git Processes</option>
                <option value="other">Other Processes</option>
              </select>
            </div>

            <div className="debug-process-list">
              {filteredProcesses.map((process) => (
                <div
                  key={process.id}
                  className={`debug-process-item ${selectedProcess === process.id ? "selected" : ""}`}
                  onClick={() => setSelectedProcess(process.id)}
                >
                  <div className="process-item-header">
                    <span
                      className="process-status-dot"
                      style={{ backgroundColor: getStatusColor(process.status) }}
                    />
                    <span className="process-name">{process.name}</span>
                  </div>
                  <div className="process-item-meta">
                    <span className="process-type">{process.type}</span>
                    {process.pid && <span className="process-pid">PID: {process.pid}</span>}
                  </div>
                  <div className="process-item-duration">
                    {formatDuration(process.startTime, process.endTime)}
                  </div>
                </div>
              ))}
              {filteredProcesses.length === 0 && (
                <div className="debug-empty-state">
                  <p>No processes found</p>
                </div>
              )}
            </div>
          </>
        )}

        {viewMode === "websockets" && (
          <div className="debug-ws-summary">
            <div className="debug-ws-stats">
              <p>Total Messages: {wsLogs.length}</p>
              <p>Sent: {wsLogs.filter((l) => l.direction === "send").length}</p>
              <p>Received: {wsLogs.filter((l) => l.direction === "receive").length}</p>
            </div>
          </div>
        )}

        <div className="debug-sidebar-footer">
          <label>
            <input
              type="checkbox"
              checked={autoRefresh}
              onChange={(e) => setAutoRefresh(e.target.checked)}
            />
            Auto-refresh
          </label>
          <label>
            <input
              type="checkbox"
              checked={showContent}
              onChange={(e) => setShowContent(e.target.checked)}
            />
            Show content
          </label>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="debug-main">
        {error && (
          <div className="debug-error">
            <p>{error}</p>
          </div>
        )}

        {viewMode === "processes" && selectedProcess && (
          <>
            {(() => {
              const process = processes.find((p) => p.id === selectedProcess);
              if (!process) return null;

              return (
                <div className="debug-process-details">
                  <div className="debug-detail-header">
                    <h2>{process.name}</h2>
                    <span
                      className="debug-status-badge"
                      style={{ backgroundColor: getStatusColor(process.status) }}
                    >
                      {process.status}
                    </span>
                  </div>

                  <div className="debug-detail-info">
                    {process.purpose && (
                      <div className="debug-info-row">
                        <label>Purpose:</label>
                        <span>{process.purpose}</span>
                      </div>
                    )}
                    {process.initiator && (
                      <>
                        <div className="debug-info-row">
                          <label>Initiator:</label>
                          <span>
                            {process.initiator.type === "user" ? "User" : "System"}
                            {process.initiator.username && ` (${process.initiator.username})`}
                          </span>
                        </div>
                        {process.initiator.userId && (
                          <div className="debug-info-row">
                            <label>User ID:</label>
                            <span>{process.initiator.userId}</span>
                          </div>
                        )}
                      </>
                    )}
                    {process.sessionInfo && (
                      <>
                        <div className="debug-info-row">
                          <label>Session ID:</label>
                          <code>{process.sessionInfo.sessionId}</code>
                        </div>
                        <div className="debug-info-row">
                          <label>Session Reopens:</label>
                          <span>{process.sessionInfo.reopenCount}</span>
                        </div>
                        <div className="debug-info-row">
                          <label>First Opened:</label>
                          <span>{new Date(process.sessionInfo.firstOpened).toLocaleString()}</span>
                        </div>
                        <div className="debug-info-row">
                          <label>Last Opened:</label>
                          <span>{new Date(process.sessionInfo.lastOpened).toLocaleString()}</span>
                        </div>
                      </>
                    )}
                    {process.attachments && (
                      <>
                        {process.attachments.transport && (
                          <div className="debug-info-row">
                            <label>Transport:</label>
                            <span>{process.attachments.transport}</span>
                          </div>
                        )}
                        {process.attachments.chainInfo && (
                          <>
                            {process.attachments.chainInfo.managerId && (
                              <div className="debug-info-row">
                                <label>Manager:</label>
                                <code>{process.attachments.chainInfo.managerId}</code>
                              </div>
                            )}
                            {process.attachments.chainInfo.workerId && (
                              <div className="debug-info-row">
                                <label>Worker:</label>
                                <code>{process.attachments.chainInfo.workerId}</code>
                              </div>
                            )}
                            {process.attachments.chainInfo.aiId && (
                              <div className="debug-info-row">
                                <label>AI Server:</label>
                                <code>{process.attachments.chainInfo.aiId}</code>
                              </div>
                            )}
                          </>
                        )}
                      </>
                    )}
                    <div className="debug-info-row">
                      <label>Type:</label>
                      <span>{process.type}</span>
                    </div>
                    <div className="debug-info-row">
                      <label>PID:</label>
                      <span>{process.pid ?? "N/A"}</span>
                    </div>
                    <div className="debug-info-row">
                      <label>Command:</label>
                      <code>
                        {process.command} {process.args.join(" ")}
                      </code>
                    </div>
                    <div className="debug-info-row">
                      <label>Working Directory:</label>
                      <code>{process.cwd}</code>
                    </div>
                    <div className="debug-info-row">
                      <label>Started:</label>
                      <span>{new Date(process.startTime).toLocaleString()}</span>
                    </div>
                    {process.endTime && (
                      <>
                        <div className="debug-info-row">
                          <label>Ended:</label>
                          <span>{new Date(process.endTime).toLocaleString()}</span>
                        </div>
                        <div className="debug-info-row">
                          <label>Duration:</label>
                          <span>{formatDuration(process.startTime, process.endTime)}</span>
                        </div>
                      </>
                    )}
                    {process.exitCode !== undefined && (
                      <div className="debug-info-row">
                        <label>Exit Code:</label>
                        <span>{process.exitCode}</span>
                      </div>
                    )}
                    {process.signal && (
                      <div className="debug-info-row">
                        <label>Signal:</label>
                        <span>{process.signal}</span>
                      </div>
                    )}
                  </div>

                  <div className="debug-io-logs">
                    <h3>I/O Logs ({ioLogs.length} entries)</h3>
                    <div className="debug-io-list">
                      {ioLogs.map((log, idx) => (
                        <div key={idx} className="debug-io-entry">
                          <div className="debug-io-header">
                            <span
                              className="debug-io-direction"
                              style={{ color: getIOColor(log.direction) }}
                            >
                              {log.direction.toUpperCase()}
                            </span>
                            <span className="debug-io-timestamp">
                              {formatTimestamp(log.timestamp)}
                            </span>
                          </div>
                          {showContent &&
                            (isValidJSON(log.content) ? (
                              syntaxHighlightJSON(log.content)
                            ) : (
                              <pre className="debug-io-content">{log.content}</pre>
                            ))}
                        </div>
                      ))}
                      {ioLogs.length === 0 && (
                        <div className="debug-empty-state">
                          <p>No I/O logs yet</p>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Conversation Messages Section (for Qwen processes) */}
                  {process.type === "qwen" && (
                    <div className="debug-conversation-logs">
                      <h3>Conversation ({conversationMessages.length} messages)</h3>
                      <div className="debug-conversation-list">
                        {conversationMessages.map((msg, idx) => (
                          <div
                            key={idx}
                            className={`debug-conversation-entry debug-conversation-${msg.role}`}
                          >
                            <div className="debug-conversation-header">
                              <span className="debug-conversation-role">
                                {msg.role.toUpperCase()}
                              </span>
                              <span className="debug-conversation-timestamp">
                                {formatTimestamp(msg.timestamp)}
                              </span>
                              {msg.isStreaming !== undefined && (
                                <span className="debug-conversation-streaming">
                                  {msg.isStreaming ? "Streaming..." : "Complete"}
                                </span>
                              )}
                            </div>
                            {showContent && (
                              <div className="debug-conversation-content">{msg.content}</div>
                            )}
                          </div>
                        ))}
                        {conversationMessages.length === 0 && (
                          <div className="debug-empty-state">
                            <p>No conversation messages yet</p>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Tool Usage Section (for Qwen processes) */}
                  {process.type === "qwen" && (
                    <div className="debug-tool-logs">
                      <h3>Tool Usage ({toolUsage.length} tools)</h3>
                      <div className="debug-tool-list">
                        {toolUsage.map((tool, idx) => (
                          <div key={idx} className="debug-tool-entry">
                            <div className="debug-tool-header">
                              <span className="debug-tool-name">{tool.toolName}</span>
                              <span
                                className="debug-tool-status"
                                style={{
                                  color:
                                    tool.status === "success"
                                      ? "#10b981"
                                      : tool.status === "pending"
                                        ? "#f59e0b"
                                        : "#ef4444",
                                }}
                              >
                                {tool.status}
                              </span>
                              <span className="debug-tool-timestamp">
                                {formatTimestamp(tool.timestamp)}
                              </span>
                            </div>
                            {showContent && (
                              <>
                                <div className="debug-tool-args">
                                  <strong>Arguments:</strong>
                                  <pre>{JSON.stringify(tool.args, null, 2)}</pre>
                                </div>
                                {tool.confirmationDetails && (
                                  <div className="debug-tool-confirmation">
                                    <strong>Confirmation:</strong>{" "}
                                    {tool.confirmationDetails.message}
                                    {tool.confirmationDetails.requires_approval && (
                                      <span>
                                        {" "}
                                        (Requires approval:{" "}
                                        {tool.approved ? "✓ Approved" : "✗ Not approved"})
                                      </span>
                                    )}
                                  </div>
                                )}
                              </>
                            )}
                          </div>
                        ))}
                        {toolUsage.length === 0 && (
                          <div className="debug-empty-state">
                            <p>No tool usage yet</p>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              );
            })()}
          </>
        )}

        {viewMode === "processes" && !selectedProcess && (
          <div className="debug-empty-state">
            <p>Select a process to view details</p>
          </div>
        )}

        {viewMode === "websockets" && (
          <div className="debug-ws-logs">
            <h2>WebSocket Messages ({wsLogs.length})</h2>
            <div className="debug-ws-list">
              {wsLogs.map((log, idx) => (
                <div key={idx} className="debug-ws-entry">
                  <div className="debug-ws-header">
                    <span
                      className="debug-ws-direction"
                      style={{ color: log.direction === "send" ? "#3b82f6" : "#10b981" }}
                    >
                      {log.direction === "send" ? "SEND →" : "← RECV"}
                    </span>
                    <span className="debug-ws-type">{log.messageType}</span>
                    <span className="debug-ws-timestamp">{formatTimestamp(log.timestamp)}</span>
                  </div>
                  {showContent && (
                    <pre className="debug-ws-content">{JSON.stringify(log.content, null, 2)}</pre>
                  )}
                </div>
              ))}
              {wsLogs.length === 0 && (
                <div className="debug-empty-state">
                  <p>No WebSocket messages logged</p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
