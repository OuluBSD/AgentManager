import type { FastifyPluginAsync } from "fastify";
import {
  createSession as dbCreateSession,
  createUser,
  deleteSession as dbDeleteSession,
  getUserByUsername,
  purgeExpiredSessions,
  updateUserPassword,
  updateUserKeyfile,
  verifyKeyfile,
  verifyPassword,
} from "../services/authRepository";
import * as jsonAuthRepo from "../services/jsonAuthRepository";
import { createSession, store } from "../services/mockStore";
import { requireSession } from "../utils/auth";
import { recordAuditEvent } from "../services/auditLogger";

const LOGIN_WINDOW_MS = 5 * 60 * 1000; // 5 minutes
const LOGIN_BLOCK_MS = 2 * 60 * 1000; // 2 minutes lockout after max failures
const LOGIN_MAX_FAILURES = 5;

const loginAttempts = new Map<
  string,
  { failures: number; firstAttempt: number; blockedUntil?: number }
>();

function loginAttemptKey(username: string | undefined, ip: string) {
  return `${username ?? "unknown"}|${ip}`;
}

function recordFailure(key: string) {
  const now = Date.now();
  const current = loginAttempts.get(key);
  if (!current || now - current.firstAttempt > LOGIN_WINDOW_MS) {
    loginAttempts.set(key, { failures: 1, firstAttempt: now });
    return;
  }
  const failures = current.failures + 1;
  const blockedUntil = failures >= LOGIN_MAX_FAILURES ? now + LOGIN_BLOCK_MS : current.blockedUntil;
  loginAttempts.set(key, { failures, firstAttempt: current.firstAttempt, blockedUntil });
}

function isBlocked(key: string) {
  const entry = loginAttempts.get(key);
  if (!entry) return null;
  const now = Date.now();
  if (entry.blockedUntil && entry.blockedUntil > now) {
    return entry.blockedUntil;
  }
  if (entry.blockedUntil && entry.blockedUntil <= now) {
    loginAttempts.delete(key);
    return null;
  }
  if (now - entry.firstAttempt > LOGIN_WINDOW_MS) {
    loginAttempts.delete(key);
    return null;
  }
  return null;
}

