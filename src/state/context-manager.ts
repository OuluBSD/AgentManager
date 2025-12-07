// src/state/context-manager.ts
// Context manager implementation

import { ContextState, ContextUpdates } from './context-types';
import { ContextStorage } from './context-storage';

export class ContextManager {
  private storage: ContextStorage;

  constructor() {
    this.storage = new ContextStorage();
  }

  async load(): Promise<ContextState> {
    return await this.storage.read();
  }

  async save(updates: Partial<ContextState>): Promise<ContextState> {
    await this.storage.write({ ...await this.load(), ...updates });
    return await this.load();
  }

  // Project selection with context clearing
  async selectProject(projectId: string, projectName?: string): Promise<ContextState> {
    // Clear dependent contexts when project changes
    await this.storage.clearDependentContexts('project');

    // Update project context
    await this.storage.update({
      activeProjectId: projectId,
      activeProjectName: projectName
    });

    return await this.load();
  }

  // Roadmap selection with context clearing
  async selectRoadmap(roadmapId: string, roadmapTitle?: string): Promise<ContextState> {
    // Clear dependent contexts when roadmap changes
    await this.storage.clearDependentContexts('roadmap');

    // Update roadmap context
    await this.storage.update({
      activeRoadmapId: roadmapId,
      activeRoadmapTitle: roadmapTitle
    });

    return await this.load();
  }

  // Chat selection
  async selectChat(chatId: string, chatTitle?: string): Promise<ContextState> {
    // No dependent contexts to clear when chat changes
    await this.storage.update({
      activeChatId: chatId,
      activeChatTitle: chatTitle
    });

    return await this.load();
  }

  // Helper methods to get context values
  async getSelectedProjectId(): Promise<string | undefined> {
    const context = await this.load();
    return context.activeProjectId;
  }

  async getSelectedRoadmapId(): Promise<string | undefined> {
    const context = await this.load();
    return context.activeRoadmapId;
  }

  async getSelectedChatId(): Promise<string | undefined> {
    const context = await this.load();
    return context.activeChatId;
  }

  // Check if required context is available
  async hasProjectContext(): Promise<boolean> {
    return (await this.getSelectedProjectId()) !== undefined;
  }

  async hasRoadmapContext(): Promise<boolean> {
    return (await this.getSelectedRoadmapId()) !== undefined;
  }

  async hasChatContext(): Promise<boolean> {
    return (await this.getSelectedChatId()) !== undefined;
  }

  // AI Session methods
  async setAiSession(sessionId: string): Promise<ContextState> {
    await this.storage.update({
      selectedAiSessionId: sessionId
    });
    return await this.load();
  }

  async clearAiSession(): Promise<ContextState> {
    await this.storage.update({
      selectedAiSessionId: undefined
    });
    return await this.load();
  }

  async getAiSession(): Promise<string | undefined> {
    const context = await this.load();
    return context.selectedAiSessionId;
  }

  async hasAiSessionContext(): Promise<boolean> {
    return (await this.getAiSession()) !== undefined;
  }

  // Network element selection methods
  async setNetworkElement(id: string): Promise<ContextState> {
    await this.storage.update({
      selectedNetworkElementId: id
    });
    return await this.load();
  }

  async clearNetworkElement(): Promise<ContextState> {
    await this.storage.update({
      selectedNetworkElementId: undefined
    });
    return await this.load();
  }

  async getNetworkElement(): Promise<string | undefined> {
    const context = await this.load();
    return context.selectedNetworkElementId;
  }

  async hasNetworkElementContext(): Promise<boolean> {
    return (await this.getNetworkElement()) !== undefined;
  }
}