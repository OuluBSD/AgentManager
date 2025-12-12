import fs from 'fs-extra';
import path from 'path';
import { RunbookPlanner, RunbookInput } from '../policy/runbook';
import { PolicyDriftAnalysis } from '../policy/drift';
import { PolicyFuturesResult } from '../policy/futures';
import { FederatedPolicyHealth } from '../policy/federated';
import { PolicyTrace } from '../policy/trace';
import { PolicyReviewResult } from '../policy/review';
import { AutopilotOutput } from '../policy/autopilot';

interface RunbookResult {
  status: 'ok' | 'error';
  result?: any;
  error?: string;
}

export const makeRunbookCommand = {
  command: 'make-runbook',
  describe: 'Generate an operational runbook from governance signals',
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
      const result = await runMakeRunbook(artifactDir, projectId);

      // Write the result
      const outputStr = JSON.stringify(result, null, 2);

      if (output) {
        // Ensure the policy-runbook directory exists
        const runbookDir = path.join(artifactDir, 'policy-runbook');
        fs.ensureDirSync(runbookDir);

        // Generate filename with timestamp
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const runbookFilePath = path.join(runbookDir, `runbook-${timestamp}.json`);
        fs.writeFileSync(runbookFilePath, outputStr);

        console.log(`Policy runbook result written to ${runbookFilePath}`);
      } else {
        console.log(outputStr);
      }

      // Exit codes:
      // 0 = low/medium
      // 1 = high
      // 2 = critical
      if (result.status === 'error') {
        process.exit(2); // error in runbook creation
      } else if (result.result && result.result.severity) {
        switch (result.result.severity) {
          case 'critical':
            process.exit(2); // critical severity
            break;
          case 'high':
            process.exit(1); // high severity
            break;
          case 'medium':
          case 'low':
          default:
            process.exit(0); // low/medium (treated as OK)
            break;
        }
      } else {
        process.exit(2); // error in runbook creation
      }
    } catch (error: any) {
      console.error('Error during runbook generation:', error.message);
      process.exit(2); // error in runbook generation
    }
  },
};

async function runMakeRunbook(artifactDir: string, projectId: string): Promise<RunbookResult> {
  try {
    // Load the autopilot result
    let autopilot: AutopilotOutput | undefined;
    const autopilotDir = path.join(artifactDir, 'policy-autopilot');
    if (fs.existsSync(autopilotDir)) {
      const autopilotFiles = fs.readdirSync(autopilotDir).filter(file =>
        file.startsWith('cycle-') && file.endsWith('.json')
      );

      // Get the most recent autopilot file
      if (autopilotFiles.length > 0) {
        autopilotFiles.sort().reverse(); // Sort to get most recent first
        const autopilotPath = path.join(autopilotDir, autopilotFiles[0]!);
        try {
          const autopilotData = fs.readJsonSync(autopilotPath);
          autopilot = autopilotData.result || autopilotData;
        } catch (error) {
          console.warn(`Could not read autopilot file ${autopilotFiles[0]}:`, error);
        }
      }
    }

    // If no autopilot data exists, try to create it
    if (!autopilot) {
      // Load the basic policy for generating autopilot input
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

      // Simulate creating an autopilot output since we couldn't load one
      autopilot = {
        projectId,
        cycleId: `cycle-${projectId}-${Date.now()}`,
        risk: {
          globalRisk: "stable",
          reasons: ["No existing autopilot data found, defaulting to stable"],
          metrics: {}
        },
        recommendedActions: [],
        narrative: "Initial run with no historical data"
      };
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

    // Load recent policy traces
    let recentTraces: PolicyTrace[] = [];
    const traceDir = path.join(artifactDir, 'policy-trace');
    if (fs.existsSync(traceDir)) {
      const traceFiles = fs.readdirSync(traceDir).filter(file =>
        file.startsWith('trace-') && file.endsWith('.json')
      );

      // Get the most recent trace files (up to 20 to avoid memory issues)
      traceFiles.sort().reverse();
      const recentTraceFiles = traceFiles.slice(0, 20);

      for (const traceFile of recentTraceFiles) {
        try {
          const tracePath = path.join(traceDir, traceFile);
          const traceData = fs.readJsonSync(tracePath);
          recentTraces.push(traceData);
        } catch (error) {
          console.warn(`Could not read trace file ${traceFile}:`, error);
        }
      }
    }

    // Load recent review results
    let recentReviews: PolicyReviewResult[] = [];
    const reviewDir = path.join(artifactDir, 'policy-review');
    if (fs.existsSync(reviewDir)) {
      const reviewFiles = fs.readdirSync(reviewDir).filter(file =>
        file.startsWith('review-') && file.endsWith('.json')
      );

      // Get the most recent review files (up to 10 to avoid memory issues)
      reviewFiles.sort().reverse();
      const recentReviewFiles = reviewFiles.slice(0, 10);

      for (const reviewFile of recentReviewFiles) {
        try {
          const reviewPath = path.join(reviewDir, reviewFile);
          const reviewData = fs.readJsonSync(reviewPath);
          recentReviews.push(reviewData);
        } catch (error) {
          console.warn(`Could not read review file ${reviewFile}:`, error);
        }
      }
    }

    // Create runbook input
    const input: RunbookInput = {
      projectId,
      autopilot,
      drift,
      futures,
      federated,
      recentTraces,
      recentReviews,
      timestamps: {
        now: new Date().toISOString(),
      }
    };

    // Generate the runbook
    try {
      const runbookPlanner = new RunbookPlanner();
      const output = runbookPlanner.generate(input);

      return {
        status: 'ok',
        result: output
      };
    } catch (error) {
      return {
        status: 'error',
        error: `Runbook generation failed: ${(error as Error).message}`
      };
    }
  } catch (error) {
    return {
      status: 'error',
      error: `Failed to load artifacts: ${(error as Error).message}`
    };
  }
}