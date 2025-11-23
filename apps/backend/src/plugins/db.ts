import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import type { FastifyPluginAsync } from "fastify";
import * as schema from "@nexus/shared/db/schema";
import { loadEnv } from "../utils/env";

declare module "fastify" {
  interface FastifyInstance {
    db?: NodePgDatabase<typeof schema>;
  }
}

export const dbPlugin: FastifyPluginAsync = async (fastify) => {
  const env = loadEnv(process.env);
  if (!env.DATABASE_URL) {
    fastify.log.warn("DATABASE_URL not set; backend will use in-memory store.");
    return;
  }

  const pool = new Pool({ connectionString: env.DATABASE_URL });

  try {
    await pool.query("select 1");
    fastify.log.info("Connected to Postgres via DATABASE_URL.");
  } catch (err) {
    fastify.log.error({ err }, "Failed to connect to Postgres; continuing without DB.");
    await pool.end();
    return;
  }

  const db = drizzle(pool, { schema });
  fastify.decorate("db", db);

  fastify.addHook("onClose", async () => {
    await pool.end();
  });
};
