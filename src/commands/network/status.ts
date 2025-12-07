// src/commands/network/status.ts
// Network status command handler

import { ExecutionContext } from '../../runtime/types';
import { API_CLIENT } from '../../api/client';
import { GetNetworkStatusResponse } from '../../api/types';

export class NetworkStatusHandler {
  async execute(context: ExecutionContext): Promise<any> {
    try {
      // Call the API client to get network status
      const response: GetNetworkStatusResponse = await API_CLIENT.getNetworkStatus();

      if (response.status === 'error') {
        return {
          status: 'error',
          data: null,
          message: response.message,
          errors: response.errors
        };
      }

      return {
        status: 'ok',
        data: {
          status: response.data.status
        },
        message: response.message,
        errors: []
      };
    } catch (error: any) {
      return {
        status: 'error',
        data: null,
        message: `Failed to get network status: ${error.message}`,
        errors: [{ message: error.message }]
      };
    }
  }

  validate(args: any): any {
    // This method is for validation, which is handled at the parser level
    // We return the basic validation result
    return {
      isValid: true,
      args
    };
  }
}