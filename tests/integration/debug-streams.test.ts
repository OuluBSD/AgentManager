// tests/integration/debug-streams.test.ts
// Integration tests for debug streaming commands

import { validate } from '../../src/parser/validator';
import { executeCommand } from '../../src/runtime/engine';
import { CommandAST } from '../../src/parser/grammar-parser';

describe('Debug Streaming Commands Integration Tests', () => {
  // Test streaming process logs
  test('should stream process logs successfully', async () => {
    // Create a command AST for: debug process logs --id test-process
    const commandAST: CommandAST = {
      type: 'Command',
      commandPath: ['debug', 'process', 'logs'],
      arguments: {
        named: { id: 'test-process' },
        positional: []
      },
      rawInput: 'debug process logs --id test-process'
    };

    // Validate the command
    const validated = validate(commandAST);
    expect(validated).toHaveProperty('commandId', 'debug.process.logs');
    expect(validated).toHaveProperty('flags.id', 'test-process');

    // Capture console.log calls to verify streaming events
    const originalConsoleLog = console.log;
    const logEvents: any[] = [];
    console.log = jest.fn((event) => {
      logEvents.push(JSON.parse(event));
    });

    try {
      // Execute the command
      const result = await executeCommand(validated as any);
      
      // Verify the result
      expect(result).toHaveProperty('status', 'ok');
      
      // Verify that streaming events were captured
      expect(logEvents.length).toBeGreaterThan(0);
      
      // Verify that at least one log event was emitted
      const logEventsFound = logEvents.filter(event => event.event === 'log');
      expect(logEventsFound.length).toBeGreaterThan(0);
      
      // Verify that an end event was emitted
      const endEvents = logEvents.filter(event => event.event === 'end');
      expect(endEvents.length).toBeGreaterThan(0);
    } finally {
      // Restore original console.log
      console.log = originalConsoleLog;
    }
  });

  // Test streaming WebSocket frames
  test('should stream WebSocket frames successfully', async () => {
    // Create a command AST for: debug websocket stream --id test-websocket
    const commandAST: CommandAST = {
      type: 'Command',
      commandPath: ['debug', 'websocket', 'stream'],
      arguments: {
        named: { id: 'test-websocket' },
        positional: []
      },
      rawInput: 'debug websocket stream --id test-websocket'
    };

    // Validate the command
    const validated = validate(commandAST);
    expect(validated).toHaveProperty('commandId', 'debug.websocket.stream');
    expect(validated).toHaveProperty('flags.id', 'test-websocket');

    // Capture console.log calls to verify streaming events
    const originalConsoleLog = console.log;
    const frameEvents: any[] = [];
    console.log = jest.fn((event) => {
      frameEvents.push(JSON.parse(event));
    });

    try {
      // Execute the command
      const result = await executeCommand(validated as any);
      
      // Verify the result
      expect(result).toHaveProperty('status', 'ok');
      
      // Verify that streaming events were captured
      expect(frameEvents.length).toBeGreaterThan(0);
      
      // Verify that at least one frame event was emitted
      const frameEventsFound = frameEvents.filter(event => event.event === 'frame');
      expect(frameEventsFound.length).toBeGreaterThan(0);
      
      // Verify that an end event was emitted
      const endEvents = frameEvents.filter(event => event.event === 'end');
      expect(endEvents.length).toBeGreaterThan(0);
    } finally {
      // Restore original console.log
      console.log = originalConsoleLog;
    }
  });

  // Test streaming poll events
  test('should stream poll events successfully', async () => {
    // Create a command AST for: debug poll stream --id test-poll
    const commandAST: CommandAST = {
      type: 'Command',
      commandPath: ['debug', 'poll', 'stream'],
      arguments: {
        named: { id: 'test-poll' },
        positional: []
      },
      rawInput: 'debug poll stream --id test-poll'
    };

    // Validate the command
    const validated = validate(commandAST);
    expect(validated).toHaveProperty('commandId', 'debug.poll.stream');
    expect(validated).toHaveProperty('flags.id', 'test-poll');

    // Capture console.log calls to verify streaming events
    const originalConsoleLog = console.log;
    const pollEvents: any[] = [];
    console.log = jest.fn((event) => {
      pollEvents.push(JSON.parse(event));
    });

    try {
      // Execute the command
      const result = await executeCommand(validated as any);
      
      // Verify the result
      expect(result).toHaveProperty('status', 'ok');
      
      // Verify that streaming events were captured
      expect(pollEvents.length).toBeGreaterThan(0);
      
      // Verify that at least one poll event was emitted
      const pollEventsFound = pollEvents.filter(event => event.event === 'poll');
      expect(pollEventsFound.length).toBeGreaterThan(0);
      
      // Verify that an end event was emitted
      const endEvents = pollEvents.filter(event => event.event === 'end');
      expect(endEvents.length).toBeGreaterThan(0);
    } finally {
      // Restore original console.log
      console.log = originalConsoleLog;
    }
  });

  // Test invalid ID handling
  test('should handle missing ID parameter for process logs', async () => {
    // Create a command AST for: debug process logs (missing --id)
    const commandAST: CommandAST = {
      type: 'Command',
      commandPath: ['debug', 'process', 'logs'],
      arguments: {
        named: {},
        positional: []
      },
      rawInput: 'debug process logs'
    };

    // Validate the command - should result in an error
    const validated = validate(commandAST);
    expect(validated).toHaveProperty('error', true);
    expect(validated).toHaveProperty('code', 'MISSING_REQUIRED_FLAG');
  });

  test('should handle missing ID parameter for websocket stream', async () => {
    // Create a command AST for: debug websocket stream (missing --id)
    const commandAST: CommandAST = {
      type: 'Command',
      commandPath: ['debug', 'websocket', 'stream'],
      arguments: {
        named: {},
        positional: []
      },
      rawInput: 'debug websocket stream'
    };

    // Validate the command - should result in an error
    const validated = validate(commandAST);
    expect(validated).toHaveProperty('error', true);
    expect(validated).toHaveProperty('code', 'MISSING_REQUIRED_FLAG');
  });

  test('should handle missing ID parameter for poll stream', async () => {
    // Create a command AST for: debug poll stream (missing --id)
    const commandAST: CommandAST = {
      type: 'Command',
      commandPath: ['debug', 'poll', 'stream'],
      arguments: {
        named: {},
        positional: []
      },
      rawInput: 'debug poll stream'
    };

    // Validate the command - should result in an error
    const validated = validate(commandAST);
    expect(validated).toHaveProperty('error', true);
    expect(validated).toHaveProperty('code', 'MISSING_REQUIRED_FLAG');
  });
});