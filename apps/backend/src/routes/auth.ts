import type { FastifyPluginAsync } from "fastify";
import { createSession, store } from "../services/mockStore";
import { requireSession } from "../utils/auth";

export const authRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.post("/login", async (request, reply) => {
    const body = request.body as { username?: string; password?: string; keyfileToken?: string };
    if (!body?.username) {
      reply.code(400).send({ error: { code: "bad_request", message: "username is required" } });
      return;
    }

    const session = createSession(body.username);
    reply.send({ token: session.token, user: { id: session.userId, username: session.username } });
  });

  fastify.post("/logout", async (request, reply) => {
    const session = requireSession(request, reply);
    if (!session) return;
    store.sessions.delete(session.token);
    reply.code(204).send();
  });
};
