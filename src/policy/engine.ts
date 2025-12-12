import { v4 as uuidv4 } from 'uuid';
import { PolicyEvaluationInput, PolicyEvaluationResult, PolicyTrace } from './trace';

// Helper function to convert policy modes to outcomes
function toOutcome(mode: 'allow' | 'deny' | 'review'): 'ALLOW' | 'DENY' | 'REVIEW' {
  switch (mode) {
    case 'allow': return 'ALLOW';
    case 'deny': return 'DENY';
    case 'review': return 'REVIEW';
    default:
      throw new Error(`Invalid policy mode: ${mode}`);
  }
}

// Helper function to create a policy trace
export function createPolicyTrace(
  input: PolicyEvaluationInput,
  matchingRules: any[],
  finalDecision: 'ALLOW' | 'DENY' | 'REVIEW',
  finalRule?: any
): PolicyTrace {
  const actionId = `act-${uuidv4()}`;
  const timestamp = new Date().toISOString();

  // Create evaluated rules trace
  const evaluatedRules = input.policy[input.action.type === 'run-command' ? 'commands' : 
                                 input.action.type === 'write-file' ? 'fileWrites' : 
                                 'sessions']?.map((rule: any) => {
    const matchingRule = matchingRules.find((r: any) => r.id === rule.id);
    
    return {
      ruleId: rule.id,
      matched: !!matchingRule,
      matchReason: matchingRule ? matchingRule.matchReason : undefined,
      priority: rule.priority || 0,
      effect: rule.mode || 'allow'
    };
  }) || [];

  // Determine if override context was triggered
  let overrideContext;
  if (input.context && input.context.overrides) {
    const triggeredOverrides = input.context.overrides.filter((override: any) => {
      // Simple condition check - this would be more complex in a real implementation
      return override.condition && matchCondition(override.condition, input);
    });

    if (triggeredOverrides.length > 0) {
      overrideContext = {
        triggered: true,
        overrideRuleIds: triggeredOverrides.map((o: any) => o.ruleId),
        reason: `Overrides triggered for rules: ${triggeredOverrides.map((o: any) => o.ruleId).join(', ')}`
      };
    }
  }

  // Create AI and human summaries
  let summaryForAI: string;
  let summaryForHuman: string;

  if (finalDecision === 'ALLOW') {
    summaryForAI = `Action allowed based on policy evaluation`;
    summaryForHuman = `Action was allowed. ${finalRule ? `Rule ${finalRule.id} with mode ${finalRule.mode} was applied.` : 'Default allow behavior was applied.'}`;
  } else if (finalDecision === 'DENY') {
    summaryForAI = `Action denied based on policy evaluation`;
    summaryForHuman = `Action was denied. ${finalRule ? `Rule ${finalRule.id} with mode ${finalRule.mode} was applied.` : 'Default deny behavior was applied.'}`;
  } else { // REVIEW
    summaryForAI = `Action requires review based on policy evaluation`;
    summaryForHuman = `Action requires policy review. ${finalRule ? `Rule ${finalRule.id} with mode ${finalRule.mode} required review.` : 'Default review behavior was applied.'}`;
  }

  return {
    actionId,
    actionType: input.action.type,
    timestamp,
    evaluatedRules,
    overrideContext,
    finalDecision: finalDecision.toLowerCase() as "allow" | "deny" | "review",
    finalRuleId: finalRule?.id,
    summaryForAI,
    summaryForHuman
  };
}

// Helper function to match conditions
function matchCondition(condition: any, input: PolicyEvaluationInput): boolean {
  // Simple condition matching - in a real implementation this would be more complex
  // For now, just return true as a placeholder
  return true;
}

// Main function to find matching command rules
function findMatchingCommandRules(rules: any[], command: string): any[] {
  if (!rules || !Array.isArray(rules)) return [];
  
  return rules.filter((rule: any) => {
    if (rule.pattern) {
      // If pattern is a regex string, convert and test
      if (rule.pattern.startsWith('/') && rule.pattern.endsWith('/')) {
        const regexPattern = rule.pattern.slice(1, -1); // Remove leading/trailing slashes
        const regex = new RegExp(regexPattern);
        return regex.test(command);
      } 
      // If pattern is a simple string, do a partial match
      else {
        return command.includes(rule.pattern);
      }
    }
    // If no pattern is specified, rule applies to all commands
    return true;
  }).map((rule: any) => ({
    ...rule,
    matchReason: `Command '${command}' matches rule pattern '${rule.pattern || 'default'}'`
  }));
}

// Function to find matching file write rules
function findMatchingFileWriteRules(rules: any[], path: string): any[] {
  if (!rules || !Array.isArray(rules)) return [];
  
  return rules.filter((rule: any) => {
    if (rule.pathPattern) {
      // If pathPattern is a regex string, convert and test
      if (rule.pathPattern.startsWith('/') && rule.pathPattern.endsWith('/')) {
        const regexPattern = rule.pathPattern.slice(1, -1);
        const regex = new RegExp(regexPattern);
        return regex.test(path);
      } 
      // If pathPattern is a simple string, do a partial match
      else {
        return path.includes(rule.pathPattern);
      }
    }
    // If no pathPattern is specified, rule applies to all paths
    return true;
  }).map((rule: any) => ({
    ...rule,
    matchReason: `Path '${path}' matches rule pattern '${rule.pathPattern || 'default'}'`
  }));
}

