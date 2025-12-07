// src/commands/settings/set/index.ts
// Handler for 'nexus settings set --key <key> --value <value>' command

import { loadConfig, saveConfig, isValidConfigKey, ALLOWED_CONFIG_KEYS } from '../../../state/config-store';

export class SettingsSetHandler {
  async execute(flags: Record<string, any>): Promise<any> {
    try {
      const { key, value } = flags;
      
      // Validate key is allowed
      if (!isValidConfigKey(key)) {
        return {
          status: 'error',
          data: null,
          message: `Unknown configuration key: ${key}. Allowed keys: ${ALLOWED_CONFIG_KEYS.join(', ')}`,
          errors: [{
            type: 'INVALID_CONFIG_KEY',
            message: `Key ${key} is not allowed. Valid keys are: ${ALLOWED_CONFIG_KEYS.join(', ')}`,
            timestamp: new Date().toISOString()
          }]
        };
      }
      
      // Load current config
      const config = await loadConfig();
      
      // Set the new value based on the type
      if (typeof config[key] === 'boolean') {
        // For boolean values, parse the string representation
        if (value.toLowerCase() === 'true' || value === '1' || value.toLowerCase() === 'yes') {
          (config as any)[key] = true;
        } else if (value.toLowerCase() === 'false' || value === '0' || value.toLowerCase() === 'no') {
          (config as any)[key] = false;
        } else {
          return {
            status: 'error',
            data: null,
            message: `Invalid boolean value: ${value}. Expected: true/false, yes/no, 1/0`,
            errors: [{
              type: 'INVALID_BOOLEAN_VALUE',
              message: `Expected boolean value, got: ${value}`,
              timestamp: new Date().toISOString()
            }]
          };
        }
      } else if (typeof config[key] === 'number') {
        const numValue = Number(value);
        if (isNaN(numValue)) {
          return {
            status: 'error',
            data: null,
            message: `Invalid number value: ${value}`,
            errors: [{
              type: 'INVALID_NUMBER_VALUE',
              message: `Expected number value, got: ${value}`,
              timestamp: new Date().toISOString()
            }]
          };
        }
        (config as any)[key] = numValue;
      } else if (key === 'outputMode' && !['json', 'pretty'].includes(value)) {
        return {
          status: 'error',
          data: null,
          message: `Invalid output mode: ${value}. Expected: json or pretty`,
          errors: [{
            type: 'INVALID_OUTPUT_MODE',
            message: `Expected 'json' or 'pretty', got: ${value}`,
            timestamp: new Date().toISOString()
          }]
        };
      } else if (key === 'themeMode' && !['auto', 'dark', 'light'].includes(value)) {
        return {
          status: 'error',
          data: null,
          message: `Invalid theme mode: ${value}. Expected: auto, dark, or light`,
          errors: [{
            type: 'INVALID_THEME_MODE',
            message: `Expected 'auto', 'dark', or 'light', got: ${value}`,
            timestamp: new Date().toISOString()
          }]
        };
      } else {
        // For string values, just assign directly
        (config as any)[key] = value;
      }
      
      // Save the updated config
      await saveConfig(config);
      
      return {
        status: 'ok',
        data: { config },
        message: `Configuration updated: ${key} = ${config[key]}`,
        errors: []
      };
    } catch (error: any) {
      return {
        status: 'error',
        data: null,
        message: error.message,
        errors: [{
          type: 'CONFIG_SET_ERROR',
          message: error.message,
          timestamp: new Date().toISOString()
        }]
      };
    }
  }
}