import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import path from "node:path";
import { tmpdir } from "node:os";
import Fastify, { type FastifyInstance } from "fastify";
import websocket from "@fastify/websocket";
import * as schema from "@nexus/shared/db/schema";
import { test } from "node:test";
import { terminalRoutes } from "../routes/terminal";
import { createSession, store } from "../services/mockStore";
import { closeTerminalSession, getTerminalSession } from "../services/terminalManager";

function withTempProjectsRoot() {
  const original = process.env.PROJECTS_ROOT;
  const root = mkdtempSync(path.join(tmpdir(), "nexus-term-life-"));
  process.env.PROJECTS_ROOT = root;
  return {
    root,
    restoreEnv: () => {
      process.env.PROJECTS_ROOT = original;
    },
  };
}

function getPort(app: FastifyInstance) {
  const addr = app.server.address();
  if (addr && typeof addr === "object") {
    return addr.port;
  }
  throw new Error("Failed to resolve listening port");
}

class FakeDb {
  public auditInserts: Array<typeof schema.auditEvents.$inferInsert> = [];

  insert(table: unknown) {
    return {
      values: async (payload: typeof schema.auditEvents.$inferInsert) => {
        if (table === schema.auditEvents) {
          this.auditInserts.push(payload);
        }
        return [payload];
      },
    };
  }
}

const WebSocketImpl = (globalThis as any).WebSocket as any;

test("terminal session is terminated when websocket closes", async () => {
  const { root, restoreEnv } = withTempProjectsRoot();
  const app = Fastify({ logger: false });
  await app.register(websocket);
  await app.register(terminalRoutes);
  await app.listen({ port: 0, host: "127.0.0.1" });

  const session = createSession("kill-user");
  let terminalSessionId: string | undefined;

  try {
    const start = await app.inject({
      method: "POST",
      url: "/terminal/sessions",
      headers: { "x-session-token": session.token },
      payload: { cwd: root },
    });
    assert.equal(start.statusCode, 201);
    terminalSessionId = (start.json() as any).sessionId;

    const url = `ws://127.0.0.1:${getPort(app)}/terminal/sessions/${terminalSessionId}/stream?token=${session.token}`;
    const socket = new WebSocketImpl(url);
    await new Promise<void>((resolve, reject) => {
      socket.onmessage = () => socket.close();
      socket.onclose = () => resolve();
      socket.onerror = (err: unknown) => reject(err);
    });

    await new Promise((resolve) => setTimeout(resolve, 25));
    assert.equal(getTerminalSession(terminalSessionId!), undefined);
  } finally {
    if (terminalSessionId) closeTerminalSession(terminalSessionId);
    await app.close();
    rmSync(root, { recursive: true, force: true });
    restoreEnv();
    store.sessions.delete(session.token);
  }
});

test("terminal exit is audited when process ends", async () => {
  const { root, restoreEnv } = withTempProjectsRoot();
  const app = Fastify({ logger: false }) as FastifyInstance & { db: FakeDb };
  app.db = new FakeDb();
  await app.register(websocket);
  await app.register(terminalRoutes);
  await app.listen({ port: 0, host: "127.0.0.1" });

  const session = createSession("audit-exit");
  let terminalSessionId: string | undefined;

  try {
    const start = await app.inject({
      method: "POST",
      url: "/terminal/sessions",
      headers: { "x-session-token": session.token },
    });
    assert.equal(start.statusCode, 201);
    terminalSessionId = (start.json() as any).sessionId;

    const url = `ws://127.0.0.1:${getPort(app)}/terminal/sessions/${terminalSessionId}/stream?token=${session.token}`;
    const socket = new WebSocketImpl(url);
    await new Promise<void>((resolve, reject) => {
      socket.onmessage = () => socket.close();
      socket.onclose = () => resolve();
      socket.onerror = (err: unknown) => reject(err);
    });

    await new Promise((resolve) => setTimeout(resolve, 50));
    const exitEvent = app.db.auditInserts.find((row) => row.eventType === "terminal:exit");
    assert.ok(exitEvent, "exit audit recorded");
    assert.equal(exitEvent!.sessionId, terminalSessionId);
  } finally {
    if (terminalSessionId) closeTerminalSession(terminalSessionId);
    await app.close();
    rmSync(root, { recursive: true, force: true });
    restoreEnv();
    store.sessions.delete(session.token);
  }
});
