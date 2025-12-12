import { FederatedPolicyEngine, ProjectPolicySnapshot } from '../../src/policy/federated';

describe('FederatedPolicyEngine', () => {
  let engine: FederatedPolicyEngine;

  beforeEach(() => {
    engine = new FederatedPolicyEngine();
  });

  describe('cosineSimilarity', () => {
    it('should return 1 for identical vectors', () => {
      const vecA = [1, 2, 3];
      const vecB = [1, 2, 3];
      const similarity = (engine as any).cosineSimilarity(vecA, vecB);
      expect(similarity).toBeCloseTo(1.0, 5);
    });

    it('should return 0.5 for orthogonal vectors (normalized)', () => {
      const vecA = [1, 0, 0];
      const vecB = [0, 1, 0];
      const similarity = (engine as any).cosineSimilarity(vecA, vecB);
      // Raw cosine similarity is 0, normalized to (0+1)/2 = 0.5
      expect(similarity).toBeCloseTo(0.5, 5);
    });

    it('should return expected value for known vectors', () => {
      const vecA = [1, 1, 0];
      const vecB = [1, 0, 1];
      const similarity = (engine as any).cosineSimilarity(vecA, vecB);
      // Raw cosine similarity = (1*1 + 1*0 + 0*1)/(sqrt(2)*sqrt(2)) = 1/2 = 0.5
      // Normalized to (0.5+1)/2 = 0.75
      expect(similarity).toBeCloseTo(0.75, 5);
    });
  });

  describe('policyToVector', () => {
    it('should convert policy to fixed-length vector', () => {
      const policy = { rules: [{ action: 'read', resource: 'file' }] };
      const vector = (engine as any).policyToVector(policy);
      expect(vector).toHaveLength(128);
      expect(Array.isArray(vector)).toBe(true);
      expect(vector.every((val: number) => typeof val === 'number')).toBe(true);
    });

    it('should produce different vectors for different policies', () => {
      const policyA = { rules: [{ action: 'read', resource: 'file' }] };
      const policyB = { rules: [{ action: 'write', resource: 'file' }] };
      const vectorA = (engine as any).policyToVector(policyA);
      const vectorB = (engine as any).policyToVector(policyB);
      expect(vectorA).not.toEqual(vectorB);
    });

    it('should produce same vector for same policies', () => {
      const policyA = { rules: [{ action: 'read', resource: 'file' }] };
      const policyB = { rules: [{ action: 'read', resource: 'file' }] };
      const vectorA = (engine as any).policyToVector(policyA);
      const vectorB = (engine as any).policyToVector(policyB);
      expect(vectorA).toEqual(vectorB);
    });
  });

  describe('calculatePolicySimilarity', () => {
    it('should return 1 for identical policies', () => {
      const policyA = { rules: [{ action: 'read', resource: 'file' }] };
      const policyB = { rules: [{ action: 'read', resource: 'file' }] };
      const similarity = (engine as any).calculatePolicySimilarity(policyA, policyB);
      expect(similarity).toBeCloseTo(1.0, 5);
    });

    it('should return less than 1 for different policies', () => {
      const policyA = { rules: [{ action: 'read', resource: 'file' }] };
      const policyB = { rules: [{ action: 'write', resource: 'file' }] };
      const similarity = (engine as any).calculatePolicySimilarity(policyA, policyB);
      expect(similarity).toBeLessThan(1.0);
    });
  });

  describe('generateSimilarityMatrix', () => {
    it('should create symmetric matrix with 1s on diagonal', () => {
      const snapshots: ProjectPolicySnapshot[] = [
        { 
          projectId: 'projectA', 
          policy: { rules: [{ action: 'read', resource: 'file' }] }, 
          driftScore: 0.1, 
          reviewHistory: [], 
          inferenceHistory: [] 
        },
        { 
          projectId: 'projectB', 
          policy: { rules: [{ action: 'write', resource: 'file' }] }, 
          driftScore: 0.2, 
          reviewHistory: [], 
          inferenceHistory: [] 
        }
      ];
      
      const matrix = (engine as any).generateSimilarityMatrix(snapshots);
      
      // Check that diagonal values are 1
      expect(matrix.values[0][0]).toBeCloseTo(1.0, 5);
      expect(matrix.values[1][1]).toBeCloseTo(1.0, 5);
      
      // Check symmetry
      expect(matrix.values[0][1]).toBeCloseTo(matrix.values[1][0], 5);
      
      // Check project IDs
      expect(matrix.projectIds).toEqual(['projectA', 'projectB']);
    });
  });

  describe('performHierarchicalClustering', () => {
    it('should cluster similar projects together', () => {
      const projectIds = ['projectA', 'projectB', 'projectC'];
      // Create a similarity matrix where A and B are similar but C is different
      const similarityMatrix = [
        [1.0, 0.8, 0.2],
        [0.8, 1.0, 0.3],
        [0.2, 0.3, 1.0]
      ];
      
      const clusters = (engine as any).performHierarchicalClustering(
        projectIds,
        similarityMatrix,
        0.5  // threshold
      );
      
      // Should have at least one cluster with A and B together
      const clusterWithA = clusters.find((cluster: { members: string[] }) => cluster.members.includes('projectA'));
      const clusterWithB = clusters.find((cluster: { members: string[] }) => cluster.members.includes('projectB'));

      // A and B should be in the same cluster since similarity > threshold
      expect(clusterWithA).toBe(clusterWithB);

      // C should be in a separate cluster or alone
      const clusterWithC = clusters.find((cluster: { members: string[] }) => cluster.members.includes('projectC'));
      expect(clusterWithC).not.toBe(clusterWithA);
    });

    it('should not cluster when similarity is below threshold', () => {
      const projectIds = ['projectA', 'projectB'];
      // Create a similarity matrix with low similarity
      const similarityMatrix = [
        [1.0, 0.1],
        [0.1, 1.0]
      ];
      
      const clusters = (engine as any).performHierarchicalClustering(
        projectIds,
        similarityMatrix,
        0.5  // threshold
      );
      
      // Should have two separate clusters since similarity is below threshold
      expect(clusters.length).toBe(2);
      expect(clusters[0].members.length).toBe(1);
      expect(clusters[1].members.length).toBe(1);
    });
  });

  describe('detectOutliers', () => {
    it('should identify projects with low average similarity', () => {
      const projectIds = ['projectA', 'projectB', 'projectC'];
      // A and B are similar to each other, C is different from both
      const similarityMatrix = [
        [1.0, 0.8, 0.2],
        [0.8, 1.0, 0.3],
        [0.2, 0.3, 1.0]
      ];
      
      const outliers = (engine as any).detectOutliers(
        projectIds,
        similarityMatrix,
        0.5  // threshold - anything below this is an outlier
      );
      
      // C should be an outlier since its average similarity is low
      expect(outliers).toContain('projectC');
    });

    it('should not identify projects with high average similarity as outliers', () => {
      const projectIds = ['projectA', 'projectB'];
      // A and B are highly similar
      const similarityMatrix = [
        [1.0, 0.9],
        [0.9, 1.0]
      ];
      
      const outliers = (engine as any).detectOutliers(
        projectIds,
        similarityMatrix,
        0.5  // threshold
      );
      
      // No outliers when both projects have high similarity
      expect(outliers).toHaveLength(0);
    });
  });

  describe('computeConsensusVector', () => {
    it('should create consensus with baseline rules', () => {
      const snapshots: ProjectPolicySnapshot[] = [
        { 
          projectId: 'projectA', 
          policy: { rules: [{ action: 'read', resource: 'file' }, { action: 'write', resource: 'file' }] }, 
          driftScore: 0.1, 
          reviewHistory: [], 
          inferenceHistory: [] 
        },
        { 
          projectId: 'projectB', 
          policy: { rules: [{ action: 'read', resource: 'file' }, { action: 'delete', resource: 'file' }] }, 
          driftScore: 0.2, 
          reviewHistory: [], 
          inferenceHistory: [] 
        }
      ];
      
      const consensus = (engine as any).computeConsensusVector(snapshots);
      
      // 'read' action appears in both projects, so should be in baseline
      const readRule = consensus.baselineRules.find((rule: any) => 
        rule.action === 'read' && rule.resource === 'file'
      );
      expect(readRule).toBeDefined();
      
      // 'write' and 'delete' appear in only one project each, so shouldn't be baseline
      const writeRule = consensus.baselineRules.find((rule: any) => 
        rule.action === 'write' && rule.resource === 'file'
      );
      const deleteRule = consensus.baselineRules.find((rule: any) => 
        rule.action === 'delete' && rule.resource === 'file'
      );
      expect(writeRule).toBeUndefined();
      expect(deleteRule).toBeUndefined();
    });
  });

  describe('computeInfluenceGraph', () => {
    it('should identify influence relationships between similar projects', () => {
      const snapshots: ProjectPolicySnapshot[] = [
        { 
          projectId: 'projectA', 
          policy: { rules: [{ action: 'read', resource: 'file' }] }, 
          driftScore: 0.1,  // Low drift = more stable
          reviewHistory: [], 
          inferenceHistory: [] 
        },
        { 
          projectId: 'projectB', 
          policy: { rules: [{ action: 'read', resource: 'file' }] },  // Same policy as A
          driftScore: 0.2, 
          reviewHistory: [], 
          inferenceHistory: [] 
        }
      ];
      
      const influences = (engine as any).computeInfluenceGraph(snapshots);

      // Look for influence from A to B or B to A
      const influence = influences.find((inf: { from: string; to: string }) =>
        (inf.from === 'projectA' && inf.to === 'projectB') ||
        (inf.from === 'projectB' && inf.to === 'projectA')
      );
      
      // Should have some influence relationship since policies are similar
      expect(influence).toBeDefined();
      expect(influence!.weight).toBeGreaterThan(0);
    });
  });

  describe('calculateSystemStability', () => {
    it('should return high stability for single cluster with no outliers', () => {
      const clusters = [{ clusterId: 'cluster_0', members: ['projectA', 'projectB'] }];
      const outliers: string[] = [];
      const similarityMatrix = [
        [1.0, 0.8],
        [0.8, 1.0]
      ];
      
      const stability = (engine as any).calculateSystemStability(
        clusters,
        outliers,
        similarityMatrix
      );
      
      // Should be high stability since there's only one cluster and no outliers
      expect(stability).toBeGreaterThan(0.7);
    });

    it('should return lower stability for multiple clusters', () => {
      const clusters = [
        { clusterId: 'cluster_0', members: ['projectA'] },
        { clusterId: 'cluster_1', members: ['projectB'] }
      ];
      const outliers: string[] = [];
      const similarityMatrix = [
        [1.0, 0.1],
        [0.1, 1.0]
      ];
      
      const stability = (engine as any).calculateSystemStability(
        clusters,
        outliers,
        similarityMatrix
      );
      
      // Should be lower stability due to multiple clusters
      expect(stability).toBeLessThan(0.5);
    });

    it('should return lower stability for outliers', () => {
      const clusters = [{ clusterId: 'cluster_0', members: ['projectA', 'projectB'] }];
      const outliers = ['projectC'];
      const similarityMatrix = [
        [1.0, 0.8, 0.1],
        [0.8, 1.0, 0.2],
        [0.1, 0.2, 1.0]
      ];
      
      const stability = (engine as any).calculateSystemStability(
        clusters,
        outliers,
        similarityMatrix
      );
      
      // Should be lower stability due to outliers
      expect(stability).toBeLessThan(0.8);
    });
  });

  describe('computeFederatedHealth', () => {
    it('should compute all components of federated health', async () => {
      const snapshots: ProjectPolicySnapshot[] = [
        { 
          projectId: 'projectA', 
          policy: { rules: [{ action: 'read', resource: 'file' }] }, 
          driftScore: 0.1, 
          reviewHistory: [], 
          inferenceHistory: [] 
        },
        { 
          projectId: 'projectB', 
          policy: { rules: [{ action: 'read', resource: 'file' }] }, 
          driftScore: 0.2, 
          reviewHistory: [], 
          inferenceHistory: [] 
        }
      ];
      
      const health = await engine.computeFederatedHealth(snapshots);
      
      // Check that all required fields are present
      expect(health).toHaveProperty('similarityMatrix');
      expect(health).toHaveProperty('clusters');
      expect(health).toHaveProperty('outliers');
      expect(health).toHaveProperty('consensus');
      expect(health).toHaveProperty('influenceGraph');
      expect(health).toHaveProperty('systemStabilityScore');
      expect(health).toHaveProperty('narrativeSummary');
      
      // Check that values are reasonable
      expect(health.systemStabilityScore).toBeGreaterThanOrEqual(0);
      expect(health.systemStabilityScore).toBeLessThanOrEqual(1);
      expect(typeof health.narrativeSummary).toBe('string');
    });

    it('should detect convergence between similar projects', async () => {
      // Two projects with identical policies should show convergence
      const snapshots: ProjectPolicySnapshot[] = [
        { 
          projectId: 'projectA', 
          policy: { rules: [{ action: 'read', resource: 'file' }] }, 
          driftScore: 0.1, 
          reviewHistory: [], 
          inferenceHistory: [] 
        },
        { 
          projectId: 'projectB', 
          policy: { rules: [{ action: 'read', resource: 'file' }] }, 
          driftScore: 0.1, 
          reviewHistory: [], 
          inferenceHistory: [] 
        }
      ];
      
      const health = await engine.computeFederatedHealth(snapshots);
      
      // Should have one cluster (convergence)
      expect(health.clusters.length).toBe(1);
      if (health.clusters[0]) {
        expect(health.clusters[0].members).toContain('projectA');
        expect(health.clusters[0].members).toContain('projectB');
      }
      
      // Should have no outliers
      expect(health.outliers.length).toBe(0);
    });

    it('should detect divergence between different projects', async () => {
      // Two projects with very different policies should show divergence
      const snapshots: ProjectPolicySnapshot[] = [
        { 
          projectId: 'projectA', 
          policy: { rules: [{ action: 'read', resource: 'file' }] }, 
          driftScore: 0.1, 
          reviewHistory: [], 
          inferenceHistory: [] 
        },
        { 
          projectId: 'projectB', 
          policy: { rules: [{ action: 'execute', resource: 'command' }] }, 
          driftScore: 0.1, 
          reviewHistory: [], 
          inferenceHistory: [] 
        }
      ];
      
      const health = await engine.computeFederatedHealth(snapshots, 0.5, 0.3); // Use default thresholds
      
      // May have 2 clusters depending on similarity, but should have lower stability
      expect(health.systemStabilityScore).toBeLessThan(1.0);
    });

    it('should handle single project correctly', async () => {
      const snapshots: ProjectPolicySnapshot[] = [
        { 
          projectId: 'projectA', 
          policy: { rules: [{ action: 'read', resource: 'file' }] }, 
          driftScore: 0.1, 
          reviewHistory: [], 
          inferenceHistory: [] 
        }
      ];
      
      const health = await engine.computeFederatedHealth(snapshots);
      
      // Single project should have one cluster with itself
      expect(health.clusters.length).toBe(1);
      if (health.clusters[0]) {
        expect(health.clusters[0].members).toContain('projectA');
      }
      
      // No outliers with single project
      expect(health.outliers.length).toBe(0);
      
      // Stability should be reasonable
      expect(health.systemStabilityScore).toBeGreaterThanOrEqual(0);
      expect(health.systemStabilityScore).toBeLessThanOrEqual(1);
    });

    it('should throw error for empty snapshots', async () => {
      await expect(engine.computeFederatedHealth([]))
        .rejects
        .toThrow('At least one project snapshot is required');
    });
  });
});