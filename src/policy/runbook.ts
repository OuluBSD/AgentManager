import { AutopilotOutput } from './autopilot';
import { PolicyDriftAnalysis } from './drift';
import { PolicyFuturesResult } from './futures';
import { FederatedPolicyHealth } from './federated';
import { PolicyTrace } from './trace';
import { PolicyReviewResult } from './review';

export interface RunbookStep {
  id: string;
  title: string;
  description: string;
  recommendedCommands: string[];
  expectedArtifacts: string[];
}

export interface RunbookOutput {
  projectId: string;
  runbookId: string;

  severity: "low" | "medium" | "high" | "critical";

  steps: RunbookStep[];

  narrative: string;
}

export interface RunbookInput {
  projectId: string;

  autopilot: AutopilotOutput;
  drift?: PolicyDriftAnalysis;
  futures?: PolicyFuturesResult;
  federated?: FederatedPolicyHealth;
  recentTraces?: PolicyTrace[];
  recentReviews?: PolicyReviewResult[];

  timestamps: {
    now: string;
  };
}

export class RunbookPlanner {
  /**
   * Generates a runbook based on governance signals from various policy layers
   */
  public generate(input: RunbookInput): RunbookOutput {
    const { autopilot, drift, futures, federated, recentTraces, recentReviews } = input;

    // Determine severity from the autopilot
    let severity: "low" | "medium" | "high" | "critical" = "low";
    switch (autopilot.risk.globalRisk) {
      case "critical":
        severity = "critical";
        break;
      case "volatile":
        severity = "high";
        break;
      case "elevated":
        severity = "medium";
        break;
      case "stable":
      default:
        severity = "low";
        break;
    }

    // Generate appropriate runbooks based on the detected issues
    const steps: RunbookStep[] = [];

    // Detect drift and generate drift investigation runbook if needed
    if (drift && drift.overallDriftScore > 0.5) {
      steps.push(...this.generateDriftInvestigationRunbook(input));
    }

    // Generate volatility mitigation runbook if needed
    if (futures && futures.aggregate.volatilityIndex > 0.4) {
      steps.push(...this.generateVolatilityMitigationRunbook(input));
    }

    // Generate federated sync runbook if needed
    if (federated && federated.systemStabilityScore < 0.5) {
      steps.push(...this.generateFederatedSyncRunbook(input));
    }

    // Check for contradictions in review results
    if (recentReviews && Array.isArray(recentReviews) &&
        recentReviews.some(review => review.governanceFlags &&
                                    review.governanceFlags.includes("contradiction-detected"))) {
      steps.push(...this.generateContradictionResolutionRunbook(input));
    }

    // Generate critical state runbook if needed
    if (severity === "critical") {
      steps.push(...this.generateCriticalStateRunbook(input));
    }

    // If no specific issues were detected but risk level is elevated or higher, add a general investigation
    if (steps.length === 0 && severity !== "low") {
      steps.push(this.generateGeneralInvestigationStep(input));
    }

    // If still no steps, add a monitoring step
    if (steps.length === 0) {
      steps.push(this.generateMonitoringStep(input));
    }

    // Generate narrative
    const narrative = this.generateNarrative(input, steps.length, severity);

    // Generate a unique runbook ID
    const runbookId = `runbook-${input.projectId}-${new Date(input.timestamps.now).getTime()}`;

    return {
      projectId: input.projectId,
      runbookId,
      severity,
      steps,
      narrative
    };
  }

