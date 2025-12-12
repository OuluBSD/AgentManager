"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PolicyDriftEngine = void 0;
class PolicyDriftEngine {
    async analyzeDrift(input) {
        const { traces, recommendations, reviews, timeWindow } = input;
        const analysis = {
            signals: [],
            overallDriftScore: 0,
            stabilityIndex: 1,
            classification: "stable",
            narrativeSummary: ""
        };
        if (!traces || traces.length === 0) {
            analysis.narrativeSummary = "No policy traces provided for drift analysis";
            return analysis;
        }
        const ruleChurnSignals = this.detectRuleChurn(recommendations, timeWindow);
        const overrideEscalationSignals = this.detectOverrideEscalation(traces, timeWindow);
        const permissionCreepSignals = this.detectPermissionCreep(recommendations, traces);
        const restrictionCreepSignals = this.detectRestrictionCreep(recommendations, traces);
        const flipFlopSignals = this.detectFlipFlop(recommendations, reviews);
        const reviewerDisagreementSignals = this.detectReviewerDisagreement(reviews);
        analysis.signals = [
            ...ruleChurnSignals,
            ...overrideEscalationSignals,
            ...permissionCreepSignals,
            ...restrictionCreepSignals,
            ...flipFlopSignals,
            ...reviewerDisagreementSignals
        ];
        analysis.overallDriftScore = this.calculateDriftScore(analysis.signals, traces.length, recommendations.length);
        analysis.stabilityIndex = 1 - analysis.overallDriftScore;
        analysis.classification = this.classifyDrift(analysis.overallDriftScore);
        analysis.narrativeSummary = this.generateNarrativeSummary(analysis, timeWindow);
        return analysis;
    }
    detectRuleChurn(recommendations, timeWindow) {
        const signals = [];
        if (!recommendations || recommendations.length === 0) {
            return signals;
        }
        const ruleRecommendations = new Map();
        for (const rec of recommendations) {
            let ruleId = rec.proposedRule.id || rec.proposedRule.ruleId;
            if (!ruleId && rec.reason) {
                const match = rec.reason.match(/Rule\s+"([^"]+)"/i);
                if (match) {
                    ruleId = match[1];
                }
            }
            if (ruleId) {
                if (!ruleRecommendations.has(ruleId)) {
                    ruleRecommendations.set(ruleId, []);
                }
                ruleRecommendations.get(ruleId).push(rec);
            }
        }
        for (const [ruleId, recs] of ruleRecommendations) {
            if (recs.length >= 3) {
                const timeRange = (timeWindow.to - timeWindow.from) / (1000 * 60 * 60);
                const churnRate = recs.length / timeRange;
                if (churnRate >= 1) {
                    signals.push({
                        id: `rule-churn-${ruleId}-${Date.now()}`,
                        type: "rule-churn",
                        severity: "high",
                        confidence: Math.min(1.0, churnRate / 5),
                        explanation: `Rule "${ruleId}" has been subject to ${recs.length} recommendations in the time window, indicating high churn. This may suggest policy instability.`
                    });
                }
                else if (churnRate >= 0.5) {
                    signals.push({
                        id: `rule-churn-${ruleId}-${Date.now()}`,
                        type: "rule-churn",
                        severity: "medium",
                        confidence: Math.min(0.8, churnRate / 3),
                        explanation: `Rule "${ruleId}" has been subject to ${recs.length} recommendations in the time window, indicating moderate churn.`
                    });
                }
            }
        }
        return signals;
    }
    detectOverrideEscalation(traces, timeWindow) {
        const signals = [];
        const overrideTraces = traces.filter(trace => trace.overrideContext?.triggered);
        if (overrideTraces.length === 0) {
            return signals;
        }
        const overrideDensity = overrideTraces.length / traces.length;
        if (overrideDensity >= 0.3) {
            signals.push({
                id: `override-escalation-${Date.now()}`,
                type: "override-escalation",
                severity: "high",
                confidence: overrideDensity,
                explanation: `Override density is ${Math.round(overrideDensity * 100)}%, indicating that a high percentage of actions are requiring policy overrides. This suggests the policy may be too restrictive.`
            });
        }
        else if (overrideDensity >= 0.15) {
            signals.push({
                id: `override-escalation-${Date.now()}`,
                type: "override-escalation",
                severity: "medium",
                confidence: overrideDensity,
                explanation: `Override density is ${Math.round(overrideDensity * 100)}%, indicating a moderate level of policy override usage.`
            });
        }
        return signals;
    }
    detectPermissionCreep(recommendations, traces) {
        const signals = [];
        const allowRecommendations = recommendations.filter(rec => (rec.type === "add-rule" && rec.proposedRule.effect === "allow") ||
            (rec.type === "modify-rule" && rec.reason.includes("allow")));
        if (allowRecommendations.length >= 5) {
            signals.push({
                id: `permission-creep-${Date.now()}`,
                type: "permission-creep",
                severity: "high",
                confidence: Math.min(1.0, allowRecommendations.length / 10),
                explanation: `Detected ${allowRecommendations.length} recommendations related to expanding permissions. This may indicate gradual permission creep.`
            });
        }
        else if (allowRecommendations.length >= 2) {
            signals.push({
                id: `permission-creep-${Date.now()}`,
                type: "permission-creep",
                severity: "medium",
                confidence: Math.min(0.7, allowRecommendations.length / 5),
                explanation: `Detected ${allowRecommendations.length} recommendations related to expanding permissions.`
            });
        }
        return signals;
    }
    detectRestrictionCreep(recommendations, traces) {
        const signals = [];
        const removalRecommendations = recommendations.filter(rec => rec.type === "remove-rule" ||
            (rec.type === "modify-rule" && rec.reason.includes("restrict")) ||
            (rec.type === "modify-rule" && rec.reason.includes("deny")));
        if (removalRecommendations.length >= 3) {
            signals.push({
                id: `restriction-creep-${Date.now()}`,
                type: "restriction-creep",
                severity: "high",
                confidence: Math.min(1.0, removalRecommendations.length / 5),
                explanation: `Detected ${removalRecommendations.length} recommendations to remove or weaken policy restrictions. This may indicate gradual constraint erosion.`
            });
        }
        else if (removalRecommendations.length >= 1) {
            signals.push({
                id: `restriction-creep-${Date.now()}`,
                type: "restriction-creep",
                severity: "medium",
                confidence: Math.min(0.6, removalRecommendations.length / 3),
                explanation: `Detected ${removalRecommendations.length} recommendations to remove or weaken policy restrictions.`
            });
        }
        return signals;
    }
    detectFlipFlop(recommendations, reviews) {
        const signals = [];
        const ruleActions = new Map();
        for (const rec of recommendations) {
            let ruleId = rec.proposedRule.id || rec.proposedRule.ruleId;
            if (!ruleId && rec.reason) {
                const match = rec.reason.match(/Rule\s+"([^"]+)"/i);
                if (match) {
                    ruleId = match[1];
                }
            }
            if (ruleId) {
                if (!ruleActions.has(ruleId)) {
                    ruleActions.set(ruleId, []);
                }
                ruleActions.get(ruleId).push({
                    type: rec.type,
                    time: Date.now(),
                    recommendation: rec
                });
            }
        }
        for (const [ruleId, actions] of ruleActions) {
            if (actions.length >= 3) {
                let oscillationCount = 0;
                const actionTypes = actions.map(a => a.type);
                if (actionTypes.includes("add-rule") && actionTypes.includes("remove-rule")) {
                    oscillationCount++;
                }
                for (let i = 0; i < actionTypes.length - 2; i++) {
                    if (actionTypes[i] !== actionTypes[i + 1]) {
                        oscillationCount++;
                    }
                }
                if (oscillationCount >= 2) {
                    signals.push({
                        id: `flip-flop-${ruleId}-${Date.now()}`,
                        type: "flip-flop",
                        severity: "high",
                        confidence: Math.min(1.0, oscillationCount / 5),
                        explanation: `Rule "${ruleId}" exhibits oscillation patterns with ${oscillationCount} changes in policy approach, suggesting instability in policy direction.`
                    });
                }
            }
        }
        return signals;
    }
    detectReviewerDisagreement(reviews) {
        const signals = [];
        if (!reviews || reviews.length === 0) {
            return signals;
        }
        const approveCount = reviews.filter(r => r.decision === "approve").length;
        const rejectCount = reviews.filter(r => r.decision === "reject").length;
        const reviseCount = reviews.filter(r => r.decision === "revise").length;
        const totalReviews = reviews.length;
        const approveRatio = approveCount / totalReviews;
        const rejectRatio = rejectCount / totalReviews;
        const reviseRatio = reviseCount / totalReviews;
        const ratios = [approveRatio, rejectRatio, reviseRatio];
        const mean = ratios.reduce((a, b) => a + b, 0) / ratios.length;
        const variance = ratios.reduce((sum, ratio) => sum + Math.pow(ratio - mean, 2), 0) / ratios.length;
        if (variance > 0.1) {
            signals.push({
                id: `reviewer-disagreement-${Date.now()}`,
                type: "reviewer-disagreement",
                severity: "medium",
                confidence: variance * 2,
                explanation: `Detected high variance in review decisions (${Math.round(approveRatio * 100)}% approve, ${Math.round(rejectRatio * 100)}% reject, ${Math.round(reviseRatio * 100)}% revise), suggesting potential inconsistency in review standards.`
            });
        }
        return signals;
    }
    calculateDriftScore(signals, traceCount, recommendationCount) {
        if (signals.length === 0) {
            return 0;
        }
        let totalScore = 0;
        let maxPossibleScore = 0;
        for (const signal of signals) {
            let severityWeight = 0;
            switch (signal.severity) {
                case "low":
                    severityWeight = 0.2;
                    break;
                case "medium":
                    severityWeight = 0.5;
                    break;
                case "high":
                    severityWeight = 0.8;
                    break;
                case "critical":
                    severityWeight = 1.0;
                    break;
            }
            totalScore += severityWeight * signal.confidence;
            maxPossibleScore += severityWeight;
        }
        const normalizedScore = maxPossibleScore > 0 ? totalScore / maxPossibleScore : 0;
        const signalToDataRatio = signals.length / (traceCount + recommendationCount + 1);
        return Math.min(1.0, normalizedScore * (1 + signalToDataRatio * 2));
    }
    classifyDrift(score) {
        if (score < 0.2) {
            return "stable";
        }
        else if (score < 0.5) {
            return "watch";
        }
        else if (score < 0.8) {
            return "volatile";
        }
        else {
            return "critical";
        }
    }
    generateNarrativeSummary(analysis, timeWindow) {
        const { signals, overallDriftScore, classification } = analysis;
        const signalCount = signals.length;
        const highSeverityCount = signals.filter(s => s.severity === "high" || s.severity === "critical").length;
        const mediumSeverityCount = signals.filter(s => s.severity === "medium").length;
        const lowSeverityCount = signals.filter(s => s.severity === "low").length;
        const timeRangeHours = Math.round((timeWindow.to - timeWindow.from) / (1000 * 60 * 60));
        return `Drift analysis for ${timeRangeHours}h window: 
    Classification: ${classification.toUpperCase()} (Score: ${(overallDriftScore * 100).toFixed(1)}%).
    Found ${signalCount} drift signals (${highSeverityCount} high/critical, ${mediumSeverityCount} medium, ${lowSeverityCount} low).
    ${signalCount > 0 ? 'Policy shows signs of instability requiring attention.' : 'Policy appears stable with no significant drift signals.'}`;
    }
}
exports.PolicyDriftEngine = PolicyDriftEngine;
//# sourceMappingURL=drift.js.map