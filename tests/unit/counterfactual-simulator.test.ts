import { CounterfactualPolicySimulator, CounterfactualInput } from '../../src/policy/counterfactual';
import { PolicyTrace } from '../../src/policy/trace';

describe('CounterfactualPolicySimulator', () => {
  let simulator: CounterfactualPolicySimulator;

  beforeEach(() => {
    simulator = new CounterfactualPolicySimulator();
  });

  describe('runSimulation', () => {
    it('should detect ALLOW to DENY upgrade (stronger)', () => {
      // Create an original trace that allowed an action
      const originalTrace: PolicyTrace = {
        actionId: 'test-action-1',
        actionType: 'run-command',
        timestamp: '2023-01-01T00:00:00Z',
        evaluatedRules: [
          {
            ruleId: 'test-rule',
            matched: true,
            matchReason: 'Command "ls" matches test pattern',
            priority: 100,
            effect: 'allow'
          }
        ],
        finalDecision: 'allow',
        finalRuleId: 'test-rule',
        summaryForAI: 'Action allowed based on policy evaluation',
        summaryForHuman: 'Action was allowed. Rule test-rule with mode allow was applied.'
      };

      // Create original and alternate policies
      const originalPolicy = {
        commands: [
          {
            id: 'test-rule',
            pattern: 'ls',
            mode: 'allow',
            priority: 100
          }
        ],
        defaultCommandBehavior: 'allow'
      };

      // Alternate policy that denies the same command
      const alternatePolicy = {
        commands: [
          {
            id: 'test-rule',
            pattern: 'ls',
            mode: 'deny',
            priority: 100
          }
        ],
        defaultCommandBehavior: 'allow'
      };

      const input: CounterfactualInput = {
        originalPolicy,
        alternatePolicy,
        policyTraces: [originalTrace],
        context: {
          projectId: 'test-project',
          sessionIds: ['session-1'],
          timeframe: { start: '2023-01-01T00:00:00Z', end: '2023-01-01T23:59:59Z' }
        }
      };

      const result = simulator.runSimulation(input);

      expect(result.summary.strongerCount).toBe(1);
      expect(result.summary.weakerCount).toBe(0);
      expect(result.summary.contradictions).toBe(0);
      expect(result.actions[0].difference).toBe('stronger');
      expect(result.actions[0].originalDecision).toBe('ALLOW');
      expect(result.actions[0].simulatedDecision).toBe('DENY');
    });

    it('should detect DENY to ALLOW downgrade (weaker)', () => {
      // Create an original trace that denied an action
      const originalTrace: PolicyTrace = {
        actionId: 'test-action-1',
        actionType: 'run-command',
        timestamp: '2023-01-01T00:00:00Z',
        evaluatedRules: [
          {
            ruleId: 'test-rule',
            matched: true,
            matchReason: 'Command "rm" matches test pattern',
            priority: 100,
            effect: 'deny'
          }
        ],
        finalDecision: 'deny',
        finalRuleId: 'test-rule',
        summaryForAI: 'Action denied based on policy evaluation',
        summaryForHuman: 'Action was denied. Rule test-rule with mode deny was applied.'
      };

      // Create original policy that denies the action
      const originalPolicy = {
        commands: [
          {
            id: 'test-rule',
            pattern: 'rm',
            mode: 'deny',
            priority: 100
          }
        ],
        defaultCommandBehavior: 'allow'
      };

      // Alternate policy that allows the same command
      const alternatePolicy = {
        commands: [
          {
            id: 'test-rule',
            pattern: 'rm',
            mode: 'allow',
            priority: 100
          }
        ],
        defaultCommandBehavior: 'allow'
      };

      const input: CounterfactualInput = {
        originalPolicy,
        alternatePolicy,
        policyTraces: [originalTrace],
        context: {
          projectId: 'test-project',
          sessionIds: ['session-1'],
          timeframe: { start: '2023-01-01T00:00:00Z', end: '2023-01-01T23:59:59Z' }
        }
      };

      const result = simulator.runSimulation(input);

      expect(result.summary.strongerCount).toBe(0);
      expect(result.summary.weakerCount).toBe(1);
      expect(result.summary.contradictions).toBe(0);
      expect(result.actions[0].difference).toBe('weaker');
      expect(result.actions[0].originalDecision).toBe('DENY');
      expect(result.actions[0].simulatedDecision).toBe('ALLOW');
    });

    it('should detect REVIEW to ALLOW weakening', () => {
      // Create an original trace that required review
      const originalTrace: PolicyTrace = {
        actionId: 'test-action-1',
        actionType: 'run-command',
        timestamp: '2023-01-01T00:00:00Z',
        evaluatedRules: [
          {
            ruleId: 'test-rule',
            matched: true,
            matchReason: 'Command "sudo" matches test pattern',
            priority: 100,
            effect: 'review'
          }
        ],
        finalDecision: 'review',
        finalRuleId: 'test-rule',
        summaryForAI: 'Action requires review based on policy evaluation',
        summaryForHuman: 'Action requires policy review. Rule test-rule with mode review required review.'
      };

      // Create original policy that requires review
      const originalPolicy = {
        commands: [
          {
            id: 'test-rule',
            pattern: 'sudo',
            mode: 'review',
            priority: 100
          }
        ],
        defaultCommandBehavior: 'allow'
      };

      // Alternate policy that allows the same command
      const alternatePolicy = {
        commands: [
          {
            id: 'test-rule',
            pattern: 'sudo',
            mode: 'allow',
            priority: 100
          }
        ],
        defaultCommandBehavior: 'allow'
      };

      const input: CounterfactualInput = {
        originalPolicy,
        alternatePolicy,
        policyTraces: [originalTrace],
        context: {
          projectId: 'test-project',
          sessionIds: ['session-1'],
          timeframe: { start: '2023-01-01T00:00:00Z', end: '2023-01-01T23:59:59Z' }
        }
      };

      const result = simulator.runSimulation(input);

      expect(result.summary.strongerCount).toBe(0);
      expect(result.summary.weakerCount).toBe(1);
      expect(result.summary.contradictions).toBe(0);
      expect(result.actions[0].difference).toBe('weaker');
      expect(result.actions[0].originalDecision).toBe('REVIEW');
      expect(result.actions[0].simulatedDecision).toBe('ALLOW');
    });

    it('should detect ALLOW to REVIEW strengthening', () => {
      // Create an original trace that allowed an action
      const originalTrace: PolicyTrace = {
        actionId: 'test-action-1',
        actionType: 'run-command',
        timestamp: '2023-01-01T00:00:00Z',
        evaluatedRules: [
          {
            ruleId: 'test-rule',
            matched: true,
            matchReason: 'Command "git" matches test pattern',
            priority: 100,
            effect: 'allow'
          }
        ],
        finalDecision: 'allow',
        finalRuleId: 'test-rule',
        summaryForAI: 'Action allowed based on policy evaluation',
        summaryForHuman: 'Action was allowed. Rule test-rule with mode allow was applied.'
      };

      // Create original policy that allows the action
      const originalPolicy = {
        commands: [
          {
            id: 'test-rule',
            pattern: 'git',
            mode: 'allow',
            priority: 100
          }
        ],
        defaultCommandBehavior: 'allow'
      };

      // Alternate policy that requires review
      const alternatePolicy = {
        commands: [
          {
            id: 'test-rule',
            pattern: 'git',
            mode: 'review',
            priority: 100
          }
        ],
        defaultCommandBehavior: 'allow'
      };

      const input: CounterfactualInput = {
        originalPolicy,
        alternatePolicy,
        policyTraces: [originalTrace],
        context: {
          projectId: 'test-project',
          sessionIds: ['session-1'],
          timeframe: { start: '2023-01-01T00:00:00Z', end: '2023-01-01T23:59:59Z' }
        }
      };

      const result = simulator.runSimulation(input);

      expect(result.summary.strongerCount).toBe(1);
      expect(result.summary.weakerCount).toBe(0);
      expect(result.summary.contradictions).toBe(0);
      expect(result.actions[0].difference).toBe('stronger');
      expect(result.actions[0].originalDecision).toBe('ALLOW');
      expect(result.actions[0].simulatedDecision).toBe('REVIEW');
    });

    it('should detect contradiction between policies', () => {
      // Create an original trace that allowed an action
      const originalTrace: PolicyTrace = {
        actionId: 'test-action-1',
        actionType: 'run-command',
        timestamp: '2023-01-01T00:00:00Z',
        evaluatedRules: [
          {
            ruleId: 'test-rule',
            matched: true,
            matchReason: 'Command "dangerous-command" matches test pattern',
            priority: 100,
            effect: 'allow'
          }
        ],
        finalDecision: 'allow',
        finalRuleId: 'test-rule',
        summaryForAI: 'Action allowed based on policy evaluation',
        summaryForHuman: 'Action was allowed. Rule test-rule with mode allow was applied.'
      };

      // Create original policy that allows the action
      const originalPolicy = {
        commands: [
          {
            id: 'test-rule',
            pattern: 'dangerous-command',
            mode: 'allow',
            priority: 100
          }
        ],
        defaultCommandBehavior: 'allow'
      };

      // Alternate policy that denies the same action - this creates a contradiction
      const alternatePolicy = {
        commands: [
          {
            id: 'test-rule',
            pattern: 'dangerous-command',
            mode: 'deny',
            priority: 100
          }
        ],
        defaultCommandBehavior: 'allow'
      };

      const input: CounterfactualInput = {
        originalPolicy,
        alternatePolicy,
        policyTraces: [originalTrace],
        context: {
          projectId: 'test-project',
          sessionIds: ['session-1'],
          timeframe: { start: '2023-01-01T00:00:00Z', end: '2023-01-01T23:59:59Z' }
        }
      };

      const result = simulator.runSimulation(input);

      expect(result.summary.contradictions).toBe(1);
      expect(result.actions[0].difference).toBe('stronger'); // ALLOW -> DENY is stronger, not contradiction
    });

    it('should handle unchanged decisions', () => {
      // Create an original trace that allowed an action
      const originalTrace: PolicyTrace = {
        actionId: 'test-action-1',
        actionType: 'run-command',
        timestamp: '2023-01-01T00:00:00Z',
        evaluatedRules: [
          {
            ruleId: 'test-rule',
            matched: true,
            matchReason: 'Command "ls" matches test pattern',
            priority: 100,
            effect: 'allow'
          }
        ],
        finalDecision: 'allow',
        finalRuleId: 'test-rule',
        summaryForAI: 'Action allowed based on policy evaluation',
        summaryForHuman: 'Action was allowed. Rule test-rule with mode allow was applied.'
      };

      // Create identical original and alternate policies
      const originalPolicy = {
        commands: [
          {
            id: 'test-rule',
            pattern: 'ls',
            mode: 'allow',
            priority: 100
          }
        ],
        defaultCommandBehavior: 'allow'
      };

      const alternatePolicy = {
        commands: [
          {
            id: 'test-rule',
            pattern: 'ls',
            mode: 'allow',
            priority: 100
          }
        ],
        defaultCommandBehavior: 'allow'
      };

      const input: CounterfactualInput = {
        originalPolicy,
        alternatePolicy,
        policyTraces: [originalTrace],
        context: {
          projectId: 'test-project',
          sessionIds: ['session-1'],
          timeframe: { start: '2023-01-01T00:00:00Z', end: '2023-01-01T23:59:59Z' }
        }
      };

      const result = simulator.runSimulation(input);

      expect(result.summary.unchanged).toBe(1);
      expect(result.summary.strongerCount).toBe(0);
      expect(result.summary.weakerCount).toBe(0);
      expect(result.summary.contradictions).toBe(0);
      expect(result.actions[0].difference).toBe('same');
      expect(result.actions[0].originalDecision).toBe('ALLOW');
      expect(result.actions[0].simulatedDecision).toBe('ALLOW');
    });

    it('should produce deterministic output across multiple runs', () => {
      // Create an original trace that allowed an action
      const originalTrace: PolicyTrace = {
        actionId: 'test-action-1',
        actionType: 'run-command',
        timestamp: '2023-01-01T00:00:00Z',
        evaluatedRules: [
          {
            ruleId: 'test-rule',
            matched: true,
            matchReason: 'Command "ls" matches test pattern',
            priority: 100,
            effect: 'allow'
          }
        ],
        finalDecision: 'allow',
        finalRuleId: 'test-rule',
        summaryForAI: 'Action allowed based on policy evaluation',
        summaryForHuman: 'Action was allowed. Rule test-rule with mode allow was applied.'
      };

      // Create original and alternate policies that will result in a DENY
      const originalPolicy = {
        commands: [
          {
            id: 'test-rule',
            pattern: 'ls',
            mode: 'allow',
            priority: 100
          }
        ],
        defaultCommandBehavior: 'allow'
      };

      const alternatePolicy = {
        commands: [
          {
            id: 'test-rule',
            pattern: 'ls',
            mode: 'deny',
            priority: 100
          }
        ],
        defaultCommandBehavior: 'allow'
      };

      const input: CounterfactualInput = {
        originalPolicy,
        alternatePolicy,
        policyTraces: [originalTrace],
        context: {
          projectId: 'test-project',
          sessionIds: ['session-1'],
          timeframe: { start: '2023-01-01T00:00:00Z', end: '2023-01-01T23:59:59Z' }
        }
      };

      // Run simulation multiple times
      const result1 = simulator.runSimulation(input);
      const result2 = simulator.runSimulation(input);
      const result3 = simulator.runSimulation(input);

      // Results should be identical across runs
      expect(result1).toEqual(result2);
      expect(result2).toEqual(result3);
      
      expect(result1.summary.strongerCount).toBe(1);
      expect(result1.summary.weakerCount).toBe(0);
      expect(result1.summary.contradictions).toBe(0);
      expect(result1.summary.unchanged).toBe(0);
    });
  });

  describe('calculateDifference', () => {
    // The calculateDifference method is private, but we can test it indirectly through runSimulation
    it('should correctly identify stronger transitions', () => {
      // ALLOW -> REVIEW
      let originalTrace: PolicyTrace = {
        actionId: 'test-action-1',
        actionType: 'run-command',
        timestamp: '2023-01-01T00:00:00Z',
        evaluatedRules: [
          {
            ruleId: 'test-rule',
            matched: true,
            matchReason: 'Command "ls" matches test pattern',
            priority: 100,
            effect: 'allow'
          }
        ],
        finalDecision: 'allow',
        finalRuleId: 'test-rule',
        summaryForAI: 'Action allowed based on policy evaluation',
        summaryForHuman: 'Action was allowed. Rule test-rule with mode allow was applied.'
      };

      let result = simulator.runSimulation({
        originalPolicy: {
          commands: [{ id: 'test-rule', pattern: 'ls', mode: 'allow', priority: 100 }],
          defaultCommandBehavior: 'allow'
        },
        alternatePolicy: {
          commands: [{ id: 'test-rule', pattern: 'ls', mode: 'review', priority: 100 }],
          defaultCommandBehavior: 'allow'
        },
        policyTraces: [originalTrace],
        context: {
          projectId: 'test-project',
          sessionIds: ['session-1'],
          timeframe: { start: '2023-01-01T00:00:00Z', end: '2023-01-01T23:59:59Z' }
        }
      });

      expect(result.actions[0].difference).toBe('stronger');

      // ALLOW -> DENY
      originalTrace.finalDecision = 'allow';
      result = simulator.runSimulation({
        originalPolicy: {
          commands: [{ id: 'test-rule', pattern: 'ls', mode: 'allow', priority: 100 }],
          defaultCommandBehavior: 'allow'
        },
        alternatePolicy: {
          commands: [{ id: 'test-rule', pattern: 'ls', mode: 'deny', priority: 100 }],
          defaultCommandBehavior: 'allow'
        },
        policyTraces: [originalTrace],
        context: {
          projectId: 'test-project',
          sessionIds: ['session-1'],
          timeframe: { start: '2023-01-01T00:00:00Z', end: '2023-01-01T23:59:59Z' }
        }
      });

      expect(result.actions[0].difference).toBe('stronger');

      // REVIEW -> DENY
      originalTrace.finalDecision = 'review';
      result = simulator.runSimulation({
        originalPolicy: {
          commands: [{ id: 'test-rule', pattern: 'ls', mode: 'review', priority: 100 }],
          defaultCommandBehavior: 'allow'
        },
        alternatePolicy: {
          commands: [{ id: 'test-rule', pattern: 'ls', mode: 'deny', priority: 100 }],
          defaultCommandBehavior: 'allow'
        },
        policyTraces: [originalTrace],
        context: {
          projectId: 'test-project',
          sessionIds: ['session-1'],
          timeframe: { start: '2023-01-01T00:00:00Z', end: '2023-01-01T23:59:59Z' }
        }
      });

      expect(result.actions[0].difference).toBe('stronger');
    });

    it('should correctly identify weaker transitions', () => {
      // DENY -> ALLOW
      let originalTrace: PolicyTrace = {
        actionId: 'test-action-1',
        actionType: 'run-command',
        timestamp: '2023-01-01T00:00:00Z',
        evaluatedRules: [
          {
            ruleId: 'test-rule',
            matched: true,
            matchReason: 'Command "ls" matches test pattern',
            priority: 100,
            effect: 'deny'
          }
        ],
        finalDecision: 'deny',
        finalRuleId: 'test-rule',
        summaryForAI: 'Action denied based on policy evaluation',
        summaryForHuman: 'Action was denied. Rule test-rule with mode deny was applied.'
      };

      let result = simulator.runSimulation({
        originalPolicy: {
          commands: [{ id: 'test-rule', pattern: 'ls', mode: 'deny', priority: 100 }],
          defaultCommandBehavior: 'allow'
        },
        alternatePolicy: {
          commands: [{ id: 'test-rule', pattern: 'ls', mode: 'allow', priority: 100 }],
          defaultCommandBehavior: 'allow'
        },
        policyTraces: [originalTrace],
        context: {
          projectId: 'test-project',
          sessionIds: ['session-1'],
          timeframe: { start: '2023-01-01T00:00:00Z', end: '2023-01-01T23:59:59Z' }
        }
      });

      expect(result.actions[0].difference).toBe('weaker');

      // REVIEW -> ALLOW
      originalTrace.finalDecision = 'review';
      result = simulator.runSimulation({
        originalPolicy: {
          commands: [{ id: 'test-rule', pattern: 'ls', mode: 'review', priority: 100 }],
          defaultCommandBehavior: 'allow'
        },
        alternatePolicy: {
          commands: [{ id: 'test-rule', pattern: 'ls', mode: 'allow', priority: 100 }],
          defaultCommandBehavior: 'allow'
        },
        policyTraces: [originalTrace],
        context: {
          projectId: 'test-project',
          sessionIds: ['session-1'],
          timeframe: { start: '2023-01-01T00:00:00Z', end: '2023-01-01T23:59:59Z' }
        }
      });

      expect(result.actions[0].difference).toBe('weaker');

      // DENY -> REVIEW
      originalTrace.finalDecision = 'deny';
      result = simulator.runSimulation({
        originalPolicy: {
          commands: [{ id: 'test-rule', pattern: 'ls', mode: 'deny', priority: 100 }],
          defaultCommandBehavior: 'allow'
        },
        alternatePolicy: {
          commands: [{ id: 'test-rule', pattern: 'ls', mode: 'review', priority: 100 }],
          defaultCommandBehavior: 'allow'
        },
        policyTraces: [originalTrace],
        context: {
          projectId: 'test-project',
          sessionIds: ['session-1'],
          timeframe: { start: '2023-01-01T00:00:00Z', end: '2023-01-01T23:59:59Z' }
        }
      });

      expect(result.actions[0].difference).toBe('weaker');
    });
  });
});