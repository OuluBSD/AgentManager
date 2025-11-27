import type { FastifyPluginAsync } from "fastify";
import { dbCreateTemplate, dbListTemplates, dbUpdateTemplate } from "../services/projectRepository";
import { createTemplate, listTemplates, updateTemplate } from "../services/mockStore";
import { requireSession } from "../utils/auth";
import { recordAuditEvent } from "../services/auditLogger";

export const templateRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get("/templates", async (request, reply) => {
    if (!(await requireSession(request, reply))) return;
    if (fastify.db) {
      try {
        reply.send(await dbListTemplates(fastify.db));
        return;
      } catch (err) {
        fastify.log.error(
          { err },
          "Failed to list templates from database; falling back to memory."
        );
      }
    }
    reply.send(listTemplates());
  });

  fastify.post("/templates", async (request, reply) => {
    const session = await requireSession(request, reply);
    if (!session) return;

    const body = (request.body as Record<string, unknown>) ?? {};
    let template;

    if (fastify.db) {
      try {
        template = await dbCreateTemplate(fastify.db, body);
        reply.code(201).send({ id: template.id });
      } catch (err) {
        fastify.log.error({ err }, "Failed to create template in database; using in-memory store.");
        template = createTemplate(body);
        reply.code(201).send({ id: template.id });
      }
    } else {
      template = createTemplate(body);
      reply.code(201).send({ id: template.id });
    }

    await recordAuditEvent(fastify, {
      userId: session.userId,
      eventType: "template:create",
      metadata: {
        templateId: template.id,
        title: template.title,
        jsonRequired: template.jsonRequired,
      },
    });
  });

  fastify.patch("/templates/:templateId", async (request, reply) => {
    const session = await requireSession(request, reply);
    if (!session) return;

    const templateId = (request.params as { templateId: string }).templateId;
    const body = (request.body as Record<string, unknown>) ?? {};
    let updated;

    if (fastify.db) {
      try {
        updated = await dbUpdateTemplate(fastify.db, templateId, body);
        if (!updated) {
          reply.code(404).send({ error: { code: "not_found", message: "Template not found" } });
          return;
        }
        reply.send(updated);
      } catch (err) {
        fastify.log.error(
          { err },
          "Failed to update template in database; falling back to memory."
        );
        updated = updateTemplate(templateId, body);
        if (!updated) {
          reply.code(404).send({ error: { code: "not_found", message: "Template not found" } });
          return;
        }
        reply.send(updated);
      }
    } else {
      updated = updateTemplate(templateId, body);
      if (!updated) {
        reply.code(404).send({ error: { code: "not_found", message: "Template not found" } });
        return;
      }
      reply.send(updated);
    }

    await recordAuditEvent(fastify, {
      userId: session.userId,
      eventType: "template:update",
      metadata: {
        templateId,
        changes: body,
      },
    });
  });
};
