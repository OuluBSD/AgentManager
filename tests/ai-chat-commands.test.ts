// tests/ai-chat-commands.test.ts
// Integration tests for AI Chat Session Commands

import { SessionManager } from '../src/session/session-manager';
import { ContextManager } from '../src/state/context-manager';
import { AISessionListHandler } from '../src/commands/ai/session/list';
import { AISessionCreateHandler } from '../src/commands/ai/session/create';
import { AISessionSelectHandler } from '../src/commands/ai/session/switch';
import { AISessionCurrentHandler } from '../src/commands/ai/session/current';
import { AIMessageSendHandler } from '../src/commands/ai/message/send';

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
    lastUpdate: new Date().toISOString()
  },
  config: {}
};

describe('AI Chat Session Commands', () => {
  let sessionManager: SessionManager;
  let contextManager: ContextManager;

  beforeEach(async () => {
    sessionManager = new SessionManager();
    contextManager = new ContextManager();
    
    // Clear any existing context
    await contextManager.clearAiSession();
  });

  describe('Session Creation', () => {
    test('should create a new AI session', async () => {
      const handler = new AISessionCreateHandler();
      const result = await handler.execute(mockContext);
      
      expect(result.status).toBe('ok');
      expect(result.data).toHaveProperty('sessionId');
      expect(result.data).toHaveProperty('type');
      expect(result.data.type).toBe('ai-chat');
    });
  });

  describe('Session Listing', () => {
    test('should list AI sessions', async () => {
      // Create a session first
      const createHandler = new AISessionCreateHandler();
      const createResult = await createHandler.execute(mockContext);
      expect(createResult.status).toBe('ok');
      
      // Now list sessions
      const listHandler = new AISessionListHandler();
      const listResult = await listHandler.execute(mockContext);
      
      expect(listResult.status).toBe('ok');
      expect(Array.isArray(listResult.data.sessions)).toBe(true);
      expect(listResult.data.sessions.length).toBeGreaterThan(0);
    });
  });

  describe('Session Selection', () => {
    test('should select an AI session', async () => {
      // Create a session first
      const createHandler = new AISessionCreateHandler();
      const createResult = await createHandler.execute(mockContext);
      expect(createResult.status).toBe('ok');
      
      const sessionId = createResult.data.sessionId;
      
      // Select the session
      const selectHandler = new AISessionSelectHandler();
      const selectContext = {
        ...mockContext,
        flags: { id: sessionId }
      };
      const selectResult = await selectHandler.execute(selectContext);
      
      expect(selectResult.status).toBe('ok');
      expect(selectResult.data.selectedSessionId).toBe(sessionId);
      
      // Verify the context was updated
      const currentSessionId = await contextManager.getAiSession();
      expect(currentSessionId).toBe(sessionId);
    });

    test('should fail to select a non-existent session', async () => {
      const selectHandler = new AISessionSelectHandler();
      const selectContext = {
        ...mockContext,
        flags: { id: 'non-existent-session-id' }
      };
      const selectResult = await selectHandler.execute(selectContext);
      
      expect(selectResult.status).toBe('error');
      expect(selectResult.errors[0]?.type).toBe('UNKNOWN_SESSION');
    });
  });

  describe('Current Session', () => {
    test('should get the current AI session', async () => {
      // Create and select a session
      const createHandler = new AISessionCreateHandler();
      const createResult = await createHandler.execute(mockContext);
      expect(createResult.status).toBe('ok');
      
      const sessionId = createResult.data.sessionId;
      
      // Select the session
      const selectHandler = new AISessionSelectHandler();
      const selectContext = {
        ...mockContext,
        flags: { id: sessionId }
      };
      const selectResult = await selectHandler.execute(selectContext);
      expect(selectResult.status).toBe('ok');
      
      // Now get the current session
      const currentHandler = new AISessionCurrentHandler();
      const currentResult = await currentHandler.execute(mockContext);
      
      expect(currentResult.status).toBe('ok');
      expect(currentResult.data.sessionId).toBe(sessionId);
    });

    test('should fail to get current session if none is selected', async () => {
      const currentHandler = new AISessionCurrentHandler();
      const currentResult = await currentHandler.execute(mockContext);
      
      expect(currentResult.status).toBe('error');
      expect(currentResult.errors[0]?.type).toBe('MISSING_REQUIRED_CONTEXT');
    });
  });

  describe('Message Sending', () => {
    test('should send a message to an AI session', async () => {
      // Create and select a session
      const createHandler = new AISessionCreateHandler();
      const createResult = await createHandler.execute(mockContext);
      expect(createResult.status).toBe('ok');
      
      const sessionId = createResult.data.sessionId;
      
      // Select the session
      const selectHandler = new AISessionSelectHandler();
      const selectContext = {
        ...mockContext,
        flags: { id: sessionId }
      };
      const selectResult = await selectHandler.execute(selectContext);
      expect(selectResult.status).toBe('ok');
      
      // Send a message using the streaming handler
      const messageHandler = new AIMessageSendHandler();
      const messageContext = {
        ...mockContext,
        flags: { text: 'Hello, AI!' }
      };
      
      // Convert the async generator to an array to capture all events
      const events: any[] = [];
      for await (const event of messageHandler.execute(messageContext)) {
        events.push(event);
      }
      
      // Should have received multiple events (tokens + final result)
      expect(events.length).toBeGreaterThan(1);
      
      // Check for the final success result
      const finalResult = events[events.length - 1];
      expect(finalResult.status).toBe('ok');
      expect(finalResult.data).toHaveProperty('sessionId');
    });
  });
});