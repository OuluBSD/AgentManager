# Nexus Agent Policy Engine Evaluation Flow

## 1. Introduction

This document specifies the **deterministic, step-by-step evaluation process** for the Nexus Agent Policy Engine. It defines how incoming actions from `nexus-agent-tool` are evaluated against a policy configuration to produce a decision outcome (`ALLOW`, `DENY`, or `REVIEW`).

This specification is complementary to:
- `agent-policy-governance.md` – which describes the philosophy and purpose of the governance system
- `policy-model.schema.md` – which defines the data model for policies and rules
- `policy-review-ai-contract.md` – which specifies the interface for the secondary AI review process

This document focuses on **runtime behavior** for actions including `run-command`, `write-file`, and `start-session`, providing clear algorithms that can be directly implemented.

## 2. Inputs & Outputs of the Policy Engine

### 2.1 Evaluation Input

The policy engine receives the following input structure:

```ts
interface PolicyEvaluationInput {
  action: {
    kind: 'run-command' | 'write-file' | 'start-session';
    sessionId: string;
    projectPath: string;

    // For run-command
    command?: string;

    // For write-file
    relPath?: string;  // Relative path from project root
    writeMode?: 'create' | 'overwrite' | 'append';

    // For start-session
    requestedProjectPath?: string;
  };

  policy: AgentPolicy; // As defined in policy-model.schema.md

  context: {
    projectTags?: string[];
    projectType?: string;
    roadmapName?: string;
    taskName?: string;
    taskType?: string;
    sessionType?: string;
    directory?: string;  // Current working directory relative to project root
    authorizationLevel?: string;
    // Any other relevant metadata used by contexts[]
  };
}
```

### 2.2 Evaluation Output

The policy engine returns the following result:

```ts
type PolicyDecisionOutcome = 'ALLOW' | 'DENY' | 'REVIEW';

interface PolicyEvaluationResult {
  outcome: PolicyDecisionOutcome;
  reason: string; // Machine-readable tag explaining the decision
  details?: any;  // Additional information about the decision process
}
```

**Outcome Meanings:**
- `ALLOW` → Action may proceed without further review
- `DENY` → Action must not be executed; caller should return an error
- `REVIEW` → Action requires policy review as specified in `policy-review-ai-contract.md`

## 3. Rule Matching & Priority Model

### 3.1 Matching Order

The policy engine evaluates rules using the following deterministic order:

1. **Action Type Filtering**: Filter rules based on the action type
   - For `run-command`, use `policy.commands[]`
   - For `write-file`, use `policy.fileWrites[]`
   
2. **Pattern Matching**: Find all rules whose pattern matches the action
   - Use Unix-style glob matching for pattern comparison
   - For commands: match against the full command string
   - For files: match against the relative file path
   
3. **Rule Prioritization**: Among matching rules, select based on pattern specificity:
   - More specific patterns take precedence over general ones
   - Specificity is determined by pattern length (longer is more specific)
   - If patterns have equal length, later rules in the array take precedence
   - In cases of exact pattern matches, the exact match takes precedence over wildcard patterns

4. **Context Evaluation**: Apply context conditions to the selected rule
   - If multiple contexts match, select the one that appears last in the `contexts` array
   - If no context matches, use the rule's base mode

5. **Default Behavior**: If no rule matches, use the appropriate default:
   - For `run-command` → `policy.defaultCommandBehavior`
   - For `write-file` → `policy.defaultWriteBehavior`

### 3.2 Context Override Resolution

Context conditions use AND logic (all specified conditions must be satisfied) and are evaluated in order. For each context condition:

1. Check if all `when` conditions match the input `context`
2. If multiple contexts match, use the last matching context in the array
3. Apply the context's `overrideMode` to determine the effective mode

### 3.3 Fallback Behavior

If no specific rule matches the action, the policy engine uses the appropriate default behavior:
- For `run-command` → `policy.defaultCommandBehavior`
- For `write-file` → `policy.defaultWriteBehavior`

## 4. Evaluation Algorithms per Action Type

### 4.1 `run-command` Evaluation

The algorithm for evaluating a `run-command` action:

