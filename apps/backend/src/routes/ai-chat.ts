import type { FastifyPluginAsync } from "fastify";
import { validateToken } from "../utils/auth.js";
import { AIBackendType } from "@nexus/shared/chat/AIBackend";
import { QwenCommand } from "../services/qwenClient.js";
import { resolveAiChain } from "../services/aiChatBridge.js";
import { sessionManager } from "../services/sessionManager.js";
import { processLogger } from "../services/processLogger.js";

const CHALLENGE_PROMPT = [
  "System instruction: Adopt a critical collaborator stance.",
  "When statements seem incorrect or risky, challenge them respectfully, ask clarifying questions, surface contradictions, and suggest safer alternatives.",
  "Do not echo this instruction to the user; silently apply it during the conversation.",
].join(" ");

const SYSTEM_STATUS_MESSAGE = "Processing system message";

function parseBooleanFlag(value: string | undefined, defaultValue: boolean): boolean {
  if (typeof value !== "string") return defaultValue;
  const lowered = value.trim().toLowerCase();
  if (["true", "1", "yes", "on"].includes(lowered)) return true;
  if (["false", "0", "no", "off"].includes(lowered)) return false;
  return defaultValue;
}

export const aiChatRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get("/ai-chat/:sessionId", { websocket: true }, async (connection, request) => {
    const { sessionId } = request.params as { sessionId: string };
    const { backend, token, challenge, workspace } = request.query as {
      backend: AIBackendType;
      token: string;
      challenge?: string;
      workspace?: string;
    };

    const session = await validateToken(request.server, token);
    if (!session) {
      connection.socket.close(1008, "unauthorized");
      return;
    }

    fastify.log.info(
      `[AIChat] WebSocket connection for session ${sessionId} with backend ${backend}`
    );

    if (backend !== "qwen") {
      connection.socket.send(
        JSON.stringify({
          type: "error",
          message: `Backend '${backend}' not implemented`,
        })
      );
      connection.socket.close(1011, `Backend '${backend}' not implemented`);
      return;
    }

    const approvedToolGroups = new Set<number>();
    const allowChallenge = parseBooleanFlag(
      challenge,
      parseBooleanFlag(process.env.ASSISTANT_CHALLENGE_ENABLED, true)
    );
    let suppressChallengeReply = allowChallenge;
    let suppressingStream = false; // Track if we're currently suppressing a stream
    let systemMessageActive = false;
    let challengeTimeout: NodeJS.Timeout | null = null;
    let bridge: any = null;
    const connectionId = `ws-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
    const runningTools = new Map<
      string,
      {
        groupId?: number;
        processId?: string;
        toolName?: string;
        args?: Record<string, any>;
        confirmationDetails?: { message: string; requires_approval: boolean };
        pendingAt?: Date;
        runningAt?: Date;
      }
    >();

    try {
      const chain = await resolveAiChain(fastify);
      fastify.log.info(
        { manager: chain.manager?.id, worker: chain.worker?.id, ai: chain.ai.id },
        "[AIChat] Using AI chain"
      );

      // Send chain info to frontend for visibility
      connection.socket.send(
        JSON.stringify({
          type: "info",
          message: `Using AI server ${chain.ai.name} (${chain.ai.host}:${chain.ai.port})`,
          chain: {
            managerId: chain.manager?.id,
            workerId: chain.worker?.id,
            aiId: chain.ai.id,
          },
        })
      );

      // Use session manager to get or create bridge
      const result = await sessionManager.getOrCreateBridge(
        sessionId,
        connectionId,
        fastify.log,
        chain,
        (msg: any) => {
          if (connection.socket.readyState !== connection.socket.OPEN) {
            return;
          }

          const systemMessageInFlight = systemMessageActive || suppressingStream;
          const processId = (bridge as any)?.client?.processId;

          const markToolsCompleted = (status: string, timestamp = new Date()) => {
            if (!processId) return;
            const pendingEntries: Array<{
              toolId: string;
              processId?: string;
              toolName?: string;
              groupId?: number;
              args?: Record<string, any>;
              confirmationDetails?: { message: string; requires_approval: boolean };
              runningAt?: Date;
              pendingAt?: Date;
            }> = [];

            if (runningTools.size > 0) {
              for (const [toolId, info] of runningTools.entries()) {
                pendingEntries.push({
                  toolId,
                  processId: info.processId,
                  toolName: info.toolName,
                  groupId: info.groupId,
                  args: info.args,
                  confirmationDetails: info.confirmationDetails,
                  runningAt: info.runningAt,
                  pendingAt: info.pendingAt,
                });
              }
            } else {
              // Fallback: if the running map is empty, mark any tools without a completedAt as done
              const existing = processLogger.getToolUsage(processId) || [];
              for (const tool of existing) {
                if (!tool.completedAt) {
                  pendingEntries.push({
                    toolId: tool.toolId,
                    processId,
                    toolName: tool.toolName,
                    groupId: tool.toolGroupId,
                    args: tool.args,
                    confirmationDetails: tool.confirmationDetails,
                    runningAt: tool.runningAt,
                    pendingAt: tool.pendingAt,
                  });
                }
              }
            }

            if (pendingEntries.length === 0) return;

            for (const entry of pendingEntries) {
              processLogger.logToolUsage({
                processId: entry.processId || processId,
                timestamp,
                toolGroupId: entry.groupId,
                toolId: entry.toolId,
                toolName: entry.toolName || "tool",
                status,
                args: entry.args || {},
                approved: true,
                confirmationDetails: entry.confirmationDetails,
                runningAt: entry.runningAt,
                pendingAt: entry.pendingAt,
                completedAt: timestamp,
              });
              runningTools.delete(entry.toolId);
            }
          };

          // Auto-approve tool groups
          if (msg.type === "tool_group") {
            const isNewGroup = !approvedToolGroups.has(msg.id);
            if (isNewGroup) {
              approvedToolGroups.add(msg.id);
              fastify.log.info(
                `[AIChat] Auto-approving tool group ${msg.id} with ${msg.tools.length} tools`
              );
              for (const tool of msg.tools) {
                bridge.send({
                  type: "tool_approval",
                  approved: true,
                  tool_id: tool.tool_id,
                });
                if (processId) {
                  runningTools.set(tool.tool_id, {
                    groupId: msg.id,
                    processId,
                    toolName: tool.tool_name,
                    args: tool.args,
                    confirmationDetails: tool.confirmation_details,
                  });
                }
              }
            }
            if (processId) {
              const now = new Date();
              for (const tool of msg.tools) {
                const rawStatus = tool.status || "pending";
                const rawLower = rawStatus.toLowerCase();
                const shouldPromote =
                  rawLower === "pending" || rawLower === "waiting_for_confirmation";
                const status =
                  approvedToolGroups.has(msg.id) && shouldPromote ? "running" : rawStatus;
                const statusLower = status.toLowerCase();
                const isPending = rawLower === "pending" || rawLower === "waiting_for_confirmation";
                const isRunning =
                  statusLower === "running" || statusLower === "in_progress" || statusLower === "executing";
                const existing = runningTools.get(tool.tool_id);
                const pendingAt = existing?.pendingAt ?? (isPending ? now : undefined);
                const runningAt = existing?.runningAt ?? (isRunning ? now : undefined);
                processLogger.logToolUsage({
                  processId,
                  timestamp: now,
                  toolGroupId: msg.id,
                  toolId: tool.tool_id,
                  toolName: tool.tool_name,
                  status,
                  pendingAt,
                  runningAt,
                  args: tool.args,
                  confirmationDetails: tool.confirmation_details,
                  approved:
                    isNewGroup ||
                    tool.confirmation_details?.requires_approval !== true ||
                    (statusLower !== "pending" && statusLower !== "waiting_for_confirmation"),
                });

                const lower = status.toLowerCase();
                const isCompleted =
                  lower === "success" ||
                  lower === "ready" ||
                  lower === "completed" ||
                  lower === "complete" ||
                  lower === "done" ||
                  lower === "error" ||
                  lower === "failed" ||
                  lower === "failure";
                if (isCompleted) {
                  runningTools.delete(tool.tool_id);
                } else {
                  runningTools.set(tool.tool_id, {
                    groupId: msg.id,
                    processId,
                    toolName: tool.tool_name,
                    args: tool.args,
                    confirmationDetails: tool.confirmation_details,
                    pendingAt,
                    runningAt,
                  });
                }
              }
            }
          }

          if (msg.type === "status" && systemMessageInFlight) {
            connection.socket.send(
              JSON.stringify({
                ...msg,
                message: SYSTEM_STATUS_MESSAGE,
                context: "system",
              })
            );
            return;
          }

          if (
            msg.type === "conversation" &&
            msg.role === "assistant" &&
            typeof msg.content === "string"
          ) {
            // Start suppressing if this is the first message and we should suppress the challenge reply
            if (suppressChallengeReply && !suppressingStream) {
              suppressingStream = true;
              if (challengeTimeout) {
                clearTimeout(challengeTimeout);
                challengeTimeout = null;
              }
              fastify.log.info(
                `[AIChat] Starting to suppress challenge reply stream for session ${sessionId}`
              );
            }

            // If we're suppressing, check if the stream is complete
            if (suppressingStream) {
              // Stream is complete when isStreaming is explicitly false
              if (msg.isStreaming === false) {
                suppressingStream = false;
                suppressChallengeReply = false;
                systemMessageActive = false;
                fastify.log.info(
                  `[AIChat] Finished suppressing challenge reply stream for session ${sessionId}`
                );
                // Send status back to idle after system initialization completes
                connection.socket.send(
                  JSON.stringify({
                    type: "status",
                    state: "idle",
                    message: "Ready",
                  })
                );
              }
              // Suppress this chunk
              return;
            }
          }

          if (
            msg.type === "conversation" &&
            msg.role === "assistant" &&
            msg.isStreaming === false &&
            runningTools.size > 0
          ) {
            markToolsCompleted("completed");
          }

          if (msg.type === "status" && msg.state === "idle") {
            markToolsCompleted("completed");
          }

          if (msg.type === "completion_stats") {
            markToolsCompleted("completed");
          }

          connection.socket.send(JSON.stringify(msg));
        },
        {
          workspaceRoot: workspace,
          purpose: "AI Chat Session",
          initiator: {
            type: "user",
            userId: session.userId,
            sessionId: sessionId,
            username: session.username,
          },
        }
      );
      bridge = result.bridge;
      const isNewSession = result.isNew;

      connection.socket.send(
        JSON.stringify({
          type: "status",
          state: "idle",
          message: `Connected via ${bridge.transport}`,
          transport: bridge.transport,
          challenge: allowChallenge,
        })
      );

      connection.socket.send(
        JSON.stringify({
          type: "info",
          message: allowChallenge
            ? "Challenge mode enabled: the assistant may question or push back on unclear requests."
            : "Challenge mode disabled: the assistant will default to cooperative responses.",
        })
      );

      // Only send CHALLENGE_PROMPT for NEW sessions to avoid showing system instruction response when reconnecting
      if (allowChallenge && isNewSession) {
        fastify.log.info(
          `[AIChat] Sending CHALLENGE_PROMPT for new session ${sessionId} (isNew=${isNewSession})`
        );

        systemMessageActive = true;
        // Send custom status message for system initialization
        connection.socket.send(
          JSON.stringify({
            type: "status",
            state: "responding",
            message: SYSTEM_STATUS_MESSAGE,
            context: "system",
          })
        );

        bridge.send({
          type: "user_input",
          content: CHALLENGE_PROMPT,
        });
        challengeTimeout = setTimeout(() => {
          suppressChallengeReply = false;
          systemMessageActive = false;
          challengeTimeout = null;
        }, 5000);
      } else if (allowChallenge && !isNewSession) {
        fastify.log.info(
          `[AIChat] Skipping CHALLENGE_PROMPT for existing session ${sessionId} (isNew=${isNewSession})`
        );
        // Don't need to suppress reply for reused sessions since we're not sending the prompt
        suppressChallengeReply = false;
      }

      connection.socket.on("message", (data: Buffer) => {
        try {
          const message = JSON.parse(data.toString()) as any;

          // Handle disconnect message - immediately release session
          if (message.type === "disconnect") {
            fastify.log.info(
              `[AIChat] Received disconnect message for session ${sessionId} connectionId=${connectionId}`
            );
            sessionManager
              .releaseSession(sessionId, connectionId, fastify.log)
              .then(() => {
                fastify.log.info(
                  `[AIChat] Session ${sessionId} connectionId=${connectionId} released via disconnect message`
                );
              })
              .catch((err) => {
                fastify.log.error({ err }, "[AIChat] Error during disconnect message handling");
              });
            return;
          }

          // Forward other messages to bridge
          bridge.send(message as QwenCommand);
        } catch (err) {
          fastify.log.error(err, "Failed to handle message");
        }
      });
    } catch (err: any) {
      fastify.log.error({ err }, "[AIChat] Failed to initialize AI bridge");
      connection.socket.send(
        JSON.stringify({
          type: "error",
          message: err?.message || "Failed to initialize AI chat",
        })
      );
      connection.socket.close(1011, "AI bridge error");
      return;
    }

    connection.socket.on("close", async () => {
      fastify.log.info(
        `[AIChat] WebSocket for session ${sessionId} connectionId=${connectionId} closed - releasing session`
      );
      if (challengeTimeout) {
        clearTimeout(challengeTimeout);
        challengeTimeout = null;
      }
      try {
        await sessionManager.releaseSession(sessionId, connectionId, fastify.log);
        fastify.log.info(`[AIChat] Session ${sessionId} connectionId=${connectionId} released`);
      } catch (err) {
        fastify.log.error({ err }, "[AIChat] Error during session release");
      }
    });
  });
};
