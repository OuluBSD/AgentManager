/**
 * Debug API Routes
 * Provides access to process logs and debugging information
 */

import type { FastifyInstance } from "fastify";
import { processLogger } from "../services/processLogger";
import { sessionManager } from "../services/sessionManager";

export async function debugRoutes(server: FastifyInstance) {
  /**
   * GET /debug/processes
   * Get all tracked processes
   */
  server.get("/debug/processes", async (request, reply) => {
    const processes = processLogger.getAllProcesses();
    return reply.send(processes);
  });

  /**
   * GET /debug/processes/:id
   * Get specific process details
   */
  server.get<{ Params: { id: string } }>("/debug/processes/:id", async (request, reply) => {
    const process = processLogger.getProcess(request.params.id);
    if (!process) {
      return reply.status(404).send({ error: "Process not found" });
    }
    return reply.send(process);
  });

  /**
   * GET /debug/processes/:id/io
   * Get I/O logs for a specific process
   */
  server.get<{
    Params: { id: string };
    Querystring: { limit?: string };
  }>("/debug/processes/:id/io", async (request, reply) => {
    const limit = request.query.limit ? parseInt(request.query.limit, 10) : undefined;
    const logs = processLogger.getIOLogs(request.params.id, limit);
    return reply.send(logs);
  });

  /**
   * GET /debug/websockets
   * Get WebSocket logs
   */
  server.get<{ Querystring: { limit?: string } }>("/debug/websockets", async (request, reply) => {
    const limit = request.query.limit ? parseInt(request.query.limit, 10) : undefined;
    const logs = processLogger.getWebSocketLogs(limit);
    return reply.send(logs);
  });

  /**
   * DELETE /debug/processes/:id/logs
   * Clear logs for a specific process
   */
  server.delete<{ Params: { id: string } }>("/debug/processes/:id/logs", async (request, reply) => {
    processLogger.clearProcessLogs(request.params.id);
    return reply.send({ success: true });
  });

  /**
   * DELETE /debug/logs
   * Clear all logs
   */
  server.delete("/debug/logs", async (request, reply) => {
    processLogger.clearAllLogs();
    return reply.send({ success: true });
  });

  /**
   * GET /debug/stats
   * Get debug statistics
   */
  server.get("/debug/stats", async (request, reply) => {
    const processes = processLogger.getAllProcesses();
    const runningCount = processes.filter((p) => p.status === "running").length;
    const exitedCount = processes.filter((p) => p.status === "exited").length;
    const errorCount = processes.filter((p) => p.status === "error").length;

    return reply.send({
      totalProcesses: processes.length,
      running: runningCount,
      exited: exitedCount,
      errors: errorCount,
      byType: {
        qwen: processes.filter((p) => p.type === "qwen").length,
        terminal: processes.filter((p) => p.type === "terminal").length,
        git: processes.filter((p) => p.type === "git").length,
        other: processes.filter((p) => p.type === "other").length,
      },
    });
  });

  /**
   * GET /debug/processes/:id/conversation
   * Get conversation messages for a specific process
   */
  server.get<{
    Params: { id: string };
    Querystring: { limit?: string };
  }>("/debug/processes/:id/conversation", async (request, reply) => {
    const limit = request.query.limit ? parseInt(request.query.limit, 10) : undefined;
    const messages = processLogger.getConversationMessages(request.params.id, limit);
    return reply.send(messages);
  });

  /**
   * GET /debug/processes/:id/tools
   * Get tool usage for a specific process
   */
  server.get<{
    Params: { id: string };
    Querystring: { limit?: string };
  }>("/debug/processes/:id/tools", async (request, reply) => {
    const limit = request.query.limit ? parseInt(request.query.limit, 10) : undefined;
    const tools = processLogger.getToolUsage(request.params.id, limit);
    return reply.send(tools);
  });

  /**
   * GET /debug/sessions
   * Get all active sessions
   */
  server.get("/debug/sessions", async (request, reply) => {
    const sessionIds = sessionManager.getActiveSessions();
    const sessions = sessionIds.map((id) => {
      const info = sessionManager.getSessionInfo(id);
      return {
        sessionId: id,
        refCount: info?.refCount,
        reopenCount: info?.reopenCount,
        firstOpened: info?.firstOpened,
        lastOpened: info?.lastOpened,
        handlerCount: info?.messageHandlers.size,
      };
    });

    return reply.send({
      count: sessions.length,
      sessions,
    });
  });

  /**
   * GET /debug/sessions/:sessionId
   * Get specific session details
   */
  server.get<{ Params: { sessionId: string } }>(
    "/debug/sessions/:sessionId",
    async (request, reply) => {
      const info = sessionManager.getSessionInfo(request.params.sessionId);

      if (!info) {
        return reply.status(404).send({ error: "Session not found" });
      }

      return reply.send({
        sessionId: request.params.sessionId,
        refCount: info.refCount,
        reopenCount: info.reopenCount,
        firstOpened: info.firstOpened,
        lastOpened: info.lastOpened,
        handlerCount: info.messageHandlers.size,
        connectionIds: Array.from(info.messageHandlers.keys()),
      });
    }
  );
}
