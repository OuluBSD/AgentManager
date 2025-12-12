import { RunbookPlanner, RunbookInput, RunbookOutput } from '../../src/policy/runbook';
import { AutopilotOutput } from '../../src/policy/autopilot';
import { PolicyDriftAnalysis } from '../../src/policy/drift';
import { PolicyFuturesResult } from '../../src/policy/futures';
import { FederatedPolicyHealth } from '../../src/policy/federated';
import { PolicyTrace } from '../../src/policy/trace';
import { PolicyReviewResult } from '../../src/policy/review';

describe('RunbookPlanner', () => {
  let runbookPlanner: RunbookPlanner;

  beforeEach(() => {
    runbookPlanner = new RunbookPlanner();
  });

  describe('generate', () => {
    it('should generate a runbook with low severity for stable inputs', () => {
      const autopilot: AutopilotOutput = {
        projectId: 'test-project',
        cycleId: 'cycle-1',
        risk: {
          globalRisk: 'stable',
          reasons: ['System operating within normal parameters'],
          metrics: {}
        },
        recommendedActions: [],
        narrative: 'System is stable'
      };

      const input: RunbookInput = {
        projectId: 'test-project',
        autopilot,
        timestamps: { now: new Date().toISOString() }
      };

      const result: RunbookOutput = runbookPlanner.generate(input);

      expect(result).toBeDefined();
      expect(result.projectId).toBe('test-project');
      expect(result.severity).toBe('low');
      expect(result.steps).toBeDefined();
      expect(result.steps.length).toBeGreaterThan(0);
      expect(result.narrative).toContain('test-project');
    });

    it('should generate a runbook with high severity for volatile inputs', () => {
      const autopilot: AutopilotOutput = {
        projectId: 'test-project',
        cycleId: 'cycle-1',
        risk: {
          globalRisk: 'volatile',
          reasons: ['High policy volatility detected'],
          metrics: { volatility: 0.7 }
        },
        recommendedActions: [],
        narrative: 'System is volatile'
      };

      const input: RunbookInput = {
        projectId: 'test-project',
        autopilot,
        timestamps: { now: new Date().toISOString() }
      };

      const result: RunbookOutput = runbookPlanner.generate(input);

      expect(result).toBeDefined();
      expect(result.projectId).toBe('test-project');
      expect(result.severity).toBe('high');
      expect(result.steps).toBeDefined();
      expect(result.steps.length).toBeGreaterThan(0);
    });

    it('should generate drift investigation runbook when drift score is high', () => {
      const autopilot: AutopilotOutput = {
        projectId: 'test-project',
        cycleId: 'cycle-1',
        risk: {
          globalRisk: 'elevated',
          reasons: ['Significant policy drift detected'],
          metrics: { drift: 0.8 }
        },
        recommendedActions: [],
        narrative: 'System has elevated risk'
      };

      const drift: PolicyDriftAnalysis = {
        signals: [],
        overallDriftScore: 0.8,
        stabilityIndex: 0.2,
        classification: 'volatile',
        narrativeSummary: 'High drift detected'
      };

      const input: RunbookInput = {
        projectId: 'test-project',
        autopilot,
        drift,
        timestamps: { now: new Date().toISOString() }
      };

      const result: RunbookOutput = runbookPlanner.generate(input);

      expect(result).toBeDefined();
      expect(result.severity).toBe('medium');
      expect(result.steps).toBeDefined();
      
      // Check if at least one step is related to drift investigation
      const driftSteps = result.steps.filter(step => 
        step.title.includes('Inspect Policy Traces') || 
        step.title.includes('Generate Policy Diffs') ||
        step.title.includes('Identify Oscillating Rules') ||
        step.title.includes('Suggest Stabilization Edits')
      );
      
      expect(driftSteps.length).toBeGreaterThan(0);
    });

    it('should generate volatility mitigation runbook when volatility is high', () => {
      const autopilot: AutopilotOutput = {
        projectId: 'test-project',
        cycleId: 'cycle-1',
        risk: {
          globalRisk: 'volatile',
          reasons: ['High policy volatility detected'],
          metrics: { volatility: 0.8 }
        },
        recommendedActions: [],
        narrative: 'System is volatile'
      };

      const futures: PolicyFuturesResult = {
        projectId: 'test-project',
        simulations: [],
        aggregate: {
          volatilityIndex: 0.8,
          mostProbableNarrative: 'High volatility expected',
          worstCaseNarrative: 'Worst case scenario',
          bestCaseNarrative: 'Best case scenario',
          riskLevel: 'volatile'
        }
      };

      const input: RunbookInput = {
        projectId: 'test-project',
        autopilot,
        futures,
        timestamps: { now: new Date().toISOString() }
      };

      const result: RunbookOutput = runbookPlanner.generate(input);

      expect(result).toBeDefined();
      expect(result.severity).toBe('high');
      expect(result.steps).toBeDefined();
      
      // Check if at least one step is related to volatility mitigation
      const volatilitySteps = result.steps.filter(step => 
        step.title.includes('Freeze Risky Policy Areas') || 
        step.title.includes('Add Temporary Guardrails') ||
        step.title.includes('Increase Review Frequency')
      );
      
      expect(volatilitySteps.length).toBeGreaterThan(0);
    });

    it('should generate federated sync runbook when federated divergence is high', () => {
      const autopilot: AutopilotOutput = {
        projectId: 'test-project',
        cycleId: 'cycle-1',
        risk: {
          globalRisk: 'volatile',
          reasons: ['High federated divergence detected'],
          metrics: { divergence: 0.8 }
        },
        recommendedActions: [],
        narrative: 'System has federated divergence'
      };

      const federated: FederatedPolicyHealth = {
        similarityMatrix: { projectIds: [], values: [] },
        clusters: [],
        outliers: [],
        consensus: { baselineRules: [], similarityWeightedRules: [], driftWeightedRules: [] },
        influenceGraph: [],
        systemStabilityScore: 0.2,
        narrativeSummary: 'Low stability detected'
      };

      const input: RunbookInput = {
        projectId: 'test-project',
        autopilot,
        federated,
        timestamps: { now: new Date().toISOString() }
      };

      const result: RunbookOutput = runbookPlanner.generate(input);

      expect(result).toBeDefined();
      expect(result.severity).toBe('high');
      expect(result.steps).toBeDefined();
      
      // Check if at least one step is related to federated sync
      const federatedSteps = result.steps.filter(step => 
        step.title.includes('Compare Cluster Centroids') || 
        step.title.includes('Generate Alignment Steps') ||
        step.title.includes('Propose Rule Normalization Tasks')
      );
      
      expect(federatedSteps.length).toBeGreaterThan(0);
    });

    it('should generate contradiction resolution runbook when contradictions are present', () => {
      const autopilot: AutopilotOutput = {
        projectId: 'test-project',
        cycleId: 'cycle-1',
        risk: {
          globalRisk: 'elevated',
          reasons: ['Contradictions detected'],
          metrics: {}
        },
        recommendedActions: [],
        narrative: 'System has contradictions'
      };

      const recentReviews: PolicyReviewResult[] = [{
        verdicts: [],
        overallAssessment: 'Reviews complete',
        governanceFlags: ['contradiction-detected']
      }];

      const input: RunbookInput = {
        projectId: 'test-project',
        autopilot,
        recentReviews,
        timestamps: { now: new Date().toISOString() }
      };

      const result: RunbookOutput = runbookPlanner.generate(input);

      expect(result).toBeDefined();
      expect(result.severity).toBe('medium');
      expect(result.steps).toBeDefined();
      
      // Check if at least one step is related to contradiction resolution
      const contradictionSteps = result.steps.filter(step => 
        step.title.includes('Gather Contradictory Traces') || 
        step.title.includes('Show Trace Pairs') ||
        step.title.includes('Suggest Contradiction Resolution Methods')
      );
      
      expect(contradictionSteps.length).toBeGreaterThan(0);
    });

    it('should generate critical state runbook when risk is critical', () => {
      const autopilot: AutopilotOutput = {
        projectId: 'test-project',
        cycleId: 'cycle-1',
        risk: {
          globalRisk: 'critical',
          reasons: ['Critical risk detected'],
          metrics: {}
        },
        recommendedActions: [],
        narrative: 'System is in critical state'
      };

      const input: RunbookInput = {
        projectId: 'test-project',
        autopilot,
        timestamps: { now: new Date().toISOString() }
      };

      const result: RunbookOutput = runbookPlanner.generate(input);

      expect(result).toBeDefined();
      expect(result.severity).toBe('critical');
      expect(result.steps).toBeDefined();
      
      // Check if at least one step is related to critical state
      const criticalSteps = result.steps.filter(step => 
        step.title.includes('Execute Emergency Steps') || 
        step.title.includes('Forced Policy Snapshot') ||
        step.title.includes('Mandatory Human Escalation') ||
        step.title.includes('System Lockdown Suggestions')
      );
      
      expect(criticalSteps.length).toBeGreaterThan(0);
    });

    it('should have proper structure for each runbook step', () => {
      const autopilot: AutopilotOutput = {
        projectId: 'test-project',
        cycleId: 'cycle-1',
        risk: {
          globalRisk: 'stable',
          reasons: ['System operating within normal parameters'],
          metrics: {}
        },
        recommendedActions: [],
        narrative: 'System is stable'
      };

      const input: RunbookInput = {
        projectId: 'test-project',
        autopilot,
        timestamps: { now: new Date().toISOString() }
      };

      const result: RunbookOutput = runbookPlanner.generate(input);

      expect(result).toBeDefined();
      expect(result.steps).toBeDefined();

      for (const step of result.steps) {
        expect(step.id).toBeDefined();
        expect(step.title).toBeDefined();
        expect(step.description).toBeDefined();
        expect(Array.isArray(step.recommendedCommands)).toBe(true);
        expect(Array.isArray(step.expectedArtifacts)).toBe(true);
      }
    });
  });

  describe('generateDriftInvestigationRunbook', () => {
    it('should return appropriate steps for drift investigation', () => {
      const autopilot: AutopilotOutput = {
        projectId: 'test-project',
        cycleId: 'cycle-1',
        risk: {
          globalRisk: 'stable',
          reasons: ['System operating within normal parameters'],
          metrics: {}
        },
        recommendedActions: [],
        narrative: 'System is stable'
      };

      const input: RunbookInput = {
        projectId: 'test-project',
        autopilot,
        timestamps: { now: new Date().toISOString() }
      };

      // Access private method using any type to bypass TypeScript restrictions
      const steps = (runbookPlanner as any).generateDriftInvestigationRunbook(input);

      expect(steps).toBeDefined();
      expect(steps.length).toBeGreaterThan(0);

      expect(steps[0].title).toBe('Inspect Policy Traces');
      expect(steps[1].title).toBe('Generate Policy Diffs');
      expect(steps[2].title).toBe('Identify Oscillating Rules');
      expect(steps[3].title).toBe('Suggest Stabilization Edits');
    });
  });

  describe('generateVolatilityMitigationRunbook', () => {
    it('should return appropriate steps for volatility mitigation', () => {
      const autopilot: AutopilotOutput = {
        projectId: 'test-project',
        cycleId: 'cycle-1',
        risk: {
          globalRisk: 'stable',
          reasons: ['System operating within normal parameters'],
          metrics: {}
        },
        recommendedActions: [],
        narrative: 'System is stable'
      };

      const input: RunbookInput = {
        projectId: 'test-project',
        autopilot,
        timestamps: { now: new Date().toISOString() }
      };

      // Access private method using any type to bypass TypeScript restrictions
      const steps = (runbookPlanner as any).generateVolatilityMitigationRunbook(input);

      expect(steps).toBeDefined();
      expect(steps.length).toBeGreaterThan(0);

      expect(steps[0].title).toBe('Freeze Risky Policy Areas');
      expect(steps[1].title).toBe('Add Temporary Guardrails');
      expect(steps[2].title).toBe('Increase Review Frequency');
    });
  });

  describe('generateFederatedSyncRunbook', () => {
    it('should return appropriate steps for federated sync', () => {
      const autopilot: AutopilotOutput = {
        projectId: 'test-project',
        cycleId: 'cycle-1',
        risk: {
          globalRisk: 'stable',
          reasons: ['System operating within normal parameters'],
          metrics: {}
        },
        recommendedActions: [],
        narrative: 'System is stable'
      };

      const input: RunbookInput = {
        projectId: 'test-project',
        autopilot,
        timestamps: { now: new Date().toISOString() }
      };

      // Access private method using any type to bypass TypeScript restrictions
      const steps = (runbookPlanner as any).generateFederatedSyncRunbook(input);

      expect(steps).toBeDefined();
      expect(steps.length).toBeGreaterThan(0);

      expect(steps[0].title).toBe('Compare Cluster Centroids');
      expect(steps[1].title).toBe('Generate Alignment Steps');
      expect(steps[2].title).toBe('Propose Rule Normalization Tasks');
    });
  });

  describe('generateContradictionResolutionRunbook', () => {
    it('should return appropriate steps for contradiction resolution', () => {
      const autopilot: AutopilotOutput = {
        projectId: 'test-project',
        cycleId: 'cycle-1',
        risk: {
          globalRisk: 'stable',
          reasons: ['System operating within normal parameters'],
          metrics: {}
        },
        recommendedActions: [],
        narrative: 'System is stable'
      };

      const input: RunbookInput = {
        projectId: 'test-project',
        autopilot,
        timestamps: { now: new Date().toISOString() }
      };

      // Access private method using any type to bypass TypeScript restrictions
      const steps = (runbookPlanner as any).generateContradictionResolutionRunbook(input);

      expect(steps).toBeDefined();
      expect(steps.length).toBeGreaterThan(0);

      expect(steps[0].title).toBe('Gather Contradictory Traces');
      expect(steps[1].title).toBe('Show Trace Pairs');
      expect(steps[2].title).toBe('Suggest Contradiction Resolution Methods');
    });
  });

  describe('generateCriticalStateRunbook', () => {
    it('should return appropriate steps for critical state', () => {
      const autopilot: AutopilotOutput = {
        projectId: 'test-project',
        cycleId: 'cycle-1',
        risk: {
          globalRisk: 'stable',
          reasons: ['System operating within normal parameters'],
          metrics: {}
        },
        recommendedActions: [],
        narrative: 'System is stable'
      };

      const input: RunbookInput = {
        projectId: 'test-project',
        autopilot,
        timestamps: { now: new Date().toISOString() }
      };

      // Access private method using any type to bypass TypeScript restrictions
      const steps = (runbookPlanner as any).generateCriticalStateRunbook(input);

      expect(steps).toBeDefined();
      expect(steps.length).toBeGreaterThan(0);

      expect(steps[0].title).toBe('Execute Emergency Steps');
      expect(steps[1].title).toBe('Forced Policy Snapshot');
      expect(steps[2].title).toBe('Mandatory Human Escalation');
      expect(steps[3].title).toBe('System Lockdown Suggestions');
    });
  });
});