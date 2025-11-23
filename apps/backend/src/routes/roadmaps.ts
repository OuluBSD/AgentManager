import type { FastifyPluginAsync } from "fastify";
import { dbCreateRoadmap, dbGetMetaChat, dbListRoadmaps, dbUpdateRoadmap } from "../services/projectRepository";
import { createRoadmap, getMetaChat, listRoadmaps, updateRoadmap } from "../services/mockStore";
import { requireSession } from "../utils/auth";

export const roadmapRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get("/projects/:projectId/roadmaps", async (request, reply) => {
    if (!(await requireSession(request, reply))) return;
    const projectId = (request.params as { projectId: string }).projectId;
    if (fastify.db) {
      try {
        reply.send(await dbListRoadmaps(fastify.db, projectId));
        return;
      } catch (err) {
        fastify.log.error({ err }, "Failed to list roadmaps from database; falling back to memory.");
      }
    }
    reply.send(listRoadmaps(projectId));
  });

  fastify.post("/projects/:projectId/roadmaps", async (request, reply) => {
    if (!(await requireSession(request, reply))) return;
    const projectId = (request.params as { projectId: string }).projectId;
    if (fastify.db) {
      try {
        const { roadmap, metaChat } = await dbCreateRoadmap(
          fastify.db,
          projectId,
          (request.body as Record<string, unknown>) ?? {},
        );
        reply.code(201).send({ id: roadmap.id, metaChatId: metaChat.id });
        return;
      } catch (err) {
        fastify.log.error({ err }, "Failed to create roadmap in database; using in-memory store.");
      }
    }
    const { roadmap, meta } = createRoadmap(projectId, (request.body as Record<string, unknown>) ?? {});
    reply.code(201).send({ id: roadmap.id, metaChatId: meta.id });
  });

  fastify.patch("/roadmaps/:roadmapId", async (request, reply) => {
    if (!(await requireSession(request, reply))) return;
    const roadmapId = (request.params as { roadmapId: string }).roadmapId;
    if (fastify.db) {
      try {
        const updated = await dbUpdateRoadmap(
          fastify.db,
          roadmapId,
          (request.body as Record<string, unknown>) ?? {},
        );
        if (!updated) {
          reply.code(404).send({ error: { code: "not_found", message: "Roadmap not found" } });
          return;
        }
        reply.send(updated);
        return;
      } catch (err) {
        fastify.log.error({ err }, "Failed to update roadmap in database; falling back to memory.");
      }
    }
    const updated = updateRoadmap(roadmapId, (request.body as Record<string, unknown>) ?? {});
    if (!updated) {
      reply.code(404).send({ error: { code: "not_found", message: "Roadmap not found" } });
      return;
    }
    reply.send(updated);
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
        fastify.log.error({ err }, "Failed to fetch meta-chat from database; falling back to memory.");
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
        reply.send({ roadmapId, status: meta.status, progress: meta.progress, summary: meta.summary });
        return;
      } catch (err) {
        fastify.log.error({ err }, "Failed to fetch roadmap status from database; falling back to memory.");
      }
    }
    const meta = getMetaChat(roadmapId);
    if (!meta) {
      reply.code(404).send({ error: { code: "not_found", message: "Meta-chat not found" } });
      return;
    }
    reply.send({ roadmapId, status: meta.status, progress: meta.progress, summary: meta.summary });
  });
};
