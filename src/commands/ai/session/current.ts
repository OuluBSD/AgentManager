// src/commands/ai/session/current.ts
// AI Session current command handler

import { ExecutionContext, CommandResult, CommandError } from '../../../runtime/types';
import { ContextManager } from '../../../state/context-manager';
import { SessionManager } from '../../../session/session-manager';

export class AISessionCurrentHandler {
  async execute(context: ExecutionContext): Promise<CommandResult> {
    try {
      const contextManager = new ContextManager();
      const currentSessionId = await contextManager.getAiSession();
      
      if (!currentSessionId) {
        return {
          status: 'error',
          data: null,
          message: 'No active AI session selected',
          errors: [{
            type: 'MISSING_REQUIRED_CONTEXT',
            message: 'No active AI session selected',
            details: { requiredContext: 'activeAiSession' }
          } as CommandError]
        };
      }

      // Get the full session details
      const sessionManager = new SessionManager();
      const aiSession = sessionManager.getAiSessionById(currentSessionId);
      
      if (!aiSession) {
        return {
          status: 'error',
          data: null,
          message: 'Current AI session not found',
          errors: [{
            type: 'UNKNOWN_SESSION',
            message: `Current AI session with ID ${currentSessionId} does not exist`,
            details: { sessionId: currentSessionId }
          } as CommandError]
        };
      }

      return {
        status: 'ok',
        data: {
          sessionId: aiSession.sessionId,
          type: aiSession.type,
          createdAt: aiSession.createdAt,
          messageCount: aiSession.messages.length
        },
        message: 'Current AI session retrieved successfully',
        errors: []
      };
    } catch (error: any) {
      return {
        status: 'error',
        data: null,
        message: `Failed to get current AI session: ${error.message}`,
        errors: [{
          type: 'SESSION_CURRENT_ERROR',
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