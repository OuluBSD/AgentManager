// src/commands/agent/roadmap/view.ts
// Roadmap view command handler

import { CommandHandler } from '../../../runtime/handler-registry';
import { ExecutionContext } from '../../../runtime/types';
import { API_CLIENT } from '../../../api/client';

export class RoadmapViewHandler implements CommandHandler {
  async execute(context: ExecutionContext): Promise<any> {
    try {
      // Extract id or name from context flags
      const { id, name } = context.flags;

      // Determine which identifier to use
      const roadmapId = id || name;

      if (!roadmapId) {
        throw new Error('Either --id or --name must be provided to view a roadmap');
      }

      // Call API to get roadmap details
      const response = await API_CLIENT.getRoadmapById(roadmapId);

      if (response.status === 'error') {
        throw new Error(`Failed to retrieve roadmap: ${response.message}`);
      }

      if (!response.data.roadmap) {
        throw new Error(`Roadmap with id/name '${roadmapId}' not found`);
      }

      return {
        roadmap: response.data.roadmap
      };
    } catch (error) {
      throw new Error(`Failed to view roadmap: ${(error as Error).message}`);
    }
  }
}