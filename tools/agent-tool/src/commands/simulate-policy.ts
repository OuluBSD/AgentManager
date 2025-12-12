import fs from 'fs-extra';
import path from 'path';
import { CounterfactualInput, CounterfactualPolicySimulator } from '../policy/counterfactual';

interface SimulatePolicyResult {
  status: 'ok' | 'error';
  result?: any;
  error?: string;
}

export const simulatePolicyCommand = {
  command: 'simulate-policy',
  describe: 'Run counterfactual policy simulation to compare original vs alternate policy',
  builder: (yargs: any) => {
    return yargs
      .option('artifact-dir', {
        describe: 'Directory containing policy artifacts and traces',
        demandOption: true,
        type: 'string',
      })
      .option('alternate', {
        describe: 'Path to alternate policy file',
        demandOption: true,
        type: 'string',
      })
      .option('output', {
        describe: 'File to write JSON output (optional, defaults to stdout)',
        type: 'string',
      });
  },
  handler: async (argv: any) => {
    const { 'artifact-dir': artifactDir, alternate, output } = argv;

    try {
      const result = await runPolicySimulation(artifactDir, alternate);

      // Write the result - we only want to save the actual counterfactual result, not the status wrapper
      const outputStr = JSON.stringify(result, null, 2);
      const cfResultStr = JSON.stringify(result.result, null, 2);  // Just the counterfactual result

      if (output) {
        // Ensure the policy-counterfactual directory exists
        const cfDir = path.join(artifactDir, 'policy-counterfactual');
        fs.ensureDirSync(cfDir);

        // Generate filename with timestamp
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const cfFilePath = path.join(cfDir, `cf-${timestamp}.json`);
        fs.writeFileSync(cfFilePath, cfResultStr);  // Save just the counterfactual result

        console.log(`Counterfactual simulation result written to ${cfFilePath}`);
      } else {
        console.log(outputStr);
      }

      // Exit codes:
      // 0 = no contradictions
      // 1 = contradictions detected
      // 2 = simulator failure
      if (result.status === 'error') {
        process.exit(2); // simulator failure
      } else if (result.result && result.result.summary && result.result.summary.contradictions > 0) {
        process.exit(1); // contradictions detected
      } else {
        process.exit(0); // no contradictions
      }
    } catch (error: any) {
      console.error('Error during policy simulation:', error.message);
      process.exit(2); // simulator failure
    }
  },
};

async function runPolicySimulation(artifactDir: string, alternatePolicyPath: string): Promise<SimulatePolicyResult> {
  // Validate artifact directory exists
  if (!fs.existsSync(artifactDir)) {
    return {
      status: 'error',
      error: 'Artifact directory does not exist'
    };
  }

  // Validate alternate policy file exists
  if (!fs.existsSync(alternatePolicyPath)) {
    return {
      status: 'error',
      error: 'Alternate policy file does not exist'
    };
  }

  // Load the alternate policy
  let alternatePolicy: any;
  try {
    alternatePolicy = fs.readJsonSync(alternatePolicyPath);
  } catch (error) {
    return {
      status: 'error',
      error: `Could not read alternate policy file: ${(error as Error).message}`
    };
  }

  // Load the original policy (try different possible locations)
  let originalPolicy: any = {};
  const policyFileNames = ['policy.json', 'policy.yaml', 'policies.json', 'policy-snapshot.json'];
  for (const fileName of policyFileNames) {
    const policyPath = path.join(artifactDir, fileName);
    if (fs.existsSync(policyPath)) {
      try {
        originalPolicy = fs.readJsonSync(policyPath);
        break;
      } catch (error) {
        console.warn(`Could not read policy from ${policyPath}:`, error);
      }
    }
  }

  // Load policy traces
  let policyTraces: any[] = [];
  
  // First, check for a specific counterfactual input file
  const counterfactualInputPath = path.join(artifactDir, 'counterfactual-input.json');
  if (fs.existsSync(counterfactualInputPath)) {
    try {
      const input: CounterfactualInput = fs.readJsonSync(counterfactualInputPath);
      policyTraces = input.policyTraces || [];
    } catch (error) {
      console.warn('Could not read counterfactual input file:', error);
    }
  }

  // If traces not found in input file, look for them in various locations
  if (policyTraces.length === 0) {
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
            policyTraces = policyTraces.concat(traceData);
          } else if (traceData.traces) {
            policyTraces = policyTraces.concat(traceData.traces);
          } else if (traceData.policyTraces) {
            policyTraces = policyTraces.concat(traceData.policyTraces);
          } else {
            policyTraces.push(traceData);
          }
        } catch (error) {
          console.warn(`Could not read trace file ${traceFile}:`, error);
        }
      }
    }
  }

  // If still no traces, look for them in the main artifact directory or subdirectories
  if (policyTraces.length === 0) {
    const files = fs.readdirSync(artifactDir);
    for (const file of files) {
      if (file.endsWith('.json') && (file.includes('trace') || file.includes('policy'))) {
        try {
          const tracePath = path.join(artifactDir, file);
          const traceData = fs.readJsonSync(tracePath);
          if (Array.isArray(traceData)) {
            policyTraces = policyTraces.concat(traceData);
          } else if (traceData.traces) {
            policyTraces = policyTraces.concat(traceData.traces);
          } else if (traceData.policyTraces) {
            policyTraces = policyTraces.concat(traceData.policyTraces);
          } else {
            policyTraces.push(traceData);
          }
        } catch (error) {
          continue; // Try the next file
        }
      }
    }
  }

  // If still no traces, check step directories
  if (policyTraces.length === 0) {
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
              policyTraces = policyTraces.concat(traceData);
            } else if (traceData.traces) {
              policyTraces = policyTraces.concat(traceData.traces);
            } else if (traceData.policyTraces) {
              policyTraces = policyTraces.concat(traceData.policyTraces);
            } else {
              policyTraces.push(traceData);
            }
          } catch (error) {
            continue; // Try the next step directory
          }
        }
      }
    }
  }

  if (policyTraces.length === 0) {
    return {
      status: 'error',
      error: 'No policy traces found in artifact directory'
    };
  }

  // Prepare the counterfactual simulation input
  const input: CounterfactualInput = {
    originalPolicy,
    alternatePolicy,
    policyTraces,
    context: {
      projectId: 'unknown-project', // This would be derived from artifact metadata
      sessionIds: [], // This would be derived from artifact metadata
      timeframe: { 
        start: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(), // Last 24 hours as default
        end: new Date().toISOString() 
      }
    }
  };

  // Run the counterfactual simulation
  try {
    const simulator = new CounterfactualPolicySimulator();
    const result = simulator.runSimulation(input);

    return {
      status: 'ok',
      result
    };
  } catch (error) {
    return {
      status: 'error',
      error: `Simulation failed: ${(error as Error).message}`
    };
  }
}