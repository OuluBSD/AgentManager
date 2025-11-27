/**
 * Shared chat library for multi-backend AI integration
 * Supports: qwen, claude, gemini, codex
 * Can be used by both web (Next.js) and CLI frontends
 */

export * from "./types";
export * from "./QwenChatSession";
export * from "./AIBackend";
export * from "./GenericAIBackend";
