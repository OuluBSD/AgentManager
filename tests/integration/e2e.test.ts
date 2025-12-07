// tests/integration/e2e.test.ts
// End-to-end integration tests for Nexus CLI commands

import { parseCommandLine } from '../../src/parser';
import { executeCommand } from '../../src/runtime';
import { ValidatedCommand } from '../../src/parser/validator';
import { registerCommandHandlers } from '../../src/commands';

// Register command handlers before running tests
registerCommandHandlers();

describe('End-to-End Integration Tests', () => {
  test('should execute agent project list command successfully', async () => {
    // Simulate the command: nexus agent project list
    const input = 'agent project list';
    
    // Parse and validate the command
    const validatedCommand: ValidatedCommand = parseCommandLine(input);
    
    // Verify the command was validated correctly 
    expect(validatedCommand.commandId).toBe('agent.project.list');
    expect(validatedCommand.namespace).toBe('agent');
    expect(validatedCommand.segments).toEqual(['project', 'list']);
    
    // Execute the command
    const result = await executeCommand(validatedCommand);
    
    // Verify the result structure
    expect(result).toHaveProperty('status');
    expect(result.status).toBe('ok');
    expect(result).toHaveProperty('data');
    expect(result).toHaveProperty('message');
    expect(result).toHaveProperty('errors');
    
    // Verify the data contains projects
    expect(result.data).toHaveProperty('projects');
    expect(Array.isArray(result.data.projects)).toBe(true);
    expect(result.data.projects.length).toBeGreaterThan(0);
    
    // Check that each project has required properties
    const firstProject = result.data.projects[0];
    expect(firstProject).toHaveProperty('id');
    expect(firstProject).toHaveProperty('name');
    expect(firstProject).toHaveProperty('status');
  });

  test('should execute agent project view command successfully', async () => {
    // Simulate the command: nexus agent project view --id proj-1
    const input = 'agent project view --id proj-1';
    
    // Parse and validate the command
    const validatedCommand: ValidatedCommand = parseCommandLine(input);
    
    // Verify the command was validated correctly
    expect(validatedCommand.commandId).toBe('agent.project.view');
    expect(validatedCommand.namespace).toBe('agent');
    expect(validatedCommand.segments).toEqual(['project', 'view']);
    expect(validatedCommand.flags).toHaveProperty('id');
    expect(validatedCommand.flags.id).toBe('proj-1');
    
    // Execute the command
    const result = await executeCommand(validatedCommand);
    
    // Verify the result structure
    expect(result).toHaveProperty('status');
    expect(result.status).toBe('ok');
    expect(result).toHaveProperty('data');
    expect(result).toHaveProperty('message');
    expect(result).toHaveProperty('errors');
    
    // Verify the data contains project details
    expect(result.data).toHaveProperty('project');
    expect(result.data.project).toHaveProperty('id');
    expect(result.data.project.id).toBe('proj-1');
    expect(result.data.project).toHaveProperty('name');
    expect(result.data.project).toHaveProperty('status');
    expect(result.data.project).toHaveProperty('roadmapLists');
  });

  test('should return error for unknown command', async () => {
    // Simulate an unknown command: nexus invalid namespace command
    const input = 'invalid namespace command';

    try {
      // This should throw an error since the command is invalid
      const validatedCommand: ValidatedCommand = parseCommandLine(input);

      // If we get here, it means the validation passed but execution should fail
      const result = await executeCommand(validatedCommand);

      // Verify the result is an error
      expect(result).toHaveProperty('status');
      expect(result.status).toBe('error');
      expect(result.data).toBeNull();
    } catch (error: any) {
      // If the error occurs during parsing/validation, that's also valid
      expect(error.message).toMatch(/(unknown|invalid|error)/i);
    }
  });

  test('should return error for command with missing required arguments', async () => {
    // Simulate the command: nexus agent project view (missing required id/name)
    const input = 'agent project view';

    try {
      // This should throw an error during validation because --id is required
      const validatedCommand: ValidatedCommand = parseCommandLine(input);

      // If validation passes, execution should fail due to missing id/name
      const result = await executeCommand(validatedCommand);

      // Should return an error
      expect(result).toHaveProperty('status');
      expect(result.status).toBe('error');
      expect(result.data).toBeNull();
    } catch (error: any) {
      // If the error occurs during parsing/validation, that's also valid
      expect(error.message).toMatch(/(required|missing|error)/i);
    }
  });

  test('should execute agent project list with filter flag', async () => {
    // Simulate the command: nexus agent project list --filter "Sample"
    const input = 'agent project list --filter "Sample"';

    // Parse and validate the command
    const validatedCommand: ValidatedCommand = parseCommandLine(input);

    // Verify the command was validated correctly
    expect(validatedCommand.commandId).toBe('agent.project.list');
    expect(validatedCommand.flags).toHaveProperty('filter');
    expect(validatedCommand.flags.filter).toBe('Sample');

    // Execute the command
    const result = await executeCommand(validatedCommand);

    // Verify the result structure
    expect(result.status).toBe('ok');
    expect(result.data).toHaveProperty('projects');
    expect(Array.isArray(result.data.projects)).toBe(true);

    // Projects should match the filter
    if (result.data.projects.length > 0) {
      const allMatchFilter = result.data.projects.every((project: any) =>
        project.name.toLowerCase().includes('sample') ||
        project.category.toLowerCase().includes('sample') ||
        project.description.toLowerCase().includes('sample')
      );
      expect(allMatchFilter).toBe(true);
    }
  });
});