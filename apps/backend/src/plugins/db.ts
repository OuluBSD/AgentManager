import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import type { FastifyPluginAsync } from "fastify";
import fp from "fastify-plugin";
import * as schema from "@nexus/shared/db/schema";
import { loadEnv } from "../utils/env";
import { JsonDatabase } from "../services/jsonDatabase";

declare module "fastify" {
  interface FastifyInstance {
    db?: NodePgDatabase<typeof schema>;
    jsonDb?: JsonDatabase;
  }
}

const dbPluginFunction: FastifyPluginAsync = async (fastify) => {
  const env = loadEnv(process.env);
  const dbType = process.env.DATABASE_TYPE || "auto";
  const dataDir = process.env.AGENT_MANAGER_REPO_DIR;

  // Auto-detect: if DATABASE_URL is set, use PostgreSQL, otherwise use JSON
  const usePostgres = dbType === "postgres" || (dbType === "auto" && env.DATABASE_URL);
  const useJson = dbType === "json" || (dbType === "auto" && !env.DATABASE_URL && dataDir);

  // Try PostgreSQL first if configured
  if (usePostgres && env.DATABASE_URL) {
    const pool = new Pool({ connectionString: env.DATABASE_URL });

    try {
      await pool.query("select 1");
      fastify.log.info("Connected to PostgreSQL database.");

      const db = drizzle(pool, { schema });
      fastify.decorate("db", db);

      fastify.addHook("onClose", async () => {
        await pool.end();
      });

      return; // PostgreSQL connected successfully
    } catch (err) {
      fastify.log.error({ err }, "Failed to connect to PostgreSQL; trying JSON database...");
      await pool.end();
    }
  }

  // Try JSON database
  if (useJson && dataDir) {
    try {
      const jsonDb = new JsonDatabase({
        dataDir,
        maxCacheSize: 1000,
        cacheTTL: 5 * 60 * 1000, // 5 minutes
      });

      await jsonDb.initialize();
      fastify.decorate("jsonDb", jsonDb);

      fastify.log.info({ dataDir }, "Using JSON database for persistence.");

      fastify.addHook("onClose", async () => {
        await jsonDb.flush();
      });

      return; // JSON database initialized successfully
    } catch (err) {
      fastify.log.error({ err }, "Failed to initialize JSON database.");
    }
  }

  // No database available
  fastify.log.warn(
    "No database configured. Set DATABASE_URL for PostgreSQL or AGENT_MANAGER_REPO_DIR for JSON storage. Using in-memory store."
  );
};

export const dbPlugin = fp(dbPluginFunction, {
  name: "db",
});
