// tests/integration/network-commands.test.ts
// Integration tests for Network Commands

import { NetworkElementListHandler } from '../../src/commands/network/element/list';
import { NetworkElementViewHandler } from '../../src/commands/network/element/view';
import { NetworkStatusHandler } from '../../src/commands/network/status';

// Mock context for testing
const mockContext = {
  args: {},
  flags: {},
  contextState: {
    activeProjectId: 'test-project',
    activeProjectName: 'Test Project',
    activeRoadmapId: 'test-roadmap',
    activeRoadmapTitle: 'Test Roadmap',
    activeChatId: 'test-chat',
    activeChatTitle: 'Test Chat',
    selectedAiSessionId: null,
    selectedNetworkElementId: null,
    lastUpdate: new Date().toISOString()
  },
  config: {}
};

describe('Network Commands', () => {
  describe('Network Element List', () => {
    test('should list network elements', async () => {
      const handler = new NetworkElementListHandler();
      const result = await handler.execute(mockContext);

      expect(result.status).toBe('ok');
      expect(result.data).toHaveProperty('elements');
      expect(Array.isArray(result.data.elements)).toBe(true);
      expect(result.message).toMatch(/Found \d+ network elements/);
    });

    test('should list network elements with filters', async () => {
      const contextWithFilters = {
        ...mockContext,
        flags: { 'filter-type': 'server', 'filter-status': 'online' }
      };
      
      const handler = new NetworkElementListHandler();
      const result = await handler.execute(contextWithFilters);

      expect(result.status).toBe('ok');
      expect(result.data).toHaveProperty('elements');
      expect(Array.isArray(result.data.elements)).toBe(true);
      
      // All elements should match the filters
      result.data.elements.forEach((element: any) => {
        if (contextWithFilters.flags['filter-type']) {
          expect(element.type).toBe(contextWithFilters.flags['filter-type']);
        }
        if (contextWithFilters.flags['filter-status']) {
          expect(element.status).toBe(contextWithFilters.flags['filter-status']);
        }
      });
    });
  });

  describe('Network Element View', () => {
    test('should view a specific network element', async () => {
      const contextWithId = {
        ...mockContext,
        flags: { id: 'element-1' }
      };
      
      const handler = new NetworkElementViewHandler();
      const result = await handler.execute(contextWithId);

      expect(result.status).toBe('ok');
      expect(result.data).toHaveProperty('element');
      expect(result.data.element).not.toBeNull();
      expect(result.data.element.id).toBe('element-1');
      expect(result.message).toContain('retrieved successfully');
    });

    test('should return error for non-existent network element', async () => {
      const contextWithInvalidId = {
        ...mockContext,
        flags: { id: 'non-existent-element' }
      };
      
      const handler = new NetworkElementViewHandler();
      const result = await handler.execute(contextWithInvalidId);

      expect(result.status).toBe('error');
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0]).toHaveProperty('type');
      expect(result.errors[0].type).toBe('NETWORK_ELEMENT_NOT_FOUND');
    });

    test('should return error when missing required --id flag', async () => {
      const handler = new NetworkElementViewHandler();
      const result = await handler.execute(mockContext);

      expect(result.status).toBe('error');
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].message).toContain('MISSING_REQUIRED_FLAG');
    });
  });

  describe('Network Status', () => {
    test('should get network status', async () => {
      const handler = new NetworkStatusHandler();
      const result = await handler.execute(mockContext);

      expect(result.status).toBe('ok');
      expect(result.data).toHaveProperty('status');
      expect(result.data.status).toHaveProperty('overallStatus');
      expect(result.data.status).toHaveProperty('elementsByStatus');
      expect(result.data.status).toHaveProperty('timestamp');
      expect(result.data.status).toHaveProperty('totalElements');
      expect(result.data.status).toHaveProperty('onlineElements');
      expect(result.data.status).toHaveProperty('offlineElements');
      expect(result.message).toContain('Network status:');
    });
  });
});