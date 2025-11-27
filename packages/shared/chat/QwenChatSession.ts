/**
 * Qwen Chat Session
 *
 * Manages chat state and communication with Qwen AI backend.
 * This class is framework-agnostic and can be used by both web and CLI frontends.
 */

import type {
  ChatMessage,
  ChatStatus,
  ChatInfo,
  ChatState,
  ChatEvent,
  ChatEventHandler,
} from "./types";

export interface QwenChatSessionConfig {
  onEvent?: ChatEventHandler;
  autoConnect?: boolean;
}

export class QwenChatSession {
  private state: ChatState;
  private eventHandlers: Set<ChatEventHandler> = new Set();
  private messageIdCounter = 0;

  constructor(private config: QwenChatSessionConfig = {}) {
    this.state = {
      messages: [],
      status: { state: "idle" },
      info: {},
      isStreaming: false,
    };

    if (config.onEvent) {
      this.eventHandlers.add(config.onEvent);
    }
  }

  /**
   * Get current chat state (immutable)
   */
  getState(): Readonly<ChatState> {
    return { ...this.state };
  }

  /**
   * Subscribe to chat events
   */
  on(handler: ChatEventHandler): () => void {
    this.eventHandlers.add(handler);
    return () => this.eventHandlers.delete(handler);
  }

  /**
   * Emit an event to all subscribers
   */
  private emit(event: ChatEvent): void {
    for (const handler of this.eventHandlers) {
      handler(event);
    }
  }

  /**
   * Update chat status
   */
  setStatus(status: ChatStatus): void {
    this.state.status = status;
    this.emit({ type: "status", data: status });
  }

  /**
   * Update chat info (version, model, etc.)
   */
  setInfo(info: Partial<ChatInfo>): void {
    this.state.info = { ...this.state.info, ...info };
    this.emit({ type: "info", data: this.state.info });
  }

  /**
   * Add a message to the chat history
   */
  addMessage(message: Omit<ChatMessage, "id" | "timestamp">): ChatMessage {
    const fullMessage: ChatMessage = {
      ...message,
      id: this.messageIdCounter++,
      timestamp: Date.now(),
    };

    this.state.messages.push(fullMessage);
    this.emit({ type: "message", data: fullMessage });

    return fullMessage;
  }

  /**
   * Start streaming a new assistant message
   */
  startStreaming(): void {
    this.state.isStreaming = true;
    this.state.currentStreamingMessage = {
      id: this.messageIdCounter++,
      role: "assistant",
      content: "",
      timestamp: Date.now(),
    };

    this.emit({ type: "streaming_start", data: this.state.currentStreamingMessage });
  }

  /**
   * Append content to the currently streaming message
   */
  appendToStreaming(chunk: string): void {
    if (!this.state.currentStreamingMessage) {
      throw new Error("No streaming message in progress");
    }

    this.state.currentStreamingMessage.content += chunk;
    this.emit({
      type: "streaming_chunk",
      data: {
        chunk,
        message: this.state.currentStreamingMessage,
      },
    });
  }

  /**
   * Finish the currently streaming message and add it to history
   */
  finishStreaming(): ChatMessage | null {
    if (!this.state.currentStreamingMessage) {
      return null;
    }

    const message = this.state.currentStreamingMessage;
    this.state.messages.push(message);
    this.state.isStreaming = false;
    this.state.currentStreamingMessage = undefined;

    this.emit({ type: "streaming_end", data: message });
    this.emit({ type: "message", data: message });

    return message;
  }

  /**
   * Send a user message
   * Returns the created message object
   */
  sendMessage(content: string, metadata?: Record<string, unknown>): ChatMessage {
    return this.addMessage({
      role: "user",
      content,
      metadata,
    });
  }

  /**
   * Clear all messages
   */
  clear(): void {
    this.state.messages = [];
    this.state.currentStreamingMessage = undefined;
    this.state.isStreaming = false;
    this.messageIdCounter = 0;
  }

  /**
   * Get all messages
   */
  getMessages(): readonly ChatMessage[] {
    return [...this.state.messages];
  }

  /**
   * Get current status
   */
  getStatus(): Readonly<ChatStatus> {
    return { ...this.state.status };
  }

  /**
   * Get chat info
   */
  getInfo(): Readonly<ChatInfo> {
    return { ...this.state.info };
  }

  /**
   * Check if currently streaming
   */
  isStreamingMessage(): boolean {
    return this.state.isStreaming;
  }

  /**
   * Get the current streaming message
   */
  getCurrentStreamingMessage(): Readonly<ChatMessage> | null {
    return this.state.currentStreamingMessage ? { ...this.state.currentStreamingMessage } : null;
  }
}
