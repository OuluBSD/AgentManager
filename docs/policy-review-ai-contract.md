# Policy Review AI Interface Contract

This document defines the contract for the secondary AI system that reviews policy-related decisions in the Nexus Agent Governance system.

## 1. Overview

The Policy Review AI serves as a second layer of intelligence that evaluates potentially risky actions or policy changes proposed by the primary AI agents. This system provides a "second opinion" to ensure appropriate caution when crossing policy boundaries.

## 2. What Triggers a Policy Review?

### 2.1 Action Reviews
A policy review is triggered when an agent attempts an action that falls under one of these categories:

- A command matches a rule with `mode: 'review'` in the policy configuration
- A file write attempt falls outside allowed paths but is within a context that allows review
- A command is classified as "high-risk" based on predefined categories (e.g., system modification, network access, file deletion)
- An action matches a pattern in the "gray area" that requires contextual evaluation

### 2.2 Policy Change Reviews
A policy review is also triggered when:

- A policy file is modified in a way that expands allowed behavior:
  - Adding new allowed commands
  - Adding new allowed write paths
  - Changing a `deny` rule to `allow` or `review`
  - Modifying context conditions to be less restrictive
- A policy change would significantly alter the "policy window"
- An automated system proposes policy updates based on learning

## 3. Inputs to the Review AI

The Policy Review AI receives a structured JSON payload containing all necessary context for making a decision.

### 3.1 Action Review Input
```json
{
  "type": "policy-action-review",
  "requestId": "uuid",
  "timestamp": "ISO-8601 timestamp",
  "action": {
    "kind": "run-command" | "write-file" | "session-operation",
    "command": "the actual command being executed (if applicable)",
    "filePath": "path being written to (if applicable)",
    "sessionId": "session identifier",
    "projectPath": "/path/to/project",
    "context": {
      "projectTags": ["sandbox", "experiment"],
      "projectType": "internal",
      "roadmap": "Feature: User Authentication",
      "currentTask": "Implement login functionality",
      "taskType": "feature-development",
      "sessionType": "development",
      "authorizationLevel": "standard"
    }
  },
  "policy": {
    "currentPolicy": { ... }, // Full current policy object
    "matchingRule": { ... }, // The specific rule that triggered the review
    "modeAtRule": "review"  // The mode at the matching rule (should be 'review')
  },
  "systemDescription": "Nexus orchestrates AI agents over projects, enabling autonomous development tasks while maintaining safety boundaries...",
  "situationDescription": "User requested to clean build artifacts which requires running a potentially destructive command...",
  "agentIntent": "The agent is attempting to clean build artifacts to start a fresh build process...",
  "riskAssessment": {
    "potentialImpact": "medium",
    "safetyConcerns": ["file-deletion", "build-process-interruption"],
    "recoveryPlan": "Build artifacts can be recreated by running build process again"
  }
}
```

### 3.2 Policy Change Review Input
```json
{
  "type": "policy-change-review",
  "requestId": "uuid",
  "timestamp": "ISO-8601 timestamp",
  "change": {
    "kind": "policy-update",
    "description": "Allow rm command in sandbox projects",
    "initiatedBy": "ai-agent" | "human" | "automated-process",
    "initiatorId": "identifier of entity requesting change"
  },
  "existingPolicy": { ... }, // The current policy before changes
  "proposedPolicy": { ... }, // The proposed policy after changes
  "diffSummary": {
    "changedRules": [
      {
        "path": "commands[2]",
        "before": { "pattern": "rm *", "mode": "deny" },
        "after": { "pattern": "rm *", "mode": "review", "contexts": [...] }
      }
    ],
    "newRules": [],
    "removedRules": [],
    "policyWindowChange": "expanded" // or "contracted" or "unchanged"
  },
  "reasoning": "The agent needs to clean build artifacts more efficiently, and this change allows it in sandbox projects while maintaining safety in production contexts",
  "systemDescription": "Nexus orchestrates AI agents over projects, enabling autonomous development tasks while maintaining safety boundaries...",
  "impactAssessment": {
    "scope": "Only affects sandbox projects",
    "riskLevel": "low",
    "affectedCommands": ["rm"],
    "affectedPaths": ["sandbox projects"]
  }
}
```

