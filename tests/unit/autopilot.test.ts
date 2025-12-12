import { GovernanceAutopilot, AutopilotInput } from '../../src/policy/autopilot';
import { PolicyDriftAnalysis } from '../../src/policy/drift';
import { PolicyFuturesResult } from '../../src/policy/futures';
import { FederatedPolicyHealth } from '../../src/policy/federated';

describe('GovernanceAutopilot', () => {
  let autopilot: GovernanceAutopilot;

  beforeEach(() => {
    autopilot = new GovernanceAutopilot();
  });

  describe('runCycle', () => {
    it('should return deterministic output given fixed input', () => {
      const mockInput: AutopilotInput = {
        projectId: 'test-project',
        lastSnapshot: {
          policy: { rules: [] },
          drift: {
            overallDriftScore: 0.1,
            stabilityIndex: 0.95,
            classification: 'stable',
            signals: []
          },
          futures: {
            projectId: 'test-project',
            simulations: [],
            aggregate: {
              volatilityIndex: 0.1,
              mostProbableNarrative: 'Stable operation expected',
              worstCaseNarrative: 'Minor issues possible',
              bestCaseNarrative: 'Optimal performance',
              riskLevel: 'stable'
            }
          },
          federated: {
            similarityMatrix: {
              projectIds: ['test-project'],
              values: [[1.0]]
            },
            clusters: [{ clusterId: 'cluster_0', members: ['test-project'] }],
            outliers: [],
            consensus: {
              baselineRules: [],
              similarityWeightedRules: [],
              driftWeightedRules: []
            },
            influenceGraph: [],
            systemStabilityScore: 0.95,
            narrativeSummary: 'System stable'
          },
          reviewVerdicts: []
        },
        timestamps: {
          now: '2025-01-01T12:00:00Z',
          lastCheck: '2025-01-01T11:00:00Z'
        },
        config: {
          thresholds: {
            volatility: 0.45,
            drift: 0.5,
            divergence: 0.6
          },
          taskEmission: {
            enable: true,
            minIntervalMinutes: 30
          }
        }
      };

      // Run the same input multiple times and verify deterministic output
      const result1 = autopilot.runCycle(mockInput);
      const result2 = autopilot.runCycle(mockInput);

      expect(result1.projectId).toBe(result2.projectId);
      expect(result1.risk.globalRisk).toBe(result2.risk.globalRisk);
      expect(result1.recommendedActions).toEqual(result2.recommendedActions);
    });

    it('should produce high risk when drift is above threshold', () => {
      const mockInput: AutopilotInput = {
        projectId: 'test-project',
        lastSnapshot: {
          policy: { rules: [] },
          drift: {
            overallDriftScore: 0.8, // Above threshold of 0.5
            stabilityIndex: 0.3,
            classification: 'volatile',
            signals: [{ type: 'rule_churn', severity: 'high', confidence: 0.9 }]
          },
          futures: undefined,
          federated: undefined,
          reviewVerdicts: []
        },
        timestamps: {
          now: '2025-01-01T12:00:00Z',
          lastCheck: '2025-01-01T11:00:00Z'
        },
        config: {
          thresholds: {
            volatility: 0.45,
            drift: 0.5, // Threshold for drift
            divergence: 0.6
          },
          taskEmission: {
            enable: true,
            minIntervalMinutes: 30
          }
        }
      };

      const result = autopilot.runCycle(mockInput);

      // With high drift, risk should be elevated or higher
      expect(['elevated', 'volatile', 'critical']).toContain(result.risk.globalRisk);
      expect(result.risk.metrics?.drift).toBe(0.8);
      
      // Should recommend drift investigation
      const driftRecommendation = result.recommendedActions.find(
        action => action.type === 'drift-investigation'
      );
      expect(driftRecommendation).toBeDefined();
    });

    it('should produce high risk when volatility is high', () => {
      const mockInput: AutopilotInput = {
        projectId: 'test-project',
        lastSnapshot: {
          policy: { rules: [] },
          drift: {
            overallDriftScore: 0.1,
            stabilityIndex: 0.95,
            classification: 'stable',
            signals: []
          },
          futures: {
            projectId: 'test-project',
            simulations: [],
            aggregate: {
              volatilityIndex: 0.8, // Above threshold of 0.45
              mostProbableNarrative: 'High volatility detected',
              worstCaseNarrative: 'System instability likely',
              bestCaseNarrative: 'Moderate issues possible',
              riskLevel: 'volatile'
            }
          },
          federated: undefined,
          reviewVerdicts: []
        },
        timestamps: {
          now: '2025-01-01T12:00:00Z',
          lastCheck: '2025-01-01T11:00:00Z'
        },
        config: {
          thresholds: {
            volatility: 0.45, // Threshold for volatility
            drift: 0.5,
            divergence: 0.6
          },
          taskEmission: {
            enable: true,
            minIntervalMinutes: 30
          }
        }
      };

      const result = autopilot.runCycle(mockInput);

      // With high volatility, risk should be elevated or higher
      expect(['elevated', 'volatile', 'critical']).toContain(result.risk.globalRisk);
      expect(result.risk.metrics?.volatility).toBe(0.8);
      
      // Should recommend policy review
      const reviewRecommendation = result.recommendedActions.find(
        action => action.type === 'policy-review'
      );
      expect(reviewRecommendation).toBeDefined();
    });

    it('should produce federated-sync recommendation when divergence is high', () => {
      const mockInput: AutopilotInput = {
        projectId: 'test-project',
        lastSnapshot: {
          policy: { rules: [] },
          drift: undefined,
          futures: undefined,
          federated: {
            similarityMatrix: {
              projectIds: ['test-project', 'other-project'],
              values: [
                [1.0, 0.1], // Low similarity with other project
                [0.1, 1.0]
              ]
            },
            clusters: [
              { clusterId: 'cluster_0', members: ['test-project'] },
              { clusterId: 'cluster_1', members: ['other-project'] }
            ],
            outliers: ['test-project'],
            consensus: {
              baselineRules: [],
              similarityWeightedRules: [],
              driftWeightedRules: []
            },
            influenceGraph: [],
            systemStabilityScore: 0.2, // High divergence (1 - 0.2 = 0.8)
            narrativeSummary: 'High divergence detected'
          },
          reviewVerdicts: []
        },
        timestamps: {
          now: '2025-01-01T12:00:00Z',
          lastCheck: '2025-01-01T11:00:00Z'
        },
        config: {
          thresholds: {
            volatility: 0.45,
            drift: 0.5,
            divergence: 0.6 // Threshold for divergence
          },
          taskEmission: {
            enable: true,
            minIntervalMinutes: 30
          }
        }
      };

      const result = autopilot.runCycle(mockInput);

      // With high divergence, should include federated-sync recommendation
      const federatedRecommendation = result.recommendedActions.find(
        action => action.type === 'federated-sync'
      );
      expect(federatedRecommendation).toBeDefined();
    });

    it('should produce rewrite-policy recommendation when contradiction rate is high', () => {
      const mockInput: AutopilotInput = {
        projectId: 'test-project',
        lastSnapshot: {
          policy: { rules: [] },
          drift: undefined,
          futures: {
            projectId: 'test-project',
            simulations: [
              {
                iteration: 0,
                randomSeed: 12345,
                predictedDrift: 0.2,
                predictedViolations: 1,
                predictedEscalations: 1,
                predictedOverrides: 1,
                breakdown: {
                  likelihood_weaken: 0.1,
                  likelihood_stronger: 0.1,
                  likelihood_contradiction: 0.8 // High contradiction rate
                },
                narrative: 'High contradiction detected'
              }
            ],
            aggregate: {
              volatilityIndex: 0.1,
              mostProbableNarrative: 'Stable operation expected',
              worstCaseNarrative: 'Contradiction concerns',
              bestCaseNarrative: 'Optimal performance',
              riskLevel: 'stable'
            }
          },
          federated: undefined,
          reviewVerdicts: []
        },
        timestamps: {
          now: '2025-01-01T12:00:00Z',
          lastCheck: '2025-01-01T11:00:00Z'
        },
        config: {
          thresholds: {
            volatility: 0.45,
            drift: 0.5,
            divergence: 0.6
          },
          taskEmission: {
            enable: true,
            minIntervalMinutes: 30
          }
        }
      };

      const result = autopilot.runCycle(mockInput);

      // With high contradiction rate, should include rewrite-policy recommendation
      const rewriteRecommendation = result.recommendedActions.find(
        action => action.type === 'rewrite-policy'
      );
      expect(rewriteRecommendation).toBeDefined();
      expect(rewriteRecommendation?.priority).toBe('high');
    });

    it('should produce audit recommendation for stable system', () => {
      const mockInput: AutopilotInput = {
        projectId: 'test-project',
        lastSnapshot: {
          policy: { rules: [] },
          drift: {
            overallDriftScore: 0.05, // Very low drift
            stabilityIndex: 0.98,
            classification: 'stable',
            signals: []
          },
          futures: {
            projectId: 'test-project',
            simulations: [],
            aggregate: {
              volatilityIndex: 0.05, // Very low volatility
              mostProbableNarrative: 'Stable operation expected',
              worstCaseNarrative: 'Minor issues possible',
              bestCaseNarrative: 'Optimal performance',
              riskLevel: 'stable'
            }
          },
          federated: {
            similarityMatrix: {
              projectIds: ['test-project'],
              values: [[1.0]]
            },
            clusters: [{ clusterId: 'cluster_0', members: ['test-project'] }],
            outliers: [],
            consensus: {
              baselineRules: [],
              similarityWeightedRules: [],
              driftWeightedRules: []
            },
            influenceGraph: [],
            systemStabilityScore: 0.98, // Very high stability
            narrativeSummary: 'System very stable'
          },
          reviewVerdicts: []
        },
        timestamps: {
          now: '2025-01-01T12:00:00Z',
          lastCheck: '2025-01-01T11:00:00Z'
        },
        config: {
          thresholds: {
            volatility: 0.45,
            drift: 0.5,
            divergence: 0.6
          },
          taskEmission: {
            enable: true,
            minIntervalMinutes: 30
          }
        }
      };

      const result = autopilot.runCycle(mockInput);

      // For a stable system, should still produce an audit recommendation
      expect(result.risk.globalRisk).toBe('stable');
      
      const auditRecommendation = result.recommendedActions.find(
        action => action.type === 'audit'
      );
      expect(auditRecommendation).toBeDefined();
      expect(auditRecommendation?.priority).toBe('low');
    });

    it('should correctly calculate risk score using the defined formula', () => {
      // Create a specific scenario with known values to test the formula
      // riskScore = futures.volatilityIndex * 0.4 + drift.driftScore * 0.3 + 
      //             federated.divergenceScore * 0.2 + contradictionRate * 0.1
      // 
      // divergence = 1 - federated.systemStabilityScore
      // contradictionRate is calculated from futures simulations breakdowns

      const mockInput: AutopilotInput = {
        projectId: 'test-project',
        lastSnapshot: {
          policy: { rules: [] },
          drift: {
            overallDriftScore: 0.3, // Drift contributes 0.3 * 0.3 = 0.09
            stabilityIndex: 0.85,
            classification: 'watch',
            signals: []
          },
          futures: {
            projectId: 'test-project',
            simulations: [
              {
                iteration: 0,
                randomSeed: 12345,
                predictedDrift: 0.2,
                predictedViolations: 0,
                predictedEscalations: 0,
                predictedOverrides: 0,
                breakdown: {
                  likelihood_weaken: 0.2,
                  likelihood_stronger: 0.1,
                  likelihood_contradiction: 0.1 // Contradiction contributes 0.1 * 0.1 = 0.01
                },
                narrative: 'Test narrative'
              }
            ],
            aggregate: {
              volatilityIndex: 0.5, // Volatility contributes 0.5 * 0.4 = 0.20
              mostProbableNarrative: 'Test narrative',
              worstCaseNarrative: 'Test narrative',
              bestCaseNarrative: 'Test narrative',
              riskLevel: 'elevated'
            }
          },
          federated: {
            similarityMatrix: {
              projectIds: ['test-project'],
              values: [[1.0]]
            },
            clusters: [{ clusterId: 'cluster_0', members: ['test-project'] }],
            outliers: [],
            consensus: {
              baselineRules: [],
              similarityWeightedRules: [],
              driftWeightedRules: []
            },
            influenceGraph: [],
            systemStabilityScore: 0.7, // Divergence = 1 - 0.7 = 0.3, contributes 0.3 * 0.2 = 0.06
            narrativeSummary: 'Moderate stability'
          },
          reviewVerdicts: []
        },
        timestamps: {
          now: '2025-01-01T12:00:00Z',
          lastCheck: '2025-01-01T11:00:00Z'
        },
        config: {
          thresholds: {
            volatility: 0.45,
            drift: 0.5,
            divergence: 0.6
          },
          taskEmission: {
            enable: true,
            minIntervalMinutes: 30
          }
        }
      };

      const result = autopilot.runCycle(mockInput);

      // Calculate expected risk score manually:
      // 0.5 * 0.4 (volatility) + 0.3 * 0.3 (drift) + 0.3 * 0.2 (divergence) + 0.1 * 0.1 (contradiction)
      // = 0.20 + 0.09 + 0.06 + 0.01 = 0.36
      expect(result.risk.metrics?.volatility).toBe(0.5);
      expect(result.risk.metrics?.drift).toBe(0.3);
      expect(result.risk.metrics?.divergence).toBe(0.3); // 1 - 0.7 = 0.3
      expect(result.risk.metrics?.contradictionRate).toBe(0.1);

      // The risk score should be around 0.36, which maps to 'elevated' risk level (0.25-0.45)
      expect(result.risk.globalRisk).toBe('elevated');
    });
  });

  describe('calculateRisk', () => {
    // This is tested through the runCycle method which calls calculateRisk internally
    it('should handle missing inputs gracefully', () => {
      const mockInput: AutopilotInput = {
        projectId: 'test-project',
        lastSnapshot: {
          policy: { rules: [] },
          drift: undefined, // Missing drift data
          futures: undefined, // Missing futures data
          federated: undefined, // Missing federated data
          reviewVerdicts: undefined
        },
        timestamps: {
          now: '2025-01-01T12:00:00Z',
          lastCheck: '2025-01-01T11:00:00Z'
        },
        config: {
          thresholds: {
            volatility: 0.45,
            drift: 0.5,
            divergence: 0.6
          },
          taskEmission: {
            enable: true,
            minIntervalMinutes: 30
          }
        }
      };

      const result = autopilot.runCycle(mockInput);

      // With no data, should default to stable (risk score of 0)
      expect(result.risk.globalRisk).toBe('stable');
      expect(result.risk.metrics?.drift).toBeUndefined();
      expect(result.risk.metrics?.volatility).toBeUndefined();
      expect(result.risk.metrics?.divergence).toBeUndefined();
    });
  });

  describe('generateTaskRecommendations', () => {
    // This is implicitly tested through the runCycle method
    it('should generate appropriate recommendations based on risk level', () => {
      const mockInput: AutopilotInput = {
        projectId: 'test-project',
        lastSnapshot: {
          policy: { rules: [] },
          drift: {
            overallDriftScore: 0.6, // Above threshold
            stabilityIndex: 0.45,
            classification: 'volatile',
            signals: []
          },
          futures: {
            projectId: 'test-project',
            simulations: [],
            aggregate: {
              volatilityIndex: 0.5, // Above threshold
              mostProbableNarrative: 'High volatility detected',
              worstCaseNarrative: 'System instability likely',
              bestCaseNarrative: 'Moderate issues possible',
              riskLevel: 'volatile'
            }
          },
          federated: {
            similarityMatrix: {
              projectIds: ['test-project'],
              values: [[1.0]]
            },
            clusters: [{ clusterId: 'cluster_0', members: ['test-project'] }],
            outliers: [],
            consensus: {
              baselineRules: [],
              similarityWeightedRules: [],
              driftWeightedRules: []
            },
            influenceGraph: [],
            systemStabilityScore: 0.4, // High divergence (0.6)
            narrativeSummary: 'Moderate stability concerns'
          },
          reviewVerdicts: []
        },
        timestamps: {
          now: '2025-01-01T12:00:00Z',
          lastCheck: '2025-01-01T11:00:00Z'
        },
        config: {
          thresholds: {
            volatility: 0.45,
            drift: 0.5,
            divergence: 0.6
          },
          taskEmission: {
            enable: true,
            minIntervalMinutes: 30
          }
        }
      };

      const result = autopilot.runCycle(mockInput);

      // Should generate recommendations for all issues
      const driftRecommendation = result.recommendedActions.find(
        action => action.type === 'drift-investigation'
      );
      expect(driftRecommendation).toBeDefined();

      const reviewRecommendation = result.recommendedActions.find(
        action => action.type === 'policy-review'
      );
      expect(reviewRecommendation).toBeDefined();

      const federatedRecommendation = result.recommendedActions.find(
        action => action.type === 'federated-sync'
      );
      expect(federatedRecommendation).toBeDefined();
    });
  });

  describe('generateNarrative', () => {
    // This is implicitly tested through the runCycle method
    it('should generate meaningful narrative regardless of input', () => {
      const mockInput: AutopilotInput = {
        projectId: 'test-project',
        lastSnapshot: {
          policy: { rules: [] },
          drift: {
            overallDriftScore: 0.1,
            stabilityIndex: 0.95,
            classification: 'stable',
            signals: []
          },
          futures: {
            projectId: 'test-project',
            simulations: [],
            aggregate: {
              volatilityIndex: 0.1,
              mostProbableNarrative: 'Stable operation expected',
              worstCaseNarrative: 'Minor issues possible',
              bestCaseNarrative: 'Optimal performance',
              riskLevel: 'stable'
            }
          },
          federated: {
            similarityMatrix: {
              projectIds: ['test-project'],
              values: [[1.0]]
            },
            clusters: [{ clusterId: 'cluster_0', members: ['test-project'] }],
            outliers: [],
            consensus: {
              baselineRules: [],
              similarityWeightedRules: [],
              driftWeightedRules: []
            },
            influenceGraph: [],
            systemStabilityScore: 0.95,
            narrativeSummary: 'System stable'
          },
          reviewVerdicts: []
        },
        timestamps: {
          now: '2025-01-01T12:00:00Z',
          lastCheck: '2025-01-01T11:00:00Z'
        },
        config: {
          thresholds: {
            volatility: 0.45,
            drift: 0.5,
            divergence: 0.6
          },
          taskEmission: {
            enable: true,
            minIntervalMinutes: 30
          }
        }
      };

      const result = autopilot.runCycle(mockInput);

      // Narrative should be a non-empty string
      expect(result.narrative).toBeDefined();
      expect(typeof result.narrative).toBe('string');
      expect(result.narrative.length).toBeGreaterThan(0);
    });
  });
});