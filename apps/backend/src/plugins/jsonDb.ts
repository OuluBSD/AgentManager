/**
 * JSON Database Plugin
 * Provides JsonDatabase instance to Fastify
 */
import type { FastifyPluginAsync } from "fastify";
import fp from "fastify-plugin";
import { JsonDatabase } from "../services/jsonDatabase";
import { loadEnv } from "../utils/env";

declare module "fastify" {
  interface FastifyInstance {
    jsonDb?: JsonDatabase;
  }
}

const jsonDbPluginFunction: FastifyPluginAsync = async (fastify) => {
  const env = loadEnv(process.env);
  const dataDir = process.env.AGENT_MANAGER_REPO_DIR;

  if (!dataDir) {
    fastify.log.warn("AGENT_MANAGER_REPO_DIR not set; JSON database will not be available.");
    return;
  }

  try {
    const jsonDb = new JsonDatabase({
      dataDir,
      maxCacheSize: 1000,
      cacheTTL: 5 * 60 * 1000, // 5 minutes
    });

    await jsonDb.initialize();
    fastify.decorate("jsonDb", jsonDb);

    fastify.log.info({ dataDir }, "JSON database initialized");

    // Cleanup on close
    fastify.addHook("onClose", async () => {
      await jsonDb.flush();
    });
  } catch (err) {
    fastify.log.error({ err }, "Failed to initialize JSON database");
  }
};

export const jsonDbPlugin = fp(jsonDbPluginFunction, {
  name: "json-db",
});
