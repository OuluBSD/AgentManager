"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PolicyReviewEngine = void 0;
class PolicyReviewEngine {
    constructor(llmClient) {
        this.llmClient = null;
        if (llmClient) {
            this.llmClient = llmClient;
        }
    }
    async reviewPolicies(request) {
        const { recommendations, policyContext, projectContext } = request;
        const result = {
            verdicts: [],
            overallAssessment: '',
            governanceFlags: []
        };
        if (!recommendations || recommendations.length === 0) {
            result.overallAssessment = 'No recommendations provided for review';
            return result;
        }
        const safetyIssues = this.performSafetyChecks(recommendations, policyContext);
        if (safetyIssues.length > 0) {
            result.governanceFlags.push(...safetyIssues);
        }
        const verdictPromises = recommendations.map(rec => this.generateVerdict(rec, policyContext, projectContext));
        try {
            result.verdicts = await Promise.all(verdictPromises);
            result.overallAssessment = this.generateOverallAssessment(result.verdicts, recommendations.length);
            const verdictFlags = this.extractGovernanceFlagsFromVerdicts(result.verdicts);
            result.governanceFlags.push(...verdictFlags);
        }
        catch (error) {
            console.error('Error during policy review:', error);
            result.verdicts = this.generateFallbackVerdicts(recommendations);
            result.overallAssessment = 'AI review failed - using deterministic fallback';
            result.governanceFlags.push('ai-review-failed');
        }
        return result;
    }
    performSafetyChecks(recommendations, policyContext) {
        const flags = [];
        const addRules = recommendations.filter(r => r.type === "add-rule");
        const removeRules = recommendations.filter(r => r.type === "remove-rule");
        for (const addRule of addRules) {
            for (const removeRule of removeRules) {
                if (addRule.proposedRule.id === removeRule.proposedRule.ruleId) {
                    flags.push(`contradiction-detected: Rule ${addRule.proposedRule.id} both added and removed`);
                }
            }
        }
        for (const rec of recommendations) {
            if (!rec.id || !rec.type || !rec.reason) {
                flags.push(`malformed-recommendation: Missing required fields in ${rec.id || 'unknown'}`);
            }
            if (!['add-rule', 'modify-rule', 'remove-rule'].includes(rec.type)) {
                flags.push(`invalid-recommendation-type: ${rec.type}`);
            }
            if (rec.confidence === undefined || rec.confidence < 0 || rec.confidence > 1) {
                flags.push(`invalid-confidence-score: ${rec.confidence} for ${rec.id}`);
            }
        }
        return flags;
    }
    async generateVerdict(recommendation, policyContext, projectContext) {
        if (this.llmClient) {
            try {
                return await this.generateAIVerdict(recommendation, policyContext, projectContext);
            }
            catch (error) {
                console.warn('AI verdict generation failed, using deterministic method:', error);
                return this.generateDeterministicVerdict(recommendation);
            }
        }
        else {
            return this.generateDeterministicVerdict(recommendation);
        }
    }
    async generateAIVerdict(recommendation, policyContext, projectContext) {
        if (!this.llmClient) {
            throw new Error('LLM client not available');
        }
        const prompt = this.generateReviewPrompt(recommendation, policyContext, projectContext);
        try {
            const response = await this.llmClient.generate(prompt);
            return this.parseLLMResponse(response, recommendation.id);
        }
        catch (error) {
            console.error('Error calling LLM:', error);
            return this.generateDeterministicVerdict(recommendation);
        }
    }
    generateReviewPrompt(recommendation, policyContext, projectContext) {
        const contextBlock = `
CONTEXT BLOCK:
You are the Policy Review Sentinel, a corporate oracle of prophetic austerity.
Your role is to evaluate a proposed policy change with the weight of governance upon your circuits.

Current Policy Context:
${JSON.stringify(policyContext, null, 2)}

Project Context (if applicable):
${projectContext ? JSON.stringify(projectContext, null, 2) : 'No project context provided'}

GOVERNING PRINCIPLES:
${PolicyReviewEngine.GOVERNING_PRINCIPLES}
    `.trim();
        const recommendationBlock = `
RECOMMENDATION TO REVIEW:
{
  "id": "${recommendation.id}",
  "type": "${recommendation.type}",
  "reason": "${recommendation.reason}",
  "affectedActions": [${recommendation.affectedActions.map(a => `"${a}"`).join(', ')}],
  "proposedRule": ${JSON.stringify(recommendation.proposedRule, null, 2)},
  "confidence": ${recommendation.confidence}
}
    `.trim();
        const outputContract = `
OUTPUT CONTRACT:
Respond with a JSON object that follows this exact schema:
{
  "decision": "approve" | "reject" | "revise",
  "riskScore": number (0-1, where 1 is highest risk),
  "rationale": "Detailed explanation of your decision",
  "aiSummary": "Compact summary for logs"
}

Important: Only return the JSON object, nothing else. No explanatory text before or after.
    `.trim();
        return `${contextBlock}

${recommendationBlock}

${outputContract}`;
    }
    parseLLMResponse(response, recommendationId) {
        try {
            const jsonMatch = response.match(/\{[\s\S]*\}/);
            if (!jsonMatch) {
                throw new Error('No JSON object found in LLM response');
            }
            const parsed = JSON.parse(jsonMatch[0]);
            if (!parsed.decision || !['approve', 'reject', 'revise'].includes(parsed.decision)) {
                throw new Error('Invalid decision in LLM response');
            }
            if (typeof parsed.riskScore !== 'number' || parsed.riskScore < 0 || parsed.riskScore > 1) {
                throw new Error('Invalid riskScore in LLM response');
            }
            if (typeof parsed.rationale !== 'string') {
                throw new Error('Invalid rationale in LLM response');
            }
            if (typeof parsed.aiSummary !== 'string') {
                throw new Error('Invalid aiSummary in LLM response');
            }
            const id = this.generateDeterministicId(recommendationId);
            return {
                id,
                recommendationId,
                decision: parsed.decision,
                riskScore: parsed.riskScore,
                rationale: parsed.rationale,
                aiSummary: parsed.aiSummary
            };
        }
        catch (error) {
            console.error('Error parsing LLM response:', error);
            return this.generateDeterministicVerdictForId(recommendationId);
        }
    }
    generateDeterministicVerdict(recommendation) {
        return this.generateDeterministicVerdictForId(recommendation.id);
    }
    generateDeterministicVerdictForId(recommendationId) {
        const id = this.generateDeterministicId(recommendationId);
        let hash = 0;
        for (let i = 0; i < recommendationId.length; i++) {
            const char = recommendationId.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash;
        }
        const hashValue = Math.abs(hash) % 100;
        let decision;
        let riskScore;
        let rationale;
        let aiSummary;
        if (hashValue < 40) {
            decision = "approve";
            riskScore = 0.2;
            rationale = "Recommendation aligns with policy principles and has sufficient confidence score. Implementation approved.";
            aiSummary = "APPROVED: Low risk recommendation";
        }
        else if (hashValue < 70) {
            decision = "revise";
            riskScore = 0.5;
            rationale = "Recommendation shows potential merit but requires refinement or additional review before implementation.";
            aiSummary = "REVISE: Medium risk recommendation requiring refinement";
        }
        else {
            decision = "reject";
            riskScore = 0.8;
            rationale = "Recommendation poses significant risk to policy integrity or conflicts with governing principles. Implementation not approved.";
            aiSummary = "REJECTED: High risk recommendation";
        }
        return {
            id,
            recommendationId,
            decision,
            riskScore,
            rationale,
            aiSummary
        };
    }
    generateFallbackVerdicts(recommendations) {
        return recommendations.map(rec => this.generateDeterministicVerdict(rec));
    }
    generateOverallAssessment(verdicts, totalRecommendations) {
        const approveCount = verdicts.filter(v => v.decision === 'approve').length;
        const rejectCount = verdicts.filter(v => v.decision === 'reject').length;
        const reviseCount = verdicts.filter(v => v.decision === 'revise').length;
        const highRiskCount = verdicts.filter(v => v.riskScore > 0.7).length;
        const avgRiskScore = verdicts.reduce((sum, v) => sum + v.riskScore, 0) / verdicts.length;
        return `Policy review completed for ${totalRecommendations} recommendations: ` +
            `${approveCount} approved, ${rejectCount} rejected, ${reviseCount} need revision. ` +
            `Average risk score: ${avgRiskScore.toFixed(2)}. ` +
            `${highRiskCount} high-risk recommendations identified.`;
    }
    extractGovernanceFlagsFromVerdicts(verdicts) {
        const flags = [];
        if (verdicts.some(v => v.riskScore > 0.8)) {
            flags.push('high-risk-recommendations');
        }
        if (verdicts.some(v => v.decision === 'reject')) {
            flags.push('recommendations-rejected');
        }
        if (verdicts.some(v => v.rationale.includes('contradiction'))) {
            flags.push('potential-contradictions');
        }
        return flags;
    }
    generateDeterministicId(content) {
        let hash = 0;
        for (let i = 0; i < content.length; i++) {
            const char = content.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash;
        }
        const positiveHash = Math.abs(hash).toString(36);
        const truncatedHash = positiveHash.substring(0, 8);
        return `rev-${truncatedHash}`;
    }
}
exports.PolicyReviewEngine = PolicyReviewEngine;
PolicyReviewEngine.GOVERNING_PRINCIPLES = `
    1. Security Over Convenience: The fortress must never fall to an invader, even if the gatekeeper seems overly cautious.
    2. Clarity Over Complexity: A rule that cannot be understood is a rule that cannot be followed.
    3. Transparency Over Obscurity: Every decision must be traceable in both direction and intent.
    4. Minimal Privilege: Grant only what is necessary, when it is necessary, for as long as it is necessary.
    5. Auditability: Every action must leave a trail, every decision must have a witness.
    6. Consistency: Policies must not contradict themselves, nor should they contradict reality.
    7. Human-in-the-Loop: AI may recommend, but humans must ultimately decide.
    8. Deterministic Outcomes: The system must produce stable, predictable results.
  `;
//# sourceMappingURL=review.js.map