  /**
   * Generates a runbook for investigating policy drift
   */
  private generateDriftInvestigationRunbook(input: RunbookInput): RunbookStep[] {
    const steps: RunbookStep[] = [];

    steps.push({
      id: `drift-investigation-${Date.now()}-1`,
      title: "Inspect Policy Traces",
      description: "Review recent policy traces to understand the patterns of drift",
      recommendedCommands: [
        `nexus-agent-tool describe-replay --artifact-run ${input.projectId}/replay`,
        `ls -la ${input.projectId}/policy-trace/`
      ],
      expectedArtifacts: [
        "Policy trace analysis showing decision patterns",
        "Files demonstrating when/why policy diverged"
      ]
    });

    steps.push({
      id: `drift-investigation-${Date.now()}-2`,
      title: "Generate Policy Diffs",
      description: "Compare policy snapshots to identify specific drift points",
      recommendedCommands: [
        `nexus-agent-tool detect-drift --artifact-dir ${input.projectId} --output drift-analysis.json`,
        `git diff ${input.projectId}/policy-snapshot-previous.json ${input.projectId}/policy-snapshot-current.json`
      ],
      expectedArtifacts: [
        "Drift analysis report",
        "Policy snapshot diff showing changes"
      ]
    });

    steps.push({
      id: `drift-investigation-${Date.now()}-3`,
      title: "Identify Oscillating Rules",
      description: "Find rules that appear to be changing back and forth frequently",
      recommendedCommands: [
        `grep -r "oscillat" ${input.projectId}/policy-trace/ || echo "No oscillation patterns found"`,
        `cat ${input.projectId}/policy-drift/drift-analysis.json | jq '.signals[] | select(.type == "flip-flop")'`
      ],
      expectedArtifacts: [
        "List of rules with oscillation patterns",
        "Timestamps of when oscillations occurred"
      ]
    });

    steps.push({
      id: `drift-investigation-${Date.now()}-4`,
      title: "Suggest Stabilization Edits",
      description: "Provide concrete policy recommendations to stabilize the system",
      recommendedCommands: [
        `nexus-agent-tool infer-policy --artifact-dir ${input.projectId} --output policy-recommendations.json`,
        `nexus-agent-tool review-policy --artifact-dir ${input.projectId} --input policy-recommendations.json --output review-verdicts.json`
      ],
      expectedArtifacts: [
        "Policy recommendations for stabilization",
        "Reviewed recommendations ready for implementation"
      ]
    });

    return steps;
  }

  /**
   * Generates a runbook for mitigating policy volatility
   */
  private generateVolatilityMitigationRunbook(input: RunbookInput): RunbookStep[] {
    const steps: RunbookStep[] = [];

    steps.push({
      id: `volatility-mitigation-${Date.now()}-1`,
      title: "Freeze Risky Policy Areas",
      description: "Temporarily restrict high-risk policy modifications during high volatility periods",
      recommendedCommands: [
        `cp ${input.projectId}/policy-current.json ${input.projectId}/policy-frozen-${Date.now()}.json`,
        `echo 'Policy frozen to prevent further volatility' > ${input.projectId}/POLICY_FROZEN_NOTE.txt`
      ],
      expectedArtifacts: [
        "Frozen policy backup",
        "Note explaining the freeze reason and duration"
      ]
    });

    steps.push({
      id: `volatility-mitigation-${Date.now()}-2`,
      title: "Add Temporary Guardrails",
      description: "Implement additional checks and balances to reduce volatility",
      recommendedCommands: [
        `nexus-agent-tool infer-policy --artifact-dir ${input.projectId} --output policy-recommendations.json`,
        `# Add extra review rules to policy: {\"type\": \"add-rule\", \"proposedRule\": {\"id\": \"guardrail-volatility\", \"mode\": \"review\", \"pattern\": \".*\", \"priority\": 100}}`,
        `# Then review: nexus-agent-tool review-policy --artifact-dir ${input.projectId} --input policy-recommendations.json --output review-verdicts.json`
      ],
      expectedArtifacts: [
        "Proposed guardrail rules",
        "Reviewed guardrail rules ready for implementation"
      ]
    });

    steps.push({
      id: `volatility-mitigation-${Date.now()}-3`,
      title: "Increase Review Frequency",
      description: "Ensure all policy changes are subject to more frequent review during volatility",
      recommendedCommands: [
        `# Update review schedule to be more frequent`,
        `# Modify autopilot config to trigger more frequent policy reviews`
      ],
      expectedArtifacts: [
        "Updated policy review configuration",
        "More frequent review scheduling"
      ]
    });

    return steps;
  }

  /**
   * Generates a runbook for federated policy synchronization
   */
  private generateFederatedSyncRunbook(input: RunbookInput): RunbookStep[] {
    const steps: RunbookStep[] = [];

    steps.push({
      id: `federated-sync-${Date.now()}-1`,
      title: "Compare Cluster Centroids",
      description: "Analyze policy similarities across federated projects to identify divergence points",
      recommendedCommands: [
        `nexus-agent-tool forecast-policy --artifact-dir ${input.projectId} --output federated-analysis.json`,
        `cat ${input.projectId}/federated-policy/federated-analysis.json | jq '.similarityMatrix'`
      ],
      expectedArtifacts: [
        "Similarity matrix showing project interconnections",
        "Cluster analysis identifying policy groups"
      ]
    });

    steps.push({
      id: `federated-sync-${Date.now()}-2`,
      title: "Generate Alignment Steps",
      description: "Create specific steps to align divergent policies across clusters",
      recommendedCommands: [
        `nexus-agent-tool forecast-policy --artifact-dir ${input.projectId} --output federated-analysis.json`,
        `cat ${input.projectId}/federated-policy/federated-analysis.json | jq '.consensus'`
      ],
      expectedArtifacts: [
        "Consensus policy vector",
        "Specific alignment recommendations"
      ]
    });

    steps.push({
      id: `federated-sync-${Date.now()}-3`,
      title: "Propose Rule Normalization Tasks",
      description: "Identify and propose tasks to normalize policy rules across federated systems",
      recommendedCommands: [
        `nexus-agent-tool infer-policy --artifact-dir ${input.projectId} --output normalization-recommendations.json`,
        `nexus-agent-tool review-policy --artifact-dir ${input.projectId} --input normalization-recommendations.json --output normalization-verdicts.json`
      ],
      expectedArtifacts: [
        "Normalization rule recommendations",
        "Reviewed normalization rules ready for implementation"
      ]
    });

    return steps;
  }