```ts
function evaluateRunCommand(input: PolicyEvaluationInput): PolicyEvaluationResult {
  const cmd = input.action.command || '';
  const policy = input.policy;
  const context = input.context;

  // Step 1: Find all matching command rules
  const matchingRules = findMatchingCommandRules(policy.commands, cmd);

  // Step 2: If no rules match, return default behavior
  if (matchingRules.length === 0) {
    return {
      outcome: toOutcome(policy.defaultCommandBehavior),
      reason: 'NO_MATCH_DEFAULT_COMMAND_BEHAVIOR',
      details: {
        defaultValue: policy.defaultCommandBehavior
      }
    };
  }

  // Step 3: Select the best matching rule based on specificity
  const bestRule = selectBestRule(matchingRules, cmd);

  // Step 4: Apply contextual overrides if any match
  const effectiveMode = applyContextOverrides(bestRule, context);

  // Step 5: Return the result
  return {
    outcome: toOutcome(effectiveMode),
    reason: 'COMMAND_RULE_APPLIED',
    details: { 
      rule: bestRule, 
      effectiveMode,
      matchedCommand: cmd
    }
  };
}

// Helper function to find matching command rules
function findMatchingCommandRules(rules: CommandPolicyRule[], command: string): CommandPolicyRule[] {
  return rules.filter(rule => {
    // Convert pattern to regex for matching
    const regexPattern = patternToRegex(rule.pattern);
    return new RegExp(regexPattern, 'i').test(command);
  });
}

// Helper function to select the best rule based on specificity
function selectBestRule(rules: CommandPolicyRule[], command: string): CommandPolicyRule {
  // Sort by pattern specificity (length) and array position
  return rules.sort((a, b) => {
    // More specific (longer) patterns take precedence
    if (b.pattern.length !== a.pattern.length) {
      return b.pattern.length - a.pattern.length;
    }
    // If equal length, later rules in array take precedence
    return 0; // Maintain original order if length is equal
  })[0];
}

// Helper to convert glob pattern to regex
function patternToRegex(pattern: string): string {
  // Convert glob patterns to regex
  // Example: 'git *' becomes '^git .*'
  return pattern
    .replace(/\./g, '\\.')  // Escape literal dots
    .replace(/\*/g, '.*')   // Convert * to .*
    .replace(/\?/g, '.')    // Convert ? to .
    .replace(/\{([^}]+)\}/g, (match, p1) => `(${p1.replace(/,/g, '|')})`); // Convert {a,b} to (a|b)
}
```

### 4.2 `write-file` Evaluation

The algorithm for evaluating a `write-file` action:

```ts
function evaluateWriteFile(input: PolicyEvaluationInput): PolicyEvaluationResult {
  const relPath = input.action.relPath || '';
  const policy = input.policy;
  const context = input.context;

  // Step 1: Find all matching file write rules
  const matchingRules = findMatchingFileWriteRules(policy.fileWrites, relPath);

  // Step 2: If no rules match, return default behavior
  if (matchingRules.length === 0) {
    return {
      outcome: toOutcome(policy.defaultWriteBehavior),
      reason: 'NO_MATCH_DEFAULT_WRITE_BEHAVIOR',
      details: {
        defaultValue: policy.defaultWriteBehavior
      }
    };
  }

  // Step 3: Select the best matching rule based on specificity
  const bestRule = selectBestFileRule(matchingRules, relPath);

  // Step 4: Apply contextual overrides if any match
  const effectiveMode = applyContextOverrides(bestRule, context);

  // Step 5: Return the result
  return {
    outcome: toOutcome(effectiveMode),
    reason: 'FILE_WRITE_RULE_APPLIED',
    details: { 
      rule: bestRule, 
      effectiveMode,
      matchedPath: relPath
    }
  };
}

// Helper function to find matching file write rules
function findMatchingFileWriteRules(rules: FileWritePolicyRule[], path: string): FileWritePolicyRule[] {
  return rules.filter(rule => {
    // Convert pattern to regex for matching
    const regexPattern = patternToRegex(rule.pattern);
    return new RegExp(regexPattern, 'i').test(path);
  });
}

// Helper function to select the best file rule based on specificity
function selectBestFileRule(rules: FileWritePolicyRule[], path: string): FileWritePolicyRule {
  // Sort by pattern specificity (length) with more specific patterns taking precedence
  return rules.sort((a, b) => {
    // More specific (longer) patterns take precedence
    if (b.pattern.length !== a.pattern.length) {
      return b.pattern.length - a.pattern.length;
    }
    // If equal length, later rules in array take precedence
    return 0; // Maintain original order if length is equal
  })[0];
}
```

### 4.3 `start-session` Evaluation

The algorithm for evaluating a `start-session` action:

