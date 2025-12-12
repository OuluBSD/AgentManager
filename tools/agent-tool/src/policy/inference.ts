import { PolicyTrace } from './trace';

export interface PolicyInferenceInput {
  traces: PolicyTrace[];     // from artifact replay or live collection
  metadata?: any;            // session info, project info, etc.
}

export interface PolicyRecommendation {
  id: string;
  type: "add-rule" | "modify-rule" | "remove-rule";
  reason: string;
  affectedActions: string[];
  proposedRule: any;         // follows the policy model schema
  confidence: number;        // 0–1 float
}

export interface PolicyInferenceResult {
  recommendations: PolicyRecommendation[];
  insights: string[];        // human-readable insights
  aiSummary: string;         // compressed summary for AI learning layer
}

export class PolicyInferenceEngine {
  /**
   * Analyzes policy traces to identify patterns and generate recommendations
   */
  public async inferPolicies(input: PolicyInferenceInput): Promise<PolicyInferenceResult> {
    const { traces, metadata } = input;
    
    // Initialize result structure
    const result: PolicyInferenceResult = {
      recommendations: [],
      insights: [],
      aiSummary: ''
    };
    
    if (!traces || traces.length === 0) {
      result.aiSummary = 'No policy traces provided for analysis';
      return result;
    }
    
    // Apply various heuristics to detect patterns
    const frequentDenyRecommendations = this.detectFrequentDenyPatterns(traces);
    const overrideRecommendations = this.detectFrequentOverrides(traces);
    const reviewLoopRecommendations = this.detectReviewLoops(traces);
    const unusedRuleRecommendations = this.detectUnusedRules(traces);
    const patternRecommendations = this.detectActionPatterns(traces);
    
    // Combine all recommendations
    result.recommendations = [
      ...frequentDenyRecommendations,
      ...overrideRecommendations,
      ...reviewLoopRecommendations,
      ...unusedRuleRecommendations,
      ...patternRecommendations
    ];
    
    // Generate insights
    result.insights = this.generateInsights(traces, result.recommendations);
    
    // Generate AI summary
    result.aiSummary = this.generateAISummary(traces, result.recommendations);
    
    return result;
  }
  
  /**
   * Detects frequent deny events for same pattern
   * Suggests new allow rules when the same pattern is repeatedly denied
   */
  private detectFrequentDenyPatterns(traces: PolicyTrace[]): PolicyRecommendation[] {
    const recommendations: PolicyRecommendation[] = [];
    const denyPatterns: Map<string, { count: number; examples: PolicyTrace[]; actionTypes: Set<string> }> = new Map();
    
    for (const trace of traces) {
      if (trace.finalDecision === 'deny') {
        // Group by match reasons for evalulated rules that caused denial
        const denyRules = trace.evaluatedRules.filter(rule => 
          rule.matched && rule.effect === 'deny'
        );
        
        for (const rule of denyRules) {
          const key = rule.matchReason || rule.ruleId;
          if (!denyPatterns.has(key)) {
            denyPatterns.set(key, {
              count: 0,
              examples: [],
              actionTypes: new Set()
            });
          }
          
          const pattern = denyPatterns.get(key)!;
          pattern.count++;
          pattern.examples.push(trace);
          pattern.actionTypes.add(trace.actionType);
        }
      }
    }
    
    // Create recommendations for patterns with high denial frequency
    for (const [key, pattern] of denyPatterns) {
      if (pattern.count >= 3) { // Threshold for recommendation
        recommendations.push({
          id: `deny-allow-${this.generateDeterministicId(key, traces.length)}`,
          type: "add-rule",
          reason: `Frequent denial pattern detected: "${key}". ${pattern.count} similar denials found.`,
          affectedActions: Array.from(pattern.actionTypes),
          proposedRule: {
            id: `auto-allow-${key.replace(/\s+/g, '-').toLowerCase()}`,
            description: `Auto-generated rule based on frequent deny pattern: ${key}`,
            conditions: {
              actionType: Array.from(pattern.actionTypes),
              // We'll need to determine specific conditions based on the pattern
              ...this.extractConditionsFromTraces(pattern.examples)
            },
            effect: "allow",
            priority: 150 // Higher than default deny rules to allow these actions
          },
          confidence: this.calculateConfidence(pattern.count, traces.length)
        });
      }
    }
    
    return recommendations;
  }
  
