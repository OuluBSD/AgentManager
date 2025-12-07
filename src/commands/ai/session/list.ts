// src/commands/ai/session/list.ts
// AI Session list command handler

import { ExecutionContext, CommandResult } from '../../../runtime/types';
import { SessionManager } from '../../../session/session-manager';

export class AISessionListHandler {
  async execute(context: ExecutionContext): Promise<CommandResult> {
    try {
      const sessionManager = new SessionManager();
      const aiSessions = sessionManager.getAiSessions();

      return {
        status: 'ok',
        data: {
          sessions: aiSessions.map(session => ({
            sessionId: session.sessionId,
            type: session.type,
            createdAt: session.createdAt,
            messageCount: session.messages.length
          }))
        },
        message: 'AI sessions retrieved successfully',
        errors: []
      };
    } catch (error: any) {
      return {
        status: 'error',
        data: null,
        message: `Failed to list AI sessions: ${error.message}`,
        errors: [{
          type: 'SESSION_LIST_ERROR',
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