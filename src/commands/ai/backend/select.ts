// src/commands/ai/backend/select.ts
// AI Backend select command handler

import { ExecutionContext, CommandResult } from '../../../runtime/types';
import { loadConfig, saveConfig } from '../../../state/config-store';

export class AIBackendSelectHandler {
  async execute(context: ExecutionContext): Promise<CommandResult> {
    try {
      const { args } = context;
      const backend = args._[2]; // Get backend from command args (nexus ai backend select <backend>)

      if (!backend) {
        return {
          status: 'error',
          data: null,
          message: 'Backend name is required. Usage: nexus ai backend select <backend>',
          errors: [{
            type: 'VALIDATION_ERROR',
            message: 'Backend name is required'
          }]
        };
      }

      // Validate that the backend type is supported
      const validBackends = ['qwen', 'claude', 'gemini', 'codex'];
      if (!validBackends.includes(backend)) {
        return {
          status: 'error',
          data: null,
          message: `Invalid backend: ${backend}. Valid options are: ${validBackends.join(', ')}`,
          errors: [{
            type: 'VALIDATION_ERROR',
            message: `Invalid backend: ${backend}`
          }]
        };
      }

      // Load current config
      const config = await loadConfig();

      // Update the default backend
      config.defaultAiBackend = backend;

      // Save the updated config
      await saveConfig(config);

      return {
        status: 'ok',
        data: {
          selectedBackend: backend,
          previousBackend: config.defaultAiBackend !== backend ? 'qwen' : config.defaultAiBackend // Simplified for this example
        },
        message: `AI backend changed to ${backend}`,
        errors: []
      };
    } catch (error: any) {
      return {
        status: 'error',
        data: null,
        message: `Failed to select AI backend: ${error.message}`,
        errors: [{
          type: 'BACKEND_SELECT_ERROR',
          message: error.message
        }]
      };
    }
  }

  validate(args: any): any {
    // No additional validation needed beyond what's in the validator
    return { valid: true, errors: [] };
  }
}