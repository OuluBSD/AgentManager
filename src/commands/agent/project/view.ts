// src/commands/agent/project/view.ts
// Project view command handler

import { CommandHandler } from '../../../runtime/handler-registry';
import { ExecutionContext } from '../../../runtime/types';
import { API_CLIENT } from '../../../api/client';

export class ProjectViewHandler implements CommandHandler {
  async execute(context: ExecutionContext): Promise<any> {
    try {
      // Extract id or name from context flags
      const { id, name } = context.flags;

      // Determine which identifier to use
      const projectId = id || name;

      if (!projectId) {
        throw new Error('Either --id or --name must be provided to view a project');
      }

      // Call API to get project details
      const response = await API_CLIENT.getProjectById(projectId);

      if (response.status === 'error') {
        throw new Error(`Failed to retrieve project: ${response.message}`);
      }

      if (!response.data.project) {
        throw new Error(`Project with id/name '${projectId}' not found`);
      }

      return {
        project: response.data.project
      };
    } catch (error) {
      throw new Error(`Failed to view project: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
}