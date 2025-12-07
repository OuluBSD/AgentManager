// src/commands/auth/status.ts
// Handler for 'nexus auth status' command

import { getAuthStatus } from '../../state/auth-manager';

export class AuthStatusHandler {
  async execute(flags: Record<string, any>): Promise<any> {
    try {
      const authStatus = await getAuthStatus();
      
      let message = authStatus.loggedIn 
        ? `Logged in as ${authStatus.user?.username || 'user'}` 
        : 'Not logged in';
      
      return {
        status: 'ok',
        data: authStatus,
        message,
        errors: []
      };
    } catch (error: any) {
      return {
        status: 'error',
        data: null,
        message: error.message,
        errors: [{
          type: 'AUTH_STATUS_ERROR',
          message: error.message,
          timestamp: new Date().toISOString()
        }]
      };
    }
  }
}