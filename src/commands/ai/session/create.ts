// src/commands/ai/session/create.ts
// AI Session create command handler

import { ExecutionContext, CommandResult } from '../../../runtime/types';
import { SessionManager } from '../../../session/session-manager';
import { API_CLIENT } from '../../../api/client';

export class AISessionCreateHandler {
  async execute(context: ExecutionContext): Promise<CommandResult> {
    try {
      // Use the API client to create a new AI session
      const sessionResponse = await API_CLIENT.startAiChatSession();
      const sessionId = sessionResponse.sessionId;

      // Create the AI session in the session manager
      const sessionManager = new SessionManager();
      const aiSession = await sessionManager.createAiSession({
        context: context.contextState
      });

      return {
        status: 'ok',
        data: {
          sessionId: aiSession.sessionId,
          type: aiSession.type,
          createdAt: aiSession.createdAt
        },
        message: 'AI session created successfully',
        errors: []
      };
    } catch (error: any) {
      return {
        status: 'error',
        data: null,
        message: `Failed to create AI session: ${error.message}`,
        errors: [{
          type: 'SESSION_CREATE_ERROR',
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