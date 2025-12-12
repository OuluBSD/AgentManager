import { loadSession, saveSession } from '../session-storage';
import { okResult, errorResult, outputResult } from '../utils/output';
import { SessionState } from '../types';
import { appendEvent } from '../utils/artifacts';

export const logCommand = {
  command: 'log',
  describe: 'Add a log message to the session',
  builder: (yargs: any) => {
    return yargs
      .option('session-id', {
        describe: 'Session identifier',
        demandOption: true,
        type: 'string',
      })
      .option('message', {
        describe: 'Log message to add',
        demandOption: true,
        type: 'string',
      })
      .option('artifact-dir', {
        describe: 'Directory to store artifacts for this command execution',
        type: 'string',
      });
  },
  handler: (argv: any) => {
    const { sessionId, message, 'artifact-dir': artifactDir } = argv;

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

      // Add message to notes with timestamp
      session.notes.push(`[${new Date().toISOString()}] ${message}`);

      // Save the updated session
      saveSession(session);

      // If artifact directory is provided, append the log event
      if (artifactDir) {
        const event = {
          timestamp: new Date().toISOString(),
          type: 'log',
          message,
          sessionId,
        };
        appendEvent(artifactDir, event);
      }

      outputResult(
        okResult({
          sessionId,
          messageAdded: message,
          timestamp: new Date().toISOString(),
        })
      );
    } catch (error: any) {
      outputResult(
        errorResult(
          'LOG_ERROR',
          error.message || 'An error occurred while adding the log message',
          { error: error.stack }
        )
      );
    }
  },
};