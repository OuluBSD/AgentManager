// src/commands/agent/project/select.ts
// Project select command handler

import { CommandHandler } from '../../../runtime/handler-registry';
import { ExecutionContext } from '../../../runtime/types';
import { API_CLIENT } from '../../../api/client';
import { ContextManager } from '../../../state/context-manager';

export class ProjectSelectHandler implements CommandHandler {
  async execute(context: ExecutionContext): Promise<any> {
    try {
      // Extract id or name from context flags
      const { id, name } = context.flags;

      // Determine which identifier to use
      const projectId = id || name;

      if (!projectId) {
        throw new Error('Either --id or --name must be provided to select a project');
      }

      // Verify the project exists by fetching its details
      const response = await API_CLIENT.getProjectById(projectId);

      if (response.status === 'error') {
        throw new Error(`Failed to find project: ${response.message}`);
      }

      if (!response.data.project) {
        throw new Error(`Project with id/name '${projectId}' not found`);
      }

      // Get the context manager and update the selected project
      const contextManager = new ContextManager();
      const newContext = await contextManager.selectProject(
        response.data.project.id,
        response.data.project.name
      );

      return {
        project: {
          id: response.data.project.id,
          name: response.data.project.name
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
      throw new Error(`Failed to select project: ${(error as Error).message}`);
    }
  }
}