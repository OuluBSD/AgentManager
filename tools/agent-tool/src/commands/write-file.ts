import { loadSession, saveSession } from '../session-storage';
import { okResult, errorResult, outputResult } from '../utils/output';
import { FileWriteChange } from '../types';
import { ensureArtifactDir, writeArtifactFile, appendEvent } from '../utils/artifacts';
import fs from 'fs-extra';
import path from 'path';
import { evaluatePolicy, PolicyEvaluationInput } from '../policy/engine';

export const writeFileCommand = {
  command: 'write-file',
  describe: 'Write content to a file in the project directory',
  builder: (yargs: any) => {
    return yargs
      .option('session-id', {
        describe: 'Session identifier',
        demandOption: true,
        type: 'string',
      })
      .option('rel-path', {
        describe: 'Relative path to the file within the project',
        demandOption: true,
        type: 'string',
      })
      .option('artifact-dir', {
        describe: 'Directory to store artifacts for this command execution',
        type: 'string',
      });
  },
  handler: (argv: any) => {
    const { sessionId, 'rel-path': relPath, 'artifact-dir': artifactDir } = argv;

    // Read content from stdin
    let content = '';
    process.stdin.setEncoding('utf8');
    process.stdin.on('readable', () => {
      let chunk;
      while ((chunk = process.stdin.read()) !== null) {
        content += chunk;
      }
    });

    process.stdin.on('end', () => {
      try {
        const session = loadSession(sessionId);

        if (!session) {
          outputResult(
            errorResult(
              'SESSION_NOT_FOUND',
              `Session not found: ${sessionId}`
            )
          );
          return;
        }

        // Policy evaluation
        const policyInput: PolicyEvaluationInput = {
          action: {
            type: 'write-file',
            path: relPath,
            sessionId,
            projectPath: session.projectPath
          },
          context: {
            session,
            projectPath: session.projectPath
          },
          policy: session.policy || {} // Assuming policy is stored in session
        };

        const policyResult = evaluatePolicy(policyInput);

        // Check policy outcome
        if (policyResult.outcome === 'DENY') {
          outputResult(
            errorResult(
              'POLICY_DENIED',
              `Policy denied file write operation: ${policyResult.reason || 'Policy violation'}`,
              { policyTrace: policyResult.policyTrace }
            )
          );
          return;
        } else if (policyResult.outcome === 'REVIEW') {
          outputResult(
            errorResult(
              'POLICY_REVIEW_REQUIRED',
              `Policy requires review for file write operation: ${policyResult.reason || 'Policy review required'}`,
              { policyTrace: policyResult.policyTrace }
            )
          );
          return;
        }

        // Resolve target path
        const targetPath = path.resolve(session.projectPath, relPath);

        // Ensure parent directories exist
        fs.ensureDirSync(path.dirname(targetPath));

        // Write file
        fs.writeFileSync(targetPath, content, 'utf8');

        // Add change entry to session
        const change: FileWriteChange = {
          type: 'file-write',
          relPath,
          timestamp: new Date().toISOString(),
        };

        session.changes.push(change);
        saveSession(session);

        // If artifact directory is provided, save file content and append event
        if (artifactDir) {
          ensureArtifactDir(artifactDir);
          // Save a copy of the file content in the artifacts
          writeArtifactFile(artifactDir, path.join('files', relPath), content);

          // Append an event to the events log
          const event = {
            timestamp: new Date().toISOString(),
            type: 'file-write',
            relPath,
            bytes: content.length,
            sessionId,
          };
          appendEvent(artifactDir, event);

          // Save policy trace as artifact
          const tracePath = path.join(artifactDir, 'policy-trace', `trace-${policyResult.policyTrace.actionId}.json`);
          fs.ensureDirSync(path.dirname(tracePath));
          fs.writeJsonSync(tracePath, policyResult.policyTrace, { spaces: 2 });
        }

        outputResult(
          okResult({
            sessionId,
            absolutePath: targetPath,
            relPath,
            bytesWritten: content.length,
            policyTrace: policyResult.policyTrace
          })
        );
      } catch (error: any) {
        outputResult(
          errorResult(
            'WRITE_FILE_ERROR',
            error.message || 'An error occurred while writing the file',
            { error: error.stack }
          )
        );
      }
    });
  },
};