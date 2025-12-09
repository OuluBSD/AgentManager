// src/commands/system/chat-smoke.ts
// Chat smoke test command - performs a minimal chat send to verify functionality

import { CommandHandler } from '../../runtime/handler-registry';
import { ExecutionContext, CommandResult } from '../../runtime/types';
import { API_CLIENT } from '../../api/client';
import { ObservabilityEvent } from '../../observability/types';
import { SessionManager } from '../../session/session-manager';

export class SystemChatSmokeHandler implements CommandHandler {
  async execute(_ctx: ExecutionContext): Promise<CommandResult> {
    try {
      // Initialize the API client
      await API_CLIENT.initialize();
      
      // Create a minimal AI session
      const sessionResponse = await API_CLIENT.startAiChatSession();
      const sessionId = sessionResponse.sessionId;

      if (!sessionId) {
        return {
          status: 'error',
          data: null,
          message: 'Failed to create AI session for smoke test',
          errors: [{
            type: 'CHAT_SMOKE_TEST_ERROR',
            message: 'Could not initialize AI session'
          }]
        };
      }

      // Prepare a minimal test message
      const testMessage = 'This is a smoke test message to verify chat functionality.';

      // Execute the send operation, which will return a generator for the streaming tokens
      const generator = API_CLIENT.sendAiChatMessage(sessionId, testMessage);

      // Consume the first few tokens to verify streaming works
      const results: any[] = [];
      let count = 0;
      
      try {
        for await (const token of generator) {
          results.push(token);
          count++;
          
          // Stop after receiving a few tokens to keep the test quick
          if (count >= 3) {
            break;
          }
        }
      } catch (streamError) {
        return {
          status: 'error',
          data: null,
          message: `Chat smoke test failed during streaming: ${(streamError as Error).message}`,
          errors: [{
            type: 'CHAT_STREAM_ERROR',
            message: (streamError as Error).message
          }]
        };
      }

      // Verify we got some results back
      if (results.length === 0) {
        return {
          status: 'error',
          data: null,
          message: 'Chat smoke test ran but received no response tokens',
          errors: [{
            type: 'NO_RESPONSE_TOKENS',
            message: 'No tokens received from chat backend'
          }]
        };
      }

      // Success case - return standardized JSON result
      return {
        status: 'ok',
        data: {
          sessionId,
          tokensReceived: results.length,
          events: results,
          message: 'Chat smoke test completed successfully'
        },
        message: 'Chat smoke test passed - message sent and received response',
        errors: []
      };
    } catch (error: any) {
      return {
        status: 'error',
        data: null,
        message: `Chat smoke test failed: ${error.message}`,
        errors: [{
          type: 'CHAT_SMOKE_TEST_ERROR',
          message: error.message
        }]
      };
    }
  }

  validate(_args: any): any {
    // No validation needed for this command
    return {
      isValid: true,
      args: _args
    };
  }
}