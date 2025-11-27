import type { FastifyPluginAsync } from "fastify";
import {
  dbAddMessage,
  dbCreateChat,
  dbFindChatForMerge,
  dbGetChat,
  dbGetMessages,
  dbGetTemplate,
  dbListChats,
  dbMergeChats,
  dbSyncMetaFromChats,
  dbUpdateChat,
} from "../services/projectRepository";
import {
  addMessage,
  createChat,
  findChatForMerge,
  getChat,
  getMessages,
  getTemplate,
  listChats,
  mergeChats,
  syncRoadmapMeta,
  updateChat,
} from "../services/mockStore";
import { processMessageForJSON } from "../services/jsonStatusProcessor";
import { requireSession } from "../utils/auth";
import { recordAuditEvent } from "../services/auditLogger";

export const chatRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get("/roadmaps/:roadmapId/chats", async (request, reply) => {
    if (!(await requireSession(request, reply))) return;
    const roadmapId = (request.params as { roadmapId: string }).roadmapId;
    if (fastify.db) {
      try {
        reply.send(await dbListChats(fastify.db, roadmapId));
        return;
      } catch (err) {
        fastify.log.error({ err }, "Failed to list chats from database; falling back to memory.");
      }
    }
    reply.send(listChats(roadmapId));
  });

  fastify.post("/roadmaps/:roadmapId/chats", async (request, reply) => {
    const session = await requireSession(request, reply);
    if (!session) return;

    const roadmapId = (request.params as { roadmapId: string }).roadmapId;
    const body = (request.body as Record<string, unknown>) ?? {};
    let chat;

    if (fastify.db) {
      try {
        chat = await dbCreateChat(fastify.db, roadmapId, body);
        await dbSyncMetaFromChats(fastify.db, roadmapId);
        reply.code(201).send({ id: chat.id });
      } catch (err) {
        fastify.log.error({ err }, "Failed to create chat in database; using in-memory store.");
        chat = createChat(roadmapId, body);
        syncRoadmapMeta(roadmapId);
        reply.code(201).send({ id: chat.id });
      }
    } else {
      chat = createChat(roadmapId, body);
      syncRoadmapMeta(roadmapId);
      reply.code(201).send({ id: chat.id });
    }

    await recordAuditEvent(fastify, {
      userId: session.userId,
      eventType: "chat:create",
      metadata: {
        chatId: chat.id,
        roadmapId,
        title: chat.title,
        templateId: chat.templateId,
      },
    });
  });

  fastify.post("/roadmaps/:roadmapId/chats/from-template", async (request, reply) => {
    const session = await requireSession(request, reply);
    if (!session) return;

    const roadmapId = (request.params as { roadmapId: string }).roadmapId;
    const body = request.body as {
      templateId: string;
      title?: string;
      goal?: string;
      metadata?: unknown;
    };
    const payload = {
      templateId: body?.templateId,
      title: body?.title,
      goal: body?.goal,
      metadata: body?.metadata as Record<string, unknown>,
    };
    let chat;

    if (fastify.db) {
      try {
        chat = await dbCreateChat(fastify.db, roadmapId, payload);
        await dbSyncMetaFromChats(fastify.db, roadmapId);
        reply.code(201).send({ id: chat.id });
      } catch (err) {
        fastify.log.error(
          { err },
          "Failed to create chat from template in database; using in-memory store."
        );
        chat = createChat(roadmapId, payload);
        syncRoadmapMeta(roadmapId);
        reply.code(201).send({ id: chat.id });
      }
    } else {
      chat = createChat(roadmapId, payload);
      syncRoadmapMeta(roadmapId);
      reply.code(201).send({ id: chat.id });
    }

    await recordAuditEvent(fastify, {
      userId: session.userId,
      eventType: "chat:create_from_template",
      metadata: {
        chatId: chat.id,
        roadmapId,
        templateId: payload.templateId,
        title: chat.title,
      },
    });
  });

  fastify.patch("/chats/:chatId", async (request, reply) => {
    const session = await requireSession(request, reply);
    if (!session) return;

    const chatId = (request.params as { chatId: string }).chatId;
    const body = (request.body as Record<string, unknown>) ?? {};
    let updated;

    if (fastify.db) {
      try {
        updated = await dbUpdateChat(fastify.db, chatId, body);
        if (!updated) {
          reply.code(404).send({ error: { code: "not_found", message: "Chat not found" } });
          return;
        }
        reply.send(updated);
        await dbSyncMetaFromChats(fastify.db, updated.roadmapListId);
      } catch (err) {
        fastify.log.error({ err }, "Failed to update chat in database; falling back to memory.");
        updated = updateChat(chatId, body);
        if (!updated) {
          reply.code(404).send({ error: { code: "not_found", message: "Chat not found" } });
          return;
        }
        reply.send(updated);
        syncRoadmapMeta(updated.roadmapListId);
      }
    } else {
      updated = updateChat(chatId, body);
      if (!updated) {
        reply.code(404).send({ error: { code: "not_found", message: "Chat not found" } });
        return;
      }
      reply.send(updated);
      syncRoadmapMeta(updated.roadmapListId);
    }

    await recordAuditEvent(fastify, {
      userId: session.userId,
      eventType: "chat:update",
      metadata: {
        chatId,
        changes: body,
      },
    });
  });

  fastify.post("/chats/:chatId/merge", async (request, reply) => {
    const session = await requireSession(request, reply);
    if (!session) return;

    const chatId = (request.params as { chatId: string }).chatId;
    const body = request.body as { targetIdentifier?: string };
    const targetIdentifier = (body?.targetIdentifier ?? "").trim();
    if (!targetIdentifier) {
      reply.code(400).send({ error: { code: "invalid", message: "Target identifier required" } });
      return;
    }

    let sourceChat, targetChat, mergedTarget;

    if (fastify.db) {
      try {
        sourceChat = await dbGetChat(fastify.db, chatId);
        if (!sourceChat) {
          reply.code(404).send({ error: { code: "not_found", message: "Chat not found" } });
          return;
        }
        targetChat = await dbFindChatForMerge(
          fastify.db,
          sourceChat.roadmapListId,
          targetIdentifier,
          chatId
        );
        if (!targetChat) {
          reply.code(404).send({ error: { code: "not_found", message: "Target chat not found" } });
          return;
        }
        mergedTarget = await dbMergeChats(fastify.db, chatId, targetChat.id);
        if (!mergedTarget) {
          reply
            .code(500)
            .send({ error: { code: "merge_failed", message: "Failed to merge chats" } });
          return;
        }
        await dbSyncMetaFromChats(fastify.db, sourceChat.roadmapListId);
        reply.send({ target: mergedTarget, removedChatId: chatId });
      } catch (err) {
        fastify.log.error({ err }, "Failed to merge chats in database; falling back to memory.");
        sourceChat = getChat(chatId);
        if (!sourceChat) {
          reply.code(404).send({ error: { code: "not_found", message: "Chat not found" } });
          return;
        }
        targetChat = findChatForMerge(sourceChat.roadmapListId, targetIdentifier, chatId);
        if (!targetChat) {
          reply.code(404).send({ error: { code: "not_found", message: "Target chat not found" } });
          return;
        }
        const merged = mergeChats(chatId, targetChat.id);
        if (!merged) {
          reply
            .code(500)
            .send({ error: { code: "merge_failed", message: "Failed to merge chats" } });
          return;
        }
        syncRoadmapMeta(sourceChat.roadmapListId);
        reply.send(merged);
      }
    } else {
      sourceChat = getChat(chatId);
      if (!sourceChat) {
        reply.code(404).send({ error: { code: "not_found", message: "Chat not found" } });
        return;
      }
      targetChat = findChatForMerge(sourceChat.roadmapListId, targetIdentifier, chatId);
      if (!targetChat) {
        reply.code(404).send({ error: { code: "not_found", message: "Target chat not found" } });
        return;
      }
      const merged = mergeChats(chatId, targetChat.id);
      if (!merged) {
        reply.code(500).send({ error: { code: "merge_failed", message: "Failed to merge chats" } });
        return;
      }
      syncRoadmapMeta(sourceChat.roadmapListId);
      mergedTarget = merged.target;
    }

    await recordAuditEvent(fastify, {
      userId: session.userId,
      eventType: "chat:merge",
      metadata: {
        sourceChatId: chatId,
        targetChatId: targetChat!.id,
        targetIdentifier,
      },
    });
  });

  fastify.get("/chats/:chatId/messages", async (request, reply) => {
    if (!(await requireSession(request, reply))) return;
    const chatId = (request.params as { chatId: string }).chatId;
    if (fastify.db) {
      try {
        reply.send(await dbGetMessages(fastify.db, chatId));
        return;
      } catch (err) {
        fastify.log.error(
          { err },
          "Failed to load chat messages from database; falling back to memory."
        );
      }
    }
    reply.send(getMessages(chatId));
  });

  fastify.post("/chats/:chatId/messages", async (request, reply) => {
    const session = await requireSession(request, reply);
    if (!session) return;

    const chatId = (request.params as { chatId: string }).chatId;
    const body = request.body as {
      role: "user" | "assistant" | "system" | "status" | "meta";
      content: string;
    };

    // Fetch chat and template for JSON status processing
    let chat = null;
    let template = null;
    if (fastify.db) {
      try {
        chat = await dbGetChat(fastify.db, chatId);
        if (chat?.templateId) {
          template = await dbGetTemplate(fastify.db, chat.templateId);
        }
      } catch (err) {
        fastify.log.error({ err }, "Failed to fetch chat/template from database");
      }
    } else {
      chat = getChat(chatId);
      if (chat?.templateId) {
        template = getTemplate(chat.templateId);
      }
    }

    // Process JSON status for assistant messages
    let jsonResult = null;
    if (body.role === "assistant" && chat && template) {
      try {
        jsonResult = await processMessageForJSON(body.content, chat, template);
        if (!jsonResult.valid && jsonResult.needsReformat) {
          // Add a system message requesting reformatted JSON
          const errorMessage = {
            role: "system" as const,
            content: `JSON Status Error: ${jsonResult.error}\n\nPlease provide a valid JSON status update with 'status' and 'progress' fields.`,
          };
          if (fastify.db) {
            await dbAddMessage(fastify.db, chatId, errorMessage);
          } else {
            addMessage(chatId, { chatId, ...errorMessage });
          }
        } else if (jsonResult.valid && (jsonResult.status || jsonResult.progress !== undefined)) {
          // Update chat status/progress based on JSON
          const statusUpdate = {
            status: jsonResult.status,
            progress: jsonResult.progress,
          };
          if (fastify.db) {
            await dbUpdateChat(fastify.db, chatId, statusUpdate);
            if (chat.roadmapListId) {
              await dbSyncMetaFromChats(fastify.db, chat.roadmapListId);
            }
          } else {
            updateChat(chatId, statusUpdate);
            if (chat.roadmapListId) {
              syncRoadmapMeta(chat.roadmapListId);
            }
          }
        }
      } catch (err) {
        fastify.log.error({ err }, "Failed to process JSON status");
      }
    }

    // Add the message
    let message;
    if (fastify.db) {
      try {
        message = await dbAddMessage(fastify.db, chatId, {
          role: body.role ?? "user",
          content: body.content,
        });
        reply.code(201).send({ id: message.id });
      } catch (err) {
        fastify.log.error({ err }, "Failed to append message in database; using in-memory store.");
        message = addMessage(chatId, {
          chatId,
          role: body.role ?? "user",
          content: body.content,
        });
        reply.code(201).send({ id: message.id });
      }
    } else {
      message = addMessage(chatId, {
        chatId,
        role: body.role ?? "user",
        content: body.content,
      });
      reply.code(201).send({ id: message.id });
    }

    await recordAuditEvent(fastify, {
      userId: session.userId,
      eventType: "chat:message",
      metadata: {
        chatId,
        messageId: message.id,
        role: body.role,
        contentLength: body.content.length,
      },
    });
  });

  fastify.post("/chats/:chatId/status", async (request, reply) => {
    const session = await requireSession(request, reply);
    if (!session) return;

    const chatId = (request.params as { chatId: string }).chatId;
    const body = request.body as { status?: string; progress?: number; focus?: string };
    const patch = {
      status: body?.status ?? "in_progress",
      progress: body?.progress ?? 0,
      metadata: { focus: body?.focus },
    };
    let updated;

    if (fastify.db) {
      try {
        updated = await dbUpdateChat(fastify.db, chatId, patch);
        if (!updated) {
          reply.code(404).send({ error: { code: "not_found", message: "Chat not found" } });
          return;
        }
        reply.send(updated);
        await dbSyncMetaFromChats(fastify.db, updated.roadmapListId);
      } catch (err) {
        fastify.log.error(
          { err },
          "Failed to update chat status in database; falling back to memory."
        );
        updated = updateChat(chatId, patch);
        if (!updated) {
          reply.code(404).send({ error: { code: "not_found", message: "Chat not found" } });
          return;
        }
        reply.send(updated);
        syncRoadmapMeta(updated.roadmapListId);
      }
    } else {
      updated = updateChat(chatId, patch);
      if (!updated) {
        reply.code(404).send({ error: { code: "not_found", message: "Chat not found" } });
        return;
      }
      reply.send(updated);
      syncRoadmapMeta(updated.roadmapListId);
    }

    await recordAuditEvent(fastify, {
      userId: session.userId,
      eventType: "chat:status_update",
      metadata: {
        chatId,
        status: patch.status,
        progress: patch.progress,
        focus: body?.focus,
      },
    });
  });
};
