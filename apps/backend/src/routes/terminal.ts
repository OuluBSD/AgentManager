import type { FastifyPluginAsync } from "fastify";
import { createTerminalSession, store } from "../services/mockStore";
import { requireSession } from "../utils/auth";

export const terminalRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.post("/terminal/sessions", async (request, reply) => {
    if (!requireSession(request, reply)) return;
    const body = request.body as { projectId?: string; cwd?: string };
    const session = createTerminalSession(body?.projectId, body?.cwd);
    reply.code(201).send({ sessionId: session.id });
  });

  fastify.get(
    "/terminal/sessions/:sessionId/stream",
    { websocket: true },
    async (connection, request) => {
      const header = request.headers["authorization"];
      const bearer =
        typeof header === "string" && header.startsWith("Bearer ") ? header.slice(7) : null;
      const token = bearer ?? (request.headers["x-session-token"] as string | undefined);
      if (!token || !store.sessions.has(token)) {
        connection.socket.close(1008, "unauthorized");
        return;
      }

      connection.socket.send("terminal stream ready");
      connection.socket.on("message", (data: Buffer) => {
        connection.socket.send(`echo: ${data.toString()}`);
      });
    }
  );

  fastify.post("/terminal/sessions/:sessionId/input", async (request, reply) => {
    if (!requireSession(request, reply)) return;
    reply.send({ accepted: true });
  });
};
