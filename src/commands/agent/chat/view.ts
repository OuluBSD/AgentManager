// src/commands/agent/chat/view.ts
// Chat view command handler

import { CommandHandler } from '../../../runtime/handler-registry';
import { ExecutionContext } from '../../../runtime/types';
import { API_CLIENT } from '../../../api/client';

export class ChatViewHandler implements CommandHandler {
  async execute(context: ExecutionContext): Promise<any> {
    try {
      // Extract id or title from context flags
      const { id, title } = context.flags;

      // Determine which identifier to use
      const chatId = id || title;

      if (!chatId) {
        throw new Error('Either --id or --title must be provided to view a chat');
      }

      // Call API to get chat details
      const response = await API_CLIENT.getChatById(chatId);

      if (response.status === 'error') {
        throw new Error(`Failed to retrieve chat: ${response.message}`);
      }

      if (!response.data.chat) {
        throw new Error(`Chat with id/title '${chatId}' not found`);
      }

      return {
        chat: response.data.chat
      };
    } catch (error) {
      throw new Error(`Failed to view chat: ${(error as Error).message}`);
    }
  }
}