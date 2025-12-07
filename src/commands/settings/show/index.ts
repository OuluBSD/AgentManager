// src/commands/settings/show/index.ts
// Handler for 'nexus settings show' command

import { loadConfig } from '../../../state/config-store';

export class SettingsShowHandler {
  async execute(flags: Record<string, any>): Promise<any> {
    try {
      const config = await loadConfig();
      
      return {
        status: 'ok',
        data: { config },
        message: 'Current configuration loaded successfully',
        errors: []
      };
    } catch (error: any) {
      return {
        status: 'error',
        data: null,
        message: error.message,
        errors: [{
          type: 'CONFIG_LOAD_ERROR',
          message: error.message,
          timestamp: new Date().toISOString()
        }]
      };
    }
  }
}