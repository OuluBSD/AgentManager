import fs from 'fs-extra';
import path from 'path';

import { SessionState } from './types';

const NEXUS_DIR = path.join(process.env.HOME || process.env.USERPROFILE || '', '.nexus');
const SESSIONS_DIR = path.join(NEXUS_DIR, 'agent-sessions');

// Ensure the directories exist
fs.ensureDirSync(NEXUS_DIR);
fs.ensureDirSync(SESSIONS_DIR);

export function getSessionPath(sessionId: string): string {
  return path.join(SESSIONS_DIR, `${sessionId}.json`);
}

export function loadSession(sessionId: string): SessionState | null {
  const sessionPath = getSessionPath(sessionId);
  if (!fs.existsSync(sessionPath)) {
    return null;
  }
  return fs.readJsonSync(sessionPath);
}

export function saveSession(session: SessionState): void {
  const sessionPath = getSessionPath(session.sessionId);
  fs.writeJsonSync(sessionPath, session, { spaces: 2 });
}

export function createNewSession(
  sessionId: string,
  projectPath: string,
  parentSessionId: string | null = null,
  backend?: string
): SessionState {
  const newSession: SessionState = {
    sessionId,
    projectPath,
    parentSessionId,
    backend,
    notes: [],
    changes: [],
    status: 'active',
  };

  saveSession(newSession);
  return newSession;
}