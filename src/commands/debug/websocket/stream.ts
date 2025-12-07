// src/commands/debug/websocket/stream.ts
// Handler for streaming WebSocket frames

import { ExecutionContext, CommandResult } from '../../../runtime/types.js';
import { API_CLIENT } from '../../../api/client.js';

export class DebugWebSocketStreamHandler {
  async execute(context: ExecutionContext): Promise<CommandResult | AsyncGenerator<any>> {
    const { flags } = context;

    // Validate ID is provided
    const wsId = flags.id as string;
    if (!wsId) {
      return {
        status: 'error',
        data: null,
        message: 'WebSocket ID is required (--id)',
        errors: [{
          type: 'VALIDATION_ERROR',
          message: 'WebSocket ID is required'
        }]
      };
    }

    // Return the streaming generator directly without try/catch
    // The runtime engine will handle the streaming
    return API_CLIENT.streamWebSocketFrames(wsId);
  }
}