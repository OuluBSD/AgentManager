// src/session/session-store.ts
// Session store implementation

import { Session, SessionConfig, AISession, Message } from './session-types';
import { v4 as uuidv4 } from 'uuid';

export class SessionStore {
  private sessions: Map<string, Session> = new Map();
  private aiSessions: Map<string, AISession> = new Map();

  async create(config: SessionConfig): Promise<Session> {
    // Placeholder implementation
    throw new Error('SessionStore.create not implemented');
  }

  get(sessionId: string): Session | undefined {
    // Placeholder implementation
    throw new Error('SessionStore.get not implemented');
  }

  remove(sessionId: string): void {
    // Placeholder implementation
    throw new Error('SessionStore.remove not implemented');
  }

  // AI Session methods
  async createAiSession(config?: { context?: any }): Promise<AISession> {
    const sessionId = uuidv4();
    const aiSession: AISession = {
      sessionId,
      type: 'ai-chat',
      createdAt: Date.now(),
      context: config?.context || {},
      messages: []
    };
    this.aiSessions.set(sessionId, aiSession);
    return aiSession;
  }

  getAiSession(sessionId: string): AISession | undefined {
    return this.aiSessions.get(sessionId);
  }

  getAiSessions(): AISession[] {
    return Array.from(this.aiSessions.values());
  }

  getAiSessionById(sessionId: string): AISession | undefined {
    return this.aiSessions.get(sessionId);
  }

  async appendMessage(sessionId: string, role: string, content: string): Promise<AISession | undefined> {
    const session = this.aiSessions.get(sessionId);
    if (!session) {
      return undefined;
    }

    const message: Message = {
      messageId: uuidv4(),
      role,
      content,
      timestamp: Date.now()
    };

    session.messages.push(message);
    return session;
  }

  async appendStreamToken(sessionId: string, content: string): Promise<AISession | undefined> {
    const session = this.aiSessions.get(sessionId);
    if (!session) {
      return undefined;
    }

    // For streaming, we'll append to the last message if it's from the assistant
    // or create a new message if needed
    let lastMessage = session.messages[session.messages.length - 1];
    if (!lastMessage || lastMessage.role !== 'assistant') {
      // Create a new assistant message
      lastMessage = {
        messageId: uuidv4(),
        role: 'assistant',
        content: '',
        timestamp: Date.now()
      };
      session.messages.push(lastMessage);
    }

    // Append content to the last message
    lastMessage.content += content;
    return session;
  }

  removeAiSession(sessionId: string): boolean {
    return this.aiSessions.delete(sessionId);
  }
}