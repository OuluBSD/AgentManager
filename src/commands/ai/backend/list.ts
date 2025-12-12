// src/commands/ai/backend/list.ts
// AI Backend list command handler

import { ExecutionContext, CommandResult } from '../../../runtime/types';
import { loadConfig } from '../../../state/config-store';

export class AIBackendListHandler {
  async execute(context: ExecutionContext): Promise<CommandResult> {
    try {
      // Load current config to get the active backend
      const config = await loadConfig();

      // Define available backends
      const availableBackends = [
        { name: 'qwen', status: 'active', description: 'Qwen AI backend' },
        { name: 'claude', status: 'available', description: 'Claude AI backend' },
        { name: 'gemini', status: 'available', description: 'Gemini AI backend' },
        { name: 'codex', status: 'available', description: 'Codex AI backend' }
      ];

      return {
        status: 'ok',
        data: {
          backends: availableBackends,
          activeBackend: config.defaultAiBackend || 'qwen'
        },
        message: 'Available AI backends listed successfully',
        errors: []
      };
    } catch (error: any) {
      return {
        status: 'error',
        data: null,
        message: `Failed to list AI backends: ${error.message}`,
        errors: [{
          type: 'BACKEND_LIST_ERROR',
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