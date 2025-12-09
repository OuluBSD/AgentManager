# Nexus Agent Policy Model Schema

## 1. Core Policy Object

The `AgentPolicy` object defines the complete policy configuration for a Nexus agent session.

```ts
interface AgentPolicy {
  /**
   * Version of the policy schema being used
   */
  version: string;

  /**
   * Human-readable description of the policy
   */
  description?: string;

  /**
   * Default behavior for command execution when no specific rule matches
   * @default 'review'
   */
  defaultCommandBehavior: 'allow' | 'deny' | 'review';

  /**
   * Default behavior for file write operations when no specific rule matches
   * @default 'review'
   */
  defaultWriteBehavior: 'allow' | 'deny' | 'review';

  /**
   * Per-command rules defining allowed and restricted commands
   */
  commands: CommandPolicyRule[];

  /**
   * File write rules defining allowed and restricted write operations
   */
  fileWrites: FileWritePolicyRule[];

  /**
   * Session and context rules (optional in v1)
   */
  sessions?: SessionPolicyRule[];

  /**
   * Metadata about the policy window and review status
   */
  window: {
    /**
     * Description of the current policy window
     */
    description?: string;

    /**
     * Timestamp of the last policy review evaluation
     */
    lastReviewedAt?: string;

    /**
     * Who performed the last review (could be 'ai:policy-reviewer-v1', human:email, etc.)
     */
    reviewedBy?: string;
  };

  /**
   * Optional settings for the policy engine behavior
   */
  settings?: {
    /**
     * Whether to cache review decisions to avoid repeated AI calls
     */
    cacheDecisions?: boolean;

    /**
     * TTL for cached decisions (in seconds)
     */
    decisionCacheTTL?: number;

    /**
     * Maximum number of consecutive review requests allowed
     */
    maxConsecutiveReviews?: number;
  };
}
```

## 2. Command Policy Rules

The `CommandPolicyRule` defines how specific commands should be handled based on patterns and contexts.

```ts
interface CommandPolicyRule {
  /**
   * Pattern to match commands against
   * Support for wildcards (*), specific commands, or regex patterns
   */
  pattern: string;

  /**
   * The action to take when this rule matches
   */
  mode: 'allow' | 'deny' | 'review';

  /**
   * Optional contextual conditions under which this rule applies differently
   */
  contexts?: CommandRuleContext[];

  /**
   * Optional description of what this rule accomplishes
   */
  description?: string;
}

interface CommandRuleContext {
  /**
   * Conditions that must be met for this context to apply
   * All conditions must be satisfied for the override to apply
   */
  when: {
    /**
     * Project type/tags ('sandbox', 'production', 'internal', etc.)
     */
    projectType?: string | string[];

    /**
     * Task type being performed ('refactor', 'debug', 'feature-dev', etc.)
     */
    taskType?: string | string[];

    /**
     * Specific directory context (e.g., 'in project root', 'in tests/', etc.)
     */
    directory?: string;

    /**
     * Time-based constraints (specific days of week, hours, etc.)
     */
    timeRestriction?: {
      days?: string[]; // e.g., ['monday', 'friday']
      hours?: [number, number]; // [start hour, end hour] in 24-hour format
    };

    /**
     * Approval state (human approval flags, etc.)
     */
    approvalState?: string | string[];
  };

  /**
   * Alternative mode to use when this context applies
   */
  overrideMode: 'allow' | 'deny' | 'review';

  /**
   * Optional description of this contextual rule
   */
  description?: string;
}
```

## 3. File Write Policy Rules

The `FileWritePolicyRule` defines how file write operations should be handled based on paths and contexts.

```ts
interface FileWritePolicyRule {
  /**
   * Pattern to match file paths against
   * Support for wildcards (*), specific paths, or regex patterns
   */
  pattern: string;

  /**
   * The action to take when this rule matches
   */
  mode: 'allow' | 'deny' | 'review';

  /**
   * Optional contextual conditions under which this rule applies differently
   */
  contexts?: FileWriteRuleContext[];

  /**
   * Optional description of what this rule accomplishes
   */
  description?: string;
}

interface FileWriteRuleContext {
  /**
   * Conditions that must be met for this context to apply
   */
  when: {
    /**
     * Project type/tags ('sandbox', 'production', 'internal', etc.)
     */
    projectType?: string | string[];

    /**
     * File type extension ('js', 'json', 'env', etc.)
     */
    fileType?: string | string[];

    /**
     * Directory context (e.g., 'in project root', 'in tests/', etc.)
     */
    directory?: string;

    /**
     * Task type being performed ('refactor', 'debug', 'feature-dev', etc.)
     */
    taskType?: string | string[];

    /**
     * Approval state (human approval flags, etc.)
     */
    approvalState?: string | string[];
  };

  /**
   * Alternative mode to use when this context applies
   */
  overrideMode: 'allow' | 'deny' | 'review';

  /**
   * Optional description of this contextual rule
   */
  description?: string;
}
```

## 4. Session Policy Rules