  /**
   * Detects frequent override usage
   * Suggests raising priority or unifying rules when overrides are frequently used
   */
  private detectFrequentOverrides(traces: PolicyTrace[]): PolicyRecommendation[] {
    const recommendations: PolicyRecommendation[] = [];
    const overrideTraces = traces.filter(trace => trace.overrideContext?.triggered);
    
    if (overrideTraces.length > 0) {
      const overrideReasons: Map<string, number> = new Map();
      
      for (const trace of overrideTraces) {
        const reason = trace.overrideContext?.reason || 'manual-override';
        overrideReasons.set(reason, (overrideReasons.get(reason) || 0) + 1);
      }
      
      for (const [reason, count] of overrideReasons) {
        if (count >= 2) { // Threshold for recommendation
          recommendations.push({
            id: `override-${this.generateDeterministicId(reason, traces.length)}`,
            type: "modify-rule",
            reason: `Frequent overrides with reason: "${reason}". ${count} overrides found. Consider modifying original rules to avoid need for overrides.`,
            affectedActions: Array.from(new Set(overrideTraces.filter(t => t.overrideContext?.reason === reason).map(t => t.actionType))),
            proposedRule: {
              // This would be a modification of the original rules that required override
              id: `modified-by-override-pattern`,
              description: `Rule modified based on override pattern: ${reason}`,
              // The recommendation would contain details on what to modify in the original rules
              modificationPattern: reason,
              changeRecommendation: `Consider adjusting priority or conditions of rules that require frequent overrides for: ${reason}`
            },
            confidence: this.calculateConfidence(count, traces.length)
          });
        }
      }
    }
    
    return recommendations;
  }
  
  /**
   * Detects review loops that consistently reach "allow"
   * Suggests formalizing the outcome as a direct allow rule
   */
  private detectReviewLoops(traces: PolicyTrace[]): PolicyRecommendation[] {
    const recommendations: PolicyRecommendation[] = [];
    const reviewTraces = traces.filter(trace => trace.finalDecision === 'review');
    
    if (reviewTraces.length > 0) {
      // For now, we'll just identify patterns. In a real implementation,
      // we'd need to know if these were later allowed or denied manually
      // This would require more information about post-review decisions
      const reviewReasons: Map<string, number> = new Map();
      
      for (const trace of reviewTraces) {
        const reason = trace.summaryForHuman || 'review-required';
        reviewReasons.set(reason, (reviewReasons.get(reason) || 0) + 1);
      }
      
      for (const [reason, count] of reviewReasons) {
        if (count >= 3) { // Threshold for recommendation
          recommendations.push({
            id: `review-formalize-${this.generateDeterministicId(reason, traces.length)}`,
            type: "add-rule",
            reason: `Frequent review requirement pattern detected: "${reason}". ${count} similar reviews found. Consider adding a more specific allow/deny rule to avoid review loops.`,
            affectedActions: Array.from(new Set(reviewTraces.filter(t =>
              (t.summaryForHuman || 'review-required') === reason).map(t => t.actionType))),
            proposedRule: {
              id: `auto-rule-${reason.replace(/\s+/g, '-').toLowerCase()}`,
              description: `Auto-generated rule to formalize review pattern: ${reason}`,
              conditions: {
                // Conditions would be inferred from the traces
                ...this.extractConditionsFromTraces(reviewTraces.filter(t =>
                  (t.summaryForHuman || 'review-required') === reason))
              },
              effect: "allow", // Default to allow, but this could be refined
              priority: 120
            },
            confidence: this.calculateConfidence(count, traces.length)
          });
        }
      }
    }
    
    return recommendations;
  }
  
