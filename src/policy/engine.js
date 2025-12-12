"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createPolicyTrace = createPolicyTrace;
exports.evaluateRunCommand = evaluateRunCommand;
exports.evaluateWriteFile = evaluateWriteFile;
exports.evaluateStartSession = evaluateStartSession;
exports.evaluatePolicy = evaluatePolicy;
const uuid_1 = require("uuid");
function toOutcome(mode) {
    switch (mode) {
        case 'allow': return 'ALLOW';
        case 'deny': return 'DENY';
        case 'review': return 'REVIEW';
        default:
            throw new Error(`Invalid policy mode: ${mode}`);
    }
}
function createPolicyTrace(input, matchingRules, finalDecision, finalRule) {
    const actionId = `act-${(0, uuid_1.v4)()}`;
    const timestamp = new Date().toISOString();
    const evaluatedRules = input.policy[input.action.type === 'run-command' ? 'commands' :
        input.action.type === 'write-file' ? 'fileWrites' :
            'sessions']?.map((rule) => {
        const matchingRule = matchingRules.find((r) => r.id === rule.id);
        return {
            ruleId: rule.id,
            matched: !!matchingRule,
            matchReason: matchingRule ? matchingRule.matchReason : undefined,
            priority: rule.priority || 0,
            effect: rule.mode || 'allow'
        };
    }) || [];
    let overrideContext;
    if (input.context && input.context.overrides) {
        const triggeredOverrides = input.context.overrides.filter((override) => {
            return override.condition && matchCondition(override.condition, input);
        });
        if (triggeredOverrides.length > 0) {
            overrideContext = {
                triggered: true,
                overrideRuleIds: triggeredOverrides.map((o) => o.ruleId),
                reason: `Overrides triggered for rules: ${triggeredOverrides.map((o) => o.ruleId).join(', ')}`
            };
        }
    }
    let summaryForAI;
    let summaryForHuman;
    if (finalDecision === 'ALLOW') {
        summaryForAI = `Action allowed based on policy evaluation`;
        summaryForHuman = `Action was allowed. ${finalRule ? `Rule ${finalRule.id} with mode ${finalRule.mode} was applied.` : 'Default allow behavior was applied.'}`;
    }
    else if (finalDecision === 'DENY') {
        summaryForAI = `Action denied based on policy evaluation`;
        summaryForHuman = `Action was denied. ${finalRule ? `Rule ${finalRule.id} with mode ${finalRule.mode} was applied.` : 'Default deny behavior was applied.'}`;
    }
    else {
        summaryForAI = `Action requires review based on policy evaluation`;
        summaryForHuman = `Action requires policy review. ${finalRule ? `Rule ${finalRule.id} with mode ${finalRule.mode} required review.` : 'Default review behavior was applied.'}`;
    }
    return {
        actionId,
        actionType: input.action.type,
        timestamp,
        evaluatedRules,
        overrideContext,
        finalDecision: finalDecision.toLowerCase(),
        finalRuleId: finalRule?.id,
        summaryForAI,
        summaryForHuman
    };
}
function matchCondition(condition, input) {
    return true;
}
function findMatchingCommandRules(rules, command) {
    if (!rules || !Array.isArray(rules))
        return [];
    return rules.filter((rule) => {
        if (rule.pattern) {
            if (rule.pattern.startsWith('/') && rule.pattern.endsWith('/')) {
                const regexPattern = rule.pattern.slice(1, -1);
                const regex = new RegExp(regexPattern);
                return regex.test(command);
            }
            else {
                return command.includes(rule.pattern);
            }
        }
        return true;
    }).map((rule) => ({
        ...rule,
        matchReason: `Command '${command}' matches rule pattern '${rule.pattern || 'default'}'`
    }));
}
function findMatchingFileWriteRules(rules, path) {
    if (!rules || !Array.isArray(rules))
        return [];
    return rules.filter((rule) => {
        if (rule.pathPattern) {
            if (rule.pathPattern.startsWith('/') && rule.pathPattern.endsWith('/')) {
                const regexPattern = rule.pathPattern.slice(1, -1);
                const regex = new RegExp(regexPattern);
                return regex.test(path);
            }
            else {
                return path.includes(rule.pathPattern);
            }
        }
        return true;
    }).map((rule) => ({
        ...rule,
        matchReason: `Path '${path}' matches rule pattern '${rule.pathPattern || 'default'}'`
    }));
}
function findMatchingSessionRules(rules, path) {
    if (!rules || !Array.isArray(rules))
        return [];
    return rules.filter((rule) => {
        if (rule.pathPattern) {
            if (rule.pathPattern.startsWith('/') && rule.pathPattern.endsWith('/')) {
                const regexPattern = rule.pathPattern.slice(1, -1);
                const regex = new RegExp(regexPattern);
                return regex.test(path);
            }
            else {
                return path.includes(rule.pathPattern);
            }
        }
        return true;
    }).map((rule) => ({
        ...rule,
        matchReason: `Path '${path}' matches rule pattern '${rule.pathPattern || 'default'}'`
    }));
}
function selectBestRule(rules) {
    if (!rules || rules.length === 0)
        return null;
    return [...rules].sort((a, b) => (b.priority || 0) - (a.priority || 0))[0];
}
function evaluateRunCommand(input) {
    const policy = input.policy;
    const command = input.action.command || '';
    const matchingRules = findMatchingCommandRules(policy.commands || [], command);
    let bestRule = selectBestRule(matchingRules);
    if (input.context && input.context.overrides) {
        for (const override of input.context.overrides) {
            if (override.appliesTo && override.appliesTo.includes('run-command')) {
                if (bestRule && bestRule.id === override.ruleId) {
                    bestRule = { ...bestRule, mode: override.overrideMode };
                }
            }
        }
    }
    let outcome;
    let reason;
    if (bestRule) {
        outcome = toOutcome(bestRule.mode);
        reason = `Rule ${bestRule.id} with mode ${bestRule.mode} applied`;
    }
    else {
        const defaultMode = policy.defaultCommandBehavior || 'allow';
        outcome = toOutcome(defaultMode);
        reason = `No matching rule found, using default command behavior: ${defaultMode}`;
    }
    const policyTrace = createPolicyTrace(input, matchingRules, outcome, bestRule);
    return {
        outcome,
        reason,
        policyTrace
    };
}
function evaluateWriteFile(input) {
    const policy = input.policy;
    const path = input.action.path || '';
    const matchingRules = findMatchingFileWriteRules(policy.fileWrites || [], path);
    let bestRule = selectBestRule(matchingRules);
    if (input.context && input.context.overrides) {
        for (const override of input.context.overrides) {
            if (override.appliesTo && override.appliesTo.includes('write-file')) {
                if (bestRule && bestRule.id === override.ruleId) {
                    bestRule = { ...bestRule, mode: override.overrideMode };
                }
            }
        }
    }
    let outcome;
    let reason;
    if (bestRule) {
        outcome = toOutcome(bestRule.mode);
        reason = `Rule ${bestRule.id} with mode ${bestRule.mode} applied`;
    }
    else {
        const defaultMode = policy.defaultWriteBehavior || 'allow';
        outcome = toOutcome(defaultMode);
        reason = `No matching rule found, using default write behavior: ${defaultMode}`;
    }
    const policyTrace = createPolicyTrace(input, matchingRules, outcome, bestRule);
    return {
        outcome,
        reason,
        policyTrace
    };
}
function evaluateStartSession(input) {
    const policy = input.policy;
    const requestedPath = input.action.projectPath || '';
    if (!policy.sessions) {
        const defaultMode = policy.defaultCommandBehavior || 'allow';
        const outcome = toOutcome(defaultMode);
        const reason = `No session policy found, using default command behavior: ${defaultMode}`;
        const policyTrace = createPolicyTrace(input, [], outcome);
        return {
            outcome,
            reason,
            policyTrace
        };
    }
    const matchingRules = findMatchingSessionRules(policy.sessions, requestedPath);
    let bestRule = selectBestRule(matchingRules);
    if (input.context && input.context.overrides) {
        for (const override of input.context.overrides) {
            if (override.appliesTo && override.appliesTo.includes('start-session')) {
                if (bestRule && bestRule.id === override.ruleId) {
                    bestRule = { ...bestRule, mode: override.overrideMode };
                }
            }
        }
    }
    let outcome;
    let reason;
    if (bestRule) {
        outcome = toOutcome(bestRule.mode);
        reason = `Rule ${bestRule.id} with mode ${bestRule.mode} applied`;
    }
    else {
        const defaultMode = policy.defaultCommandBehavior || 'allow';
        outcome = toOutcome(defaultMode);
        reason = `No matching rule found, using default command behavior: ${defaultMode}`;
    }
    const policyTrace = createPolicyTrace(input, matchingRules, outcome, bestRule);
    return {
        outcome,
        reason,
        policyTrace
    };
}
function evaluatePolicy(input) {
    switch (input.action.type) {
        case 'run-command':
            return evaluateRunCommand(input);
        case 'write-file':
            return evaluateWriteFile(input);
        case 'start':
            return evaluateStartSession(input);
        default:
            throw new Error(`Unknown action type: ${input.action.type}`);
    }
}
//# sourceMappingURL=engine.js.map