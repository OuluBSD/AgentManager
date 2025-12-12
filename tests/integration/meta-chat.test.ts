// tests/integration/meta-chat.test.ts
// Integration test for meta-chat functionality

import { SessionManager } from '../../src/session/session-manager';
import { ContextManager } from '../../src/state/context-manager';
import { ChatCreateHandler } from '../../src/commands/agent/chat/create';
import { ChatListHandler } from '../../src/commands/agent/chat/list';
import { ChatViewHandler } from '../../src/commands/agent/chat/view';
import { RoadmapCreateHandler } from '../../src/commands/agent/roadmap/create';

// Mock context for testing - simulates the CLI execution context
const mockContext = {
  args: {},
  flags: {},
  contextState: {
    activeProjectId: 'test-project',
    activeProjectName: 'Test Project',
    activeRoadmapId: undefined,
    activeRoadmapTitle: undefined,
    activeChatId: undefined,
    activeChatTitle: undefined,
    lastUpdate: new Date().toISOString()
  },
  config: {}
};

describe('Meta-Chat Integration Tests', () => {
  let sessionManager: SessionManager;
  let contextManager: ContextManager;
  let testRoadmapId: string | null = null;
  let regularChatId: string | null = null;
  let metaChatId: string | null = null;

  beforeAll(async () => {
    sessionManager = new SessionManager();
    contextManager = new ContextManager();
  });

  test('should create a roadmap first', async () => {
    const handler = new RoadmapCreateHandler();
    const context = {
      ...mockContext,
      flags: { 
        title: 'Meta-Chat Test Roadmap', 
        description: 'Roadmap for testing meta-chat functionality' 
      }
    };
    
    const result = await handler.execute(context);
    
    expect(result.status).toBe('ok');
    expect(result.data).toHaveProperty('roadmap');
    expect(result.data.roadmap).toHaveProperty('id');
    expect(result.data.roadmap.title).toBe('Meta-Chat Test Roadmap');
    
    testRoadmapId = result.data.roadmap.id;
    
    // Update our mock context to use this roadmap
    (mockContext.contextState as any).activeRoadmapId = testRoadmapId;
    (mockContext.contextState as any).activeRoadmapTitle = result.data.roadmap.title;
  });

  test('should create a regular chat', async () => {
    if (!testRoadmapId) {
      throw new Error('Test roadmap not created');
    }
    
    const handler = new ChatCreateHandler();
    const context = {
      ...mockContext,
      flags: { 
        title: 'Regular Task Chat', 
        note: 'This is a regular task execution chat',
        type: 'regular'
      }
    };
    
    const result = await handler.execute(context);
    
    expect(result.status).toBe('ok');
    expect(result.data).toHaveProperty('chat');
    expect(result.data.chat).toHaveProperty('id');
    expect(result.data.chat.title).toBe('Regular Task Chat');
    expect(result.data.chat.type).toBe('regular');
    expect(result.data.chat.meta).toBe(false);
    
    regularChatId = result.data.chat.id;
  });

  test('should create a meta chat', async () => {
    if (!testRoadmapId) {
      throw new Error('Test roadmap not created');
    }
    
    const handler = new ChatCreateHandler();
    const context = {
      ...mockContext,
      flags: { 
        title: 'Meta: Guidance for Qwen Implementation', 
        note: 'This is a meta chat for guiding AI behavior',
        type: 'meta'
      }
    };
    
    const result = await handler.execute(context);
    
    expect(result.status).toBe('ok');
    expect(result.data).toHaveProperty('chat');
    expect(result.data.chat).toHaveProperty('id');
    expect(result.data.chat.title).toBe('Meta: Guidance for Qwen Implementation');
    expect(result.data.chat.type).toBe('meta');
    expect(result.data.chat.meta).toBe(true);
    
    metaChatId = result.data.chat.id;
  });

  test('should list all chats (both regular and meta)', async () => {
    if (!testRoadmapId) {
      throw new Error('Test roadmap not created');
    }
    
    const handler = new ChatListHandler();
    const context = {
      ...mockContext,
      flags: { 
        'roadmap-id': testRoadmapId
      }
    };
    
    const result = await handler.execute(context);
    
    expect(Array.isArray(result.chats)).toBe(true);
    expect(result.chats.length).toBeGreaterThanOrEqual(2); // Should have both chats
    
    // Find our created chats in the list
    const regularChat = result.chats.find((chat: any) => chat.id === regularChatId);
    const metaChat = result.chats.find((chat: any) => chat.id === metaChatId);
    
    expect(regularChat).toBeDefined();
    expect(regularChat.type).toBe('regular');
    expect(regularChat.meta).toBe(false);
    
    expect(metaChat).toBeDefined();
    expect(metaChat.type).toBe('meta');
    expect(metaChat.meta).toBe(true);
  });

  test('should list only regular chats when filtered', async () => {
    if (!testRoadmapId) {
      throw new Error('Test roadmap not created');
    }
    
    const handler = new ChatListHandler();
    const context = {
      ...mockContext,
      flags: { 
        'roadmap-id': testRoadmapId,
        type: 'regular'
      }
    };
    
    const result = await handler.execute(context);
    
    expect(Array.isArray(result.chats)).toBe(true);
    expect(result.chats.length).toBeGreaterThanOrEqual(1); // Should have at least the regular chat
    
    // All chats in the result should be regular
    for (const chat of result.chats) {
      expect(chat.type).toBe('regular');
      expect(chat.meta).toBe(false);
    }
    
    // The meta chat should NOT be in this list
    const metaChatInList = result.chats.find((chat: any) => chat.id === metaChatId);
    expect(metaChatInList).toBeUndefined();
  });

  test('should list only meta chats when filtered', async () => {
    if (!testRoadmapId) {
      throw new Error('Test roadmap not created');
    }
    
    const handler = new ChatListHandler();
    const context = {
      ...mockContext,
      flags: { 
        'roadmap-id': testRoadmapId,
        type: 'meta'
      }
    };
    
    const result = await handler.execute(context);
    
    expect(Array.isArray(result.chats)).toBe(true);
    expect(result.chats.length).toBeGreaterThanOrEqual(1); // Should have at least the meta chat
    
    // All chats in the result should be meta
    for (const chat of result.chats) {
      expect(chat.type).toBe('meta');
      expect(chat.meta).toBe(true);
    }
    
    // The regular chat should NOT be in this list
    const regularChatInList = result.chats.find((chat: any) => chat.id === regularChatId);
    expect(regularChatInList).toBeUndefined();
  });

  test('should view regular chat and confirm type', async () => {
    if (!regularChatId) {
      throw new Error('Regular chat not created');
    }
    
    const handler = new ChatViewHandler();
    const context = {
      ...mockContext,
      flags: { 
        id: regularChatId
      }
    };
    
    const result = await handler.execute(context);
    
    expect(result).toHaveProperty('chat');
    expect(result.chat).toHaveProperty('id', regularChatId);
    expect(result.chat.title).toBe('Regular Task Chat');
    expect(result.chat.type).toBe('regular');
    expect(result.chat.meta).toBe(false);
  });

  test('should view meta chat and confirm type', async () => {
    if (!metaChatId) {
      throw new Error('Meta chat not created');
    }
    
    const handler = new ChatViewHandler();
    const context = {
      ...mockContext,
      flags: { 
        id: metaChatId
      }
    };
    
    const result = await handler.execute(context);
    
    expect(result).toHaveProperty('chat');
    expect(result.chat).toHaveProperty('id', metaChatId);
    expect(result.chat.title).toBe('Meta: Guidance for Qwen Implementation');
    expect(result.chat.type).toBe('meta');
    expect(result.chat.meta).toBe(true);
  });

  test('should detect meta chat based on title containing "meta"', async () => {
    if (!testRoadmapId) {
      throw new Error('Test roadmap not created');
    }
    
    const handler = new ChatCreateHandler();
    const context = {
      ...mockContext,
      flags: { 
        title: 'Some Meta Chat by Naming Convention', 
        note: 'This should be detected as meta based on name'
        // No explicit type specified, should be detected from title
      }
    };
    
    const result = await handler.execute(context);
    
    expect(result.status).toBe('ok');
    expect(result.data).toHaveProperty('chat');
    expect(result.data.chat).toHaveProperty('type');
    
    // Should be detected as meta based on the title containing "meta"
    expect(result.data.chat.type).toBe('meta');
    expect(result.data.chat.meta).toBe(true);
  });
});