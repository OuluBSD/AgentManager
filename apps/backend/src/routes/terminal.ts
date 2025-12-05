import type { FastifyPluginAsync } from "fastify";
import {
  closeTerminalSession,
  createTerminalSession,
  getTerminalSession,
  sendInput,
} from "../services/terminalManager";
import { processLogger } from "../services/processLogger";
import { requireSession, validateToken } from "../utils/auth";
import { findProject } from "../utils/projects";
import { recordAuditEvent } from "../services/auditLogger";
import { createServerRepository } from "../services/serverRepository";
import { eq } from "drizzle-orm";
import * as schema from "@nexus/shared/db/schema";

const DEFAULT_IDLE_MS = 10 * 60 * 1000;

function isLocalHost(host?: string | null) {
  if (!host) return false;
  const h = host.toLowerCase();
  return h === "localhost" || h === "127.0.0.1" || h === "0.0.0.0" || h === "::1";
}

function buildTerminalWsCandidates(
  request: any,
  sessionId: string,
  token?: string | null
): string[] {
  const candidates = new Set<string>();
  const pushCandidate = (base: string) => {
    try {
      const baseUrl = new URL(base);
      baseUrl.protocol = baseUrl.protocol === "https:" ? "wss:" : "ws:";
      const url = new URL(`/api/terminal/sessions/${sessionId}/stream`, baseUrl);
      if (token) {
        url.searchParams.set("token", token);
      }
      candidates.add(url.toString());
    } catch (err) {
      request?.server?.log?.warn?.({ err, base }, "[terminal] Invalid WebSocket base candidate");
    }
  };

  const forwardedHost =
    (request.headers["x-forwarded-host"] as string | undefined) ||
    (request.headers.host as string | undefined);
  const forwardedProto =
    (request.headers["x-forwarded-proto"] as string | undefined) ||
    (typeof request.protocol === "string" ? request.protocol : "http");

  if (forwardedHost) {
    const proto = forwardedProto?.startsWith("https") ? "https" : "http";
    pushCandidate(`${proto}://${forwardedHost}`);

    const backendPort =
      process.env.NEXT_PUBLIC_BACKEND_HTTP_PORT || process.env.PORT || process.env.BACKEND_PORT;
    if (backendPort) {
      const [hostOnly, portFromHost] = forwardedHost.split(":");
      if (hostOnly && (!portFromHost || portFromHost !== backendPort)) {
        pushCandidate(`${proto}://${hostOnly}:${backendPort}`);
      }
    }
  }

  const envBase = process.env.NEXT_PUBLIC_BACKEND_HTTP_BASE || process.env.BACKEND_HTTP_BASE;
  if (envBase) {
    try {
      const envUrl = new URL(envBase);
      const envIsLocal = isLocalHost(envUrl.hostname);
      const forwardedHostName = forwardedHost?.split(":")[0];
      if (envIsLocal && forwardedHostName && !isLocalHost(forwardedHostName)) {
        // Skip localhost candidates when client is on a LAN host.
      } else {
        pushCandidate(envBase);
      }
    } catch {
      pushCandidate(envBase);
    }
  }

  const localHost = process.env.HOST || "127.0.0.1";
  const localPort = process.env.PORT || process.env.BACKEND_PORT;
  if (localPort && (!forwardedHost || isLocalHost(forwardedHost.split(":")[0]))) {
    pushCandidate(`${forwardedProto || "http"}://${localHost}:${localPort}`);
  }

  return Array.from(candidates);
}

/**
 * Helper function to check if a project has a worker server attached
 */
async function checkWorkerServerAttachment(fastify: any, projectId: string) {
  const serverRepo = createServerRepository(fastify.db, fastify.jsonDb);
  if (!serverRepo) {
    return { hasWorker: false, error: "Database not available" };
  }

  // Get project workspaces for this project
  if (fastify.db) {
    const workspaces = await fastify.db
      .select()
      .from(schema.projectWorkspaces)
      .where(eq(schema.projectWorkspaces.projectId, projectId));

    if (workspaces.length === 0) {
      return {
        hasWorker: false,
        error: "No worker server attached to this project. Please attach a worker server in the project roadmap settings.",
      };
    }

    // Check if any of the workspace servers are worker servers and online
    for (const workspace of workspaces) {
      const server = await serverRepo.getServer(workspace.serverId);
      if (server && server.type === "worker" && server.status === "online") {
        return { hasWorker: true, server };
      }
    }

    return {
      hasWorker: false,
      error: "Worker server is offline or not configured. Please ensure a worker server is online and attached to this project.",
    };
  }

  // For JSON database, we'll check if servers exist
  const servers = await serverRepo.listServers();
  const workerServers = servers.filter((s) => s.type === "worker" && s.status === "online");

  if (workerServers.length === 0) {
    return {
      hasWorker: false,
      error: "No online worker servers available. Please start a worker server or check server status.",
    };
  }

  return { hasWorker: true, server: workerServers[0] };
}

