// tests/integration/chat-stack-hello-world.test.ts
// Integration test for minimal end-to-end chat stack (Hello World)

import { SessionManager } from '../../src/session/session-manager';
import { ContextManager } from '../../src/state/context-manager';
import { ProjectCreateHandler } from '../../src/commands/agent/project/create';
import { ProjectSelectHandler } from '../../src/commands/agent/project/select';
import { ProjectCurrentHandler } from '../../src/commands/agent/project/current';
import { RoadmapCreateHandler } from '../../src/commands/agent/roadmap/create';
import { RoadmapSelectHandler } from '../../src/commands/agent/roadmap/select';
import { RoadmapCurrentHandler } from '../../src/commands/agent/roadmap/current';
import { ChatCreateHandler } from '../../src/commands/agent/chat/create';
import { ChatSelectHandler } from '../../src/commands/agent/chat/select';
import { ChatCurrentHandler } from '../../src/commands/agent/chat/current';
import { AISessionCreateHandler } from '../../src/commands/ai/session/create';
import { AIBackendStatusHandler } from '../../src/commands/ai/backend/status';
import { AIMessageSendHandler } from '../../src/commands/ai/message/send';

// Mock context for testing - simulates the CLI execution context
const mockContext = {
  args: {},
  flags: {},
  contextState: {
    activeProjectId: null,
    activeProjectName: null,
    activeRoadmapId: null,
    activeRoadmapTitle: null,
    activeChatId: null,
    activeChatTitle: null,
    selectedAiSessionId: null,
    lastUpdate: new Date().toISOString()
  },
  config: {}
};

