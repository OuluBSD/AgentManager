import { PolicyReviewVerdict } from './review';
import { PolicyRecommendation } from './inference';

/**
 * Represents a snapshot of a project's policy at a specific point in time
 */
export interface ProjectPolicySnapshot {
  projectId: string;
  policy: any;
  driftScore: number;
  reviewHistory: PolicyReviewVerdict[];
  inferenceHistory: PolicyRecommendation[];
}

/**
 * Matrix containing similarity scores between projects
 * Values range from 0 (completely dissimilar) to 1 (identical)
 */
export interface FederatedSimilarityMatrix {
  projectIds: string[];
  values: number[][]; // 0–1 similarity scores
}

/**
 * Represents the consensus policy derived from all project policies
 */
export interface FederatedConsensusVector {
  baselineRules: any[];
  similarityWeightedRules: any[];
  driftWeightedRules: any[];
}

/**
 * Comprehensive health report of the federated policy system
 */
export interface FederatedPolicyHealth {
  similarityMatrix: FederatedSimilarityMatrix;
  clusters: { clusterId: string; members: string[] }[];
  outliers: string[];
  consensus: FederatedConsensusVector;
  influenceGraph: { from: string; to: string; weight: number }[];
  systemStabilityScore: number; // 0–1 float
  narrativeSummary: string;
}

/**
 * Federated Policy Consensus Engine
 */
export class FederatedPolicyEngine {
  
  /**
   * Calculates similarity between two project policies using cosine similarity
   * @param policyA First project policy
   * @param policyB Second project policy
   * @returns Similarity score between 0 and 1
   */
  private calculatePolicySimilarity(policyA: any, policyB: any): number {
    // Convert policies to vectors for comparison
    const vectorA = this.policyToVector(policyA);
    const vectorB = this.policyToVector(policyB);
    
    // Calculate cosine similarity
    return this.cosineSimilarity(vectorA, vectorB);
  }
  
  /**
   * Converts a policy object to a numerical vector representation
   * @param policy The policy to convert to vector form
   * @returns Numerical vector representation of the policy
   */
  private policyToVector(policy: any): number[] {
    // This is a simplified approach - in a real implementation,
    // we'd need a much more sophisticated conversion based on actual policy structure
    const jsonStr = JSON.stringify(policy);
    const vector: number[] = [];
    
    // Basic hash-based approach to convert policy structure to vector
    for (let i = 0; i < Math.min(jsonStr.length, 128); i++) {
      vector.push(jsonStr.charCodeAt(i));
    }
    
    // Ensure consistent length by padding with zeros if necessary
    while (vector.length < 128) {
      vector.push(0);
    }
    
    return vector.slice(0, 128); // Fixed-length vector
  }
  
  /**
   * Calculates cosine similarity between two vectors
   * @param vecA First vector
   * @param vecB Second vector
   * @returns Cosine similarity value between -1 and 1, normalized to 0-1 range
   */
  private cosineSimilarity(vecA: number[], vecB: number[]): number {
    if (vecA.length !== vecB.length) {
      throw new Error('Vectors must have the same length');
    }
    
    let dotProduct = 0;
    let magnitudeA = 0;
    let magnitudeB = 0;
    
    for (let i = 0; i < vecA.length; i++) {
      dotProduct += (vecA[i] ?? 0) * (vecB[i] ?? 0);
      magnitudeA += (vecA[i] ?? 0) * (vecA[i] ?? 0);
      magnitudeB += (vecB[i] ?? 0) * (vecB[i] ?? 0);
    }
    
    magnitudeA = Math.sqrt(magnitudeA);
    magnitudeB = Math.sqrt(magnitudeB);
    
    if (magnitudeA === 0 || magnitudeB === 0) {
      return 0; // If one vector is zero, similarity is 0
    }
    
    // Cosine similarity formula: (A · B) / (||A|| × ||B||)
    let similarity = dotProduct / (magnitudeA * magnitudeB);
    
    // Normalize to 0-1 range where 0 means orthogonal/dissimilar and 1 means similar
    // For policy comparisons, negative similarities are treated as 0
    // Raw cosine similarity ranges from -1 to 1, so we map it to 0-1 range
    return Math.max(0, (similarity + 1) / 2);
  }

