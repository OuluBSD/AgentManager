import assert from "node:assert/strict";
import crypto from "node:crypto";
import { test } from "node:test";
import {
  createChat,
  findChatForMerge,
  store,
  createProject,
  getProject,
  listProjects,
  updateProject,
  createRoadmap,
  listRoadmaps,
  updateRoadmap,
  getRoadmap,
  createTemplate,
  getTemplate,
  listTemplates,
  updateTemplate,
  addMessage,
  getMessages,
  createTerminalSession,
  syncMetaFromChats,
  restoreProject,
} from "../services/mockStore";

test("findChatForMerge handles trimmed identifiers and case-insensitive titles", () => {
  const roadmapId = crypto.randomUUID();
  store.roadmapLists.set(roadmapId, {
    id: roadmapId,
    projectId: crypto.randomUUID(),
    title: "Mock Finder Roadmap",
    tags: ["merge"],
    progress: 0,
    status: "in_progress",
  });

  const sourceChat = createChat(roadmapId, { title: "Source Chat" });
  const targetChat = createChat(roadmapId, { title: "Title Mixer" });

  const foundById = findChatForMerge(roadmapId, `  ${targetChat.id}  `, sourceChat.id);
  assert.equal(foundById?.id, targetChat.id);

  const foundByTitle = findChatForMerge(roadmapId, "  TITLE MIXER  ", sourceChat.id);
  assert.equal(foundByTitle?.id, targetChat.id);

  const skipSelfMatch = findChatForMerge(roadmapId, sourceChat.id, sourceChat.id);
  assert.equal(skipSelfMatch, null);

  store.chats.delete(sourceChat.id);
  store.chats.delete(targetChat.id);
  store.messages.delete(sourceChat.id);
  store.messages.delete(targetChat.id);
  store.roadmapLists.delete(roadmapId);
});

test("mock store project functions work correctly", () => {
  // Test createProject
  const project = createProject({ name: "Test Project", category: "Test" });
  assert.ok(project.id);
  assert.equal(project.name, "Test Project");
  assert.equal(project.category, "Test");

  // Test getProject
  const retrievedProject = getProject(project.id);
  assert.equal(retrievedProject?.id, project.id);
  assert.equal(retrievedProject?.name, "Test Project");

  // Test listProjects
  const projects = listProjects();
  const projectExists = projects.some((p) => p.id === project.id);
  assert.ok(projectExists, "Project should be in the list");

  // Test updateProject
  const updatedProject = updateProject(project.id, { name: "Updated Project" });
  assert.equal(updatedProject?.name, "Updated Project");

  // Clean up
  store.projects.delete(project.id);
});

test("mock store roadmap functions work correctly", () => {
  // Create a project first
  const project = createProject({ name: "Test Project for Roadmap" });

  // Test createRoadmap
  const result = createRoadmap(project.id, { title: "Test Roadmap", tags: ["test"] });
  const roadmap = result.roadmap;
  assert.ok(roadmap.id);
  assert.equal(roadmap.title, "Test Roadmap");
  assert.equal(roadmap.tags.length, 1);
  assert.equal(roadmap.tags[0], "test");

  // Test listRoadmaps
  const roadmaps = listRoadmaps(project.id);
  assert.equal(roadmaps.length, 1);
  assert.equal(roadmaps[0].id, roadmap.id);

  // Test getRoadmap
  const retrievedRoadmap = getRoadmap(roadmap.id);
  assert.equal(retrievedRoadmap?.id, roadmap.id);

  // Test updateRoadmap
  const updatedRoadmap = updateRoadmap(roadmap.id, { title: "Updated Roadmap" });
  assert.equal(updatedRoadmap?.title, "Updated Roadmap");

  // Clean up
  store.roadmapLists.delete(roadmap.id);
  store.metaChats.delete(result.meta.id);
  store.projects.delete(project.id);
});

