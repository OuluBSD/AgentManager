import { randomUUID } from "node:crypto";
import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import * as pty from "node-pty";
import { resolveWorkspacePath } from "../utils/workspace";
import { processLogger } from "./processLogger";

type OutputChunk = {
  data: Buffer;
  timestamp: number;
  sequence: number;
};

type ManagedSession = {
  id: string;
  projectId?: string;
  cwd?: string;
  ptyProcess: pty.IPty;
  proc?: ChildProcessWithoutNullStreams; // For compatibility with processLogger
  cols: number;
  rows: number;
  createdAt: Date;
  hasWebSocketConnection: boolean;
  outputBuffer: OutputChunk[];
  outputSequence: number;
  exitCode: number | null;
  exitSignal: NodeJS.Signals | null;
};

const sessions = new Map<string, ManagedSession>();
const MAX_BUFFER_SIZE = 1000; // Keep last 1000 chunks

async function resolveWorkingDirectory(
  projectId?: string,
  cwd?: string,
  workspaceRoot?: string | null
) {
  if (!projectId) {
    return path.resolve(cwd ?? process.cwd());
  }

  const safe = await resolveWorkspacePath(projectId, cwd ?? ".", workspaceRoot);
  if (!safe) return null;

  try {
    await fs.mkdir(safe.absolutePath, { recursive: true });
  } catch {
    return null;
  }

  return safe.absolutePath;
}

export async function createTerminalSession(
  projectId?: string,
  cwd?: string,
  workspaceRoot?: string | null
) {
  const workingDir = await resolveWorkingDirectory(projectId, cwd, workspaceRoot);
  if (!workingDir) return null;

  // Resolve shell path robustly: prefer $SHELL, otherwise try common locations
  const shellCandidates = [
    process.env.SHELL,
    "/bin/bash",
    "/usr/bin/bash",
    "/usr/local/bin/bash",
    "/usr/bin/env bash",
    "bash",
  ].filter(Boolean) as string[];

  let shell = shellCandidates[0]!;
  for (const candidate of shellCandidates) {
    try {
      await fs.access(candidate.split(" ")[0]); // check executable part
      shell = candidate;
      break;
    } catch {
      // continue
    }
  }

  // Spawn PTY for proper terminal support
  const shellArgs = shell.includes(" ") ? shell.split(" ").slice(1) : [];
  const shellCmd = shell.includes(" ") ? shell.split(" ")[0] : shell;

  console.log(
    `\x1b[36m[Terminal]\x1b[0m About to spawn PTY: cmd="${shellCmd}", args=${JSON.stringify(shellArgs)}, cwd="${workingDir}"`
  );

  const ptyProcess = pty.spawn(shellCmd, shellArgs, {
    name: "xterm-256color",
    cols: 80,
    rows: 24,
    cwd: workingDir,
    env: process.env as Record<string, string>,
  });

  const sessionId = randomUUID();

  // Log shell startup for debugging
  console.log(
    `\x1b[36m[Terminal]\x1b[0m Starting session \x1b[33m${sessionId.substring(0, 8)}\x1b[0m with shell: ${shell} in ${workingDir}`
  );

  const session: ManagedSession = {
    id: sessionId,
    projectId,
    cwd: workingDir,
    ptyProcess,
    cols: 80,
    rows: 24,
    createdAt: new Date(),
    hasWebSocketConnection: false,
    outputBuffer: [],
    outputSequence: 0,
    exitCode: null,
    exitSignal: null,
  };

  console.log(
    `\x1b[36m[Terminal]\x1b[0m PTY spawned successfully for session \x1b[33m${sessionId.substring(0, 8)}\x1b[0m PID: \x1b[35m${ptyProcess.pid}\x1b[0m`
  );

  // Send an initial newline to trigger the prompt
  setTimeout(() => {
    console.log(
      `\x1b[36m[Terminal]\x1b[0m Sending initial newline to session \x1b[33m${sessionId.substring(0, 8)}\x1b[0m`
    );
    ptyProcess.write("\r");
  }, 100);

  // Capture PTY output for polling fallback
  ptyProcess.onData((data) => {
    session.outputSequence++;
    const buffer = Buffer.from(data, "utf-8");
    session.outputBuffer.push({
      data: buffer,
      timestamp: Date.now(),
      sequence: session.outputSequence,
    });
    console.log(
      `\x1b[36m[Terminal]\x1b[0m Captured output for session \x1b[33m${sessionId.substring(0, 8)}\x1b[0m: \x1b[32m${buffer.length} bytes\x1b[0m, seq ${session.outputSequence}`
    );
    // Keep buffer size manageable
    if (session.outputBuffer.length > MAX_BUFFER_SIZE) {
      session.outputBuffer.shift();
    }
  });

  // Handle PTY exit
  ptyProcess.onExit(({ exitCode, signal }) => {
    // Store exit information
    session.exitCode = exitCode;
    session.exitSignal = signal ? (signal as NodeJS.Signals) : null;

    const exitInfo = signal ? `signal ${signal}` : `code ${exitCode ?? "unknown"}`;
    const timeSinceStart = Date.now() - session.createdAt.getTime();

    if (timeSinceStart < 1000) {
      console.error(
        `\x1b[36m[Terminal]\x1b[0m \x1b[31mSession ${session.id.substring(0, 8)} exited immediately\x1b[0m after ${timeSinceStart}ms (${exitInfo}). Shell: ${shell}, CWD: ${workingDir}`
      );
    } else {
      console.log(
        `\x1b[36m[Terminal]\x1b[0m Session \x1b[33m${session.id.substring(0, 8)}\x1b[0m exited after ${Math.round(timeSinceStart / 1000)}s (${exitInfo})`
      );
    }

    // Keep session data for polling clients, but schedule cleanup
    setTimeout(() => {
      const current = sessions.get(session.id);
      if (current) {
        console.log(
          `\x1b[36m[Terminal]\x1b[0m Cleaning up session \x1b[33m${session.id.substring(0, 8)}\x1b[0m after grace period`
        );
        sessions.delete(session.id);
      }
    }, 30000); // 30 second grace period for polling clients to get final output
  });
  sessions.set(session.id, session);
  return session;
}

