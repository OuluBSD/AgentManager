// src/commands/auth/logout.ts
// Handler for 'nexus auth logout' command

import { clearAuthToken } from '../../state/auth-manager';

export class AuthLogoutHandler {
  async execute(flags: Record<string, any>): Promise<any> {
    try {
      // Clear the authentication token
      await clearAuthToken();
      
      return {
        status: 'ok',
        data: { loggedIn: false },
        message: 'Logged out successfully',
        errors: []
      };
    } catch (error: any) {
      return {
        status: 'error',
        data: null,
        message: error.message,
        errors: [{
          type: 'LOGOUT_ERROR',
          message: error.message,
          timestamp: new Date().toISOString()
        }]
      };
    }
  }
}