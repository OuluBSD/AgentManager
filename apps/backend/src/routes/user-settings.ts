/**
 * User settings routes (terminal settings, preferences, etc.)
 */
import type { FastifyPluginAsync } from "fastify";
import { requireSession } from "../utils/auth";
import { eq } from "drizzle-orm";
import * as schema from "@nexus/shared/db/schema";

export const userSettingsRoutes: FastifyPluginAsync = async (fastify) => {
  /**
   * GET /user/settings/terminal
   * Get user's terminal settings
   */
  fastify.get("/user/settings/terminal", async (request, reply) => {
    const session = await requireSession(request, reply);
    if (!session) return;

    try {
      if (fastify.db) {
        // PostgreSQL database
        const [userSettings] = await fastify.db
          .select()
          .from(schema.userTerminalSettings)
          .where(eq(schema.userTerminalSettings.userId, session.userId));

        reply.send({ settings: userSettings?.settings || null });
      } else if (fastify.jsonDb) {
        // JSON filesystem database
        const userSettings = await fastify.jsonDb.getTerminalSettingsByUserId(session.userId);
        reply.send({ settings: userSettings?.settings || null });
      } else {
        // No database available
        reply.send({ settings: null });
      }
    } catch (err) {
      fastify.log.error({ err }, "Failed to get terminal settings");
      reply
        .code(500)
        .send({ error: { code: "internal_error", message: "Failed to get terminal settings" } });
    }
  });

  /**
   * PUT /user/settings/terminal
   * Save user's terminal settings
   */
  fastify.put("/user/settings/terminal", async (request, reply) => {
    const session = await requireSession(request, reply);
    if (!session) return;

    const body = request.body as { settings: Record<string, unknown> };
    if (!body.settings) {
      reply
        .code(400)
        .send({ error: { code: "missing_settings", message: "settings is required" } });
      return;
    }

    try {
      if (fastify.db) {
        // PostgreSQL database
        const [existing] = await fastify.db
          .select()
          .from(schema.userTerminalSettings)
          .where(eq(schema.userTerminalSettings.userId, session.userId));

        if (existing) {
          // Update existing settings
          const [updated] = await fastify.db
            .update(schema.userTerminalSettings)
            .set({
              settings: body.settings,
              updatedAt: new Date(),
            })
            .where(eq(schema.userTerminalSettings.userId, session.userId))
            .returning();

          reply.send({ success: true, settings: updated.settings });
        } else {
          // Create new settings
          const [created] = await fastify.db
            .insert(schema.userTerminalSettings)
            .values({
              userId: session.userId,
              settings: body.settings,
            })
            .returning();

          reply.send({ success: true, settings: created.settings });
        }
      } else if (fastify.jsonDb) {
        // JSON filesystem database
        const existing = await fastify.jsonDb.getTerminalSettingsByUserId(session.userId);

        if (existing) {
          // Update existing settings
          const updated = await fastify.jsonDb.updateTerminalSettings(
            session.userId,
            body.settings
          );
          reply.send({ success: true, settings: updated?.settings || body.settings });
        } else {
          // Create new settings
          const created = await fastify.jsonDb.createTerminalSettings({
            userId: session.userId,
            settings: body.settings,
          });
          reply.send({ success: true, settings: created.settings });
        }
      } else {
        // No database available - just acknowledge the save
        reply.send({ success: true, settings: body.settings });
      }
    } catch (err) {
      fastify.log.error({ err }, "Failed to save terminal settings");
      reply
        .code(500)
        .send({ error: { code: "internal_error", message: "Failed to save terminal settings" } });
    }
  });
};
