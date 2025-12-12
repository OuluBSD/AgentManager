import { loadSession, saveSession } from '../session-storage';
import { okResult, errorResult, outputResult } from '../utils/output';
import { CommandRunChange } from '../types';
import { exec } from 'child_process';
import util from 'util';
import path from 'path';
import fs from 'fs-extra';
import { ensureArtifactDir, appendEvent, captureCommandOutput } from '../utils/artifacts';
import { evaluatePolicy, PolicyEvaluationInput } from '../policy/engine';

const execPromise = util.promisify(exec);

export const runCommandCommand = {
  command: 'run-command',
  describe: 'Run a command in the project directory',
  builder: (yargs: any) => {
    return yargs
      .option('session-id', {
        describe: 'Session identifier',
        demandOption: true,
        type: 'string',
      })
      .option('cmd', {
        describe: 'Command to run',
        demandOption: true,
        type: 'string',
      })
      .option('artifact-dir', {
        describe: 'Directory to store artifacts for this command execution',
        type: 'string',
      });
  },
  handler: async (argv: any) => {
    const { sessionId, cmd, 'artifact-dir': artifactDir } = argv;

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
          type: 'run-command',
          command: cmd,
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
            `Policy denied command execution: ${policyResult.reason || 'Policy violation'}`,
            { policyTrace: policyResult.policyTrace }
          )
        );
        return;
      } else if (policyResult.outcome === 'REVIEW') {
        outputResult(
          errorResult(
            'POLICY_REVIEW_REQUIRED',
            `Policy requires review for command execution: ${policyResult.reason || 'Policy review required'}`,
            { policyTrace: policyResult.policyTrace }
          )
        );
        return;
      }

      // Run the command in the project directory
      let stdout = '';
      let stderr = '';
      let exitCode = 0;
      let errorOccurred = false;

      try {
        const result = await execPromise(cmd, { cwd: session.projectPath });
        stdout = result.stdout;
        stderr = result.stderr;
        exitCode = 0; // Success case - exit code 0
      } catch (execError: any) {
        errorOccurred = true;
        exitCode = execError.code || 1;
        stdout = execError.stdout || '';
        stderr = execError.stderr || execError.message;
      }

      // Add change entry to session
      const change: CommandRunChange = {
        type: 'command-run',
        cmd,
        exitCode,
        timestamp: new Date().toISOString(),
      };

      session.changes.push(change);
      saveSession(session);

      // If artifact directory is provided, save command output and append event
      if (artifactDir) {
        ensureArtifactDir(artifactDir);
        captureCommandOutput(artifactDir, stdout, stderr, exitCode);

        const event = {
          timestamp: new Date().toISOString(),
          type: 'command',
          cmd,
          exitCode,
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
          command: cmd,
          exitCode,
          stdout,
          stderr,
          success: exitCode === 0 && !errorOccurred,
          policyTrace: policyResult.policyTrace
        })
      );
    } catch (error: any) {
      outputResult(
        errorResult(
          'RUN_COMMAND_ERROR',
          error.message || 'An error occurred while running the command',
          { error: error.stack }
        )
      );
    }
  },
};