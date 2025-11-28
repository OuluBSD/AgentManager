# AI Integration Guide

This document explains how to enable and use AI-powered clarifications in AgentManager's meta-chat system.

## Overview

AgentManager integrates with [Gemini CLI](https://github.com/google-gemini/gemini-cli) to provide intelligent, context-aware responses to questions about your roadmaps and project management workflows. The AI integration uses a TCP-based communication protocol to interact with the Gemini CLI in server mode.

## Features

- **Context-Aware Responses**: AI analyzes your roadmap status, progress, and meta-chat history to provide relevant answers
- **Automatic Fallback**: Gracefully falls back to rule-based responses if AI is unavailable
- **Streaming Support**: Real-time response streaming for better UX
- **Easy Configuration**: Simple environment variable configuration
- **Zero Dependencies**: Uses existing Gemini CLI installation

## Prerequisites

1. **Managed Gemini CLI Installation**

   AgentManager requires the OuluBSD fork of Gemini CLI with TCP server mode support.

   Clone and build from source:

   ```bash
   # Clone the managed-gemini-cli fork
   git clone git@github.com:OuluBSD/managed-gemini-cli.git
   cd managed-gemini-cli

   # Install dependencies
   npm install

   # Build the bundle
   npm run bundle

   # Install globally (creates 'gemini' command)
   npm install -g .
   ```

   **Note:** The standard `@google/gemini-cli` from npm does NOT include the TCP server mode required by AgentManager. You must use the OuluBSD fork.

2. **Gemini Authentication**

   Authenticate with your Google account:

   ```bash
   gemini
   ```

   Follow the OAuth login flow. See [Gemini CLI Authentication](https://github.com/google-gemini/gemini-cli#authentication-options) for details.

## Configuration

### 1. Enable AI in AgentManager

Edit your `.env` file (or create one from `.env.example`):

```bash
# Enable AI-powered clarifications
ENABLE_AI=true

# Optional: Customize Gemini settings
GEMINI_CLI_PATH=gemini              # Path to gemini binary (default: 'gemini')
GEMINI_TCP_PORT=7777                # TCP port for server mode (default: 7777)
GEMINI_MODEL=gemini-2.5-flash       # Model to use (default: gemini-2.5-flash)
```

### 2. Restart the Backend

After updating `.env`, restart the backend server:

```bash
pnpm --filter nexus-backend dev
```

## Usage

### Meta-Chat Clarification Endpoint

Send questions to the AI via the clarification API:

```bash
POST /api/meta-chats/:metaChatId/clarify
Content-Type: application/json
Authorization: Bearer <your-session-token>

{
  "question": "What should we prioritize next in this roadmap?",
  "context": {
    "roadmapId": "roadmap-123",
    "includeHistory": true
  }
}
```

**Response:**

```json
{
  "answer": "Based on your roadmap's 45% progress and 'in_progress' status, I recommend focusing on:\n\n1. Complete the remaining authentication tasks as they're blocking other features\n2. Address the two error-state chats to prevent downstream issues\n3. Begin parallel work on the UI components now that the backend is stable\n\nYour team is making steady progress, but resolving the blocked items will unlock significant downstream work.",
  "confidence": 0.85,
  "sources": ["meta-chat context", "roadmap status", "AI analysis"],
  "suggestions": [
    "Monitor active work and unblock dependencies",
    "Ensure steady progress on active tasks",
    "Complete the remaining authentication tasks",
    "Address the two error-state chats"
  ]
}
```

### Frontend Integration

The meta-chat UI automatically uses the clarification endpoint when you ask questions. The AI integration is transparent to end users.

## How It Works

### Architecture

```
┌─────────────────┐
│  AgentManager   │
│    Backend      │
│                 │
│ ┌─────────────┐ │      TCP Connection
│ │GeminiClient │ │◄────────────────────┐
│ └─────────────┘ │                     │
│        │        │                     │
│        ▼        │                     │
│ ┌─────────────┐ │                     │
│ │aiClarifica- │ │                     │
│ │tion Service │ │                     │
│ └─────────────┘ │                     ▼
└─────────────────┘              ┌────────────┐
                                  │ Gemini CLI │
        ▲                         │   Process  │
        │                         │            │
        │                         │ (TCP Mode) │
        │                         └────────────┘
        │
   HTTP API
   /clarify
```

### Process Flow

1. **Client Request**: User asks a question via `/meta-chats/:id/clarify`
2. **Context Gathering**: Backend collects roadmap status, meta-chat history
3. **AI Connection**: GeminiClient spawns/connects to Gemini CLI TCP server
4. **Prompt Construction**: System builds context-rich prompt with roadmap data
5. **AI Processing**: Gemini analyzes context and generates response
6. **Response Parsing**: Backend extracts suggestions and formats response
7. **Client Response**: Structured JSON returned to client

### TCP Protocol

Communication uses newline-delimited JSON:

**Client → Gemini:**

```json
{ "type": "user_input", "content": "What should we prioritize?" }
```

**Gemini → Client:**

```json
{"type": "status", "state": "responding", "message": "Processing..."}
{"type": "conversation", "role": "assistant", "content": "Based on your roadmap...", "id": 123}
{"type": "status", "state": "idle", "message": "Ready"}
```

## Troubleshooting

### AI Not Responding

1. **Check Managed Gemini CLI Installation**

   ```bash
   gemini --version
   # Should show version with TCP server mode support
   ```

   If command not found, reinstall from the fork:

   ```bash
   cd ~/managed-gemini-cli
   npm run bundle
   npm install -g .
   ```

2. **Verify Authentication**

   ```bash
   gemini
   # Should not prompt for login
   ```

3. **Check Backend Logs**

   ```bash
   # Look for GeminiClient connection messages
   [GeminiClient] Spawning gemini process: gemini
   [GeminiClient] Connecting to TCP port 7777...
   [GeminiClient] Connected to gemini TCP server
   ```

4. **Test TCP Connection Manually**

   ```bash
   # Start Gemini in server mode
   gemini --server-mode tcp --tcp-port 7777

   # In another terminal, test connection
   nc localhost 7777
   {"type":"user_input","content":"Hello"}
   ```

### Fallback Behavior

If AI fails, the system automatically falls back to rule-based responses:

```json
{
  "answer": "Based on the current meta-chat analysis:\n\nStatus: in_progress\n...",
  "confidence": 0.6,
  "sources": ["meta-chat context", "roadmap status"]
}
```

You'll see this log message:

```
[AIClarification] AI request failed, falling back to placeholder: <error>
```

### Common Issues

| Issue                        | Cause                    | Solution                             |
| ---------------------------- | ------------------------ | ------------------------------------ |
| "Connection timeout"         | Gemini CLI not in PATH   | Set `GEMINI_CLI_PATH` to full path   |
| "Process exited with code 1" | Auth not configured      | Run `gemini` and complete OAuth      |
| Port already in use          | Another process on 7777  | Change `GEMINI_TCP_PORT`             |
| Response timeout             | Slow model/large context | Increase timeout or use faster model |

## Configuration Options

### Environment Variables

| Variable          | Default            | Description                 |
| ----------------- | ------------------ | --------------------------- |
| `ENABLE_AI`       | `false`            | Enable AI-powered responses |
| `GEMINI_CLI_PATH` | `gemini`           | Path to gemini binary       |
| `GEMINI_TCP_PORT` | `7777`             | TCP port for server mode    |
| `GEMINI_MODEL`    | `gemini-2.5-flash` | Model to use                |

### Recommended Models

| Model              | Speed  | Cost | Best For                         |
| ------------------ | ------ | ---- | -------------------------------- |
| `gemini-2.5-flash` | ⚡⚡⚡ | 💰   | Quick clarifications (default)   |
| `gemini-2.5-pro`   | ⚡⚡   | 💰💰 | Complex analysis, longer context |
| `gemini-1.5-flash` | ⚡⚡⚡ | 💰   | Fast responses, lower accuracy   |

See [Gemini Models](https://ai.google.dev/gemini-api/docs/models) for full details.

## Performance Considerations

- **First Request Delay**: ~2-3s for Gemini CLI process startup
- **Subsequent Requests**: <1s with connection reuse
- **Connection Pooling**: Single shared Gemini process across all requests
- **Timeout**: 60s default, configurable in code

## Security

- **Sandboxing**: Gemini CLI runs in isolated process
- **No Code Execution**: AI only provides text responses
- **Token Usage**: Uses your Google account quotas
- **Rate Limiting**: Subject to Gemini API limits

## Future Enhancements

- [ ] Support for multiple AI providers (Claude, OpenAI)
- [ ] Custom system prompts per project
- [ ] Conversation history tracking
- [ ] Response caching for common questions
- [ ] Streaming responses to frontend
- [ ] Multi-turn clarification dialogs

## Resources

- [Managed Gemini CLI Fork (OuluBSD)](https://github.com/OuluBSD/managed-gemini-cli) - **Required for AgentManager**
- [Original Gemini CLI](https://github.com/google-gemini/gemini-cli) - Reference only, lacks TCP mode
- [Gemini API Docs](https://ai.google.dev/gemini-api/docs)
- [AgentManager Architecture](../ARCHITECTURE.md)
- [Meta-Chat System](../AGENTS.md)

## Support

If you encounter issues:

1. Check the troubleshooting section above
2. Review backend logs for error messages
3. Test Gemini CLI independently
4. Open an issue with logs and configuration details
