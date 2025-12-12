// src/commands/agent/chat/list.ts
// Chat list command handler

import { CommandHandler } from '../../../runtime/handler-registry';
import { ExecutionContext } from '../../../runtime/types';
import { API_CLIENT } from '../../../api/client';
import { ContextManager } from '../../../state/context-manager';

export class ChatListHandler implements CommandHandler {
  async execute(context: ExecutionContext): Promise<any> {
    try {
      // Extract roadmap-id and type from context flags
      const { 'roadmap-id': explicitRoadmapId, type: filterType } = context.flags;

      // Get roadmap ID from either explicit flag or current context
      let roadmapId = explicitRoadmapId;
      if (!roadmapId) {
        // Get the context manager and verify roadmap context exists
        const contextManager = new ContextManager();
        const currentContext = await contextManager.load();

        if (!currentContext.activeRoadmapId) {
          throw new Error('No active roadmap selected. Use --roadmap-id or select a roadmap first.');
        }

        roadmapId = currentContext.activeRoadmapId;
      }

      // Call API to get chats for the roadmap
      const response = await API_CLIENT.getChats(roadmapId);

      if (response.status === 'error') {
        throw new Error(`Failed to retrieve chats: ${response.message}`);
      } else if (response.status === 'auth_error') {
        // Handle authentication error specifically
        throw new Error(`Authentication error: ${response.message}`);
      }

      // Get current context to determine selected chat
      const contextManager = new ContextManager();
      const currentContext = await contextManager.load();
      const selectedChatId = currentContext.activeChatId;

      // Add selected flag and parent references to each chat
      let chats = response.data.chats.map((chat: any) => ({
        ...chat,
        selected: chat.id === selectedChatId
      }));

      // Apply type filter if provided
      if (filterType) {
        chats = chats.filter((chat: any) => chat.type === filterType);
      }

      // Get the roadmap ID used for this list to include as parent reference
      return {
        chats,
        count: chats.length,
        roadmapId: roadmapId  // Include parent roadmap ID in response
      };
    } catch (error) {
      throw new Error(`Failed to list chats: ${(error as Error).message}`);
    }
  }

  validate(args: any): any {
    // Validate the type if provided
    if (args.type && !['regular', 'meta'].includes(args.type)) {
      throw new Error('Chat type filter must be either "regular" or "meta"');
    }

    return {
      isValid: true,
      args
    };
  }
}