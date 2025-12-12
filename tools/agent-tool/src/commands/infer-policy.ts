import { PolicyInferenceEngine } from '../policy/inference';
import fs from 'fs-extra';
import path from 'path';
import { PolicyTrace } from '../policy/trace';

interface InferPolicyResult {
  status: 'ok' | 'error';
  recommendations: any[];
  insights: string[];
  aiSummary: string;
  error?: string;
}

export const inferPolicyCommand = {
  command: 'infer-policy',
  describe: 'Analyze policy traces and generate policy recommendations',
  builder: (yargs: any) => {
    return yargs
      .option('artifact-dir', {
        describe: 'Directory containing policy trace artifacts',
        demandOption: true,
        type: 'string',
      })
      .option('output', {
        describe: 'File to write JSON output (optional, defaults to stdout)',
        type: 'string',
      });
  },
  handler: async (argv: any) => {
    const { 'artifact-dir': artifactDir, output } = argv;

    try {
      const result = await analyzePolicyTraces(artifactDir);
      
      // Output the result
      const outputStr = JSON.stringify(result, null, 2);
      
      if (output) {
        fs.writeFileSync(output, outputStr);
        console.log(`Policy inference result written to ${output}`);
      } else {
        console.log(outputStr);
      }
      
      // Exit with non-zero if no traces found or insufficient data
      if (result.status === 'error') {
        process.exit(1);
      }
    } catch (error: any) {
      console.error('Error during policy inference:', error.message);
      process.exit(1);
    }
  },
};

async function analyzePolicyTraces(artifactDir: string): Promise<InferPolicyResult> {
  // Validate artifact directory exists
  if (!fs.existsSync(artifactDir)) {
    return {
      status: 'error',
      recommendations: [],
      insights: [],
      aiSummary: 'Artifact directory does not exist',
      error: `Artifact directory not found: ${artifactDir}`
    };
  }

  // Look for policy trace files in the artifact directory
  const policyTraceDir = path.join(artifactDir, 'policy-trace');
  if (!fs.existsSync(policyTraceDir)) {
    return {
      status: 'error',
      recommendations: [],
      insights: [],
      aiSummary: 'No policy-trace directory found in artifact directory',
      error: 'No policy-trace directory found in artifact directory'
    };
  }

  // Read all policy trace JSON files
  const traceFiles = fs.readdirSync(policyTraceDir).filter(file => 
    file.startsWith('trace-') && file.endsWith('.json')
  );

  if (traceFiles.length === 0) {
    return {
      status: 'error',
      recommendations: [],
      insights: [],
      aiSummary: 'No policy trace files found in policy-trace directory',
      error: 'No policy trace files found in policy-trace directory'
    };
  }

  // Load all trace files
  const traces: PolicyTrace[] = [];
  for (const traceFile of traceFiles) {
    const tracePath = path.join(policyTraceDir, traceFile);
    try {
      const traceData = fs.readJsonSync(tracePath);
      traces.push(traceData);
    } catch (error) {
      console.warn(`Skipping invalid trace file: ${traceFile}`, error);
      continue;
    }
  }

  if (traces.length === 0) {
    return {
      status: 'error',
      recommendations: [],
      insights: [],
      aiSummary: 'No valid policy traces could be loaded',
      error: 'No valid policy traces could be loaded'
    };
  }

  // Run the inference engine
  const engine = new PolicyInferenceEngine();
  const result = await engine.inferPolicies({
    traces,
    metadata: {
      artifactDir,
      traceCount: traceFiles.length,
      analysisTimestamp: new Date().toISOString()
    }
  });

  return {
    status: 'ok',
    ...result
  };
}