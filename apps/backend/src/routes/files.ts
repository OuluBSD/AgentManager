import type { FastifyPluginAsync } from "fastify";
import path from "node:path";
import { requireSession } from "../utils/auth";

const workspaceRoot = path.resolve(process.cwd(), "projects");

function sanitizePath(input: string) {
  const targetPath = path.normalize(path.join(workspaceRoot, input));
  if (!targetPath.startsWith(workspaceRoot)) {
    return null;
  }
  return targetPath;
}

export const fileRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get("/fs/tree", async (request, reply) => {
    if (!requireSession(request, reply)) return;
    const inputPath = ((request.query as { path?: string }).path ?? "/").replace(/^\//, "");
    const safePath = sanitizePath(inputPath);
    if (!safePath) {
      reply.code(400).send({ error: { code: "bad_path", message: "Invalid path" } });
      return;
    }

    reply.send({
      path: inputPath,
      entries: [
        { type: "dir", name: "apps" },
        { type: "dir", name: "packages" },
        { type: "file", name: "README.md" },
      ],
    });
  });

  fastify.get("/fs/file", async (request, reply) => {
    if (!requireSession(request, reply)) return;
    const query = request.query as { path?: string };
    const safePath = sanitizePath((query.path ?? "").replace(/^\//, ""));
    if (!safePath) {
      reply.code(400).send({ error: { code: "bad_path", message: "Invalid path" } });
      return;
    }

    reply.send({
      path: query.path,
      content: "// placeholder content",
    });
  });

  fastify.post("/fs/write", async (request, reply) => {
    if (!requireSession(request, reply)) return;
    const body = request.body as { path: string; content: string; baseSha?: string };
    const safePath = sanitizePath((body?.path ?? "").replace(/^\//, ""));
    if (!safePath) {
      reply.code(400).send({ error: { code: "bad_path", message: "Invalid path" } });
      return;
    }

    reply.send({ success: true, path: body.path, baseSha: body?.baseSha ?? null });
  });

  fastify.get("/fs/diff", async (request, reply) => {
    if (!requireSession(request, reply)) return;
    const query = request.query as { path?: string; baseSha?: string; targetSha?: string };
    reply.send({
      path: query.path,
      diff: "@@ -1,2 +1,2 @@\n- old line\n+ new line",
    });
  });
};
