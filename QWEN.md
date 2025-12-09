# Project Nexus - QWEN AI Development Context

## Repository Overview

Project Nexus is a multi-project, multi-agent development cockpit designed for structured human–AI collaboration. It organizes work into Projects → Roadmap Lists → Chats and provides an integrated Chat, Terminal, and Code workspace.

The system is built as a browser-based orchestration layer for AI-assisted software development that serves as the command center where multiple projects can be managed simultaneously.

## Core Architecture

### System Components
- **Backend**: Fastify-based API server with REST endpoints, WebSocket terminal support, and database integration
- **Frontend**: Next.js application with four-column UI layout ([Projects] | [Roadmap Lists] | [Chats] | [Main Panel])
- **Agents**: Codex Agent (writes code, generates diffs, updates JSON status) and Meta-Agent (interprets status from child chats)
- **Storage**: Git-backed project storage with metadata tracked via database
- **Terminal**: Persistent server-side shell with WebSocket-based PTY sessions

### Key Technologies
- Node.js 20+ with pnpm monorepo
- TypeScript for type safety
- Postgres database with Drizzle ORM
- Next.js for frontend
- Monaco Editor for code viewing
- Git for version control and project snapshotting

## Agent Management & Orchestration

The system supports multiple AI agents working on different aspects of software development:
- The **Codex Agent** handles coding tasks, file diffs, and status updates
- The **Meta-Agent** processes aggregated information from multiple chats in a roadmap list
- Template-driven workflows with JavaScript logic for interpreting JSON status messages

## Development Workflow

### File Structure
```
/projects/PROJECT_ID/
  meta.json
  roadmapLists/
    ROADMAP_ID/
      meta.json
      chats/
        CHAT_ID/messages.jsonl
  workspace/
```

### Git-Backed Storage
Every project is stored as a Git repository with snapshots corresponding to Git commits. The database synchronizes with Git to provide a unified view.

## AI Integration

The system supports multiple LLMs through the managed-gemini-cli integration:
- Google Gemini models via managed-gemini-cli fork
- Newline-delimited JSON protocol for reliable message streaming
- Multiple communication modes: stdio, TCP server, and future FIFO pipes
- Graceful fallback when AI is unavailable

## Key Features

1. **Multi-Project Management**: Organize multiple projects with separate roadmaps and chats
2. **Template-Driven Workflows**: Structured development with predefined templates
3. **Chat-Based Development**: AI-assisted coding with JSON status reporting
4. **Terminal Integration**: Persistent server-side shell access
5. **Code Visualization**: Read-only file browser and diff viewer
6. **Progress Tracking**: Aggregated status computation via meta-chats
7. **Git Integration**: Version control for project snapshots

## Development Practices

### TypeScript & Type Safety
- Full TypeScript coverage with strict typing
- Shared types across backend and frontend via @nexus/shared package
- Type definitions for all API endpoints and data structures

### Testing & Quality
- Jest-based testing framework
- Component and integration tests
- Type checking with TypeScript compiler

### Security & Authentication
- Session-based authentication with 7-day expiration
- PBKDF2 password hashing with salt
- In-memory fallback for sessions when DB unavailable

## CLI Tools

The system includes the `nexus-cli` tool for administration and setup:
- Project initialization and configuration
- Database setup and migration
- System administration tasks

## Governance & Policy Layer

The system includes a sophisticated policy engine for governing AI agent actions:
- Contextual policy rules with allow/deny/review decisions
- Policy review AI for handling boundary-crossing actions
- Comprehensive logging and audit trails
- Two-edged policy approach allowing contextual exceptions

## Development Commands

- `pnpm dev:backend` - Start backend server (http://localhost:3001)
- `pnpm dev:frontend` - Start frontend server
- `./run.sh` - Helper script to start both backend and frontend
- `pnpm test` - Run tests for shared package

## Reasonableness Guidelines

**What is considered reasonable:**
- Following project conventions in this guide
- Using TypeScript with strict typing
- Implementing proper error handling and fallbacks
- Adding comprehensive tests for new features
- Maintaining backward compatibility when possible
- Using the template-based workflow system

**When to ask for clarification:**
- When requirements conflict with existing architecture
- When you identify potential technical issues with requested changes
- When the scope of work is unclear or seems too large
- When implementation would break existing functionality
- When you need additional context about desired behavior

**When to stop and think:**
- If you notice architectural inconsistencies while implementing
- If there are multiple approaches and you're unsure which to take
- If you identify missing tests or documentation during work
- If you think a better solution exists than what's requested

**When to stop working and explain reasoning:**
- If implementation would violate security practices
- If there are potential data integrity issues in the approach
- If the change would significantly impact performance
- If you encounter technical blockers that prevent implementation
- When requirements appear technically impossible or infeasible

## Target Platforms and Environments

- **Development**: Node.js 20+ with pnpm monorepo
- **Backend**: Fastify server (typically deployed on Linux servers)
- **Frontend**: Modern browsers with ES2020+ support
- **Database**: PostgreSQL (with fallback to in-memory for development)
- **Terminal**: Unix-like systems with PTY support (Linux/macOS primarily)

## Key Documents to Reference

- `AGENTS.md` - Agent behavior and JSON protocols
- `ARCHITECTURE.md` - Deep technical specification
- `CLI.md` - CLI tool reference and administration
- `UX.md` - User interface and interaction patterns
- `ROADMAP.md` - Strategic goals and future direction

This context document provides the essential information for AI assistants to work effectively on Project Nexus development tasks.
