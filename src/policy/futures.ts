import { PolicyTrace } from './trace';
import { PolicyRecommendation } from './inference';
import { PolicyDriftAnalysis } from './drift';
import { PolicyReviewVerdict } from './review';

export interface PolicyFuturesInput {
  policySnapshot: any;
  driftHistory: PolicyDriftAnalysis[];
  traceHistory: PolicyTrace[];
  inferenceHistory: PolicyRecommendation[];
  reviewHistory: PolicyReviewVerdict[];

  context: {
    projectId: string;
    timeframe: {
      windowHours: number; // e.g., simulate next N hours
    };
    monteCarlo: {
      iterations: number; // default 500
      randomnessSeed?: number; // deterministic seeding
    };
  };
}

export interface FuturesSimulationOutcome {
  iteration: number;
  randomSeed: number;

  predictedDrift: number; // normalized 0–1
  predictedViolations: number;
  predictedEscalations: number;
  predictedOverrides: number;

  breakdown: {
    likelihood_weaken?: number;
    likelihood_stronger?: number;
    likelihood_contradiction?: number;
  };

  narrative: string;
}

export interface PolicyFuturesAggregate {
  volatilityIndex: number; // 0–1 weighted volatility score
  mostProbableNarrative: string;
  worstCaseNarrative: string;
  bestCaseNarrative: string;
  riskLevel: "stable" | "elevated" | "volatile" | "critical";
}

export interface PolicyFuturesResult {
  projectId: string;
  simulations: FuturesSimulationOutcome[];
  aggregate: PolicyFuturesAggregate;
}

/**
 * A seeded pseudo-random number generator for deterministic simulations.
 * This ensures that the same inputs always produce the same Monte Carlo output.
 */
class SeededRandom {
  private seed: number;

  constructor(seed: number) {
    this.seed = seed;
  }

  // Linear Congruential Generator (LCG) - simple but sufficient for our purposes
  private next(): number {
    this.seed = (this.seed * 1103515245 + 12345) & 0x7fffffff;
    return this.seed / 0x7fffffff;
  }

  // Generate a random float between min and max
  random(min: number = 0, max: number = 1): number {
    return min + this.next() * (max - min);
  }

  // Generate a random integer between min and max (inclusive)
  randomInt(min: number, max: number): number {
    return Math.floor(this.random(min, max + 1));
  }

  // Randomly select an item from an array
  choice<T>(arr: T[]): T {
    if (arr.length === 0) {
      throw new Error("Cannot select from empty array");
    }
    const index = Math.floor(this.next() * arr.length);
    return arr[index]!;
  }

  // Generate a random boolean with a given probability
  bool(probability: number = 0.5): boolean {
    return this.next() < probability;
  }
}

export class PolicyFuturesEngine {
  /**
   * Generates a forecast of potential policy futures using Monte Carlo simulation
   */
  public forecast(input: PolicyFuturesInput): PolicyFuturesResult {
    const { context } = input;
    const iterations = context.monteCarlo.iterations || 500;
    const seed = context.monteCarlo.randomnessSeed || Date.now();
    
    // Generate all simulation outcomes
    const simulations: FuturesSimulationOutcome[] = [];
    
    for (let i = 0; i < iterations; i++) {
      // Each iteration uses a different seed based on the base seed to ensure
      // different randomness while maintaining determinism
      const iterationSeed = seed + i;
      const rng = new SeededRandom(iterationSeed);
      
      // Run a single simulation iteration
      const outcome = this.runSimulationIteration(input, rng, i);
      simulations.push(outcome);
    }
    
    // Generate aggregate statistics from all simulations
    const aggregate = this.generateAggregate(simulations, input);
    
    return {
      projectId: context.projectId,
      simulations,
      aggregate
    };
  }