// Function to find matching session rules
function findMatchingSessionRules(rules: any[], path: string): any[] {
  if (!rules || !Array.isArray(rules)) return [];
  
  return rules.filter((rule: any) => {
    if (rule.pathPattern) {
      // If pathPattern is a regex string, convert and test
      if (rule.pathPattern.startsWith('/') && rule.pathPattern.endsWith('/')) {
        const regexPattern = rule.pathPattern.slice(1, -1);
        const regex = new RegExp(regexPattern);
        return regex.test(path);
      } 
      // If pathPattern is a simple string, do a partial match
      else {
        return path.includes(rule.pathPattern);
      }
    }
    // If no pathPattern is specified, rule applies to all paths
    return true;
  }).map((rule: any) => ({
    ...rule,
    matchReason: `Path '${path}' matches rule pattern '${rule.pathPattern || 'default'}'`
  }));
}

// Function to select the best rule based on priority
function selectBestRule(rules: any[]): any {
  if (!rules || rules.length === 0) return null;
  
  // Sort rules by priority (higher number = higher priority)
  return [...rules].sort((a, b) => (b.priority || 0) - (a.priority || 0))[0];
}

// Main policy evaluation functions

export function evaluateRunCommand(input: PolicyEvaluationInput): PolicyEvaluationResult {
  const policy = input.policy;
  const command = input.action.command || '';
  
  // Find matching rules
  const matchingRules = findMatchingCommandRules(policy.commands || [], command);
  
  // Select the best rule
  let bestRule = selectBestRule(matchingRules);
  
  // Apply contextual overrides
  if (input.context && input.context.overrides) {
    for (const override of input.context.overrides) {
      if (override.appliesTo && override.appliesTo.includes('run-command')) {
        if (bestRule && bestRule.id === override.ruleId) {
          // Apply the override to the rule
          bestRule = { ...bestRule, mode: override.overrideMode };
        }
      }
    }
  }
  
  // Determine outcome based on best rule or default
  let outcome: 'ALLOW' | 'DENY' | 'REVIEW';
  let reason: string;
  
  if (bestRule) {
    outcome = toOutcome(bestRule.mode);
    reason = `Rule ${bestRule.id} with mode ${bestRule.mode} applied`;
  } else {
    // Use default behavior if no rule matches
    const defaultMode = policy.defaultCommandBehavior || 'allow';
    outcome = toOutcome(defaultMode);
    reason = `No matching rule found, using default command behavior: ${defaultMode}`;
  }
  
  // Create policy trace
  const policyTrace = createPolicyTrace(input, matchingRules, outcome, bestRule);
  
  return {
    outcome,
    reason,
    policyTrace
  };
}

export function evaluateWriteFile(input: PolicyEvaluationInput): PolicyEvaluationResult {
  const policy = input.policy;
  const path = input.action.path || '';
  
  // Find matching rules
  const matchingRules = findMatchingFileWriteRules(policy.fileWrites || [], path);
  
  // Select the best rule
  let bestRule = selectBestRule(matchingRules);
  
  // Apply contextual overrides
  if (input.context && input.context.overrides) {
    for (const override of input.context.overrides) {
      if (override.appliesTo && override.appliesTo.includes('write-file')) {
        if (bestRule && bestRule.id === override.ruleId) {
          // Apply the override to the rule
          bestRule = { ...bestRule, mode: override.overrideMode };
        }
      }
    }
  }
  
  // Determine outcome based on best rule or default
  let outcome: 'ALLOW' | 'DENY' | 'REVIEW';
  let reason: string;
  
  if (bestRule) {
    outcome = toOutcome(bestRule.mode);
    reason = `Rule ${bestRule.id} with mode ${bestRule.mode} applied`;
  } else {
    // Use default behavior if no rule matches
    const defaultMode = policy.defaultWriteBehavior || 'allow';
    outcome = toOutcome(defaultMode);
    reason = `No matching rule found, using default write behavior: ${defaultMode}`;
  }
  
  // Create policy trace
  const policyTrace = createPolicyTrace(input, matchingRules, outcome, bestRule);
  
  return {
    outcome,
    reason,
    policyTrace
  };
}

export function evaluateStartSession(input: PolicyEvaluationInput): PolicyEvaluationResult {
  const policy = input.policy;
  const requestedPath = input.action.projectPath || '';
  
  // Check if sessions policy exists
  if (!policy.sessions) {
    // If no session-specific policy, use default command behavior
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
  
  // Find matching rules
  const matchingRules = findMatchingSessionRules(policy.sessions, requestedPath);
  
  // Select the best rule
  let bestRule = selectBestRule(matchingRules);
  
  // Apply contextual overrides
  if (input.context && input.context.overrides) {
    for (const override of input.context.overrides) {
      if (override.appliesTo && override.appliesTo.includes('start-session')) {
        if (bestRule && bestRule.id === override.ruleId) {
          // Apply the override to the rule
          bestRule = { ...bestRule, mode: override.overrideMode };
        }
      }
    }
  }
  
  // Determine outcome based on best rule or default
  let outcome: 'ALLOW' | 'DENY' | 'REVIEW';
  let reason: string;
  
  if (bestRule) {
    outcome = toOutcome(bestRule.mode);
    reason = `Rule ${bestRule.id} with mode ${bestRule.mode} applied`;
  } else {
    // Use default behavior if no rule matches
    const defaultMode = policy.defaultCommandBehavior || 'allow';
    outcome = toOutcome(defaultMode);
    reason = `No matching rule found, using default command behavior: ${defaultMode}`;
  }
  
  // Create policy trace
  const policyTrace = createPolicyTrace(input, matchingRules, outcome, bestRule);
  
  return {
    outcome,
    reason,
    policyTrace
  };
}

// Main evaluation function
export function evaluatePolicy(input: PolicyEvaluationInput): PolicyEvaluationResult {
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

