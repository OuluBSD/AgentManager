import { PolicyTrace } from './trace';
export interface PolicyInferenceInput {
    traces: PolicyTrace[];
    metadata?: any;
}
export interface PolicyRecommendation {
    id: string;
    type: "add-rule" | "modify-rule" | "remove-rule";
    reason: string;
    affectedActions: string[];
    proposedRule: any;
    confidence: number;
}
export interface PolicyInferenceResult {
    recommendations: PolicyRecommendation[];
    insights: string[];
    aiSummary: string;
}
export declare class PolicyInferenceEngine {
    inferPolicies(input: PolicyInferenceInput): Promise<PolicyInferenceResult>;
    private detectFrequentDenyPatterns;
    private detectFrequentOverrides;
    private detectReviewLoops;
    private detectUnusedRules;
    private detectActionPatterns;
    private extractConditionsFromTraces;
    private analyzePathPatterns;
    private generateInsights;
    private generateAISummary;
    private calculateConfidence;
    private generateDeterministicId;
}
//# sourceMappingURL=inference.d.ts.map