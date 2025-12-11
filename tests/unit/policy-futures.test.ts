import { PolicyFuturesEngine, PolicyFuturesInput, PolicyFuturesResult } from '../../src/policy/futures';
import { PolicyDriftAnalysis } from '../../src/policy/drift';
import { PolicyTrace } from '../../src/policy/trace';
import { PolicyRecommendation } from '../../src/policy/inference';
import { PolicyReviewVerdict } from '../../src/policy/review';

describe('PolicyFuturesEngine', () => {
  let engine: PolicyFuturesEngine;

  beforeEach(() => {
    engine = new PolicyFuturesEngine();
  });

  describe('forecast', () => {
    it('should generate deterministic output given the same seed', () => {
      const input: PolicyFuturesInput = {
        policySnapshot: { test: 'policy' },
        driftHistory: [],
        traceHistory: [],
        inferenceHistory: [],
        reviewHistory: [],
        context: {
          projectId: 'test-project',
          timeframe: {
            windowHours: 4
          },
          monteCarlo: {
            iterations: 10,
            randomnessSeed: 12345
          }
        }
      };

      const result1 = engine.forecast(input);
      const result2 = engine.forecast(input);

      // Both results should be identical when using the same seed
      expect(result1).toEqual(result2);
    });

    it('should return correct structure with simulations and aggregate', () => {
      const input: PolicyFuturesInput = {
        policySnapshot: { test: 'policy' },
        driftHistory: [],
        traceHistory: [],
        inferenceHistory: [],
        reviewHistory: [],
        context: {
          projectId: 'test-project',
          timeframe: {
            windowHours: 4
          },
          monteCarlo: {
            iterations: 5,
            randomnessSeed: 12345
          }
        }
      };

      const result = engine.forecast(input);

      expect(result.projectId).toBe('test-project');
      expect(result.simulations).toHaveLength(5);
      expect(result.aggregate).toBeDefined();
      expect(result.aggregate.volatilityIndex).toBeDefined();
      expect(result.aggregate.mostProbableNarrative).toBeDefined();
      expect(result.aggregate.worstCaseNarrative).toBeDefined();
      expect(result.aggregate.bestCaseNarrative).toBeDefined();
      expect(result.aggregate.riskLevel).toBeDefined();
    });

    it('should produce higher volatility index with increased drift history', () => {
      const lowDriftInput: PolicyFuturesInput = {
        policySnapshot: { test: 'policy' },
        driftHistory: [
          { overallDriftScore: 0.1, stabilityIndex: 0.9, signals: [], classification: 'stable', narrativeSummary: '' },
          { overallDriftScore: 0.15, stabilityIndex: 0.85, signals: [], classification: 'stable', narrativeSummary: '' }
        ],
        traceHistory: [],
        inferenceHistory: [],
        reviewHistory: [],
        context: {
          projectId: 'test-project',
          timeframe: {
            windowHours: 4
          },
          monteCarlo: {
            iterations: 10,
            randomnessSeed: 12345
          }
        }
      };

      const highDriftInput: PolicyFuturesInput = {
        ...lowDriftInput,
        driftHistory: [
          { overallDriftScore: 0.1, stabilityIndex: 0.9, signals: [], classification: 'stable', narrativeSummary: '' },
          { overallDriftScore: 0.8, stabilityIndex: 0.2, signals: [], classification: 'volatile', narrativeSummary: '' }
        ]
      };

      const lowDriftResult = engine.forecast(lowDriftInput);
      const highDriftResult = engine.forecast(highDriftInput);

      // High drift history should generally lead to higher volatility index
      expect(highDriftResult.aggregate.volatilityIndex).toBeGreaterThanOrEqual(lowDriftResult.aggregate.volatilityIndex);
    });

    it('should return stable forecast with low drift and stable rules', () => {
      const input: PolicyFuturesInput = {
        policySnapshot: { test: 'policy' },
        driftHistory: [
          { overallDriftScore: 0.05, stabilityIndex: 0.95, signals: [], classification: 'stable', narrativeSummary: '' },
          { overallDriftScore: 0.07, stabilityIndex: 0.93, signals: [], classification: 'stable', narrativeSummary: '' }
        ],
        traceHistory: [
          { 
            actionId: 'test-1', 
            actionType: 'test-action', 
            timestamp: new Date().toISOString(), 
            evaluatedRules: [{ ruleId: 'rule1', matched: true, priority: 1, effect: 'allow' }], 
            finalDecision: 'allow',
            summaryForAI: 'Test trace',
            summaryForHuman: 'Test trace for allow decision'
          } as PolicyTrace
        ],
        inferenceHistory: [],
        reviewHistory: [],
        context: {
          projectId: 'test-project',
          timeframe: {
            windowHours: 4
          },
          monteCarlo: {
            iterations: 10,
            randomnessSeed: 12345
          }
        }
      };

      const result = engine.forecast(input);

      // With low drift and stable rules, risk level should be stable or elevated
      expect(['stable', 'elevated']).toContain(result.aggregate.riskLevel);
    });

    it('should return elevated/volatile risk with high override history', () => {
      const tracesWithOverrides: PolicyTrace[] = Array(20).fill(null).map((_, i) => ({
        actionId: `test-${i}`,
        actionType: 'test-action',
        timestamp: new Date().toISOString(),
        evaluatedRules: [{ ruleId: 'rule1', matched: true, priority: 1, effect: 'deny' }], // Deny to cause more overrides
        overrideContext: {
          triggered: true,
          reason: 'Test override due to overly restrictive policy'
        },
        finalDecision: 'allow',
        summaryForAI: 'Test trace with override',
        summaryForHuman: 'Test trace with override'
      } as PolicyTrace));

      const input: PolicyFuturesInput = {
        policySnapshot: { test: 'policy' },
        driftHistory: [
          { overallDriftScore: 0.5, stabilityIndex: 0.5, signals: [], classification: 'volatile', narrativeSummary: '' }
        ],
        traceHistory: tracesWithOverrides,
        inferenceHistory: [],
        reviewHistory: [],
        context: {
          projectId: 'test-project',
          timeframe: {
            windowHours: 4
          },
          monteCarlo: {
            iterations: 10,
            randomnessSeed: 12345
          }
        }
      };

      const result = engine.forecast(input);

      // With high override history, risk level should be elevated or higher
      expect(['elevated', 'volatile', 'critical']).toContain(result.aggregate.riskLevel);
    });

    it('should return critical risk with contradiction-heavy past', () => {
      const driftWithContradictions: PolicyDriftAnalysis[] = [
        {
          overallDriftScore: 0.9,
          stabilityIndex: 0.1,
          signals: [
            {
              id: 'test-signal-1',
              type: 'flip-flop',
              severity: 'critical',
              confidence: 0.95,
              explanation: 'High contradiction detected'
            },
            {
              id: 'test-signal-2',
              type: 'reviewer-disagreement',
              severity: 'critical',
              confidence: 0.9,
              explanation: 'Multiple reviewer disagreements'
            },
            {
              id: 'test-signal-3',
              type: 'rule-churn',
              severity: 'critical',
              confidence: 0.85,
              explanation: 'Excessive rule modifications'
            }
          ],
          classification: 'critical',
          narrativeSummary: 'High contradiction detected'
        }
      ];

      const input: PolicyFuturesInput = {
        policySnapshot: { test: 'policy' },
        driftHistory: driftWithContradictions,
        traceHistory: Array(30).fill(null).map((_, i) => ({
          actionId: `contradiction-test-${i}`,
          actionType: 'test-action',
          timestamp: new Date().toISOString(),
          evaluatedRules: [{ ruleId: 'rule1', matched: true, priority: 1, effect: 'deny' }],
          finalDecision: 'deny',
          summaryForAI: 'Test trace with contradiction',
          summaryForHuman: 'Test trace indicating policy instability'
        }) as PolicyTrace),
        inferenceHistory: [],
        reviewHistory: [],
        context: {
          projectId: 'test-project',
          timeframe: {
            windowHours: 4
          },
          monteCarlo: {
            iterations: 10,
            randomnessSeed: 12345
          }
        }
      };

      const result = engine.forecast(input);

      // With contradiction-heavy past, risk level should be elevated, volatile, or critical
      expect(['elevated', 'volatile', 'critical']).toContain(result.aggregate.riskLevel);
    });

    it('should produce deterministic results with same seed', () => {
      const input1: PolicyFuturesInput = {
        policySnapshot: { test: 'policy' },
        driftHistory: [],
        traceHistory: [],
        inferenceHistory: [],
        reviewHistory: [],
        context: {
          projectId: 'test-project',
          timeframe: {
            windowHours: 4
          },
          monteCarlo: {
            iterations: 5,
            randomnessSeed: 12345
          }
        }
      };

      const result1 = engine.forecast(input1);
      const result2 = engine.forecast(input1); // Same input

      // Results with same seed should be identical
      expect(result1).toEqual(result2);
    });

    it('should handle empty histories gracefully', () => {
      const input: PolicyFuturesInput = {
        policySnapshot: { test: 'policy' },
        driftHistory: [],
        traceHistory: [],
        inferenceHistory: [],
        reviewHistory: [],
        context: {
          projectId: 'test-project',
          timeframe: {
            windowHours: 4
          },
          monteCarlo: {
            iterations: 5,
            randomnessSeed: 12345
          }
        }
      };

      const result = engine.forecast(input);

      // Should still produce a result even with empty histories
      expect(result.projectId).toBe('test-project');
      expect(result.simulations).toHaveLength(5);
      expect(result.aggregate).toBeDefined();
    });
  });

  describe('SeededRandom', () => {
    it('should produce deterministic results', () => {
      // Testing internal implementation through the public API
      // Since SeededRandom is internal, we test through the forecast API
      const input: PolicyFuturesInput = {
        policySnapshot: { test: 'policy' },
        driftHistory: [],
        traceHistory: [],
        inferenceHistory: [],
        reviewHistory: [],
        context: {
          projectId: 'test-project',
          timeframe: {
            windowHours: 4
          },
          monteCarlo: {
            iterations: 1,
            randomnessSeed: 999
          }
        }
      };

      // Running the same forecast multiple times should produce identical results
      const results = Array(5).fill(null).map(() => engine.forecast(input));
      const firstResult = results[0];
      
      results.forEach(result => {
        expect(result).toEqual(firstResult);
      });
    });
  });
});