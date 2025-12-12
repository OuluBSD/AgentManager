// src/commands/agent/chat/run-command.ts
// Chat run-command command handler - for AI-triggered command execution

import { ExecutionContext, CommandResult } from '../../../runtime/types';
import { ContextManager } from '../../../state/context-manager';
import { API_CLIENT } from '../../../api/client';

export class ChatRunCommandHandler {
  async execute(context: ExecutionContext): Promise<CommandResult> {
    try {
      const { command, 'chat-id': chatIdFromFlag, 'project-id': projectIdFromFlag } = context.flags;
      const { activeChatId, activeProjectId } = context.contextState || {};

      // Determine which chat and project to use
      const chatId = chatIdFromFlag || activeChatId;
      const projectId = projectIdFromFlag || activeProjectId;

      if (!chatId) {
        return {
          status: 'error',
          data: null,
          message: 'No active chat specified. Use --chat-id or make sure a chat is selected.',
          errors: [{
            type: 'MISSING_REQUIRED_CONTEXT',
            message: 'No active chat context available',
            details: { requiredContext: 'activeChat' }
          }]
        };
      }

      if (!projectId) {
        return {
          status: 'error',
          data: null,
          message: 'No active project specified. Use --project-id or make sure a project is selected.',
          errors: [{
            type: 'MISSING_REQUIRED_CONTEXT',
            message: 'No active project context available',
            details: { requiredContext: 'activeProject' }
          }]
        };
      }

      if (!command) {
        return {
          status: 'error',
          data: null,
          message: 'Command is required for execution.',
          errors: [{
            type: 'VALIDATION_ERROR',
            message: 'Command parameter is missing'
          }]
        };
      }

      // First, send the command request to the AI in the chat context
      const aiMessage = `Please execute the following command in the project: ${command}`;
      
      // Add the command request to the chat as a user message
      const chatResponse = await API_CLIENT.getChatById(chatId);
      if (chatResponse.status === 'error') {
        return {
          status: 'error',
          data: null,
          message: `Failed to get chat: ${chatResponse.message}`,
          errors: [{
            type: 'CHAT_RETRIEVAL_ERROR',
            message: chatResponse.message
          }]
        };
      }

      if (!chatResponse.data.chat) {
        return {
          status: 'error',
          data: null,
          message: `Chat with ID ${chatId} not found`,
          errors: [{
            type: 'CHAT_NOT_FOUND',
            message: `Chat with ID ${chatId} not found`
          }]
        };
      }

      // Add the command request message to the chat
      const chat = chatResponse.data.chat;
      if (!chat.messages) {
        chat.messages = [];
      }

      const newMessage = {
        id: chat.messages.length + 1,
        role: 'user',
        content: aiMessage,
        timestamp: Date.now(),
        metadata: { commandExecution: true, originalCommand: command },
        displayRole: 'User'
      };

      chat.messages.push(newMessage);

      // For the actual command execution, we need to call the backend API
      // This would typically be handled by the AI, but we'll execute directly
      // In a real implementation, the AI would recognize the command and execute it
      
      // For now, we'll simulate the AI recognizing the command and executing it via the API
      const apiResponse = await fetch(`${API_CLIENT['baseURL']}/terminal/execute`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${API_CLIENT['token'] || ''}`
        },
        body: JSON.stringify({
          command: command,
          projectId: projectId,
          cwd: context.flags.cwd || undefined
        })
      });

      if (!apiResponse.ok) {
        const errorData = await apiResponse.json().catch(() => ({}));
        return {
          status: 'error',
          data: null,
          message: `Failed to execute command: ${errorData.error?.message || 'Unknown error'}`,
          errors: [{
            type: 'COMMAND_EXECUTION_ERROR',
            message: errorData.error?.message || 'Unknown error'
          }]
        };
      }

      const result = await apiResponse.json();

      return {
        status: 'ok',
        data: { 
          commandId: result.commandId,
          chatId,
          projectId,
          command,
          message: `Command "${command}" executed successfully with ID: ${result.commandId}`
        },
        message: `Command "${command}" executed successfully in chat ${chatId}`,
        errors: []
      };
    } catch (error: any) {
      return {
        status: 'error',
        data: null,
        message: `Failed to run command in chat: ${error.message}`,
        errors: [{
          type: 'COMMAND_EXECUTION_ERROR',
          message: error.message
        }]
      };
    }
  }

  validate(args: any): any {
    if (!args.command) {
      throw new Error('Command is required for chat command execution');
    }

    return {
      isValid: true,
      args
    };
  }
}