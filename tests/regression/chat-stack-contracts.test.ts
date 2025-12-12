// tests/regression/chat-stack-contracts.test.ts
// Regression tests for chat stack contracts and functionality

import { ChatCreateHandler } from '../../src/commands/agent/chat/create';
import { AgentChatSendHandler } from '../../src/commands/agent/chat/send';
import { ChatListHandler } from '../../src/commands/agent/chat/list';
import { ChatViewHandler } from '../../src/commands/agent/chat/view';
import { SessionManager } from '../../src/session/session-manager';
import { ContextManager } from '../../src/state/context-manager';
import { API_CLIENT } from '../../src/api/client';

// Mock context for testing
const mockContext = {
  args: {},
  flags: {},
  contextState: {
    activeProjectId: 'test-project-regression',
    activeProjectName: 'Test Project Regression',
    activeProjectPath: '/tmp/test-project-regression',
    activeRoadmapId: 'test-roadmap-regression',
    activeRoadmapTitle: 'Test Roadmap Regression', 
    activeChatId: undefined,
    activeChatTitle: undefined,
    lastUpdate: new Date().toISOString()
  },
  config: {}
};

describe('Chat Stack Regression Tests', () => {
  let sessionManager: SessionManager;
  let contextManager: ContextManager;
  let testChatId: string | undefined;

  beforeAll(async () => {
    sessionManager = new SessionManager();
    contextManager = new ContextManager();
  });

  afterAll(async () => {
    // Clean up
    if (testChatId) {
      // In a real test, we might want to delete the test chat
    }
  });

  test('should create a chat with all required fields present', async () => {
    const handler = new ChatCreateHandler();
    const context = {
      ...mockContext,
      flags: {
        title: 'Regression Test Chat',
        note: 'This is a regression test chat'
      }
    };

    const result = await handler.execute(context);

    expect(result.status).toBe('ok');
    expect(result.data).toHaveProperty('chat');
    expect(result.data.chat).toHaveProperty('id');
    expect(result.data.chat).toHaveProperty('title');
    expect(result.data.chat).toHaveProperty('status');
    expect(result.data.chat).toHaveProperty('progress');
    expect(result.data.chat).toHaveProperty('note');
    expect(result.data.chat).toHaveProperty('meta');
    expect(result.data.chat).toHaveProperty('messages');
    expect(result.data.chat).toHaveProperty('roadmapRef');

    // Ensure specific values match what we expect
    expect(result.data.chat.title).toBe('Regression Test Chat');
    expect(result.data.chat.note).toBe('This is a regression test chat');
    expect(result.data.chat.status).toBe('active');
    expect(result.data.chat.progress).toBe(0);
    expect(result.data.chat.meta).toBe(false);
    expect(Array.isArray(result.data.chat.messages)).toBe(true);

    // Store the chat ID for further tests
    testChatId = result.data.chat.id;
    
    // Update the context state for subsequent tests
    (mockContext.contextState as any).activeChatId = testChatId;
    (mockContext.contextState as any).activeChatTitle = result.data.chat.title;
  });

  test('should send a message to the chat and preserve all message fields', async () => {
    if (!testChatId) {
      throw new Error('Test chat not created');
    }

    const handler = new AgentChatSendHandler();
    const context = {
      ...mockContext,
      flags: {
        message: 'This is a test message for regression testing',
        role: 'user'
      }
    };

    const result = await handler.execute(context);

    expect(result.status).toBe('ok');
    expect(result.data).toHaveProperty('chat');
    expect(result.data.chat).toHaveProperty('messages');
    expect(Array.isArray(result.data.chat.messages)).toBe(true);

    const messages = result.data.chat.messages;
    expect(messages.length).toBeGreaterThan(0);

    const lastMessage = messages[messages.length - 1];
    expect(lastMessage).toHaveProperty('id');
    expect(lastMessage).toHaveProperty('role');
    expect(lastMessage).toHaveProperty('content');
    expect(lastMessage).toHaveProperty('timestamp');
    expect(lastMessage).toHaveProperty('metadata');
    expect(lastMessage).toHaveProperty('displayRole');

    expect(lastMessage.role).toBe('user');
    expect(lastMessage.content).toBe('This is a test message for regression testing');
    expect(typeof lastMessage.timestamp).toBe('number');
    expect(lastMessage.displayRole).toBe('User');
  });

  test('should list chats with correct fields and structure', async () => {
    if (!testChatId) {
      throw new Error('Test chat not created');
    }

    const handler = new ChatListHandler();
    const context = {
      ...mockContext,
      flags: {}
    };

    const result = await handler.execute(context);

    expect(result).toHaveProperty('chats');
    expect(Array.isArray(result.chats)).toBe(true);
    expect(result.chats.length).toBeGreaterThan(0);

    const testChat = result.chats.find((chat: any) => chat.id === testChatId);
    expect(testChat).toBeDefined();

    // Ensure it has all the required fields according to the chat summary
    expect(testChat).toHaveProperty('id');
    expect(testChat).toHaveProperty('title');
    expect(testChat).toHaveProperty('status');
    expect(testChat).toHaveProperty('progress');
    expect(testChat).toHaveProperty('note');
    expect(testChat).toHaveProperty('meta');
    expect(testChat).toHaveProperty('selected'); // This is added by the list handler

    // Verify the values are correct
    expect(testChat.title).toBe('Regression Test Chat');
  });

  test('should view chat with all details intact', async () => {
    if (!testChatId) {
      throw new Error('Test chat not created');
    }

    const handler = new ChatViewHandler();
    const context = {
      ...mockContext,
      flags: { id: testChatId }
    };

    const result = await handler.execute(context);

    expect(result).toHaveProperty('chat');
    expect(result.chat).toHaveProperty('id', testChatId);
    expect(result.chat).toHaveProperty('title');
    expect(result.chat).toHaveProperty('status');
    expect(result.chat).toHaveProperty('progress');
    expect(result.chat).toHaveProperty('note');
    expect(result.chat).toHaveProperty('meta');
    expect(result.chat).toHaveProperty('messages');
    expect(result.chat).toHaveProperty('roadmapRef');

    // Verify these values match what we set during creation
    expect(result.chat.title).toBe('Regression Test Chat');
    expect(result.chat.note).toBe('This is a regression test chat');
    expect(Array.isArray(result.chat.messages)).toBe(true);
  });

  test('should verify chat message structure preservation', async () => {
    if (!testChatId) {
      throw new Error('Test chat not created');
    }

    // Get the full chat to verify message structure
    const { data: chatResponse } = await API_CLIENT.getChatById(testChatId);
    const chat = chatResponse.chat;

    if (!chat || !chat.messages || chat.messages.length === 0) {
      throw new Error('No messages found in chat');
    }

    const lastMessage = chat.messages[chat.messages.length - 1];

    // Ensure all required message fields are present
    expect(lastMessage).toHaveProperty('id');
    expect(lastMessage).toHaveProperty('role');
    expect(lastMessage).toHaveProperty('content');
    expect(lastMessage).toHaveProperty('timestamp');
    expect(lastMessage).toHaveProperty('metadata');
    expect(lastMessage).toHaveProperty('displayRole');

    // Verify values
    expect(lastMessage.role).toBe('user');
    expect(lastMessage.content).toBe('This is a test message for regression testing');
    expect(typeof lastMessage.timestamp).toBe('number');
    expect(lastMessage.displayRole).toBe('User');
  });

  test('should handle long messages without truncation', async () => {
    if (!testChatId) {
      throw new Error('Test chat not created');
    }

    const longMessage = "This is a very long message that should be preserved in full without truncation. " +
      "It contains multiple sentences, special characters like @#$%^&*(), and even some code: console.log('hello world'); " +
      "The message continues with more text to make it extremely long so that we can verify that long messages are properly " +
      "handled without any truncation or loss of data. Let's add even more content to ensure it's truly long: " +
      "abcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*()".repeat(10);

    const handler = new AgentChatSendHandler();
    const context = {
      ...mockContext,
      flags: {
        message: longMessage,
        role: 'user'
      }
    };

    const result = await handler.execute(context);

    expect(result.status).toBe('ok');
    expect(result.data).toHaveProperty('chat');
    expect(result.data.chat).toHaveProperty('messages');
    
    const messages = result.data.chat.messages;
    const lastMessage = messages[messages.length - 1];
    
    // Verify the long message is preserved in full
    expect(lastMessage.content).toBe(longMessage);
    expect(lastMessage.content.length).toBe(longMessage.length);
  });
});