// src/commands/debug/process/logs.ts
// Handler for streaming process logs

import { ExecutionContext, CommandResult } from '../../../runtime/types.js';
import { API_CLIENT } from '../../../api/client.js';

export class DebugProcessLogsHandler {
  async execute(context: ExecutionContext): Promise<CommandResult | AsyncGenerator<any>> {
    const { flags } = context;

    // Validate ID is provided
    const processId = flags.id as string;
    if (!processId) {
      return {
        status: 'error',
        data: null,
        message: 'Process ID is required (--id)',
        errors: [{
          type: 'VALIDATION_ERROR',
          message: 'Process ID is required'
        }]
      };
    }

    // Return the streaming generator directly without try/catch
    // The runtime engine will handle the streaming
    return API_CLIENT.streamProcessLogs(processId);
  }
}