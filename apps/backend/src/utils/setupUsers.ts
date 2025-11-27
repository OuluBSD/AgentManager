/**
 * Setup users from environment variables on first run
 */
import {
  createUser as pgCreateUser,
  getUserByUsername as pgGetUserByUsername,
} from "../services/authRepository";
import type { Database } from "../services/authRepository";
import {
  createUser as jsonCreateUser,
  getUserByUsername as jsonGetUserByUsername,
} from "../services/jsonAuthRepository";
import type { JsonDatabase } from "../services/jsonDatabase";
import { createSession, store } from "../services/mockStore";
import crypto from "node:crypto";

/**
 * Create users in the in-memory store when no database is configured.
 * Note: These users will be lost on server restart.
 */
function setupInMemoryUsers(env: NodeJS.ProcessEnv, logger: any) {
  const adminUsername = env.SETUP_ADMIN_USERNAME;
  const adminPassword = env.SETUP_ADMIN_PASSWORD;
  const regularUsername = env.SETUP_REGULAR_USERNAME;
  const regularPassword = env.SETUP_REGULAR_PASSWORD;

  let usersCreated = false;

  // For in-memory mode, we store user credentials in a simple map
  // This is only for development/demo purposes
  if (!store.users) {
    (store as any).users = new Map<
      string,
      { username: string; passwordHash: string; isAdmin: boolean }
    >();
  }

  const users = (store as any).users;

  // Hash password (simple version for in-memory)
  const hashPassword = (password: string) =>
    crypto.createHash("sha256").update(password).digest("hex");

  // Create admin user
  if (adminUsername && adminPassword) {
    if (!users.has(adminUsername)) {
      users.set(adminUsername, {
        username: adminUsername,
        passwordHash: hashPassword(adminPassword),
        isAdmin: true,
      });
      logger.info(
        { username: adminUsername },
        "Admin user created in memory from setup configuration"
      );
      usersCreated = true;
    } else {
      logger.info({ username: adminUsername }, "Admin user already exists in memory");
    }
  }

  // Create regular user
  if (regularUsername && regularPassword) {
    if (!users.has(regularUsername)) {
      users.set(regularUsername, {
        username: regularUsername,
        passwordHash: hashPassword(regularPassword),
        isAdmin: false,
      });
      logger.info(
        { username: regularUsername },
        "Regular user created in memory from setup configuration"
      );
      usersCreated = true;
    } else {
      logger.info({ username: regularUsername }, "Regular user already exists in memory");
    }
  }

  if (usersCreated) {
    logger.warn(
      "Users created in memory (not persistent). On restart, you'll need to login again or reconfigure."
    );
  }
}

export async function setupUsersFromEnv(
  db: Database | undefined,
  jsonDb: JsonDatabase | undefined,
  env: NodeJS.ProcessEnv,
  logger: any
) {
  const adminUsername = env.SETUP_ADMIN_USERNAME;
  const adminPassword = env.SETUP_ADMIN_PASSWORD;
  const regularUsername = env.SETUP_REGULAR_USERNAME;
  const regularPassword = env.SETUP_REGULAR_PASSWORD;

  // If JSON database available, use it
  if (jsonDb) {
    let usersCreated = false;

    // Create admin user
    if (adminUsername && adminPassword) {
      try {
        const existing = await jsonGetUserByUsername(jsonDb, adminUsername);
        if (!existing) {
          await jsonCreateUser(jsonDb, adminUsername, adminPassword, true);
          logger.info(
            { username: adminUsername },
            "Admin user created in JSON database from setup configuration"
          );
          usersCreated = true;
        } else {
          logger.info({ username: adminUsername }, "Admin user already exists in JSON database");
        }
      } catch (err) {
        logger.error(
          { err, username: adminUsername },
          "Failed to create admin user in JSON database"
        );
      }
    }

    // Create regular user
    if (regularUsername && regularPassword) {
      try {
        const existing = await jsonGetUserByUsername(jsonDb, regularUsername);
        if (!existing) {
          await jsonCreateUser(jsonDb, regularUsername, regularPassword, false);
          logger.info(
            { username: regularUsername },
            "Regular user created in JSON database from setup configuration"
          );
          usersCreated = true;
        } else {
          logger.info(
            { username: regularUsername },
            "Regular user already exists in JSON database"
          );
        }
      } catch (err) {
        logger.error(
          { err, username: regularUsername },
          "Failed to create regular user in JSON database"
        );
      }
    }

    if (usersCreated) {
      logger.warn(
        "Users created in JSON database. You can now remove SETUP_*_USERNAME and SETUP_*_PASSWORD from your config file for security."
      );
    }
    return;
  }

  // If PostgreSQL database available, use it
  if (db) {
    let usersCreated = false;

    // Create admin user
    if (adminUsername && adminPassword) {
      try {
        const existing = await pgGetUserByUsername(db, adminUsername);
        if (!existing) {
          await pgCreateUser(db, adminUsername, adminPassword, true);
          logger.info({ username: adminUsername }, "Admin user created from setup configuration");
          usersCreated = true;
        } else {
          logger.info({ username: adminUsername }, "Admin user already exists, skipping creation");
        }
      } catch (err) {
        logger.error({ err, username: adminUsername }, "Failed to create admin user from setup");
      }
    }

    // Create regular user
    if (regularUsername && regularPassword) {
      try {
        const existing = await pgGetUserByUsername(db, regularUsername);
        if (!existing) {
          await pgCreateUser(db, regularUsername, regularPassword, false);
          logger.info(
            { username: regularUsername },
            "Regular user created from setup configuration"
          );
          usersCreated = true;
        } else {
          logger.info(
            { username: regularUsername },
            "Regular user already exists, skipping creation"
          );
        }
      } catch (err) {
        logger.error(
          { err, username: regularUsername },
          "Failed to create regular user from setup"
        );
      }
    }

    if (usersCreated) {
      logger.warn(
        "Users created from setup configuration. Please remove SETUP_*_USERNAME and SETUP_*_PASSWORD from your config file for security."
      );
    }
    return;
  }

  // No database available, use in-memory store
  setupInMemoryUsers(env, logger);
}