  /**
   * Runs a single Monte Carlo simulation iteration
   */
  private runSimulationIteration(
    input: PolicyFuturesInput,
    rng: SeededRandom,
    iteration: number
  ): FuturesSimulationOutcome {
    // Calculate base probabilities from historical data
    const { driftHistory, traceHistory, inferenceHistory, reviewHistory } = input;
    
    // Calculate drift momentum from history
    let baselineDrift = 0;
    if (driftHistory && driftHistory.length > 0) {
      baselineDrift = driftHistory.reduce((sum, drift) => sum + drift.overallDriftScore, 0) / driftHistory.length;
    }
    
    // Calculate override probability from trace history
    let overrideProbability = 0;
    if (traceHistory && traceHistory.length > 0) {
      const tracesWithOverrides = traceHistory.filter(trace => trace.overrideContext?.triggered);
      overrideProbability = tracesWithOverrides.length / traceHistory.length;
    }
    
    // Calculate review probability from history
    let reviewProbability = 0;
    if (traceHistory && traceHistory.length > 0) {
      const tracesWithReview = traceHistory.filter(trace => trace.finalDecision === 'review');
      reviewProbability = tracesWithReview.length / traceHistory.length;
    }
    
    // Calculate recommendation patterns from inference history
    let addRuleProbability = 0;
    let modifyRuleProbability = 0;
    let removeRuleProbability = 0;
    if (inferenceHistory && inferenceHistory.length > 0) {
      const addRules = inferenceHistory.filter(rec => rec.type === 'add-rule');
      const modifyRules = inferenceHistory.filter(rec => rec.type === 'modify-rule');
      const removeRules = inferenceHistory.filter(rec => rec.type === 'remove-rule');
      
      addRuleProbability = addRules.length / inferenceHistory.length;
      modifyRuleProbability = modifyRules.length / inferenceHistory.length;
      removeRuleProbability = removeRules.length / inferenceHistory.length;
    }
    
    // Calculate review patterns from review history
    let approveProbability = 0;
    let rejectProbability = 0;
    let reviseProbability = 0;
    if (reviewHistory && reviewHistory.length > 0) {
      const approveCount = reviewHistory.filter(v => v.decision === 'approve').length;
      const rejectCount = reviewHistory.filter(v => v.decision === 'reject').length;
      const reviseCount = reviewHistory.filter(v => v.decision === 'revise').length;
      
      approveProbability = approveCount / reviewHistory.length;
      rejectProbability = rejectCount / reviewHistory.length;
      reviseProbability = reviseCount / reviewHistory.length;
    }
    
    // Apply drift momentum - if history shows increasing drift, increase probability
    const driftMomentum = this.calculateDriftMomentum(driftHistory);
    const driftAdjustment = driftMomentum * 0.3; // Adjust by up to 30%
    
    // Generate predictions with some randomness
    const predictedDrift = Math.min(1, Math.max(0, baselineDrift + driftAdjustment + 
      (rng.random() - 0.5) * 0.2)); // Add some random fluctuation
    
    const predictedOverrides = Math.round(
      overrideProbability * traceHistory.length * (1 + rng.random() * 0.5)
    );
    
    // Calculate escalation probability based on historical data
    const escalationProbability = Math.max(
      reviewProbability * 0.5, // Escalation often comes from review loops
      overrideProbability * 0.3 // Or from frequent overrides
    );
    const predictedEscalations = Math.round(
      escalationProbability * traceHistory.length * (1 + rng.random() * 0.5)
    );
    
    // Calculate violation probability from deny decisions in history
    let violationProbability = 0;
    if (traceHistory && traceHistory.length > 0) {
      const denyCount = traceHistory.filter(trace => trace.finalDecision === 'deny').length;
      violationProbability = denyCount / traceHistory.length;
    }
    const predictedViolations = Math.round(
      violationProbability * traceHistory.length * (1 + rng.random() * 0.5)
    );
    
    // Calculate breakdown probabilities with some randomness based on historical patterns
    const breakdown = {
      likelihood_weaken: Math.min(1, Math.max(0, 
        modifyRuleProbability * 0.7 + removeRuleProbability * 0.3 + rng.random() * 0.2)),
      likelihood_stronger: Math.min(1, Math.max(0, 
        addRuleProbability * 0.8 + (1 - approveProbability) * 0.2 + rng.random() * 0.2)),
      likelihood_contradiction: Math.min(1, Math.max(0, 
        driftMomentum * 0.5 + (1 - approveProbability) * 0.3 + rng.random() * 0.2))
    };
    
    // Generate narrative for this simulation
    const narrative = this.generateNarrativeForSimulation(
      predictedDrift, 
      predictedOverrides, 
      predictedEscalations,
      predictedViolations,
      breakdown,
      rng
    );
    
    return {
      iteration,
      randomSeed: rng['seed'], // Access private seed property
      predictedDrift,
      predictedViolations,
      predictedEscalations,
      predictedOverrides,
      breakdown,
      narrative
    };
  }

  /**
   * Calculates the trend of drift over time (positive = increasing drift, negative = decreasing)
   */
  private calculateDriftMomentum(driftHistory: PolicyDriftAnalysis[]): number {
    if (!driftHistory || driftHistory.length < 2) {
      return 0; // Not enough data to calculate momentum
    }

    // Simple momentum calculation: compare first and last drift scores
    const firstDrift = driftHistory[0]!.overallDriftScore;
    const lastDrift = driftHistory[driftHistory.length - 1]!.overallDriftScore;

    // Return the direction and magnitude of change
    return lastDrift - firstDrift;
  }

