// src/commands/agent/chat/list.ts
// Chat list command handler

import { CommandHandler } from '../../../runtime/handler-registry';
import { ExecutionContext } from '../../../runtime/types';
import { API_CLIENT } from '../../../api/client';
import { ContextManager } from '../../../state/context-manager';

export class ChatListHandler implements CommandHandler {
  async execute(context: ExecutionContext): Promise<any> {
    try {
      // Extract roadmap-id from context flags
      const { 'roadmap-id': explicitRoadmapId } = context.flags;

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
      }

      return {
        chats: response.data.chats
      };
    } catch (error) {
      throw new Error(`Failed to list chats: ${(error as Error).message}`);
    }
  }
}