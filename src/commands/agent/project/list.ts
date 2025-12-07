// src/commands/agent/project/list.ts
// Project list command handler

import { CommandHandler } from '../../../runtime/handler-registry';
import { ExecutionContext } from '../../../runtime/types';
import { API_CLIENT } from '../../../api/client';

export class ProjectListHandler implements CommandHandler {
  async execute(context: ExecutionContext): Promise<any> {
    try {
      // Extract filter and include-hidden flags from context
      const { filter, 'include-hidden': includeHidden } = context.flags;

      // Call API to get projects
      const response = await API_CLIENT.getProjects();

      if (response.status === 'error') {
        throw new Error(`Failed to retrieve projects: ${response.message}`);
      } else if (response.status === 'auth_error') {
        // Handle authentication error specifically
        throw new Error(`Authentication error: ${response.message}`);
      }

      // Filter projects if filter flag is provided
      let projects = response.data.projects;
      if (filter) {
        projects = projects.filter(project =>
          project.name.toLowerCase().includes(filter.toLowerCase()) ||
          project.category.toLowerCase().includes(filter.toLowerCase()) ||
          project.description.toLowerCase().includes(filter.toLowerCase())
        );
      }

      // If include-hidden is not set to true, filter out archived projects
      if (includeHidden !== true) {
        projects = projects.filter(project => project.status !== 'archived');
      }

      return {
        projects,
        count: projects.length
      };
    } catch (error) {
      throw new Error(`Failed to list projects: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
}