export interface ChangeEntry {
  type: 'file-write' | 'command-run';
  timestamp: string;
  [key: string]: any; // Additional properties depending on the change type
}

export interface SessionState {
  sessionId: string;
  projectPath: string;
  parentSessionId: string | null;
  backend?: string; // optional for now
  notes: string[];
  changes: ChangeEntry[];
  status: 'active' | 'done' | 'error';
  policy?: any; // optional policy configuration for the session
}

export interface CommandResult<T = any> {
  status: 'ok' | 'error';
  data?: T;
  errors: Array<{
    type: string;
    message: string;
    details?: any;
  }>;
}

export interface FileWriteChange extends ChangeEntry {
  type: 'file-write';
  relPath: string;
}

export interface CommandRunChange extends ChangeEntry {
  type: 'command-run';
  cmd: string;
  exitCode: number;
}

// Types for the describe-replay command
export interface PolicyReviewSummary {
  status: 'ok' | 'error';
  verdicts: any[];  // Using any for now since we're extending the type dynamically
  overallAssessment: string;
  governanceFlags: string[];
  riskSummary?: string;
}

export interface PolicyDriftSummary {
  overallDriftScore: number;
  stabilityIndex: number;
  classification: "stable" | "watch" | "volatile" | "critical";
  signals: any[]; // Using any for now since we're extending the type dynamically
}

export interface ReplaySummary {
  artifactRunPath: string;
  meta: {
    sessionId: string;
    events: number;
  };
  steps: ReplayStep[];
  policyInference?: any;  // This was added dynamically in describe-replay
  policyReview?: PolicyReviewSummary;  // Add policy review summary as optional field
  policyDrift?: PolicyDriftSummary;    // Add policy drift summary as optional field
  federatedPolicy?: {
    clusters: { clusterId: string; members: string[] }[];
    outliers: string[];
    systemStabilityScore: number; // 0–1 float
  }; // Add federated policy information as optional field
  counterfactual?: {
    contradictions: number;
    stronger: number;
    weaker: number;
    narrativeSummary: string;
  }; // Add counterfactual policy simulation results as optional field
  futures?: {
    volatilityIndex: number; // 0–1 weighted volatility score
    riskLevel: "stable" | "elevated" | "volatile" | "critical";
    mostProbableNarrative: string;
    worstCaseNarrative: string;
    bestCaseNarrative: string;
  }; // Add futures forecast results as optional field
}

export interface ReplayStep {
  index: number;
  sessionId: string;
  filesWritten: string[];
  commands: Array<{
    cmd: string;
    exitCode: number | null;
  }>;
  buildAttempts: Array<{
    attempt: number;
    exitCode: number | null;
  }>;
  policyTraces?: PolicyTraceSummary[];
}

export interface PolicyTraceSummary {
  actionId: string;
  actionType: string;
  finalDecision: "allow" | "deny" | "review";
  finalRuleId?: string;
  summaryForHuman: string;
}