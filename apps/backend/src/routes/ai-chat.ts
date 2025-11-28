import type { FastifyPluginAsync } from "fastify";
import { validateToken } from "../utils/auth.js";
import { AIBackendType } from "@nexus/shared/chat/AIBackend";
import { QwenCommand, QwenServerMessage } from "../services/qwenClient.js";

// Track approved tool groups to prevent duplicate approvals from multiple clients
const approvedToolGroups = new Set<number>();

// Track active handlers per session to prevent duplicates
const activeHandlers = new Map<string, (msg: any) => void>();

export const aiChatRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get("/ai-chat/:sessionId", { websocket: true }, async (connection, request) => {
    const { sessionId } = request.params as { sessionId: string };
    const { backend, token } = request.query as {
      backend: AIBackendType;
      token: string;
    };

    const session = await validateToken(request.server, token);
    if (!session) {
      connection.socket.close(1008, "unauthorized");
      return;
    }

    fastify.log.info(
      `[AIChat] WebSocket connection for session ${sessionId} with backend ${backend}`
    );

    if (backend === "qwen") {
      if (!fastify.qwenClient || !fastify.qwenClient.isConnected()) {
        connection.socket.send(
          JSON.stringify({
            type: "error",
            message: "Qwen AI backend not connected",
          })
        );
        connection.socket.close(1011, "Qwen AI backend not connected");
        return;
      }

      const qwenClient = fastify.qwenClient;

      // Track which session is currently "active" (last to send a message)
      let isActiveSession = false;

      const messageHandler = (msg: QwenServerMessage) => {
        // Only send messages to the session that initiated the current conversation
        if (!isActiveSession) {
          return;
        }

        if (connection.socket.readyState === connection.socket.OPEN) {
          if (msg.type === "conversation" && msg.role === "assistant") {
            // Just forward all conversation messages as-is to frontend
            // Frontend handles accumulation and finalization
            connection.socket.send(JSON.stringify(msg));

            // Clear active flag when response completes
            if (msg.isStreaming === false) {
              isActiveSession = false;
              fastify.log.info(
                `[AIChat] Session ${sessionId} response complete, clearing active flag`
              );
            }
          } else if (msg.type === "tool_group") {
            // Auto-approve tool execution (only once per tool group)
            if (!approvedToolGroups.has(msg.id)) {
              approvedToolGroups.add(msg.id);
              fastify.log.info(
                `[AIChat] Auto-approving tool group ${msg.id} with ${msg.tools.length} tools`
              );
              fastify.log.info(`[AIChat] Tool group message:`, JSON.stringify(msg, null, 2));
              // Send approval for each individual tool
              for (const tool of msg.tools) {
                fastify.log.info(
                  `[AIChat] Sending approval for tool:`,
                  JSON.stringify(tool, null, 2)
                );
                qwenClient.send({
                  type: "tool_approval",
                  approved: true,
                  tool_id: tool.tool_id,
                });
              }
            }
            // Forward tool group message to client
            connection.socket.send(JSON.stringify(msg));
          } else {
            connection.socket.send(JSON.stringify(msg));
          }
        }
      };

      // Remove any existing handler for this session
      const existingHandler = activeHandlers.get(sessionId);
      if (existingHandler) {
        fastify.log.info(`[AIChat] Removing existing handler for session ${sessionId}`);
        qwenClient.removeMessageHandler(existingHandler);
      }

      // Register the new handler
      fastify.log.info(`[AIChat] Adding message handler for session ${sessionId}`);
      activeHandlers.set(sessionId, messageHandler);
      qwenClient.addMessageHandler(messageHandler);

      connection.socket.on("message", (data: Buffer) => {
        try {
          const message = JSON.parse(data.toString()) as QwenCommand;

          // Mark this session as active when sending user input
          if (message.type === "user_input") {
            isActiveSession = true;
            fastify.log.info(`[AIChat] Session ${sessionId} is now active`);
          }

          qwenClient.send(message);
        } catch (err) {
          fastify.log.error(err, "Failed to handle message");
        }
      });

      connection.socket.on("close", () => {
        fastify.log.info(`[AIChat] WebSocket for session ${sessionId} closed, removing handler`);
        qwenClient.removeMessageHandler(messageHandler);
        activeHandlers.delete(sessionId);
      });
    } else {
      connection.socket.send(
        JSON.stringify({
          type: "error",
          message: `Backend '${backend}' not implemented`,
        })
      );
      connection.socket.close(1011, `Backend '${backend}' not implemented`);
    }
  });
};