export const authRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.post("/login", async (request, reply) => {
    const body = request.body as { username?: string; password?: string; keyfileToken?: string };
    if (!body?.username) {
      reply.code(400).send({ error: { code: "bad_request", message: "username is required" } });
      return;
    }

    const attemptKey = loginAttemptKey(body.username, request.ip);
    const blockedUntil = isBlocked(attemptKey);
    if (blockedUntil) {
      const retryAfterMs = blockedUntil - Date.now();
      reply
        .code(429)
        .header("Retry-After", Math.ceil(retryAfterMs / 1000))
        .send({
          error: {
            code: "rate_limited",
            message: "Too many failed login attempts. Please wait before retrying.",
          },
        });
      return;
    }

    // Try JSON database if available
    if (fastify.jsonDb) {
      try {
        await jsonAuthRepo.purgeExpiredSessions(fastify.jsonDb);
        const existing = await jsonAuthRepo.getUserByUsername(fastify.jsonDb, body.username);
        const passwordValid =
          !!existing?.passwordHash &&
          !!body.password &&
          jsonAuthRepo.verifyPassword(body.password, existing.passwordHash);
        const keyfileValid =
          !!existing?.keyfilePath &&
          !!body.keyfileToken &&
          jsonAuthRepo.verifyKeyfile(body.keyfileToken, existing.keyfilePath);

        if (existing) {
          const needsPassword = !!existing.passwordHash;
          const needsKeyfile = !!existing.keyfilePath;
          const authenticated = passwordValid || keyfileValid || (!needsPassword && !needsKeyfile);

          if (!authenticated) {
            recordFailure(attemptKey);
            reply
              .code(401)
              .send({ error: { code: "unauthorized", message: "Invalid credentials for user" } });
            return;
          }

          if (!existing.passwordHash && body.password) {
            await jsonAuthRepo.updateUserPassword(fastify.jsonDb, existing.id, body.password);
          }
          if (!existing.keyfilePath && body.keyfileToken) {
            await jsonAuthRepo.updateUserKeyfile(fastify.jsonDb, existing.id, body.keyfileToken);
          }

          const sessionRow = await jsonAuthRepo.createSession(fastify.jsonDb, existing.id);
          reply.send({
            token: sessionRow.token,
            user: { id: existing.id, username: existing.username },
          });
          loginAttempts.delete(attemptKey);
          await recordAuditEvent(fastify, {
            userId: existing.id,
            eventType: "auth:login",
            ipAddress: request.ip,
            metadata: {
              username: existing.username,
              method: body.password ? "password" : "keyfile",
            },
          });
          return;
        }

        if (!body.password && !body.keyfileToken) {
          recordFailure(attemptKey);
          reply.code(400).send({
            error: { code: "bad_request", message: "Provide a password or keyfileToken" },
          });
          return;
        }

        const userRow = await jsonAuthRepo.createUser(fastify.jsonDb, body.username, body.password);
        if (body.keyfileToken) {
          await jsonAuthRepo.updateUserKeyfile(fastify.jsonDb, userRow.id, body.keyfileToken);
        }

        const sessionRow = await jsonAuthRepo.createSession(fastify.jsonDb, userRow.id);
        reply.send({
          token: sessionRow.token,
          user: { id: userRow.id, username: userRow.username },
        });
        loginAttempts.delete(attemptKey);
        await recordAuditEvent(fastify, {
          userId: userRow.id,
          eventType: "auth:register",
          ipAddress: request.ip,
          metadata: {
            username: userRow.username,
          },
        });
        return;
      } catch (err) {
        fastify.log.error(
          { err },
          "Failed to login with JSON database; falling back to PostgreSQL."
        );
      }
    }

    // Try PostgreSQL database if available
    if (fastify.db) {
      try {
        await purgeExpiredSessions(fastify.db);
        const existing = await getUserByUsername(fastify.db, body.username);
        const passwordValid =
          !!existing?.passwordHash &&
          !!body.password &&
          verifyPassword(body.password, existing.passwordHash);
        const keyfileValid =
          !!existing?.keyfilePath &&
          !!body.keyfileToken &&
          verifyKeyfile(body.keyfileToken, existing.keyfilePath);

        if (existing) {
          const needsPassword = !!existing.passwordHash;
          const needsKeyfile = !!existing.keyfilePath;
          const authenticated = passwordValid || keyfileValid || (!needsPassword && !needsKeyfile);

          if (!authenticated) {
            recordFailure(attemptKey);
            reply
              .code(401)
              .send({ error: { code: "unauthorized", message: "Invalid credentials for user" } });
            return;
          }

          if (!existing.passwordHash && body.password) {
            await updateUserPassword(fastify.db, existing.id, body.password);
          }
          if (!existing.keyfilePath && body.keyfileToken) {
            await updateUserKeyfile(fastify.db, existing.id, body.keyfileToken);
          }

          const sessionRow = await dbCreateSession(fastify.db, existing.id);
          reply.send({
            token: sessionRow.token,
            user: { id: existing.id, username: existing.username },
          });
          loginAttempts.delete(attemptKey);
          await recordAuditEvent(fastify, {
            userId: existing.id,
            eventType: "auth:login",
            ipAddress: request.ip,
            metadata: {
              username: existing.username,
              method: body.password ? "password" : "keyfile",
            },
          });
          return;
        }

        if (!body.password && !body.keyfileToken) {
          recordFailure(attemptKey);
          reply.code(400).send({
            error: { code: "bad_request", message: "Provide a password or keyfileToken" },
          });
          return;
        }

        const userRow = await createUser(fastify.db, body.username, body.password);
        if (body.keyfileToken) {
          await updateUserKeyfile(fastify.db, userRow.id, body.keyfileToken);
        }

        const sessionRow = await dbCreateSession(fastify.db, userRow.id);
        reply.send({
          token: sessionRow.token,
          user: { id: userRow.id, username: userRow.username },
        });
        loginAttempts.delete(attemptKey);
        await recordAuditEvent(fastify, {
          userId: userRow.id,
          eventType: "auth:register",
          ipAddress: request.ip,
          metadata: {
            username: userRow.username,
          },
        });
        return;
      } catch (err) {
        fastify.log.error({ err }, "Failed to login with database; falling back to memory store.");
      }
    }

    // Fall back to in-memory store if no database
    const users = (store as any).users as Map<
      string,
      { username: string; passwordHash: string; isAdmin: boolean }
    >;
    if (users) {
      const user = users.get(body.username);
      if (user && body.password) {
        const crypto = await import("node:crypto");
        const providedHash = crypto.createHash("sha256").update(body.password).digest("hex");
        if (user.passwordHash === providedHash) {
          const session = createSession(body.username);
          reply.code(200).send({ token: session.token });
          return;
        }
      }
    }
    // Fall back to old demo behavior
    const session = createSession(body.username);
    reply.send({
      token: session.token,
      user: { id: session.userId, username: session.username },
    });
    loginAttempts.delete(attemptKey);
    await recordAuditEvent(fastify, {
      userId: session.userId,
      eventType: "auth:login_memory",
      ipAddress: request.ip,
      metadata: {
        username: session.username,
      },
    });
  });

  fastify.get("/session", async (request, reply) => {
    const session = await requireSession(request, reply);
    if (!session) return;
    reply.send({
      token: session.token,
      user: { id: session.userId, username: session.username },
    });
  });

  fastify.post("/logout", async (request, reply) => {
    const session = await requireSession(request, reply);
    if (!session) return;

    if (fastify.jsonDb) {
      try {
        await jsonAuthRepo.deleteSession(fastify.jsonDb, session.token);
        reply.code(204).send();
      } catch (err) {
        fastify.log.error(
          { err },
          "Failed to delete session in JSON database; removing from memory."
        );
        store.sessions.delete(session.token);
        reply.code(204).send();
      }
    } else if (fastify.db) {
      try {
        await dbDeleteSession(fastify.db, session.token);
        reply.code(204).send();
      } catch (err) {
        fastify.log.error({ err }, "Failed to delete session in database; removing from memory.");
        store.sessions.delete(session.token);
        reply.code(204).send();
      }
    } else {
      store.sessions.delete(session.token);
      reply.code(204).send();
    }

    await recordAuditEvent(fastify, {
      userId: session.userId,
      eventType: "auth:logout",
      ipAddress: request.ip,
      metadata: {
        username: session.username,
      },
    });
  });
};

export const loginThrottleState = {
  attempts: loginAttempts,
  loginAttemptKey,
  recordFailure,
  isBlocked,
  maxFailures: LOGIN_MAX_FAILURES,
  windowMs: LOGIN_WINDOW_MS,
  blockMs: LOGIN_BLOCK_MS,
};
