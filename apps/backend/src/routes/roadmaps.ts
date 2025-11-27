import type { FastifyPluginAsync } from "fastify";
import {
  dbCreateRoadmap,
  dbGetMetaChat,
  dbListRoadmaps,
  dbUpdateRoadmap,
  dbGetMetaChatMessages,
  dbAddMetaChatMessage,
} from "../services/projectRepository";
import {
  createRoadmap,
  getMetaChat,
  listRoadmaps,
  updateRoadmap,
  getMetaChatMessages,
  addMetaChatMessage,
} from "../services/mockStore";
import { requireSession, validateToken } from "../utils/auth";
import { recordAuditEvent } from "../services/auditLogger";
import { eventBus } from "../services/eventBus";
import { requestClarification } from "../services/aiClarification";

export const roadmapRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get("/projects/:projectId/roadmaps", async (request, reply) => {
    if (!(await requireSession(request, reply))) return;
    const projectId = (request.params as { projectId: string }).projectId;
    if (fastify.db) {
      try {
        reply.send(await dbListRoadmaps(fastify.db, projectId));
        return;
      } catch (err) {
        fastify.log.error(
          { err },
          "Failed to list roadmaps from database; falling back to memory."
        );
      }
    }
    reply.send(listRoadmaps(projectId));
  });

  fastify.post("/projects/:projectId/roadmaps", async (request, reply) => {
    const session = await requireSession(request, reply);
    if (!session) return;

    const projectId = (request.params as { projectId: string }).projectId;
    const body = (request.body as Record<string, unknown>) ?? {};
    let roadmap, metaChatId;

    if (fastify.db) {
      try {
        const result = await dbCreateRoadmap(fastify.db, projectId, body);
        roadmap = result.roadmap;
        metaChatId = result.metaChat.id;
        reply.code(201).send({ id: roadmap.id, metaChatId });
      } catch (err) {
        fastify.log.error({ err }, "Failed to create roadmap in database; using in-memory store.");
        const result = createRoadmap(projectId, body);
        roadmap = result.roadmap;
        metaChatId = result.meta.id;
        reply.code(201).send({ id: roadmap.id, metaChatId });
      }
    } else {
      const result = createRoadmap(projectId, body);
      roadmap = result.roadmap;
      metaChatId = result.meta.id;
      reply.code(201).send({ id: roadmap.id, metaChatId });
    }

    await recordAuditEvent(fastify, {
      userId: session.userId,
      projectId,
      eventType: "roadmap:create",
      metadata: {
        roadmapId: roadmap.id,
        title: roadmap.title,
        tags: roadmap.tags,
      },
    });
  });

  fastify.patch("/roadmaps/:roadmapId", async (request, reply) => {
    const session = await requireSession(request, reply);
    if (!session) return;

    const roadmapId = (request.params as { roadmapId: string }).roadmapId;
    const body = (request.body as Record<string, unknown>) ?? {};
    let updated;

    if (fastify.db) {
      try {
        updated = await dbUpdateRoadmap(fastify.db, roadmapId, body);
        if (!updated) {
          reply.code(404).send({ error: { code: "not_found", message: "Roadmap not found" } });
          return;
        }
        reply.send(updated);
      } catch (err) {
        fastify.log.error({ err }, "Failed to update roadmap in database; falling back to memory.");
        updated = updateRoadmap(roadmapId, body);
        if (!updated) {
          reply.code(404).send({ error: { code: "not_found", message: "Roadmap not found" } });
          return;
        }
        reply.send(updated);
      }
    } else {
      updated = updateRoadmap(roadmapId, body);
      if (!updated) {
        reply.code(404).send({ error: { code: "not_found", message: "Roadmap not found" } });
        return;
      }
      reply.send(updated);
    }

    await recordAuditEvent(fastify, {
      userId: session.userId,
      projectId: updated.projectId,
      eventType: "roadmap:update",
      metadata: {
        roadmapId,
        changes: body,
      },
    });
  });

  fastify.get("/roadmaps/:roadmapId/meta-chat", async (request, reply) => {
    if (!(await requireSession(request, reply))) return;
    const roadmapId = (request.params as { roadmapId: string }).roadmapId;
    if (fastify.db) {
      try {
        const meta = await dbGetMetaChat(fastify.db, roadmapId);
        if (!meta) {
          reply.code(404).send({ error: { code: "not_found", message: "Meta-chat not found" } });
          return;
        }
        reply.send(meta);
        return;
      } catch (err) {
        fastify.log.error(
          { err },
          "Failed to fetch meta-chat from database; falling back to memory."
        );
      }
    }
    const meta = getMetaChat(roadmapId);
    if (!meta) {
      reply.code(404).send({ error: { code: "not_found", message: "Meta-chat not found" } });
      return;
    }
    reply.send(meta);
  });

  fastify.get("/roadmaps/:roadmapId/status", async (request, reply) => {
    if (!(await requireSession(request, reply))) return;
    const roadmapId = (request.params as { roadmapId: string }).roadmapId;
    if (fastify.db) {
      try {
        const meta = await dbGetMetaChat(fastify.db, roadmapId);
        if (!meta) {
          reply.code(404).send({ error: { code: "not_found", message: "Meta-chat not found" } });
          return;
        }
        reply.send({
          roadmapId,
          status: meta.status,
          progress: meta.progress,
          summary: meta.summary,
        });
        return;
      } catch (err) {
        fastify.log.error(
          { err },
          "Failed to fetch roadmap status from database; falling back to memory."
        );
      }
    }
    const meta = getMetaChat(roadmapId);
    if (!meta) {
      reply.code(404).send({ error: { code: "not_found", message: "Meta-chat not found" } });
      return;
    }
    reply.send({ roadmapId, status: meta.status, progress: meta.progress, summary: meta.summary });
  });

  fastify.get("/meta-chats/:metaChatId/messages", async (request, reply) => {
    if (!(await requireSession(request, reply))) return;
    const metaChatId = (request.params as { metaChatId: string }).metaChatId;
    if (fastify.db) {
      try {
        const messages = await dbGetMetaChatMessages(fastify.db, metaChatId);
        reply.send(messages);
        return;
      } catch (err) {
        fastify.log.error(
          { err },
          "Failed to fetch meta-chat messages from database; falling back to memory."
        );
      }
    }
    reply.send(getMetaChatMessages(metaChatId));
  });

  fastify.post("/meta-chats/:metaChatId/messages", async (request, reply) => {
    const session = await requireSession(request, reply);
    if (!session) return;

    const metaChatId = (request.params as { metaChatId: string }).metaChatId;
    const body = request.body as {
      role?: string;
      content?: string;
      metadata?: Record<string, unknown>;
    };

    if (!body.role || !body.content) {
      reply
        .code(400)
        .send({ error: { code: "invalid_request", message: "role and content are required" } });
      return;
    }

    let message;

    if (fastify.db) {
      try {
        message = await dbAddMetaChatMessage(fastify.db, metaChatId, {
          role: body.role as "user" | "assistant" | "system" | "status",
          content: body.content,
          metadata: body.metadata,
        });
        reply.code(201).send(message);
      } catch (err) {
        fastify.log.error(
          { err },
          "Failed to add meta-chat message to database; falling back to memory."
        );
        message = addMetaChatMessage(metaChatId, {
          metaChatId,
          role: body.role as "user" | "assistant" | "system" | "status",
          content: body.content,
          metadata: body.metadata,
        });
        reply.code(201).send(message);
      }
    } else {
      message = addMetaChatMessage(metaChatId, {
        metaChatId,
        role: body.role as "user" | "assistant" | "system" | "status",
        content: body.content,
        metadata: body.metadata,
      });
      reply.code(201).send(message);
    }

    // Emit event for real-time notifications
    eventBus.emitMetaChatMessage(metaChatId, {
      id: message.id,
      role: body.role,
      content: body.content,
    });

    await recordAuditEvent(fastify, {
      userId: session.userId,
      eventType: "meta-chat:message",
      metadata: {
        metaChatId,
        messageId: message.id,
        role: body.role,
        contentLength: body.content.length,
      },
    });
  });

  // WebSocket endpoint for real-time meta-chat updates
  fastify.get(
    "/roadmaps/:roadmapId/meta-chat/stream",
    { websocket: true },
    async (connection, request) => {
      // Authenticate WebSocket connection
      const header = request.headers["authorization"];
      const bearer =
        typeof header === "string" && header.startsWith("Bearer ") ? header.slice(7) : null;
      const query = request.query as { token?: string };
      const token =
        bearer ?? (request.headers["x-session-token"] as string | undefined) ?? query?.token;
      const session = await validateToken(request.server, token);
      if (!session) {
        connection.socket.close(1008, "unauthorized");
        return;
      }

      const params = request.params as { roadmapId: string };
      const roadmapId = params.roadmapId;

      // Send initial status
      if (fastify.db) {
        try {
          const meta = await dbGetMetaChat(fastify.db, roadmapId);
          if (meta) {
            connection.socket.send(
              JSON.stringify({
                type: "meta-chat:status",
                data: {
                  roadmapId,
                  status: meta.status,
                  progress: meta.progress,
                  summary: meta.summary,
                },
              })
            );
          }
        } catch (err) {
          fastify.log.error({ err }, "Failed to fetch initial meta-chat status");
        }
      } else {
        const meta = getMetaChat(roadmapId);
        if (meta) {
          connection.socket.send(
            JSON.stringify({
              type: "meta-chat:status",
              data: {
                roadmapId,
                status: meta.status,
                progress: meta.progress,
                summary: meta.summary,
              },
            })
          );
        }
      }

      // Listen for meta-chat updates
      const unsubscribeUpdated = eventBus.onMetaChatUpdated((data) => {
        if (
          data.roadmapId === roadmapId &&
          connection.socket.readyState === connection.socket.OPEN
        ) {
          connection.socket.send(
            JSON.stringify({
              type: "meta-chat:updated",
              data,
            })
          );
        }
      });

      // Listen for meta-chat messages
      const unsubscribeMessages = eventBus.onMetaChatMessage((data) => {
        // Need to check if this message belongs to our roadmap's meta-chat
        const meta = fastify.db
          ? dbGetMetaChat(fastify.db, roadmapId)
          : Promise.resolve(getMetaChat(roadmapId));

        meta
          .then((metaChat) => {
            if (
              metaChat &&
              data.metaChatId === metaChat.id &&
              connection.socket.readyState === connection.socket.OPEN
            ) {
              connection.socket.send(
                JSON.stringify({
                  type: "meta-chat:message",
                  data,
                })
              );
            }
          })
          .catch(() => {
            // Ignore errors in message filtering
          });
      });

      // Handle WebSocket close
      connection.socket.on("close", () => {
        unsubscribeUpdated();
        unsubscribeMessages();
      });

      // Handle ping/pong for connection keep-alive
      connection.socket.on("message", (data: Buffer) => {
        try {
          const parsed = JSON.parse(data.toString());
          if (parsed.type === "ping") {
            connection.socket.send(JSON.stringify({ type: "pong" }));
          }
        } catch {
          // Ignore invalid messages
        }
      });
    }
  );

  // AI clarification endpoint for meta-chat
  fastify.post("/meta-chats/:metaChatId/clarify", async (request, reply) => {
    const session = await requireSession(request, reply);
    if (!session) return;

    const metaChatId = (request.params as { metaChatId: string }).metaChatId;
    const body = request.body as {
      question: string;
      context?: {
        roadmapId?: string;
        chatIds?: string[];
        includeHistory?: boolean;
      };
    };

    if (!body.question) {
      reply.code(400).send({
        error: { code: "invalid_request", message: "question is required" },
      });
      return;
    }

    try {
      const clarification = await requestClarification(
        fastify.db ?? null,
        {
          metaChatId,
          question: body.question,
          context: body.context,
        },
        fastify.qwenClient
      );

      reply.send(clarification);

      await recordAuditEvent(fastify, {
        userId: session.userId,
        eventType: "meta-chat:clarification",
        metadata: {
          metaChatId,
          questionLength: body.question.length,
          includeHistory: body.context?.includeHistory ?? false,
        },
      });
    } catch (err) {
      fastify.log.error({ err }, "Failed to generate AI clarification");
      reply.code(500).send({
        error: {
          code: "clarification_failed",
          message: err instanceof Error ? err.message : "Failed to generate clarification",
        },
      });
    }
  });
};
