import crypto from "node:crypto";
import { eq } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import * as schema from "@nexus/shared/db/schema";
import type { Session } from "../types";

export type Database = NodePgDatabase<typeof schema>;

const SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 7; // 7 days

function mapSession(
  sessionRow: typeof schema.sessions.$inferSelect,
  userRow: typeof schema.users.$inferSelect,
): Session {
  return { token: sessionRow.token, userId: userRow.id, username: userRow.username };
}

function hashPassword(password: string) {
  return crypto.createHash("sha256").update(password).digest("hex");
}

export async function getUserByUsername(db: Database, username: string) {
  const [row] = await db.select().from(schema.users).where(eq(schema.users.username, username));
  return row ?? null;
}

export async function createUser(db: Database, username: string, password?: string) {
  const [row] = await db
    .insert(schema.users)
    .values({ username, passwordHash: password ? hashPassword(password) : undefined })
    .returning();
  return row;
}

export async function updateUserPassword(db: Database, userId: string, password: string) {
  await db
    .update(schema.users)
    .set({ passwordHash: hashPassword(password) })
    .where(eq(schema.users.id, userId));
}

export async function createSession(db: Database, userId: string) {
  const [row] = await db
    .insert(schema.sessions)
    .values({
      userId,
      token: crypto.randomUUID(),
      expiresAt: new Date(Date.now() + SESSION_TTL_MS),
    })
    .returning();
  return row;
}

export async function deleteSession(db: Database, token: string) {
  await db.delete(schema.sessions).where(eq(schema.sessions.token, token));
}

export async function getSessionWithUser(db: Database, token: string): Promise<Session | null> {
  const [row] = await db
    .select({
      session: schema.sessions,
      user: schema.users,
    })
    .from(schema.sessions)
    .leftJoin(schema.users, eq(schema.sessions.userId, schema.users.id))
    .where(eq(schema.sessions.token, token));

  if (!row?.session || !row.user) return null;
  if (row.session.expiresAt && row.session.expiresAt.getTime() < Date.now()) {
    await deleteSession(db, token);
    return null;
  }
  return mapSession(row.session, row.user);
}

export function verifyPassword(password: string, passwordHash?: string | null) {
  if (!passwordHash) return true;
  return hashPassword(password) === passwordHash;
}
