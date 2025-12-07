// src/commands/auth/login.ts
// Handler for 'nexus auth login --username <u> --password <p>' command

import { APIClient } from '../../api/client';
import { setAuthToken } from '../../state/auth-manager';

export class AuthLoginHandler {
  async execute(flags: Record<string, any>): Promise<any> {
    try {
      const { username, password } = flags;

      // Use the API client to perform login
      const apiClient = new APIClient();
      const response = await apiClient.login(username, password);
      const { token, user } = response;

      // Store the authentication token
      await setAuthToken(token);

      return {
        status: 'ok',
        data: {
          user,
          loggedIn: true
        },
        message: `Logged in as ${username}`,
        errors: []
      };
    } catch (error: any) {
      return {
        status: 'error',
        data: null,
        message: error.message,
        errors: [{
          type: 'LOGIN_ERROR',
          message: error.message,
          timestamp: new Date().toISOString()
        }]
      };
    }
  }
}