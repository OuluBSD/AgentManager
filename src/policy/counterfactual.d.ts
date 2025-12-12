import { PolicyTrace } from './trace';
import { PolicyRecommendation } from './inference';
import { PolicyReviewResult } from './review';
import { PolicyDriftAnalysis } from './drift';
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
        timeframe: {
            start: string;
            end: string;
        };
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
export declare class CounterfactualPolicySimulator {
    runSimulation(input: CounterfactualInput): CounterfactualResult;
    private createEvaluationInput;
    private calculateDifference;
    private updateAggregateStatistics;
    private generateNarrativeSummary;
}
//# sourceMappingURL=counterfactual.d.ts.map