  /**
   * Generates a similarity matrix for all project pairs
   * @param snapshots Array of project policy snapshots
   * @returns Similarity matrix
   */
  private generateSimilarityMatrix(snapshots: ProjectPolicySnapshot[]): FederatedSimilarityMatrix {
    const projectIds = snapshots.map(snapshot => snapshot.projectId);
    const n = snapshots.length;
    const matrix: number[][] = Array(n).fill(null).map(() => Array(n).fill(0));
    
    for (let i = 0; i < n; i++) {
      for (let j = 0; j < n; j++) {
        if (i === j) {
          matrix[i]![j] = 1; // A project is identical to itself
        } else {
          matrix[i]![j] = this.calculatePolicySimilarity(
            snapshots[i]!.policy,
            snapshots[j]!.policy
          );
        }
      }
    }
    
    return {
      projectIds,
      values: matrix
    };
  }

  /**
   * Performs hierarchical clustering to detect divergence clusters
   * @param snapshots Project snapshots to cluster
   * @param similarityMatrix Precomputed similarity matrix
   * @param threshold Minimum similarity for clusters
   * @returns Cluster groups
   */
  private performHierarchicalClustering(
    projectIds: string[],
    similarityMatrix: number[][],
    threshold: number = 0.5
  ): { clusterId: string; members: string[] }[] {
    // Initialize each project as its own cluster
    const clusters: ({ clusterId: string; members: string[] } | null)[] = projectIds.map((id, index) => ({
      clusterId: `cluster_${index}`,
      members: [id]
    }));
    
    // Agglomerative clustering process
    let clusterCount = clusters.length;
    while (clusterCount > 1) {
      // Find the closest pair of clusters
      let maxSimilarity = -1;
      let mergeI = -1;
      let mergeJ = -1;
      
      for (let i = 0; i < clusters.length; i++) {
        if (!clusters[i]) continue;
        
        for (let j = i + 1; j < clusters.length; j++) {
          if (!clusters[j]) continue;
          
          // Calculate average similarity between clusters
          let totalSim = 0;
          let count = 0;

          for (const memberI of clusters[i]!.members) {
            const idxI = projectIds.indexOf(memberI);

            for (const memberJ of clusters[j]!.members) {
              const idxJ = projectIds.indexOf(memberJ);
              totalSim += similarityMatrix[idxI]![idxJ]!;
              count++;
            }
          }
          
          const avgSimilarity = count > 0 ? totalSim / count : 0;
          
          if (avgSimilarity > maxSimilarity) {
            maxSimilarity = avgSimilarity;
            mergeI = i;
            mergeJ = j;
          }
        }
      }
      
      // If highest similarity is below threshold, stop clustering
      if (maxSimilarity < threshold) {
        break;
      }
      
      // Merge clusters
      if (mergeI !== -1 && mergeJ !== -1) {
        clusters[mergeI]!.members = [...clusters[mergeI]!.members, ...clusters[mergeJ]!.members];
        clusters[mergeI]!.clusterId = `merged_${clusters[mergeI]!.clusterId}_${clusters[mergeJ]!.clusterId}`;
        clusters[mergeJ] = null; // Mark as removed
        clusterCount--;
      }
    }
    
    // Return only active clusters
    return clusters.filter(cluster => cluster !== null) as { clusterId: string; members: string[] }[];
  }

  /**
   * Detects outlier projects based on their average similarity to others
   * @param projectIds Project IDs
   * @param similarityMatrix Precomputed similarity matrix
   * @param threshold Threshold below which a project is considered an outlier
   * @returns Array of outlier project IDs
   */
  private detectOutliers(
    projectIds: string[],
    similarityMatrix: number[][],
    threshold: number = 0.3
  ): string[] {
    const outliers: string[] = [];
    
    for (let i = 0; i < projectIds.length; i++) {
      // Calculate average similarity of project i with all others
      let totalSim = 0;
      let count = 0;
      for (let j = 0; j < projectIds.length; j++) {
        if (i !== j) {
          totalSim += similarityMatrix[i]![j]!;
          count++;
        }
      }

      // If there's only one project, it can't be an outlier by definition
      if (projectIds.length <= 1) {
        continue;
      }

      const avgSimilarity = count > 0 ? totalSim / count : 0;

      if (avgSimilarity < threshold) {
        const projectId = projectIds[i];
        if (projectId) {
          outliers.push(projectId);
        }
      }
    }
    
    return outliers;
  }

