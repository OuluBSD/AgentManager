# Nexus CLI - Chat Stack Hello World

This document describes the minimal end-to-end chat stack implementation in the Nexus CLI, showing how to establish a reliable chat flow from the CLI through the backend to the Qwen AI and back.

## Architecture Overview

The chat flow consists of the following components:
1. **Nexus CLI**: Command-line interface that handles user commands
2. **Backend API**: REST and WebSocket/polling API that connects to AI services
3. **Qwen AI Service**: The actual AI backend processing requests
4. **Observability Layer**: Unified Observability Layer (UOL) for monitoring

## Starting the Services

### 1. Start the Backend Server

```bash
cd apps/backend
npm install
npm run dev
```

The backend will start on `http://localhost:3000` by default.

### 2. Ensure Qwen Service is Running

Make sure the Qwen AI service is accessible to the backend (either running locally or accessible via network). By default, the backend is configured to connect to a Qwen server running on `localhost:7777` in TCP mode.

## Required Commands for End-to-End Chat Flow

### Step 1: Project Setup

```bash
# Create a new project (optional if using existing)
nexus agent project create --name "Hello World Chat" --category "Testing"

# Or select an existing project
nexus agent project select --id <project-id>

# View current project
nexus agent project current
```

### Step 2: Roadmap Setup

```bash
# Create a roadmap for the selected project
nexus agent roadmap create --name "Chat Demo" --description "Hello World Chat Demo"

# Or select an existing roadmap
nexus agent roadmap select --id <roadmap-id>

# View current roadmap
nexus agent roadmap current
```

### Step 3: Chat Setup

```bash
# Create a chat for the selected roadmap
nexus agent chat create --name "Hello World Chat" --description "Initial chat for demo"

# Or select an existing chat
nexus agent chat select --id <chat-id>

# View current chat
nexus agent chat current
```

### Step 4: AI Session Setup

```bash
# Create an AI session
nexus ai session create

# Check AI backend status
nexus ai backend status

# List available AI backends
nexus ai backend list

# Ensure Qwen backend is selected (default)
nexus ai backend select qwen
```

### Step 5: Send Chat Message

```bash
# Send a message and receive streaming response
nexus ai message send --text "Hello from Nexus CLI"
```

## Example Output

### Project/roadmap/chat selection:
```json
{
  "status": "ok",
  "data": {
    "id": "proj-12345",
    "name": "Hello World Chat",
    "category": "Testing",
    "status": "active"
  },
  "message": "Project selected successfully",
  "errors": []
}
```

### AI session creation:
```json
{
  "status": "ok",
  "data": {
    "sessionId": "ai-session-1701234567890",
    "type": "chat",
    "createdAt": "2025-11-28T10:30:45.123Z"
  },
  "message": "AI session created successfully",
  "errors": []
}
```

### Streaming token events for "Hello from Nexus CLI":
```
{"seq":1,"timestamp":"2025-11-28T10:31:15.123Z","source":"ai","event":"stream-start","message":"Started streaming ai-stream from ai","correlationId":"a1b2c3d4-e5f6-7890-1234-567890abcdef","metadata":{"streamKind":"ai-stream","commandId":"ai:message:send"}}
{"seq":2,"timestamp":"2025-11-28T10:31:15.173Z","source":"ai","event":"token","data":{"event":"token","content":"Hello","messageId":"msg-1701234567890-abc123","chunkIndex":0},"correlationId":"a1b2c3d4-e5f6-7890-1234-567890abcdef","metadata":{"streamKind":"ai-stream","commandId":"ai:message:send"}}
{"seq":3,"timestamp":"2025-11-28T10:31:15.223Z","source":"ai","event":"token","data":{"event":"token","content":" from","messageId":"msg-1701234567890-bcd234","chunkIndex":1},"correlationId":"a1b2c3d4-e5f6-7890-1234-567890abcdef","metadata":{"streamKind":"ai-stream","commandId":"ai:message:send"}}
{"seq":4,"timestamp":"2025-11-28T10:31:15.273Z","source":"ai","event":"token","data":{"event":"token","content":" Nexus","messageId":"msg-1701234567890-cde345","chunkIndex":2},"correlationId":"a1b2c3d4-e5f6-7890-1234-567890abcdef","metadata":{"streamKind":"ai-stream","commandId":"ai:message:send"}}
{"seq":5,"timestamp":"2025-11-28T10:31:15.323Z","source":"ai","event":"token","data":{"event":"token","content":" CLI","messageId":"msg-1701234567890-def456","chunkIndex":3},"correlationId":"a1b2c3d4-e5f6-7890-1234-567890abcdef","metadata":{"streamKind":"ai-stream","commandId":"ai:message:send"}}
{"seq":6,"timestamp":"2025-11-28T10:31:15.373Z","source":"ai","event":"token","data":{"event":"token","content":"!","messageId":"msg-1701234567890-efg567","chunkIndex":4},"correlationId":"a1b2c3d4-e5f6-7890-1234-567890abcdef","metadata":{"streamKind":"ai-stream","commandId":"ai:message:send"}}
{"seq":7,"timestamp":"2025-11-28T10:31:15.423Z","source":"ai","event":"done","data":{"event":"done","content":"","messageId":"msg-1701234567890-fgh678","chunkIndex":5,"isFinal":true},"correlationId":"a1b2c3d4-e5f6-7890-1234-567890abcdef","metadata":{"streamKind":"ai-stream","commandId":"ai:message:send","isFinal":true}}
{"seq":8,"timestamp":"2025-11-28T10:31:15.473Z","source":"ai","event":"stream-end","message":"Completed streaming ai-stream from ai","correlationId":"a1b2c3d4-e5f6-7890-1234-567890abcdef","metadata":{"streamKind":"ai-stream","commandId":"ai:message:send","isFinal":true}}
```

## Troubleshooting

### Common Issues:

1. **Backend not responding**: Ensure the backend server is running on the expected port (default: 3000)

2. **Qwen service not accessible**: Verify that the Qwen service is running and accessible from the backend

3. **Authentication errors**: Make sure to authenticate with the backend before sending chat requests

4. **Connection timeouts**: The polling implementation has a 60-second timeout for responses

## Implementation Notes

- The CLI uses the HTTP polling API to communicate with the backend to avoid requiring a WebSocket client library in the CLI
- All streaming events are processed through the Unified Observability Layer (UOL) with proper correlation IDs
- The implementation supports multiple AI backends (qwen, claude, gemini, codex) with qwen as the default
- All API requests include proper authentication tokens when available
- The backend handles the complex process of connecting to the Qwen C++ TCP server