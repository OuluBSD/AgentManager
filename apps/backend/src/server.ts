import Fastify from "fastify";
import cors from "@fastify/cors";
import websocket from "@fastify/websocket";
import { registerRoutes } from "./routes";
import { loadEnv } from "./utils/env";
import { dbPlugin } from "./plugins/db";

async function start() {
  const env = loadEnv(process.env);
  const app = Fastify({ logger: true });

  await app.register(cors, { origin: true, credentials: true });
  await app.register(websocket);
  await app.register(dbPlugin);

  app.get("/health", async () => ({ status: "ok" }));
  await app.register(registerRoutes, { prefix: "/api" });

  try {
    await app.listen({ port: env.PORT, host: env.HOST });
    app.log.info(`Backend running on http://${env.HOST}:${env.PORT}`);
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
}

start();
