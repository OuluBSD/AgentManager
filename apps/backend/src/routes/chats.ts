import type { FastifyPluginAsync } from "fastify";
import {
  addMessage,
  createChat,
  getMessages,
  listChats,
  updateChat,
} from "../services/mockStore";
import { requireSession } from "../utils/auth";

export const chatRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get("/roadmaps/:roadmapId/chats", async (request, reply) => {
    if (!requireSession(request, reply)) return;
    const roadmapId = (request.params as { roadmapId: string }).roadmapId;
    reply.send(listChats(roadmapId));
  });

  fastify.post("/roadmaps/:roadmapId/chats", async (request, reply) => {
    if (!requireSession(request, reply)) return;
    const roadmapId = (request.params as { roadmapId: string }).roadmapId;
    const chat = createChat(roadmapId, (request.body as Record<string, unknown>) ?? {});
    reply.code(201).send({ id: chat.id });
  });

  fastify.post("/roadmaps/:roadmapId/chats/from-template", async (request, reply) => {
    if (!requireSession(request, reply)) return;
    const roadmapId = (request.params as { roadmapId: string }).roadmapId;
    const body = request.body as { templateId: string; title?: string; goal?: string; metadata?: unknown };
    const chat = createChat(roadmapId, {
      templateId: body?.templateId,
      title: body?.title,
      goal: body?.goal,
      metadata: body?.metadata as Record<string, unknown>,
    });
    reply.code(201).send({ id: chat.id });
  });

  fastify.patch("/chats/:chatId", async (request, reply) => {
    if (!requireSession(request, reply)) return;
    const chatId = (request.params as { chatId: string }).chatId;
    const updated = updateChat(chatId, (request.body as Record<string, unknown>) ?? {});
    if (!updated) {
      reply.code(404).send({ error: { code: "not_found", message: "Chat not found" } });
      return;
    }
    reply.send(updated);
  });

  fastify.get("/chats/:chatId/messages", async (request, reply) => {
    if (!requireSession(request, reply)) return;
    const chatId = (request.params as { chatId: string }).chatId;
    reply.send(getMessages(chatId));
  });

  fastify.post("/chats/:chatId/messages", async (request, reply) => {
    if (!requireSession(request, reply)) return;
    const chatId = (request.params as { chatId: string }).chatId;
    const body = request.body as { role: "user" | "assistant" | "system" | "status" | "meta"; content: string };
    const message = addMessage(chatId, {
      chatId,
      role: body.role ?? "user",
      content: body.content,
    });
    reply.code(201).send({ id: message.id });
  });

  fastify.post("/chats/:chatId/status", async (request, reply) => {
    if (!requireSession(request, reply)) return;
    const chatId = (request.params as { chatId: string }).chatId;
    const body = request.body as { status?: string; progress?: number; focus?: string };
    const updated = updateChat(chatId, {
      status: body?.status ?? "in_progress",
      progress: body?.progress ?? 0,
      metadata: { focus: body?.focus },
    });
    if (!updated) {
      reply.code(404).send({ error: { code: "not_found", message: "Chat not found" } });
      return;
    }
    reply.send(updated);
  });
};