  /**
   * Computes the federated consensus vector based on all policies
   * @param snapshots Project snapshots to compute consensus from
   * @returns Federated consensus vector
   */
  private computeConsensusVector(snapshots: ProjectPolicySnapshot[]): FederatedConsensusVector {
    // For simplicity, we'll implement a basic consensus algorithm
    // In reality, this would be much more sophisticated
    
    // Extract all unique rules across all policies
    const allRules: any[] = [];
    const ruleCounts: Map<string, number> = new Map();
    
    // Collect and count all rules across policies
    for (const snapshot of snapshots) {
      if (Array.isArray(snapshot.policy?.rules)) {
        for (const rule of snapshot.policy.rules) {
          const ruleStr = JSON.stringify(rule);
          allRules.push({ rule, projectId: snapshot.projectId });
          ruleCounts.set(ruleStr, (ruleCounts.get(ruleStr) || 0) + 1);
        }
      }
    }
    
    // Baseline rules: rules present in more than half of the projects (majority)
    const baselineThreshold = Math.floor(snapshots.length / 2) + 1;
    const baselineRules = Array.from(ruleCounts.entries())
      .filter(([_, count]) => count >= baselineThreshold)
      .map(([ruleStr, _]) => JSON.parse(ruleStr));
    
    // Similarity-weighted rules: rules from similar project clusters
    const similarityWeightedRules: any[] = [];
    
    // For each project, consider rules from similar projects
    for (const snapshot of snapshots) {
      // This is where we'd typically apply a more complex algorithm
      // For now, we'll just add rules with weights based on the project's drift score
      if (Array.isArray(snapshot.policy?.rules)) {
        for (const rule of snapshot.policy.rules) {
          // Weight rules based on inverse of drift score (lower drift = higher weight)
          const weight = 1 - snapshot.driftScore;
          similarityWeightedRules.push({
            rule,
            weight,
            projectId: snapshot.projectId
          });
        }
      }
    }
    
    // Drift-weighted rules: rules adjusted based on drift scores
    const driftWeightedRules: any[] = [];
    for (const snapshot of snapshots) {
      if (Array.isArray(snapshot.policy?.rules)) {
        for (const rule of snapshot.policy.rules) {
          // Adjust rule weight based on drift score
          const adjustedWeight = rule.weight ? rule.weight * (1 - snapshot.driftScore) : (1 - snapshot.driftScore);
          driftWeightedRules.push({
            ...rule,
            adjustedWeight,
            driftScore: snapshot.driftScore
          });
        }
      }
    }
    
    return {
      baselineRules,
      similarityWeightedRules,
      driftWeightedRules
    };
  }
  
  /**
   * Computes the influence graph showing how projects affect each other
   * @param snapshots Project snapshots to analyze
   * @returns Influence graph representation
   */
  private computeInfluenceGraph(snapshots: ProjectPolicySnapshot[]): { from: string; to: string; weight: number }[] {
    const influences: { from: string; to: string; weight: number }[] = [];
    
    // Simple metric: projects with similar policies influence each other
    // More drift-adjusted relationships could be added in a full implementation
    for (let i = 0; i < snapshots.length; i++) {
      for (let j = 0; j < snapshots.length; j++) {
        if (i !== j) {
          // Calculate potential influence
          // Higher similarity indicates potential influence
          const similarity = this.calculatePolicySimilarity(
            snapshots[i]!.policy,
            snapshots[j]!.policy
          );

          // Also consider the drift scores (projects with low drift might influence others)
          const influence = similarity * (1 - snapshots[i]!.driftScore);
          
          if (influence > 0.1) { // Only include meaningful influences
            influences.push({
              from: snapshots[i]!.projectId,
              to: snapshots[j]!.projectId,
              weight: influence
            });
          }
        }
      }
    }
    
    return influences;
  }
  
