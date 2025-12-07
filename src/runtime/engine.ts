// src/runtime/engine.ts
// Main runtime engine

import { ValidatedCommand } from '../parser/index';
import { ExecutionContext, ContextState, CommandResult, CommandError } from './types';
import { handlerRegistry } from './handler-registry';
import { ContextManager } from '../state/context-manager';

export class RuntimeEngine {
  async executeCommand(validated: ValidatedCommand): Promise<CommandResult> {
    // Find the appropriate handler for this command
    const handler = handlerRegistry.findHandler(validated.commandId);

    if (!handler) {
      return {
        status: 'error',
        data: null,
        message: `No handler found for command: ${validated.commandId}`,
        errors: [{
          type: 'HANDLER_NOT_FOUND',
          message: `Command handler not implemented: ${validated.commandId}`
        } as CommandError]
      };
    }

    // Check if the command requires specific context and verify it's available
    if (validated.contextRequired && validated.contextRequired.length > 0) {
      const contextManager = new ContextManager();

      for (const requiredContext of validated.contextRequired) {
        let hasContext = false;

        switch (requiredContext) {
          case 'activeProject':
            hasContext = await contextManager.hasProjectContext();
            break;
          case 'activeRoadmap':
            hasContext = await contextManager.hasRoadmapContext();
            break;
          case 'activeChat':
            hasContext = await contextManager.hasChatContext();
            break;
          case 'activeAiSession':
            hasContext = await contextManager.hasAiSessionContext();
            break;
          case 'authenticated':
            // For now, we'll assume authentication is always available
            hasContext = true;
            break;
          default:
            // If we encounter an unknown context requirement, let it pass for now
            hasContext = true;
        }

        if (!hasContext) {
          return {
            status: 'error',
            data: null,
            message: `Missing required context: ${requiredContext}. Please set the required context before running this command.`,
            errors: [{
              type: 'MISSING_REQUIRED_CONTEXT',
              message: `Command ${validated.commandId} requires ${requiredContext} context`,
              details: { requiredContext, commandId: validated.commandId }
            } as CommandError]
          };
        }
      }
    }

    // Create execution context
    const contextState = await (new ContextManager()).load();
    const context: ExecutionContext = {
      args: validated.args,
      flags: validated.flags,
      contextState,
      config: {} // Runtime config
    };

    try {
      // Execute the command through the handler, but don't await yet
      const executionResult = (handler.execute(context) as any);

      // Check if the result is an AsyncGenerator (streaming)
      if (executionResult && typeof executionResult === 'object' && executionResult[Symbol.asyncIterator]) {
        // Handle streaming generator
        for await (const event of executionResult) {
          // Print each event as a JSON line for streaming
          console.log(JSON.stringify(event));
        }
        // Return a final success result after streaming completes
        return {
          status: 'ok',
          data: null,
          message: `Command ${validated.commandId} executed successfully`,
          errors: []
        };
      } else {
        // Handle regular (non-streaming) result - it might be a promise
        const resolvedResult = await executionResult;
        return {
          status: 'ok',
          data: resolvedResult,
          message: `Command ${validated.commandId} executed successfully`,
          errors: []
        };
      }
    } catch (error: any) {
      // Handle any execution errors
      return {
        status: 'error',
        data: null,
        message: `Execution error for command ${validated.commandId}: ${error.message}`,
        errors: [{
          type: 'EXECUTION_ERROR',
          message: error.message
        } as CommandError]
      };
    }
  }
}

export async function executeCommand(validated: ValidatedCommand): Promise<CommandResult> {
  const engine = new RuntimeEngine();
  return await engine.executeCommand(validated);
}