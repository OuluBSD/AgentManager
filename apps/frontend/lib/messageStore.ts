/**
 * Message Store - Proper data model for chat messages
 *
 * This class maintains a canonical representation of the conversation state
 * and handles all the complexity of streaming, tool execution, and deduplication.
 *
 * Key principles:
 * 1. Messages have stable IDs based on content, not auto-increment
 * 2. Events update the store, UI reads from the store
 * 3. Deduplication happens at the data layer, not UI layer
 * 4. Streaming messages are tracked separately until finalized
 */

export interface Message {
  id: string; // Stable ID (e.g., "assistant-1234567890", "tool-abc123")
  role: "user" | "assistant" | "system" | "tool";
  content: string;
  timestamp: number;
  displayRole?: string;
  metadata?: {
    isStreaming?: boolean;
    toolGroupId?: string;
    parentMessageId?: string; // For tool outputs that belong to a tool execution
  };
}

export interface MessageEvent {
  type: "user_input" | "assistant_chunk" | "assistant_final" | "tool_start" | "tool_output" | "tool_complete";
  timestamp: number;
  data: any;
}

/**
 * MessageStore manages the canonical message state
 */
export class MessageStore {
  private messages: Map<string, Message> = new Map();
  private messageOrder: string[] = []; // Ordered list of message IDs
  private streamingAssistantId: string | null = null;
  private streamingContent: string = "";
  private activeToolId: string | null = null;

  /**
   * Generate a stable message ID
   */
  private generateMessageId(role: string, timestamp: number, suffix?: string): string {
    const base = `${role}-${timestamp}`;
    return suffix ? `${base}-${suffix}` : base;
  }

  /**
   * Handle user input message
   */
  addUserMessage(content: string): Message {
    const timestamp = Date.now();
    const id = this.generateMessageId("user", timestamp);

    const message: Message = {
      id,
      role: "user",
      content,
      timestamp,
    };

    this.messages.set(id, message);
    this.messageOrder.push(id);

    return message;
  }

  /**
   * Handle assistant streaming chunk
   */
  addAssistantChunk(chunk: string): void {
    if (!this.streamingAssistantId) {
      // Start new streaming message
      const timestamp = Date.now();
      this.streamingAssistantId = this.generateMessageId("assistant", timestamp);
      this.streamingContent = chunk;

      const message: Message = {
        id: this.streamingAssistantId,
        role: "assistant",
        content: this.streamingContent,
        timestamp,
        metadata: { isStreaming: true },
      };

      this.messages.set(this.streamingAssistantId, message);
      this.messageOrder.push(this.streamingAssistantId);
    } else {
      // Append to existing streaming message
      this.streamingContent += chunk;
      const existingMessage = this.messages.get(this.streamingAssistantId);
      if (existingMessage) {
        existingMessage.content = this.streamingContent;
        existingMessage.metadata = { ...existingMessage.metadata, isStreaming: true };
      }
    }
  }

  /**
   * Finalize assistant streaming message
   */
  finalizeAssistantMessage(): Message | null {
    if (!this.streamingAssistantId) {
      return null;
    }

    const message = this.messages.get(this.streamingAssistantId);
    if (message) {
      message.metadata = { ...message.metadata, isStreaming: false };
    }

    this.streamingAssistantId = null;
    this.streamingContent = "";

    return message || null;
  }

  /**
   * Start a tool execution
   */
  startToolExecution(toolGroupId: string, tools: Array<{
    tool_name: string;
    args?: Record<string, any>;
    [key: string]: any;
  }>): Message {
    // Finalize any streaming assistant message first to maintain order
    this.finalizeAssistantMessage();

    const timestamp = Date.now();
    const id = this.generateMessageId("tool", timestamp, toolGroupId);

    // Format tool information
    const toolDetails = tools.map(tool => {
      const name = tool.tool_name || "tool";
      const args = tool.args || {};
      const command = args.command || args.cmd || args.input || "";
      return command ? `${command}` : name;
    }).join("\n");

    const displayRole = tools.length === 1
      ? this.formatToolName(tools[0].tool_name)
      : `${tools.length} tools`;

    const message: Message = {
      id,
      role: "tool",
      content: toolDetails,
      timestamp,
      displayRole,
      metadata: {
        toolGroupId,
      },
    };

    this.messages.set(id, message);
    this.messageOrder.push(id);
    this.activeToolId = id;

    return message;
  }

  /**
   * Add tool output to the active tool message
   */
  addToolOutput(output: string): void {
    if (!this.activeToolId) {
      console.warn("[MessageStore] No active tool to add output to");
      return;
    }

    const message = this.messages.get(this.activeToolId);
    if (!message) {
      console.warn("[MessageStore] Active tool message not found:", this.activeToolId);
      return;
    }

    // Check if output was already added (deduplication)
    if (message.content.includes(output.trim())) {
      console.log("[MessageStore] Skipping duplicate tool output");
      return;
    }

    // Append output to tool message
    const outputSection = message.content.includes("\n\nOutput:")
      ? `\n${output.trim()}`
      : `\n\nOutput:\n${output.trim()}`;

    message.content += outputSection;
  }

  /**
   * Complete tool execution
   */
  completeToolExecution(): void {
    this.activeToolId = null;
  }

  /**
   * Format tool name for display
   */
  private formatToolName(toolName: string): string {
    if (!toolName) return "tool";

    const name = toolName.toLowerCase();
    if (name.includes("shell") || name.includes("bash")) {
      return "Shell";
    }

    // Convert snake_case to Title Case
    return toolName
      .split("_")
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(" ");
  }

  /**
   * Get all messages in order
   */
  getMessages(): Message[] {
    return this.messageOrder
      .map(id => this.messages.get(id))
      .filter((msg): msg is Message => msg !== undefined);
  }

  /**
   * Get streaming content (for live display)
   */
  getStreamingContent(): { content: string; isStreaming: boolean } {
    return {
      content: this.streamingContent,
      isStreaming: this.streamingAssistantId !== null,
    };
  }

  /**
   * Clear all messages
   */
  clear(): void {
    this.messages.clear();
    this.messageOrder = [];
    this.streamingAssistantId = null;
    this.streamingContent = "";
    this.activeToolId = null;
  }

  /**
   * Get current state for debugging
   */
  getDebugState(): any {
    return {
      messageCount: this.messages.size,
      messageOrder: this.messageOrder,
      streamingAssistantId: this.streamingAssistantId,
      streamingContentLength: this.streamingContent.length,
      activeToolId: this.activeToolId,
    };
  }
}