export const terminalRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.post("/terminal/sessions", async (request, reply) => {
    const session = await requireSession(request, reply);
    if (!session) return;
    const body = request.body as { projectId?: string; cwd?: string };
    if (body?.projectId) {
      const project = await findProject(fastify, body.projectId);
      if (!project) {
        reply.code(404).send({ error: { code: "not_found", message: "Project not found" } });
        return;
      }

      // Check for worker server attachment
      const workerCheck = await checkWorkerServerAttachment(fastify, body.projectId);
      if (!workerCheck.hasWorker) {
        reply.code(400).send({
          error: {
            code: "no_worker_server",
            message: workerCheck.error || "No worker server attached to this project",
          },
        });
        return;
      }
    }

    const terminal = await createTerminalSession(body?.projectId, body?.cwd);
    if (!terminal) {
      reply
        .code(400)
        .send({ error: { code: "bad_path", message: "Failed to start terminal session" } });
      return;
    }
    await recordAuditEvent(fastify, {
      userId: session.userId,
      projectId: body?.projectId ?? null,
      eventType: "terminal:start",
      sessionId: terminal.id,
      ipAddress: request.ip,
      metadata: body?.cwd ? { cwd: body.cwd, ip: request.ip } : { ip: request.ip },
    });
    const authHeader = request.headers["authorization"];
    const bearer =
      typeof authHeader === "string" && authHeader.startsWith("Bearer ")
        ? authHeader.slice(7)
        : null;
    const token =
      bearer ?? (request.headers["x-session-token"] as string | undefined) ?? session?.token;
    const wsCandidates = buildTerminalWsCandidates(request, terminal.id, token);
    reply.code(201).send({ sessionId: terminal.id, wsCandidates });
  });

  fastify.get(
    "/terminal/sessions/:sessionId/stream",
    { websocket: true },
    async (connection, request) => {
      const params = request.params as { sessionId: string };
      const header = request.headers["authorization"];
      const bearer =
        typeof header === "string" && header.startsWith("Bearer ") ? header.slice(7) : null;
      const query = request.query as { token?: string };
      const token =
        bearer ?? (request.headers["x-session-token"] as string | undefined) ?? query?.token;
      const session = await validateToken(request.server, token);
      if (!session) {
        processLogger.logWebSocket({
          id: `ws-${params.sessionId}-${Date.now()}-unauthorized`,
          connectionId: params.sessionId,
          timestamp: new Date().toISOString(),
          direction: "send",
          messageType: "terminal:close",
          content: "unauthorized",
          metadata: { ip: request.ip },
        });
        connection.socket.close(1008, "unauthorized");
        return;
      }

      const managed = getTerminalSession(params.sessionId);
      if (!managed) {
        processLogger.logWebSocket({
          id: `ws-${params.sessionId}-${Date.now()}-missing`,
          connectionId: params.sessionId,
          timestamp: new Date().toISOString(),
          direction: "send",
          messageType: "terminal:close",
          content: "session not found",
          metadata: { ip: request.ip },
        });
        connection.socket.close(1008, "session not found");
        return;
      }

      const idleEnv = Number(process.env.TERMINAL_IDLE_MS ?? "");
      const idleTimeoutMs = Number.isFinite(idleEnv) && idleEnv >= 0 ? idleEnv : DEFAULT_IDLE_MS;

      let socketClosed = false;
      let exitLogged = false;
      let exitReason: "idle_timeout" | null = null;
      let idleTimer: NodeJS.Timeout | null = null;

      const resetIdleTimer = () => {
        if (!idleTimeoutMs) return;
        if (idleTimer) clearTimeout(idleTimer);
        idleTimer = setTimeout(() => {
          exitReason = "idle_timeout";
          socketClosed = true;
          if (connection.socket.readyState === connection.socket.OPEN) {
            connection.socket.send(
              `\n[session closed after ${Math.round(idleTimeoutMs / 1000)}s idle timeout]\n`
            );
            connection.socket.close(4000, "idle timeout");
          }
          closeTerminalSession(params.sessionId);
        }, idleTimeoutMs);
      };

      resetIdleTimer();

      const handleStdout = (chunk: Buffer) => {
        if (connection.socket.readyState === connection.socket.OPEN) {
          connection.socket.send(chunk);
        }
      };
      const handleStderr = (chunk: Buffer) => {
        if (connection.socket.readyState === connection.socket.OPEN) {
          connection.socket.send(chunk);
        }
      };
      const handleExit = (code: number | null, signal: NodeJS.Signals | null) => {
        if (idleTimer) clearTimeout(idleTimer);
        idleTimer = null;
        if (!exitLogged) {
          exitLogged = true;
          recordAuditEvent(fastify, {
            userId: session.userId,
            projectId: managed.projectId ?? null,
            eventType: "terminal:exit",
            sessionId: managed.id,
            ipAddress: request.ip,
            metadata: {
              code: code ?? 0,
              signal: signal ?? null,
              ip: request.ip,
              ...(exitReason ? { reason: exitReason, idleMs: idleTimeoutMs } : {}),
            },
          }).catch((err) => fastify.log.error({ err }, "Failed to record terminal exit"));
        }
        if (!socketClosed && connection.socket.readyState === connection.socket.OPEN) {
          const exitMessage =
            exitReason === "idle_timeout"
              ? `\n[session closed after ${Math.round(idleTimeoutMs / 1000)}s idle timeout]\n`
              : `\n[process exited with code ${code ?? "0"}]\n`;
          connection.socket.send(exitMessage);
          connection.socket.close();
        }
      };

      managed.proc.stdout.on("data", handleStdout);
      managed.proc.stderr.on("data", handleStderr);
      managed.proc.on("exit", handleExit);

      connection.socket.on("message", (data: Buffer) => {
        const input = Buffer.isBuffer(data) ? data : Buffer.from(String(data));
        managed.proc.stdin.write(input);
        resetIdleTimer();
      });

      connection.socket.on("close", () => {
        socketClosed = true;
        managed.proc.stdout.off("data", handleStdout);
        managed.proc.stderr.off("data", handleStderr);
        if (idleTimer) clearTimeout(idleTimer);
        idleTimer = null;
        closeTerminalSession(params.sessionId);
        processLogger.logWebSocket({
          id: `ws-${params.sessionId}-${Date.now()}-close`,
          connectionId: params.sessionId,
          timestamp: new Date().toISOString(),
          direction: "send",
          messageType: "terminal:close",
          content: "client closed",
          metadata: { ip: request.ip },
        });
      });

      connection.socket.on("error", (err) => {
        socketClosed = true;
        managed.proc.stdout.off("data", handleStdout);
        managed.proc.stderr.off("data", handleStderr);
        if (idleTimer) clearTimeout(idleTimer);
        idleTimer = null;
        closeTerminalSession(params.sessionId);
        if (connection.socket.readyState === connection.socket.OPEN) {
          connection.socket.close(1011, "socket error");
        }
        processLogger.logWebSocket({
          id: `ws-${params.sessionId}-${Date.now()}-error`,
          connectionId: params.sessionId,
          timestamp: new Date().toISOString(),
          direction: "send",
          messageType: "terminal:error",
          content: err instanceof Error ? err.message : "socket error",
          metadata: { ip: request.ip },
        });
      });

      connection.socket.send("terminal stream ready");
      processLogger.logWebSocket({
        id: `ws-${params.sessionId}-${Date.now()}-open`,
        connectionId: params.sessionId,
        timestamp: new Date().toISOString(),
        direction: "receive",
        messageType: "terminal:open",
        content: "terminal stream ready",
        metadata: { ip: request.ip, idleTimeoutMs },
      });
    }
  );

  fastify.post("/terminal/sessions/:sessionId/input", async (request, reply) => {
    const session = await requireSession(request, reply);
    if (!session) return;
    const params = request.params as { sessionId: string };
    const body = request.body as { data?: string };
    if (!body?.data) {
      reply.code(400).send({ error: { code: "missing_input", message: "data is required" } });
      return;
    }
    const ok = sendInput(params.sessionId, body.data);
    if (!ok) {
      reply.code(404).send({ error: { code: "not_found", message: "Session not found" } });
      return;
    }
    const preview = body.data.slice(0, 120);
    const length = body.data.length;
    await recordAuditEvent(fastify, {
      userId: session.userId,
      eventType: "terminal:input",
      projectId: getTerminalSession(params.sessionId)?.projectId,
      sessionId: params.sessionId,
      ipAddress: request.ip,
      metadata: {
        preview,
        length,
        bytes: Buffer.byteLength(body.data, "utf8"),
        truncated: length > preview.length,
        ip: request.ip,
      },
    });
    reply.send({ accepted: true });
  });
};
