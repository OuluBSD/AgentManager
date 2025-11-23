import type { FastifyPluginAsync } from "fastify";
import { createRoadmap, getMetaChat, listRoadmaps, updateRoadmap } from "../services/mockStore";
import { requireSession } from "../utils/auth";

export const roadmapRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get("/projects/:projectId/roadmaps", async (request, reply) => {
    if (!requireSession(request, reply)) return;
    const projectId = (request.params as { projectId: string }).projectId;
    reply.send(listRoadmaps(projectId));
  });

  fastify.post("/projects/:projectId/roadmaps", async (request, reply) => {
    if (!requireSession(request, reply)) return;
    const projectId = (request.params as { projectId: string }).projectId;
    const { roadmap, meta } = createRoadmap(projectId, (request.body as Record<string, unknown>) ?? {});
    reply.code(201).send({ id: roadmap.id, metaChatId: meta.id });
  });

  fastify.patch("/roadmaps/:roadmapId", async (request, reply) => {
    if (!requireSession(request, reply)) return;
    const roadmapId = (request.params as { roadmapId: string }).roadmapId;
    const updated = updateRoadmap(roadmapId, (request.body as Record<string, unknown>) ?? {});
    if (!updated) {
      reply.code(404).send({ error: { code: "not_found", message: "Roadmap not found" } });
      return;
    }
    reply.send(updated);
  });

  fastify.get("/roadmaps/:roadmapId/meta-chat", async (request, reply) => {
    if (!requireSession(request, reply)) return;
    const roadmapId = (request.params as { roadmapId: string }).roadmapId;
    const meta = getMetaChat(roadmapId);
    if (!meta) {
      reply.code(404).send({ error: { code: "not_found", message: "Meta-chat not found" } });
      return;
    }
    reply.send(meta);
  });

  fastify.get("/roadmaps/:roadmapId/status", async (request, reply) => {
    if (!requireSession(request, reply)) return;
    const roadmapId = (request.params as { roadmapId: string }).roadmapId;
    const meta = getMetaChat(roadmapId);
    if (!meta) {
      reply.code(404).send({ error: { code: "not_found", message: "Meta-chat not found" } });
      return;
    }
    reply.send({ roadmapId, status: meta.status, progress: meta.progress, summary: meta.summary });
  });
};
