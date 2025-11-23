import crypto from "node:crypto";
import { eq } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import * as schema from "@nexus/shared/db/schema";
import type { Project, RoadmapList, Snapshot } from "../types";

export type Database = NodePgDatabase<typeof schema>;

type ProjectInput = Partial<Project>;

function mapProject(row: typeof schema.projects.$inferSelect): Project {
  return {
    id: row.id,
    name: row.name,
    description: row.description ?? undefined,
    category: row.category ?? undefined,
    status: row.status ?? "active",
    theme: (row.theme as Record<string, unknown> | null) ?? undefined,
  };
}

function mapRoadmap(row: typeof schema.roadmapLists.$inferSelect): RoadmapList {
  return {
    id: row.id,
    projectId: row.projectId,
    title: row.title,
    tags: row.tags ? row.tags.split(",").map((tag) => tag.trim()).filter(Boolean) : [],
    progress: Number(row.progress ?? 0),
    status: row.status ?? "in_progress",
    metaChatId: row.metaChatId ?? undefined,
  };
}

function mapSnapshot(row: typeof schema.snapshots.$inferSelect): Snapshot {
  return {
    id: row.id,
    projectId: row.projectId,
    gitSha: row.gitSha,
    message: row.message ?? undefined,
    createdAt: row.createdAt?.toISOString?.() ?? new Date().toISOString(),
  };
}

export async function dbListProjects(db: Database): Promise<Project[]> {
  const rows = await db.select().from(schema.projects);
  return rows.map(mapProject);
}

export async function dbGetProject(db: Database, projectId: string): Promise<Project | null> {
  const [row] = await db.select().from(schema.projects).where(eq(schema.projects.id, projectId));
  return row ? mapProject(row) : null;
}

export async function dbCreateProject(db: Database, payload: ProjectInput): Promise<Project> {
  const [row] = await db
    .insert(schema.projects)
    .values({
      name: payload.name ?? "Untitled Project",
      description: payload.description,
      category: payload.category,
      status: payload.status ?? "active",
      theme: payload.theme as Record<string, unknown> | undefined,
    })
    .returning();
  return mapProject(row);
}

export async function dbUpdateProject(
  db: Database,
  projectId: string,
  patch: ProjectInput,
): Promise<Project | null> {
  const [row] = await db
    .update(schema.projects)
    .set({
      name: patch.name,
      description: patch.description,
      category: patch.category,
      status: patch.status,
      theme: patch.theme as Record<string, unknown> | undefined,
      updatedAt: new Date(),
    })
    .where(eq(schema.projects.id, projectId))
    .returning();
  return row ? mapProject(row) : null;
}

export async function dbListRoadmaps(
  db: Database,
  projectId: string,
): Promise<RoadmapList[]> {
  const rows = await db
    .select()
    .from(schema.roadmapLists)
    .where(eq(schema.roadmapLists.projectId, projectId));
  return rows.map(mapRoadmap);
}

export async function dbAddSnapshot(
  db: Database,
  projectId: string,
  message?: string,
): Promise<Snapshot> {
  const [row] = await db
    .insert(schema.snapshots)
    .values({
      projectId,
      message,
      gitSha: crypto.randomBytes(20).toString("hex"),
    })
    .returning();
  return mapSnapshot(row);
}

export async function dbListSnapshots(db: Database, projectId: string): Promise<Snapshot[]> {
  const rows = await db
    .select()
    .from(schema.snapshots)
    .where(eq(schema.snapshots.projectId, projectId));
  return rows.map(mapSnapshot);
}

export async function dbProjectDetails(db: Database, projectId: string) {
  const project = await dbGetProject(db, projectId);
  if (!project) return null;
  const roadmapLists = await dbListRoadmaps(db, projectId);
  return { project, roadmapLists };
}
