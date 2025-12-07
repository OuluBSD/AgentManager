// src/commands/agent/chat/select.ts
// Chat select command handler

import { CommandHandler } from '../../../runtime/handler-registry';
import { ExecutionContext } from '../../../runtime/types';
import { API_CLIENT } from '../../../api/client';
import { ContextManager } from '../../../state/context-manager';

export class ChatSelectHandler implements CommandHandler {
  async execute(context: ExecutionContext): Promise<any> {
    try {
      // Extract id or title from context flags
      const { id, title } = context.flags;

      // Determine which identifier to use
      const chatId = id || title;

      if (!chatId) {
        throw new Error('Either --id or --title must be provided to select a chat');
      }

      // Verify the chat exists by fetching its details
      const response = await API_CLIENT.getChatById(chatId);

      if (response.status === 'error') {
        throw new Error(`Failed to find chat: ${response.message}`);
      }

      if (!response.data.chat) {
        throw new Error(`Chat with id/title '${chatId}' not found`);
      }

      // Get the context manager and update the selected chat
      const contextManager = new ContextManager();
      const newContext = await contextManager.selectChat(
        response.data.chat.id,
        response.data.chat.title
      );

      return {
        chat: {
          id: response.data.chat.id,
          title: response.data.chat.title
        },
        context: {
          projectId: newContext.activeProjectId,
          projectName: newContext.activeProjectName,
          roadmapId: newContext.activeRoadmapId,
          roadmapTitle: newContext.activeRoadmapTitle,
          chatId: newContext.activeChatId,
          chatTitle: newContext.activeChatTitle
        }
      };
    } catch (error) {
      throw new Error(`Failed to select chat: ${(error as Error).message}`);
    }
  }
}