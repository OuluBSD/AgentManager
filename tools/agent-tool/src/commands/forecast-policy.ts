import fs from 'fs-extra';
import path from 'path';
import { PolicyFuturesEngine, PolicyFuturesInput } from '../policy/futures';
import { PolicyDriftAnalysis } from '../policy/drift';
import { PolicyTrace } from '../policy/trace';
import { PolicyRecommendation } from '../policy/inference';
import { PolicyReviewVerdict } from '../policy/review';

interface ForecastPolicyResult {
  status: 'ok' | 'error';
  result?: any;
  error?: string;
}

export const forecastPolicyCommand = {
  command: 'forecast-policy',
  describe: 'Run Monte Carlo simulation to forecast policy futures',
  builder: (yargs: any) => {
    return yargs
      .option('artifact-dir', {
        describe: 'Directory containing policy artifacts and traces',
        demandOption: true,
        type: 'string',
      })
      .option('iterations', {
        describe: 'Number of Monte Carlo iterations (default: 500)',
        type: 'number',
        default: 500,
      })
      .option('window-hours', {
        describe: 'Time window to simulate in hours (default: 4)',
        type: 'number',
        default: 4,
      })
      .option('output', {
        describe: 'File to write JSON output (optional, defaults to stdout)',
        type: 'string',
      });
  },
  handler: async (argv: any) => {
    const { 'artifact-dir': artifactDir, iterations, 'window-hours': windowHours, output } = argv;

    try {
      const result = await runPolicyForecast(artifactDir, iterations, windowHours);

      // Write the result - we only want to save the actual futures result, not the status wrapper
      const outputStr = JSON.stringify(result, null, 2);
      const futuresResultStr = JSON.stringify(result.result, null, 2);  // Just the futures result

      if (output) {
        // Ensure the policy-futures directory exists
        const futuresDir = path.join(artifactDir, 'policy-futures');
        fs.ensureDirSync(futuresDir);

        // Generate filename with timestamp
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const futuresFilePath = path.join(futuresDir, `future-${timestamp}.json`);
        fs.writeFileSync(futuresFilePath, futuresResultStr);  // Save just the futures result

        console.log(`Policy futures forecast result written to ${futuresFilePath}`);
      } else {
        console.log(outputStr);
      }

      // Exit codes:
      // 0 = stable or elevated
      // 1 = volatile
      // 2 = critical
      if (result.status === 'error') {
        process.exit(2); // simulator failure
      } else if (result.result && result.result.aggregate) {
        switch (result.result.aggregate.riskLevel) {
          case 'critical':
            process.exit(2); // critical risk
            break;
          case 'volatile':
            process.exit(1); // volatile risk
            break;
          case 'elevated':
          case 'stable':
          default:
            process.exit(0); // stable or elevated (treated as OK)
            break;
        }
      } else {
        process.exit(2); // simulator failure
      }
    } catch (error: any) {
      console.error('Error during policy forecast:', error.message);
      process.exit(2); // simulator failure
    }
  },
};

