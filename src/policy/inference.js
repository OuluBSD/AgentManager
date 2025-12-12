"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PolicyInferenceEngine = void 0;
class PolicyInferenceEngine {
    async inferPolicies(input) {
        const { traces, metadata } = input;
        const result = {
            recommendations: [],
            insights: [],
            aiSummary: ''
        };
        if (!traces || traces.length === 0) {
            result.aiSummary = 'No policy traces provided for analysis';
            return result;
        }
        const frequentDenyRecommendations = this.detectFrequentDenyPatterns(traces);
        const overrideRecommendations = this.detectFrequentOverrides(traces);
        const reviewLoopRecommendations = this.detectReviewLoops(traces);
        const unusedRuleRecommendations = this.detectUnusedRules(traces);
        const patternRecommendations = this.detectActionPatterns(traces);
        result.recommendations = [
            ...frequentDenyRecommendations,
            ...overrideRecommendations,
            ...reviewLoopRecommendations,
            ...unusedRuleRecommendations,
            ...patternRecommendations
        ];
        result.insights = this.generateInsights(traces, result.recommendations);
        result.aiSummary = this.generateAISummary(traces, result.recommendations);
        return result;
    }
    detectFrequentDenyPatterns(traces) {
        const recommendations = [];
        const denyPatterns = new Map();
        for (const trace of traces) {
            if (trace.finalDecision === 'deny') {
                const denyRules = trace.evaluatedRules.filter(rule => rule.matched && rule.effect === 'deny');
                for (const rule of denyRules) {
                    const key = rule.matchReason || rule.ruleId;
                    if (!denyPatterns.has(key)) {
                        denyPatterns.set(key, {
                            count: 0,
                            examples: [],
                            actionTypes: new Set()
                        });
                    }
                    const pattern = denyPatterns.get(key);
                    pattern.count++;
                    pattern.examples.push(trace);
                    pattern.actionTypes.add(trace.actionType);
                }
            }
        }
        for (const [key, pattern] of denyPatterns) {
            if (pattern.count >= 3) {
                recommendations.push({
                    id: `deny-allow-${this.generateDeterministicId(key, traces.length)}`,
                    type: "add-rule",
                    reason: `Frequent denial pattern detected: "${key}". ${pattern.count} similar denials found.`,
                    affectedActions: Array.from(pattern.actionTypes),
                    proposedRule: {
                        id: `auto-allow-${key.replace(/\s+/g, '-').toLowerCase()}`,
                        description: `Auto-generated rule based on frequent deny pattern: ${key}`,
                        conditions: {
                            actionType: Array.from(pattern.actionTypes),
                            ...this.extractConditionsFromTraces(pattern.examples)
                        },
                        effect: "allow",
                        priority: 150
                    },
                    confidence: this.calculateConfidence(pattern.count, traces.length)
                });
            }
        }
        return recommendations;
    }
    detectFrequentOverrides(traces) {
        const recommendations = [];
        const overrideTraces = traces.filter(trace => trace.overrideContext?.triggered);
        if (overrideTraces.length > 0) {
            const overrideReasons = new Map();
            for (const trace of overrideTraces) {
                const reason = trace.overrideContext?.reason || 'manual-override';
                overrideReasons.set(reason, (overrideReasons.get(reason) || 0) + 1);
            }
            for (const [reason, count] of overrideReasons) {
                if (count >= 2) {
                    recommendations.push({
                        id: `override-${this.generateDeterministicId(reason, traces.length)}`,
                        type: "modify-rule",
                        reason: `Frequent overrides with reason: "${reason}". ${count} overrides found. Consider modifying original rules to avoid need for overrides.`,
                        affectedActions: Array.from(new Set(overrideTraces.filter(t => t.overrideContext?.reason === reason).map(t => t.actionType))),
                        proposedRule: {
                            id: `modified-by-override-pattern`,
                            description: `Rule modified based on override pattern: ${reason}`,
                            modificationPattern: reason,
                            changeRecommendation: `Consider adjusting priority or conditions of rules that require frequent overrides for: ${reason}`
                        },
                        confidence: this.calculateConfidence(count, traces.length)
                    });
                }
            }
        }
        return recommendations;
    }
    detectReviewLoops(traces) {
        const recommendations = [];
        const reviewTraces = traces.filter(trace => trace.finalDecision === 'review');
        if (reviewTraces.length > 0) {
            const reviewReasons = new Map();
            for (const trace of reviewTraces) {
                const reason = trace.summaryForHuman || 'review-required';
                reviewReasons.set(reason, (reviewReasons.get(reason) || 0) + 1);
            }
            for (const [reason, count] of reviewReasons) {
                if (count >= 3) {
                    recommendations.push({
                        id: `review-formalize-${this.generateDeterministicId(reason, traces.length)}`,
                        type: "add-rule",
                        reason: `Frequent review requirement pattern detected: "${reason}". ${count} similar reviews found. Consider adding a more specific allow/deny rule to avoid review loops.`,
                        affectedActions: Array.from(new Set(reviewTraces.filter(t => (t.summaryForHuman || 'review-required') === reason).map(t => t.actionType))),
                        proposedRule: {
                            id: `auto-rule-${reason.replace(/\s+/g, '-').toLowerCase()}`,
                            description: `Auto-generated rule to formalize review pattern: ${reason}`,
                            conditions: {
                                ...this.extractConditionsFromTraces(reviewTraces.filter(t => (t.summaryForHuman || 'review-required') === reason))
                            },
                            effect: "allow",
                            priority: 120
                        },
                        confidence: this.calculateConfidence(count, traces.length)
                    });
                }
            }
        }
        return recommendations;
    }
    detectUnusedRules(traces) {
        const recommendations = [];
        const allRuleIds = new Set();
        for (const trace of traces) {
            for (const rule of trace.evaluatedRules) {
                allRuleIds.add(rule.ruleId);
            }
        }
        const ruleFrequency = new Map();
        for (const trace of traces) {
            for (const rule of trace.evaluatedRules.filter(r => r.matched)) {
                ruleFrequency.set(rule.ruleId, (ruleFrequency.get(rule.ruleId) || 0) + 1);
            }
        }
        const threshold = traces.length * 0.01;
        for (const [ruleId, frequency] of ruleFrequency) {
            if (frequency < threshold && threshold > 0) {
                recommendations.push({
                    id: `deprecate-${ruleId}-${this.generateDeterministicId(ruleId, traces.length)}`,
                    type: "remove-rule",
                    reason: `Rule "${ruleId}" appears to be rarely used. Matched in only ${frequency} out of ${traces.length} traces (${(frequency / traces.length * 100).toFixed(2)}%). Consider deprecation.`,
                    affectedActions: [],
                    proposedRule: {
                        ruleId: ruleId,
                        removalReason: 'Low usage pattern detected'
                    },
                    confidence: this.calculateConfidence(frequency, traces.length)
                });
            }
        }
        return recommendations;
    }
    detectActionPatterns(traces) {
        const recommendations = [];
        const actionGroups = new Map();
        for (const trace of traces) {
            if (!actionGroups.has(trace.actionType)) {
                actionGroups.set(trace.actionType, []);
            }
            actionGroups.get(trace.actionType).push(trace);
        }
        for (const [actionType, actionTraces] of actionGroups) {
            if (actionType === 'write-file') {
                const pathPatterns = this.analyzePathPatterns(actionTraces);
                for (const pattern of pathPatterns) {
                    if (pattern.frequency >= 3) {
                        recommendations.push({
                            id: `template-${actionType}-path-${this.generateDeterministicId(pattern.pattern, actionTraces.length)}`,
                            type: "add-rule",
                            reason: `Common path pattern detected for ${actionType}: ${pattern.pattern}. ${pattern.frequency} matches found.`,
                            affectedActions: [actionType],
                            proposedRule: {
                                id: `auto-path-rule-${pattern.pattern.replace(/\//g, '-').replace(/[^a-z0-9-]/gi, '')}`,
                                description: `Auto-generated rule for path pattern: ${pattern.pattern}`,
                                conditions: {
                                    actionType: actionType,
                                    pathPattern: pattern.pattern
                                },
                                effect: pattern.prevalentDecision,
                                priority: 100
                            },
                            confidence: this.calculateConfidence(pattern.frequency, actionTraces.length)
                        });
                    }
                }
            }
        }
        return recommendations;
    }
    extractConditionsFromTraces(traces) {
        if (traces.length === 0)
            return {};
        const paths = traces
            .map(trace => trace.actionType === 'write-file' || trace.actionType === 'run-command' ?
            trace.evaluatedRules.filter(r => r.matchReason?.includes('path')) :
            [])
            .flat();
        return {};
    }
    analyzePathPatterns(traces) {
        const pathCounts = new Map();
        for (const trace of traces) {
            if (trace.actionType === 'write-file' && trace.evaluatedRules.length > 0) {
                const path = trace.summaryForHuman.includes('Path') ?
                    trace.summaryForHuman.match(/Path '([^']+)'/)?.[1] || '' : '';
                if (path) {
                    if (!pathCounts.has(path)) {
                        pathCounts.set(path, { count: 0, decisions: [] });
                    }
                    const entry = pathCounts.get(path);
                    entry.count++;
                    entry.decisions.push(trace.finalDecision);
                }
            }
        }
        const patternCounts = new Map();
        for (const [path, data] of pathCounts) {
            const dir = path.substring(0, path.lastIndexOf('/'));
            if (dir) {
                if (!patternCounts.has(dir)) {
                    patternCounts.set(dir, {
                        frequency: 0,
                        prevalentDecision: 'deny'
                    });
                }
                const pattern = patternCounts.get(dir);
                pattern.frequency += data.count;
                const decisionCounts = data.decisions.reduce((acc, dec) => {
                    acc[dec] = (acc[dec] || 0) + 1;
                    return acc;
                }, {});
                const prevalent = Object.entries(decisionCounts).reduce((a, b) => decisionCounts[a[0]] > decisionCounts[b[0]] ? a : b)[0];
                pattern.prevalentDecision = prevalent;
            }
        }
        return Array.from(patternCounts.entries()).map(([pattern, data]) => ({
            pattern,
            frequency: data.frequency,
            prevalentDecision: data.prevalentDecision
        }));
    }
    generateInsights(traces, recommendations) {
        const insights = [];
        const decisionCounts = {
            allow: 0,
            deny: 0,
            review: 0
        };
        for (const trace of traces) {
            decisionCounts[trace.finalDecision]++;
        }
        insights.push(`${traces.length} total actions analyzed: ${decisionCounts.allow} allowed, ${decisionCounts.deny} denied, ${decisionCounts.review} reviewed`);
        if (decisionCounts.deny > decisionCounts.allow * 0.5) {
            insights.push("High denial rate detected - policy might be too restrictive");
        }
        if (recommendations.length > 0) {
            const addRules = recommendations.filter(r => r.type === 'add-rule').length;
            const modifyRules = recommendations.filter(r => r.type === 'modify-rule').length;
            const removeRules = recommendations.filter(r => r.type === 'remove-rule').length;
            insights.push(`Policy inference identified ${recommendations.length} recommendations: ` +
                `${addRules} to add, ${modifyRules} to modify, ${removeRules} to remove`);
        }
        else {
            insights.push("No specific policy recommendations identified with current thresholds");
        }
        return insights;
    }
    generateAISummary(traces, recommendations) {
        return `Policy inference analysis complete. Processed ${traces.length} traces. ` +
            `Generated ${recommendations.length} recommendations. ` +
            `Decisions: ${traces.filter(t => t.finalDecision === 'allow').length} allowed, ` +
            `${traces.filter(t => t.finalDecision === 'deny').length} denied, ` +
            `${traces.filter(t => t.finalDecision === 'review').length} reviewed.`;
    }
    calculateConfidence(count, total) {
        return Math.min(1.0, Math.log(count + 1) / Math.log(total + 10));
    }
    generateDeterministicId(content, totalTraces) {
        const combined = `${content}-${totalTraces}`;
        let hash = 0;
        for (let i = 0; i < combined.length; i++) {
            const char = combined.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash;
        }
        const positiveHash = Math.abs(hash).toString(36);
        const truncatedHash = positiveHash.substring(0, 8);
        return `${totalTraces}-${truncatedHash}`;
    }
}
exports.PolicyInferenceEngine = PolicyInferenceEngine;
//# sourceMappingURL=inference.js.map