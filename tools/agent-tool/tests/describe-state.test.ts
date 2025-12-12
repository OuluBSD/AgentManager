import { createNewSession, loadSession } from '../src/session-storage';
import { describeStateCommand } from '../src/commands/describe-state';
import fs from 'fs-extra';
import path from 'path';

// Mock the output function to capture results
jest.mock('../src/utils/output', () => ({
  outputResult: jest.fn((result) => console.log(JSON.stringify(result, null, 2))),
  okResult: jest.fn((data) => ({ status: 'ok', data, errors: [] })),
  errorResult: jest.fn((type, message, details) => ({ status: 'error', errors: [{ type, message, details }] })),
}));

describe('describe-state command', () => {
  const sessionId = 'test-describe-state-session';
  const testProjectPath = path.join(__dirname, 'test-project-describe');
  const testBackend = 'qwen';
  
  beforeAll(() => {
    // Create a test project directory
    fs.ensureDirSync(testProjectPath);
    // Create a session with some initial state
    const session = createNewSession(sessionId, testProjectPath, null, testBackend);
    // Add a note to the session
    session.notes.push('Test note added during setup');
    // Add a change to the session
    session.changes.push({
      type: 'file-write',
      relPath: 'test-file.txt',
      timestamp: new Date().toISOString(),
    });
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

  it('should return the full session state', () => {
    // Capture console.log calls
    const originalLog = console.log;
    let capturedOutput = '';
    console.log = (output: string) => {
      capturedOutput = output;
    };

    // Run the describe-state command handler
    describeStateCommand.handler({
      sessionId
    });

    // Parse the captured output
    const outputObj = JSON.parse(capturedOutput);
    
    // Verify the output structure
    expect(outputObj.status).toBe('ok');
    expect(outputObj.data).toBeDefined();
    expect(outputObj.data.sessionId).toBe(sessionId);
    expect(outputObj.data.projectPath).toBe(testProjectPath);
    expect(outputObj.data.backend).toBe(testBackend);
    expect(outputObj.data.notes).toContain('Test note added during setup');
    expect(outputObj.data.changes).toContainEqual({
      type: 'file-write',
      relPath: 'test-file.txt',
      timestamp: expect.any(String),
    });
    
    // Restore original console.log
    console.log = originalLog;
  });
  
  it('should return an error for non-existent session', () => {
    // Capture console.log calls
    const originalLog = console.log;
    let capturedOutput = '';
    console.log = (output: string) => {
      capturedOutput = output;
    };

    // Run the describe-state command handler with non-existent session
    describeStateCommand.handler({
      sessionId: 'non-existent-session'
    });

    // Parse the captured output
    const outputObj = JSON.parse(capturedOutput);
    
    // Verify the error response
    expect(outputObj.status).toBe('error');
    expect(outputObj.errors).toContainEqual({
      type: 'SESSION_NOT_FOUND',
      message: 'Session not found: non-existent-session',
      details: undefined
    });
    
    // Restore original console.log
    console.log = originalLog;
  });
});