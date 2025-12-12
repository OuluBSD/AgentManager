import { spawn } from 'child_process';
import fs from 'fs-extra';
import path from 'path';
import { tmpdir } from 'os';
import { v4 as uuidv4 } from 'uuid';

describe('autopilot-cycle CLI Command Integration Tests', () => {
  let tempDir: string;
  let cliPath: string;

  beforeAll(() => {
    // Assuming the CLI is built and available
    cliPath = path.join(__dirname, '../../tools/agent-tool/dist/index.js');
  });

  beforeEach(() => {
    // Create a temporary directory for each test
    tempDir = path.join(tmpdir(), `nexus-test-${uuidv4()}`);
    fs.ensureDirSync(tempDir);
  });

  afterEach(() => {
    // Clean up the temporary directory after each test
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it('should run autopilot-cycle command successfully with minimal artifacts', (done) => {
    // Create minimal required directory structure
    const artifactDir = path.join(tempDir, 'run');
    fs.ensureDirSync(artifactDir);

    // Create a basic policy file
    const policyFile = path.join(artifactDir, 'policy.json');
    fs.writeJsonSync(policyFile, {
      version: '1.0',
      rules: []
    });

    // Create a drift directory with a drift file
    const driftDir = path.join(artifactDir, 'policy-drift');
    fs.ensureDirSync(driftDir);
    const driftFile = path.join(driftDir, 'drift-2025-01-01T12-00-00-000Z.json');
    fs.writeJsonSync(driftFile, {
      analysis: {
        overallDriftScore: 0.1,
        stabilityIndex: 0.95,
        classification: 'stable',
        signals: []
      }
    });

    // Create a futures directory with a futures file
    const futuresDir = path.join(artifactDir, 'policy-futures');
    fs.ensureDirSync(futuresDir);
    const futuresFile = path.join(futuresDir, 'future-2025-01-01T12-00-00-000Z.json');
    fs.writeJsonSync(futuresFile, {
      projectId: 'test-project',
      simulations: [],
      aggregate: {
        volatilityIndex: 0.1,
        mostProbableNarrative: 'Stable operation expected',
        worstCaseNarrative: 'Minor issues possible',
        bestCaseNarrative: 'Optimal performance',
        riskLevel: 'stable'
      }
    });

    // Create a federated policy directory with a file
    const federatedDir = path.join(artifactDir, 'federated-policy');
    fs.ensureDirSync(federatedDir);
    const federatedFile = path.join(federatedDir, 'federated-2025-01-01T12-00-00-000Z.json');
    fs.writeJsonSync(federatedFile, {
      similarityMatrix: {
        projectIds: ['test-project'],
        values: [[1.0]]
      },
      clusters: [{ clusterId: 'cluster_0', members: ['test-project'] }],
      outliers: [],
      consensus: {
        baselineRules: [],
        similarityWeightedRules: [],
        driftWeightedRules: []
      },
      influenceGraph: [],
      systemStabilityScore: 0.95,
      narrativeSummary: 'System stable'
    });

    // Create a review directory with a review file
    const reviewDir = path.join(artifactDir, 'policy-review');
    fs.ensureDirSync(reviewDir);
    const reviewFile = path.join(reviewDir, 'review-2025-01-01T12-00-00-000Z.json');
    fs.writeJsonSync(reviewFile, []);

    // Define the expected output file
    const outputFile = path.join(tempDir, 'autopilot.json');

    // Run the CLI command
    const child = spawn('node', [
      cliPath,
      'autopilot-cycle',
      '--artifact-dir',
      artifactDir,
      '--project-id',
      'test-project',
      '--output',
      outputFile
    ]);

    let stdout = '';
    let stderr = '';

    child.stdout.on('data', (data) => {
      stdout += data.toString();
    });

    child.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    child.on('close', (code) => {
      // Test that the command succeeded (exit code 0 for stable system)
      expect(code).toBe(0);

      // Test that output was written to stdout or file
      expect(stdout).toContain('Policy autopilot cycle result written to');

      // Check that the output file exists and contains valid JSON
      expect(fs.existsSync(outputFile)).toBe(true);

      const outputContent = fs.readFileSync(outputFile, 'utf8');
      const outputData = JSON.parse(outputContent);

      // Validate the structure of the output
      expect(outputData.status).toBe('ok');
      expect(outputData.result).toBeDefined();
      expect(outputData.result.projectId).toBe('test-project');
      expect(outputData.result.cycleId).toBeDefined();
      expect(outputData.result.risk).toBeDefined();
      expect(outputData.result.recommendedActions).toBeDefined();
      expect(outputData.result.narrative).toBeDefined();

      done();
    });
  });

  it('should handle missing artifacts directory gracefully', (done) => {
    const nonExistentDir = path.join(tempDir, 'non-existent');

    // Run the CLI command with a non-existent directory
    const child = spawn('node', [
      cliPath,
      'autopilot-cycle',
      '--artifact-dir',
      nonExistentDir,
      '--project-id',
      'test-project'
    ]);

    let stderr = '';

    child.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    child.on('close', (code) => {
      // Should exit with error code (2)
      expect(code).toBe(2);

      // Should output error message
      expect(stderr).toContain('Error during autopilot cycle');

      done();
    });
  });

  it('should exit with code 2 for critical risk level', (done) => {
    // Create artifact directory with critical risk indicators
    const artifactDir = path.join(tempDir, 'run');
    fs.ensureDirSync(artifactDir);

    // Create a basic policy file
    const policyFile = path.join(artifactDir, 'policy.json');
    fs.writeJsonSync(policyFile, {
      version: '1.0',
      rules: []
    });

    // Create a drift directory with high drift
    const driftDir = path.join(artifactDir, 'policy-drift');
    fs.ensureDirSync(driftDir);
    const driftFile = path.join(driftDir, 'drift-2025-01-01T12-00-00-000Z.json');
    fs.writeJsonSync(driftFile, {
      analysis: {
        overallDriftScore: 0.9, // High drift
        stabilityIndex: 0.1,
        classification: 'critical',
        signals: [{ type: 'rule_churn', severity: 'critical', confidence: 0.95 }]
      }
    });

    // Create a futures directory with high volatility
    const futuresDir = path.join(artifactDir, 'policy-futures');
    fs.ensureDirSync(futuresDir);
    const futuresFile = path.join(futuresDir, 'future-2025-01-01T12-00-00-000Z.json');
    fs.writeJsonSync(futuresFile, {
      projectId: 'test-project',
      simulations: [],
      aggregate: {
        volatilityIndex: 0.9, // High volatility
        mostProbableNarrative: 'High volatility detected',
        worstCaseNarrative: 'System instability likely',
        bestCaseNarrative: 'Moderate issues possible',
        riskLevel: 'critical'
      }
    });

    // Create a federated policy directory with low stability
    const federatedDir = path.join(artifactDir, 'federated-policy');
    fs.ensureDirSync(federatedDir);
    const federatedFile = path.join(federatedDir, 'federated-2025-01-01T12-00-00-000Z.json');
    fs.writeJsonSync(federatedFile, {
      similarityMatrix: {
        projectIds: ['test-project', 'other-project'],
        values: [
          [1.0, 0.1], // Low similarity
          [0.1, 1.0]
        ]
      },
      clusters: [
        { clusterId: 'cluster_0', members: ['test-project'] },
        { clusterId: 'cluster_1', members: ['other-project'] }
      ],
      outliers: ['test-project'],
      consensus: {
        baselineRules: [],
        similarityWeightedRules: [],
        driftWeightedRules: []
      },
      influenceGraph: [],
      systemStabilityScore: 0.1, // Low stability
      narrativeSummary: 'High divergence detected'
    });

    // Create a review directory with a review file
    const reviewDir = path.join(artifactDir, 'policy-review');
    fs.ensureDirSync(reviewDir);
    const reviewFile = path.join(reviewDir, 'review-2025-01-01T12-00-00-000Z.json');
    fs.writeJsonSync(reviewFile, []);

    // Run the CLI command
    const child = spawn('node', [
      cliPath,
      'autopilot-cycle',
      '--artifact-dir',
      artifactDir,
      '--project-id',
      'test-project'
    ]);

    let stdout = '';

    child.stdout.on('data', (data) => {
      stdout += data.toString();
    });

    child.on('close', (code) => {
      // Should exit with code 2 for critical risk
      expect(code).toBe(2);

      // Output should contain autopilot results with critical risk
      expect(stdout).toContain('"globalRisk":"critical"');

      done();
    });
  });

  it('should exit with code 1 for volatile risk level', (done) => {
    // Create artifact directory with volatile risk indicators
    const artifactDir = path.join(tempDir, 'run');
    fs.ensureDirSync(artifactDir);

    // Create a basic policy file
    const policyFile = path.join(artifactDir, 'policy.json');
    fs.writeJsonSync(policyFile, {
      version: '1.0',
      rules: []
    });

    // Create a drift directory with moderate high drift
    const driftDir = path.join(artifactDir, 'policy-drift');
    fs.ensureDirSync(driftDir);
    const driftFile = path.join(driftDir, 'drift-2025-01-01T12-00-00-000Z.json');
    fs.writeJsonSync(driftFile, {
      analysis: {
        overallDriftScore: 0.6, // Moderate high drift
        stabilityIndex: 0.4,
        classification: 'volatile',
        signals: [{ type: 'rule_churn', severity: 'high', confidence: 0.8 }]
      }
    });

    // Create a futures directory with moderate high volatility
    const futuresDir = path.join(artifactDir, 'policy-futures');
    fs.ensureDirSync(futuresDir);
    const futuresFile = path.join(futuresDir, 'future-2025-01-01T12-00-00-000Z.json');
    fs.writeJsonSync(futuresFile, {
      projectId: 'test-project',
      simulations: [],
      aggregate: {
        volatilityIndex: 0.6, // Moderate high volatility
        mostProbableNarrative: 'Moderate volatility detected',
        worstCaseNarrative: 'Potential system instability',
        bestCaseNarrative: 'Some issues possible',
        riskLevel: 'volatile'
      }
    });

    // Create a federated policy directory with moderate stability
    const federatedDir = path.join(artifactDir, 'federated-policy');
    fs.ensureDirSync(federatedDir);
    const federatedFile = path.join(federatedDir, 'federated-2025-01-01T12-00-00-000Z.json');
    fs.writeJsonSync(federatedFile, {
      similarityMatrix: {
        projectIds: ['test-project', 'other-project'],
        values: [
          [1.0, 0.4], // Moderate similarity
          [0.4, 1.0]
        ]
      },
      clusters: [
        { clusterId: 'cluster_0', members: ['test-project'] },
        { clusterId: 'cluster_1', members: ['other-project'] }
      ],
      outliers: [],
      consensus: {
        baselineRules: [],
        similarityWeightedRules: [],
        driftWeightedRules: []
      },
      influenceGraph: [],
      systemStabilityScore: 0.4, // Moderate stability
      narrativeSummary: 'Moderate divergence detected'
    });

    // Create a review directory with a review file
    const reviewDir = path.join(artifactDir, 'policy-review');
    fs.ensureDirSync(reviewDir);
    const reviewFile = path.join(reviewDir, 'review-2025-01-01T12-00-00-000Z.json');
    fs.writeJsonSync(reviewFile, []);

    // Run the CLI command
    const child = spawn('node', [
      cliPath,
      'autopilot-cycle',
      '--artifact-dir',
      artifactDir,
      '--project-id',
      'test-project'
    ]);

    let stdout = '';

    child.stdout.on('data', (data) => {
      stdout += data.toString();
    });

    child.on('close', (code) => {
      // Should exit with code 1 for volatile risk
      expect(code).toBe(1);

      // Output should contain autopilot results with volatile risk
      expect(stdout).toContain('"globalRisk":"volatile"');

      done();
    });
  });

  it('should successfully create autopilot result file in policy-autopilot directory', (done) => {
    // Create artifact directory with some data
    const artifactDir = path.join(tempDir, 'run');
    fs.ensureDirSync(artifactDir);

    // Create a basic policy file
    const policyFile = path.join(artifactDir, 'policy.json');
    fs.writeJsonSync(policyFile, {
      version: '1.0',
      rules: []
    });

    // Create a drift directory with a drift file
    const driftDir = path.join(artifactDir, 'policy-drift');
    fs.ensureDirSync(driftDir);
    const driftFile = path.join(driftDir, 'drift-2025-01-01T12-00-00-000Z.json');
    fs.writeJsonSync(driftFile, {
      analysis: {
        overallDriftScore: 0.1,
        stabilityIndex: 0.95,
        classification: 'stable',
        signals: []
      }
    });

    // Create a futures directory with a futures file
    const futuresDir = path.join(artifactDir, 'policy-futures');
    fs.ensureDirSync(futuresDir);
    const futuresFile = path.join(futuresDir, 'future-2025-01-01T12-00-00-000Z.json');
    fs.writeJsonSync(futuresFile, {
      projectId: 'test-project',
      simulations: [],
      aggregate: {
        volatilityIndex: 0.1,
        mostProbableNarrative: 'Stable operation expected',
        worstCaseNarrative: 'Minor issues possible',
        bestCaseNarrative: 'Optimal performance',
        riskLevel: 'stable'
      }
    });

    // Create a federated policy directory with a file
    const federatedDir = path.join(artifactDir, 'federated-policy');
    fs.ensureDirSync(federatedDir);
    const federatedFile = path.join(federatedDir, 'federated-2025-01-01T12-00-00-000Z.json');
    fs.writeJsonSync(federatedFile, {
      similarityMatrix: {
        projectIds: ['test-project'],
        values: [[1.0]]
      },
      clusters: [{ clusterId: 'cluster_0', members: ['test-project'] }],
      outliers: [],
      consensus: {
        baselineRules: [],
        similarityWeightedRules: [],
        driftWeightedRules: []
      },
      influenceGraph: [],
      systemStabilityScore: 0.95,
      narrativeSummary: 'System stable'
    });

    // Create a review directory with a review file
    const reviewDir = path.join(artifactDir, 'policy-review');
    fs.ensureDirSync(reviewDir);
    const reviewFile = path.join(reviewDir, 'review-2025-01-01T12-00-00-000Z.json');
    fs.writeJsonSync(reviewFile, []);

    // Run the CLI command without specifying output file
    const child = spawn('node', [
      cliPath,
      'autopilot-cycle',
      '--artifact-dir',
      artifactDir,
      '--project-id',
      'test-project'
    ]);

    let stdout = '';

    child.stdout.on('data', (data) => {
      stdout += data.toString();
    });

    child.on('close', (code) => {
      // Command should succeed
      expect(code).toBe(0);

      // Check that autopilot directory and file were created
      const autopilotDir = path.join(artifactDir, 'policy-autopilot');
      expect(fs.existsSync(autopilotDir)).toBe(true);

      const autopilotFiles = fs.readdirSync(autopilotDir);
      expect(autopilotFiles.length).toBeGreaterThan(0);

      // Check that at least one autopilot file exists and has the correct format
      const autopilotFile = autopilotFiles.find(file => file.startsWith('cycle-') && file.endsWith('.json'));
      expect(autopilotFile).toBeDefined();

      const autopilotFilePath = path.join(autopilotDir, autopilotFile!);
      const autopilotContent = fs.readFileSync(autopilotFilePath, 'utf8');
      const autopilotData = JSON.parse(autopilotContent);

      // Validate the structure of the autopilot result
      expect(autopilotData.status).toBe('ok');
      expect(autopilotData.result).toBeDefined();
      expect(autopilotData.result.projectId).toBe('test-project');
      expect(autopilotData.result.risk).toBeDefined();
      expect(autopilotData.result.recommendedActions).toBeDefined();
      expect(autopilotData.result.narrative).toBeDefined();

      done();
    });
  });
});