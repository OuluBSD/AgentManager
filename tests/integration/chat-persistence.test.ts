// tests/integration/chat-persistence.test.ts
// Integration test for chat persistence functionality

import { SessionManager } from '../../src/session/session-manager';
import { ContextManager } from '../../src/state/context-manager';
import { ChatCreateHandler } from '../../src/commands/agent/chat/create';
import { ChatListHandler } from '../../src/commands/agent/chat/list';
import { ChatViewHandler } from '../../src/commands/agent/chat/view';
import { ChatSelectHandler } from '../../src/commands/agent/chat/select';
import { RoadmapCreateHandler } from '../../src/commands/agent/roadmap/create';

// Mock context for testing - simulates the CLI execution context
const mockContext = {
  args: {},
  flags: {},
  contextState: {
    activeProjectId: 'test-project',
    activeProjectName: 'Test Project',
    activeRoadmapId: undefined, // Will be set after roadmap creation
    activeRoadmapTitle: undefined,
    activeChatId: undefined,
    activeChatTitle: undefined,
    lastUpdate: new Date().toISOString()
  },
  config: {}
};

describe('Chat Persistence Integration Tests', () => {
  let sessionManager: SessionManager;
  let contextManager: ContextManager;
  let testRoadmapId: string | null = null;
  let createdChatId: string | null = null;

  beforeAll(async () => {
    sessionManager = new SessionManager();
    contextManager = new ContextManager();
  });

  afterAll(async () => {
    // No specific cleanup needed as each test is isolated
    // Context is in-memory for these tests
  });

  test('should create a roadmap first', async () => {
    const handler = new RoadmapCreateHandler();
    const context = {
      ...mockContext,
      flags: { 
        title: 'Chat Persistence Test Roadmap', 
        description: 'Roadmap for testing chat persistence' 
      }
    };
    
    const result = await handler.execute(context);
    
    expect(result.status).toBe('ok');
    expect(result.data).toHaveProperty('roadmap');
    expect(result.data.roadmap).toHaveProperty('id');
    expect(result.data.roadmap.title).toBe('Chat Persistence Test Roadmap');

    testRoadmapId = result.data.roadmap.id;
    
    // Update our mock context to use this roadmap
    (mockContext.contextState as any).activeRoadmapId = testRoadmapId;
    (mockContext.contextState as any).activeRoadmapTitle = result.data.roadmap.title;
  });

  test('should create a chat successfully', async () => {
    if (!testRoadmapId) {
      throw new Error('Test roadmap not created');
    }
    
    const handler = new ChatCreateHandler();
    const context = {
      ...mockContext,
      flags: { 
        title: 'Test Chat for Persistence', 
        note: 'This chat should persist and appear in list' 
      }
    };
    
    const result = await handler.execute(context);
    
    expect(result.status).toBe('ok');
    expect(result.data).toHaveProperty('chat');
    expect(result.data.chat).toHaveProperty('id');
    expect(result.data.chat.title).toBe('Test Chat for Persistence');
    expect(result.data.chat.roadmapRef).toBe(testRoadmapId);
    
    createdChatId = result.data.chat.id;
  });

  test('should list the created chat', async () => {
    if (!testRoadmapId) {
      throw new Error('Test roadmap not created');
    }
    if (!createdChatId) {
      throw new Error('Test chat not created');
    }
    
    const handler = new ChatListHandler();
    const context = {
      ...mockContext,
      flags: { 
        'roadmap-id': testRoadmapId  // Explicitly specify roadmap ID
      }
    };
    
    const result = await handler.execute(context);
    
    expect(result).toHaveProperty('chats');
    expect(Array.isArray(result.chats)).toBe(true);
    expect(result.chats.length).toBeGreaterThan(0);
    
    // Find our created chat in the list
    const foundChat = result.chats.find((chat: any) => chat.id === createdChatId);
    expect(foundChat).toBeDefined();
    expect(foundChat.title).toBe('Test Chat for Persistence');
    expect(foundChat.selected).toBe(false); // Should not be selected initially
    expect(result.roadmapId).toBe(testRoadmapId); // Parent reference should be included
  });

  test('should view the created chat details', async () => {
    if (!createdChatId) {
      throw new Error('Test chat not created');
    }
    
    const handler = new ChatViewHandler();
    const context = {
      ...mockContext,
      flags: { 
        id: createdChatId
      }
    };
    
    const result = await handler.execute(context);
    
    expect(result).toHaveProperty('chat');
    expect(result.chat).toHaveProperty('id', createdChatId);
    expect(result.chat.title).toBe('Test Chat for Persistence');
    expect(result.roadmapId).toBeDefined(); // Parent roadmap ID should be included
  });

  test('should select the chat and verify selected state', async () => {
    if (!createdChatId) {
      throw new Error('Test chat not created');
    }
    
    // First, select the chat
    const selectHandler = new ChatSelectHandler();
    const selectContext = {
      ...mockContext,
      flags: { 
        id: createdChatId
      }
    };
    
    const selectResult = await selectHandler.execute(selectContext);
    
    expect(selectResult).toHaveProperty('chat');
    expect(selectResult.chat).toHaveProperty('id', createdChatId);
    
    // Now list chats again and verify the selected chat is marked as selected
    const listHandler = new ChatListHandler();
    const listContext = {
      ...mockContext,
      flags: { 
        'roadmap-id': testRoadmapId  // Use the same roadmap
      }
    };
    
    const listResult = await listHandler.execute(listContext);
    
    expect(Array.isArray(listResult.chats)).toBe(true);
    
    // Find our chat in the list
    const chatInList = listResult.chats.find((chat: any) => chat.id === createdChatId);
    expect(chatInList).toBeDefined();
    expect(chatInList.selected).toBe(true); // Should be selected now
  });

  test('should verify full flow sequence works correctly', async () => {
    if (!testRoadmapId || !createdChatId) {
      throw new Error('Test setup not completed properly');
    }
    
    // Create another chat to ensure multiple chats work
    const handler = new ChatCreateHandler();
    const context = {
      ...mockContext,
      flags: { 
        title: 'Second Test Chat', 
        note: 'Another test chat' 
      }
    };
    
    const result = await handler.execute(context);
    expect(result.status).toBe('ok');
    
    const secondChatId = result.data.chat.id;
    expect(secondChatId).not.toBe(createdChatId); // Should be different
    
    // List all chats in the roadmap
    const listHandler = new ChatListHandler();
    const listContext = {
      ...mockContext,
      flags: { 
        'roadmap-id': testRoadmapId
      }
    };
    
    const listResult = await listHandler.execute(listContext);
    
    expect(listResult.chats.length).toBeGreaterThanOrEqual(2); // Should have both chats
    
    const firstChat = listResult.chats.find((chat: any) => chat.id === createdChatId);
    const secondChat = listResult.chats.find((chat: any) => chat.id === secondChatId);
    
    expect(firstChat).toBeDefined();
    expect(secondChat).toBeDefined();
    expect(firstChat.title).toBe('Test Chat for Persistence');
    expect(secondChat.title).toBe('Second Test Chat');
  });
});