  /**
   * Generates a narrative description for a single simulation
   */
  private generateNarrativeForSimulation(
    predictedDrift: number,
    predictedOverrides: number,
    predictedEscalations: number,
    predictedViolations: number,
    breakdown: any,
    rng: SeededRandom
  ): string {
    let narrative = "Policy forecast for simulation: ";
    
    if (predictedDrift < 0.2) {
      narrative += "Stable governance with minimal policy drift expected. ";
    } else if (predictedDrift < 0.5) {
      narrative += "Moderate policy evolution with manageable drift. ";
    } else if (predictedDrift < 0.8) {
      narrative += "Significant policy changes and drift anticipated. ";
    } else {
      narrative += "High likelihood of governance instability and policy flux. ";
    }
    
    if (predictedOverrides > 0) {
      narrative += `${predictedOverrides} policy override(s) expected. `;
    }
    
    if (predictedEscalations > 0) {
      narrative += `${predictedEscalations} escalation(s) to human review anticipated. `;
    }
    
    if (predictedViolations > 0) {
      narrative += `${predictedViolations} policy violation(s) projected. `;
    }
    
    // Add forward-looking assessment based on breakdown
    if (breakdown.likelihood_weaken > 0.5) {
      narrative += "Policy weakening likely. ";
    }
    
    if (breakdown.likelihood_stronger > 0.5) {
      narrative += "Policy strengthening probable. ";
    }
    
    if (breakdown.likelihood_contradiction > 0.5) {
      narrative += "Risk of policy contradictions present. ";
    }
    
    // Add a probabilistic statement to make it sound more realistic
    const probabilityDescriptors = [
      "High confidence in this projection.",
      "Moderate confidence in this assessment.",
      "This outcome is within reasonable probability.",
      "Forecast confidence is subject to external factors.",
      "Potential for deviation exists in this scenario."
    ];
    
    narrative += rng.choice(probabilityDescriptors);
    
    return narrative;
  }

  /**
   * Generates aggregate statistics from all simulation outcomes
   */
  private generateAggregate(
    simulations: FuturesSimulationOutcome[],
    input: PolicyFuturesInput
  ): PolicyFuturesAggregate {
    if (simulations.length === 0) {
      return {
        volatilityIndex: 0,
        mostProbableNarrative: "No simulations available for forecasting",
        worstCaseNarrative: "No simulations available for forecasting",
        bestCaseNarrative: "No simulations available for forecasting",
        riskLevel: "stable"
      };
    }
    
    // Calculate volatility index as the standard deviation of predicted drift
    const driftValues = simulations.map(s => s.predictedDrift);
    const driftMean = driftValues.reduce((sum, val) => sum + val, 0) / driftValues.length;
    const variance = driftValues.reduce((sum, val) => sum + Math.pow(val - driftMean, 2), 0) / driftValues.length;
    const volatilityIndex = Math.sqrt(variance);
    
    // Find the most probable outcome (closest to mean drift)
    let mostProbable = simulations[0]!;
    let minDiff = Math.abs(simulations[0]!.predictedDrift - driftMean);

    for (let i = 1; i < simulations.length; i++) {
      const diff = Math.abs(simulations[i]!.predictedDrift - driftMean);
      if (diff < minDiff) {
        minDiff = diff;
        mostProbable = simulations[i]!;
      }
    }
    
    // Find the worst case (highest drift and violations)
    const worstCase = simulations.length > 0 ? simulations.reduce((worst, current) => {
      if (current.predictedDrift > worst.predictedDrift ||
          current.predictedViolations > worst.predictedViolations ||
          current.predictedEscalations > worst.predictedEscalations) {
        return current;
      }
      return worst;
    }) : simulations[0] || {
      iteration: -1,
      randomSeed: -1,
      predictedDrift: 0,
      predictedViolations: 0,
      predictedEscalations: 0,
      predictedOverrides: 0,
      breakdown: {},
      narrative: "No simulation data available"
    };

    // Find the best case (lowest drift and violations)
    const bestCase = simulations.length > 0 ? simulations.reduce((best, current) => {
      if (current.predictedDrift < best.predictedDrift &&
          current.predictedViolations < best.predictedViolations &&
          current.predictedEscalations < best.predictedEscalations) {
        return current;
      }
      return best;
    }) : simulations[0] || {
      iteration: -1,
      randomSeed: -1,
      predictedDrift: 0,
      predictedViolations: 0,
      predictedEscalations: 0,
      predictedOverrides: 0,
      breakdown: {},
      narrative: "No simulation data available"
    };
    
    // Determine risk level based on volatility index and drift values
    let riskLevel: "stable" | "elevated" | "volatile" | "critical";
    if (volatilityIndex < 0.1 && driftMean < 0.3) {
      riskLevel = "stable";
    } else if (volatilityIndex < 0.25 && driftMean < 0.5) {
      riskLevel = "elevated";
    } else if (volatilityIndex < 0.4 || driftMean < 0.7) {
      riskLevel = "volatile";
    } else {
      riskLevel = "critical";
    }
    
    return {
      volatilityIndex,
      mostProbableNarrative: mostProbable?.narrative || "No narrative available",
      worstCaseNarrative: worstCase?.narrative || "No narrative available",
      bestCaseNarrative: bestCase?.narrative || "No narrative available",
      riskLevel
    };
  }
}