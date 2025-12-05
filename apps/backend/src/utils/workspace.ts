import path from "node:path";
import fs from "node:fs/promises";

const defaultProjectsRoot = path.resolve(process.cwd(), "projects");

export function getProjectsRoot() {
  return process.env.PROJECTS_ROOT ? path.resolve(process.env.PROJECTS_ROOT) : defaultProjectsRoot;
}

export function getProjectRoot(projectId: string) {
  return path.join(getProjectsRoot(), projectId);
}

export function getWorkspaceRoot(projectId: string) {
  return path.join(getProjectRoot(projectId), "workspace");
}

function pickWorkspaceRoot(projectId: string, contentPath?: string | null) {
  const trimmed = contentPath?.trim();
  if (trimmed) {
    return path.resolve(trimmed);
  }
  return getWorkspaceRoot(projectId);
}

export async function ensureWorkspaceRoot(projectId: string, contentPath?: string | null) {
  const workspaceRoot = pickWorkspaceRoot(projectId, contentPath);
  await fs.mkdir(workspaceRoot, { recursive: true });
  return workspaceRoot;
}

export function sanitizeWorkspacePath(
  projectId: string,
  inputPath: string | undefined,
  contentPath?: string | null
) {
  const workspaceRoot = pickWorkspaceRoot(projectId, contentPath);
  const normalized = path.normalize(path.join(workspaceRoot, inputPath ?? ""));
  if (!normalized.startsWith(workspaceRoot)) {
    return null;
  }
  return { workspaceRoot, absolutePath: normalized };
}

export async function resolveWorkspacePath(
  projectId: string,
  inputPath: string | undefined,
  contentPath?: string | null
) {
  const workspaceRoot = await ensureWorkspaceRoot(projectId, contentPath);
  const normalized = path.normalize(path.join(workspaceRoot, inputPath ?? ""));
  if (!normalized.startsWith(workspaceRoot)) {
    return null;
  }
  return { workspaceRoot, absolutePath: normalized };
}