  /**
   * Generates a runbook for resolving policy contradictions
   */
  private generateContradictionResolutionRunbook(input: RunbookInput): RunbookStep[] {
    const steps: RunbookStep[] = [];

    steps.push({
      id: `contradiction-resolution-${Date.now()}-1`,
      title: "Gather Contradictory Traces",
      description: "Collect all policy traces that demonstrate contradictory behavior",
      recommendedCommands: [
        `grep -r "contradiction" ${input.projectId}/policy-trace/ || find ${input.projectId}/policy-trace/ -name "*.json" -exec grep -l "deny.*allow\|allow.*deny" {} \;`,
        `nexus-agent-tool describe-replay --artifact-run ${input.projectId}/replay | grep -A 10 -B 10 contradiction`
      ],
      expectedArtifacts: [
        "List of traces showing contradictory decisions",
        "Timeline of contradiction occurrences"
      ]
    });

    steps.push({
      id: `contradiction-resolution-${Date.now()}-2`,
      title: "Show Trace Pairs",
      description: "Display pairs of traces that show contradictory policy decisions",
      recommendedCommands: [
        `# Extract all deny/allow pairs for the same or similar commands`,
        `find ${input.projectId}/policy-trace/ -name "*.json" -exec grep -l '"finalDecision":"deny"' {} \; > denies.txt`,
        `find ${input.projectId}/policy-trace/ -name "*.json" -exec grep -l '"finalDecision":"allow"' {} \; > allows.txt`,
        `# Then compare: diff denies.txt allows.txt`
      ],
      expectedArtifacts: [
        "Files showing conflicting trace pairs",
        "Analysis of why contradictions occurred"
      ]
    });

    steps.push({
      id: `contradiction-resolution-${Date.now()}-3`,
      title: "Suggest Contradiction Resolution Methods",
      description: "Provide approaches for reconciling contradictory policy semantics",
      recommendedCommands: [
        `nexus-agent-tool infer-policy --artifact-dir ${input.projectId} --output contradiction-recommendations.json`,
        `nexus-agent-tool review-policy --artifact-dir ${input.projectId} --input contradiction-recommendations.json --output contradiction-reviews.json`
      ],
      expectedArtifacts: [
        "Recommendations to resolve contradictions",
        "Reviewed resolution methods ready for implementation"
      ]
    });

    return steps;
  }

  /**
   * Generates an emergency runbook for critical risk states
   */
  private generateCriticalStateRunbook(input: RunbookInput): RunbookStep[] {
    const steps: RunbookStep[] = [];

    steps.push({
      id: `critical-state-${Date.now()}-1`,
      title: "Execute Emergency Steps",
      description: "Take immediate action to stabilize the critical situation",
      recommendedCommands: [
        `# Immediately freeze all policy modifications`,
        `nexus-agent-tool describe-replay --artifact-run ${input.projectId}/replay`,
        `cp ${input.projectId}/policy-current.json ${input.projectId}/policy-emergency-backup-${Date.now()}.json`
      ],
      expectedArtifacts: [
        "Emergency policy backup",
        "Current state analysis report"
      ]
    });

    steps.push({
      id: `critical-state-${Date.now()}-2`,
      title: "Forced Policy Snapshot",
      description: "Take a mandatory snapshot of the current policy state for review",
      recommendedCommands: [
        `# Capture the exact policy state at this moment`,
        `nexus-agent-tool autopilot-cycle --artifact-dir ${input.projectId} --project-id ${input.projectId} --output emergency-snapshot.json`
      ],
      expectedArtifacts: [
        "Forced policy snapshot",
        "Critical state assessment report"
      ]
    });

    steps.push({
      id: `critical-state-${Date.now()}-3`,
      title: "Mandatory Human Escalation",
      description: "Require human intervention to address the critical policy state",
      recommendedCommands: [
        `echo "CRITICAL POLICY STATE DETECTED" > /tmp/policy-alert-${Date.now()}.txt`,
        `echo "Immediate human review required for project ${input.projectId}" >> /tmp/policy-alert-${Date.now()}.txt`
      ],
      expectedArtifacts: [
        "Escalation alert generated",
        "Human review ticket created"
      ]
    });

    steps.push({
      id: `critical-state-${Date.now()}-4`,
      title: "System Lockdown Suggestions",
      description: "Propose system lockdown measures to prevent further risk",
      recommendedCommands: [
        `# Propose additional security measures`,
        `nexus-agent-tool infer-policy --artifact-dir ${input.projectId} --output lockdown-recommendations.json --context critical`,
        `nexus-agent-tool review-policy --artifact-dir ${input.projectId} --input lockdown-recommendations.json --output lockdown-reviews.json`
      ],
      expectedArtifacts: [
        "Lockdown policy recommendations",
        "Reviewed lockdown measures ready for implementation"
      ]
    });

    return steps;
  }

