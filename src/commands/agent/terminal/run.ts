// src/commands/agent/terminal/run.ts
// Terminal run command handler

import { ExecutionContext, CommandResult } from '../../../runtime/types';
import { spawn } from 'child_process';
import { ObservabilityEvent } from '../../../observability/types';

export class TerminalRunHandler {
  async execute(context: ExecutionContext): Promise<CommandResult | AsyncGenerator<any>> {
    try {
      const { command, 'project-id': projectIdFromFlag, cwd } = context.flags;
      const { activeProjectId, activeProjectName } = context.contextState || {};

      // Use the project ID from the flag if provided, otherwise use the active project
      const projectId = projectIdFromFlag || activeProjectId;

      if (!projectId) {
        return {
          status: 'error',
          data: null,
          message: 'No project specified. Use --project-id or select an active project first.',
          errors: [{
            type: 'MISSING_REQUIRED_CONTEXT',
            message: 'No project context available',
            details: { requiredContext: 'activeProject' }
          }]
        };
      }

      // Use the project root as the working directory if not specified
      const workingDir = cwd || `/tmp/project-${projectId}`; 

      // Create the async generator that will stream command execution
      const generator = this.createCommandStream(command, workingDir, context);
      return generator;
    } catch (error: any) {
      return {
        status: 'error',
        data: null,
        message: `Failed to run command: ${error.message}`,
        errors: [{
          type: 'COMMAND_EXECUTION_ERROR',
          message: error.message
        }]
      };
    }
  }

  private async createCommandStream(command: string, workingDir: string, context: ExecutionContext): Promise<AsyncGenerator<ObservabilityEvent>> {
    // Using a more complex implementation to properly stream command output
    // This represents the actual implementation needed for command execution

    // Create a queue to store events
    const eventQueue: ObservabilityEvent[] = [];
    let isFinished = false;
    let nextResolve: ((value: IteratorResult<ObservabilityEvent>) => void) | null = null;

    // Start the command execution
    const commandId = `cmd-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
    let seqCounter = 0;

    // Send initial command start event
    const projectId = context.contextState?.activeProjectId;
    eventQueue.push({
      seq: ++seqCounter,
      timestamp: new Date().toISOString(),
      source: "process",
      event: "command-start",
      data: { command, workingDir, commandId },
      message: `Executing command: ${command}`,
      correlationId: commandId,
      metadata: {
        commandId,
        projectId,
        command,
        workingDir
      }
    });

    // Execute the command in the project context
    const childProcess = spawn(command, {
      shell: true,
      cwd: workingDir,
      env: { ...process.env }
    });

    // Set up callback functions for queueing events
    const enqueueEvent = (event: ObservabilityEvent) => {
      eventQueue.push(event);
      if (nextResolve) {
        const resolve = nextResolve;
        nextResolve = null;
        resolve({ value: event, done: false });
      }
    };

    // Capture and stream stdout
    childProcess.stdout?.on('data', (data: Buffer) => {
      const output = data.toString();
      enqueueEvent({
        seq: ++seqCounter,
        timestamp: new Date().toISOString(),
        source: "process",
        event: "stdout",
        data: { output, commandId },
        message: output,
        correlationId: commandId,
        metadata: {
          commandId,
          projectId,
          command,
          workingDir,
          stream: "stdout"
        }
      });
    });

    // Capture and stream stderr
    childProcess.stderr?.on('data', (data: Buffer) => {
      const output = data.toString();
      enqueueEvent({
        seq: ++seqCounter,
        timestamp: new Date().toISOString(),
        source: "process",
        event: "stderr",
        data: { output, commandId },
        message: output,
        correlationId: commandId,
        metadata: {
          commandId,
          projectId,
          command,
          workingDir,
          stream: "stderr"
        }
      });
    });

    // Handle process exit
    childProcess.on('close', (code, signal) => {
      // Add exit event to the queue
      enqueueEvent({
        seq: ++seqCounter,
        timestamp: new Date().toISOString(),
        source: "process",
        event: "exit",
        data: { code, signal, commandId },
        message: `Process exited with code: ${code}, signal: ${signal || 'N/A'}`,
        correlationId: commandId,
        metadata: {
          commandId,
          projectId,
          command,
          workingDir,
          exitCode: code,
          exitSignal: signal
        }
      });

      // Add command completion event
      enqueueEvent({
        seq: ++seqCounter,
        timestamp: new Date().toISOString(),
        source: "process",
        event: "command-complete",
        data: { command, workingDir, commandId, exitCode: code },
        message: `Command completed with exit code: ${code}`,
        correlationId: commandId,
        metadata: {
          commandId,
          projectId,
          command,
          workingDir,
          exitCode: code
        }
      });

      isFinished = true;
      if (nextResolve) {
        const resolve = nextResolve;
        nextResolve = null;
        resolve({ value: undefined, done: true });
      }
    });

    // Handle process errors
    childProcess.on('error', (err) => {
      enqueueEvent({
        seq: ++seqCounter,
        timestamp: new Date().toISOString(),
        source: "process",
        event: "error",
        data: { error: err.message, commandId },
        message: `Process error: ${err.message}`,
        correlationId: commandId,
        metadata: {
          commandId,
          projectId,
          command,
          workingDir,
          error: err.message
        }
      });

      isFinished = true;
      if (nextResolve) {
        const resolve = nextResolve;
        nextResolve = null;
        resolve({ value: undefined, done: true });
      }
    });

    // Define and return the async generator
    const asyncGen = async function *(): AsyncGenerator<ObservabilityEvent> {
      while (!isFinished || eventQueue.length > 0) {
        if (eventQueue.length > 0) {
          yield eventQueue.shift()!;
        } else {
          // Wait for the next event
          yield await new Promise<ObservabilityEvent>((resolve) => {
            nextResolve = (result: IteratorResult<ObservabilityEvent>) => {
              if (result.done) {
                resolve(undefined as any);
              } else {
                resolve(result.value);
              }
            };
          });
        }
      }
    };

    return asyncGen();
  }

  validate(args: any): any {
    if (!args.command) {
      throw new Error('Command is required for terminal run');
    }

    return {
      isValid: true,
      args
    };
  }
}