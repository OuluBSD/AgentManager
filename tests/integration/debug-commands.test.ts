// tests/integration/debug-commands.test.ts
// Integration tests for Debug Commands

import { DebugProcessListHandler } from '../../src/commands/debug/process/list';
import { DebugProcessViewHandler } from '../../src/commands/debug/process/view';
import { DebugWebSocketListHandler } from '../../src/commands/debug/websocket/list';
import { DebugWebSocketViewHandler } from '../../src/commands/debug/websocket/view';
import { DebugPollListHandler } from '../../src/commands/debug/poll/list';
import { DebugPollViewHandler } from '../../src/commands/debug/poll/view';

// Mock context for testing
const mockContext = {
  args: {},
  flags: {},
  contextState: {
    activeProjectId: 'test-project',
    activeProjectName: 'Test Project',
    activeRoadmapId: 'test-roadmap',
    activeRoadmapTitle: 'Test Roadmap',
    activeChatId: 'test-chat',
    activeChatTitle: 'Test Chat',
    selectedAiSessionId: null,
    selectedNetworkElementId: null,
    lastUpdate: new Date().toISOString()
  },
  config: {}
};

describe('Debug Commands', () => {
  describe('Debug Process List', () => {
    test('should list processes', async () => {
      const handler = new DebugProcessListHandler();
      const result = await handler.execute(mockContext);

      expect(result.status).toBe('ok');
      expect(result.data).toHaveProperty('processes');
      expect(Array.isArray(result.data.processes)).toBe(true);
      expect(result.message).toBe('Processes retrieved successfully');
    });

    test('should list processes with filters', async () => {
      const contextWithFilters = {
        ...mockContext,
        flags: { 'filter-type': 'qwen', 'filter-status': 'running' }
      };

      const handler = new DebugProcessListHandler();
      const result = await handler.execute(contextWithFilters);

      expect(result.status).toBe('ok');
      expect(result.data).toHaveProperty('processes');
      expect(Array.isArray(result.data.processes)).toBe(true);
    });
  });

  describe('Debug Process View', () => {
    test('should view a specific process', async () => {
      const contextWithId = {
        ...mockContext,
        flags: { id: 'process-1' }
      };

      const handler = new DebugProcessViewHandler();
      const result = await handler.execute(contextWithId);

      expect(result.status).toBe('ok');
      expect(result.data).toHaveProperty('process');
      expect(result.data.process).not.toBeNull();
      expect(result.data.process.id).toBe('process-1');
      expect(result.message).toContain('Process process-1 retrieved successfully');
    });

    test('should return error for non-existent process', async () => {
      const contextWithInvalidId = {
        ...mockContext,
        flags: { id: 'non-existent-process' }
      };

      const handler = new DebugProcessViewHandler();
      const result = await handler.execute(contextWithInvalidId);

      expect(result.status).toBe('error');
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0]).toHaveProperty('code');
      expect(result.errors[0].code).toBe('NOT_FOUND');
      expect(result.errors[0].id).toBe('non-existent-process');
    });

    test('should return error when missing required --id flag', async () => {
      const handler = new DebugProcessViewHandler();
      const result = await handler.execute(mockContext);

      expect(result.status).toBe('error');
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].message).toBe('Missing required flag: --id');
      expect(result.errors[0]).toHaveProperty('code');
      expect(result.errors[0].code).toBe('MISSING_REQUIRED_FLAG');
    });
  });

  describe('Debug WebSocket List', () => {
    test('should list websockets', async () => {
      const handler = new DebugWebSocketListHandler();
      const result = await handler.execute(mockContext);

      expect(result.status).toBe('ok');
      expect(result.data).toHaveProperty('websockets');
      expect(Array.isArray(result.data.websockets)).toBe(true);
      expect(result.message).toBe('WebSockets retrieved successfully');
    });

    test('should list websockets with filters', async () => {
      const contextWithFilters = {
        ...mockContext,
        flags: { 'filter-type': 'qwen', 'filter-status': 'open' }
      };

      const handler = new DebugWebSocketListHandler();
      const result = await handler.execute(contextWithFilters);

      expect(result.status).toBe('ok');
      expect(result.data).toHaveProperty('websockets');
      expect(Array.isArray(result.data.websockets)).toBe(true);
    });
  });

  describe('Debug WebSocket View', () => {
    test('should view a specific websocket', async () => {
      const contextWithId = {
        ...mockContext,
        flags: { id: 'websocket-1' }
      };

      const handler = new DebugWebSocketViewHandler();
      const result = await handler.execute(contextWithId);

      expect(result.status).toBe('ok');
      expect(result.data).toHaveProperty('websocket');
      expect(result.data.websocket).not.toBeNull();
      expect(result.data.websocket.id).toBe('websocket-1');
      expect(result.message).toContain('WebSocket websocket-1 retrieved successfully');
    });

    test('should return error for non-existent websocket', async () => {
      const contextWithInvalidId = {
        ...mockContext,
        flags: { id: 'non-existent-websocket' }
      };

      const handler = new DebugWebSocketViewHandler();
      const result = await handler.execute(contextWithInvalidId);

      expect(result.status).toBe('error');
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0]).toHaveProperty('code');
      expect(result.errors[0].code).toBe('NOT_FOUND');
      expect(result.errors[0].id).toBe('non-existent-websocket');
    });

    test('should return error when missing required --id flag', async () => {
      const handler = new DebugWebSocketViewHandler();
      const result = await handler.execute(mockContext);

      expect(result.status).toBe('error');
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].message).toBe('Missing required flag: --id');
      expect(result.errors[0]).toHaveProperty('code');
      expect(result.errors[0].code).toBe('MISSING_REQUIRED_FLAG');
    });
  });

  describe('Debug Poll List', () => {
    test('should list poll sessions', async () => {
      const handler = new DebugPollListHandler();
      const result = await handler.execute(mockContext);

      expect(result.status).toBe('ok');
      expect(result.data).toHaveProperty('pollSessions');
      expect(Array.isArray(result.data.pollSessions)).toBe(true);
      expect(result.message).toBe('Poll sessions retrieved successfully');
    });

    test('should list poll sessions with filters', async () => {
      const contextWithFilters = {
        ...mockContext,
        flags: { 'filter-type': 'qwen', 'filter-status': 'active' }
      };

      const handler = new DebugPollListHandler();
      const result = await handler.execute(contextWithFilters);

      expect(result.status).toBe('ok');
      expect(result.data).toHaveProperty('pollSessions');
      expect(Array.isArray(result.data.pollSessions)).toBe(true);
    });
  });

  describe('Debug Poll View', () => {
    test('should view a specific poll session', async () => {
      const contextWithId = {
        ...mockContext,
        flags: { id: 'poll-1' }
      };

      const handler = new DebugPollViewHandler();
      const result = await handler.execute(contextWithId);

      expect(result.status).toBe('ok');
      expect(result.data).toHaveProperty('pollSession');
      expect(result.data.pollSession).not.toBeNull();
      expect(result.data.pollSession.id).toBe('poll-1');
      expect(result.message).toContain('Poll session poll-1 retrieved successfully');
    });

    test('should return error for non-existent poll session', async () => {
      const contextWithInvalidId = {
        ...mockContext,
        flags: { id: 'non-existent-poll' }
      };

      const handler = new DebugPollViewHandler();
      const result = await handler.execute(contextWithInvalidId);

      expect(result.status).toBe('error');
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0]).toHaveProperty('code');
      expect(result.errors[0].code).toBe('NOT_FOUND');
      expect(result.errors[0].id).toBe('non-existent-poll');
    });

    test('should return error when missing required --id flag', async () => {
      const handler = new DebugPollViewHandler();
      const result = await handler.execute(mockContext);

      expect(result.status).toBe('error');
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].message).toBe('Missing required flag: --id');
      expect(result.errors[0]).toHaveProperty('code');
      expect(result.errors[0].code).toBe('MISSING_REQUIRED_FLAG');
    });
  });
});