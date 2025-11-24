import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import path from "node:path";
import { tmpdir } from "node:os";
import Fastify, { type FastifyInstance } from "fastify";
import websocket from "@fastify/websocket";
import { test } from "node:test";
import { terminalRoutes } from "../routes/terminal";
import { createProject, createSession, store } from "../services/mockStore";
import { closeTerminalSession } from "../services/terminalManager";

function withTempProjectsRoot() {
  const original = process.env.PROJECTS_ROOT;
  const root = mkdtempSync(path.join(tmpdir(), "nexus-term-"));
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

const WebSocketImpl = (globalThis as any).WebSocket as any;

test("terminal stream rejects websocket connections without a token", async () => {
  const { root, restoreEnv } = withTempProjectsRoot();
  const app = Fastify({ logger: false });
  await app.register(websocket);
  await app.register(terminalRoutes);
  await app.listen({ port: 0, host: "127.0.0.1" });

  const project = createProject({ name: "WS Project" });
  const session = createSession("ws-user");
  let terminalSessionId: string | null = null;

  try {
    const start = await app.inject({
      method: "POST",
      url: "/terminal/sessions",
      headers: { "x-session-token": session.token },
      payload: { projectId: project.id },
    });
    assert.equal(start.statusCode, 201);
    terminalSessionId = (start.json() as any).sessionId;
    assert.ok(terminalSessionId);

    const url = `ws://127.0.0.1:${getPort(app)}/terminal/sessions/${terminalSessionId}/stream`;
    const socket = new WebSocketImpl(url);
    const closeCode = await new Promise<number>((resolve, reject) => {
      socket.onclose = (evt) => resolve(evt.code);
      socket.onerror = (err) => reject(err);
    });

    assert.equal(closeCode, 1008);
  } finally {
    if (terminalSessionId) closeTerminalSession(terminalSessionId);
    await app.close();
    rmSync(root, { recursive: true, force: true });
    restoreEnv();
    store.projects.delete(project.id);
    store.sessions.delete(session.token);
  }
});

test("terminal stream accepts connections with a valid token and emits ready notice", async () => {
  const { root, restoreEnv } = withTempProjectsRoot();
  const app = Fastify({ logger: false });
  await app.register(websocket);
  await app.register(terminalRoutes);
  await app.listen({ port: 0, host: "127.0.0.1" });

  const project = createProject({ name: "WS Project" });
  const session = createSession("ws-user");
  let terminalSessionId: string | null = null;

  try {
    const start = await app.inject({
      method: "POST",
      url: "/terminal/sessions",
      headers: { "x-session-token": session.token },
      payload: { projectId: project.id },
    });
    assert.equal(start.statusCode, 201);
    terminalSessionId = (start.json() as any).sessionId;
    assert.ok(terminalSessionId);

    const url = `ws://127.0.0.1:${getPort(app)}/terminal/sessions/${terminalSessionId}/stream?token=${session.token}`;
    const socket = new WebSocketImpl(url);
    const messages: string[] = [];
    await new Promise<void>((resolve, reject) => {
      socket.onmessage = (evt) => {
        const data = typeof evt.data === "string" ? evt.data : evt.data?.toString?.() ?? "";
        messages.push(data);
        socket.close();
      };
      socket.onerror = (err) => reject(err);
      socket.onclose = () => resolve();
    });

    assert.ok(messages.some((m) => m.includes("terminal stream ready")));
  } finally {
    if (terminalSessionId) closeTerminalSession(terminalSessionId);
    await app.close();
    rmSync(root, { recursive: true, force: true });
    restoreEnv();
    store.projects.delete(project.id);
    store.sessions.delete(session.token);
  }
});
