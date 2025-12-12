import { PolicyTrace } from './trace';
import { PolicyRecommendation } from './inference';
import { PolicyReviewVerdict } from './review';
export interface DriftAnalysisInput {
    traces: PolicyTrace[];
    recommendations: PolicyRecommendation[];
    reviews: PolicyReviewVerdict[];
    policySnapshot: any;
    timeWindow: {
        from: number;
        to: number;
    };
}
export interface DriftSignal {
    id: string;
    type: "rule-churn" | "override-escalation" | "permission-creep" | "restriction-creep" | "flip-flop" | "inconsistency-across-projects" | "temporal-anomaly" | "reviewer-disagreement";
    severity: "low" | "medium" | "high" | "critical";
    confidence: number;
    explanation: string;
}
export interface PolicyDriftAnalysis {
    signals: DriftSignal[];
    overallDriftScore: number;
    stabilityIndex: number;
    classification: "stable" | "watch" | "volatile" | "critical";
    narrativeSummary: string;
}
export declare class PolicyDriftEngine {
    analyzeDrift(input: DriftAnalysisInput): Promise<PolicyDriftAnalysis>;
    private detectRuleChurn;
    private detectOverrideEscalation;
    private detectPermissionCreep;
    private detectRestrictionCreep;
    private detectFlipFlop;
    private detectReviewerDisagreement;
    private calculateDriftScore;
    private classifyDrift;
    private generateNarrativeSummary;
}
//# sourceMappingURL=drift.d.ts.map