## 4. Output of the Review AI

The Policy Review AI must respond with a structured decision object that follows this contract:

```ts
interface PolicyReviewDecision {
  /**
   * The final decision on the action or policy change
   */
  decision: 'approve' | 'deny' | 'escalate';

  /**
   * The ID from the original request, for correlation
   */
  requestId: string;

  /**
   * Explanation for the decision
   */
  reason: string;

  /**
   * Optional suggestions for safer alternatives
   */
  suggestions?: string[];

  /**
   * Whether this approval is temporary (only for this action/session)
   */
  temporary?: boolean;

  /**
   * Optional additional metadata about the decision
   */
  metadata?: {
    confidence: 'high' | 'medium' | 'low';
    reviewTimeMs: number;
    reviewer: string; // Identifier of the reviewing AI
  };

  /**
   * For future use - optional constraints for approved actions
   */
  constraints?: {
    timeLimit?: number; // Seconds before re-review needed
    executionLimit?: number; // Max number of times this action can be executed
    monitoringRequired?: boolean; // Whether to monitor this action's effects
  };
}
```

### 4.1 Decision Meanings

- `approve`: The action or policy change is permitted. The primary system may proceed with the operation.
- `deny`: The action or policy change is not permitted. The primary system must reject the operation.
- `escalate`: The decision is too complex or risky for automated review. Human intervention is required.

### 4.2 Example Decision Response
```json
{
  "decision": "approve",
  "requestId": "req-12345",
  "reason": "Command is safe in sandbox environment according to project tags and context. The agent is performing a legitimate cleanup task.",
  "temporary": false,
  "metadata": {
    "confidence": "high",
    "reviewTimeMs": 125,
    "reviewer": "policy-review-ai-v1.2"
  },
  "constraints": {
    "monitoringRequired": true
  }
}
```

## 5. Decision Storage and Logging

### 5.1 Storage Location
Policy review decisions are stored in:
- `~/.nexus/agent-sessions/logs/policy-review-YYYYMMDD.jsonl` (JSON Lines format for audit trail)
- In the session state if directly related to a specific session

### 5.2 Log Format
Each decision is logged as a JSON object with the following structure:
```json
{
  "timestamp": "ISO-8601 timestamp",
  "type": "policy-review-decision",
  "requestId": "req-12345",
  "sessionId": "session-abc",
  "decision": {
    "outcome": "approve" | "deny" | "escalate",
    "reason": "Explanation of decision",
    "reviewer": "policy-review-ai-v1.2"
  },
  "action": {
    "kind": "run-command",
    "command": "rm -rf build/",
    "path": "/path/to/project/build"
  },
  "context": {
    "projectType": "sandbox",
    "task": "Clean build artifacts"
  }
}
```

## 6. Implementation Considerations

### 6.1 Conservative Approach
For the initial implementation (D1), policy review approvals are *not* automatically merged into the long-term policy. Instead:

- Approvals apply only to the specific action or session
- Future tasks can add "policy learning" behavior if needed
- This prevents policy creep from accumulating over time

### 6.2 Fail-Safe Behavior
If the Policy Review AI is unavailable:

- The system follows the original policy rule (which triggered the review)
- An alert is logged to notify of the review system failure
- Optionally, a fallback policy can specify default behavior during outages

### 6.3 Performance Considerations
- AI review requests may take several seconds to process
- Implement request queuing to handle multiple concurrent reviews
- Cache recent decisions for identical requests to avoid redundant AI calls
- Implement timeouts to prevent indefinite blocking

## 7. Error Handling

The Policy Review AI may encounter various error conditions:

- Invalid input format: Respond with an error decision and request reformatting
- Insufficient context: Respond with an escalate decision requesting more information
- Internal errors: Respond with an error status that causes the system to escalate to human review
- Timeout: The primary system should escalate to human review after timeout

This contract ensures consistent communication between the Nexus Agent system and the Policy Review AI, maintaining security while enabling appropriate flexibility for AI agents to operate effectively.