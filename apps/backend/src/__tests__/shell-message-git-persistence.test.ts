/**
 * Integration test for Shell message persistence using GitStorage
 *
 * This test verifies that tool messages (including Shell commands)
 * are properly persisted to JSONL files and can be retrieved after refresh.
 */

import { describe, test, before, after } from "node:test";
import assert from "node:assert";
import fs from "node:fs/promises";
import path from "node:path";
import { GitStorage } from "../services/gitStorage";
import type { Project, RoadmapList, Chat, Message, MetaChat } from "../types";

// Test configuration
const TEST_PROJECTS_ROOT = path.join(process.cwd(), "test-data", "shell-persistence-test");

describe("Shell Message Persistence (GitStorage)", () => {
  let gitStorage: GitStorage;
  let testProject: Project;
  let testRoadmap: RoadmapList;
  let testMetaChat: MetaChat;
  let testChat: Chat;

  before(async () => {
    // Clean up test directory before tests
    try {
      await fs.rm(TEST_PROJECTS_ROOT, { recursive: true, force: true });
    } catch {}

    gitStorage = new GitStorage({ projectsRoot: TEST_PROJECTS_ROOT });

    // Create test data
    testProject = {
      id: "shell-test-project",
      name: "Shell Test Project",
      status: "active",
    };

    testRoadmap = {
      id: "shell-test-roadmap",
      projectId: testProject.id,
      title: "Shell Test Roadmap",
      tags: ["testing"],
      progress: 0,
      status: "in_progress",
      metaChatId: "shell-test-meta",
    };

    testMetaChat = {
      id: "shell-test-meta",
      roadmapListId: testRoadmap.id,
      status: "in_progress",
      progress: 0,
    };

    testChat = {
      id: "shell-test-chat",
      roadmapListId: testRoadmap.id,
      title: "Shell Test Chat",
      status: "in_progress",
      progress: 0,
    };

    // Initialize project structure
    await gitStorage.initProject(testProject);
    await gitStorage.initRoadmap(testProject.id, testRoadmap, testMetaChat);
    await gitStorage.initChat(testProject.id, testRoadmap.id, testChat);
  });

  after(async () => {
    // Clean up test directory after tests
    try {
      await fs.rm(TEST_PROJECTS_ROOT, { recursive: true, force: true });
    } catch {}
  });

  test("should persist user, tool (Shell), and assistant messages", async () => {
    // Step 1: Add user message
    const userMessage: Message = {
      id: "msg-1",
      chatId: testChat.id,
      role: "user",
      content: "Please run 'uname -a'",
      createdAt: new Date().toISOString(),
    };

    await gitStorage.appendMessage(testProject.id, testRoadmap.id, testChat.id, userMessage);

    // Step 2: Add Shell/tool message (this is what the AI backend sends)
    const shellMessage: Message = {
      id: "msg-2",
      chatId: testChat.id,
      role: "tool",
      content: "Running\nuname -a",
      metadata: {
        displayRole: "Shell",
      },
      createdAt: new Date().toISOString(),
    };

    await gitStorage.appendMessage(testProject.id, testRoadmap.id, testChat.id, shellMessage);

    // Step 3: Add assistant message
    const assistantMessage: Message = {
      id: "msg-3",
      chatId: testChat.id,
      role: "assistant",
      content: "The command executed successfully. The output shows...",
      createdAt: new Date().toISOString(),
    };

    await gitStorage.appendMessage(testProject.id, testRoadmap.id, testChat.id, assistantMessage);

    // Step 4: Read messages back (simulating page refresh)
    const messages = await gitStorage.readMessages(testProject.id, testRoadmap.id, testChat.id);

    // Verify we have exactly 3 messages
    assert.strictEqual(
      messages.length,
      3,
      `Expected 3 messages but got ${messages.length}. Messages: ${JSON.stringify(messages, null, 2)}`
    );

    // Verify message order and content
    assert.strictEqual(messages[0].role, "user");
    assert.strictEqual(messages[0].content, "Please run 'uname -a'");

    assert.strictEqual(
      messages[1].role,
      "tool",
      `Expected role 'tool' but got '${messages[1].role}'`
    );
    assert.strictEqual(messages[1].content, "Running\nuname -a");
    assert.ok(messages[1].metadata, "Shell message should have metadata");
    assert.strictEqual(
      (messages[1].metadata as any).displayRole,
      "Shell",
      `Expected displayRole 'Shell' but got '${(messages[1].metadata as any)?.displayRole}'`
    );

    assert.strictEqual(messages[2].role, "assistant");
    assert.strictEqual(
      messages[2].content,
      "The command executed successfully. The output shows..."
    );
  });

  test("should preserve displayRole metadata for various tool types", async () => {
    const toolChat: Chat = {
      id: "tool-types-chat",
      roadmapListId: testRoadmap.id,
      title: "Tool Types Test",
      status: "in_progress",
      progress: 0,
    };

    await gitStorage.initChat(testProject.id, testRoadmap.id, toolChat);

    // Add multiple tool messages with different displayRoles
    const toolMessages: Message[] = [
      {
        id: "tool-1",
        chatId: toolChat.id,
        role: "tool",
        content: "ls -la",
        metadata: { displayRole: "Shell" },
        createdAt: new Date().toISOString(),
      },
      {
        id: "tool-2",
        chatId: toolChat.id,
        role: "tool",
        content: "Reading file.txt...",
        metadata: { displayRole: "Read" },
        createdAt: new Date().toISOString(),
      },
      {
        id: "tool-3",
        chatId: toolChat.id,
        role: "tool",
        content: "Writing to output.txt...",
        metadata: { displayRole: "Write" },
        createdAt: new Date().toISOString(),
      },
    ];

    for (const msg of toolMessages) {
      await gitStorage.appendMessage(testProject.id, testRoadmap.id, toolChat.id, msg);
    }

    // Read back and verify
    const messages = await gitStorage.readMessages(testProject.id, testRoadmap.id, toolChat.id);

    assert.strictEqual(messages.length, 3);
    assert.strictEqual((messages[0].metadata as any).displayRole, "Shell");
    assert.strictEqual((messages[1].metadata as any).displayRole, "Read");
    assert.strictEqual((messages[2].metadata as any).displayRole, "Write");
  });

  test("should handle tool messages without displayRole", async () => {
    const basicChat: Chat = {
      id: "basic-tool-chat",
      roadmapListId: testRoadmap.id,
      title: "Basic Tool Test",
      status: "in_progress",
      progress: 0,
    };

    await gitStorage.initChat(testProject.id, testRoadmap.id, basicChat);

    // Add tool message without displayRole
    const toolMessage: Message = {
      id: "basic-tool-1",
      chatId: basicChat.id,
      role: "tool",
      content: "Generic tool output",
      createdAt: new Date().toISOString(),
    };

    await gitStorage.appendMessage(testProject.id, testRoadmap.id, basicChat.id, toolMessage);

    const messages = await gitStorage.readMessages(testProject.id, testRoadmap.id, basicChat.id);
    assert.strictEqual(messages.length, 1);
    assert.strictEqual(messages[0].role, "tool");
    // metadata should either be undefined or an empty object
  });

  test("JSONL file contains all messages after write", async () => {
    // Create a fresh chat for this test
    const jsonlChat: Chat = {
      id: "jsonl-verify-chat",
      roadmapListId: testRoadmap.id,
      title: "JSONL Verification",
      status: "in_progress",
      progress: 0,
    };

    await gitStorage.initChat(testProject.id, testRoadmap.id, jsonlChat);

    // Add the 3 message sequence
    await gitStorage.appendMessage(testProject.id, testRoadmap.id, jsonlChat.id, {
      id: "jsonl-1",
      chatId: jsonlChat.id,
      role: "user",
      content: "Please run 'uname -a'",
      createdAt: new Date().toISOString(),
    });

    await gitStorage.appendMessage(testProject.id, testRoadmap.id, jsonlChat.id, {
      id: "jsonl-2",
      chatId: jsonlChat.id,
      role: "tool",
      content: "Running\nuname -a",
      metadata: { displayRole: "Shell" },
      createdAt: new Date().toISOString(),
    });

    await gitStorage.appendMessage(testProject.id, testRoadmap.id, jsonlChat.id, {
      id: "jsonl-3",
      chatId: jsonlChat.id,
      role: "assistant",
      content: "Command completed",
      createdAt: new Date().toISOString(),
    });

    // Read the JSONL file directly
    const messagesPath = path.join(
      TEST_PROJECTS_ROOT,
      testProject.id,
      "roadmaps",
      testRoadmap.id,
      "chats",
      jsonlChat.id,
      "messages.jsonl"
    );

    const fileContent = await fs.readFile(messagesPath, "utf-8");
    const lines = fileContent.trim().split("\n");

    assert.strictEqual(
      lines.length,
      3,
      `JSONL file should have 3 lines but has ${lines.length}. Content:\n${fileContent}`
    );

    // Verify each line is valid JSON and has correct structure
    const parsedMessages = lines.map((line) => JSON.parse(line));

    assert.strictEqual(parsedMessages[0].role, "user");
    assert.strictEqual(parsedMessages[1].role, "tool");
    assert.strictEqual((parsedMessages[1].metadata as any).displayRole, "Shell");
    assert.strictEqual(parsedMessages[2].role, "assistant");
  });
});
