import { loadSession } from '../session-storage';
import { okResult, errorResult, outputResult } from '../utils/output';
import { saveSessionArtifact } from '../utils/artifacts';

export const describeStateCommand = {
  command: 'describe-state',
  describe: 'Describe the current state of a session',
  builder: (yargs: any) => {
    return yargs
      .option('session-id', {
        describe: 'Session identifier',
        demandOption: true,
        type: 'string',
      })
      .option('artifact-dir', {
        describe: 'Directory to store artifacts for this command execution',
        type: 'string',
      });
  },
  handler: (argv: any) => {
    const { sessionId, 'artifact-dir': artifactDir } = argv;

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

      // If artifact directory is provided, save the session state as an artifact
      if (artifactDir) {
        saveSessionArtifact(artifactDir, session);
      }

      outputResult(
        okResult({
          sessionId: session.sessionId,
          projectPath: session.projectPath,
          parentSessionId: session.parentSessionId,
          backend: session.backend,
          notes: session.notes,
          changes: session.changes,
          status: session.status,
        })
      );
    } catch (error: any) {
      outputResult(
        errorResult(
          'DESCRIBE_STATE_ERROR',
          error.message || 'An error occurred while describing the session state',
          { error: error.stack }
        )
      );
    }
  },
};