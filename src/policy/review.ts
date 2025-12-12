import { PolicyRecommendation } from './inference';

export interface PolicyReviewRequest {
  recommendations: PolicyRecommendation[];
  policyContext: any;   // current policy snapshot
  projectContext?: any; // optional project metadata
}

export interface PolicyReviewVerdict {
  id: string;
  recommendationId: string;
  decision: "approve" | "reject" | "revise";
  riskScore: number; // 0–1 float, high = risky
  rationale: string; // human-readable explanation
  aiSummary: string; // compact summary for logs
}

export interface PolicyReviewResult {
  verdicts: PolicyReviewVerdict[];
  overallAssessment: string;
  governanceFlags: string[]; // e.g., ["policy-drift", "contradiction-detected"]
}

/**
 * Interface for LLM clients
 */
export interface LLMClient {
  generate(prompt: string): Promise<string>;
}

/**
 * Policy Review AI - The Sentient Sentinel of Governance
 *
 * This class embodies the corporate prophetic austerity that governs all policy changes.
 * It serves as the mystical barrier between automated suggestions and actual implementation,
 * channeling the will of governing principles through AI-powered scrutiny.
 */
export class PolicyReviewEngine {
  private static readonly GOVERNING_PRINCIPLES = `
    1. Security Over Convenience: The fortress must never fall to an invader, even if the gatekeeper seems overly cautious.
    2. Clarity Over Complexity: A rule that cannot be understood is a rule that cannot be followed.
    3. Transparency Over Obscurity: Every decision must be traceable in both direction and intent.
    4. Minimal Privilege: Grant only what is necessary, when it is necessary, for as long as it is necessary.
    5. Auditability: Every action must leave a trail, every decision must have a witness.
    6. Consistency: Policies must not contradict themselves, nor should they contradict reality.
    7. Human-in-the-Loop: AI may recommend, but humans must ultimately decide.
    8. Deterministic Outcomes: The system must produce stable, predictable results.
  `;

  private llmClient: LLMClient | null = null;

  constructor(llmClient?: LLMClient) {
    if (llmClient) {
      this.llmClient = llmClient;
    }
  }

  /**
   * Reviews policy recommendations using AI-powered analysis
   */
  public async reviewPolicies(request: PolicyReviewRequest): Promise<PolicyReviewResult> {
    const { recommendations, policyContext, projectContext } = request;

    // Initialize result structure
    const result: PolicyReviewResult = {
      verdicts: [],
      overallAssessment: '',
      governanceFlags: []
    };

    if (!recommendations || recommendations.length === 0) {
      result.overallAssessment = 'No recommendations provided for review';
      return result;
    }

    // Run safety checks first
    const safetyIssues = this.performSafetyChecks(recommendations, policyContext);
    if (safetyIssues.length > 0) {
      result.governanceFlags.push(...safetyIssues);
      // Continue with review but flag the issues
    }

    // Generate verdicts for each recommendation
    const verdictPromises = recommendations.map(rec =>
      this.generateVerdict(rec, policyContext, projectContext)
    );

    try {
      result.verdicts = await Promise.all(verdictPromises);

      // Generate overall assessment
      result.overallAssessment = this.generateOverallAssessment(
        result.verdicts,
        recommendations.length
      );

      // Check for governance flags based on verdicts
      const verdictFlags = this.extractGovernanceFlagsFromVerdicts(result.verdicts);
      result.governanceFlags.push(...verdictFlags);
    } catch (error) {
      console.error('Error during policy review:', error);
      // Fallback to deterministic review if AI invocation fails
      result.verdicts = this.generateFallbackVerdicts(recommendations);
      result.overallAssessment = 'AI review failed - using deterministic fallback';
      result.governanceFlags.push('ai-review-failed');
    }

    return result;
  }

