import { EventEmitter } from "events";

/**
 * Event bus for broadcasting application-level events
 * Used for real-time notifications to WebSocket clients
 */
export class AppEventBus extends EventEmitter {
  constructor() {
    super();
    this.setMaxListeners(100); // Allow many WebSocket connections
  }

  // Meta-chat events
  emitMetaChatUpdated(
    roadmapId: string,
    data: { status: string; progress: number; summary: string }
  ) {
    this.emit("meta-chat:updated", { roadmapId, ...data });
  }

  onMetaChatUpdated(
    listener: (data: {
      roadmapId: string;
      status: string;
      progress: number;
      summary: string;
    }) => void
  ) {
    this.on("meta-chat:updated", listener);
    return () => this.off("meta-chat:updated", listener);
  }

  // Meta-chat message events
  emitMetaChatMessage(metaChatId: string, message: { id: string; role: string; content: string }) {
    this.emit("meta-chat:message", { metaChatId, message });
  }

  onMetaChatMessage(
    listener: (data: {
      metaChatId: string;
      message: { id: string; role: string; content: string };
    }) => void
  ) {
    this.on("meta-chat:message", listener);
    return () => this.off("meta-chat:message", listener);
  }

  // Chat status events
  emitChatStatusUpdated(
    chatId: string,
    roadmapId: string,
    data: { status: string; progress: number }
  ) {
    this.emit("chat:status", { chatId, roadmapId, ...data });
  }

  onChatStatusUpdated(
    listener: (data: {
      chatId: string;
      roadmapId: string;
      status: string;
      progress: number;
    }) => void
  ) {
    this.on("chat:status", listener);
    return () => this.off("chat:status", listener);
  }
}

// Singleton instance
export const eventBus = new AppEventBus();
