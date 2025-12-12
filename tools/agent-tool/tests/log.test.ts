import { createNewSession, loadSession } from '../src/session-storage';
import { logCommand } from '../src/commands/log';
import fs from 'fs-extra';
import path from 'path';

// Mock the output function to capture results
jest.mock('../src/utils/output', () => ({
  outputResult: jest.fn((result) => console.log(JSON.stringify(result, null, 2))),
  okResult: jest.fn((data) => ({ status: 'ok', data, errors: [] })),
  errorResult: jest.fn((type, message, details) => ({ status: 'error', errors: [{ type, message, details }] })),
}));

// Import the mocked functions
import { outputResult } from '../src/utils/output';

describe('log command', () => {
  const sessionId = 'test-log-session';
  const testProjectPath = path.join(__dirname, 'test-project-log');
  const testMessage = 'Test log message';
  
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

  it('should add a message to the session notes', () => {
    // Capture console.log calls
    const originalLog = console.log;
    const logSpy = jest.fn();
    console.log = logSpy;

    // Run the log command handler
    logCommand.handler({
      sessionId,
      message: testMessage
    });

    // Verify that outputResult was called
    expect(logSpy).toHaveBeenCalled();
    
    // Check that the message was added to the notes
    const session = loadSession(sessionId);
    expect(session).toBeDefined();
    if (session) {
      expect(session.notes).toContainEqual(expect.stringContaining(testMessage));
    }
    
    // Restore original console.log
    console.log = originalLog;
  });
});