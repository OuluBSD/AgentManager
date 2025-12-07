// src/commands/network/element/list.ts
// Network element list command handler

import { ExecutionContext } from '../../../runtime/types';
import { API_CLIENT } from '../../../api/client';
import { ListNetworkElementsResponse } from '../../../api/types';

export class NetworkElementListHandler {
  async execute(context: ExecutionContext): Promise<any> {
    try {
      // Extract filter flags from context
      const filterType = context.flags['filter-type'] || undefined;
      const filterStatus = context.flags['filter-status'] || undefined;
      
      const filters: { type?: string; status?: string } = {};
      if (filterType) filters.type = filterType;
      if (filterStatus) filters.status = filterStatus;

      // Call the API client to get network elements
      const response: ListNetworkElementsResponse = await API_CLIENT.getNetworkElements(filters);

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
          elements: response.data.elements
        },
        message: response.message,
        errors: []
      };
    } catch (error: any) {
      return {
        status: 'error',
        data: null,
        message: `Failed to list network elements: ${error.message}`,
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