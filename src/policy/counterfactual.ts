import { PolicyTrace } from './trace';
import { PolicyRecommendation } from './inference';
import { PolicyReviewResult } from './review';
import { PolicyDriftAnalysis } from './drift';
import { evaluatePolicy, evaluateRunCommand, evaluateWriteFile, evaluateStartSession, PolicyEvaluationInput } from './engine';

export interface CounterfactualInput {
  originalPolicy: any;
  alternatePolicy: any;
  policyTraces: PolicyTrace[];
  inferenceHistory?: PolicyRecommendation[];
  reviewHistory?: PolicyReviewResult[];
  driftHistory?: PolicyDriftAnalysis[];
  context: {
    projectId: string;
    sessionIds: string[];
    timeframe: { start: string; end: string };
  };
}

export interface CounterfactualActionResult {
  actionId: string;
  originalDecision: 'ALLOW' | 'DENY' | 'REVIEW';
  simulatedDecision: 'ALLOW' | 'DENY' | 'REVIEW';
  difference: "same" | "weaker" | "stronger" | "contradiction";
  simulatedTrace: PolicyTrace;
}

export interface CounterfactualAggregate {
  weakerCount: number;
  strongerCount: number;
  contradictions: number;
  unchanged: number;
  weakenedActions: string[];
  strengthenedActions: string[];
  contradictionDetails: string[];
}

export interface CounterfactualResult {
  projectId: string;
  summary: CounterfactualAggregate;
  actions: CounterfactualActionResult[];
  narrativeSummary: string;
}

export class CounterfactualPolicySimulator {
  /**
   * Runs a counterfactual simulation comparing the original policy with an alternate policy
   */
  public runSimulation(input: CounterfactualInput): CounterfactualResult {
    const { originalPolicy, alternatePolicy, policyTraces, context } = input;
    
    // Initialize result structure
    const result: CounterfactualResult = {
      projectId: context.projectId,
      summary: {
        weakerCount: 0,
        strongerCount: 0,
        contradictions: 0,
        unchanged: 0,
        weakenedActions: [],
        strengthenedActions: [],
        contradictionDetails: []
      },
      actions: [],
      narrativeSummary: ''
    };

    // Process each policy trace with the alternate policy
    for (const originalTrace of policyTraces) {
      // Create an input that can be used with the policy engine based on the original trace
      const evaluationInput: PolicyEvaluationInput = this.createEvaluationInput(originalTrace, alternatePolicy);
      
      // Evaluate the action using the alternate policy
      const alternateResult = evaluatePolicy(evaluationInput);
      
      // Determine the difference between original and simulated decisions
      const difference = this.calculateDifference(
        originalTrace.finalDecision.toUpperCase() as 'ALLOW' | 'DENY' | 'REVIEW',
        alternateResult.outcome
      );
      
      // Update aggregate statistics based on difference
      this.updateAggregateStatistics(result.summary, difference, originalTrace.actionId);
      
      // Create the action result
      const actionResult: CounterfactualActionResult = {
        actionId: originalTrace.actionId,
        originalDecision: originalTrace.finalDecision.toUpperCase() as 'ALLOW' | 'DENY' | 'REVIEW',
        simulatedDecision: alternateResult.outcome,
        difference,
        simulatedTrace: alternateResult.policyTrace
      };
      
      result.actions.push(actionResult);
    }

    // Generate the narrative summary
    result.narrativeSummary = this.generateNarrativeSummary(result, input);

    return result;
  }

