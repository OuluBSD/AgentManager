/**
 * Session Manager for QwenClient instances
 * Manages lifecycle and reuse of QwenClient sessions
 */

import type { FastifyBaseLogger } from "fastify";
import type { AiBridge, AiChainSelection } from "./aiChatBridge.js";
import { DirectQwenBridge } from "./aiChatBridge.js";
import { processLogger } from "./processLogger.js";

export interface SessionConfig {
  workspaceRoot?: string;
  model?: string;
  mode?: "stdio" | "tcp";
  purpose?: string;
  initiator?: {
    type: "user" | "system";
    userId?: string;
    sessionId?: string;
    username?: string;
  };
  sessionInfo?: {
    sessionId: string;
    reopenCount: number;
    firstOpened: Date;
    lastOpened: Date;
  };
}

interface ManagedSession {
  bridge: AiBridge;
  sessionId: string;
  refCount: number;
  firstOpened: Date;
  lastOpened: Date;
  reopenCount: number;
  config: SessionConfig;
  messageHandlers: Map<string, (msg: any) => void>; // connectionId -> handler
  qwenClient: any; // Reference to the underlying QwenClient for adding handlers
}

/**
 * Global session manager singleton
 */
class SessionManagerService {
  private sessions: Map<string, ManagedSession> = new Map();

  /**
   * Get or create a bridge for a session
   * Returns both the bridge and a unique connection ID for handler management
   */
  async getOrCreateBridge(
    sessionId: string,
    connectionId: string,
    log: FastifyBaseLogger,
    chain: AiChainSelection,
    onMessage: (msg: any) => void,
    config?: SessionConfig
  ): Promise<{ bridge: AiBridge; connectionId: string }> {
    let existing = this.sessions.get(sessionId);

    if (existing) {
      // Wait if session is still initializing
      if ((existing as any).promise) {
        log.info(`[SessionManager] Waiting for session ${sessionId} to finish initializing...`);
        await (existing as any).promise;
        existing = this.sessions.get(sessionId)!;
      }

      // Reuse existing session - add new message handler
      existing.refCount++;
      existing.reopenCount++;
      existing.lastOpened = new Date();
      existing.messageHandlers.set(connectionId, onMessage);

      // Add handler to the underlying QwenClient
      if (existing.qwenClient && existing.qwenClient.addMessageHandler) {
        existing.qwenClient.addMessageHandler(onMessage);
      }

      log.info(
        `[SessionManager] Reusing existing session ${sessionId} connectionId=${connectionId} (refCount: ${existing.refCount}, reopenCount: ${existing.reopenCount}, handlers: ${existing.messageHandlers.size})`
      );

      // Update session info in process logger
      const processId = this.getProcessIdForSession(sessionId);
      if (processId) {
        processLogger.trackSessionReopen(processId);
      }

      return { bridge: existing.bridge, connectionId };
    }

    // Create new session - reserve the slot immediately to prevent race conditions
    const now = new Date();
    const sessionConfig: SessionConfig = {
      ...config,
      sessionInfo: {
        sessionId,
        reopenCount: 0,
        firstOpened: now,
        lastOpened: now,
      },
    };

    log.info(`[SessionManager] Creating new session ${sessionId} connectionId=${connectionId}`);

    // Create a promise that will resolve when initialization is complete
    const initPromise = (async () => {
      const bridge = new DirectQwenBridge(chain, log, onMessage, sessionConfig);
      await bridge.start();

      // Get reference to underlying QwenClient (hack, but necessary for handler management)
      const qwenClient = (bridge as any).client;

      const messageHandlers = new Map<string, (msg: any) => void>();
      messageHandlers.set(connectionId, onMessage);

      const session: ManagedSession = {
        bridge,
        sessionId,
        refCount: 1,
        firstOpened: now,
        lastOpened: now,
        reopenCount: 0,
        config: sessionConfig,
        messageHandlers,
        qwenClient,
      };

      // Replace the placeholder with the real session
      this.sessions.set(sessionId, session);

      log.info(
        `[SessionManager] Session ${sessionId} created (refCount: 1, reopenCount: 0, handlers: 1)`
      );

      return { bridge, connectionId };
    })();

    // Store a placeholder with the initialization promise
    // This prevents other connections from creating duplicate sessions
    this.sessions.set(sessionId, { promise: initPromise } as any);

    return initPromise;
  }

  /**
   * Release a session reference
   * Removes the specific connection's message handler
   * Only cleans up when refCount reaches 0
   */
  async releaseSession(
    sessionId: string,
    connectionId: string,
    log: FastifyBaseLogger
  ): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (!session) {
      log.warn(`[SessionManager] Attempted to release unknown session ${sessionId}`);
      return;
    }

    // Remove the message handler for this connection
    const handler = session.messageHandlers.get(connectionId);
    if (handler && session.qwenClient && session.qwenClient.removeMessageHandler) {
      session.qwenClient.removeMessageHandler(handler);
      session.messageHandlers.delete(connectionId);
      log.info(
        `[SessionManager] Removed handler for connection ${connectionId} from session ${sessionId} (remaining handlers: ${session.messageHandlers.size})`
      );
    }

    session.refCount--;
    log.info(
      `[SessionManager] Released session ${sessionId} connectionId=${connectionId} (refCount: ${session.refCount}, handlers: ${session.messageHandlers.size})`
    );

    if (session.refCount <= 0) {
      log.info(
        `[SessionManager] Cleaning up session ${sessionId} (refCount reached 0, handlers: ${session.messageHandlers.size})`
      );
      await session.bridge.shutdown();
      this.sessions.delete(sessionId);
      log.info(`[SessionManager] Session ${sessionId} cleaned up and removed`);
    }
  }

  /**
   * Get active session count
   */
  getActiveSessionCount(): number {
    return this.sessions.size;
  }

  /**
   * Get all active session IDs
   */
  getActiveSessions(): string[] {
    return Array.from(this.sessions.keys());
  }

  /**
   * Get session info
   */
  getSessionInfo(sessionId: string): ManagedSession | undefined {
    return this.sessions.get(sessionId);
  }

  /**
   * Force cleanup of a session (for debugging)
   */
  async forceCleanupSession(sessionId: string, log: FastifyBaseLogger): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (!session) {
      log.warn(`[SessionManager] Attempted to force cleanup unknown session ${sessionId}`);
      return;
    }

    log.info(
      `[SessionManager] Force cleaning up session ${sessionId} (refCount: ${session.refCount})`
    );
    await session.bridge.shutdown();
    this.sessions.delete(sessionId);
    log.info(`[SessionManager] Session ${sessionId} force cleaned up`);
  }

  /**
   * Cleanup all sessions (for shutdown)
   */
  async cleanupAll(log: FastifyBaseLogger): Promise<void> {
    log.info(`[SessionManager] Cleaning up all ${this.sessions.size} sessions`);
    for (const [sessionId, session] of this.sessions.entries()) {
      try {
        await session.bridge.shutdown();
        log.info(`[SessionManager] Session ${sessionId} cleaned up`);
      } catch (err) {
        log.error({ err, sessionId }, `[SessionManager] Error cleaning up session`);
      }
    }
    this.sessions.clear();
    log.info(`[SessionManager] All sessions cleaned up`);
  }

  /**
   * Get process ID for a session (helper)
   */
  private getProcessIdForSession(sessionId: string): string | null {
    const processes = processLogger.getAllProcesses();
    const process = processes.find(
      (p) => p.sessionInfo?.sessionId === sessionId || p.initiator?.sessionId === sessionId
    );
    return process?.id || null;
  }
}

// Export singleton instance
export const sessionManager = new SessionManagerService();
