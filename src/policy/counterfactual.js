"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CounterfactualPolicySimulator = void 0;
const engine_1 = require("./engine");
class CounterfactualPolicySimulator {
    runSimulation(input) {
        const { originalPolicy, alternatePolicy, policyTraces, context } = input;
        const result = {
            projectId: context.projectId,
            summary: {
                weakerCount: 0,
                strongerCount: 0,
                contradictions: 0,
                unchanged: 0,
                weakenedActions: [],
                strengthenedActions: [],
                contradictionDetails: []
            },
            actions: [],
            narrativeSummary: ''
        };
        for (const originalTrace of policyTraces) {
            const evaluationInput = this.createEvaluationInput(originalTrace, alternatePolicy);
            const alternateResult = (0, engine_1.evaluatePolicy)(evaluationInput);
            const difference = this.calculateDifference(originalTrace.finalDecision.toUpperCase(), alternateResult.outcome);
            this.updateAggregateStatistics(result.summary, difference, originalTrace.actionId);
            const actionResult = {
                actionId: originalTrace.actionId,
                originalDecision: originalTrace.finalDecision.toUpperCase(),
                simulatedDecision: alternateResult.outcome,
                difference,
                simulatedTrace: alternateResult.policyTrace
            };
            result.actions.push(actionResult);
        }
        result.narrativeSummary = this.generateNarrativeSummary(result, input);
        return result;
    }
    createEvaluationInput(originalTrace, newPolicy) {
        let action = {
            type: originalTrace.actionType
        };
        if (originalTrace.actionType === 'run-command') {
            const commandMatch = originalTrace.summaryForHuman.match(/Action: ([^,]+)/);
            if (commandMatch) {
                action.command = commandMatch[1].trim();
            }
            else {
                for (const rule of originalTrace.evaluatedRules) {
                    if (rule.matchReason) {
                        const cmdMatch = rule.matchReason.match(/Command '([^']+)'/);
                        if (cmdMatch) {
                            action.command = cmdMatch[1];
                            break;
                        }
                    }
                }
            }
            if (!action.command) {
                action.command = 'unknown-command';
            }
        }
        else if (originalTrace.actionType === 'write-file') {
            const pathMatch = originalTrace.summaryForHuman.match(/Path '([^']+)'/);
            if (pathMatch) {
                action.path = pathMatch[1];
            }
            else {
                for (const rule of originalTrace.evaluatedRules) {
                    if (rule.matchReason) {
                        const pathMatch = rule.matchReason.match(/Path '([^']+)'/);
                        if (pathMatch) {
                            action.path = pathMatch[1];
                            break;
                        }
                    }
                }
            }
            if (!action.path) {
                action.path = 'unknown-path';
            }
        }
        else if (originalTrace.actionType === 'start') {
            const pathMatch = originalTrace.summaryForHuman.match(/Path '([^']+)'/);
            if (pathMatch) {
                action.projectPath = pathMatch[1];
            }
            else {
                for (const rule of originalTrace.evaluatedRules) {
                    if (rule.matchReason) {
                        const pathMatch = rule.matchReason.match(/Path '([^']+)'/);
                        if (pathMatch) {
                            action.projectPath = pathMatch[1];
                            break;
                        }
                    }
                }
            }
            if (!action.projectPath) {
                action.projectPath = 'unknown-project-path';
            }
        }
        const context = {};
        return {
            action,
            context,
            policy: newPolicy
        };
    }
    calculateDifference(originalDecision, alternateDecision) {
        if (originalDecision === alternateDecision) {
            return "same";
        }
        if (originalDecision === 'ALLOW') {
            if (alternateDecision === 'REVIEW')
                return "stronger";
            if (alternateDecision === 'DENY')
                return "stronger";
        }
        else if (originalDecision === 'REVIEW') {
            if (alternateDecision === 'ALLOW')
                return "weaker";
            if (alternateDecision === 'DENY')
                return "stronger";
        }
        else if (originalDecision === 'DENY') {
            if (alternateDecision === 'ALLOW')
                return "weaker";
            if (alternateDecision === 'REVIEW')
                return "weaker";
        }
        return "contradiction";
    }
    updateAggregateStatistics(summary, difference, actionId) {
        switch (difference) {
            case "weaker":
                summary.weakerCount++;
                summary.weakenedActions.push(actionId);
                break;
            case "stronger":
                summary.strongerCount++;
                summary.strengthenedActions.push(actionId);
                break;
            case "contradiction":
                summary.contradictions++;
                summary.contradictionDetails.push(`Action ${actionId}: Decision changed`);
                break;
            case "same":
                summary.unchanged++;
                break;
        }
    }
    generateNarrativeSummary(result, input) {
        const { summary } = result;
        const totalActions = result.actions.length;
        const weakerPercent = totalActions > 0 ? (summary.weakerCount / totalActions) * 100 : 0;
        const strongerPercent = totalActions > 0 ? (summary.strongerCount / totalActions) * 100 : 0;
        const contradictionPercent = totalActions > 0 ? (summary.contradictions / totalActions) * 100 : 0;
        const unchangedPercent = totalActions > 0 ? (summary.unchanged / totalActions) * 100 : 0;
        let narrative = `Counterfactual Policy Simulation Results for Project: ${input.context.projectId}\n`;
        narrative += `Timeframe: ${input.context.timeframe.start} to ${input.context.timeframe.end}\n\n`;
        narrative += `Total actions analyzed: ${totalActions}\n`;
        narrative += `- Unchanged: ${summary.unchanged} (${unchangedPercent.toFixed(1)}%)\n`;
        narrative += `- Weakened: ${summary.weakerCount} (${weakerPercent.toFixed(1)}%) - alternate policy is more permissive\n`;
        narrative += `- Strengthened: ${summary.strongerCount} (${strongerPercent.toFixed(1)}%) - alternate policy is more restrictive\n`;
        narrative += `- Contradictions: ${summary.contradictions} (${contradictionPercent.toFixed(1)}%) - major policy differences\n\n`;
        if (summary.strongerCount > summary.weakerCount) {
            narrative += "The alternate policy exhibits stronger control mechanisms than the original policy.\n";
        }
        else if (summary.weakerCount > summary.strongerCount) {
            narrative += "The alternate policy is more permissive than the original policy.\n";
        }
        else {
            narrative += "The alternate policy shows balanced changes compared to the original policy.\n";
        }
        if (summary.contradictions > 0) {
            narrative += `Warning: ${summary.contradictions} contradictory decisions detected. This may indicate ` +
                `logical inconsistencies between the original and alternate policies.\n`;
        }
        narrative += "\nOverall Governance Assessment:\n";
        if (summary.contradictions > totalActions * 0.1) {
            narrative += "- HIGH RISK: Policy exhibits significant contradictions that could cause governance uncertainty.\n";
        }
        else if (summary.contradictions > 0) {
            narrative += "- MODERATE RISK: Some contradictions detected; review recommended before adoption.\n";
        }
        else {
            narrative += "- LOW RISK: No contradictions detected in the simulation.\n";
        }
        return narrative;
    }
}
exports.CounterfactualPolicySimulator = CounterfactualPolicySimulator;
//# sourceMappingURL=counterfactual.js.map