The `SessionPolicyRule` defines constraints and behaviors for session management.

```ts
interface SessionPolicyRule {
  /**
   * Pattern or condition for when this rule applies
   */
  pattern: string;

  /**
   * The action to take when this rule matches
   */
  mode: 'allow' | 'deny' | 'review';

  /**
   * Contextual conditions for this rule
   */
  contexts?: SessionRuleContext[];

  /**
   * Optional description of what this rule accomplishes
   */
  description?: string;
}

interface SessionRuleContext {
  /**
   * Conditions that must be met for this context to apply
   */
  when: {
    /**
     * Session type ('development', 'debugging', 'experimentation', etc.)
     */
    sessionType?: string | string[];

    /**
     * Project type/tags ('sandbox', 'production', 'internal', etc.)
     */
    projectType?: string | string[];

    /**
     * Time-based constraints
     */
    timeRestriction?: {
      days?: string[]; // e.g., ['monday', 'friday']
      hours?: [number, number]; // [start hour, end hour] in 24-hour format
    };

    /**
     * Authorization level required
     */
    authorizationLevel?: string;
  };

  /**
   * Alternative mode to use when this context applies
   */
  overrideMode: 'allow' | 'deny' | 'review';

  /**
   * Optional description of this contextual rule
   */
  description?: string;
}
```

## 5. Policy Evaluation Outcomes

The policy engine returns one of three possible outcomes for any requested action:

### 5.1 ALLOW
- Status code: `200`
- Response: `{ status: "success", permitted: true }`
- Action proceeds immediately without review

### 5.2 DENY
- Status code: `403`
- Response: `{ status: "error", permitted: false, reason: "policy_violation", policyCode: "POLICY_DENIED" }`
- Action is rejected with an error

### 5.3 REVIEW
- Status code: `202` (Accepted for processing)
- Response: `{ status: "pending_review", permitted: false, reason: "requires_policy_review", policyCode: "POLICY_REVIEW_REQUIRED", reviewId: "uuid" }`
- Action is suspended pending AI review decision

## 6. Policy Configuration Examples

### 6.1 Basic Policy Configuration
```json
{
  "version": "1.0.0",
  "description": "Default policy allowing most operations within project directory",
  "defaultCommandBehavior": "review",
  "defaultWriteBehavior": "review",
  "commands": [
    {
      "pattern": "cat *",
      "mode": "allow",
      "description": "Allow viewing files"
    },
    {
      "pattern": "ls *",
      "mode": "allow",
      "description": "Allow listing directories"
    },
    {
      "pattern": "rm *",
      "mode": "deny",
      "contexts": [
        {
          "when": {
            "projectType": "sandbox"
          },
          "overrideMode": "review",
          "description": "Allow review for rm commands in sandbox projects"
        }
      ]
    }
  ],
  "fileWrites": [
    {
      "pattern": "src/**/*",
      "mode": "allow",
      "description": "Allow writing to source code directories"
    },
    {
      "pattern": "tests/**/*",
      "mode": "allow",
      "description": "Allow writing to test directories"
    },
    {
      "pattern": "/etc/**/*",
      "mode": "deny",
      "description": "Never allow writes to system directories"
    }
  ],
  "window": {
    "description": "Safe development operations only",
    "lastReviewedAt": "2025-02-20T10:00:00Z",
    "reviewedBy": "ai:policy-reviewer-v1"
  }
}
```

### 6.2 Context-Aware Policy Configuration
```json
{
  "version": "1.0.0",
  "description": "Context-aware policy with different rules based on project type",
  "defaultCommandBehavior": "review",
  "defaultWriteBehavior": "review",
  "commands": [
    {
      "pattern": "npm install *",
      "mode": "deny",
      "contexts": [
        {
          "when": {
            "projectType": ["sandbox", "experiment"]
          },
          "overrideMode": "allow",
          "description": "Allow npm installs in sandbox and experimental projects"
        }
      ]
    },
    {
      "pattern": "docker *",
      "mode": "review",
      "description": "Container operations require review"
    }
  ],
  "fileWrites": [
    {
      "pattern": "**/*",
      "mode": "deny",
      "contexts": [
        {
          "when": {
            "directory": "src/"
          },
          "overrideMode": "allow",
          "description": "Allow writes in src directory"
        },
        {
          "when": {
            "directory": "docs/"
          },
          "overrideMode": "allow",
          "description": "Allow writes in docs directory"
        }
      ]
    }
  ],
  "window": {
    "description": "Development with context-aware restrictions",
    "lastReviewedAt": "2025-02-20T10:00:00Z",
    "reviewedBy": "human:admin@example.com"
  }
}
```

## 7. Schema Validation Notes

For implementations using this schema:

1. All patterns support Unix-style glob matching
2. Context conditions use AND logic (all conditions must be satisfied)
3. More specific rules (later in the list) may override earlier general rules
4. Context-specific overrides take precedence over global rule settings
5. The policy engine should validate that all required fields are present before applying a policy