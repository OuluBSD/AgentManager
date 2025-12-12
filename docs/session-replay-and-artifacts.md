# Session Replay & Artifact Capture for Nexus

## Overview

The Nexus Agent and Meta-Orchestrator provide comprehensive session replay and artifact capture capabilities for auditing, debugging, and inspecting AI-driven development sessions. This "session black box recorder" tracks all actions taken during AI-assisted workflows, creating a reproducible and inspectable history of what occurred during each run.

## Motivation

AI-assisted development workflows can be complex and difficult to audit or debug. The artifact capture layer addresses these challenges by:

- **Auditing AI behavior**: Creating a complete record of all actions taken by AI agents
- **Debugging multi-step runs**: Allowing developers to inspect what happened during a multi-step process
- **Providing reproducible history**: Enabling developers to replay and inspect exactly what occurred during a session

## Artifact Directory Structure

For each meta-roadmap orchestrator run, Nexus creates a structured artifact directory under the project:

```
PROJECT_DIR/.nexus-artifacts/
  run-<timestamp>-<random>/
    meta/                 # Meta-session related artifacts
    steps/
      step-1/             # Step 1 artifacts
      step-2/             # Step 2 artifacts
      ...
    build/
      step-1-attempt-1/   # Build attempt 1 for step 1
      step-1-attempt-2/   # Build attempt 2 for step 1
      ...
    sessions/
      meta-session.json   # Meta session state snapshot
      child-step-1.json   # Child session state snapshot
      ...
    logs/
      meta.log            # Meta session logs
      steps-step1.log     # Step 1 logs
      ...
```

### Directory Components

- **`meta/`**: Artifacts related to the meta-orchestrator session (e.g., session state, commands, logs)
- **`steps/step-N/`**: Artifacts for individual execution steps, including file writes and commands
- **`build/step-N-attempt-M/`**: Artifacts for build attempts, including stdout, stderr, exit codes
- **`sessions/`**: Complete snapshots of session states throughout the run
- **`logs/`**: Human-readable logs of the entire orchestration process

Each run directory is created with a timestamp and random ID to ensure uniqueness (`run-YYYYMMDD-HHMMSS-<random>`).

## Using the `--artifact-dir` Flag

The `nexus-agent-tool` CLI supports an optional `--artifact-dir` flag that can be used with all commands:

```bash
# Start command with artifact capture
nexus-agent-tool start --session-id my-session --project-path /path/to/project --artifact-dir /path/to/artifacts

# Log command with artifact capture
nexus-agent-tool log --session-id my-session --message "Some log message" --artifact-dir /path/to/artifacts

# Write file with artifact capture
echo "file content" | nexus-agent-tool write-file --session-id my-session --rel-path src/index.ts --artifact-dir /path/to/artifacts

# Run command with artifact capture
nexus-agent-tool run-command --session-id my-session --cmd "npm install" --artifact-dir /path/to/artifacts

# Describe state with artifact capture
nexus-agent-tool describe-state --session-id my-session --artifact-dir /path/to/artifacts
```

### Artifact Capture Behavior

When `--artifact-dir` is provided, each command captures specific artifacts:

#### `start` Command
- Creates `session-state.json` with the session state at session creation/resumption
- Includes all session metadata in JSON format

#### `log` Command  
- Appends events to `events.log` in JSONL (JSON Lines) format
- Each event contains timestamp, type, message, and session ID

#### `write-file` Command
- Saves a copy of the written file content to `files/<relPath>`
- Maintains the same directory structure as the project
- Appends file-write event to `events.log` with path and byte count

#### `run-command` Command
- Saves `stdout.txt`, `stderr.txt`, and `exitcode` files
- Appends command event to `events.log` with command and exit code

#### `describe-state` Command
- Creates `session-state.json` with the current session state
- Overwrites any previous state snapshot in the same directory

## Meta-Orchestrator Integration

The meta-roadmap orchestrator automatically uses artifact capture when executed:

```bash
nexus meta orchestrate --project-dir /path/to/project
```

The orchestrator:

1. Creates a unique run directory under `PROJECT_DIR/.nexus-artifacts/`
2. Passes appropriate `--artifact-dir` values to all `nexus-agent-tool` calls:
   - Meta session artifacts go to `meta/`
   - Each step's artifacts go to `steps/step-N/`
   - Each build attempt goes to `build/step-N-attempt-M/`
3. Maintains proper separation between meta, step, and build artifacts

## Replay and Inspection

### Using the `describe-replay` Command

The `describe-replay` command reads an artifact run directory and produces a summary:

```bash
nexus-agent-tool describe-replay --artifact-run /path/to/project/.nexus-artifacts/run-20250101-123456-abc123
```

This outputs a JSON summary like:

```json
{
  "artifactRunPath": "/path/to/project/.nexus-artifacts/run-20250101-123456-abc123",
  "meta": {
    "sessionId": "meta-1234567890-abc123",
    "events": 10
  },
  "steps": [
    {
      "index": 1,
      "sessionId": "child-step-1",
      "filesWritten": ["src/index.ts", "README.md"],
      "commands": [
        { "cmd": "npm install", "exitCode": 0 },
        { "cmd": "npm run build", "exitCode": 1 }
      ],
      "buildAttempts": [
        { "attempt": 1, "exitCode": 1 },
        { "attempt": 2, "exitCode": 0 }
      ]
    }
  ]
}
```

### Manual Inspection

You can also manually inspect artifacts:

- Read `events.log` files to see the chronological sequence of actions
- Review `files/` directories to see exactly what files were written
- Check `stdout.txt` and `stderr.txt` in build directories to understand build failures
- Examine `session-state.json` files to understand session state at different points

## Future Usage

Future UIs or meta-tools can use the replay summary data to:

- Visualize the flow of multi-step AI runs
- Identify where failures occurred in the process
- Compare different runs to understand differences
- Automate analysis of successful vs. failed runs

The structured artifact format provides a foundation for building sophisticated tooling around AI-assisted development workflows.