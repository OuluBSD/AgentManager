import { and, desc, eq, lt, type SQL } from "drizzle-orm";
import type { FastifyPluginAsync } from "fastify";
import * as schema from "@nexus/shared/db/schema";
import { requireSession } from "../utils/auth";

export const auditRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get("/audit/events", async (request, reply) => {
    const session = await requireSession(request, reply);
    if (!session) return;
    if (!fastify.db) {
      reply.send({ events: [], paging: { hasMore: false } });
      return;
    }
    const query = request.query as { projectId?: string; limit?: string; before?: string };
    const limit = Math.min(Number(query.limit ?? 50) || 50, 200);
    const beforeDate = query.before ? new Date(query.before) : null;

    let builder = fastify.db
      .select({
        id: schema.auditEvents.id,
        eventType: schema.auditEvents.eventType,
        projectId: schema.auditEvents.projectId,
        userId: schema.auditEvents.userId,
        path: schema.auditEvents.path,
        sessionId: schema.auditEvents.sessionId,
        metadata: schema.auditEvents.metadata,
        createdAt: schema.auditEvents.createdAt,
      })
      .from(schema.auditEvents)
      .orderBy(desc(schema.auditEvents.createdAt))
      .limit(limit);

    const whereClauses: SQL[] = [];
    if (query.projectId) {
      whereClauses.push(eq(schema.auditEvents.projectId, query.projectId));
    }
    if (beforeDate && !Number.isNaN(beforeDate.getTime())) {
      whereClauses.push(lt(schema.auditEvents.createdAt, beforeDate));
    }
    if (whereClauses.length) {
      builder = builder.where(whereClauses.length === 1 ? whereClauses[0] : and(...whereClauses));
    }

    const rows = await builder;

    reply.send({
      events: rows,
      paging: {
        hasMore: rows.length === limit,
        nextCursor: rows.length ? rows[rows.length - 1].createdAt.toISOString() : undefined,
      },
    });
  });
};
