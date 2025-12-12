// src/commands/ai/backend/status.ts
// AI Backend status command handler

import { ExecutionContext, CommandResult } from '../../../runtime/types';
import { loadConfig } from '../../../state/config-store';

export class AIBackendStatusHandler {
  async execute(context: ExecutionContext): Promise<CommandResult> {
    try {
      // Load current config to get the active backend
      const config = await loadConfig();

      // Determine current backend (use default if not explicitly set)
      const currentBackend = config.defaultAiBackend || 'qwen';

      // For now, we'll just return status info about the backend
      // In a real implementation, we might check if the backend service is actually running
      const backendStatus = {
        backend: currentBackend,
        status: 'configured', // Would be 'running', 'stopped', or 'error' in a real implementation
        configured: true,
        capabilities: ['chat', 'streaming', 'tools'] // Common capabilities
      };

      return {
        status: 'ok',
        data: backendStatus,
        message: `Status for AI backend: ${currentBackend}`,
        errors: []
      };
    } catch (error: any) {
      return {
        status: 'error',
        data: null,
        message: `Failed to get AI backend status: ${error.message}`,
        errors: [{
          type: 'BACKEND_STATUS_ERROR',
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