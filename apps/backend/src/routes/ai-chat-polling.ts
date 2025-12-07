/**
 * AI Chat HTTP Polling Routes - Fallback for WebSocket
 *
 * Provides HTTP polling endpoints that mimic WebSocket behavior
 * This is a temporary solution until WebSocket issues are resolved
 */

import type { FastifyPluginAsync } from "fastify";
import { validateToken } from "../utils/auth.js";
import { AIBackendType } from "@nexus/shared/chat/AIBackend";
import { sessionManager } from "../services/sessionManager.js";
import { processLogger } from "../services/processLogger.js";

interface PollingMessage {
  id: number;
  timestamp: number;
  payload: any;
}

// Store messages per session for polling
const sessionMessages = new Map<string, PollingMessage[]>();
const messageIdCounter = new Map<string, number>();

function getNextMessageId(sessionId: string): number {
  const current = messageIdCounter.get(sessionId) || 0;
  const next = current + 1;
  messageIdCounter.set(sessionId, next);
  return next;
}

function addMessage(sessionId: string, payload: any): void {
  if (!sessionMessages.has(sessionId)) {
    sessionMessages.set(sessionId, []);
  }

  const messages = sessionMessages.get(sessionId)!;
  const message: PollingMessage = {
    id: getNextMessageId(sessionId),
    timestamp: Date.now(),
    payload,
  };

  messages.push(message);

  // Keep only last 100 messages per session
  if (messages.length > 100) {
    messages.shift();
  }
}

function getMessages(sessionId: string, afterId: number): PollingMessage[] {
  const messages = sessionMessages.get(sessionId) || [];
  return messages.filter((msg) => msg.id > afterId);
}

function clearMessages(sessionId: string): void {
  sessionMessages.delete(sessionId);
  messageIdCounter.delete(sessionId);
}

export const aiChatPollingRoutes: FastifyPluginAsync = async (fastify) => {
  /**
   * Initialize session
   */
  fastify.post<{
    Params: { sessionId: string };
    Querystring: { backend: AIBackendType; token: string; challenge?: string; workspace?: string };
  }>(
    "/ai-chat/:sessionId/init",
    {
      schema: {
        body: { type: "object", additionalProperties: true, nullable: true },
      },
    },
    async (request, reply) => {
      const { sessionId } = request.params;
      const { backend, token, challenge, workspace } = request.query;

    const session = await validateToken(fastify, token);
    if (!session) {
      return reply.code(401).send({ error: "unauthorized" });
    }

    fastify.log.info(
      `[AIChat Polling] Initializing session ${sessionId} with backend ${backend}`
    );

    if (backend !== "qwen") {
      return reply.code(400).send({ error: `Backend '${backend}' not implemented` });
    }

    try {
      const { resolveAiChain } = await import("../services/aiChatBridge.js");
      const chain = await resolveAiChain(fastify);

      const connectionId = `poll-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;

      // Create bridge for this session
      const result = await sessionManager.getOrCreateBridge(
        sessionId,
        connectionId,
        fastify.log,
        chain,
        (msg: any) => {
          // Queue message for polling
          addMessage(sessionId, msg);
        },
        {
          workspaceRoot: workspace,
          purpose: "AI Chat Session (Polling)",
          initiator: {
            type: "user",
            userId: session.userId,
            sessionId: sessionId,
            username: session.username,
          },
        }
      );

      processLogger.logWebSocket({
        id: `ai-poll-${sessionId}-${Date.now()}-init`,
        connectionId,
        timestamp: new Date().toISOString(),
        direction: "receive",
        messageType: "ai-chat:init",
        content: `backend=${backend}`,
        metadata: { ip: request.ip },
      });

      // Send initial messages
      addMessage(sessionId, {
        type: "status",
        state: "idle",
        message: `Connected via HTTP polling`,
        transport: "polling",
        challenge: challenge === "true",
      });

      addMessage(sessionId, {
        type: "info",
        message:
          challenge === "true"
            ? "Challenge mode enabled: the assistant may question or push back on unclear requests."
            : "Challenge mode disabled: the assistant will default to cooperative responses.",
      });

      return reply.send({
        success: true,
        sessionId,
        connectionId,
        isNew: result.isNew,
      });
    } catch (err: any) {
      fastify.log.error({ err }, "[AIChat Polling] Failed to initialize session");
      return reply.code(500).send({ error: err?.message || "Failed to initialize session" });
    }
  });

  /**
   * Poll for new messages
   */
  fastify.get("/ai-chat/:sessionId/poll", async (request, reply) => {
    const { sessionId } = request.params as { sessionId: string };
    const { token, lastMessageId } = request.query as {
      token: string;
      lastMessageId?: string;
    };

    const session = await validateToken(fastify, token);
    if (!session) {
      return reply.code(401).send({ error: "unauthorized" });
    }

    const afterId = lastMessageId ? parseInt(lastMessageId, 10) : 0;
    const messages = getMessages(sessionId, afterId);

    return reply.send({ messages });
  });

  /**
   * Send message to session
   */
  fastify.post("/ai-chat/:sessionId/send", async (request, reply) => {
    const { sessionId } = request.params as { sessionId: string };
    const token = request.headers.authorization?.replace("Bearer ", "");

    if (!token) {
      return reply.code(401).send({ error: "unauthorized" });
    }

    const session = await validateToken(fastify, token);
    if (!session) {
      return reply.code(401).send({ error: "unauthorized" });
    }

    const message = request.body as any;
    fastify.log.info(`[AIChat Polling] Received message for session ${sessionId}: type=${message?.type || 'UNDEFINED'}, body=`, message);

    // Handle disconnect
    if (message.type === "disconnect") {
      const connectionId = `poll-${sessionId}`;
      await sessionManager.releaseSession(sessionId, connectionId, fastify.log);
      clearMessages(sessionId);
      return reply.send({ success: true });
    }

    // Forward message to bridge
    try {
      const bridge = await sessionManager.getBridge(sessionId);
      if (!bridge) {
        return reply.code(404).send({ error: "session not found" });
      }

      bridge.send(message);

      return reply.send({ success: true });
    } catch (err: any) {
      fastify.log.error({ err }, "[AIChat Polling] Failed to send message");
      return reply.code(500).send({ error: err?.message || "Failed to send message" });
    }
  });

  /**
   * Close session
   */
  fastify.delete("/ai-chat/:sessionId", async (request, reply) => {
    const { sessionId } = request.params as { sessionId: string };
    const { token } = request.query as { token: string };

    const session = await validateToken(fastify, token);
    if (!session) {
      return reply.code(401).send({ error: "unauthorized" });
    }

    fastify.log.info(`[AIChat Polling] Closing session ${sessionId}`);

    const connectionId = `poll-${sessionId}`;
    await sessionManager.releaseSession(sessionId, connectionId, fastify.log);
    clearMessages(sessionId);

    processLogger.logWebSocket({
      id: `ai-poll-${sessionId}-${Date.now()}-close`,
      connectionId,
      timestamp: new Date().toISOString(),
      direction: "send",
      messageType: "ai-chat:close",
      content: "client closed",
      metadata: { ip: request.ip },
    });

    return reply.send({ success: true });
  });
};
