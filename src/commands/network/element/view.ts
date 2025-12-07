// src/commands/network/element/view.ts
// Network element view command handler

import { ExecutionContext } from '../../../runtime/types';
import { API_CLIENT } from '../../../api/client';
import { GetNetworkElementResponse } from '../../../api/types';

export class NetworkElementViewHandler {
  async execute(context: ExecutionContext): Promise<any> {
    try {
      // Extract the ID flag from context
      const elementId = context.flags.id;

      if (!elementId) {
        return {
          status: 'error',
          data: null,
          message: 'Missing required --id flag for network element view',
          errors: [{ message: 'MISSING_REQUIRED_FLAG: --id is required' }]
        };
      }

      // Call the API client to get network element by ID
      const response: GetNetworkElementResponse = await API_CLIENT.getNetworkElementById(elementId);

      if (response.status === 'error') {
        // Handle the case where the element is not found
        if (response.errors.some(err => err.message.includes('NETWORK_ELEMENT_NOT_FOUND'))) {
          return {
            status: 'error',
            data: null,
            message: response.message,
            errors: [{ type: 'NETWORK_ELEMENT_NOT_FOUND', message: response.errors[0].message }]
          };
        }

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
          element: response.data.element
        },
        message: response.message,
        errors: []
      };
    } catch (error: any) {
      return {
        status: 'error',
        data: null,
        message: `Failed to view network element: ${error.message}`,
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