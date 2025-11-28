import assert from "node:assert/strict";
import path from "node:path";
import { test } from "node:test";
import Fastify, { type FastifyInstance } from "fastify";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import { eq } from "drizzle-orm";
import * as schema from "@nexus/shared/db/schema";
import { templateRoutes } from "../routes/templates";
import { createSession, store } from "../services/mockStore";

async function buildDb() {
  const client = new PGlite();
  const db = drizzle(client, { schema });
  const migrationsFolder = path.resolve(
    new URL("../../../../packages/shared/db/migrations", import.meta.url).pathname
  );
  await migrate(db, { migrationsFolder });
  return { client, db };
}

function makeApp(db: ReturnType<typeof drizzle>) {
  const app = Fastify({ logger: false }) as FastifyInstance & { db: typeof db };
  app.db = db as any;
  return app;
}

test("templates API uses the database for list/create/update", async () => {
  const { client, db } = await buildDb();
  const app = makeApp(db);
  await app.register(templateRoutes);
  await app.ready();

  const session = createSession("db-templates");

  try {
    // Create a template
    const createRes = await app.inject({
      method: "POST",
      url: "/templates",
      headers: { "x-session-token": session.token },
      payload: {
        title: "Test Template",
        goal: "Test goal",
        systemPrompt: "Test system prompt",
        javascriptPrompt: "Test JS prompt",
        javascriptLogic: "return { status: 'done', progress: 100 };",
        jsonRequired: true,
      },
    });
    assert.equal(createRes.statusCode, 201);
    const createdId = (createRes.json() as { id: string }).id;
    assert.ok(createdId);

    // Verify template was created in the database
    const [createdRow] = await db
      .select()
      .from(schema.templates)
      .where(eq(schema.templates.id, createdId));
    assert.ok(createdRow, "created template persisted to database");
    assert.equal(createdRow.title, "Test Template");
    assert.equal(createdRow.goal, "Test goal");
    assert.equal(createdRow.systemPrompt, "Test system prompt");
    assert.equal(createdRow.javascriptPrompt, "Test JS prompt");
    assert.equal(createdRow.javascriptLogic, "return { status: 'done', progress: 100 };");
    assert.equal(createdRow.jsonRequired, true);

    // List templates
    const listRes = await app.inject({
      method: "GET",
      url: "/templates",
      headers: { "x-session-token": session.token },
    });
    assert.equal(listRes.statusCode, 200);
    const listed = listRes.json() as Array<{ id: string; title: string; goal?: string }>;
    assert.equal(listed.length, 1);
    assert.equal(listed[0].id, createdId);
    assert.equal(listed[0].title, "Test Template");
    assert.equal(listed[0].goal, "Test goal");

    // Update template
    const patchRes = await app.inject({
      method: "PATCH",
      url: `/templates/${createdId}`,
      headers: { "x-session-token": session.token },
      payload: { title: "Updated Template", goal: "Updated goal", jsonRequired: false },
    });
    assert.equal(patchRes.statusCode, 200);
    const patched = patchRes.json() as {
      id: string;
      title: string;
      goal: string;
      jsonRequired: boolean;
    };
    assert.equal(patched.title, "Updated Template");
    assert.equal(patched.goal, "Updated goal");
    assert.equal(patched.jsonRequired, false);

    // Verify update was persisted to database
    const [updatedRow] = await db
      .select()
      .from(schema.templates)
      .where(eq(schema.templates.id, createdId));
    assert.equal(updatedRow?.title, "Updated Template");
    assert.equal(updatedRow?.goal, "Updated goal");
    assert.equal(updatedRow?.jsonRequired, false);

    // Try to update a non-existent template
    const notFoundRes = await app.inject({
      method: "PATCH",
      url: `/templates/non-existent-id`,
      headers: { "x-session-token": session.token },
      payload: { title: "Should Not Work" },
    });
    assert.equal(notFoundRes.statusCode, 404);
  } finally {
    await app.close();
    await client.close();
    store.sessions.delete(session.token);
  }
});
