import { spawn } from 'child_process';
import * as path from 'path';
import * as fs from 'fs-extra';
import * as os from 'os';
import * as tmp from 'tmp';

describe('forecast-policy CLI Integration', () => {
  let tempDir: string;
  let artifactDir: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'nexus-test-'));
    artifactDir = path.join(tempDir, 'artifact-dir');
    fs.ensureDirSync(artifactDir);
  });

  afterEach(() => {
    if (tempDir && fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it('should execute forecast-policy command and generate output file', (done) => {
    // Create test policy artifacts
    const policySnapshot = {
      commands: [
        { id: 'cmd-allow-all', pattern: '.*', mode: 'allow', priority: 100 }
      ]
    };
    fs.writeJsonSync(path.join(artifactDir, 'policy.json'), policySnapshot);

    // Create a sample trace
    const traceData = [
      {
        actionId: 'action-1',
        actionType: 'run-command',
        timestamp: new Date().toISOString(),
        evaluatedRules: [
          { ruleId: 'cmd-allow-all', matched: true, matchReason: 'Command matches pattern', priority: 100, effect: 'allow' }
        ],
        finalDecision: 'allow',
        finalRuleId: 'cmd-allow-all',
        summaryForAI: 'Command allowed based on policy evaluation',
        summaryForHuman: 'Command was allowed. Rule cmd-allow-all with mode allow was applied.'
      }
    ];
    const traceDir = path.join(artifactDir, 'policy-trace');
    fs.ensureDirSync(traceDir);
    fs.writeJsonSync(path.join(traceDir, 'trace-test.json'), traceData);

    // Create drift history
    const driftDir = path.join(artifactDir, 'policy-drift');
    fs.ensureDirSync(driftDir);
    fs.writeJsonSync(path.join(driftDir, 'drift-test.json'), {
      analysis: {
        signals: [],
        overallDriftScore: 0.1,
        stabilityIndex: 0.9,
        classification: 'stable',
        narrativeSummary: 'Policy appears stable with no significant drift signals.'
      }
    });

    // Create review history
    const reviewDir = path.join(artifactDir, 'policy-review');
    fs.ensureDirSync(reviewDir);
    fs.writeJsonSync(path.join(reviewDir, 'review-test.json'), {
      verdicts: [],
      overallAssessment: 'No recommendations provided for review',
      governanceFlags: []
    });

    // Run the CLI command
    const cliPath = path.join(__dirname, '../../tools/agent-tool/src/index.ts');
    const args = [
      cliPath,
      'forecast-policy',
      '--artifact-dir',
      artifactDir,
      '--iterations',
      '10',  // Use fewer iterations for faster tests
      '--window-hours',
      '4',
      '--output',
      path.join(artifactDir, 'output.json')
    ];

    const child = spawn('tsx', args, { stdio: 'pipe' });

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
        // The command should succeed (exit code 0 for stable result)
        expect(code).toBe(0);

        // Check that output was written to a file in the policy-futures directory
        const futuresDir = path.join(artifactDir, 'policy-futures');
        const futureFiles = fs.readdirSync(futuresDir).filter(f => f.startsWith('future-') && f.endsWith('.json'));
        expect(futureFiles.length).toBeGreaterThan(0);

        const futureFilePath = path.join(futuresDir, futureFiles[0]);
        const futureData = fs.readJsonSync(futureFilePath);

        // Validate the structure of the forecast result
        expect(futureData.projectId).toBeDefined();
        expect(Array.isArray(futureData.simulations)).toBe(true);
        expect(futureData.simulations.length).toBe(10); // 10 iterations
        expect(futureData.aggregate).toBeDefined();
        expect(futureData.aggregate.volatilityIndex).toBeDefined();
        expect(futureData.aggregate.riskLevel).toBeDefined();
        expect(['stable', 'elevated', 'volatile', 'critical']).toContain(futureData.aggregate.riskLevel);

        done();
      } catch (error) {
        done(error);
      }
    });
  });

  it('should return exit code 1 for volatile risk level', (done) => {
    // Create test policy artifacts that would indicate volatile risk
    const policySnapshot = {
      commands: [
        { id: 'cmd-restrictive', pattern: '.*', mode: 'deny', priority: 200 },
        { id: 'cmd-allow-all', pattern: '.*', mode: 'allow', priority: 100 }
      ]
    };
    fs.writeJsonSync(path.join(artifactDir, 'policy.json'), policySnapshot);

    // Create traces with many overrides (indicating volatile policy)
    const traceData = Array(20).fill(null).map((_, i) => ({
      actionId: `action-${i}`,
      actionType: 'run-command',
      timestamp: new Date().toISOString(),
      evaluatedRules: [
        { ruleId: 'cmd-restrictive', matched: true, matchReason: 'Command matches pattern', priority: 200, effect: 'deny' }
      ],
      overrideContext: {
        triggered: true,
        reason: 'User override for development'
      },
      finalDecision: 'allow',
      summaryForAI: 'Command allowed based on policy evaluation',
      summaryForHuman: 'Command was allowed via override.'
    }));
    const traceDir = path.join(artifactDir, 'policy-trace');
    fs.ensureDirSync(traceDir);
    fs.writeJsonSync(path.join(traceDir, 'trace-test.json'), traceData);

    // Create drift history with high drift
    const driftDir = path.join(artifactDir, 'policy-drift');
    fs.ensureDirSync(driftDir);
    fs.writeJsonSync(path.join(driftDir, 'drift-test.json'), {
      analysis: {
        signals: [
          {
            id: 'high-drift-signal',
            type: 'rule-churn',
            severity: 'high',
            confidence: 0.9,
            explanation: 'High rule churn detected'
          }
        ],
        overallDriftScore: 0.7,
        stabilityIndex: 0.3,
        classification: 'volatile',
        narrativeSummary: 'Policy shows volatile behavior with high drift signals.'
      }
    });

    // Run the CLI command
    const cliPath = path.join(__dirname, '../../tools/agent-tool/src/index.ts');
    const args = [
      cliPath,
      'forecast-policy',
      '--artifact-dir',
      artifactDir,
      '--iterations',
      '10',
      '--window-hours',
      '4'
    ];

    const child = spawn('tsx', args, { stdio: 'pipe' });

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
        // The command should return exit code 1 for volatile risk
        expect(code).toBe(1);
        done();
      } catch (error) {
        done(error);
      }
    });
  });

  it('should return exit code 2 for critical risk level', (done) => {
    // Create test policy artifacts that would indicate critical risk
    const policySnapshot = {
      commands: [
        { id: 'cmd-contradictory-1', pattern: '.*test.*', mode: 'allow', priority: 100 },
        { id: 'cmd-contradictory-2', pattern: '.*', mode: 'deny', priority: 90 }  // Lower priority but matches everything
      ]
    };
    fs.writeJsonSync(path.join(artifactDir, 'policy.json'), policySnapshot);

    // Create traces that indicate policy contradictions
    const traceData = Array(15).fill(null).map((_, i) => ({
      actionId: `action-${i}`,
      actionType: 'run-command',
      timestamp: new Date().toISOString(),
      evaluatedRules: [
        { ruleId: 'cmd-contradictory-1', matched: i % 2 === 0, matchReason: 'Command matches pattern', priority: 100, effect: 'allow' },
        { ruleId: 'cmd-contradictory-2', matched: true, matchReason: 'Command matches pattern', priority: 90, effect: 'deny' }
      ],
      finalDecision: i % 2 === 0 ? 'allow' : 'deny',
      summaryForAI: 'Command decision made based on policy evaluation',
      summaryForHuman: `Command was ${i % 2 === 0 ? 'allowed' : 'denied'}.`
    }));
    const traceDir = path.join(artifactDir, 'policy-trace');
    fs.ensureDirSync(traceDir);
    fs.writeJsonSync(path.join(traceDir, 'trace-test.json'), traceData);

    // Create drift history with critical drift
    const driftDir = path.join(artifactDir, 'policy-drift');
    fs.ensureDirSync(driftDir);
    fs.writeJsonSync(path.join(driftDir, 'drift-test.json'), {
      analysis: {
        signals: [
          {
            id: 'critical-drift-signal',
            type: 'flip-flop',
            severity: 'critical',
            confidence: 1.0,
            explanation: 'Critical policy flip-flopping detected'
          },
          {
            id: 'contradiction-signal',
            type: 'reviewer-disagreement',
            severity: 'critical',
            confidence: 0.95,
            explanation: 'High contradiction in policy decisions detected'
          }
        ],
        overallDriftScore: 0.9,
        stabilityIndex: 0.1,
        classification: 'critical',
        narrativeSummary: 'Policy shows critical instability with high contradiction signals.'
      }
    });

    // Run the CLI command
    const cliPath = path.join(__dirname, '../../tools/agent-tool/src/index.ts');
    const args = [
      cliPath,
      'forecast-policy',
      '--artifact-dir',
      artifactDir,
      '--iterations',
      '10',
      '--window-hours',
      '4'
    ];

    const child = spawn('tsx', args, { stdio: 'pipe' });

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
        // The command should return exit code 2 for critical risk
        expect(code).toBe(2);
        done();
      } catch (error) {
        done(error);
      }
    });
  });
});