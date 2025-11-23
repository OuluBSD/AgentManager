import type { FastifyPluginAsync } from "fastify";
import { dbCreateTemplate, dbListTemplates, dbUpdateTemplate } from "../services/projectRepository";
import { createTemplate, listTemplates, updateTemplate } from "../services/mockStore";
import { requireSession } from "../utils/auth";

export const templateRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get("/templates", async (request, reply) => {
    if (!requireSession(request, reply)) return;
    if (fastify.db) {
      try {
        reply.send(await dbListTemplates(fastify.db));
        return;
      } catch (err) {
        fastify.log.error({ err }, "Failed to list templates from database; falling back to memory.");
      }
    }
    reply.send(listTemplates());
  });

  fastify.post("/templates", async (request, reply) => {
    if (!requireSession(request, reply)) return;
    if (fastify.db) {
      try {
        const template = await dbCreateTemplate(fastify.db, (request.body as Record<string, unknown>) ?? {});
        reply.code(201).send({ id: template.id });
        return;
      } catch (err) {
        fastify.log.error({ err }, "Failed to create template in database; using in-memory store.");
      }
    }
    const template = createTemplate((request.body as Record<string, unknown>) ?? {});
    reply.code(201).send({ id: template.id });
  });

  fastify.patch("/templates/:templateId", async (request, reply) => {
    if (!requireSession(request, reply)) return;
    const templateId = (request.params as { templateId: string }).templateId;
    if (fastify.db) {
      try {
        const updated = await dbUpdateTemplate(
          fastify.db,
          templateId,
          (request.body as Record<string, unknown>) ?? {},
        );
        if (!updated) {
          reply.code(404).send({ error: { code: "not_found", message: "Template not found" } });
          return;
        }
        reply.send(updated);
        return;
      } catch (err) {
        fastify.log.error({ err }, "Failed to update template in database; falling back to memory.");
      }
    }
    const updated = updateTemplate(templateId, (request.body as Record<string, unknown>) ?? {});
    if (!updated) {
      reply.code(404).send({ error: { code: "not_found", message: "Template not found" } });
      return;
    }
    reply.send(updated);
  });
};