test("mock store template functions work correctly", () => {
  // Test createTemplate
  const template = createTemplate({
    title: "Test Template",
    goal: "Test goal",
    jsonRequired: true,
  });
  assert.ok(template.id);
  assert.equal(template.title, "Test Template");
  assert.ok(template.jsonRequired);

  // Test getTemplate
  const retrievedTemplate = getTemplate(template.id);
  assert.equal(retrievedTemplate?.id, template.id);
  assert.equal(retrievedTemplate?.title, "Test Template");

  // Test listTemplates
  const templates = listTemplates();
  const templateExists = templates.some((t) => t.id === template.id);
  assert.ok(templateExists, "Template should be in the list");

  // Test updateTemplate
  const updatedTemplate = updateTemplate(template.id, { title: "Updated Template" });
  assert.equal(updatedTemplate?.title, "Updated Template");

  // Clean up
  store.templates.delete(template.id);
});

test("mock store message functions work correctly", () => {
  // Create a project and roadmap first
  const project = createProject({ name: "Test Project for Messages" });
  const roadmapResult = createRoadmap(project.id, { title: "Test Roadmap for Messages" });
  const chat = createChat(roadmapResult.roadmap.id, { title: "Test Chat" });

  // Test addMessage
  const message = addMessage(chat.id, {
    role: "user",
    content: "Test message content",
    chatId: chat.id,
  });
  assert.ok(message.id);
  assert.equal(message.content, "Test message content");

  // Test getMessages
  const messages = getMessages(chat.id);
  assert.equal(messages.length, 1);
  assert.equal(messages[0].id, message.id);

  // Clean up
  store.messages.delete(chat.id);
  store.chats.delete(chat.id);
  store.roadmapLists.delete(roadmapResult.roadmap.id);
  store.metaChats.delete(roadmapResult.meta.id);
  store.projects.delete(project.id);
});

test("mock store terminal session function works correctly", () => {
  // Test createTerminalSession
  const session = createTerminalSession("test-project-id", "/path/to/dir");
  assert.ok(session.id);
  assert.equal(session.projectId, "test-project-id");
  assert.equal(session.cwd, "/path/to/dir");

  // Clean up
  store.terminalSessions.delete(session.id);
});

test("mock store syncMetaFromChats function works correctly", () => {
  // Create a project and roadmap first
  const project = createProject({ name: "Test Project for Sync" });
  const roadmapResult = createRoadmap(project.id, { title: "Test Roadmap for Sync" });
  const roadmap = roadmapResult.roadmap;
  const metaChat = roadmapResult.meta;

  // Create chats with different statuses and progress
  const chat1 = createChat(roadmap.id, {
    title: "Chat 1",
    status: "in_progress",
    progress: 0.3,
  });
  const chat2 = createChat(roadmap.id, {
    title: "Chat 2",
    status: "done",
    progress: 1.0,
  });

  // Test syncMetaFromChats
  const result = syncMetaFromChats(roadmap.id);

  // With 2 chats at 30% and 100%, average should be 65%
  assert.ok(result);
  assert.equal(result?.progress, 0.65); // (0.3 + 1.0) / 2 = 0.65
  // Status should be "in_progress" since one chat is still in_progress
  assert.equal(result?.status, "in_progress");

  // Clean up
  store.chats.delete(chat1.id);
  store.chats.delete(chat2.id);
  store.messages.delete(chat1.id);
  store.messages.delete(chat2.id);
  store.roadmapLists.delete(roadmap.id);
  store.metaChats.delete(metaChat.id);
  store.projects.delete(project.id);
});

test("mock store restoreProject function works correctly", () => {
  const projectId = crypto.randomUUID();

  // Test creating a new project with restoreProject
  const project = restoreProject({
    id: projectId,
    name: "Restored Project",
    status: "active",
    description: "A project restored from git",
  });

  assert.equal(project.id, projectId);
  assert.equal(project.name, "Restored Project");
  assert.equal(project.status, "active");
  assert.equal(project.description, "A project restored from git");

  // Verify it exists in store
  const retrieved = getProject(projectId);
  assert.equal(retrieved?.name, "Restored Project");

  // Test updating an existing project with restoreProject
  const updatedProject = restoreProject({
    id: projectId,
    name: "Updated Restored Project",
    status: "inactive",
  });

  assert.equal(updatedProject.name, "Updated Restored Project");
  assert.equal(updatedProject.status, "inactive");

  // Verify the update in store
  const updatedRetrieved = getProject(projectId);
  assert.equal(updatedRetrieved?.name, "Updated Restored Project");
  assert.equal(updatedRetrieved?.status, "inactive");

  // Clean up
  store.projects.delete(projectId);
});
