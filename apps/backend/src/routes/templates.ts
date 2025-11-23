import type { FastifyPluginAsync } from "fastify";
import { createTemplate, listTemplates, updateTemplate } from "../services/mockStore";
import { requireSession } from "../utils/auth";

export const templateRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get("/templates", async (request, reply) => {
    if (!requireSession(request, reply)) return;
    reply.send(listTemplates());
  });

  fastify.post("/templates", async (request, reply) => {
    if (!requireSession(request, reply)) return;
    const template = createTemplate((request.body as Record<string, unknown>) ?? {});
    reply.code(201).send({ id: template.id });
  });

  fastify.patch("/templates/:templateId", async (request, reply) => {
    if (!requireSession(request, reply)) return;
    const templateId = (request.params as { templateId: string }).templateId;
    const updated = updateTemplate(templateId, (request.body as Record<string, unknown>) ?? {});
    if (!updated) {
      reply.code(404).send({ error: { code: "not_found", message: "Template not found" } });
      return;
    }
    reply.send(updated);
  });
};
