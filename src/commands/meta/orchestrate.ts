// src/commands/meta/orchestrate.ts
// Meta-orchestration command: creates and executes AI-driven project roadmaps

import { CommandHandler } from '../../runtime/handler-registry';
import { ExecutionContext } from '../../runtime/types';
import { spawn } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import { randomBytes } from 'crypto';

interface OrchestrateConfig {
  projectDir: string;
  description: string;
  minSteps: number;
  maxSteps: number;
  buildMode: 'none' | 'after-each';
  buildCommand?: string;
  fixUntilBuilds?: boolean;
}

export class MetaOrchestrateHandler implements CommandHandler {
  async execute(context: ExecutionContext): Promise<any> {
    try {
      console.log('=== Meta-Roadmap Orchestrator ===\n');

      // Check if required tools are available
      await this.checkRequiredTools();

      // Collect configuration
      const config = await this.collectConfiguration(context.flags);

      // Generate session IDs
      const timestamp = Math.floor(Date.now() / 1000);
      const randomId = randomBytes(4).toString('hex');
      const metaSessionId = `meta-${timestamp}-${randomId}`;

      // Create working directory
      const metaWorkingDir = path.join(config.projectDir, '.nexus-meta');
      if (!fs.existsSync(metaWorkingDir)) {
        fs.mkdirSync(metaWorkingDir, { recursive: true });
      }

      // Start meta session
      console.log(`\nStarting meta session: ${metaSessionId}`);
      await this.runCommand('nexus-agent-tool', [
        'start',
        '--session-id', metaSessionId,
        '--project-path', config.projectDir
      ]);

      // Generate roadmap using AI
      console.log('Generating roadmap using AI...\n');
      await this.generateRoadmap(config, metaSessionId);

      // Check if roadmap was created
      const roadmapPath = path.join(metaWorkingDir, 'meta-roadmap.md');
      if (!fs.existsSync(roadmapPath)) {
        throw new Error('Roadmap file was not created by AI');
      }

      console.log(`Roadmap created at: ${roadmapPath}\n`);

      // Parse and execute roadmap
      console.log('Parsing roadmap and executing steps...');
      const steps = this.parseRoadmap(roadmapPath);
      console.log(`Found ${steps.length} steps to execute\n`);

      const childSessionIds: string[] = [];

      for (let i = 0; i < steps.length; i++) {
        const step = steps[i];
        if (!step) continue;

        const childSessionId = `child-${i + 1}-${timestamp}`;
        childSessionIds.push(childSessionId);

        console.log(`\n--- Step ${i + 1}/${steps.length}: ${step.title} ---`);

        // Start child session
        await this.runCommand('nexus-agent-tool', [
          'start',
          '--session-id', childSessionId,
          '--project-path', config.projectDir
        ]);

        // Log step execution
        await this.runCommand('nexus-agent-tool', [
          'log',
          '--session-id', metaSessionId,
          '--message', `Executing Step ${i + 1}`
        ]);

        // Execute step using AI
        await this.executeStep(config, childSessionId, i + 1, step);

        // Handle build if needed
        if (config.buildMode === 'after-each' && config.buildCommand) {
          await this.handleBuild(
            config,
            childSessionId,
            metaSessionId,
            i + 1
          );
        }

        console.log(`✓ Completed Step ${i + 1}`);
      }

      // Print summary
      console.log('\n=== EXECUTION SUMMARY ===');
      console.log(`Roadmap file: ${roadmapPath}`);
      console.log(`Meta session ID: ${metaSessionId}`);
      console.log(`Child session IDs: ${childSessionIds.join(', ')}`);
      console.log('Session state files can be found in ~/.nexus/agent-sessions/');

      return {
        status: 'ok',
        data: {
          metaSessionId,
          childSessionIds,
          roadmapPath
        }
      };
    } catch (error) {
      throw new Error(`Orchestration failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private async checkRequiredTools(): Promise<void> {
    const tools = ['qwen', 'nexus-agent-tool'];
    for (const tool of tools) {
      try {
        await this.runCommand('which', [tool]);
      } catch {
        throw new Error(`Required tool not found in PATH: ${tool}`);
      }
    }
  }

  private async collectConfiguration(flags: any): Promise<OrchestrateConfig> {
    const projectDir = flags['project-dir'] || await this.prompt('Project directory path: ');

    // Expand ~ if present
    const expandedDir = projectDir.startsWith('~')
      ? projectDir.replace('~', process.env.HOME || '')
      : projectDir;

    if (!fs.existsSync(expandedDir)) {
      throw new Error(`Directory does not exist: ${expandedDir}`);
    }

    const description = flags.description || await this.prompt('Project description: ');
    const minSteps = flags['min-steps'] || parseInt(await this.prompt('Minimum number of roadmap steps: '));
    const maxSteps = flags['max-steps'] || parseInt(await this.prompt('Maximum number of roadmap steps: '));

    const buildModeInput = flags['build-mode'] || await this.prompt('Build mode (none/after-each): ');
    const buildMode = buildModeInput === 'after-each' ? 'after-each' : 'none';

    let buildCommand: string | undefined;
    let fixUntilBuilds: boolean | undefined;

    if (buildMode === 'after-each') {
      buildCommand = flags['build-command'] || await this.prompt('Build command (e.g. npm run build): ');
      const fixInput = flags['fix-until-builds'] || await this.prompt('Fix until builds (yes/no): ');
      fixUntilBuilds = fixInput.toLowerCase() === 'yes';
    }

    return {
      projectDir: expandedDir,
      description,
      minSteps,
      maxSteps,
      buildMode,
      buildCommand,
      fixUntilBuilds
    };
  }

  private prompt(question: string): Promise<string> {
    return new Promise((resolve) => {
      process.stdout.write(question);

      const chunks: Buffer[] = [];
      const onData = (chunk: Buffer) => {
        const str = chunk.toString();
        // Check for newline
        if (str.includes('\n')) {
          process.stdin.removeListener('data', onData);
          process.stdin.pause();
          const fullInput = Buffer.concat(chunks).toString() + str;
          const answer = (fullInput.split('\n')[0] || '').trim();
          resolve(answer);
        } else {
          chunks.push(chunk);
        }
      };

      process.stdin.resume();
      process.stdin.on('data', onData);
    });
  }

  private async generateRoadmap(config: OrchestrateConfig, sessionId: string): Promise<void> {
    const prompt = `You are a project planning expert. Your task is to create a detailed roadmap for a software project with the following description:

Project Description: ${config.description}
Minimum Steps: ${config.minSteps}
Maximum Steps: ${config.maxSteps}

Create a roadmap that follows these requirements:
1. The roadmap must have between ${config.minSteps} and ${config.maxSteps} steps
2. Each step should have:
   - A clear title
   - A detailed description of what needs to be accomplished
3. All file operations must be done using nexus-agent-tool
4. Write the roadmap to .nexus-meta/meta-roadmap.md using this command format:
   echo 'YOUR_MARKDOWN_CONTENT' | nexus-agent-tool write-file --session-id "${sessionId}" --rel-path ".nexus-meta/meta-roadmap.md"

Format the roadmap as a markdown document with the following structure:
# [Project Title] Roadmap

## Step 1: [Title]
[Detailed description of what this step accomplishes]

## Step 2: [Title]
[Detailed description of what this step accomplishes]

(Continue for each step)

Now create and write the roadmap.`;

    await this.runQwen(config.projectDir, prompt);
  }

  private parseRoadmap(roadmapPath: string): Array<{ stepNumber: number; title: string; description: string }> {
    const content = fs.readFileSync(roadmapPath, 'utf-8');
    const steps: Array<{ stepNumber: number; title: string; description: string }> = [];

    // Split by step headers
    const stepRegex = /^## Step (\d+): (.+)$/gm;
    let match;
    const stepPositions: Array<{ stepNumber: number; title: string; start: number }> = [];

    while ((match = stepRegex.exec(content)) !== null) {
      const stepNum = match[1];
      const stepTitle = match[2];
      if (stepNum && stepTitle) {
        stepPositions.push({
          stepNumber: parseInt(stepNum),
          title: stepTitle.trim(),
          start: match.index
        });
      }
    }

    // Extract descriptions
    for (let i = 0; i < stepPositions.length; i++) {
      const current = stepPositions[i];
      if (!current) continue;

      const next = stepPositions[i + 1];
      const end = next ? next.start : content.length;

      const stepContent = content.substring(current.start, end);
      // Remove the header line and get the description
      const lines = stepContent.split('\n').slice(1);
      const description = lines
        .filter(line => !line.match(/^## Step \d+:/))
        .join('\n')
        .trim();

      steps.push({
        stepNumber: current.stepNumber,
        title: current.title,
        description
      });
    }

    return steps;
  }

  private async executeStep(
    config: OrchestrateConfig,
    sessionId: string,
    stepNumber: number,
    step: { title: string; description: string }
  ): Promise<void> {
    const prompt = `You are implementing Step ${stepNumber} of a project roadmap.

Step Title: ${step.title}
Step Description: ${step.description}

Project Directory: ${config.projectDir}
Session ID: ${sessionId}

Your task is to implement this step completely using nexus-agent-tool commands. You must:
1. Use ONLY nexus-agent-tool for all file operations (write-file, run-command, log)
2. Make all file writes using: echo 'content' | nexus-agent-tool write-file --session-id "${sessionId}" --rel-path "path/to/file"
3. Run any necessary shell commands using: nexus-agent-tool run-command --session-id "${sessionId}" --cmd "command"
4. Create directories as needed before writing files
5. Implement the step completely - don't just create TODO comments

For example, to create a Python file with actual implementation:
echo 'import sys
import math

def calculate(expression):
    """Evaluate a mathematical expression"""
    try:
        result = eval(expression)
        return result
    except Exception as e:
        return f"Error: {e}"

def main():
    print("Math Calculator")
    while True:
        expr = input("> ")
        if expr.lower() in ["exit", "quit"]:
            break
        print(calculate(expr))

if __name__ == "__main__":
    main()' | nexus-agent-tool write-file --session-id "${sessionId}" --rel-path "src/calculator.py"

Now implement Step ${stepNumber} completely with full, working code.`;

    await this.runQwen(config.projectDir, prompt);
  }

  private async handleBuild(
    config: OrchestrateConfig,
    childSessionId: string,
    metaSessionId: string,
    stepNumber: number
  ): Promise<void> {
    if (!config.buildCommand) return;

    console.log(`\nRunning build: ${config.buildCommand}`);

    try {
      const result = await this.runCommand('nexus-agent-tool', [
        'run-command',
        '--session-id', childSessionId,
        '--cmd', config.buildCommand
      ], { captureOutput: true });

      const exitCode = result.exitCode || 0;

      if (exitCode !== 0 && config.fixUntilBuilds) {
        console.log('Build failed, attempting to fix...');

        const maxAttempts = 5;
        let attempt = 1;

        while (attempt <= maxAttempts) {
          console.log(`Fix attempt ${attempt}/${maxAttempts}`);

          const fixPrompt = `Build failed with the following output:
${result.stdout}
${result.stderr}

Please analyze the build errors and fix them using nexus-agent-tool to:
1. Modify necessary files to resolve the build issues
2. Focus only on fixing the errors that are preventing the build from completing

Use nexus-agent-tool with session ID: ${childSessionId}`;

          await this.runQwen(config.projectDir, fixPrompt);

          // Test build again
          const retryResult = await this.runCommand('nexus-agent-tool', [
            'run-command',
            '--session-id', childSessionId,
            '--cmd', config.buildCommand
          ], { captureOutput: true });

          if ((retryResult.exitCode || 0) === 0) {
            console.log(`✓ Build succeeded after ${attempt} attempt(s)`);
            return;
          }

          attempt++;
        }

        console.log(`✗ Build still failing after ${maxAttempts} attempts`);
        await this.runCommand('nexus-agent-tool', [
          'log',
          '--session-id', metaSessionId,
          '--message', `Build failed after ${maxAttempts} attempts for Step ${stepNumber}`
        ]);
      } else if (exitCode === 0) {
        console.log('✓ Build succeeded');
      }
    } catch (error) {
      console.error(`Build error: ${error}`);
    }
  }

  private async runQwen(cwd: string, prompt: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const qwen = spawn('qwen', ['-y'], {
        cwd,
        stdio: ['pipe', 'inherit', 'inherit']
      });

      qwen.stdin.write(prompt);
      qwen.stdin.end();

      qwen.on('close', (code) => {
        if (code === 0) {
          resolve();
        } else {
          reject(new Error(`Qwen exited with code ${code}`));
        }
      });

      qwen.on('error', (error) => {
        reject(new Error(`Failed to spawn qwen: ${error.message}`));
      });
    });
  }

  private runCommand(
    command: string,
    args: string[],
    options?: { captureOutput?: boolean }
  ): Promise<{ exitCode: number; stdout: string; stderr: string }> {
    return new Promise((resolve, reject) => {
      if (options?.captureOutput) {
        const proc = spawn(command, args, { stdio: ['ignore', 'pipe', 'pipe'] });
        let stdout = '';
        let stderr = '';

        proc.stdout.on('data', (data: Buffer) => { stdout += data.toString(); });
        proc.stderr.on('data', (data: Buffer) => { stderr += data.toString(); });

        proc.on('close', (code: number | null) => {
          resolve({ exitCode: code || 0, stdout, stderr });
        });

        proc.on('error', (error: Error) => {
          reject(error);
        });
      } else {
        const proc = spawn(command, args, { stdio: 'inherit' });

        proc.on('close', (code: number | null) => {
          if (code === 0) {
            resolve({ exitCode: 0, stdout: '', stderr: '' });
          } else {
            reject(new Error(`Command failed with exit code ${code}`));
          }
        });

        proc.on('error', (error: Error) => {
          reject(error);
        });
      }
    });
  }

  validate(args: any): any {
    return { isValid: true, args };
  }
}
