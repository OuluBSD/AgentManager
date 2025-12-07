// src/session/session-types.ts
// Session-related types

export interface SessionConfig {
  type: string;
  context?: any;
  transport?: string;
  capabilities?: any;
}

export interface Message {
  messageId: string;
  role: string; // 'user' | 'assistant' | 'system'
  content: string;
  timestamp: number;
}

export interface AISession {
  sessionId: string;
  type: 'ai-chat';
  createdAt: number;
  context?: any;
  messages: Message[];
}

export interface Session {
  sessionId: string;
  type: string;
  createdAt: string;
  expiresAt?: string;
  context: any;
  transport: string;
  status: string;
  capabilities: any;
  metadata: any;
}

export interface StreamingEvent {
  event: string;
  timestamp: string;
  sessionId: string;
  payload: any;
}