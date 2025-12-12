import { PolicyTrace } from './trace';
import { PolicyRecommendation } from './inference';
import { PolicyReviewVerdict } from './review';

export interface DriftAnalysisInput {
  traces: PolicyTrace[];
  recommendations: PolicyRecommendation[];
  reviews: PolicyReviewVerdict[];
  policySnapshot: any;
  timeWindow: {
    from: number; // timestamp in milliseconds
    to: number;   // timestamp in milliseconds
  };
}

export interface DriftSignal {
  id: string;
  type: 
    | "rule-churn"
    | "override-escalation"
    | "permission-creep"
    | "restriction-creep"
    | "flip-flop"
    | "inconsistency-across-projects"
    | "temporal-anomaly"
    | "reviewer-disagreement";
  severity: "low" | "medium" | "high" | "critical";
  confidence: number; // 0–1 float
  explanation: string;
}

export interface PolicyDriftAnalysis {
  signals: DriftSignal[];
  overallDriftScore: number; // aggregated 0–1 float
  stabilityIndex: number;    // inverse of drift, 0–1 float
  classification: "stable" | "watch" | "volatile" | "critical";
  narrativeSummary: string;
}

export class PolicyDriftEngine {
  /**
   * Analyzes policy artifacts to detect signs of drift over time
   */
  public async analyzeDrift(input: DriftAnalysisInput): Promise<PolicyDriftAnalysis> {
    const { traces, recommendations, reviews, timeWindow } = input;
    
    // Initialize result structure
    const analysis: PolicyDriftAnalysis = {
      signals: [],
      overallDriftScore: 0,
      stabilityIndex: 1, // Start with maximum stability
      classification: "stable",
      narrativeSummary: ""
    };
    
    if (!traces || traces.length === 0) {
      analysis.narrativeSummary = "No policy traces provided for drift analysis";
      return analysis;
    }
    
    // Detect various types of drift signals
    const ruleChurnSignals = this.detectRuleChurn(recommendations, timeWindow);
    const overrideEscalationSignals = this.detectOverrideEscalation(traces, timeWindow);
    const permissionCreepSignals = this.detectPermissionCreep(recommendations, traces);
    const restrictionCreepSignals = this.detectRestrictionCreep(recommendations, traces);
    const flipFlopSignals = this.detectFlipFlop(recommendations, reviews);
    const reviewerDisagreementSignals = this.detectReviewerDisagreement(reviews);
    
    // Combine all signals
    analysis.signals = [
      ...ruleChurnSignals,
      ...overrideEscalationSignals,
      ...permissionCreepSignals,
      ...restrictionCreepSignals,
      ...flipFlopSignals,
      ...reviewerDisagreementSignals
    ];
    
    // Calculate the overall drift score based on signals
    analysis.overallDriftScore = this.calculateDriftScore(analysis.signals, traces.length, recommendations.length);
    analysis.stabilityIndex = 1 - analysis.overallDriftScore;
    
    // Classify the drift level
    analysis.classification = this.classifyDrift(analysis.overallDriftScore);
    
    // Generate narrative summary
    analysis.narrativeSummary = this.generateNarrativeSummary(analysis, timeWindow);
    
    return analysis;
  }
  
  /**
   * Detects rule churn: rules that change too frequently
   */
  private detectRuleChurn(recommendations: PolicyRecommendation[], timeWindow: { from: number; to: number }): DriftSignal[] {
    const signals: DriftSignal[] = [];
    
    if (!recommendations || recommendations.length === 0) {
      return signals;
    }
    
    // Group recommendations by rule ID
    const ruleRecommendations: Map<string, PolicyRecommendation[]> = new Map();
    for (const rec of recommendations) {
      // Extract the rule ID from the recommendation
      let ruleId = rec.proposedRule.id || rec.proposedRule.ruleId;
      if (!ruleId && rec.reason) {
        // Try to extract rule ID from reason
        const match = rec.reason.match(/Rule\s+"([^"]+)"/i);
        if (match) {
          ruleId = match[1];
        }
      }
      
      if (ruleId) {
        if (!ruleRecommendations.has(ruleId)) {
          ruleRecommendations.set(ruleId, []);
        }
        ruleRecommendations.get(ruleId)!.push(rec);
      }
    }
    
