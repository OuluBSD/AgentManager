import { PolicyRecommendation } from './inference';
export interface PolicyReviewRequest {
    recommendations: PolicyRecommendation[];
    policyContext: any;
    projectContext?: any;
}
export interface PolicyReviewVerdict {
    id: string;
    recommendationId: string;
    decision: "approve" | "reject" | "revise";
    riskScore: number;
    rationale: string;
    aiSummary: string;
}
export interface PolicyReviewResult {
    verdicts: PolicyReviewVerdict[];
    overallAssessment: string;
    governanceFlags: string[];
}
export interface LLMClient {
    generate(prompt: string): Promise<string>;
}
export declare class PolicyReviewEngine {
    private static readonly GOVERNING_PRINCIPLES;
    private llmClient;
    constructor(llmClient?: LLMClient);
    reviewPolicies(request: PolicyReviewRequest): Promise<PolicyReviewResult>;
    private performSafetyChecks;
    private generateVerdict;
    private generateAIVerdict;
    private generateReviewPrompt;
    private parseLLMResponse;
    private generateDeterministicVerdict;
    private generateDeterministicVerdictForId;
    private generateFallbackVerdicts;
    private generateOverallAssessment;
    private extractGovernanceFlagsFromVerdicts;
    private generateDeterministicId;
}
//# sourceMappingURL=review.d.ts.map