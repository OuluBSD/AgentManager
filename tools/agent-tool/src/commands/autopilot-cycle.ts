import fs from 'fs-extra';
import path from 'path';
import { GovernanceAutopilot, AutopilotInput } from '../policy/autopilot';
import { PolicyDriftAnalysis } from '../policy/drift';
import { PolicyFuturesResult } from '../policy/futures';
import { FederatedPolicyHealth } from '../policy/federated';
import { PolicyReviewResult } from '../policy/review';

interface AutopilotCycleResult {
  status: 'ok' | 'error';
  result?: any;
  error?: string;
}

export const autopilotCycleCommand = {
  command: 'autopilot-cycle',
  describe: 'Run a governance autopilot cycle to analyze system state and recommend actions',
  builder: (yargs: any) => {
    return yargs
      .option('artifact-dir', {
        describe: 'Directory containing governance artifacts and traces',
        demandOption: true,
        type: 'string',
      })
      .option('project-id', {
        describe: 'ID of the project to analyze',
        demandOption: true,
        type: 'string',
      })
      .option('output', {
        describe: 'File to write JSON output (optional, defaults to stdout)',
        type: 'string',
      });
  },
  handler: async (argv: any) => {
    const { 'artifact-dir': artifactDir, 'project-id': projectId, output } = argv;

    try {
      const result = await runAutopilotCycle(artifactDir, projectId);

      // Write the result
      const outputStr = JSON.stringify(result, null, 2);

      if (output) {
        // Ensure the policy-autopilot directory exists
        const autopilotDir = path.join(artifactDir, 'policy-autopilot');
        fs.ensureDirSync(autopilotDir);

        // Generate filename with timestamp
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const autopilotFilePath = path.join(autopilotDir, `cycle-${timestamp}.json`);
        fs.writeFileSync(autopilotFilePath, outputStr);

        console.log(`Policy autopilot cycle result written to ${autopilotFilePath}`);
      } else {
        console.log(outputStr);
      }

      // Exit codes:
      // 0 = stable or elevated
      // 1 = volatile
      // 2 = critical
      if (result.status === 'error') {
        process.exit(2); // autopilot failure
      } else if (result.result && result.result.risk) {
        switch (result.result.risk.globalRisk) {
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
        process.exit(2); // autopilot failure
      }
    } catch (error: any) {
      console.error('Error during autopilot cycle:', error.message);
      process.exit(2); // autopilot failure
    }
  },
};

async function runAutopilotCycle(artifactDir: string, projectId: string): Promise<AutopilotCycleResult> {
  try {
    // Load the policy snapshot
    let policy: any = {};
    const policyFileNames = [
      'policy.json', 'policy.yaml', 'policies.json', 'policy-snapshot.json',
      'policy-current.json', 'policy-latest.json'
    ];

    for (const fileName of policyFileNames) {
      const policyPath = path.join(artifactDir, fileName);
      if (fs.existsSync(policyPath)) {
        try {
          policy = fs.readJsonSync(policyPath);
          break;
        } catch (error) {
          console.warn(`Could not read policy from ${policyPath}:`, error);
        }
      }
    }

    // Load drift analysis
    let drift: PolicyDriftAnalysis | undefined;
    const driftDir = path.join(artifactDir, 'policy-drift');
    if (fs.existsSync(driftDir)) {
      const driftFiles = fs.readdirSync(driftDir).filter(file =>
        file.startsWith('drift-') && file.endsWith('.json')
      );

      // Get the most recent drift file
      if (driftFiles.length > 0) {
        driftFiles.sort().reverse(); // Sort to get most recent first
        const driftPath = path.join(driftDir, driftFiles[0]!);
        try {
          drift = fs.readJsonSync(driftPath);
        } catch (error) {
          console.warn(`Could not read drift file ${driftFiles[0]}:`, error);
        }
      }
    }

    // Load futures result
    let futures: PolicyFuturesResult | undefined;
    const futuresDir = path.join(artifactDir, 'policy-futures');
    if (fs.existsSync(futuresDir)) {
      const futuresFiles = fs.readdirSync(futuresDir).filter(file =>
        file.startsWith('future-') && file.endsWith('.json')
      );

      // Get the most recent futures file
      if (futuresFiles.length > 0) {
        futuresFiles.sort().reverse(); // Sort to get most recent first
        const futuresPath = path.join(futuresDir, futuresFiles[0]!);
        try {
          futures = fs.readJsonSync(futuresPath);
        } catch (error) {
          console.warn(`Could not read futures file ${futuresFiles[0]}:`, error);
        }
      }
    }

    // Load federated policy health
    let federated: FederatedPolicyHealth | undefined;
    const federatedDir = path.join(artifactDir, 'federated-policy');
    if (fs.existsSync(federatedDir)) {
      const federatedFiles = fs.readdirSync(federatedDir).filter(file =>
        file.startsWith('federated-') && file.endsWith('.json')
      );

      // Get the most recent federated file
      if (federatedFiles.length > 0) {
        federatedFiles.sort().reverse(); // Sort to get most recent first
        const federatedPath = path.join(federatedDir, federatedFiles[0]!);
        try {
          federated = fs.readJsonSync(federatedPath);
        } catch (error) {
          console.warn(`Could not read federated file ${federatedFiles[0]}:`, error);
        }
      }
    }

    // Load review results
    let reviewVerdicts: any[] | undefined = [];
    const reviewDir = path.join(artifactDir, 'policy-review');
    if (fs.existsSync(reviewDir)) {
      const reviewFiles = fs.readdirSync(reviewDir).filter(file =>
        file.startsWith('review-') && file.endsWith('.json')
      );

      for (const reviewFile of reviewFiles) {
        try {
          const reviewPath = path.join(reviewDir, reviewFile);
          const reviewData = fs.readJsonSync(reviewPath);
          if (Array.isArray(reviewData)) {
            reviewVerdicts = reviewVerdicts!.concat(reviewData);
          } else if (reviewData.verdicts) {
            reviewVerdicts = reviewVerdicts!.concat(reviewData.verdicts);
          } else {
            reviewVerdicts!.push(reviewData);
          }
        } catch (error) {
          console.warn(`Could not read review file ${reviewFile}:`, error);
        }
      }
    }

    // Create autopilot input
    const input: AutopilotInput = {
      projectId,
      lastSnapshot: {
        policy,
        drift,
        futures,
        federated,
        reviewVerdicts
      },
      timestamps: {
        now: new Date().toISOString(),
        lastCheck: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString() // 24 hours ago
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

    // Run the autopilot cycle
    try {
      const autopilot = new GovernanceAutopilot();
      const output = autopilot.runCycle(input);

      return {
        status: 'ok',
        result: output
      };
    } catch (error) {
      return {
        status: 'error',
        error: `Autopilot cycle failed: ${(error as Error).message}`
      };
    }
  } catch (error) {
    return {
      status: 'error',
      error: `Failed to load artifacts: ${(error as Error).message}`
    };
  }
}