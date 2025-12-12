import * as fs from 'fs-extra';
import * as path from 'path';
import { spawn } from 'child_process';
import { PolicyTrace } from '../../src/policy/trace';

// Helper function to create a temporary directory for testing
function createTempDir(): string {
  const tempDir = path.join(__dirname, '../temp', `test-${Date.now()}-${Math.random().toString(36).substring(2)}`);
  fs.ensureDirSync(tempDir);
  return tempDir;
}

describe('simulate-policy CLI Command Integration Tests', () => {
  let tempDir: string;
  let artifactDir: string;
  let alternatePolicyPath: string;

  beforeEach(() => {
    tempDir = createTempDir();
    artifactDir = path.join(tempDir, 'artifacts');
    fs.ensureDirSync(artifactDir);
    
    // Create an alternate policy file
    alternatePolicyPath = path.join(tempDir, 'alternate-policy.json');
    fs.writeJsonSync(alternatePolicyPath, {
      commands: [
        {
          id: 'test-command-rule',
          pattern: 'ls',
          mode: 'deny',
          priority: 100
        }
      ],
      defaultCommandBehavior: 'allow'
    });
  });

  afterEach(() => {
    // Clean up temp directory after each test
    if (fs.existsSync(tempDir)) {
      fs.removeSync(tempDir);
    }
  });

  it('should run simulation and create output file', (done) => {
    // Create an original policy file
    const policyPath = path.join(artifactDir, 'policy.json');
    fs.writeJsonSync(policyPath, {
      commands: [
        {
          id: 'test-command-rule',
          pattern: 'ls',
          mode: 'allow',
          priority: 100
        }
      ],
      defaultCommandBehavior: 'allow'
    });

    // Create a policy trace file
    const traceDir = path.join(artifactDir, 'policy-trace');
    fs.ensureDirSync(traceDir);
    
    const trace: PolicyTrace = {
      actionId: 'test-action-1',
      actionType: 'run-command',
      timestamp: '2023-01-01T00:00:00Z',
      evaluatedRules: [
        {
          ruleId: 'test-command-rule',
          matched: true,
          matchReason: 'Command "ls" matches test pattern',
          priority: 100,
          effect: 'allow'
        }
      ],
      finalDecision: 'allow',
      finalRuleId: 'test-command-rule',
      summaryForAI: 'Action allowed based on policy evaluation',
      summaryForHuman: 'Action was allowed. Rule test-command-rule with mode allow was applied.'
    };
    
    const tracePath = path.join(traceDir, 'trace-1.json');
    fs.writeJsonSync(tracePath, trace);

    // Run the CLI command
    const cliPath = path.join(__dirname, '../../tools/agent-tool/dist/index.js');
    const args = [
      'simulate-policy',
      '--artifact-dir', artifactDir,
      '--alternate', alternatePolicyPath,
      '--output', path.join(artifactDir, 'output.json')
    ];

    const child = spawn('node', [cliPath, ...args], { cwd: path.join(__dirname, '../../') });

    let stdout = '';
    let stderr = '';

    child.stdout.on('data', (data) => {
      stdout += data.toString();
    });

    child.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    child.on('close', (code) => {
      try {
        // Check that the process exited successfully
        expect(code).toBe(1); // Should return 1 because we have a contradiction (ALLOW -> DENY)

        // Check that the output file was created
        const outputFiles = fs.readdirSync(path.join(artifactDir, 'policy-counterfactual'));
        expect(outputFiles.length).toBeGreaterThan(0);
        expect(outputFiles[0]).toMatch(/^cf-.*\.json$/);

        // Check the content of the output file
        const outputFilePath = path.join(artifactDir, 'policy-counterfactual', outputFiles[0]);
        const outputData = fs.readJsonSync(outputFilePath);
        
        expect(outputData.projectId).toBe('unknown-project'); // Default value
        expect(outputData.summary.contradictions).toBeGreaterThanOrEqual(0);
        expect(outputData.actions.length).toBe(1);
        expect(outputData.actions[0].actionId).toBe('test-action-1');
        expect(outputData.actions[0].originalDecision).toBe('ALLOW');
        expect(outputData.narrativeSummary).toContain('Counterfactual Policy Simulation Results');

        done();
      } catch (error) {
        done(error);
      }
    });
  });

  it('should handle missing artifact directory', (done) => {
    const fakeArtifactDir = path.join(tempDir, 'non-existent-dir');
    const cliPath = path.join(__dirname, '../../tools/agent-tool/dist/index.js');
    const args = [
      'simulate-policy',
      '--artifact-dir', fakeArtifactDir,
      '--alternate', alternatePolicyPath,
      '--output', path.join(tempDir, 'output.json')
    ];

    const child = spawn('node', [cliPath, ...args], { cwd: path.join(__dirname, '../../') });

    let stderr = '';

    child.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    child.on('close', (code) => {
      try {
        // Should exit with code 2 for simulator failure
        expect(code).toBe(2);
        expect(stderr).toContain('Artifact directory does not exist');

        done();
      } catch (error) {
        done(error);
      }
    });
  });

  it('should handle missing alternate policy file', (done) => {
    const fakeAlternatePolicy = path.join(tempDir, 'non-existent-policy.json');
    const cliPath = path.join(__dirname, '../../tools/agent-tool/dist/index.js');
    const args = [
      'simulate-policy',
      '--artifact-dir', artifactDir,
      '--alternate', fakeAlternatePolicy,
      '--output', path.join(tempDir, 'output.json')
    ];

    const child = spawn('node', [cliPath, ...args], { cwd: path.join(__dirname, '../../') });

    let stderr = '';

    child.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    child.on('close', (code) => {
      try {
        // Should exit with code 2 for simulator failure
        expect(code).toBe(2);
        expect(stderr).toContain('Alternate policy file does not exist');

        done();
      } catch (error) {
        done(error);
      }
    });
  });

  it('should handle missing policy traces', (done) => {
    // Create an original policy file but no traces
    const policyPath = path.join(artifactDir, 'policy.json');
    fs.writeJsonSync(policyPath, {
      commands: [
        {
          id: 'test-command-rule',
          pattern: 'ls',
          mode: 'allow',
          priority: 100
        }
      ],
      defaultCommandBehavior: 'allow'
    });

    const cliPath = path.join(__dirname, '../../tools/agent-tool/dist/index.js');
    const args = [
      'simulate-policy',
      '--artifact-dir', artifactDir,
      '--alternate', alternatePolicyPath,
      '--output', path.join(tempDir, 'output.json')
    ];

    const child = spawn('node', [cliPath, ...args], { cwd: path.join(__dirname, '../../') });

    let stderr = '';

    child.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    child.on('close', (code) => {
      try {
        // Should exit with code 2 for simulator failure
        expect(code).toBe(2);
        expect(stderr).toContain('No policy traces found in artifact directory');

        done();
      } catch (error) {
        done(error);
      }
    });
  });

  it('should return exit code 0 when no contradictions are found', (done) => {
    // Create an original policy file
    const policyPath = path.join(artifactDir, 'policy.json');
    fs.writeJsonSync(policyPath, {
      commands: [
        {
          id: 'test-command-rule',
          pattern: 'ls',
          mode: 'allow',
          priority: 100
        }
      ],
      defaultCommandBehavior: 'allow'
    });

    // Create a policy trace file where both policies have same outcome
    const traceDir = path.join(artifactDir, 'policy-trace');
    fs.ensureDirSync(traceDir);
    
    const trace: PolicyTrace = {
      actionId: 'test-action-1',
      actionType: 'run-command',
      timestamp: '2023-01-01T00:00:00Z',
      evaluatedRules: [
        {
          ruleId: 'test-command-rule',
          matched: true,
          matchReason: 'Command "ls" matches test pattern',
          priority: 100,
          effect: 'allow'
        }
      ],
      finalDecision: 'allow',
      finalRuleId: 'test-command-rule',
      summaryForAI: 'Action allowed based on policy evaluation',
      summaryForHuman: 'Action was allowed. Rule test-command-rule with mode allow was applied.'
    };
    
    const tracePath = path.join(traceDir, 'trace-1.json');
    fs.writeJsonSync(tracePath, trace);

    // Update alternate policy to also allow (same as original)
    fs.writeJsonSync(alternatePolicyPath, {
      commands: [
        {
          id: 'test-command-rule',
          pattern: 'ls',
          mode: 'allow',
          priority: 100
        }
      ],
      defaultCommandBehavior: 'allow'
    });

    // Run the CLI command
    const cliPath = path.join(__dirname, '../../tools/agent-tool/dist/index.js');
    const args = [
      'simulate-policy',
      '--artifact-dir', artifactDir,
      '--alternate', alternatePolicyPath,
      '--output', path.join(artifactDir, 'output.json')
    ];

    const child = spawn('node', [cliPath, ...args], { cwd: path.join(__dirname, '../../') });

    let stdout = '';
    let stderr = '';

    child.stdout.on('data', (data) => {
      stdout += data.toString();
    });

    child.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    child.on('close', (code) => {
      try {
        // Should return 0 because no contradictions (all decisions same)
        expect(code).toBe(0);

        // Check that the output file was created
        const outputFiles = fs.readdirSync(path.join(artifactDir, 'policy-counterfactual'));
        expect(outputFiles.length).toBeGreaterThan(0);

        // Check the content of the output file
        const outputFilePath = path.join(artifactDir, 'policy-counterfactual', outputFiles[0]);
        const outputData = fs.readJsonSync(outputFilePath);
        
        expect(outputData.summary.contradictions).toBe(0);
        expect(outputData.summary.unchanged).toBe(1);

        done();
      } catch (error) {
        done(error);
      }
    });
  });
});