  /**
   * Creates a PolicyEvaluationInput based on the original trace and new policy
   */
  private createEvaluationInput(originalTrace: PolicyTrace, newPolicy: any): PolicyEvaluationInput {
    // Reconstruct the action based on the trace information
    let action: any = {
      type: originalTrace.actionType
    };

    // Extract action details from trace summary and evaluated rules
    if (originalTrace.actionType === 'run-command') {
      // Look for command pattern in the summary
      const commandMatch = originalTrace.summaryForHuman.match(/Action: ([^,]+)/);
      if (commandMatch) {
        action.command = commandMatch[1].trim();
      } else {
        // Try to extract from evaluated rules match reasons
        for (const rule of originalTrace.evaluatedRules) {
          if (rule.matchReason) {
            const cmdMatch = rule.matchReason.match(/Command '([^']+)'/);
            if (cmdMatch) {
              action.command = cmdMatch[1];
              break;
            }
          }
        }
      }

      // If we still don't have a command, use a default
      if (!action.command) {
        action.command = 'unknown-command';
      }
    } else if (originalTrace.actionType === 'write-file') {
      // Extract file path from summary or rule match reasons
      const pathMatch = originalTrace.summaryForHuman.match(/Path '([^']+)'/);
      if (pathMatch) {
        action.path = pathMatch[1];
      } else {
        // Try to extract from evaluated rules match reasons
        for (const rule of originalTrace.evaluatedRules) {
          if (rule.matchReason) {
            const pathMatch = rule.matchReason.match(/Path '([^']+)'/);
            if (pathMatch) {
              action.path = pathMatch[1];
              break;
            }
          }
        }
      }

      // If we still don't have a path, use a default
      if (!action.path) {
        action.path = 'unknown-path';
      }
    } else if (originalTrace.actionType === 'start') {
      // Extract project path from summary
      const pathMatch = originalTrace.summaryForHuman.match(/Path '([^']+)'/);
      if (pathMatch) {
        action.projectPath = pathMatch[1];
      } else {
        // Try to extract from evaluated rules match reasons
        for (const rule of originalTrace.evaluatedRules) {
          if (rule.matchReason) {
            const pathMatch = rule.matchReason.match(/Path '([^']+)'/);
            if (pathMatch) {
              action.projectPath = pathMatch[1];
              break;
            }
          }
        }
      }

      // If we still don't have a project path, use a default
      if (!action.projectPath) {
        action.projectPath = 'unknown-project-path';
      }
    }

    // For context, we'll use a default empty object
    // In a production implementation, this would need to be passed in or reconstructed
    const context: any = {};

    return {
      action,
      context,
      policy: newPolicy
    };
  }

  /**
   * Calculates the difference between original and alternate decisions
   */
  private calculateDifference(
    originalDecision: 'ALLOW' | 'DENY' | 'REVIEW',
    alternateDecision: 'ALLOW' | 'DENY' | 'REVIEW'
  ): "same" | "weaker" | "stronger" | "contradiction" {
    // If decisions are the same, return "same"
    if (originalDecision === alternateDecision) {
      return "same";
    }

    // Determine if the alternate decision is stronger, weaker, or contradictory
    if (originalDecision === 'ALLOW') {
      if (alternateDecision === 'REVIEW') return "stronger";  // ALLOW → REVIEW is stronger control
      if (alternateDecision === 'DENY') return "stronger";   // ALLOW → DENY is stronger control
    } else if (originalDecision === 'REVIEW') {
      if (alternateDecision === 'ALLOW') return "weaker";    // REVIEW → ALLOW is weaker control
      if (alternateDecision === 'DENY') return "stronger";   // REVIEW → DENY is stronger control
    } else if (originalDecision === 'DENY') {
      if (alternateDecision === 'ALLOW') return "weaker";    // DENY → ALLOW is weaker control
      if (alternateDecision === 'REVIEW') return "weaker";   // DENY → REVIEW is weaker control
    }

    // If we get here, there might be a contradictory change like DENY → ALLOW or ALLOW → DENY, etc.
    // We already handled the specific cases above, but for clarity we'll return contradiction for any remaining differences
    return "contradiction";
  }

  /**
   * Updates the aggregate statistics based on the difference
   */
  private updateAggregateStatistics(
    summary: CounterfactualAggregate,
    difference: "same" | "weaker" | "stronger" | "contradiction",
    actionId: string
  ): void {
    switch (difference) {
      case "weaker":
        summary.weakerCount++;
        summary.weakenedActions.push(actionId);
        break;
      case "stronger":
        summary.strongerCount++;
        summary.strengthenedActions.push(actionId);
        break;
      case "contradiction":
        summary.contradictions++;
        summary.contradictionDetails.push(`Action ${actionId}: Decision changed`);
        break;
      case "same":
        summary.unchanged++;
        break;
    }
  }

  /**
   * Generates a narrative summary of the simulation results
   */
  private generateNarrativeSummary(result: CounterfactualResult, input: CounterfactualInput): string {
    const { summary } = result;
    const totalActions = result.actions.length;

    // Calculate percentages
    const weakerPercent = totalActions > 0 ? (summary.weakerCount / totalActions) * 100 : 0;
    const strongerPercent = totalActions > 0 ? (summary.strongerCount / totalActions) * 100 : 0;
    const contradictionPercent = totalActions > 0 ? (summary.contradictions / totalActions) * 100 : 0;
    const unchangedPercent = totalActions > 0 ? (summary.unchanged / totalActions) * 100 : 0;

    // Generate the narrative
    let narrative = `Counterfactual Policy Simulation Results for Project: ${input.context.projectId}\n`;
    narrative += `Timeframe: ${input.context.timeframe.start} to ${input.context.timeframe.end}\n\n`;
    
    narrative += `Total actions analyzed: ${totalActions}\n`;
    narrative += `- Unchanged: ${summary.unchanged} (${unchangedPercent.toFixed(1)}%)\n`;
    narrative += `- Weakened: ${summary.weakerCount} (${weakerPercent.toFixed(1)}%) - alternate policy is more permissive\n`;
    narrative += `- Strengthened: ${summary.strongerCount} (${strongerPercent.toFixed(1)}%) - alternate policy is more restrictive\n`;
    narrative += `- Contradictions: ${summary.contradictions} (${contradictionPercent.toFixed(1)}%) - major policy differences\n\n`;

    if (summary.strongerCount > summary.weakerCount) {
      narrative += "The alternate policy exhibits stronger control mechanisms than the original policy.\n";
    } else if (summary.weakerCount > summary.strongerCount) {
      narrative += "The alternate policy is more permissive than the original policy.\n";
    } else {
      narrative += "The alternate policy shows balanced changes compared to the original policy.\n";
    }

    if (summary.contradictions > 0) {
      narrative += `Warning: ${summary.contradictions} contradictory decisions detected. This may indicate ` +
                   `logical inconsistencies between the original and alternate policies.\n`;
    }

    narrative += "\nOverall Governance Assessment:\n";
    if (summary.contradictions > totalActions * 0.1) { // More than 10% contradictions
      narrative += "- HIGH RISK: Policy exhibits significant contradictions that could cause governance uncertainty.\n";
    } else if (summary.contradictions > 0) {
      narrative += "- MODERATE RISK: Some contradictions detected; review recommended before adoption.\n";
    } else {
      narrative += "- LOW RISK: No contradictions detected in the simulation.\n";
    }

    return narrative;
  }
}