// src/commands/debug/index.ts
// Debug namespace module entry point

import { DebugProcessListHandler } from './process/list';
import { DebugProcessViewHandler } from './process/view';
import { DebugProcessInspectHandler } from './process/inspect';
import { DebugProcessMonitorHandler } from './process/monitor';
import { DebugProcessKillHandler } from './process/kill';
import { DebugProcessLogsHandler } from './process/logs';

import { DebugLogTailHandler } from './log/tail';
import { DebugLogViewHandler } from './log/view';
import { DebugLogSearchHandler } from './log/search';

import { DebugWebSocketListHandler } from './websocket/list';
import { DebugWebSocketViewHandler } from './websocket/view';
import { DebugWebSocketStreamHandler } from './websocket/stream';

import { DebugPollListHandler } from './poll/list';
import { DebugPollViewHandler } from './poll/view';
import { DebugPollStreamHandler } from './poll/stream';

export const debugCommands = {
  process: {
    list: new DebugProcessListHandler(),
    view: new DebugProcessViewHandler(),
    inspect: new DebugProcessInspectHandler(),
    monitor: new DebugProcessMonitorHandler(),
    kill: new DebugProcessKillHandler(),
    logs: new DebugProcessLogsHandler(),
  },
  log: {
    tail: new DebugLogTailHandler(),
    view: new DebugLogViewHandler(),
    search: new DebugLogSearchHandler(),
  },
  websocket: {
    list: new DebugWebSocketListHandler(),
    view: new DebugWebSocketViewHandler(),
    stream: new DebugWebSocketStreamHandler(),
  },
  poll: {
    list: new DebugPollListHandler(),
    view: new DebugPollViewHandler(),
    stream: new DebugPollStreamHandler(),
  }
};