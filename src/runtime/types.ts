// src/runtime/types.ts
// Runtime types and interfaces

export interface ExecutionContext {
  args: Record<string, any>;
  flags: Record<string, any>;
  contextState: ContextState;    // Current context (project/roadmap/chat selections)
  session?: Session;             // Active session (if required by command)
  token?: string;                // Authentication token
  config: RuntimeConfig;         // Runtime configuration
}

export interface ContextState {
  activeProjectId?: string;
  activeProjectName?: string;
  activeProjectCategory?: string;
  activeProjectStatus?: string;
  activeRoadmapId?: string;
  activeRoadmapTitle?: string;
  activeChatId?: string;
  activeChatTitle?: string;
  lastUpdate: string;
}

export interface RuntimeConfig {
  // Configuration options for runtime
}

export interface Session {
  // Session interface as defined in session module
  sessionId: string;
  type: string;
  createdAt: string;
  status: string;
}

export interface CommandResult {
  status: 'ok' | 'error';
  data: any;
  message?: string;
  errors: CommandError[];
}

export interface CommandError {
  type: string;
  message: string;
  details?: any;
  timestamp?: string; // ISO string format with consistent timezone handling (optional for backward compatibility)
  stack?: string; // Optional stack trace for better debugging with source map support
  correlationId?: string; // Optional identifier to correlate related errors
  context?: {
    projectId?: string; // Optional project context for the error
    commandId?: string; // Optional command context for the error
    [key: string]: any; // Additional context properties
  };
}