/**
 * Shared chat types for Qwen AI integration
 * These types are used by both web and CLI frontends
 */

export interface ChatMessage {
  id: number;
  role: "user" | "assistant" | "system" | "status";
  content: string;
  timestamp: number;
  metadata?: Record<string, unknown>;
}

export interface ChatStatus {
  state: "idle" | "connecting" | "responding" | "waiting_for_confirmation" | "error";
  message?: string;
  thought?: string;
}

export interface ChatInfo {
  version?: string;
  model?: string;
  workspaceRoot?: string;
}

export interface ChatState {
  messages: ChatMessage[];
  status: ChatStatus;
  info: ChatInfo;
  isStreaming: boolean;
  currentStreamingMessage?: ChatMessage;
}

export type ChatEventType =
  | "message"
  | "status"
  | "info"
  | "error"
  | "connected"
  | "disconnected"
  | "streaming_start"
  | "streaming_chunk"
  | "streaming_end";

export interface ChatEvent {
  type: ChatEventType;
  data: unknown;
}

export type ChatEventHandler = (event: ChatEvent) => void;