  /**
   * Calculates the system stability score based on various factors
   * @param clusters Divergence clusters
   * @param outliers Outlier projects
   * @param similarityMatrix Similarity matrix
   * @returns System stability score between 0 and 1
   */
  private calculateSystemStability(
    clusters: { clusterId: string; members: string[] }[],
    outliers: string[],
    similarityMatrix: number[][]
  ): number {
    // Start with a high stability score
    let stability = 1.0;
    
    // Reduce stability for each cluster beyond the first (divergence)
    if (clusters.length > 1) {
      stability -= (clusters.length - 1) * 0.2; // Reduction per extra cluster
    }
    
    // Reduce stability for each outlier
    if (outliers.length > 0) {
      stability -= outliers.length * 0.15; // Reduction per outlier
    }
    
    // Consider average inter-project similarity
    const totalPairs = similarityMatrix.length * (similarityMatrix.length - 1);
    if (totalPairs > 0) {
      let avgSimilarity = 0;
      for (let i = 0; i < similarityMatrix.length; i++) {
        for (let j = 0; j < similarityMatrix[i]!.length; j++) {
          if (i !== j) {
            avgSimilarity += similarityMatrix[i]![j]!;
          }
        }
      }
      avgSimilarity /= totalPairs;
      
      // Weight stability based on average similarity
      stability *= avgSimilarity;
    }
    
    // Ensure stability stays in the 0-1 range
    return Math.max(0, Math.min(1, stability));
  }
  
  /**
   * Generates a narrative summary of the federated policy health
   * @param health Federated policy health data
   * @returns Human-readable narrative summary
   */
  private generateNarrativeSummary(health: FederatedPolicyHealth): string {
    const { clusters, outliers, systemStabilityScore } = health;
    const clusterCount = clusters.length;
    const outlierCount = outliers.length;
    
    let summary = "";
    
    if (clusterCount === 1 && outlierCount === 0) {
      summary = "The system exhibits strong convergence with all projects following similar policies. ";
      summary += systemStabilityScore > 0.8 ? 
        "Overall stability is excellent." : 
        "However, stability could be improved.";
    } else if (clusterCount > 1) {
      summary = `Detected ${clusterCount} distinct policy clusters. `;
      summary += `Projects are fragmenting into ${clusterCount} different policy approaches. `;
      summary += `Consider intervention to prevent excessive fragmentation. `;
    } else {
      summary = "Projects are generally aligned but with some outliers. ";
    }
    
    if (outlierCount > 0) {
      summary += `Found ${outlierCount} outlier project(s) (${outliers.join(', ')}) with highly divergent policies. `;
      summary += "These may need special attention to bring back into alignment.";
    }
    
    summary += ` Overall system stability score: ${(systemStabilityScore * 100).toFixed(1)}%.`;
    
    return summary;
  }
  
  /**
   * Main function to compute federated policy health across multiple projects
   * @param snapshots Array of project policy snapshots
   * @param clusterThreshold Threshold for clustering
   * @param outlierThreshold Threshold for outlier detection
   * @returns Federated policy health report
   */
  public async computeFederatedHealth(
    snapshots: ProjectPolicySnapshot[],
    clusterThreshold: number = 0.5,
    outlierThreshold: number = 0.3
  ): Promise<FederatedPolicyHealth> {
    if (!snapshots || snapshots.length === 0) {
      throw new Error('At least one project snapshot is required');
    }
    
    // Generate similarity matrix
    const similarityMatrix = this.generateSimilarityMatrix(snapshots);
    
    // Perform clustering
    const clusters = this.performHierarchicalClustering(
      snapshots.map(s => s.projectId),
      similarityMatrix.values,
      clusterThreshold
    );
    
    // Detect outliers
    const outliers = this.detectOutliers(
      snapshots.map(s => s.projectId),
      similarityMatrix.values,
      outlierThreshold
    );
    
    // Compute consensus vector
    const consensus = this.computeConsensusVector(snapshots);
    
    // Compute influence graph
    const influenceGraph = this.computeInfluenceGraph(snapshots);
    
    // Calculate system stability
    const systemStabilityScore = this.calculateSystemStability(
      clusters,
      outliers,
      similarityMatrix.values
    );
    
    // Generate narrative summary
    const narrativeSummary = this.generateNarrativeSummary({
      similarityMatrix,
      clusters,
      outliers,
      consensus,
      influenceGraph,
      systemStabilityScore,
      narrativeSummary: ""
    });
    
    return {
      similarityMatrix,
      clusters,
      outliers,
      consensus,
      influenceGraph,
      systemStabilityScore,
      narrativeSummary
    };
  }
}