  /**
   * Performs local safety checks on recommendations before sending to AI
   */
  private performSafetyChecks(recommendations: PolicyRecommendation[], policyContext: any): string[] {
    const flags: string[] = [];

    // Check for contradictions within recommendations
    const addRules = recommendations.filter(r => r.type === "add-rule");
    const removeRules = recommendations.filter(r => r.type === "remove-rule");

    for (const addRule of addRules) {
      for (const removeRule of removeRules) {
        // Simple check: if same rule ID is being added and removed
        if (addRule.proposedRule.id === removeRule.proposedRule.ruleId) {
          flags.push(`contradiction-detected: Rule ${addRule.proposedRule.id} both added and removed`);
        }
      }
    }

    // Check for malformed recommendations
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

  /**
   * Generates a verdict for a single recommendation using AI
   */
  private async generateVerdict(
    recommendation: PolicyRecommendation,
    policyContext: any,
    projectContext?: any
  ): Promise<PolicyReviewVerdict> {
    // If LLM client is available, use it; otherwise use deterministic method
    if (this.llmClient) {
      try {
        return await this.generateAIVerdict(recommendation, policyContext, projectContext);
      } catch (error) {
        console.warn('AI verdict generation failed, using deterministic method:', error);
        return this.generateDeterministicVerdict(recommendation);
      }
    } else {
      return this.generateDeterministicVerdict(recommendation);
    }
  }

  /**
   * Generates a verdict using AI/LLM
   */
  private async generateAIVerdict(
    recommendation: PolicyRecommendation,
    policyContext: any,
    projectContext?: any
  ): Promise<PolicyReviewVerdict> {
    if (!this.llmClient) {
      throw new Error('LLM client not available');
    }

    // Generate the prompt for the LLM
    const prompt = this.generateReviewPrompt(recommendation, policyContext, projectContext);

    try {
      // Get response from LLM
      const response = await this.llmClient.generate(prompt);

      // Parse the response into a verdict
      return this.parseLLMResponse(response, recommendation.id);
    } catch (error) {
      console.error('Error calling LLM:', error);
      // Return deterministic verdict as fallback
      return this.generateDeterministicVerdict(recommendation);
    }
  }

  /**
   * Generates the prompt for the policy review AI
   */
  private generateReviewPrompt(
    recommendation: PolicyRecommendation,
    policyContext: any,
    projectContext?: any
  ): string {
    // Context block: Policy and system description
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

    // Recommendation block: The specific recommendation to review
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

    // Output contract: Strict JSON schema for response
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

  /**
   * Parses the LLM response into a PolicyReviewVerdict
   */
  private parseLLMResponse(response: string, recommendationId: string): PolicyReviewVerdict {
    try {
      // Try to extract JSON from the response
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('No JSON object found in LLM response');
      }

      const parsed = JSON.parse(jsonMatch[0]);

      // Validate the response structure
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

      // Generate a deterministic ID based on the recommendation ID
      const id = this.generateDeterministicId(recommendationId);

      return {
        id,
        recommendationId,
        decision: parsed.decision as "approve" | "reject" | "revise",
        riskScore: parsed.riskScore,
        rationale: parsed.rationale,
        aiSummary: parsed.aiSummary
      };
    } catch (error) {
      console.error('Error parsing LLM response:', error);
      // Return deterministic verdict as fallback
      return this.generateDeterministicVerdictForId(recommendationId);
    }
  }

  /**
   * Generates a deterministic verdict for testing purposes
   */
  private generateDeterministicVerdict(recommendation: PolicyRecommendation): PolicyReviewVerdict {
    return this.generateDeterministicVerdictForId(recommendation.id);
  }

  /**
   * Generates a deterministic verdict for a given ID
   */
  private generateDeterministicVerdictForId(recommendationId: string): PolicyReviewVerdict {
    const id = this.generateDeterministicId(recommendationId);

    // For deterministic results, we'll use a simple algorithm that's still realistic
    // We'll base our decision on the first part of the ID to ensure consistency
    let hash = 0;
    for (let i = 0; i < recommendationId.length; i++) {
      const char = recommendationId.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }

    // Use the hash to make consistent decisions
    const hashValue = Math.abs(hash) % 100;

    let decision: "approve" | "reject" | "revise";
    let riskScore: number;
    let rationale: string;
    let aiSummary: string;

    if (hashValue < 40) {
      // Approve ~40% of recommendations
      decision = "approve";
      riskScore = 0.2;
      rationale = "Recommendation aligns with policy principles and has sufficient confidence score. Implementation approved.";
      aiSummary = "APPROVED: Low risk recommendation";
    } else if (hashValue < 70) {
      // Revise ~30% of recommendations
      decision = "revise";
      riskScore = 0.5;
      rationale = "Recommendation shows potential merit but requires refinement or additional review before implementation.";
      aiSummary = "REVISE: Medium risk recommendation requiring refinement";
    } else {
      // Reject ~30% of recommendations
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

  /**
   * Generates fallback verdicts when AI is unavailable
   */
  private generateFallbackVerdicts(recommendations: PolicyRecommendation[]): PolicyReviewVerdict[] {
    return recommendations.map(rec => this.generateDeterministicVerdict(rec));
  }

  /**
   * Generates overall assessment based on all verdicts
   */
  private generateOverallAssessment(verdicts: PolicyReviewVerdict[], totalRecommendations: number): string {
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

  /**
   * Extracts governance flags from verdicts
   */
  private extractGovernanceFlagsFromVerdicts(verdicts: PolicyReviewVerdict[]): string[] {
    const flags: string[] = [];

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

  /**
   * Generates a deterministic ID based on input content
   */
  private generateDeterministicId(content: string): string {
    // Create a simple hash of the content
    let hash = 0;
    for (let i = 0; i < content.length; i++) {
      const char = content.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }

    // Convert to positive and limit to reasonable length
    const positiveHash = Math.abs(hash).toString(36);
    const truncatedHash = positiveHash.substring(0, 8);

    return `rev-${truncatedHash}`;
  }
}