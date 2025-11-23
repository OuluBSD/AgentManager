import type { FastifyPluginAsync } from "fastify";
import {
  addSnapshot,
  createProject,
  getProject,
  listProjects,
  listRoadmaps,
  listSnapshots,
  updateProject,
} from "../services/mockStore";
import { requireSession } from "../utils/auth";

export const projectRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get("/projects", async (request, reply) => {
    if (!requireSession(request, reply)) return;
    return listProjects();
  });

  fastify.post("/projects", async (request, reply) => {
    if (!requireSession(request, reply)) return;
    const project = createProject((request.body as Record<string, unknown>) ?? {});
    reply.code(201).send({ id: project.id });
  });

  fastify.patch("/projects/:projectId", async (request, reply) => {
    if (!requireSession(request, reply)) return;
    const projectId = request.params as { projectId: string };
    const updated = updateProject(projectId.projectId, (request.body as Record<string, unknown>) ?? {});
    if (!updated) {
      reply.code(404).send({ error: { code: "not_found", message: "Project not found" } });
      return;
    }
    reply.send(updated);
  });

  fastify.get("/projects/:projectId/details", async (request, reply) => {
    if (!requireSession(request, reply)) return;
    const projectId = (request.params as { projectId: string }).projectId;
    const project = getProject(projectId);
    if (!project) {
      reply.code(404).send({ error: { code: "not_found", message: "Project not found" } });
      return;
    }

    reply.send({
      project,
      roadmapLists: listRoadmaps(projectId),
    });
  });

  fastify.post("/projects/:projectId/snapshots", async (request, reply) => {
    if (!requireSession(request, reply)) return;
    const projectId = (request.params as { projectId: string }).projectId;
    const body = request.body as { message?: string };
    const snapshot = addSnapshot(projectId, `mock-${Date.now()}`, body?.message);
    reply.code(201).send({ gitSha: snapshot.gitSha, snapshot });
  });

  fastify.get("/projects/:projectId/snapshots", async (request, reply) => {
    if (!requireSession(request, reply)) return;
    const projectId = (request.params as { projectId: string }).projectId;
    const snapshots = listSnapshots(projectId);
    reply.send(snapshots);
  });
};