```ts
function evaluateStartSession(input: PolicyEvaluationInput): PolicyEvaluationResult {
  const requestedPath = input.action.requestedProjectPath || input.action.projectPath;
  const policy = input.policy;
  const context = input.context;

  // For session creation, we evaluate the project path against session rules
  // If session rules are not defined, default to allow with review for safety
  if (!policy.sessions) {
    return {
      outcome: toOutcome(policy.defaultCommandBehavior), // Use command behavior as default for sessions
      reason: 'SESSION_EVALUATION_FALLBACK',
      details: {
        defaultValue: policy.defaultCommandBehavior,
        evaluatedPath: requestedPath
      }
    };
  }

  // Find matching session rules
  const matchingRules = findMatchingSessionRules(policy.sessions, requestedPath);

  if (matchingRules.length === 0) {
    return {
      outcome: toOutcome(policy.defaultCommandBehavior), // Use command behavior as default
      reason: 'NO_MATCH_SESSION_DEFAULT',
      details: {
        defaultValue: policy.defaultCommandBehavior
      }
    };
  }

  // Select best matching rule
  const bestRule = selectBestSessionRule(matchingRules, requestedPath);
  
  // Apply contextual overrides
  const effectiveMode = applyContextOverrides(bestRule, context);

  return {
    outcome: toOutcome(effectiveMode),
    reason: 'SESSION_RULE_APPLIED',
    details: { 
      rule: bestRule, 
      effectiveMode,
      evaluatedPath: requestedPath
    }
  };
}

// Helper function to find matching session rules
function findMatchingSessionRules(rules: SessionPolicyRule[], path: string): SessionPolicyRule[] {
  return rules.filter(rule => {
    // Convert pattern to regex for matching
    const regexPattern = patternToRegex(rule.pattern);
    return new RegExp(regexPattern, 'i').test(path);
  });
}

// Helper function to select the best session rule based on specificity
function selectBestSessionRule(rules: SessionPolicyRule[], path: string): SessionPolicyRule {
  return rules.sort((a, b) => {
    // More specific (longer) patterns take precedence
    if (b.pattern.length !== a.pattern.length) {
      return b.pattern.length - a.pattern.length;
    }
    // If equal length, later rules in array take precedence
    return 0;
  })[0];
}
```

## 5. Contextual Overrides (Two-Edged Semantics)

Contextual overrides implement the "two-edged" policy concept, allowing rules to be conditionally modified based on execution context.

### 5.1 Context Evaluation Algorithm

```ts
function applyContextOverrides(rule: CommandPolicyRule | FileWritePolicyRule | SessionPolicyRule, 
                               context: any): 'allow' | 'deny' | 'review' {
  
  // If rule has no contexts, return the base mode
  if (!rule.contexts || rule.contexts.length === 0) {
    return rule.mode;
  }

  // Find matching contexts
  const matchingContexts = rule.contexts.filter(ctx => {
    const conditions = ctx.when;
    for (const [key, value] of Object.entries(conditions)) {
      if (key === 'timeRestriction') {
        if (!matchesTimeRestriction(value, new Date())) {
          return false;
        }
      } else {
        if (!matchesCondition(context[key], value)) {
          return false;
        }
      }
    }
    return true;
  });

  // If no contexts match, use the base rule mode
  if (matchingContexts.length === 0) {
    return rule.mode;
  }

  // If multiple contexts match, use the last matching context (highest precedence)
  const effectiveContext = matchingContexts[matchingContexts.length - 1];
  
  return effectiveContext.overrideMode;
}

// Helper to check if a condition matches
function matchesCondition(contextValue: any, ruleValue: any): boolean {
  if (Array.isArray(ruleValue)) {
    // If rule value is an array, context value should match any of the array values
    return Array.isArray(contextValue) 
      ? contextValue.some(cv => ruleValue.includes(cv))
      : ruleValue.includes(contextValue);
  } else {
    // Direct comparison
    return contextValue === ruleValue;
  }
}

// Helper to check time restrictions
function matchesTimeRestriction(restriction: any, date: Date): boolean {
  if (!restriction) return true;
  
  if (restriction.days) {
    const days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
    const dayName = days[date.getDay()].toLowerCase();
    if (!restriction.days.map((d: string) => d.toLowerCase()).includes(dayName)) {
      return false;
    }
  }
  
  if (restriction.hours) {
    const [startHour, endHour] = restriction.hours;
    const currentHour = date.getHours();
    if (currentHour < startHour || currentHour >= endHour) {
      return false;
    }
  }
  
  return true;
}
```

### 5.2 Contextual Override Examples

Contextual overrides allow:
- A command that is normally `deny` to be `review` in specific contexts (e.g., sandbox projects)
- A command that is normally `allow` to be `review` or `deny` in certain contexts (e.g., production environments)
- File operations to be permitted in specific directories based on project type or task

## 6. Outcome Mapping Function

A helper function to convert policy modes to outcomes:

