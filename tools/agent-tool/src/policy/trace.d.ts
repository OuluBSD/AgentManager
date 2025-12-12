export interface PolicyTrace {
    actionId: string;
    actionType: string;
    timestamp: string;
    evaluatedRules: Array<{
        ruleId: string;
        matched: boolean;
        matchReason?: string;
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
    summaryForAI: string;
    summaryForHuman: string;
}
export interface PolicyEvaluationInput {
    action: {
        type: string;
        command?: string;
        path?: string;
        sessionId?: string;
        projectPath?: string;
    };
    context: any;
    policy: any;
}
export interface PolicyEvaluationResult {
    outcome: 'ALLOW' | 'DENY' | 'REVIEW';
    reason?: string;
    policyTrace: PolicyTrace;
}
//# sourceMappingURL=trace.d.ts.map