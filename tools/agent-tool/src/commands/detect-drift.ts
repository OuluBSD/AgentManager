import { PolicyDriftEngine, DriftAnalysisInput, PolicyDriftAnalysis } from '../policy/drift';
import { PolicyTrace } from '../policy/trace';
import { PolicyRecommendation } from '../policy/inference';
import { PolicyReviewVerdict } from '../policy/review';
import fs from 'fs-extra';
import path from 'path';

interface DriftDetectionResult {
  status: 'ok' | 'error' | 'volatile' | 'critical';
  analysis: PolicyDriftAnalysis | null;
  error?: string;
}

export const detectDriftCommand = {
  command: 'detect-drift',
  describe: 'Detect policy drift and temporal instability in agent behavior',
  builder: (yargs: any) => {
    return yargs
      .option('artifact-dir', {
        describe: 'Directory containing policy artifacts',
        demandOption: true,
        type: 'string',
      })
      .option('window', {
        describe: 'Time window for analysis (e.g., 30m, 24h, 7d)',
        type: 'string',
        default: '24h'
      })
      .option('output', {
        describe: 'File to write JSON output (optional, defaults to stdout)',
        type: 'string',
      });
  },
  handler: async (argv: any) => {
    const { 'artifact-dir': artifactDir, window, output } = argv;

    try {
      const result = await runDriftDetection(artifactDir, window);
      
      // Determine exit code based on classification
      let exitCode = 0; // stable/watch
      if (result.status === 'volatile') exitCode = 1;
      if (result.status === 'critical') exitCode = 2;
      if (result.status === 'error') exitCode = 3;
      
      // Write the result
      const outputStr = JSON.stringify(result, null, 2);
      
      if (output) {
        // Ensure the policy-drift directory exists
        const driftDir = path.join(artifactDir, 'policy-drift');
        fs.ensureDirSync(driftDir);
        
        // Generate filename with timestamp
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const driftFilePath = path.join(driftDir, `drift-${timestamp}.json`);
        fs.writeFileSync(driftFilePath, outputStr);
        
        console.log(`Policy drift analysis written to ${driftFilePath}`);
      } else {
        console.log(outputStr);
      }
      
      process.exit(exitCode);
    } catch (error: any) {
      console.error('Error during drift detection:', error.message);
      process.exit(1);
    }
  },
};

async function runDriftDetection(artifactDir: string, window: string): Promise<DriftDetectionResult> {
  // Validate artifact directory exists
  if (!fs.existsSync(artifactDir)) {
    return {
      status: 'error',
      analysis: null,
      error: `Artifact directory does not exist: ${artifactDir}`
    };
  }

  // Parse the time window
  const timeWindow = parseTimeWindow(window);
  
  // Load policy traces
  const traces: PolicyTrace[] = [];
  const policyTraceDir = path.join(artifactDir, 'policy-trace');
  if (fs.existsSync(policyTraceDir)) {
    const traceFiles = fs.readdirSync(policyTraceDir).filter(file => 
      file.startsWith('trace-') && file.endsWith('.json')
    );
    
    for (const traceFile of traceFiles) {
      try {
        const tracePath = path.join(policyTraceDir, traceFile);
        const traceData = fs.readJsonSync(tracePath);
        traces.push(traceData);
      } catch (error) {
        console.warn(`Could not read trace file ${traceFile}:`, error);
        continue;
      }
    }
  }

  // Load policy recommendations (from inference results)
  let recommendations: PolicyRecommendation[] = [];
  const inferenceResultPath = path.join(artifactDir, 'policy-inference-result.json');
  if (fs.existsSync(inferenceResultPath)) {
    try {
      const inferenceData = fs.readJsonSync(inferenceResultPath);
      recommendations = inferenceData.recommendations || [];
    } catch (error) {
      console.warn('Could not read inference results:', error);
    }
  }
  
  // Also check for inference files in other possible locations
  if (recommendations.length === 0) {
    const files = fs.readdirSync(artifactDir);
    for (const file of files) {
      if (file.includes('inference') && file.endsWith('.json')) {
        try {
          const possiblePath = path.join(artifactDir, file);
          const inferenceData = fs.readJsonSync(possiblePath);
          recommendations = inferenceData.recommendations || [];
          break;
        } catch (error) {
          continue;
        }
      }
    }
  }

  // Load policy review verdicts
  let reviews: PolicyReviewVerdict[] = [];
  const reviewDir = path.join(artifactDir, 'policy-review');
  if (fs.existsSync(reviewDir)) {
    const reviewFiles = fs.readdirSync(reviewDir).filter(file => 
      file.startsWith('review-') && file.endsWith('.json')
    );
    
    if (reviewFiles.length > 0) {
      // Just load the most recent review file for now
      const sortedFiles = reviewFiles.sort((a, b) => b.localeCompare(a)); // Descending sort
      const latestReviewFile = sortedFiles[0];
      const reviewPath = path.join(reviewDir, latestReviewFile);
      
      try {
        const reviewData = fs.readJsonSync(reviewPath);
        reviews = reviewData.verdicts || [];
      } catch (error) {
        console.warn(`Could not read review file ${latestReviewFile}:`, error);
      }
    }
  }

  // Load policy snapshot
  let policySnapshot: any = {};
  const policyFiles = ['policy.json', 'policy.yaml', 'policies.json'];
  for (const policyFile of policyFiles) {
    const policyPath = path.join(artifactDir, policyFile);
    if (fs.existsSync(policyPath)) {
      try {
        policySnapshot = fs.readJsonSync(policyPath);
        break;
      } catch (error) {
        console.warn(`Could not read policy file ${policyFile}:`, error);
      }
    }
  }

  // Prepare the input for the drift analysis
  const input: DriftAnalysisInput = {
    traces,
    recommendations,
    reviews,
    policySnapshot,
    timeWindow
  };

  // Run the drift analysis
  const engine = new PolicyDriftEngine();
  const analysis = await engine.analyzeDrift(input);
  
  // Determine status based on classification
  let status: 'ok' | 'error' | 'volatile' | 'critical' = 'ok';
  if (analysis.classification === 'volatile') status = 'volatile';
  if (analysis.classification === 'critical') status = 'critical';

  return {
    status,
    analysis
  };
}

function parseTimeWindow(window: string): { from: number; to: number } {
  // Parse the time window string (e.g., "24h", "30m", "7d")
  const match = window.match(/^(\d+)([mhd])$/);
  if (!match) {
    throw new Error(`Invalid time window format: ${window}. Use format like '30m', '24h', or '7d'`);
  }

  const value = parseInt(match[1], 10);
  const unit = match[2];
  
  // Calculate the time range
  const now = Date.now();
  let from: number;
  
  switch (unit) {
    case 'm': // minutes
      from = now - (value * 60 * 1000);
      break;
    case 'h': // hours
      from = now - (value * 60 * 60 * 1000);
      break;
    case 'd': // days
      from = now - (value * 24 * 60 * 60 * 1000);
      break;
    default:
      throw new Error(`Unsupported time unit: ${unit}. Use 'm', 'h', or 'd'`);
  }

  return { from, to: now };
}