export interface ObservabilityEvent {
  seq: number; // incrementing sequence number
  timestamp: string; // ISO8601
  source: "ai" | "process" | "websocket" | "poll" | "network";
  event: string; // "token", "log", "frame", "poll", "status", "error", "end", ...
  data?: any; // event payload
  message?: string; // optional human-readable message
  correlationId?: string; // optional identifier to correlate related events
  sourceId?: string; // optional identifier for the specific resource being monitored (process ID, network element, etc.)
  metadata: {
    commandId?: string; // recommended identifier for the command that generated this event (enhancement)
    projectId?: string; // optional identifier to track project context
    sessionTracking?: string; // optional identifier for session tracking
    performanceMetrics?: {
      durationMs: number; // how long the operation took
      startTime: string; // when the operation started (ISO8601)
      endTime: string; // when the operation ended (ISO8601)
    }; // optional performance metrics
    [key: string]: any;  // allow additional metadata properties
  };
}