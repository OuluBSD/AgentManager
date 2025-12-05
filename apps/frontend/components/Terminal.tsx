"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  TerminalSettingsDialog,
  DEFAULT_SETTINGS,
  type TerminalSettings,
} from "./TerminalSettings";
import { buildTerminalWsCandidates, createTerminalSession } from "../lib/api";

// Dynamic imports to avoid SSR issues
let XTermClass: typeof import("@xterm/xterm").Terminal | null = null;
let FitAddonClass: typeof import("@xterm/addon-fit").FitAddon | null = null;

type TerminalProps = {
  sessionToken: string;
  projectId: string;
  onSessionCreated?: (sessionId: string) => void;
  onSessionClosed?: () => void;
  autoConnect: boolean;
};

export function Terminal({
  sessionToken,
  projectId,
  onSessionCreated,
  onSessionClosed,
  autoConnect,
}: TerminalProps) {
  const terminalRef = useRef<HTMLDivElement>(null);
  const xtermRef = useRef<InstanceType<typeof import("@xterm/xterm").Terminal> | null>(null);
  const fitAddonRef = useRef<InstanceType<typeof import("@xterm/addon-fit").FitAddon> | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const onDataDisposableRef = useRef<{ dispose: () => void } | null>(null);
  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const lastSequenceRef = useRef<number>(0);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [isAttached, setIsAttached] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [usingPolling, setUsingPolling] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [settings, setSettings] = useState<TerminalSettings>(DEFAULT_SETTINGS);
  const [settingsLoaded, setSettingsLoaded] = useState(false);
  const [serverWsCandidates, setServerWsCandidates] = useState<string[]>([]);
  const serverCandidatesRef = useRef<string[]>([]);

  // Create terminal session
  const createSession = useCallback(async () => {
    try {
      const data = await createTerminalSession(sessionToken, projectId);
      setSessionId(data.sessionId);
      const providedCandidates = Array.isArray(data.wsCandidates) ? data.wsCandidates : [];
      serverCandidatesRef.current = providedCandidates;
      setServerWsCandidates(providedCandidates);
      onSessionCreated?.(data.sessionId);
      return data.sessionId;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create session");
      return null;
    }
  }, [onSessionCreated, projectId, sessionToken]);

  // Attach using polling (fallback when WebSocket fails)
  const attachSessionPolling = useCallback(
    (sid: string) => {
      if (!xtermRef.current) return;
      if (pollingIntervalRef.current) return; // Already polling

      console.log("[Terminal] Falling back to polling mode");
      setUsingPolling(true);
      setIsAttached(true);
      setIsConnecting(false);
      setError(null);
      lastSequenceRef.current = 0;

      if (xtermRef.current) {
        xtermRef.current.write("\r\n[Connected via polling mode]\r\n");
        onDataDisposableRef.current?.dispose();
        onDataDisposableRef.current = xtermRef.current.onData((data) => {
          // Send input via POST
          fetch(`/api/terminal/sessions/${sid}/input`, {
            method: "POST",
            headers: {
              Authorization: `Bearer ${sessionToken}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ data }),
          }).catch((err) => {
            console.error("[Terminal] Failed to send input:", err);
          });
        });
      }

      // Poll for output
      const poll = async () => {
        try {
          const res = await fetch(
            `/api/terminal/sessions/${sid}/output?since=${lastSequenceRef.current}`,
            {
              headers: {
                Authorization: `Bearer ${sessionToken}`,
              },
            }
          );

          if (!res.ok) {
            throw new Error(`HTTP ${res.status}`);
          }

          const data = await res.json();
          if (data.chunks && data.chunks.length > 0) {
            for (const chunk of data.chunks) {
              const decoded = atob(chunk.data);
              const bytes = new Uint8Array(decoded.length);
              for (let i = 0; i < decoded.length; i++) {
                bytes[i] = decoded.charCodeAt(i);
              }
              const text = new TextDecoder().decode(bytes);
              if (xtermRef.current) {
                xtermRef.current.write(text);
              }
            }
            lastSequenceRef.current = data.currentSequence;
          }

          if (data.exited) {
            if (xtermRef.current) {
              xtermRef.current.write(
                `\r\n[process exited with code ${data.exitCode ?? "unknown"}]\r\n`
              );
            }
            if (pollingIntervalRef.current) {
              clearInterval(pollingIntervalRef.current);
              pollingIntervalRef.current = null;
            }
            setIsAttached(false);
            setUsingPolling(false);
            setSessionId(null);
            serverCandidatesRef.current = [];
            setServerWsCandidates([]);
            onSessionClosed?.();
          }
        } catch (err) {
          console.error("[Terminal] Polling error:", err);
          if (pollingIntervalRef.current) {
            clearInterval(pollingIntervalRef.current);
            pollingIntervalRef.current = null;
          }
          setError("Polling connection failed");
          setIsAttached(false);
          setUsingPolling(false);
        }
      };

      // Start polling
      pollingIntervalRef.current = setInterval(poll, 200);
      poll(); // Initial poll
    },
    [onSessionClosed, sessionToken]
  );

  // Attach to terminal session via WebSocket
  const attachSession = useCallback(
    (sid: string) => {
      if (!xtermRef.current) return;
      if (wsRef.current) {
        setIsConnecting(false);
        return;
      }

      const wsCandidates = buildTerminalWsCandidates(
        sessionToken,
        sid,
        serverCandidatesRef.current || serverWsCandidates
      );

      const tryConnect = (index: number) => {
        const targetUrl = wsCandidates[index];
        if (!targetUrl) {
          console.log("[Terminal] All WebSocket candidates failed, falling back to polling");
          attachSessionPolling(sid);
          return;
        }

        const ws = new WebSocket(targetUrl);
        ws.binaryType = "arraybuffer";
        wsRef.current = ws;
        let opened = false;

        const decodePayload = async (data: unknown): Promise<string | null> => {
          if (typeof data === "string") return data;
          if (data instanceof ArrayBuffer) {
            return new TextDecoder().decode(data);
          }
          if (typeof Blob !== "undefined" && data instanceof Blob) {
            try {
              const buffer = await data.arrayBuffer();
              return new TextDecoder().decode(buffer);
            } catch {
              return null;
            }
          }
          return null;
        };

        ws.onopen = () => {
          if (wsRef.current !== ws) return;
          opened = true;
          setIsAttached(true);
          setIsConnecting(false);
          setError(null);

          if (xtermRef.current) {
            onDataDisposableRef.current?.dispose();
            onDataDisposableRef.current = xtermRef.current.onData((data) => {
              if (ws.readyState === WebSocket.OPEN) {
                ws.send(data);
              }
            });
          }
        };

        ws.onmessage = (event) => {
          if (!xtermRef.current || wsRef.current !== ws) return;
          const maybePromise = decodePayload(event.data);
          if (maybePromise instanceof Promise) {
            maybePromise.then((text) => {
              if (text && xtermRef.current && wsRef.current === ws) {
                xtermRef.current.write(text);
              }
            });
          } else if (maybePromise) {
            xtermRef.current.write(maybePromise);
          }
        };

        const handleEarlyFailure = () => {
          if (wsRef.current !== ws || opened) return;
          ws.close();
          wsRef.current = null;
          const nextIndex = index + 1;
          tryConnect(nextIndex);
        };

        ws.onerror = () => {
          if (!opened) {
            handleEarlyFailure();
            return;
          }
          setError("WebSocket connection error");
          setIsAttached(false);
          setIsConnecting(false);
        };

        ws.onclose = (event) => {
          if (wsRef.current !== ws) return;
          if (!opened) {
            handleEarlyFailure();
            return;
          }
          setIsAttached(false);
          setIsConnecting(false);
          wsRef.current = null;
          onDataDisposableRef.current?.dispose();
          onDataDisposableRef.current = null;
          const closeDetail = event.reason
            ? event.reason
            : event.code
              ? `code ${event.code}`
              : "connection closed";
          if (xtermRef.current) {
            xtermRef.current.write(
              `\r\n[terminal session closed${closeDetail ? ` (${closeDetail})` : ""}]\r\n`
            );
          }
          // Always drop sessionId because the backend tears down the session on close.
          setSessionId(null);
          serverCandidatesRef.current = [];
          setServerWsCandidates([]);
          onSessionClosed?.();
        };
      };

      tryConnect(0);
    },
    [attachSessionPolling, onSessionClosed, serverWsCandidates, sessionToken]
  );

  // Detach from terminal session
  const detachSession = () => {
    onDataDisposableRef.current?.dispose();
    onDataDisposableRef.current = null;
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current);
      pollingIntervalRef.current = null;
    }
    setSessionId(null);
    serverCandidatesRef.current = [];
    setServerWsCandidates([]);
    setIsConnecting(false);
    setIsAttached(false);
    setUsingPolling(false);
    lastSequenceRef.current = 0;
  };

  // Load settings from backend or localStorage
  useEffect(() => {
    if (settingsLoaded) return;

    const loadSettings = async () => {
      try {
        // Try to load from backend first
        const res = await fetch("/api/user/settings/terminal", {
          headers: {
            Authorization: `Bearer ${sessionToken}`,
          },
        });

        if (res.ok) {
          const data = await res.json();
          if (data.settings) {
            setSettings(data.settings);
            setSettingsLoaded(true);
            return;
          }
        }
      } catch (err) {
        console.warn("Failed to load settings from backend, using localStorage", err);
      }

      // Fallback to localStorage
      if (typeof window !== "undefined") {
        const saved = localStorage.getItem("terminal-settings");
        if (saved) {
          try {
            setSettings(JSON.parse(saved));
          } catch {
            setSettings(DEFAULT_SETTINGS);
          }
        }
      }
      setSettingsLoaded(true);
    };

    loadSettings();
  }, [sessionToken, settingsLoaded]);

  // Persist settings to localStorage and backend
  useEffect(() => {
    if (!settingsLoaded) return;

    // Save to localStorage
    if (typeof window !== "undefined") {
      localStorage.setItem("terminal-settings", JSON.stringify(settings));
    }

    // Save to backend
    const saveToBackend = async () => {
      try {
        await fetch("/api/user/settings/terminal", {
          method: "PUT",
          headers: {
            Authorization: `Bearer ${sessionToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ settings }),
        });
      } catch (err) {
        console.warn("Failed to save settings to backend", err);
      }
    };

    saveToBackend();
  }, [settings, sessionToken, settingsLoaded]);

  // Initialize xterm instance
  useEffect(() => {
    if (!terminalRef.current) return;

    let mounted = true;
    let resizeObserver: ResizeObserver | null = null;

    // Dispose of existing terminal
    if (xtermRef.current) {
      xtermRef.current.dispose();
      xtermRef.current = null;
      fitAddonRef.current = null;
    }

    // Dynamically import xterm only on client side
    Promise.all([
      import("@xterm/xterm").then((mod) => {
        XTermClass = mod.Terminal;
      }),
      import("@xterm/addon-fit").then((mod) => {
        FitAddonClass = mod.FitAddon;
      }),
    ])
      .then(() => {
        if (!mounted || !terminalRef.current || !XTermClass || !FitAddonClass) return;

        const xterm = new XTermClass({
          cursorBlink: settings.cursorBlink,
          fontSize: settings.fontSize,
          fontFamily: settings.fontFamily,
          theme: settings.theme,
          scrollback: settings.scrollback,
          allowProposedApi: true,
        });

        const fitAddon = new FitAddonClass();
        xterm.loadAddon(fitAddon);

        xterm.open(terminalRef.current);
        fitAddon.fit();

        xtermRef.current = xterm;
        fitAddonRef.current = fitAddon;

        // Reattach WebSocket if still connected
        if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
          xterm.onData((data) => {
            if (wsRef.current?.readyState === WebSocket.OPEN) {
              wsRef.current.send(data);
            }
          });
        }

        // Handle resize
        resizeObserver = new ResizeObserver(() => {
          if (fitAddonRef.current) {
            fitAddonRef.current.fit();
          }
        });
        resizeObserver.observe(terminalRef.current);
      })
      .catch((err) => {
        if (mounted) {
          setError(
            `Failed to load terminal: ${err instanceof Error ? err.message : "unknown error"}`
          );
        }
      });

    return () => {
      mounted = false;
      if (resizeObserver) {
        resizeObserver.disconnect();
      }
      if (xtermRef.current) {
        xtermRef.current.dispose();
        xtermRef.current = null;
        fitAddonRef.current = null;
      }
    };
  }, [settings]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
        pollingIntervalRef.current = null;
      }
      onSessionClosed?.();
    };
  }, [onSessionClosed]);

  const handlePlay = useCallback(async () => {
    if (isAttached) return;
    setIsConnecting(true);

    let sid = sessionId;
    if (!sid) {
      sid = await createSession();
    }

    if (sid) {
      attachSession(sid);
    } else {
      setIsConnecting(false);
    }
  }, [attachSession, createSession, isAttached, isConnecting, sessionId]);

  // useEffect to trigger auto-connect
  useEffect(() => {
    if (autoConnect && sessionToken && projectId && !isAttached && !isConnecting) {
      handlePlay();
    }
  }, [autoConnect, sessionToken, projectId, isAttached, isConnecting, handlePlay]);

  const handleStop = () => {
    detachSession();
  };

  const handleSaveSettings = (newSettings: TerminalSettings) => {
    setSettings(newSettings);
    setShowSettings(false);
  };

  const getGradientStyle = () => {
    if (!settings.enableGradient) return undefined;

    const direction =
      settings.gradientDirection === "vertical"
        ? "to bottom"
        : settings.gradientDirection === "horizontal"
          ? "to right"
          : "to bottom right";

    return `linear-gradient(${direction}, ${settings.gradientStartColor}, ${settings.gradientEndColor})`;
  };

  const getBackgroundStyle = () => {
    const styles: React.CSSProperties = {
      background: settings.theme.background,
    };

    if (settings.backgroundImage) {
      styles.backgroundImage = `url(${settings.backgroundImage})`;
      styles.backgroundSize = "cover";
      styles.backgroundPosition = "center";
      styles.backgroundRepeat = "no-repeat";
    }

    return styles;
  };

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "0.5rem",
        height: "100%",
        maxHeight: "100%",
        overflow: "hidden",
      }}
    >
      <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
        <button
          type="button"
          className="ghost"
          onClick={handlePlay}
          disabled={isAttached}
          style={{
            fontSize: "0.875rem",
            opacity: isAttached ? 0.5 : 1,
            cursor: isAttached ? "not-allowed" : "pointer",
          }}
        >
          ▶ {sessionId ? "Attach" : "Start"}
        </button>
        <button
          type="button"
          className="ghost"
          onClick={handleStop}
          disabled={!isAttached}
          style={{
            fontSize: "0.875rem",
            opacity: !isAttached ? 0.5 : 1,
            cursor: !isAttached ? "not-allowed" : "pointer",
          }}
        >
          ◼ Detach
        </button>
        <button
          type="button"
          className="ghost"
          onClick={() => setShowSettings(true)}
          style={{
            fontSize: "0.875rem",
            cursor: "pointer",
          }}
        >
          ⚙ Settings
        </button>
        {sessionId && (
          <span className="item-subtle" style={{ fontSize: "0.75rem" }}>
            Session: {sessionId.slice(0, 8)}
          </span>
        )}
        {isAttached && (
          <span
            style={{
              fontSize: "0.75rem",
              color: "#6EE7B7",
              fontWeight: 600,
            }}
          >
            ● Connected{usingPolling ? " (polling)" : ""}
          </span>
        )}
      </div>

      {error && (
        <div
          style={{
            padding: "0.5rem",
            background: "rgba(248, 113, 113, 0.12)",
            border: "1px solid rgba(248, 113, 113, 0.3)",
            borderRadius: "8px",
            color: "#FCA5A5",
            fontSize: "0.875rem",
          }}
        >
          {error}
        </div>
      )}

      <div
        style={{
          flex: 1,
          position: "relative",
          borderRadius: "8px",
          border: "1px solid #30363D",
          overflow: "hidden",
        }}
      >
        {/* Background layer with gradient and/or image */}
        {(settings.enableGradient || settings.backgroundImage) && (
          <div
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              zIndex: 0,
              ...getBackgroundStyle(),
              opacity: settings.backgroundImage
                ? settings.backgroundOpacity
                : settings.gradientOpacity,
            }}
          >
            {settings.enableGradient && !settings.backgroundImage && (
              <div
                style={{
                  position: "absolute",
                  top: 0,
                  left: 0,
                  right: 0,
                  bottom: 0,
                  background: getGradientStyle(),
                }}
              />
            )}
          </div>
        )}

        {/* Terminal layer */}
        <div
          ref={terminalRef}
          style={{
            position: "relative",
            zIndex: 1,
            width: "100%",
            height: "100%",
            padding: "0.5rem",
          }}
        />
      </div>

      {/* Settings Dialog */}
      {showSettings && (
        <TerminalSettingsDialog
          settings={settings}
          onSave={handleSaveSettings}
          onCancel={() => setShowSettings(false)}
        />
      )}
    </div>
  );
}
