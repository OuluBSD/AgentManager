/**
 * Command execution routes - supports both WebSocket and polling transports
 *
 * Provides endpoints for executing commands in project directories with output streaming
 * via either WebSocket or HTTP polling depending on client capability.
 */

import type { FastifyPluginAsync } from "fastify";
import { spawn, type ChildProcess } from "node:child_process";
import path from "node:path";
import { requireSession, validateToken } from "../utils/auth";
import { findProject } from "../utils/projects";
import { processLogger } from "../services/processLogger";
import { recordAuditEvent } from "../services/auditLogger";
import { createServerRepository } from "../services/serverRepository";

// Store for active command processes
const commandProcesses = new Map<string, ChildProcess>();
const commandOutputs = new Map<string, Array<{ id: number; data: string; timestamp: number }>>();
const commandOutputIds = new Map<string, number>();

interface CommandMessage {
  id: number;
  timestamp: number;
  type: 'stdout' | 'stderr' | 'exit' | 'error';
  data: string;
  exitCode?: number;
}

// Store messages per session for polling
const sessionMessages = new Map<string, CommandMessage[]>();
const messageIdCounter = new Map<string, number>();

function getNextMessageId(sessionId: string): number {
  const current = messageIdCounter.get(sessionId) || 0;
  const next = current + 1;
  messageIdCounter.set(sessionId, next);
  return next;
}

function addCommandMessage(sessionId: string, message: Omit<CommandMessage, 'id'>): void {
  if (!sessionMessages.has(sessionId)) {
    sessionMessages.set(sessionId, []);
  }

  const messages = sessionMessages.get(sessionId)!;
  const fullMessage: CommandMessage = {
    ...message,
    id: getNextMessageId(sessionId),
    timestamp: Date.now()
  };

  messages.push(fullMessage);

  // Keep only last 1000 messages per session
  if (messages.length > 1000) {
    messages.shift();
  }
}

function getCommandMessages(sessionId: string, afterId: number): CommandMessage[] {
  const messages = sessionMessages.get(sessionId) || [];
  return messages.filter((msg) => msg.id > afterId);
}

function clearCommandMessages(sessionId: string): void {
  sessionMessages.delete(sessionId);
  messageIdCounter.delete(sessionId);
}

