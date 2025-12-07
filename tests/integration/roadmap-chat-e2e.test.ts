// tests/integration/roadmap-chat-e2e.test.ts
// End-to-end integration tests for roadmap and chat commands

import { parseCommandLine } from '../../src/parser';
import { executeCommand } from '../../src/runtime';
import { ValidatedCommand } from '../../src/parser/validator';
import { registerCommandHandlers } from '../../src/commands';

// Register command handlers before running tests
registerCommandHandlers();

describe('Roadmap & Chat Commands End-to-End Integration Tests', () => {
  test('should select project and list roadmaps successfully', async () => {
    // First select a project
    const selectProjectInput = 'agent project select --id proj-1';
    const selectProjectValidated: ValidatedCommand = parseCommandLine(selectProjectInput);
    const selectProjectResult = await executeCommand(selectProjectValidated);
    
    expect(selectProjectResult.status).toBe('ok');
    expect(selectProjectResult.data).toHaveProperty('project');
    expect(selectProjectResult.data.project.id).toBe('proj-1');
    
    // Then list roadmaps for the selected project
    const listRoadmapsInput = 'agent roadmap list';
    const listRoadmapsValidated: ValidatedCommand = parseCommandLine(listRoadmapsInput);
    const listRoadmapsResult = await executeCommand(listRoadmapsValidated);
    
    expect(listRoadmapsResult.status).toBe('ok');
    expect(listRoadmapsResult.data).toHaveProperty('roadmaps');
    expect(Array.isArray(listRoadmapsResult.data.roadmaps)).toBe(true);
    expect(listRoadmapsResult.data.roadmaps.length).toBeGreaterThan(0);
  });

  test('should execute roadmap view command successfully', async () => {
    const input = 'agent roadmap view --id rm-proj-1-1';
    const validatedCommand: ValidatedCommand = parseCommandLine(input);
    
    // Verify the command was validated correctly
    expect(validatedCommand.commandId).toBe('agent.roadmap.view');
    
    // Execute the command
    const result = await executeCommand(validatedCommand);
    
    // Verify the result structure
    expect(result.status).toBe('ok');
    expect(result.data).toHaveProperty('roadmap');
    expect(result.data.roadmap).toHaveProperty('id');
    expect(result.data.roadmap.id).toBe('rm-proj-1-1');
    expect(result.data.roadmap).toHaveProperty('title');
  });

  test('should execute roadmap select command successfully', async () => {
    // First select a project
    const selectProjectInput = 'agent project select --id proj-1';
    const selectProjectValidated: ValidatedCommand = parseCommandLine(selectProjectInput);
    await executeCommand(selectProjectValidated);
    
    // Then select a roadmap
    const input = 'agent roadmap select --id rm-proj-1-1';
    const validatedCommand: ValidatedCommand = parseCommandLine(input);
    
    // Verify the command was validated correctly
    expect(validatedCommand.commandId).toBe('agent.roadmap.select');
    
    // Execute the command
    const result = await executeCommand(validatedCommand);
    
    // Verify the result structure
    expect(result.status).toBe('ok');
    expect(result.data).toHaveProperty('roadmap');
    expect(result.data.roadmap.id).toBe('rm-proj-1-1');
    expect(result.data).toHaveProperty('context');
    expect(result.data.context.roadmapId).toBe('rm-proj-1-1');
    expect(result.data.context.projectId).toBe('proj-1');
  });

  test('should execute chat list command successfully', async () => {
    // First select a project
    const selectProjectInput = 'agent project select --id proj-1';
    const selectProjectValidated: ValidatedCommand = parseCommandLine(selectProjectInput);
    await executeCommand(selectProjectValidated);
    
    // Then select a roadmap
    const selectRoadmapInput = 'agent roadmap select --id rm-proj-1-1';
    const selectRoadmapValidated: ValidatedCommand = parseCommandLine(selectRoadmapInput);
    await executeCommand(selectRoadmapValidated);
    
    // Now list chats for the selected roadmap
    const input = 'agent chat list';
    const validatedCommand: ValidatedCommand = parseCommandLine(input);
    
    // Verify the command was validated correctly
    expect(validatedCommand.commandId).toBe('agent.chat.list');
    
    // Execute the command
    const result = await executeCommand(validatedCommand);
    
    // Verify the result structure
    expect(result.status).toBe('ok');
    expect(result.data).toHaveProperty('chats');
    expect(Array.isArray(result.data.chats)).toBe(true);
    expect(result.data.chats.length).toBeGreaterThan(0);
  });

  test('should execute chat view command successfully', async () => {
    const input = 'agent chat view --id chat-rm-proj-1-1-1';
    const validatedCommand: ValidatedCommand = parseCommandLine(input);
    
    // Verify the command was validated correctly
    expect(validatedCommand.commandId).toBe('agent.chat.view');
    
    // Execute the command
    const result = await executeCommand(validatedCommand);
    
    // Verify the result structure
    expect(result.status).toBe('ok');
    expect(result.data).toHaveProperty('chat');
    expect(result.data.chat).toHaveProperty('id');
    expect(result.data.chat.id).toBe('chat-rm-proj-1-1-1');
    expect(result.data.chat).toHaveProperty('title');
  });

  test('should execute chat select command successfully', async () => {
    // First select a project
    const selectProjectInput = 'agent project select --id proj-1';
    const selectProjectValidated: ValidatedCommand = parseCommandLine(selectProjectInput);
    await executeCommand(selectProjectValidated);
    
    // Then select a roadmap
    const selectRoadmapInput = 'agent roadmap select --id rm-proj-1-1';
    const selectRoadmapValidated: ValidatedCommand = parseCommandLine(selectRoadmapInput);
    await executeCommand(selectRoadmapValidated);
    
    // Now select a chat
    const input = 'agent chat select --id chat-rm-proj-1-1-1';
    const validatedCommand: ValidatedCommand = parseCommandLine(input);
    
    // Verify the command was validated correctly
    expect(validatedCommand.commandId).toBe('agent.chat.select');
    
    // Execute the command
    const result = await executeCommand(validatedCommand);
    
    // Verify the result structure
    expect(result.status).toBe('ok');
    expect(result.data).toHaveProperty('chat');
    expect(result.data.chat.id).toBe('chat-rm-proj-1-1-1');
    expect(result.data).toHaveProperty('context');
    expect(result.data.context.chatId).toBe('chat-rm-proj-1-1-1');
    expect(result.data.context.roadmapId).toBe('rm-proj-1-1');
    expect(result.data.context.projectId).toBe('proj-1');
  });

  test('should return error for roadmap list without project context', async () => {
    // Try to list roadmaps without selecting a project
    const input = 'agent roadmap list';
    const validatedCommand: ValidatedCommand = parseCommandLine(input);

    // Execute the command
    const result = await executeCommand(validatedCommand);

    // Verify it returns an error for missing context
    expect(result.status).toBe('error');
    expect(result.message).toContain('Missing required context');
    expect(result.errors).toBeInstanceOf(Array);
    expect(result.errors.length).toBeGreaterThan(0);
    expect(result.errors[0]?.type).toBe('MISSING_REQUIRED_CONTEXT');
  });

  test('should return error for chat list without roadmap context', async () => {
    // First select a project to satisfy the project requirement
    const selectProjectInput = 'agent project select --id proj-2';
    const selectProjectValidated: ValidatedCommand = parseCommandLine(selectProjectInput);
    await executeCommand(selectProjectValidated);

    // Try to list chats without selecting a roadmap
    const input = 'agent chat list';
    const validatedCommand: ValidatedCommand = parseCommandLine(input);

    // Execute the command
    const result = await executeCommand(validatedCommand);

    // Verify it returns an error for missing context
    expect(result.status).toBe('error');
    expect(result.message).toContain('Missing required context');
    expect(result.errors).toBeInstanceOf(Array);
    expect(result.errors.length).toBeGreaterThan(0);
    expect(result.errors[0]?.type).toBe('MISSING_REQUIRED_CONTEXT');
  });

  test('should return current project context when using project current command', async () => {
    // First select a project
    const selectProjectInput = 'agent project select --id proj-1';
    const selectProjectValidated: ValidatedCommand = parseCommandLine(selectProjectInput);
    await executeCommand(selectProjectValidated);
    
    // Then use project current command
    const input = 'agent project current';
    const validatedCommand: ValidatedCommand = parseCommandLine(input);
    
    // Execute the command
    const result = await executeCommand(validatedCommand);
    
    // Verify the result structure
    expect(result.status).toBe('ok');
    expect(result.data).toHaveProperty('project');
    expect(result.data.project.id).toBe('proj-1');
    expect(result.data).toHaveProperty('context');
    expect(result.data.context.projectId).toBe('proj-1');
  });

  test('should list roadmaps with explicit project-id override', async () => {
    const input = 'agent roadmap list --project-id proj-2';
    const validatedCommand: ValidatedCommand = parseCommandLine(input);
    
    // Execute the command
    const result = await executeCommand(validatedCommand);
    
    // Verify the result structure
    expect(result.status).toBe('ok');
    expect(result.data).toHaveProperty('roadmaps');
    expect(Array.isArray(result.data.roadmaps)).toBe(true);
    expect(result.data.roadmaps.length).toBeGreaterThan(0);
  });
});