// src/commands/settings/reset/index.ts
// Handler for 'nexus settings reset --key <key>' or 'nexus settings reset --all' command

import { resetConfigKey, resetAllConfig, loadConfig } from '../../../state/config-store';

export class SettingsResetHandler {
  async execute(flags: Record<string, any>): Promise<any> {
    try {
      if (flags.all) {
        // Reset all configuration to defaults
        const config = await resetAllConfig();
        
        return {
          status: 'ok',
          data: { config },
          message: 'All configuration reset to defaults',
          errors: []
        };
      } else if (flags.key) {
        // Reset specific key
        const config = await resetConfigKey(flags.key);
        
        return {
          status: 'ok',
          data: { config },
          message: `Configuration key '${flags.key}' reset to default`,
          errors: []
        };
      } else {
        return {
          status: 'error',
          data: null,
          message: 'Either --key or --all flag is required',
          errors: [{
            type: 'MISSING_REQUIRED_FLAG',
            message: 'Must specify either --key or --all',
            timestamp: new Date().toISOString()
          }]
        };
      }
    } catch (error: any) {
      return {
        status: 'error',
        data: null,
        message: error.message,
        errors: [{
          type: 'CONFIG_RESET_ERROR',
          message: error.message,
          timestamp: new Date().toISOString()
        }]
      };
    }
  }
}