  /**
   * Detects rules that never match
   * Suggests deprecation of unused rules
   */
  private detectUnusedRules(traces: PolicyTrace[]): PolicyRecommendation[] {
    const recommendations: PolicyRecommendation[] = [];
    
    // Collect all rule IDs that appeared in traces
    const allRuleIds = new Set<string>();
    for (const trace of traces) {
      for (const rule of trace.evaluatedRules) {
        allRuleIds.add(rule.ruleId);
      }
    }
    
    // In a real implementation, we'd need access to the full policy to determine
    // which rules exist but are never matched. For now, we'll simulate this
    // with a heuristic based on frequency of appearance.
    
    // Since we only have matching rules in traces, we'll look for rules that
    // appear very infrequently compared to the total trace count
    const ruleFrequency: Map<string, number> = new Map();
    for (const trace of traces) {
      for (const rule of trace.evaluatedRules.filter(r => r.matched)) {
        ruleFrequency.set(rule.ruleId, (ruleFrequency.get(rule.ruleId) || 0) + 1);
      }
    }
    
    // Define "unused" as rules that match in < 1% of traces
    const threshold = traces.length * 0.01;
    
    for (const [ruleId, frequency] of ruleFrequency) {
      if (frequency < threshold && threshold > 0) {
        recommendations.push({
          id: `deprecate-${ruleId}-${this.generateDeterministicId(ruleId, traces.length)}`,
          type: "remove-rule",
          reason: `Rule "${ruleId}" appears to be rarely used. Matched in only ${frequency} out of ${traces.length} traces (${(frequency/traces.length*100).toFixed(2)}%). Consider deprecation.`,
          affectedActions: [], // Would need to analyze which actions this rule would have affected
          proposedRule: {
            ruleId: ruleId,
            removalReason: 'Low usage pattern detected'
          },
          confidence: this.calculateConfidence(frequency, traces.length)
        });
      }
    }
    
    return recommendations;
  }
  
  /**
   * Detects repeated similar actions
   * Suggests templatized rules for common patterns
   */
  private detectActionPatterns(traces: PolicyTrace[]): PolicyRecommendation[] {
    const recommendations: PolicyRecommendation[] = [];
    
    // Group traces by action type
    const actionGroups: Map<string, PolicyTrace[]> = new Map();
    for (const trace of traces) {
      if (!actionGroups.has(trace.actionType)) {
        actionGroups.set(trace.actionType, []);
      }
      actionGroups.get(trace.actionType)!.push(trace);
    }
    
    // Look for patterns within each action type
    for (const [actionType, actionTraces] of actionGroups) {
      // Look for common path patterns if this is a file action
      if (actionType === 'write-file') {
        const pathPatterns = this.analyzePathPatterns(actionTraces);
        for (const pattern of pathPatterns) {
          if (pattern.frequency >= 3) {
            recommendations.push({
              id: `template-${actionType}-path-${this.generateDeterministicId(pattern.pattern, actionTraces.length)}`,
              type: "add-rule",
              reason: `Common path pattern detected for ${actionType}: ${pattern.pattern}. ${pattern.frequency} matches found.`,
              affectedActions: [actionType],
              proposedRule: {
                id: `auto-path-rule-${pattern.pattern.replace(/\//g, '-').replace(/[^a-z0-9-]/gi, '')}`,
                description: `Auto-generated rule for path pattern: ${pattern.pattern}`,
                conditions: {
                  actionType: actionType,
                  pathPattern: pattern.pattern
                },
                effect: pattern.prevalentDecision, // Use the most common decision for this pattern
                priority: 100
              },
              confidence: this.calculateConfidence(pattern.frequency, actionTraces.length)
            });
          }
        }
      }
      // Add more pattern detection for other action types as needed
    }
    
    return recommendations;
  }
  
  /**
   * Helper to extract common conditions from traces
   */
  private extractConditionsFromTraces(traces: PolicyTrace[]) {
    if (traces.length === 0) return {};
    
    // Extract path patterns if available
    const paths = traces
      .map(trace => trace.actionType === 'write-file' || trace.actionType === 'run-command' ? 
           trace.evaluatedRules.filter(r => r.matchReason?.includes('path')) : 
           [])
      .flat();
    
    // For now, return empty conditions - this would need more sophisticated analysis
    return {};
  }
  
  /**
   * Helper to analyze path patterns in file actions
   */
  private analyzePathPatterns(traces: PolicyTrace[]) {
    const pathCounts: Map<string, { count: number; decisions: string[] }> = new Map();
    
    for (const trace of traces) {
      if (trace.actionType === 'write-file' && trace.evaluatedRules.length > 0) {
        // Extract the path from the action or from rule match reasons
        // In practice, we'd need to extract this from the original action input or rule conditions
        const path = trace.summaryForHuman.includes('Path') ? 
          trace.summaryForHuman.match(/Path '([^']+)'/)?.[1] || '' : '';
          
        if (path) {
          if (!pathCounts.has(path)) {
            pathCounts.set(path, { count: 0, decisions: [] });
          }
          const entry = pathCounts.get(path)!;
          entry.count++;
          entry.decisions.push(trace.finalDecision);
        }
      }
    }
    
