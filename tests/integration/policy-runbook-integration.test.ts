import { makeRunbookCommand } from '../../tools/agent-tool/src/commands/make-runbook';
import fs from 'fs-extra';
import * as path from 'path';
import * as os from 'os';

describe('make-runbook CLI Command', () => {
  let tempDir: string;
  let artifactDir: string;

  beforeEach(() => {
    // Create a temporary directory for testing
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'nexus-test-'));
    artifactDir = path.join(tempDir, 'artifacts');
    fs.ensureDirSync(artifactDir);
  });

  afterEach(() => {
    // Clean up the temporary directory
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it('should generate runbook with autopilot data', async () => {
    // Create a mock autopilot file
    const autopilotDir = path.join(artifactDir, 'policy-autopilot');
    fs.ensureDirSync(autopilotDir);
    
    const autopilotData = {
      result: {
        projectId: 'test-project',
        cycleId: 'cycle-1',
        risk: {
          globalRisk: 'stable',
          reasons: ['System operating within normal parameters'],
          metrics: {}
        },
        recommendedActions: [],
        narrative: 'System is stable'
      }
    };
    
    const autopilotPath = path.join(autopilotDir, `cycle-${new Date().toISOString().replace(/[:.]/g, '-')}.json`);
    fs.writeJsonSync(autopilotPath, autopilotData);

    // Mock the argv object
    const argv = {
      'artifact-dir': artifactDir,
      'project-id': 'test-project',
      output: path.join(artifactDir, 'runbook-output.json')
    };

    // Capture console output to prevent logging during tests
    const originalLog = console.log;
    const originalError = console.error;
    console.log = jest.fn();
    console.error = jest.fn();

    try {
      // Execute the handler
      await makeRunbookCommand.handler(argv);

      // Check that an output file was created
      const runbookDir = path.join(artifactDir, 'policy-runbook');
      const runbookFiles = fs.readdirSync(runbookDir).filter((file: string) =>
        file.startsWith('runbook-') && file.endsWith('.json')
      );

      expect(runbookFiles.length).toBeGreaterThan(0);

      // Read the created runbook file
      const runbookPath = path.join(runbookDir, runbookFiles[0]!);
      const runbookData = fs.readJsonSync(runbookPath);

      expect(runbookData).toBeDefined();
      expect(runbookData.status).toBe('ok');
      expect(runbookData.result).toBeDefined();
      expect(runbookData.result.projectId).toBe('test-project');
      expect(runbookData.result.severity).toBeDefined();
      expect(runbookData.result.steps).toBeDefined();
      expect(Array.isArray(runbookData.result.steps)).toBe(true);
      expect(runbookData.result.narrative).toBeDefined();
    } finally {
      // Restore console functions
      console.log = originalLog;
      console.error = originalError;
    }
  });

  it('should generate runbook with high severity when drift is detected', async () => {
    // Create a mock autopilot file with high drift
    const autopilotDir = path.join(artifactDir, 'policy-autopilot');
    fs.ensureDirSync(autopilotDir);
    
    const autopilotData = {
      result: {
        projectId: 'test-project',
        cycleId: 'cycle-1',
        risk: {
          globalRisk: 'volatile',
          reasons: ['Significant policy drift detected'],
          metrics: { drift: 0.8 }
        },
        recommendedActions: [],
        narrative: 'System has high drift'
      }
    };
    
    const autopilotPath = path.join(autopilotDir, `cycle-${new Date().toISOString().replace(/[:.]/g, '-')}.json`);
    fs.writeJsonSync(autopilotPath, autopilotData);

    // Create a mock drift file
    const driftDir = path.join(artifactDir, 'policy-drift');
    fs.ensureDirSync(driftDir);
    
    const driftData = {
      signals: [],
      overallDriftScore: 0.8,
      stabilityIndex: 0.2,
      classification: 'volatile',
      narrativeSummary: 'High drift detected'
    };
    
    const driftPath = path.join(driftDir, `drift-${new Date().toISOString().replace(/[:.]/g, '-')}.json`);
    fs.writeJsonSync(driftPath, driftData);

    // Mock the argv object
    const argv = {
      'artifact-dir': artifactDir,
      'project-id': 'test-project',
      output: path.join(artifactDir, 'runbook-output.json')
    };

    // Capture console output to prevent logging during tests
    const originalLog = console.log;
    const originalError = console.error;
    console.log = jest.fn();
    console.error = jest.fn();

    try {
      // Execute the handler
      await makeRunbookCommand.handler(argv);

      // Check that an output file was created
      const runbookDir = path.join(artifactDir, 'policy-runbook');
      const runbookFiles = fs.readdirSync(runbookDir).filter((file: string) =>
        file.startsWith('runbook-') && file.endsWith('.json')
      );

      expect(runbookFiles.length).toBeGreaterThan(0);

      // Read the created runbook file
      const runbookPath = path.join(runbookDir, runbookFiles[0]!);
      const runbookData = fs.readJsonSync(runbookPath);

      expect(runbookData).toBeDefined();
      expect(runbookData.status).toBe('ok');
      // With high drift, we expect high severity
      expect(runbookData.result.severity).toBe('high');
      expect(runbookData.result.steps).toBeDefined();
      expect(Array.isArray(runbookData.result.steps)).toBe(true);
      expect(runbookData.result.narrative).toBeDefined();
    } finally {
      // Restore console functions
      console.log = originalLog;
      console.error = originalError;
    }
  });

  it('should handle missing autopilot data by creating a default', async () => {
    // Don't create any autopilot data, just the artifact directory

    // Mock the argv object
    const argv = {
      'artifact-dir': artifactDir,
      'project-id': 'test-project',
      output: path.join(artifactDir, 'runbook-output.json')
    };

    // Capture console output to prevent logging during tests
    const originalLog = console.log;
    const originalError = console.error;
    console.log = jest.fn();
    console.error = jest.fn();

    try {
      // Execute the handler
      await makeRunbookCommand.handler(argv);

      // Check that an output file was created
      const runbookDir = path.join(artifactDir, 'policy-runbook');
      const runbookFiles = fs.readdirSync(runbookDir).filter((file: string) =>
        file.startsWith('runbook-') && file.endsWith('.json')
      );

      expect(runbookFiles.length).toBeGreaterThan(0);

      // Read the created runbook file
      const runbookPath = path.join(runbookDir, runbookFiles[0]!);
      const runbookData = fs.readJsonSync(runbookPath);

      expect(runbookData).toBeDefined();
      expect(runbookData.status).toBe('ok');
      expect(runbookData.result).toBeDefined();
      expect(runbookData.result.projectId).toBe('test-project');
      // Should default to low severity when no risk is detected
      expect(runbookData.result.severity).toBeDefined();
      expect(runbookData.result.steps).toBeDefined();
      expect(Array.isArray(runbookData.result.steps)).toBe(true);
      expect(runbookData.result.narrative).toBeDefined();
    } finally {
      // Restore console functions
      console.log = originalLog;
      console.error = originalError;
    }
  });
});