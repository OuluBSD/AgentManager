# Nexus Agent Tool

The Nexus Agent Tool (`nexus-agent-tool`) is a standalone command-line interface designed to serve as a hypervisor for AI agents. It provides a consistent, structured API for AI agents to interact with the project environment, files, and commands safely.

## Purpose

The agent tool was created to:

1. Provide a backend-agnostic interface for AI agents (Qwen, Claude, Gemini, etc.)
2. Offer a single, stable entrypoint for all AI agent interactions with the project
3. Enable safe file operations and command execution within project directories
4. Track and manage session state for AI agent activities
5. Maintain clean, structured JSON output suitable for AI consumption

## Installation

After building the Nexus CLI, the `nexus-agent-tool` binary will be available in your system PATH.

## Usage

The agent tool provides several subcommands to manage AI agent sessions and operations:

### `start`

Starts a new agent session or resumes an existing one:

```bash
nexus-agent-tool start --session-id <id> --project-path <path> [--parent-session-id <id>] [--backend qwen|claude|...]
```

### `log`

Adds a log message to the current session:

```bash
nexus-agent-tool log --session-id <id> --message "some note"
```

### `write-file`

Writes content to a file in the project directory:

```bash
echo "file content" | nexus-agent-tool write-file --session-id <id> --rel-path "path/to/file.txt"
```

### `run-command`

Executes a command in the project directory:

```bash
nexus-agent-tool run-command --session-id <id> --cmd "npm test"
```

### `describe-state`

Displays the current state of a session:

```bash
nexus-agent-tool describe-state --session-id <id>
```

## Output Format

All commands return structured JSON following this pattern:

```json
{
  "status": "ok" | "error",
  "data": { ... },
  "errors": [
    {
      "type": "SOME_ERROR_CODE",
      "message": "Human readable",
      "details": { ... }
    }
  ]
}
```

## Session State

Each session is stored as a JSON file in `~/.nexus/agent-sessions/<sessionId>.json` with the following structure:

```json
{
  "sessionId": "sess-001",
  "projectPath": "/absolute/path/to/project",
  "parentSessionId": null,
  "backend": "qwen",
  "notes": [],
  "changes": [
    {
      "type": "file-write",
      "relPath": "src/foo.ts",
      "timestamp": "2025-12-09T12:34:56Z"
    }
  ],
  "status": "active"
}
```

## Integration with AI Agents

AI agents should be instructed to use `nexus-agent-tool` for any interaction with the project environment, rather than directly manipulating files or running commands. This ensures:

1. All actions are properly tracked and logged
2. File operations are safe and contained within the project directory
3. Command execution is monitored and recorded
4. Session state is maintained consistently