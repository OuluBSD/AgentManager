import { PolicyReviewEngine, PolicyReviewRequest } from '../policy/review';
import fs from 'fs-extra';
import path from 'path';
import { PolicyInferenceResult } from '../policy/inference';

interface ReviewPolicyResult {
  status: 'ok' | 'error';
  verdicts: any[];
  overallAssessment: string;
  governanceFlags: string[];
}

export const reviewPolicyCommand = {
  command: 'review-policy',
  describe: 'Review policy recommendations using AI and generate verdicts',
  builder: (yargs: any) => {
    return yargs
      .option('artifact-dir', {
        describe: 'Directory containing policy inference artifacts',
        demandOption: true,
        type: 'string',
      })
      .option('output', {
        describe: 'File to write JSON output (optional, defaults to stdout)',
        type: 'string',
      })
      .option('model', {
        describe: 'LLM model to use for review (e.g., qwen, claude, gpt)',
        type: 'string',
        default: 'deterministic' // Default to deterministic mode for now
      });
  },
  handler: async (argv: any) => {
    const { 'artifact-dir': artifactDir, output, model } = argv;

    try {
      const result = await runPolicyReview(artifactDir, model);
      
      // Write the result
      const outputStr = JSON.stringify(result, null, 2);
      
      if (output) {
        // Ensure the policy-review directory exists
        const reviewDir = path.join(artifactDir, 'policy-review');
        fs.ensureDirSync(reviewDir);
        
        // Generate filename with timestamp
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const reviewFilePath = path.join(reviewDir, `review-${timestamp}.json`);
        fs.writeFileSync(reviewFilePath, outputStr);
        
        console.log(`Policy review result written to ${reviewFilePath}`);
      } else {
        console.log(outputStr);
      }
      
      // Exit with non-zero if governance flags indicate contradictions
      if (result.status === 'ok' && result.governanceFlags && 
          result.governanceFlags.some(flag => 
            flag.includes('contradiction') || flag.includes('ai-review-failed'))) {
        process.exit(1);
      }
    } catch (error: any) {
      console.error('Error during policy review:', error.message);
      process.exit(1);
    }
  },
};

async function runPolicyReview(artifactDir: string, model: string): Promise<ReviewPolicyResult> {
  // Validate artifact directory exists
  if (!fs.existsSync(artifactDir)) {
    return {
      status: 'error',
      verdicts: [],
      overallAssessment: 'Artifact directory does not exist',
      governanceFlags: ['artifact-dir-not-found']
    };
  }

  // Look for policy inference results in the artifact directory
  const inferenceResultPath = path.join(artifactDir, 'policy-inference-result.json'); // or wherever it's stored
  
  // If policy inference result doesn't exist in root, look for infer-policy output files
  let inferenceResult: PolicyInferenceResult | null = null;
  
  if (fs.existsSync(inferenceResultPath)) {
    try {
      inferenceResult = fs.readJsonSync(inferenceResultPath);
    } catch (error) {
      console.warn('Could not read policy inference result from main file:', error);
    }
  }
  
  // If we didn't find it in the main location, look for it in possible other locations
  if (!inferenceResult) {
    // Look for files in the artifact directory that might contain inference results
    const files = fs.readdirSync(artifactDir);
    for (const file of files) {
      if (file.includes('inference') && file.endsWith('.json')) {
        try {
          const possiblePath = path.join(artifactDir, file);
          inferenceResult = fs.readJsonSync(possiblePath);
          break;
        } catch (error) {
          continue; // Try the next file
        }
      }
    }
  }

  // Also look for inference results in the steps directories
  if (!inferenceResult) {
    const stepsDir = path.join(artifactDir, 'steps');
    if (fs.existsSync(stepsDir)) {
      const stepDirs = fs.readdirSync(stepsDir).filter(item => 
        fs.statSync(path.join(stepsDir, item)).isDirectory()
      );
      
      // Look in the last step for possible inference results
      // Or process all steps to gather traces and run inference
      for (const stepDir of stepDirs) {
        // For this implementation, we'll look for traces to run inference on
      }
    }
  }

  if (!inferenceResult) {
    // If we still don't have inference results, try to run inference on any traces found
    const policyTraceDir = path.join(artifactDir, 'policy-trace');
    if (fs.existsSync(policyTraceDir)) {
      console.log('Found policy traces, but no inference result. This would normally trigger inference.');
      // In a full implementation, we would run inference here
      return {
        status: 'error',
        verdicts: [],
        overallAssessment: 'No inference results found, need to run inference first',
        governanceFlags: ['inference-results-missing']
      };
    } else {
      return {
        status: 'error',
        verdicts: [],
        overallAssessment: 'No policy inference results or traces found',
        governanceFlags: ['policy-data-missing']
      };
    }
  }

  // Load policy context (the current policy)
  let policyContext: any = {};
  try {
    const policyPath = path.join(artifactDir, 'policy-snapshot.json'); // or wherever policy snapshot is stored
    if (fs.existsSync(policyPath)) {
      policyContext = fs.readJsonSync(policyPath);
    } else {
      // Fallback: try to find policy files in common locations
      const policyFileNames = ['policy.json', 'policy.yaml', 'policies.json'];
      for (const fileName of policyFileNames) {
        const policyFilePath = path.join(artifactDir, fileName);
        if (fs.existsSync(policyFilePath)) {
          policyContext = fs.readJsonSync(policyFilePath);
          break;
        }
      }
    }
  } catch (error) {
    console.warn('Could not load policy context:', error);
    // Continue without policy context, as it's optional in some cases
  }

  // Prepare the review request
  const request: PolicyReviewRequest = {
    recommendations: inferenceResult.recommendations || [],
    policyContext,
    projectContext: {
      artifactDir,
      timestamp: new Date().toISOString()
    }
  };

  // Create the review engine
  // For now, we'll use the deterministic mode unless a real LLM client is provided
  const engine = new PolicyReviewEngine();

  // Run the review
  const result = await engine.reviewPolicies(request);

  return {
    status: 'ok',
    verdicts: result.verdicts,
    overallAssessment: result.overallAssessment,
    governanceFlags: result.governanceFlags
  };
}