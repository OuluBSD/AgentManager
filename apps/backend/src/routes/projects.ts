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
import {
  dbAddSnapshot,
  dbCreateProject,
  dbListProjects,
  dbListSnapshots,
  dbProjectDetails,
  dbUpdateProject,
} from "../services/projectRepository";
import { requireSession } from "../utils/auth";

export const projectRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get("/projects", async (request, reply) => {
    if (!requireSession(request, reply)) return;
    if (fastify.db) {
      try {
        return await dbListProjects(fastify.db);
      } catch (err) {
        fastify.log.error({ err }, "Failed to list projects from database; falling back to memory.");
      }
    }
    return listProjects();
  });

  fastify.post("/projects", async (request, reply) => {
    if (!requireSession(request, reply)) return;
    if (fastify.db) {
      try {
        const project = await dbCreateProject(fastify.db, (request.body as Record<string, unknown>) ?? {});
        reply.code(201).send({ id: project.id });
        return;
      } catch (err) {
        fastify.log.error({ err }, "Failed to create project in database; using in-memory store.");
      }
    }

    const project = createProject((request.body as Record<string, unknown>) ?? {});
    reply.code(201).send({ id: project.id });
  });

  fastify.patch("/projects/:projectId", async (request, reply) => {
    if (!requireSession(request, reply)) return;
    const projectId = request.params as { projectId: string };
    if (fastify.db) {
      try {
        const updated = await dbUpdateProject(
          fastify.db,
          projectId.projectId,
          (request.body as Record<string, unknown>) ?? {},
        );
        if (!updated) {
          reply.code(404).send({ error: { code: "not_found", message: "Project not found" } });
          return;
        }
        reply.send(updated);
        return;
      } catch (err) {
        fastify.log.error({ err }, "Failed to update project in database; falling back to memory.");
      }
    }

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
    if (fastify.db) {
      try {
        const details = await dbProjectDetails(fastify.db, projectId);
        if (!details) {
          reply.code(404).send({ error: { code: "not_found", message: "Project not found" } });
          return;
        }
        reply.send(details);
        return;
      } catch (err) {
        fastify.log.error({ err }, "Failed to fetch project details from database; falling back to memory.");
      }
    }

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
    if (fastify.db) {
      try {
        const snapshot = await dbAddSnapshot(fastify.db, projectId, body?.message);
        reply.code(201).send({ gitSha: snapshot.gitSha, snapshot });
        return;
      } catch (err) {
        fastify.log.error({ err }, "Failed to add snapshot in database; falling back to memory.");
      }
    }

    const snapshot = addSnapshot(projectId, `mock-${Date.now()}`, body?.message);
    reply.code(201).send({ gitSha: snapshot.gitSha, snapshot });
  });

  fastify.get("/projects/:projectId/snapshots", async (request, reply) => {
    if (!requireSession(request, reply)) return;
    const projectId = (request.params as { projectId: string }).projectId;
    if (fastify.db) {
      try {
        const snapshots = await dbListSnapshots(fastify.db, projectId);
        reply.send(snapshots);
        return;
      } catch (err) {
        fastify.log.error({ err }, "Failed to read snapshots from database; falling back to memory.");
      }
    }

    reply.send(listSnapshots(projectId));
  });
};