  /**
   * Generates a general investigation step when risk is elevated
   */
  private generateGeneralInvestigationStep(input: RunbookInput): RunbookStep {
    return {
      id: `general-investigation-${Date.now()}`,
      title: "Comprehensive Policy Investigation",
      description: "Perform a thorough investigation of the policy system to identify root issues",
      recommendedCommands: [
        `nexus-agent-tool autopilot-cycle --artifact-dir ${input.projectId} --project-id ${input.projectId}`,
        `nexus-agent-tool detect-drift --artifact-dir ${input.projectId}`,
        `nexus-agent-tool forecast-policy --artifact-dir ${input.projectId}`
      ],
      expectedArtifacts: [
        "Autopilot analysis report",
        "Drift analysis report",
        "Policy futures forecast"
      ]
    };
  }

  /**
   * Generates a monitoring step when no specific issues are detected
   */
  private generateMonitoringStep(input: RunbookInput): RunbookStep {
    return {
      id: `monitoring-${Date.now()}`,
      title: "Continue Monitoring",
      description: "No specific issues detected, continue regular monitoring of the policy system",
      recommendedCommands: [
        `nexus-agent-tool autopilot-cycle --artifact-dir ${input.projectId} --project-id ${input.projectId}`,
        `nexus-agent-tool describe-replay --artifact-run ${input.projectId}/replay`
      ],
      expectedArtifacts: [
        "Regular monitoring report",
        "System health check"
      ]
    };
  }

  /**
   * Generates a narrative summary of the runbook
   */
  private generateNarrative(input: RunbookInput, stepCount: number, severity: "low" | "medium" | "high" | "critical"): string {
    let narrative = `Runbook for project ${input.projectId} - `;

    // Add severity assessment
    switch (severity) {
      case "critical":
        narrative += "CRITICAL: Immediate action required. ";
        break;
      case "high":
        narrative += "HIGH RISK: Urgent attention required. ";
        break;
      case "medium":
        narrative += "MODERATE RISK: Action needed. ";
        break;
      case "low":
        narrative += "LOW RISK: Monitoring recommended. ";
        break;
    }

    // Add number of steps
    narrative += `This runbook contains ${stepCount} steps to address governance issues. `;

    // Mention specific detected issues
    const issues = [];
    if (input.drift && input.drift.overallDriftScore > 0.5) {
      issues.push(`policy drift (score: ${input.drift.overallDriftScore.toFixed(2)})`);
    }
    if (input.futures && input.futures.aggregate.volatilityIndex > 0.4) {
      issues.push(`policy volatility (index: ${input.futures.aggregate.volatilityIndex.toFixed(2)})`);
    }
    if (input.federated && input.federated.systemStabilityScore < 0.5) {
      issues.push(`federated divergence (stability: ${(input.federated.systemStabilityScore * 100).toFixed(1)}%)`);
    }
    if (input.recentReviews && Array.isArray(input.recentReviews) &&
        input.recentReviews.some(review => review.governanceFlags &&
                                           review.governanceFlags.includes("contradiction-detected"))) {
      issues.push("policy contradictions");
    }

    if (issues.length > 0) {
      narrative += `Detected issues include: ${issues.join(", ")}. `;
    } else if (severity !== "low") {
      narrative += `Risk assessment indicates ${input.autopilot.risk.globalRisk} risk level. `;
    }

    // Add completion expectation
    narrative += "Follow all steps in sequence to restore governance stability.";

    return narrative;
  }
}