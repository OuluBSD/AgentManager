import { createNewSession } from '../src/session-storage';
import { writeFileCommand } from '../src/commands/write-file';
import fs from 'fs-extra';
import path from 'path';

// Mock the output function to capture results
jest.mock('../src/utils/output', () => ({
  outputResult: jest.fn((result) => console.log(JSON.stringify(result, null, 2))),
  okResult: jest.fn((data) => ({ status: 'ok', data, errors: [] })),
  errorResult: jest.fn((type, message, details) => ({ status: 'error', errors: [{ type, message, details }] })),
}));

describe('write-file command', () => {
  const sessionId = 'test-write-file-session';
  const testProjectPath = path.join(__dirname, 'test-project-write');
  const testFilePath = 'test-dir/test-file.txt';
  const testContent = 'This is test content for the file.';
  
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

  it('should write a file to the project directory', (done) => {
    // Set up stdin with test content
    const stdinData = testContent;
    
    // Mock stdin
    const originalStdin = process.stdin;
    Object.setPrototypeOf(process.stdin, require('stream').Readable.prototype);
    process.stdin.push(stdinData);
    process.stdin.push(null); // end of stream

    // Capture console.log calls
    const originalLog = console.log;
    const logSpy = jest.fn();
    console.log = logSpy;

    // Run the write-file command handler
    writeFileCommand.handler({
      sessionId,
      'rel-path': testFilePath
    });

    // Since the handler is async with stdin, we need to wait a bit
    setTimeout(() => {
      // Verify that the file was created with correct content
      const targetPath = path.resolve(testProjectPath, testFilePath);
      expect(fs.existsSync(targetPath)).toBe(true);
      
      const fileContent = fs.readFileSync(targetPath, 'utf8');
      expect(fileContent).toBe(testContent);

      // Restore original stdin and console.log
      process.stdin = originalStdin;
      console.log = originalLog;
      
      done();
    }, 100);
  });
});