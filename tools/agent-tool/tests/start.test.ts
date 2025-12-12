import { createNewSession, loadSession, getSessionPath } from '../src/session-storage';
import { SessionState } from '../src/types';
import fs from 'fs-extra';
import path from 'path';

describe('start command', () => {
  const sessionId = 'test-session-1';
  const testProjectPath = path.join(__dirname, 'test-project');
  
  beforeAll(() => {
    // Create a test project directory
    fs.ensureDirSync(testProjectPath);
  });

  afterAll(() => {
    // Clean up test project directory
    fs.removeSync(testProjectPath);
    
    // Clean up session file if it exists
    const sessionPath = getSessionPath(sessionId);
    if (fs.existsSync(sessionPath)) {
      fs.removeSync(sessionPath);
    }
  });

  it('should create a new session', () => {
    const session = createNewSession(sessionId, testProjectPath, null, 'qwen');
    
    expect(session).toBeDefined();
    expect(session.sessionId).toBe(sessionId);
    expect(session.projectPath).toBe(testProjectPath);
    expect(session.parentSessionId).toBeNull();
    expect(session.backend).toBe('qwen');
    expect(session.status).toBe('active');
    expect(session.notes).toEqual([]);
    expect(session.changes).toEqual([]);
  });

  it('should load an existing session', () => {
    const session = loadSession(sessionId);
    
    expect(session).toBeDefined();
    if (session) {
      expect(session.sessionId).toBe(sessionId);
      expect(session.projectPath).toBe(testProjectPath);
    }
  });
});