describe('Chat Stack Hello World - End-to-End Integration', () => {
  let sessionManager: SessionManager;
  let contextManager: ContextManager;
  let projectId: string | null = null;
  let roadmapId: string | null = null;
  let chatId: string | null = null;
  let sessionId: string | null = null;

  beforeAll(async () => {
    sessionManager = new SessionManager();
    contextManager = new ContextManager();
  });

  afterAll(async () => {
    // Cleanup: clear context after test
    await contextManager.clearProject();
    await contextManager.clearRoadmap();
    await contextManager.clearChat();
    await contextManager.clearAiSession();
  });

  test('should create and select a project', async () => {
    const handler = new ProjectCreateHandler();
    const context = {
      ...mockContext,
      flags: { 
        name: 'Chat Stack Test Project', 
        category: 'Testing',
        description: 'Test project for chat stack'
      }
    };
    
    const result = await handler.execute(context);
    
    expect(result.status).toBe('ok');
    expect(result.data).toHaveProperty('id');
    expect(result.data.name).toBe('Chat Stack Test Project');
    
    projectId = result.data.id;
    
    // Now select the project
    const selectHandler = new ProjectSelectHandler();
    const selectContext = {
      ...mockContext,
      flags: { id: projectId }
    };
    
    const selectResult = await selectHandler.execute(selectContext);
    expect(selectResult.status).toBe('ok');
    expect(selectResult.data.selectedProjectId).toBe(projectId);
    
    // Verify the project is now selected
    const currentHandler = new ProjectCurrentHandler();
    const currentResult = await currentHandler.execute(mockContext);
    expect(currentResult.status).toBe('ok');
    expect(currentResult.data.id).toBe(projectId);
  });

  test('should create and select a roadmap', async () => {
    // Verify we have a project context
    const currentProjectHandler = new ProjectCurrentHandler();
    const projectResult = await currentProjectHandler.execute(mockContext);
    expect(projectResult.status).toBe('ok');
    
    // Create roadmap
    const handler = new RoadmapCreateHandler();
    const context = {
      ...mockContext,
      flags: { 
        name: 'Chat Stack Demo Roadmap', 
        description: 'Demo roadmap for chat stack'
      }
    };
    
    const result = await handler.execute(context);
    
    expect(result.status).toBe('ok');
    expect(result.data).toHaveProperty('id');
    expect(result.data.title).toBe('Chat Stack Demo Roadmap');
    
    roadmapId = result.data.id;
    
    // Now select the roadmap
    const selectHandler = new RoadmapSelectHandler();
    const selectContext = {
      ...mockContext,
      flags: { id: roadmapId }
    };
    
    const selectResult = await selectHandler.execute(selectContext);
    expect(selectResult.status).toBe('ok');
    expect(selectResult.data.selectedRoadmapId).toBe(roadmapId);
    
    // Verify the roadmap is now selected
    const currentHandler = new RoadmapCurrentHandler();
    const currentResult = await currentHandler.execute(mockContext);
    expect(currentResult.status).toBe('ok');
    expect(currentResult.data.id).toBe(roadmapId);
  });

  test('should create and select a chat', async () => {
    // Verify we have a roadmap context
    const currentRoadmapHandler = new RoadmapCurrentHandler();
    const roadmapResult = await currentRoadmapHandler.execute(mockContext);
    expect(roadmapResult.status).toBe('ok');
    
    // Create chat
    const handler = new ChatCreateHandler();
    const context = {
      ...mockContext,
      flags: { 
        name: 'Hello World Chat', 
        description: 'Basic chat for testing'
      }
    };
    
    const result = await handler.execute(context);
    
    expect(result.status).toBe('ok');
    expect(result.data).toHaveProperty('id');
    expect(result.data.title).toBe('Hello World Chat');
    
    chatId = result.data.id;
    
    // Now select the chat
    const selectHandler = new ChatSelectHandler();
    const selectContext = {
      ...mockContext,
      flags: { id: chatId }
    };
    
    const selectResult = await selectHandler.execute(selectContext);
    expect(selectResult.status).toBe('ok');
    expect(selectResult.data.selectedChatId).toBe(chatId);
    
    // Verify the chat is now selected
    const currentHandler = new ChatCurrentHandler();
    const currentResult = await currentHandler.execute(mockContext);
    expect(currentResult.status).toBe('ok');
    expect(currentResult.data.id).toBe(chatId);
  });

  test('should create an AI session', async () => {
    const handler = new AISessionCreateHandler();
    const result = await handler.execute(mockContext);
    
    expect(result.status).toBe('ok');
    expect(result.data).toHaveProperty('sessionId');
    
    sessionId = result.data.sessionId;
  });

  test('should verify the backend is configured', async () => {
    const handler = new AIBackendStatusHandler();
    const result = await handler.execute(mockContext);
    
    expect(result.status).toBe('ok');
    expect(result.data).toHaveProperty('backend');
    expect(result.data).toHaveProperty('status');
  });

  test('should send a hello world message and receive a streamed response', async () => {
    // Create a context for the message send command with the session ID
    const handler = new AIMessageSendHandler();
    const context = {
      ...mockContext,
      flags: { 
        text: "Hello from Nexus CLI" 
      }
    };
    
    // The handler returns an async generator, so we need to iterate through it
    const generator = handler.execute(context);
    const events: any[] = [];
    
    // Capture all events from the streaming response
    for await (const event of generator as any) {
      events.push(event);
    }
    
    // We should have multiple events (at least a start, tokens, and end event)
    expect(events.length).toBeGreaterThan(1);
    
    // The last event should be the completion result
    const finalEvent = events[events.length - 1];
    expect(finalEvent.status).toBe('ok');
    expect(finalEvent.data).toHaveProperty('stream');
    expect(finalEvent.data.stream).toBe('completed');
  }, 30000); // 30 second timeout for the network request

  test('should verify full chat stack flow completed successfully', () => {
    // All variables should be set from previous tests
    expect(projectId).not.toBeNull();
    expect(roadmapId).not.toBeNull();
    expect(chatId).not.toBeNull();
    expect(sessionId).not.toBeNull();
  });
});