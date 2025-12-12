import { PolicyDriftAnalysis } from './drift';
import { PolicyFuturesResult } from './futures';
import { FederatedPolicyHealth } from './federated';
import { PolicyReviewResult } from './review';

export interface AutopilotInput {
  projectId: string;

  lastSnapshot: {
    policy?: any;
    drift?: PolicyDriftAnalysis;
    futures?: PolicyFuturesResult;
    federated?: FederatedPolicyHealth;
    reviewVerdicts?: PolicyReviewResult[];
  };

  timestamps: {
    now: string;
    lastCheck: string;
  };

  config: {
    thresholds: {
      volatility: number;      // e.g. 0.45 triggers action
      drift: number;           // normalized drift threshold
      divergence: number;      // federated divergence threshold
    };
    taskEmission: {
      enable: boolean;
      minIntervalMinutes: number;
    };
  };
}

export interface AutopilotTaskRecommendation {
  id: string;
  type: "audit" | "policy-review" | "drift-investigation" | "rewrite-policy" | "federated-sync";
  priority: "low" | "medium" | "high" | "urgent";
  justification: string;
  suggestedDeadlineHours: number;
}

export interface AutopilotOutput {
  projectId: string;
  cycleId: string;

  risk: {
    globalRisk: "stable" | "elevated" | "volatile" | "critical";
    reasons: string[];
    metrics: {
      drift?: number;
      volatility?: number;
      divergence?: number;
      contradictionRate?: number;
    };
  };

  recommendedActions: AutopilotTaskRecommendation[];

  narrative: string;
}

/**
 * The Governance Autopilot - A system that watches the system over time,
 * detecting risk, drift, divergence, instability, and automatically scheduling
 * governance tasks while summarizing the system's state for review.
 */
export class GovernanceAutopilot {
  /**
   * Runs a single autopilot cycle, analyzing the current state of governance
   * and generating recommendations for future actions.
   */
  public runCycle(input: AutopilotInput): AutopilotOutput {
    // Generate a unique cycle ID based on timestamp and project
    const cycleId = `cycle-${input.projectId}-${new Date(input.timestamps.now).getTime()}`;
    
    // Calculate risk scores from different inputs
    const { globalRisk, reasons, metrics } = this.calculateRisk(input);
    
    // Generate task recommendations based on risk analysis
    const recommendedActions = this.generateTaskRecommendations(input, globalRisk, metrics);
    
    // Create a narrative summary of the system state
    const narrative = this.generateNarrative(input, globalRisk, metrics, reasons);
    
    return {
      projectId: input.projectId,
      cycleId,
      risk: {
        globalRisk,
        reasons,
        metrics
      },
      recommendedActions,
      narrative
    };
  }

  /**
   * Calculates the overall risk level by combining inputs from all layers
   */
  private calculateRisk(input: AutopilotInput): {
    globalRisk: "stable" | "elevated" | "volatile" | "critical";
    reasons: string[];
    metrics: {
      drift?: number;
      volatility?: number;
      divergence?: number;
      contradictionRate?: number;
    };
  } {
    const { lastSnapshot, config } = input;
    
    // Extract relevant metrics from snapshots
    const driftScore = lastSnapshot.drift?.overallDriftScore || 0;
    const volatility = lastSnapshot.futures?.aggregate.volatilityIndex || 0;
    const divergence = lastSnapshot.federated
      ? 1 - lastSnapshot.federated.systemStabilityScore
      : 0;
    
    // Calculate contradiction rate if available
    let contradictionRate = 0;
    if (lastSnapshot.futures?.simulations && lastSnapshot.futures.simulations.length > 0) {
      const totalBreakdowns = lastSnapshot.futures.simulations
        .map(sim => sim.breakdown.likelihood_contradiction || 0)
        .reduce((sum, val) => sum + val, 0);
      contradictionRate = totalBreakdowns / lastSnapshot.futures.simulations.length;
    }
    
    // Risk formula:
    // riskScore = futures.volatilityIndex * 0.4 + 
    //             drift.driftScore * 0.3 + 
    //             federated.divergenceScore * 0.2 + 
    //             contradictionRate * 0.1
    const riskScore = 
      volatility * 0.4 +
      driftScore * 0.3 +
      divergence * 0.2 +
      contradictionRate * 0.1;
    
    // Determine global risk category based on risk score
    let globalRisk: "stable" | "elevated" | "volatile" | "critical";
    if (riskScore < 0.25) {
      globalRisk = "stable";
    } else if (riskScore < 0.45) {
      globalRisk = "elevated";
    } else if (riskScore < 0.70) {
      globalRisk = "volatile";
    } else {
      globalRisk = "critical";
    }
    
    // Generate reasons for the risk assessment
    const reasons: string[] = [];
    if (volatility > config.thresholds.volatility) {
      reasons.push(`High policy volatility detected (${volatility.toFixed(2)} > ${config.thresholds.volatility})`);
    }
    if (driftScore > config.thresholds.drift) {
      reasons.push(`Significant policy drift detected (${driftScore.toFixed(2)} > ${config.thresholds.drift})`);
    }
    if (divergence > config.thresholds.divergence) {
      reasons.push(`High federated divergence detected (${divergence.toFixed(2)} > ${config.thresholds.divergence})`);
    }
    if (contradictionRate > 0.15) {  // Using 0.15 as arbitrary threshold for contradiction rate
      reasons.push(`High contradiction rate detected (${contradictionRate.toFixed(2)})`);
    }
    
    if (reasons.length === 0) {
      reasons.push("System operating within normal parameters");
    }
    
    return {
      globalRisk,
      reasons,
      metrics: {
        drift: driftScore,
        volatility,
        divergence,
        contradictionRate
      }
    };
  }