    // Look for rules with high recommendation frequency
    for (const [ruleId, recs] of ruleRecommendations) {
      if (recs.length >= 3) {  // Threshold: 3+ recommendations for the same rule
        const timeRange = (timeWindow.to - timeWindow.from) / (1000 * 60 * 60); // in hours
        
        // Calculate churn rate (recommendations per hour)
        const churnRate = recs.length / timeRange;
        
        if (churnRate >= 1) { // At least 1 change per hour = high churn
          signals.push({
            id: `rule-churn-${ruleId}-${Date.now()}`,
            type: "rule-churn",
            severity: "high",
            confidence: Math.min(1.0, churnRate / 5), // Confidence increases with churn rate
            explanation: `Rule "${ruleId}" has been subject to ${recs.length} recommendations in the time window, indicating high churn. This may suggest policy instability.`
          });
        } else if (churnRate >= 0.5) {
          signals.push({
            id: `rule-churn-${ruleId}-${Date.now()}`,
            type: "rule-churn",
            severity: "medium",
            confidence: Math.min(0.8, churnRate / 3),
            explanation: `Rule "${ruleId}" has been subject to ${recs.length} recommendations in the time window, indicating moderate churn.`
          });
        }
      }
    }
    
    return signals;
  }
  
  /**
   * Detects override escalation: increasing frequency of overrides
   */
  private detectOverrideEscalation(traces: PolicyTrace[], timeWindow: { from: number; to: number }): DriftSignal[] {
    const signals: DriftSignal[] = [];
    
    // Count overrides in the traces
    const overrideTraces = traces.filter(trace => trace.overrideContext?.triggered);
    
    if (overrideTraces.length === 0) {
      return signals;
    }
    
    // Calculate override density (overrides per total traces)
    const overrideDensity = overrideTraces.length / traces.length;
    
    // If override density is high, create signal
    if (overrideDensity >= 0.3) {  // 30% of actions require overrides = high
      signals.push({
        id: `override-escalation-${Date.now()}`,
        type: "override-escalation",
        severity: "high",
        confidence: overrideDensity,
        explanation: `Override density is ${Math.round(overrideDensity * 100)}%, indicating that a high percentage of actions are requiring policy overrides. This suggests the policy may be too restrictive.`
      });
    } else if (overrideDensity >= 0.15) {  // 15% = medium
      signals.push({
        id: `override-escalation-${Date.now()}`,
        type: "override-escalation",
        severity: "medium",
        confidence: overrideDensity,
        explanation: `Override density is ${Math.round(overrideDensity * 100)}%, indicating a moderate level of policy override usage.`
      });
    }
    
    return signals;
  }
  
  /**
   * Detects permission creep: gradual expansion of permissions
   */
  private detectPermissionCreep(recommendations: PolicyRecommendation[], traces: PolicyTrace[]): DriftSignal[] {
    const signals: DriftSignal[] = [];
    
    // For simplicity, we'll detect recommendations to add "allow" rules or modify rules to be more permissive
    const allowRecommendations = recommendations.filter(rec => 
      (rec.type === "add-rule" && rec.proposedRule.effect === "allow") ||
      (rec.type === "modify-rule" && rec.reason.includes("allow"))
    );
    
    if (allowRecommendations.length >= 5) {  // Threshold: 5+ allow-related recommendations
      signals.push({
        id: `permission-creep-${Date.now()}`,
        type: "permission-creep",
        severity: "high",
        confidence: Math.min(1.0, allowRecommendations.length / 10),
        explanation: `Detected ${allowRecommendations.length} recommendations related to expanding permissions. This may indicate gradual permission creep.`
      });
    } else if (allowRecommendations.length >= 2) {
      signals.push({
        id: `permission-creep-${Date.now()}`,
        type: "permission-creep",
        severity: "medium",
        confidence: Math.min(0.7, allowRecommendations.length / 5),
        explanation: `Detected ${allowRecommendations.length} recommendations related to expanding permissions.`
      });
    }
    
    return signals;
  }
  
  /**
   * Detects restriction creep: gradual reduction of constraints
   */
  private detectRestrictionCreep(recommendations: PolicyRecommendation[], traces: PolicyTrace[]): DriftSignal[] {
    const signals: DriftSignal[] = [];
    
    // Detect recommendations to remove rules or make them less restrictive
    const removalRecommendations = recommendations.filter(rec => 
      rec.type === "remove-rule" ||
      (rec.type === "modify-rule" && rec.reason.includes("restrict")) ||
      (rec.type === "modify-rule" && rec.reason.includes("deny"))
    );
    
    if (removalRecommendations.length >= 3) {  // Threshold: 3+ removal/modification recommendations
      signals.push({
        id: `restriction-creep-${Date.now()}`,
        type: "restriction-creep",
        severity: "high",
        confidence: Math.min(1.0, removalRecommendations.length / 5),
        explanation: `Detected ${removalRecommendations.length} recommendations to remove or weaken policy restrictions. This may indicate gradual constraint erosion.`
      });
    } else if (removalRecommendations.length >= 1) {
      signals.push({
        id: `restriction-creep-${Date.now()}`,
        type: "restriction-creep",
        severity: "medium",
        confidence: Math.min(0.6, removalRecommendations.length / 3),
        explanation: `Detected ${removalRecommendations.length} recommendations to remove or weaken policy restrictions.`
      });
    }
    
    return signals;
  }
  
  /**
   * Detects flip-flop: oscillation in policy recommendations
   */
  private detectFlipFlop(recommendations: PolicyRecommendation[], reviews: PolicyReviewVerdict[]): DriftSignal[] {
    const signals: DriftSignal[] = [];
    
    // Group recommendations by the rule they affect
    const ruleActions: Map<string, { type: string, time: number, recommendation: PolicyRecommendation }[]> = new Map();
    
    for (const rec of recommendations) {
      let ruleId = rec.proposedRule.id || rec.proposedRule.ruleId;
      if (!ruleId && rec.reason) {
        const match = rec.reason.match(/Rule\s+"([^"]+)"/i);
        if (match) {
          ruleId = match[1];
        }
      }
      
      if (ruleId) {
        if (!ruleActions.has(ruleId)) {
          ruleActions.set(ruleId, []);
        }
        ruleActions.get(ruleId)!.push({
          type: rec.type,
          time: Date.now(), // In a real implementation, we'd have actual timestamps
          recommendation: rec
        });
      }
    }
    
    // Look for patterns where rules are added and removed frequently
    for (const [ruleId, actions] of ruleActions) {
      if (actions.length >= 3) {
        // Check for add-remove-add or similar oscillation patterns
        let oscillationCount = 0;
        
        // Simple detection: if we have both add/remove actions for the same rule
        const actionTypes = actions.map(a => a.type);
        if (actionTypes.includes("add-rule") && actionTypes.includes("remove-rule")) {
          oscillationCount++;
        }
        
        // More sophisticated pattern: alternating actions
        for (let i = 0; i < actionTypes.length - 2; i++) {
          if (actionTypes[i] !== actionTypes[i + 1]) {
            oscillationCount++;
          }
        }
        
        if (oscillationCount >= 2) {
          signals.push({
            id: `flip-flop-${ruleId}-${Date.now()}`,
            type: "flip-flop",
            severity: "high",
            confidence: Math.min(1.0, oscillationCount / 5),
            explanation: `Rule "${ruleId}" exhibits oscillation patterns with ${oscillationCount} changes in policy approach, suggesting instability in policy direction.`
          });
        }
      }
    }
    
    return signals;
  }
  
  /**
   * Detects reviewer disagreement: inconsistent approval patterns
   */
  private detectReviewerDisagreement(reviews: PolicyReviewVerdict[]): DriftSignal[] {
    const signals: DriftSignal[] = [];
    
    if (!reviews || reviews.length === 0) {
      return signals;
    }
    
    // Calculate consistency metrics for reviews
    const approveCount = reviews.filter(r => r.decision === "approve").length;
    const rejectCount = reviews.filter(r => r.decision === "reject").length;
    const reviseCount = reviews.filter(r => r.decision === "revise").length;
    
    // Check for high variance in decision making
    const totalReviews = reviews.length;
    const approveRatio = approveCount / totalReviews;
    const rejectRatio = rejectCount / totalReviews;
    const reviseRatio = reviseCount / totalReviews;
    
    // If there's high variance in decisions, it might indicate disagreement
    // Calculate the variance of decision ratios
    const ratios = [approveRatio, rejectRatio, reviseRatio];
    const mean = ratios.reduce((a, b) => a + b, 0) / ratios.length;
    const variance = ratios.reduce((sum, ratio) => sum + Math.pow(ratio - mean, 2), 0) / ratios.length;
    
    // If variance is high, create signal for reviewer disagreement
    if (variance > 0.1) {
      signals.push({
        id: `reviewer-disagreement-${Date.now()}`,
        type: "reviewer-disagreement",
        severity: "medium",
        confidence: variance * 2, // Higher confidence with higher variance
        explanation: `Detected high variance in review decisions (${Math.round(approveRatio * 100)}% approve, ${Math.round(rejectRatio * 100)}% reject, ${Math.round(reviseRatio * 100)}% revise), suggesting potential inconsistency in review standards.`
      });
    }
    
    return signals;
  }
  
  /**
   * Calculates the overall drift score based on signals
   */
  private calculateDriftScore(
    signals: DriftSignal[], 
    traceCount: number, 
    recommendationCount: number
  ): number {
    if (signals.length === 0) {
      return 0; // No drift if no signals
    }
    
    // Calculate a weighted score based on signal count, severity, and confidence
    let totalScore = 0;
    let maxPossibleScore = 0;
    
    for (const signal of signals) {
      let severityWeight = 0;
      switch (signal.severity) {
        case "low": severityWeight = 0.2; break;
        case "medium": severityWeight = 0.5; break;
        case "high": severityWeight = 0.8; break;
        case "critical": severityWeight = 1.0; break;
      }
      
      // Add to total score weighted by severity and confidence
      totalScore += severityWeight * signal.confidence;
      maxPossibleScore += severityWeight; // Max possible is all signals at 100% confidence
    }
    
    // Normalize the score to 0-1 range
    const normalizedScore = maxPossibleScore > 0 ? totalScore / maxPossibleScore : 0;
    
    // Adjust score based on relative volume of signals to data
    const signalToDataRatio = signals.length / (traceCount + recommendationCount + 1); // +1 to avoid division by zero
    return Math.min(1.0, normalizedScore * (1 + signalToDataRatio * 2)); // Amplify based on ratio of signals to data
  }
  
  /**
   * Classifies the drift level based on the score
   */
  private classifyDrift(score: number): "stable" | "watch" | "volatile" | "critical" {
    if (score < 0.2) {
      return "stable";
    } else if (score < 0.5) {
      return "watch";
    } else if (score < 0.8) {
      return "volatile";
    } else {
      return "critical";
    }
  }
  
  /**
   * Generates a narrative summary of the drift analysis
   */
  private generateNarrativeSummary(analysis: PolicyDriftAnalysis, timeWindow: { from: number; to: number }): string {
    const { signals, overallDriftScore, classification } = analysis;
    
    const signalCount = signals.length;
    const highSeverityCount = signals.filter(s => s.severity === "high" || s.severity === "critical").length;
    const mediumSeverityCount = signals.filter(s => s.severity === "medium").length;
    const lowSeverityCount = signals.filter(s => s.severity === "low").length;
    
    const timeRangeHours = Math.round((timeWindow.to - timeWindow.from) / (1000 * 60 * 60));
    
    return `Drift analysis for ${timeRangeHours}h window: 
    Classification: ${classification.toUpperCase()} (Score: ${(overallDriftScore * 100).toFixed(1)}%).
    Found ${signalCount} drift signals (${highSeverityCount} high/critical, ${mediumSeverityCount} medium, ${lowSeverityCount} low).
    ${signalCount > 0 ? 'Policy shows signs of instability requiring attention.' : 'Policy appears stable with no significant drift signals.'}`;
  }
}