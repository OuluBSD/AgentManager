import fs from 'fs-extra';
import path from 'path';
import { ChangeEntry, SessionState } from '../types';

export interface ArtifactEvent {
  timestamp: string;
  type: string;
  sessionId: string;
  [key: string]: any;
}

export function ensureArtifactDir(artifactDir: string): void {
  fs.ensureDirSync(artifactDir);
}

export function writeArtifactFile(artifactDir: string, relPath: string, data: string): void {
  if (!artifactDir) return;
  
  const fullPath = path.join(artifactDir, relPath);
  fs.ensureDirSync(path.dirname(fullPath));
  fs.writeFileSync(fullPath, data, 'utf8');
}

export function appendEvent(artifactDir: string, event: ArtifactEvent): void {
  if (!artifactDir) return;
  
  const eventsPath = path.join(artifactDir, 'events.log');
  const eventLine = JSON.stringify(event) + '\n';
  fs.appendFileSync(eventsPath, eventLine);
}

export function saveSessionArtifact(artifactDir: string, session: SessionState): void {
  if (!artifactDir) return;
  
  const sessionPath = path.join(artifactDir, 'session-state.json');
  fs.writeJsonSync(sessionPath, session, { spaces: 2 });
}

export function captureCommandOutput(artifactDir: string, stdout: string, stderr: string, exitCode: number): void {
  if (!artifactDir) return;
  
  fs.writeFileSync(path.join(artifactDir, 'stdout.txt'), stdout);
  fs.writeFileSync(path.join(artifactDir, 'stderr.txt'), stderr);
  fs.writeFileSync(path.join(artifactDir, 'exitcode'), exitCode.toString());
}