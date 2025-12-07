// src/commands/debug/poll/stream.ts
// Handler for streaming poll session events

import { ExecutionContext, CommandResult } from '../../../runtime/types.js';
import { API_CLIENT } from '../../../api/client.js';

export class DebugPollStreamHandler {
  async execute(context: ExecutionContext): Promise<CommandResult | AsyncGenerator<any>> {
    const { flags } = context;

    // Validate ID is provided
    const pollId = flags.id as string;
    if (!pollId) {
      return {
        status: 'error',
        data: null,
        message: 'Poll Session ID is required (--id)',
        errors: [{
          type: 'VALIDATION_ERROR',
          message: 'Poll Session ID is required'
        }]
      };
    }

    // Return the streaming generator directly without try/catch
    // The runtime engine will handle the streaming
    return API_CLIENT.streamPollEvents(pollId);
  }
}