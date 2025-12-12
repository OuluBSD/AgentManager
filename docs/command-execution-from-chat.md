# Code Execution from Chat (Project Repo Integration)

This document explains how to execute commands within project directories directly from the Nexus CLI chat interface, with both WebSocket and polling fallback support.

## Overview

The Nexus CLI provides a way to execute commands directly in project directories from the chat context. This enables AI interactions to trigger code execution, tests, builds, and other shell operations within the project environment.

## Available Commands

### 1. Execute Command in Terminal Context
```
nexus agent terminal run --command "<shell command>" --project-id <projectId>
```

### 2. Execute Command via Chat Context
```
nexus agent chat run-command --command "<shell command>" --chat-id <chatId> --project-id <projectId>
```

## Transport Methods

### WebSocket (Primary)
- Real-time streaming of command output
- Low latency interaction
- Used by default when available

### Polling (Fallback)
- HTTP-based polling for output retrieval
- Used when WebSocket is unavailable
- Provides the same functionality as WebSocket

## Example Usage

### Basic Command Execution
```bash
# In a project context, execute a simple command
nexus agent terminal run --command "ls -la"

# Execute a command in a specific project
nexus agent terminal run --command "npm test" --project-id my-project-123

# Run a build command with explicit working directory
nexus agent terminal run --command "make build" --project-id my-project-123 --cwd ./src
```

### Command Execution from Chat
```bash
# Execute a command tied to a specific chat and project
nexus agent chat run-command --command "git status" --chat-id chat-456 --project-id project-123

# Execute build command through chat context
nexus agent chat run-command --command "npm run build" --chat-id my-chat-id --project-id my-project-id
```

## How It Works

1. **Project Context**: The system identifies the project directory for command execution
2. **Command Initiation**: A command is sent to the backend for execution
3. **Process Spawning**: The backend spawns the process in the project's directory
4. **Output Streaming**: Command output is streamed via:
   - WebSocket (real-time)
   - OR polling fallback (when WebSocket unavailable)
5. **Observability**: All events are logged and correlated via UOL (Unified Observability Layer)

## Implementation Details

- Commands execute in the project's directory by default
- Working directory can be overridden with the `--cwd` flag
- Both WebSocket and polling transports produce consistent ObservabilityEvent streams
- Events are tagged with correlation IDs to link chat context with command execution
- Process output is captured and streamed in real-time

## Transport Robustness

The system automatically handles transport failures:

1. **If WebSocket fails**: Falls back to HTTP polling
2. **If polling is preferred**: Uses HTTP polling exclusively  
3. **Session persistence**: Both methods maintain command session information
4. **Output consistency**: Both transports provide identical output streams

## Troubleshooting

### Common Issues
- "Command not found": Ensure the command is available in the project directory's PATH
- "Permission denied": Check that the project directory has appropriate permissions
- "WebSocket connection failed": The system should automatically fall back to polling

### Verification Steps
1. Confirm project selection: `nexus agent project current`
2. Verify chat selection: `nexus agent chat current` 
3. Test basic command: `nexus agent terminal run --command "pwd"`

## API Endpoints

- `POST /api/terminal/execute` - Initiate command execution
- `GET /api/terminal/execute/:commandId/stream` - WebSocket streaming endpoint
- `GET /api/terminal/execute/:commandId/poll` - Polling for output endpoint