import { FastifyReply, FastifyRequest } from "fastify";
import { store } from "../services/mockStore";

export function requireSession(request: FastifyRequest, reply: FastifyReply) {
  const header = request.headers["authorization"];
  const bearer = typeof header === "string" && header.startsWith("Bearer ") ? header.slice(7) : null;
  const token = bearer ?? (request.headers["x-session-token"] as string | undefined);

  if (!token || !store.sessions.has(token)) {
    reply.code(401).send({ error: { code: "unauthorized", message: "Missing or invalid session" } });
    return null;
  }

  return store.sessions.get(token)!;
}