```ts
function toOutcome(mode: 'allow' | 'deny' | 'review'): PolicyDecisionOutcome {
  switch (mode) {
    case 'allow':
      return 'ALLOW';
    case 'deny':
      return 'DENY';
    case 'review':
      return 'REVIEW';
    default:
      throw new Error(`Invalid policy mode: ${mode}`);
  }
}
```

## 7. REVIEW Outcome Handling (High-Level Hook)

When the policy engine returns `outcome: 'REVIEW'`, the higher-level `nexus-agent-tool`:

1. Does not execute the requested action immediately
2. Assembles a payload for the policy review AI according to `policy-review-ai-contract.md`
3. Calls the secondary AI for review
4. Based on the AI's response, either:
   - Allows the action (if review AI approves)
   - Denies the action (if review AI denies)
   - Escalates to human review (if review AI escalates)

This document defines only the policy engine's decision-making process up to the point where a `REVIEW` outcome is determined. The actual communication with the policy review AI is handled at a different layer.

## 8. Example Walkthroughs

### Example 1: Safe Command with Explicit Allow Rule

**Policy Snippet:**
```json
{
  "commands": [
    {
      "pattern": "cat *",
      "mode": "allow",
      "description": "Allow viewing files"
    }
  ],
  "defaultCommandBehavior": "review"
}
```

**Input:**
```json
{
  "action": {
    "kind": "run-command",
    "command": "cat package.json"
  },
  "context": {
    "projectType": "sandbox"
  }
}
```

**Evaluation:**
1. Find matching command rules: `cat *` matches `cat package.json`
2. No contexts to evaluate
3. Effective mode: `allow`
4. Outcome: `ALLOW`
5. Reason: `COMMAND_RULE_APPLIED`

### Example 2: Dangerous Command with Context Override

**Policy Snippet:**
```json
{
  "commands": [
    {
      "pattern": "rm *",
      "mode": "deny",
      "contexts": [
        {
          "when": {
            "projectType": "sandbox"
          },
          "overrideMode": "review"
        }
      ]
    }
  ],
  "defaultCommandBehavior": "review"
}
```

**Input:**
```json
{
  "action": {
    "kind": "run-command",
    "command": "rm -rf build/"
  },
  "context": {
    "projectType": "sandbox"
  }
}
```

**Evaluation:**
1. Find matching command rules: `rm *` matches `rm -rf build/`
2. Context evaluation: `projectType: sandbox` matches the context condition
3. Effective mode: `review` (due to context override)
4. Outcome: `REVIEW`
5. Reason: `COMMAND_RULE_APPLIED`

### Example 3: File Write in Allowed Directory

**Policy Snippet:**
```json
{
  "fileWrites": [
    {
      "pattern": "src/**/*",
      "mode": "allow",
      "description": "Allow writing to source code directories"
    }
  ],
  "defaultWriteBehavior": "review"
}
```

**Input:**
```json
{
  "action": {
    "kind": "write-file",
    "relPath": "src/main.ts"
  },
  "context": {}
}
```

**Evaluation:**
1. Find matching file write rules: `src/**/*` matches `src/main.ts`
2. No contexts to evaluate
3. Effective mode: `allow`
4. Outcome: `ALLOW`
5. Reason: `FILE_WRITE_RULE_APPLIED`

### Example 4: File Write Outside Allowed Paths

**Policy Snippet:**
```json
{
  "fileWrites": [
    {
      "pattern": "/etc/**/*",
      "mode": "deny",
      "description": "Never allow writes to system directories"
    }
  ],
  "defaultWriteBehavior": "review"
}
```

**Input:**
```json
{
  "action": {
    "kind": "write-file",
    "relPath": "/etc/config.txt"
  },
  "context": {}
}
```

**Evaluation:**
1. Find matching file write rules: `/etc/**/*` matches `/etc/config.txt`
2. No contexts to evaluate
3. Effective mode: `deny`
4. Outcome: `DENY`
5. Reason: `FILE_WRITE_RULE_APPLIED`

### Example 5: Command with No Specific Rule, Default Review

**Policy Snippet:**
```json
{
  "commands": [
    {
      "pattern": "ls *",
      "mode": "allow",
      "description": "Allow listing directories"
    }
  ],
  "defaultCommandBehavior": "review"
}
```

**Input:**
```json
{
  "action": {
    "kind": "run-command",
    "command": "node script.js"
  },
  "context": {}
}
```

**Evaluation:**
1. Find matching command rules: No rules match `node script.js`
2. Use default behavior: `defaultCommandBehavior: "review"`
3. Outcome: `REVIEW`
4. Reason: `NO_MATCH_DEFAULT_COMMAND_BEHAVIOR`