import { describeReplayCommand } from '../../tools/agent-tool/src/commands/describe-replay';
import fs from 'fs-extra';
import * as path from 'path';
import * as os from 'os';

describe('describe-replay runbook integration', () => {
  let tempDir: string;
  let artifactRunPath: string;

  beforeEach(() => {
    // Create a temporary directory for testing
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'nexus-test-'));
    artifactRunPath = path.join(tempDir, 'artifact-run');
    fs.ensureDirSync(artifactRunPath);
  });

  afterEach(() => {
    // Clean up the temporary directory
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it('should include runbook data when runbook files are present', async () => {
    // Create a runbook directory with a sample runbook file
    const runbookDir = path.join(artifactRunPath, 'policy-runbook');
    fs.ensureDirSync(runbookDir);

    const runbookData = {
      projectId: 'test-project',
      runbookId: 'runbook-test-1',
      severity: 'high',
      steps: [
        {
          id: 'step-1',
          title: 'Test Step',
          description: 'A test step',
          recommendedCommands: ['echo test'],
          expectedArtifacts: ['test-output.txt']
        }
      ],
      narrative: 'Test narrative'
    };

    const runbookPath = path.join(runbookDir, `runbook-${new Date().toISOString().replace(/[:.]/g, '-')}.json`);
    fs.writeJsonSync(runbookPath, runbookData);

    // Mock the argv object
    const argv = {
      'artifact-run': artifactRunPath
    };

    // Mock console output to capture results
    const originalLog = console.log;
    const originalError = console.error;
    console.log = jest.fn();
    console.error = jest.fn();

    try {
      // Execute the handler
      await describeReplayCommand.handler(argv);

      // The command output should have been captured by our mock
      const capturedOutput = (console.log as jest.Mock).mock.calls[0]?.[0];
      const parsedOutput = JSON.parse(capturedOutput);

      // Verify that the output includes runbook data
      expect(parsedOutput).toBeDefined();
      expect(parsedOutput.data).toBeDefined();
      expect(parsedOutput.data.runbook).toBeDefined();
      expect(parsedOutput.data.runbook.severity).toBe('high');
      expect(parsedOutput.data.runbook.steps).toBeDefined();
      expect(parsedOutput.data.runbook.steps.length).toBeGreaterThan(0);
      expect(parsedOutput.data.runbook.narrative).toBe('Test narrative');
    } finally {
      // Restore console functions
      console.log = originalLog;
      console.error = originalError;
    }
  });

  it('should handle missing runbook directory gracefully', async () => {
    // Don't create a runbook directory - just the base artifact run path

    // Mock the argv object
    const argv = {
      'artifact-run': artifactRunPath
    };

    // Mock console output to capture results
    const originalLog = console.log;
    const originalError = console.error;
    console.log = jest.fn();
    console.error = jest.fn();

    try {
      // Execute the handler
      await describeReplayCommand.handler(argv);

      // The command output should have been captured by our mock
      const capturedOutput = (console.log as jest.Mock).mock.calls[0]?.[0];
      const parsedOutput = JSON.parse(capturedOutput);

      // Verify that the output does not include runbook data
      expect(parsedOutput).toBeDefined();
      expect(parsedOutput.data).toBeDefined();
      // Runbook data should be undefined if no runbook files exist
      expect(parsedOutput.data.runbook).toBeUndefined();
    } finally {
      // Restore console functions
      console.log = originalLog;
      console.error = originalError;
    }
  });

  it('should handle multiple runbook files and take the most recent', async () => {
    // Create a runbook directory with multiple runbook files
    const runbookDir = path.join(artifactRunPath, 'policy-runbook');
    fs.ensureDirSync(runbookDir);

    // Create two runbook files with different timestamps
    const olderRunbook = {
      projectId: 'test-project',
      runbookId: 'runbook-test-older',
      severity: 'low',
      steps: [],
      narrative: 'Older narrative'
    };

    const newerRunbook = {
      projectId: 'test-project',
      runbookId: 'runbook-test-newer',
      severity: 'high',
      steps: [
        {
          id: 'step-1',
          title: 'Newer Step',
          description: 'A newer step',
          recommendedCommands: ['echo newer'],
          expectedArtifacts: ['newer-output.txt']
        }
      ],
      narrative: 'Newer narrative'
    };

    // Use specific timestamps to ensure proper ordering
    const olderTime = new Date(2023, 0, 1).toISOString().replace(/[:.]/g, '-');
    const newerTime = new Date(2023, 0, 2).toISOString().replace(/[:.]/g, '-');
    
    const olderPath = path.join(runbookDir, `runbook-${olderTime}.json`);
    const newerPath = path.join(runbookDir, `runbook-${newerTime}.json`);
    
    fs.writeJsonSync(olderPath, olderRunbook);
    fs.writeJsonSync(newerPath, newerRunbook);

    // Mock the argv object
    const argv = {
      'artifact-run': artifactRunPath
    };

    // Mock console output to capture results
    const originalLog = console.log;
    const originalError = console.error;
    console.log = jest.fn();
    console.error = jest.fn();

    try {
      // Execute the handler
      await describeReplayCommand.handler(argv);

      // The command output should have been captured by our mock
      const capturedOutput = (console.log as jest.Mock).mock.calls[0]?.[0];
      const parsedOutput = JSON.parse(capturedOutput);

      // Verify that the output includes the newer runbook data
      expect(parsedOutput).toBeDefined();
      expect(parsedOutput.data).toBeDefined();
      expect(parsedOutput.data.runbook).toBeDefined();
      expect(parsedOutput.data.runbook.severity).toBe('high');
      expect(parsedOutput.data.runbook.narrative).toBe('Newer narrative');
      expect(parsedOutput.data.runbook.steps.length).toBeGreaterThan(0);
      // Should have the newer step, not the older one
      expect(parsedOutput.data.runbook.steps[0].title).toBe('Newer Step');
    } finally {
      // Restore console functions
      console.log = originalLog;
      console.error = originalError;
    }
  });
});