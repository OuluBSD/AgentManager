/**
 * Auth repository adapter for JSON database
 * Provides same interface as authRepository.ts but uses JsonDatabase
 */
import crypto from "node:crypto";
import type { JsonDatabase, User, Session as JsonSession } from "./jsonDatabase";
import type { Session } from "../types";

const SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 7; // 7 days
const PBKDF2_ITERATIONS = 120000;
const PBKDF2_KEYLEN = 32;
const PBKDF2_DIGEST = "sha256";

function mapSession(sessionRow: JsonSession, userRow: User): Session {
  return { token: sessionRow.token, userId: userRow.id, username: userRow.username };
}

function legacyHash(value: string) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

function hashSecret(secret: string) {
  const salt = crypto.randomBytes(16).toString("hex");
  const derived = crypto
    .pbkdf2Sync(secret, salt, PBKDF2_ITERATIONS, PBKDF2_KEYLEN, PBKDF2_DIGEST)
    .toString("hex");
  return `pbkdf2_${PBKDF2_DIGEST}$${PBKDF2_ITERATIONS}$${salt}$${derived}`;
}

function verifySecret(secret: string, stored?: string | null) {
  if (!stored) return false;
  if (stored.startsWith("pbkdf2_")) {
    const [, iterations, salt, hash] = stored.split("$");
    if (!iterations || !salt || !hash) return false;
    const derived = crypto
      .pbkdf2Sync(secret, salt, Number(iterations), PBKDF2_KEYLEN, PBKDF2_DIGEST)
      .toString("hex");
    return crypto.timingSafeEqual(Buffer.from(hash, "hex"), Buffer.from(derived, "hex"));
  }
  // Legacy sha256 support
  return legacyHash(secret) === stored;
}

export async function getUserByUsername(db: JsonDatabase, username: string) {
  return await db.getUserByUsername(username);
}

export async function createUser(
  db: JsonDatabase,
  username: string,
  password?: string,
  isAdmin?: boolean
) {
  return await db.createUser({
    username,
    passwordHash: password ? hashSecret(password) : undefined,
    isAdmin: isAdmin ?? false,
  });
}

export async function updateUserPassword(db: JsonDatabase, userId: string, password: string) {
  const user = await db.getUserById(userId);
  if (!user) {
    throw new Error(`User not found: ${userId}`);
  }

  await db.updateUser(userId, { passwordHash: hashSecret(password) });
}

export async function updateUserKeyfile(db: JsonDatabase, userId: string, token: string) {
  const user = await db.getUserById(userId);
  if (!user) {
    throw new Error(`User not found: ${userId}`);
  }

  await db.updateUser(userId, { keyfilePath: hashSecret(token) });
}

export async function createSession(db: JsonDatabase, userId: string) {
  return await db.createSession({
    userId,
    token: crypto.randomUUID(),
    expiresAt: new Date(Date.now() + SESSION_TTL_MS),
  });
}

export async function deleteSession(db: JsonDatabase, token: string) {
  await db.deleteSession(token);
}

export async function purgeExpiredSessions(db: JsonDatabase) {
  await db.purgeExpiredSessions();
}

export async function getSessionWithUser(db: JsonDatabase, token: string): Promise<Session | null> {
  const session = await db.getSession(token);
  if (!session) return null;

  if (session.expiresAt && session.expiresAt.getTime() < Date.now()) {
    await deleteSession(db, token);
    return null;
  }

  const user = await db.getUserById(session.userId);
  if (!user) return null;

  return mapSession(session, user);
}

export function verifyPassword(password: string, passwordHash?: string | null) {
  if (!passwordHash) return true;
  return verifySecret(password, passwordHash);
}

export function verifyKeyfile(token: string, keyfileHash?: string | null) {
  if (!keyfileHash) return false;
  return verifySecret(token, keyfileHash);
}

export async function listUsers(db: JsonDatabase) {
  return await db.listUsers();
}

export async function deleteUser(db: JsonDatabase, username: string) {
  const user = await getUserByUsername(db, username);
  if (!user) {
    throw new Error(`User not found: ${username}`);
  }

  // Delete all sessions first
  await db.deleteUserSessions(user.id);

  // Delete user
  await db.deleteUser(username);
}

export async function changePassword(db: JsonDatabase, username: string, newPassword: string) {
  const user = await getUserByUsername(db, username);
  if (!user) {
    throw new Error(`User not found: ${username}`);
  }

  await updateUserPassword(db, user.id, newPassword);
}