export const commandExecutionRoutes: FastifyPluginAsync = async (fastify) => {
  // WebSocket route for real-time command execution
  fastify.route({
    method: "POST",
    url: "/terminal/execute",
    handler: async (request, reply) => {
      const session = await requireSession(request, reply);
      if (!session) return;

      const { command, projectId, cwd } = request.body as { command: string; projectId?: string; cwd?: string };
      
      if (!command) {
        reply.code(400).send({ error: { code: "missing_command", message: "Command is required" } });
        return;
      }

      // Get project if projectId is specified
      let project = null;
      if (projectId) {
        project = await findProject(fastify, projectId);
        if (!project) {
          reply.code(404).send({ error: { code: "project_not_found", message: "Project not found" } });
          return;
        }
      }

      // Determine the working directory
      const workingDir = cwd || (project ? project.contentPath : undefined) || process.cwd();

      // Create a unique ID for this command execution
      const commandId = `cmd-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      const wsCandidates = [`ws://localhost:3000/api/terminal/execute/${commandId}/stream`]; // In real implementation, build proper URL

      // Execute the command and create a process object
      let childProcess: ChildProcess;
      try {
        childProcess = spawn(command, { 
          shell: true,
          cwd: workingDir,
          env: { ...process.env }
        });
      } catch (error) {
        reply.code(500).send({ error: { code: "spawn_error", message: `Failed to spawn command: ${(error as Error).message}` } });
        return;
      }

      // Store the process for potential WebSocket connection
      commandProcesses.set(commandId, childProcess);

      // Set up output buffering
      commandOutputs.set(commandId, []);
      commandOutputIds.set(commandId, 0);

      // Capture and buffer output
      const addToBuffer = (data: Buffer, streamType: 'stdout' | 'stderr') => {
        const outputStr = data.toString();
        const outputBuffer = commandOutputs.get(commandId) || [];
        const nextId = (commandOutputIds.get(commandId) || 0) + 1;
        commandOutputIds.set(commandId, nextId);
        
        outputBuffer.push({
          id: nextId,
          data: outputStr,
          timestamp: Date.now()
        });
        
        commandOutputs.set(commandId, outputBuffer);
      };

      // Handle stdout
      childProcess.stdout?.on('data', (data) => {
        addToBuffer(data, 'stdout');
        addCommandMessage(commandId, {
          type: 'stdout',
          data: data.toString(),
          timestamp: Date.now()
        });
      });

      // Handle stderr
      childProcess.stderr?.on('data', (data) => {
        addToBuffer(data, 'stderr');
        addCommandMessage(commandId, {
          type: 'stderr',
          data: data.toString(),
          timestamp: Date.now()
        });
      });

      // Handle process exit
      childProcess.on('close', (code) => {
        commandProcesses.delete(commandId);
        addCommandMessage(commandId, {
          type: 'exit',
          data: `Process exited with code ${code}`,
          timestamp: Date.now(),
          exitCode: code || 0
        });
        
        // Clean up output buffers after a delay
        setTimeout(() => {
          commandOutputs.delete(commandId);
          commandOutputIds.delete(commandId);
        }, 30000); // Keep output for 30 seconds for polling clients
      });

      // Handle process errors
      childProcess.on('error', (error) => {
        addCommandMessage(commandId, {
          type: 'error',
          data: error.message,
          timestamp: Date.now()
        });
      });

      // Record audit event
      await recordAuditEvent(fastify, {
        userId: session.userId,
        projectId: projectId || null,
        eventType: "command:execute",
        sessionId: commandId,
        ipAddress: request.ip,
        metadata: {
          command,
          cwd: workingDir,
          ip: request.ip
        },
      });

      reply.send({
        commandId,
        wsCandidates,
        message: `Command initiated with ID: ${commandId}`
      });
    }
  });

  // WebSocket endpoint for streaming command output
  fastify.get(
    "/terminal/execute/:commandId/stream",
    { websocket: true },
    async (connection, req) => {
      const params = req.params as { commandId: string };
      const commandId = params.commandId;

      const session = await validateToken(req.server, req.headers.authorization?.replace('Bearer ', ''));
      if (!session) {
        connection.socket.close(1008, "unauthorized");
        return;
      }

      const childProcess = commandProcesses.get(commandId);
      if (!childProcess) {
        connection.socket.close(1011, "command process not found");
        return;
      }

      // Send any buffered output that was captured before WebSocket connected
      const buffered = getCommandMessages(commandId, 0);
      if (buffered.length > 0) {
        for (const msg of buffered) {
          connection.socket.send(JSON.stringify(msg));
        }
      }

      // Set up event handlers for streaming
      const stdoutHandler = (data: Buffer) => {
        const msg = {
          id: msg.id,
          type: 'stdout' as const,
          data: data.toString(),
          timestamp: Date.now()
        };
        connection.socket.send(JSON.stringify(msg));
      };

      const stderrHandler = (data: Buffer) => {
        const msg = {
          id: msg.id,
          type: 'stderr' as const,
          data: data.toString(),
          timestamp: Date.now()
        };
        connection.socket.send(JSON.stringify(msg));
      };

      const exitHandler = (code: number | null) => {
        const msg = {
          id: getNextMessageId(commandId),
          type: 'exit' as const,
          data: `Process exited with code ${code}`,
          timestamp: Date.now(),
          exitCode: code || 0
        };
        connection.socket.send(JSON.stringify(msg));
        connection.socket.close(4001, "process exited");
      };

      // Attach to the process
      childProcess.stdout?.on('data', stdoutHandler);
      childProcess.stderr?.on('data', stderrHandler);
      childProcess.on('close', exitHandler);

      // Clean up handlers when WebSocket closes
      connection.socket.on('close', () => {
        childProcess.stdout?.off('data', stdoutHandler);
        childProcess.stderr?.off('data', stderrHandler);
        childProcess.off('close', exitHandler);
      });
    }
  );

  // Polling-based output endpoint (fallback when WebSocket fails)
  fastify.get("/terminal/execute/:commandId/poll", async (request, reply) => {
    const session = await requireSession(request, reply);
    if (!session) return;

    const params = request.params as { commandId: string };
    const query = request.query as { since?: string };
    const sinceId = Number(query.since || "0");

    const messages = getCommandMessages(params.commandId, sinceId);

    // Check if command process is still running
    const processExists = commandProcesses.has(params.commandId);

    reply.send({
      messages,
      commandRunning: processExists,
      lastId: Math.max(...messages.map(m => m.id), sinceId)
    });
  });

  // Endpoint to get project directories for command execution
  fastify.get("/terminal/execute/directories/:projectId", async (request, reply) => {
    const session = await requireSession(request, reply);
    if (!session) return;

    const params = request.params as { projectId: string };
    const project = await findProject(fastify, params.projectId);

    if (!project) {
      reply.code(404).send({ error: { code: "project_not_found", message: "Project not found" } });
      return;
    }

    // In a real implementation, we'd return a list of appropriate directories in the project
    // For now, we'll return the project's root directory
    reply.send({
      projectId: params.projectId,
      projectRoot: project.contentPath,
      availableDirectories: [project.contentPath]
    });
  });
};