export function getTerminalSession(sessionId: string) {
  return sessions.get(sessionId);
}

export function markSessionConnected(sessionId: string) {
  const session = sessions.get(sessionId);
  if (session) {
    session.hasWebSocketConnection = true;
  }
}

export function sendInput(sessionId: string, data: string) {
  const session = sessions.get(sessionId);
  if (!session) return false;

  console.log(
    `\x1b[36m[Terminal]\x1b[0m Sending input to session \x1b[33m${sessionId.substring(0, 8)}\x1b[0m: \x1b[32m${data.length} bytes\x1b[0m`
  );
  session.ptyProcess.write(data);
  return true;
}

export function closeTerminalSession(sessionId: string) {
  const session = sessions.get(sessionId);
  if (!session) {
    console.warn(
      `\x1b[36m[Terminal]\x1b[0m \x1b[33mcloseTerminalSession called for non-existent session ${sessionId.substring(0, 8)}\x1b[0m`
    );
    return;
  }

  const stack = new Error().stack;
  console.log(
    `\x1b[36m[Terminal]\x1b[0m closeTerminalSession called for \x1b[33m${sessionId.substring(0, 8)}\x1b[0m. Process still running: ${session.exitCode === null}`,
    { stack }
  );

  session.ptyProcess.kill();
  sessions.delete(sessionId);
}

export function getOutputSince(sessionId: string, sinceSequence: number) {
  const session = sessions.get(sessionId);
  if (!session) return null;

  const chunks = session.outputBuffer.filter((chunk) => chunk.sequence > sinceSequence);

  return {
    chunks: chunks.map((c) => ({
      data: c.data.toString("base64"),
      sequence: c.sequence,
      timestamp: c.timestamp,
    })),
    currentSequence: session.outputSequence,
    exited: session.exitCode !== null || session.exitSignal !== null,
    exitCode: session.exitCode,
    exitSignal: session.exitSignal,
  };
}

export function resizeTerminalSession(sessionId: string, cols: number, rows: number) {
  const session = sessions.get(sessionId);
  if (!session) return false;

  const safeCols = Math.max(10, Math.min(cols, 400));
  const safeRows = Math.max(5, Math.min(rows, 200));

  try {
    session.ptyProcess.resize(safeCols, safeRows);
    session.cols = safeCols;
    session.rows = safeRows;
    console.log(
      `\x1b[36m[Terminal]\x1b[0m Resized session \x1b[33m${sessionId.substring(0, 8)}\x1b[0m to ${safeCols}x${safeRows}`
    );
    return true;
  } catch (err) {
    console.error(
      `\x1b[36m[Terminal]\x1b[0m Failed to resize session ${sessionId.substring(0, 8)} to ${safeCols}x${safeRows}`,
      err
    );
    return false;
  }
}
