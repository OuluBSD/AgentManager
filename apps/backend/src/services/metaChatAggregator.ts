import type { Database } from "./projectRepository";
import { eq } from "drizzle-orm";
import * as schema from "@nexus/shared/db/schema";

/**
 * Aggregates child chat statuses to compute meta-chat status and progress
 */
export async function aggregateChildChats(db: Database, roadmapId: string) {
  // Get all chats for this roadmap
  const chats = await db
    .select()
    .from(schema.chats)
    .where(eq(schema.chats.roadmapListId, roadmapId));

  if (chats.length === 0) {
    return {
      status: "idle" as const,
      progress: 0,
      summary: "No chats in this roadmap yet",
    };
  }

  // Calculate average progress
  const totalProgress = chats.reduce((sum, chat) => sum + Number(chat.progress ?? 0), 0);
  const avgProgress = totalProgress / chats.length;

  // Determine aggregate status based on child statuses
  const statuses = chats.map((chat) => chat.status ?? "in_progress");
  let aggregateStatus: string;

  if (statuses.every((status) => status === "done")) {
    aggregateStatus = "done";
  } else if (statuses.some((status) => status === "blocked")) {
    aggregateStatus = "blocked";
  } else if (statuses.some((status) => status === "error")) {
    aggregateStatus = "error";
  } else if (statuses.some((status) => status === "waiting")) {
    aggregateStatus = "waiting";
  } else if (statuses.some((status) => status === "in_progress")) {
    aggregateStatus = "in_progress";
  } else {
    aggregateStatus = "idle";
  }

  // Generate summary
  const doneCount = statuses.filter((s) => s === "done").length;
  const blockedCount = statuses.filter((s) => s === "blocked").length;
  const errorCount = statuses.filter((s) => s === "error").length;
  const inProgressCount = statuses.filter((s) => s === "in_progress").length;

  const summaryParts: string[] = [];
  if (doneCount > 0) summaryParts.push(`${doneCount} done`);
  if (inProgressCount > 0) summaryParts.push(`${inProgressCount} in progress`);
  if (blockedCount > 0) summaryParts.push(`${blockedCount} blocked`);
  if (errorCount > 0) summaryParts.push(`${errorCount} errors`);

  const summary = `${chats.length} total chats: ${summaryParts.join(", ")}`;

  return {
    status: aggregateStatus,
    progress: Number(avgProgress.toFixed(2)), // Round to 2 decimal places instead of integer
    summary,
  };
}

/**
 * Updates meta-chat with aggregated data from child chats
 */
export async function updateMetaChatFromChildren(db: Database, roadmapId: string) {
  const aggregated = await aggregateChildChats(db, roadmapId);

  // Get the meta-chat for this roadmap
  const [metaChat] = await db
    .select()
    .from(schema.metaChats)
    .where(eq(schema.metaChats.roadmapListId, roadmapId));

  if (!metaChat) {
    throw new Error(`No meta-chat found for roadmap ${roadmapId}`);
  }

  // Update meta-chat
  await db
    .update(schema.metaChats)
    .set({
      status: aggregated.status,
      progress: String(aggregated.progress),
      summary: aggregated.summary,
    })
    .where(eq(schema.metaChats.id, metaChat.id));

  // Also update the roadmap itself
  await db
    .update(schema.roadmapLists)
    .set({
      status: aggregated.status,
      progress: String(aggregated.progress),
      updatedAt: new Date(),
    })
    .where(eq(schema.roadmapLists.id, roadmapId));

  return aggregated;
}
