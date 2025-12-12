export interface PolicyTrace {
  actionId: string;          // unique ID per action (uuid)
  actionType: string;        // "run-command" | "write-file" | ...
  timestamp: string;

  evaluatedRules: Array<{
    ruleId: string;
    matched: boolean;
    matchReason?: string;    // explanation
    priority: number;
    effect: "allow" | "deny" | "review";
  }>;

  overrideContext?: {
    triggered: boolean;
    overrideRuleIds?: string[];
    reason?: string;
  };

  finalDecision: "allow" | "deny" | "review";
  finalRuleId?: string;

  summaryForAI: string;   // one-sentence explanation
  summaryForHuman: string; // rich explanation for developers
}

export interface PolicyEvaluationInput {
  action: {
    type: string;           // "run-command", "write-file", etc.
    command?: string;       // for run-command
    path?: string;          // for write-file or session operations
    sessionId?: string;
    projectPath?: string;
  };
  context: any;             // The session context and state
  policy: any;              // The policy configuration object
}

export interface PolicyEvaluationResult {
  outcome: 'ALLOW' | 'DENY' | 'REVIEW';
  reason?: string;
  policyTrace: PolicyTrace;
}