/**
 * HTTP Polling Connection - Fallback for broken WebSocket
 *
 * Mimics WebSocket interface but uses HTTP polling
 * This is a temporary solution until WebSocket issues are resolved
 */

import { resolveBackendBase } from "./backendBase";

export interface PollingConnectionOptions {
  sessionId: string;
  token: string;
  backend: string;
  allowChallenge?: boolean;
  workspacePath?: string | null;
  pollInterval?: number; // Default 500ms
}

export class PollingConnection {
  private sessionId: string;
  private token: string;
  private backend: string;
  private allowChallenge: boolean;
  private workspacePath: string | null;
  private pollInterval: number;
  private backendUrl: string;

  private isActive = false;
  private pollTimer: NodeJS.Timeout | null = null;
  private lastMessageId = 0;
  private messageQueue: any[] = [];

  // WebSocket-like event handlers
  public onopen: (() => void) | null = null;
  public onmessage: ((event: { data: string }) => void) | null = null;
  public onerror: ((error: any) => void) | null = null;
  public onclose: ((event: { code: number; reason: string }) => void) | null = null;

  // WebSocket-like ready state
  public readonly CONNECTING = 0;
  public readonly OPEN = 1;
  public readonly CLOSING = 2;
  public readonly CLOSED = 3;
  public readyState = this.CONNECTING;

  constructor(options: PollingConnectionOptions) {
    this.sessionId = options.sessionId;
    this.token = options.token;
    this.backend = options.backend;
    this.allowChallenge = options.allowChallenge ?? false;
    this.workspacePath = options.workspacePath ?? null;
    this.pollInterval = options.pollInterval ?? 500;
    this.backendUrl = resolveBackendBase();

    console.log("[PollingConnection] Initializing with options:", {
      sessionId: this.sessionId,
      backend: this.backend,
      pollInterval: this.pollInterval,
    });

    // Start connection asynchronously to match WebSocket behavior
    setTimeout(() => this.connect(), 0);
  }

  private async connect() {
    try {
      console.log("[PollingConnection] Starting connection...");

      // Initialize session
      const initUrl = `${this.backendUrl}/api/ai-chat/${this.sessionId}/init`;
      const params = new URLSearchParams({
        backend: this.backend,
        token: this.token,
        challenge: this.allowChallenge ? "true" : "false",
      });
      if (this.workspacePath) {
        params.set("workspace", this.workspacePath);
      }

      console.log("[PollingConnection] Sending init request to:", `${initUrl}?${params.toString()}`);

      const initResponse = await fetch(`${initUrl}?${params.toString()}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({}), // Send empty JSON object
      });

      console.log("[PollingConnection] Init response status:", initResponse.status);

      if (!initResponse.ok) {
        const errorText = await initResponse.text();
        console.error("[PollingConnection] Init failed:", initResponse.status, errorText);
        throw new Error(`Init failed: ${initResponse.status} ${initResponse.statusText} - ${errorText}`);
      }

      const initData = await initResponse.json();
      console.log("[PollingConnection] Session initialized:", initData);

      this.readyState = this.OPEN;
      this.isActive = true;

      console.log("[PollingConnection] Connection successful, calling onopen handler");

      // Call onopen handler FIRST before starting polling
      if (this.onopen) {
        this.onopen();
      } else {
        console.warn("[PollingConnection] No onopen handler registered!");
      }

      // Start polling after onopen
      this.startPolling();
    } catch (error) {
      console.error("[PollingConnection] Connection failed:", error);
      console.error("[PollingConnection] Error details:", {
        name: (error as Error)?.name,
        message: (error as Error)?.message,
        stack: (error as Error)?.stack,
      });
      this.readyState = this.CLOSED;
      if (this.onerror) {
        this.onerror(error);
      }
      if (this.onclose) {
        this.onclose({ code: 1006, reason: (error as Error)?.message || "Connection failed" });
      }
    }
  }

  private startPolling() {
    if (!this.isActive) return;

    const poll = async () => {
      if (!this.isActive || this.readyState !== this.OPEN) {
        return;
      }

      try {
        // Poll for new messages
        const pollUrl = `${this.backendUrl}/api/ai-chat/${this.sessionId}/poll`;
        const params = new URLSearchParams({
          token: this.token,
          lastMessageId: this.lastMessageId.toString(),
        });

        const response = await fetch(`${pollUrl}?${params.toString()}`, {
          method: "GET",
          headers: {
            "Content-Type": "application/json",
          },
        });

        if (!response.ok) {
          throw new Error(`Poll failed: ${response.status}`);
        }

        const data = await response.json();

        // Process new messages
        if (data.messages && Array.isArray(data.messages)) {
          for (const msg of data.messages) {
            if (msg.id > this.lastMessageId) {
              this.lastMessageId = msg.id;
            }

            // Call onmessage handler with WebSocket-like event
            if (this.onmessage) {
              this.onmessage({
                data: JSON.stringify(msg.payload),
              });
            }
          }
        }

        // Send any queued messages
        while (this.messageQueue.length > 0 && this.isActive) {
          const message = this.messageQueue.shift();
          await this.sendToBackend(message);
        }

      } catch (error) {
        console.error("[PollingConnection] Poll error:", error);
        // Don't call onerror for every failed poll, just log it
        // The connection might recover
      }

      // Schedule next poll
      if (this.isActive && this.readyState === this.OPEN) {
        this.pollTimer = setTimeout(poll, this.pollInterval);
      }
    };

    // Start first poll
    poll();
  }

  private async sendToBackend(message: any): Promise<void> {
    try {
      const sendUrl = `${this.backendUrl}/api/ai-chat/${this.sessionId}/send`;
      const response = await fetch(sendUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${this.token}`,
        },
        body: JSON.stringify(message),
      });

      if (!response.ok) {
        throw new Error(`Send failed: ${response.status}`);
      }
    } catch (error) {
      console.error("[PollingConnection] Send error:", error);
      throw error;
    }
  }

  /**
   * Send message (WebSocket-like interface)
   */
  public send(data: string): void {
    if (this.readyState !== this.OPEN) {
      console.warn("[PollingConnection] Cannot send, connection not open");
      return;
    }

    try {
      const message = JSON.parse(data);
      console.log("[PollingConnection] Queueing message:", message.type);
      this.messageQueue.push(message);
    } catch (error) {
      console.error("[PollingConnection] Failed to parse message:", error);
    }
  }

  /**
   * Close connection (WebSocket-like interface)
   */
  public close(code: number = 1000, reason: string = "Normal closure"): void {
    console.log("[PollingConnection] Closing connection:", { code, reason });
    console.trace("[PollingConnection] Close called from:");

    this.readyState = this.CLOSING;
    this.isActive = false;

    if (this.pollTimer) {
      clearTimeout(this.pollTimer);
      this.pollTimer = null;
    }

    // Send disconnect message
    if (code === 1000) {
      this.sendToBackend({ type: "disconnect" }).catch((err) => {
        console.error("[PollingConnection] Failed to send disconnect:", err);
      });
    }

    this.readyState = this.CLOSED;

    if (this.onclose) {
      this.onclose({ code, reason });
    }
  }
}

/**
 * Create a polling connection that mimics WebSocket
 */
export function createPollingConnection(
  url: string,
  options: PollingConnectionOptions
): PollingConnection {
  console.log("[createPollingConnection] Creating polling connection instead of WebSocket");
  return new PollingConnection(options);
}
