import { randomUUID } from "node:crypto";
import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import { resolveWorkspacePath } from "../utils/workspace";
import { processLogger } from "./processLogger";

type ManagedSession = {
  id: string;
  projectId?: string;
  cwd?: string;
  proc: ChildProcessWithoutNullStreams;
  createdAt: Date;
};

const sessions = new Map<string, ManagedSession>();

async function resolveWorkingDirectory(projectId?: string, cwd?: string) {
  if (!projectId) {
    return path.resolve(cwd ?? process.cwd());
  }

  const safe = await resolveWorkspacePath(projectId, cwd ?? ".");
  if (!safe) return null;

  try {
    await fs.mkdir(safe.absolutePath, { recursive: true });
  } catch {
    return null;
  }

  return safe.absolutePath;
}

export async function createTerminalSession(projectId?: string, cwd?: string) {
  const workingDir = await resolveWorkingDirectory(projectId, cwd);
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

  const proc =
    shell.includes(" ")
      ? spawn(shell.split(" ")[0], shell.split(" ").slice(1), { cwd: workingDir, stdio: "pipe" })
      : spawn(shell, { cwd: workingDir, stdio: "pipe" });
  const sessionId = randomUUID();
  const session: ManagedSession = {
    id: sessionId,
    projectId,
    cwd: workingDir,
    proc,
    createdAt: new Date(),
  };

  // Track process for debugging
  const processId = `terminal-${sessionId}`;
  const hostProgramName =
    process.title && process.title !== "node" ? process.title : process.argv[1] || "node";
  processLogger.trackChildProcess(
    processId,
    "terminal",
    `Terminal Session ${sessionId.substring(0, 8)}`,
    shell,
    [],
    workingDir,
    proc,
    {
      projectId,
      sessionId,
      attachments: {
        transport: "stdio",
        host: {
          pid: process.pid,
          name: hostProgramName,
          processId,
        },
      },
    }
  );

  proc.on("exit", () => {
    sessions.delete(session.id);
  });
  sessions.set(session.id, session);
  return session;
}

export function getTerminalSession(sessionId: string) {
  return sessions.get(sessionId);
}

export function sendInput(sessionId: string, data: string) {
  const session = sessions.get(sessionId);
  if (!session) return false;

  // Log stdin for debugging
  const processId = `terminal-${sessionId}`;
  processLogger.logStdin(processId, data);

  session.proc.stdin.write(data);
  return true;
}

export function closeTerminalSession(sessionId: string) {
  const session = sessions.get(sessionId);
  if (!session) return;
  session.proc.kill();
  sessions.delete(sessionId);
}
