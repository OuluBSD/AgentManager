// src/state/context-storage.ts
// Context storage implementation

import { ContextState } from './context-types';

export class ContextStorage {
  private memoryContext: ContextState = {
    activeProjectId: undefined,
    activeProjectName: undefined,
    activeRoadmapId: undefined,
    activeRoadmapTitle: undefined,
    activeChatId: undefined,
    activeChatTitle: undefined,
    selectedAiSessionId: undefined,
    selectedNetworkElementId: undefined,
    lastUpdate: new Date().toISOString()
  };

  async read(): Promise<ContextState> {
    return { ...this.memoryContext };
  }

  async write(context: ContextState): Promise<void> {
    this.memoryContext = { ...context, lastUpdate: new Date().toISOString() };
  }

  // Helper method to update only specific fields
  async update(updates: Partial<Omit<ContextState, 'lastUpdate'>>): Promise<void> {
    this.memoryContext = {
      ...this.memoryContext,
      ...updates,
      lastUpdate: new Date().toISOString()
    };
  }

  // Clear dependent selections when parent context changes
  async clearDependentContexts(contextType: 'project' | 'roadmap' | 'chat'): Promise<void> {
    const updates: Partial<Omit<ContextState, 'lastUpdate'>> = {};

    if (contextType === 'project') {
      // When project changes, clear roadmap and chat
      updates.activeRoadmapId = undefined;
      updates.activeRoadmapTitle = undefined;
      updates.activeChatId = undefined;
      updates.activeChatTitle = undefined;
    } else if (contextType === 'roadmap') {
      // When roadmap changes, clear chat
      updates.activeChatId = undefined;
      updates.activeChatTitle = undefined;
    }
    // For 'chat', there are no dependents to clear

    if (Object.keys(updates).length > 0) {
      await this.update(updates);
    }
  }
}