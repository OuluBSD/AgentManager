// src/commands/agent/project/current.ts
// Project current command handler

import { CommandHandler } from '../../../runtime/handler-registry';
import { ExecutionContext } from '../../../runtime/types';
import { ContextManager } from '../../../state/context-manager';

export class ProjectCurrentHandler implements CommandHandler {
  async execute(context: ExecutionContext): Promise<any> {
    try {
      // Get the context manager and retrieve the current context
      const contextManager = new ContextManager();
      const currentContext = await contextManager.load();
      
      if (!currentContext.activeProjectId) {
        throw new Error('No project is currently selected');
      }
      
      return {
        project: {
          id: currentContext.activeProjectId,
          name: currentContext.activeProjectName
        },
        context: {
          projectId: currentContext.activeProjectId,
          projectName: currentContext.activeProjectName,
          roadmapId: currentContext.activeRoadmapId,
          roadmapTitle: currentContext.activeRoadmapTitle,
          chatId: currentContext.activeChatId,
          chatTitle: currentContext.activeChatTitle
        }
      };
    } catch (error) {
      throw new Error(`Failed to retrieve current project: ${(error as Error).message}`);
    }
  }
}