import { createNewSession, loadSession } from '../session-storage';
import { okResult, errorResult, outputResult } from '../utils/output';
import { SessionState } from '../types';
import { ensureArtifactDir, saveSessionArtifact } from '../utils/artifacts';
import fs from 'fs-extra';
import { evaluatePolicy, PolicyEvaluationInput } from '../policy/engine';
import path from 'path';

export const startCommand = {
  command: 'start',
  describe: 'Start a new agent session or resume an existing one',
  builder: (yargs: any) => {
    return yargs
      .option('session-id', {
        describe: 'Unique session identifier',
        demandOption: true,
        type: 'string',
      })
      .option('project-path', {
        describe: 'Path to the project directory',
        demandOption: true,
        type: 'string',
      })
      .option('parent-session-id', {
        describe: 'Parent session identifier (optional)',
        type: 'string',
      })
      .option('backend', {
        describe: 'Backend identifier (qwen, claude, etc.)',
        type: 'string',
      })
      .option('artifact-dir', {
        describe: 'Directory to store artifacts for this command execution',
        type: 'string',
      });
  },
  handler: (argv: any) => {
    const { sessionId, projectPath, parentSessionId, backend, 'artifact-dir': artifactDir } = argv;

    try {
      // Validate that project path exists
      if (!fs.existsSync(projectPath) || !fs.statSync(projectPath).isDirectory()) {
        outputResult(
          errorResult(
            'INVALID_PROJECT_PATH',
            `Project path does not exist or is not a directory: ${projectPath}`
          )
        );
        return;
      }

      // For start command, we'll create a policy evaluation with default policy since session doesn't exist yet
      const defaultPolicy = {}; // Default policy could be loaded from configuration

      const policyInput: PolicyEvaluationInput = {
        action: {
          type: 'start',
          sessionId,
          projectPath
        },
        context: {
          projectPath
        },
        policy: defaultPolicy
      };

      const policyResult = evaluatePolicy(policyInput);

      // Check policy outcome
      if (policyResult.outcome === 'DENY') {
        outputResult(
          errorResult(
            'POLICY_DENIED',
            `Policy denied session start: ${policyResult.reason || 'Policy violation'}`,
            { policyTrace: policyResult.policyTrace }
          )
        );
        return;
      } else if (policyResult.outcome === 'REVIEW') {
        outputResult(
          errorResult(
            'POLICY_REVIEW_REQUIRED',
            `Policy requires review for session start: ${policyResult.reason || 'Policy review required'}`,
            { policyTrace: policyResult.policyTrace }
          )
        );
        return;
      }

      // Load existing session or create a new one
      let session = loadSession(sessionId);

      if (session) {
        // Resume existing session - update status if needed
        session.status = 'active';
        // If project path differs, update it (useful for resuming in different location)
        session.projectPath = projectPath;
        if (parentSessionId) {
          session.parentSessionId = parentSessionId;
        }
        if (backend) {
          session.backend = backend;
        }
      } else {
        // Create new session
        session = createNewSession(sessionId, projectPath, parentSessionId || null, backend);
      }

      // If artifact directory is provided, save the session state as an artifact
      if (artifactDir) {
        ensureArtifactDir(artifactDir);
        saveSessionArtifact(artifactDir, session);

        // Save policy trace as artifact
        const tracePath = path.join(artifactDir, 'policy-trace', `trace-${policyResult.policyTrace.actionId}.json`);
        fs.ensureDirSync(path.dirname(tracePath));
        fs.writeJsonSync(tracePath, policyResult.policyTrace, { spaces: 2 });
      }

      // Save the session state
      outputResult(
        okResult({
          sessionId: session.sessionId,
          projectPath: session.projectPath,
          parentSessionId: session.parentSessionId,
          status: session.status,
          policyTrace: policyResult.policyTrace
        })
      );
    } catch (error: any) {
      outputResult(
        errorResult(
          'START_SESSION_ERROR',
          error.message || 'An error occurred while starting the session',
          { error: error.stack }
        )
      );
    }
  },
};