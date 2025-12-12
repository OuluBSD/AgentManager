import { createNewSession } from '../src/session-storage';
import { runCommandCommand } from '../src/commands/run-command';
import fs from 'fs-extra';
import path from 'path';

// Mock the output function to capture results
jest.mock('../src/utils/output', () => ({
  outputResult: jest.fn((result) => console.log(JSON.stringify(result, null, 2))),
  okResult: jest.fn((data) => ({ status: 'ok', data, errors: [] })),
  errorResult: jest.fn((type, message, details) => ({ status: 'error', errors: [{ type, message, details }] })),
}));

describe('run-command command', () => {
  const sessionId = 'test-run-command-session';
  const testProjectPath = path.join(__dirname, 'test-project-run');
  
  beforeAll(() => {
    // Create a test project directory
    fs.ensureDirSync(testProjectPath);
    // Create a session
    createNewSession(sessionId, testProjectPath);
  });

  afterAll(() => {
    // Clean up test project directory
    fs.removeSync(testProjectPath);
    
    // Clean up session file if it exists
    const sessionPath = path.join(process.env.HOME || process.env.USERPROFILE || '', '.nexus', 'agent-sessions', `${sessionId}.json`);
    if (fs.existsSync(sessionPath)) {
      fs.removeSync(sessionPath);
    }
  });

  it('should run a simple command successfully', async () => {
    // Capture console.log calls
    const originalLog = console.log;
    const logSpy = jest.fn();
    console.log = logSpy;

    // Mock the handler to work synchronously for testing
    const handlerPromise = new Promise((resolve) => {
      // Wait for the async handler to complete
      setTimeout(resolve, 100);
    });
    
    // Run the run-command command handler
    await runCommandCommand.handler({
      sessionId,
      cmd: 'echo "Hello, World!"'
    });
    
    await handlerPromise;
    
    // Verify that outputResult was called with correct data
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('"status": "ok"'));
    
    // Restore original console.log
    console.log = originalLog;
  });
  
  it('should capture command exit code correctly', async () => {
    // Capture console.log calls
    const originalLog = console.log;
    let capturedOutput = '';
    console.log = (output: string) => {
      capturedOutput = output;
    };

    const handlerPromise = new Promise((resolve) => {
      setTimeout(resolve, 100);
    });
    
    // Run the run-command command handler with a failing command
    await runCommandCommand.handler({
      sessionId,
      cmd: 'exit 1'
    });
    
    await handlerPromise;
    
    // Parse the captured output to verify exit code
    const outputObj = JSON.parse(capturedOutput);
    expect(outputObj.data.exitCode).toBe(1);
    
    // Restore original console.log
    console.log = originalLog;
  });
});