  /**
   * Generates task recommendations based on the current risk level and metrics
   */
  private generateTaskRecommendations(
    input: AutopilotInput,
    riskLevel: "stable" | "elevated" | "volatile" | "critical",
    metrics: {
      drift?: number;
      volatility?: number;
      divergence?: number;
      contradictionRate?: number;
    }
  ): AutopilotTaskRecommendation[] {
    const recommendations: AutopilotTaskRecommendation[] = [];
    
    // Generate drift investigation recommendation if drift is high
    if (metrics.drift !== undefined && metrics.drift > input.config.thresholds.drift) {
      recommendations.push({
        id: `drift-${Date.now()}`,
        type: "drift-investigation",
        priority: riskLevel === "volatile" || riskLevel === "critical" ? "high" : "medium",
        justification: `Policy drift score (${metrics.drift.toFixed(2)}) exceeds threshold (${input.config.thresholds.drift})`,
        suggestedDeadlineHours: riskLevel === "critical" ? 4 : 24
      });
    }
    
    // Generate policy review recommendation if volatility is high
    if (metrics.volatility !== undefined && metrics.volatility > input.config.thresholds.volatility) {
      recommendations.push({
        id: `review-${Date.now()}`,
        type: "policy-review",
        priority: riskLevel === "volatile" || riskLevel === "critical" ? "high" : "medium",
        justification: `Policy volatility index (${metrics.volatility.toFixed(2)}) exceeds threshold (${input.config.thresholds.volatility})`,
        suggestedDeadlineHours: riskLevel === "critical" ? 8 : 48
      });
    }
    
    // Generate federated sync recommendation if divergence is high
    if (metrics.divergence !== undefined && metrics.divergence > input.config.thresholds.divergence) {
      recommendations.push({
        id: `federated-${Date.now()}`,
        type: "federated-sync",
        priority: riskLevel === "critical" ? "high" : "medium",
        justification: `Federated divergence score (${metrics.divergence.toFixed(2)}) exceeds threshold (${input.config.thresholds.divergence})`,
        suggestedDeadlineHours: riskLevel === "critical" ? 12 : 72
      });
    }
    
    // Generate rewrite policy recommendation if contradiction rate is high
    if (metrics.contradictionRate !== undefined && metrics.contradictionRate > 0.15) {
      recommendations.push({
        id: `rewrite-${Date.now()}`,
        type: "rewrite-policy",
        priority: "high",
        justification: `High contradiction rate (${metrics.contradictionRate.toFixed(2)}) indicates policy inconsistencies`,
        suggestedDeadlineHours: 12
      });
    }
    
    // If no specific issues detected but system is not stable, add a general audit
    if (recommendations.length === 0 && riskLevel !== "stable") {
      recommendations.push({
        id: `audit-${Date.now()}`,
        type: "audit",
        priority: "low",
        justification: "General system audit for non-stable risk level",
        suggestedDeadlineHours: 168 // 1 week
      });
    }
    
    // If system is stable, add a low-priority audit for continuous monitoring
    if (recommendations.length === 0 && riskLevel === "stable") {
      recommendations.push({
        id: `audit-${Date.now()}`,
        type: "audit",
        priority: "low",
        justification: "Regular system audit for ongoing stability monitoring",
        suggestedDeadlineHours: 720 // 1 month
      });
    }
    
    return recommendations;
  }

  /**
   * Generates a narrative summary describing the system state
   */
  private generateNarrative(
    input: AutopilotInput,
    riskLevel: "stable" | "elevated" | "volatile" | "critical",
    metrics: {
      drift?: number;
      volatility?: number;
      divergence?: number;
      contradictionRate?: number;
    },
    reasons: string[]
  ): string {
    let narrative = `Autopilot cycle for project ${input.projectId} - `;
    
    // Add risk level assessment
    switch (riskLevel) {
      case "stable":
        narrative += "System is operating within expected parameters with minimal governance concerns. ";
        break;
      case "elevated":
        narrative += "System shows moderate governance concerns requiring attention. ";
        break;
      case "volatile":
        narrative += "System exhibits significant governance instability requiring immediate intervention. ";
        break;
      case "critical":
        narrative += "CRITICAL: System faces severe governance risks that could compromise operational integrity. ";
        break;
    }
    
    // Include specific metrics
    if (metrics.drift !== undefined) {
      narrative += `Drift score: ${metrics.drift.toFixed(3)}. `;
    }
    if (metrics.volatility !== undefined) {
      narrative += `Volatility index: ${metrics.volatility.toFixed(3)}. `;
    }
    if (metrics.divergence !== undefined) {
      narrative += `Divergence score: ${metrics.divergence.toFixed(3)}. `;
    }
    if (metrics.contradictionRate !== undefined) {
      narrative += `Contradiction rate: ${(metrics.contradictionRate * 100).toFixed(1)}%. `;
    }
    
    // Add reasons for the assessment
    if (reasons.length > 0) {
      narrative += `Reasons: ${reasons.join("; ")}. `;
    }
    
    // Add forward-looking statement based on risk level
    switch (riskLevel) {
      case "stable":
        narrative += "Continued stable operation is expected with current governance practices.";
        break;
      case "elevated":
        narrative += "Without intervention, risks may escalate. Recommended actions should be reviewed promptly.";
        break;
      case "volatile":
        narrative += "System is at risk of further degradation. Immediate action is required to restore stability.";
        break;
      case "critical":
        narrative += "Urgent remediation is required to prevent potential governance failure. All recommendations should be treated as high priority.";
        break;
    }
    
    return narrative;
  }
}