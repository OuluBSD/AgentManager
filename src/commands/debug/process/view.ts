// src/commands/debug/process/view.ts
// Debug Process view command handler

import { API_CLIENT } from '../../../api/client';
import { GetProcessResponse } from '../../../api/types';

export class DebugProcessViewHandler {
  async execute(context: any): Promise<any> {
    const { id } = context.flags;

    // Check if required flag 'id' is provided
    if (!id) {
      return {
        status: 'error',
        data: null,
        message: 'Missing required flag: --id',
        errors: [{ code: 'MISSING_REQUIRED_FLAG', message: 'Missing required flag: --id' }]
      };
    }

    try {
      const response: GetProcessResponse = await API_CLIENT.getProcessById(id);

      if (response.status === 'ok' && response.data.process) {
        return {
          status: 'ok',
          data: {
            process: response.data.process
          },
          message: response.message,
          errors: []
        };
      } else if (response.status === 'error') {
        // Check if it's a "not found" error
        if (response.message && response.message.includes('not found')) {
          return {
            status: 'error',
            data: null,
            message: `Process with id ${id} not found`,
            errors: [{ code: 'NOT_FOUND', id }]
          };
        } else {
          // Return other errors as they are
          return {
            status: 'error',
            data: null,
            message: response.message,
            errors: response.errors
          };
        }
      }
    } catch (error) {
      return {
        status: 'error',
        data: null,
        message: `Failed to retrieve process with id ${id}`,
        errors: [{ code: 'API_ERROR', message: error instanceof Error ? error.message : 'Unknown error' }]
      };
    }
  }

  validate(args: any): any {
    // Check if required flag 'id' is provided
    if (!args.flags || !args.flags.id) {
      return {
        error: true,
        code: 'MISSING_REQUIRED_FLAG',
        message: 'Missing required flag: --id',
        details: {
          command: 'debug.process.view'
        }
      };
    }

    // Validate flags
    const validFlags = ['id', 'pid'];
    const providedFlags = Object.keys(args.flags || {});

    for (const flag of providedFlags) {
      if (!validFlags.includes(flag)) {
        return {
          error: true,
          code: 'UNKNOWN_FLAG',
          message: `Unknown flag: --${flag}`,
          details: {
            command: 'debug.process.view',
            availableFlags: validFlags
          }
        };
      }
    }

    return { error: false };
  }
}