async function runPolicyForecast(artifactDir: string, iterations: number, windowHours: number): Promise<ForecastPolicyResult> {
  // Validate artifact directory exists
  if (!fs.existsSync(artifactDir)) {
    return {
      status: 'error',
      error: 'Artifact directory does not exist'
    };
  }

  // Load the policy snapshot (try different possible locations)
  let policySnapshot: any = {};
  const policyFileNames = [
    'policy.json', 'policy.yaml', 'policies.json', 'policy-snapshot.json', 
    'policy-current.json', 'policy-latest.json'
  ];
  
  for (const fileName of policyFileNames) {
    const policyPath = path.join(artifactDir, fileName);
    if (fs.existsSync(policyPath)) {
      try {
        policySnapshot = fs.readJsonSync(policyPath);
        break;
      } catch (error) {
        console.warn(`Could not read policy from ${policyPath}:`, error);
      }
    }
  }

  // If no policy snapshot was found, try to construct one from other sources
  if (Object.keys(policySnapshot).length === 0) {
    // Try to find policy configuration in session states or other files
    const files = fs.readdirSync(artifactDir);
    for (const file of files) {
      if (file.endsWith('.json') && file.includes('session')) {
        try {
          const sessionPath = path.join(artifactDir, file);
          const sessionData = fs.readJsonSync(sessionPath);
          if (sessionData.policy) {
            policySnapshot = sessionData.policy;
            break;
          }
        } catch (error) {
          continue;
        }
      }
    }
  }

  // Load drift history
  let driftHistory: PolicyDriftAnalysis[] = [];
  const driftDir = path.join(artifactDir, 'policy-drift');
  if (fs.existsSync(driftDir)) {
    const driftFiles = fs.readdirSync(driftDir).filter(file => 
      file.startsWith('drift-') && file.endsWith('.json')
    );

    for (const driftFile of driftFiles) {
      try {
        const driftPath = path.join(driftDir, driftFile);
        const driftData = fs.readJsonSync(driftPath);
        
        // The drift data might be structured differently, so let's handle various possibilities
        if (driftData.analysis) {
          driftHistory.push(driftData.analysis);
        } else if (Array.isArray(driftData)) {
          driftHistory = driftHistory.concat(driftData);
        } else {
          driftHistory.push(driftData);
        }
      } catch (error) {
        console.warn(`Could not read drift file ${driftFile}:`, error);
      }
    }
  }

  // Load trace history
  let traceHistory: PolicyTrace[] = [];
  
  // Look in policy-trace directory
  const traceDir = path.join(artifactDir, 'policy-trace');
  if (fs.existsSync(traceDir)) {
    const traceFiles = fs.readdirSync(traceDir).filter(file =>
      file.endsWith('.json') && (file.includes('trace') || file.includes('policy'))
    );

    for (const traceFile of traceFiles) {
      try {
        const tracePath = path.join(traceDir, traceFile);
        const traceData = fs.readJsonSync(tracePath);
        if (Array.isArray(traceData)) {
          traceHistory = traceHistory.concat(traceData);
        } else if (traceData.traces) {
          traceHistory = traceHistory.concat(traceData.traces);
        } else if (traceData.policyTraces) {
          traceHistory = traceHistory.concat(traceData.policyTraces);
        } else {
          traceHistory.push(traceData);
        }
      } catch (error) {
        console.warn(`Could not read trace file ${traceFile}:`, error);
      }
    }
  }

  // If still no traces, check step directories
  if (traceHistory.length === 0) {
    const stepsDir = path.join(artifactDir, 'steps');
    if (fs.existsSync(stepsDir)) {
      const stepDirs = fs.readdirSync(stepsDir).filter(item =>
        fs.statSync(path.join(stepsDir, item)).isDirectory()
      );

      for (const stepDir of stepDirs) {
        const stepTracePath = path.join(stepsDir, stepDir, 'policy-trace.json');
        if (fs.existsSync(stepTracePath)) {
          try {
            const traceData = fs.readJsonSync(stepTracePath);
            if (Array.isArray(traceData)) {
              traceHistory = traceHistory.concat(traceData);
            } else if (traceData.traces) {
              traceHistory = traceHistory.concat(traceData.traces);
            } else if (traceData.policyTraces) {
              traceHistory = traceHistory.concat(traceData.policyTraces);
            } else {
              traceHistory.push(traceData);
            }
          } catch (error) {
            continue; // Try the next step directory
          }
        }
      }
    }
  }

  // If still no traces, look for them in the main artifact directory or subdirectories
  if (traceHistory.length === 0) {
    const files = fs.readdirSync(artifactDir);
    for (const file of files) {
      if (file.endsWith('.json') && (file.includes('trace') || file.includes('policy'))) {
        try {
          const tracePath = path.join(artifactDir, file);
          const traceData = fs.readJsonSync(tracePath);
          if (Array.isArray(traceData)) {
            traceHistory = traceHistory.concat(traceData);
          } else if (traceData.traces) {
            traceHistory = traceHistory.concat(traceData.traces);
          } else if (traceData.policyTraces) {
            traceHistory = traceHistory.concat(traceData.policyTraces);
          } else {
            traceHistory.push(traceData);
          }
        } catch (error) {
          continue; // Try the next file
        }
      }
    }
  }

  // Load inference history (policy recommendations)
  let inferenceHistory: PolicyRecommendation[] = [];
  const inferenceDir = path.join(artifactDir, 'policy-inference');
  if (fs.existsSync(inferenceDir)) {
    const inferenceFiles = fs.readdirSync(inferenceDir).filter(file =>
      file.startsWith('inference-') && file.endsWith('.json')
    );

    for (const inferenceFile of inferenceFiles) {
      try {
        const inferencePath = path.join(inferenceDir, inferenceFile);
        const inferenceData = fs.readJsonSync(inferencePath);
        
        // Handle different formats of inference data
        if (inferenceData.recommendations) {
          inferenceHistory = inferenceHistory.concat(inferenceData.recommendations);
        } else if (Array.isArray(inferenceData)) {
          inferenceHistory = inferenceHistory.concat(inferenceData);
        } else {
          inferenceHistory.push(inferenceData);
        }
      } catch (error) {
        console.warn(`Could not read inference file ${inferenceFile}:`, error);
      }
    }
  }

  // Also try to load from any policy inference files in main artifact dir
  const allFiles = fs.readdirSync(artifactDir);
  for (const file of allFiles) {
    if (file.endsWith('.json') && (file.includes('inference') || file.includes('recommendation'))) {
      try {
        const inferencePath = path.join(artifactDir, file);
        const inferenceData = fs.readJsonSync(inferencePath);
        
        if (inferenceData.recommendations) {
          inferenceHistory = inferenceHistory.concat(inferenceData.recommendations);
        } else if (Array.isArray(inferenceData)) {
          inferenceHistory = inferenceHistory.concat(inferenceData);
        } else {
          inferenceHistory.push(inferenceData);
        }
      } catch (error) {
        continue; // Try the next file
      }
    }
  }

  // Load review history
  let reviewHistory: PolicyReviewVerdict[] = [];
  const reviewDir = path.join(artifactDir, 'policy-review');
  if (fs.existsSync(reviewDir)) {
    const reviewFiles = fs.readdirSync(reviewDir).filter(file =>
      file.startsWith('review-') && file.endsWith('.json')
    );

    for (const reviewFile of reviewFiles) {
      try {
        const reviewPath = path.join(reviewDir, reviewFile);
        const reviewData = fs.readJsonSync(reviewPath);
        
        // Handle different formats of review data
        if (reviewData.verdicts) {
          reviewHistory = reviewHistory.concat(reviewData.verdicts);
        } else if (Array.isArray(reviewData)) {
          reviewHistory = reviewHistory.concat(reviewData);
        } else {
          reviewHistory.push(reviewData);
        }
      } catch (error) {
        console.warn(`Could not read review file ${reviewFile}:`, error);
      }
    }
  }

  // Also try to load from any policy review files in main artifact dir
  for (const file of allFiles) {
    if (file.endsWith('.json') && file.includes('review')) {
      try {
        const reviewPath = path.join(artifactDir, file);
        const reviewData = fs.readJsonSync(reviewPath);
        
        if (reviewData.verdicts) {
          reviewHistory = reviewHistory.concat(reviewData.verdicts);
        } else if (Array.isArray(reviewData)) {
          reviewHistory = reviewHistory.concat(reviewData);
        } else {
          reviewHistory.push(reviewData);
        }
      } catch (error) {
        continue; // Try the next file
      }
    }
  }

  if (traceHistory.length === 0) {
    return {
      status: 'error',
      error: 'No policy traces found in artifact directory'
    };
  }

  // Prepare the futures input
  const input: PolicyFuturesInput = {
    policySnapshot,
    driftHistory,
    traceHistory,
    inferenceHistory,
    reviewHistory,
    context: {
      projectId: 'unknown-project', // This would be derived from artifact metadata
      timeframe: {
        windowHours
      },
      monteCarlo: {
        iterations,
        randomnessSeed: Date.now() // Use current timestamp as seed for some variation
      }
    }
  };

  // Run the futures simulation
  try {
    const engine = new PolicyFuturesEngine();
    const result = engine.forecast(input);

    return {
      status: 'ok',
      result
    };
  } catch (error) {
    return {
      status: 'error',
      error: `Forecasting failed: ${(error as Error).message}`
    };
  }
}