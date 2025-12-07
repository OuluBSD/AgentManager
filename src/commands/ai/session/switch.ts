// src/commands/ai/session/select.ts
// AI Session select command handler

import { ExecutionContext, CommandResult, CommandError } from '../../../runtime/types';
import { SessionManager } from '../../../session/session-manager';
import { ContextManager } from '../../../state/context-manager';

export class AISessionSelectHandler {
  async execute(context: ExecutionContext): Promise<CommandResult> {
    try {
      const { flags } = context;
      const sessionId = flags.id;

      // Check if the session exists
      const sessionManager = new SessionManager();
      const aiSession = sessionManager.getAiSessionById(sessionId);

      if (!aiSession) {
        return {
          status: 'error',
          data: null,
          message: 'AI session not found',
          errors: [{
            type: 'UNKNOWN_SESSION',
            message: `AI session with ID ${sessionId} does not exist`,
            details: { sessionId }
          } as CommandError]
        };
      }

      // Set the selected AI session in context
      const contextManager = new ContextManager();
      const newContext = await contextManager.setAiSession(sessionId);

      return {
        status: 'ok',
        data: {
          selectedSessionId: sessionId,
          context: newContext
        },
        message: 'AI session selected successfully',
        errors: []
      };
    } catch (error: any) {
      return {
        status: 'error',
        data: null,
        message: `Failed to select AI session: ${error.message}`,
        errors: [{
          type: 'SESSION_SELECT_ERROR',
          message: error.message
        } as CommandError]
      };
    }
  }

  validate(args: any): any {
    // No additional validation needed beyond what's in the validator
    return { valid: true, errors: [] };
  }
}