    // Group similar paths by directory or pattern
    const patternCounts: Map<string, { 
      frequency: number; 
      prevalentDecision: string 
    }> = new Map();
    
    for (const [path, data] of pathCounts) {
      // Extract common directory patterns
      const dir = path.substring(0, path.lastIndexOf('/'));
      if (dir) {
        if (!patternCounts.has(dir)) {
          patternCounts.set(dir, { 
            frequency: 0, 
            prevalentDecision: 'deny' // default
          });
        }
        const pattern = patternCounts.get(dir)!;
        pattern.frequency += data.count;
        
        // Determine the most common decision for this pattern
        const decisionCounts = data.decisions.reduce((acc, dec) => {
          acc[dec] = (acc[dec] || 0) + 1;
          return acc;
        }, {} as Record<string, number>);
        
        const prevalent = Object.entries(decisionCounts).reduce((a, b) => 
          decisionCounts[a[0]] > decisionCounts[b[0]] ? a : b)[0];
        pattern.prevalentDecision = prevalent;
      }
    }
    
    return Array.from(patternCounts.entries()).map(([pattern, data]) => ({
      pattern,
      frequency: data.frequency,
      prevalentDecision: data.prevalentDecision
    }));
  }
  
  /**
   * Generates human-readable insights from the analysis
   */
  private generateInsights(traces: PolicyTrace[], recommendations: PolicyRecommendation[]): string[] {
    const insights: string[] = [];
    
    // Count actions by decision
    const decisionCounts: Record<string, number> = { 
      allow: 0, 
      deny: 0, 
      review: 0 
    };
    
    for (const trace of traces) {
      decisionCounts[trace.finalDecision]++;
    }
    
    insights.push(
      `${traces.length} total actions analyzed: ${decisionCounts.allow} allowed, ${decisionCounts.deny} denied, ${decisionCounts.review} reviewed`
    );
    
    if (decisionCounts.deny > decisionCounts.allow * 0.5) {
      insights.push("High denial rate detected - policy might be too restrictive");
    }
    
    if (recommendations.length > 0) {
      const addRules = recommendations.filter(r => r.type === 'add-rule').length;
      const modifyRules = recommendations.filter(r => r.type === 'modify-rule').length;
      const removeRules = recommendations.filter(r => r.type === 'remove-rule').length;
      
      insights.push(
        `Policy inference identified ${recommendations.length} recommendations: ` +
        `${addRules} to add, ${modifyRules} to modify, ${removeRules} to remove`
      );
    } else {
      insights.push("No specific policy recommendations identified with current thresholds");
    }
    
    return insights;
  }
  
  /**
   * Generates a concise summary for AI consumption
   */
  private generateAISummary(traces: PolicyTrace[], recommendations: PolicyRecommendation[]): string {
    return `Policy inference analysis complete. Processed ${traces.length} traces. ` +
           `Generated ${recommendations.length} recommendations. ` +
           `Decisions: ${traces.filter(t => t.finalDecision === 'allow').length} allowed, ` +
           `${traces.filter(t => t.finalDecision === 'deny').length} denied, ` +
           `${traces.filter(t => t.finalDecision === 'review').length} reviewed.`;
  }
  
  /**
   * Calculates confidence based on frequency and total traces
   */
  private calculateConfidence(count: number, total: number): number {
    // Confidence increases with frequency but is normalized
    // Using a logarithmic scale to avoid very high confidence for just a few occurrences
    return Math.min(1.0, Math.log(count + 1) / Math.log(total + 10));
  }

  /**
   * Generates a deterministic ID based on input content
   */
  private generateDeterministicId(content: string, totalTraces: number): string {
    // Create a simple hash of the content combined with totalTraces
    const combined = `${content}-${totalTraces}`;
    let hash = 0;
    for (let i = 0; i < combined.length; i++) {
      const char = combined.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }

    // Convert to positive and limit to reasonable length
    const positiveHash = Math.abs(hash).toString(36);
    const truncatedHash = positiveHash.substring(0, 8);

    return `${totalTraces}-${truncatedHash}`;
  }
}