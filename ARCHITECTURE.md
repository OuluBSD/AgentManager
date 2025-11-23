# Project Nexus – Architecture Specification
A detailed technical overview of the systems, subsystems, data flows, and execution models that form the backbone of Project Nexus.  
This document is the authoritative reference for implementers and maintainers.

---

# 1. High-Level Overview
Project Nexus is a **multi-column, multi-agent, multi-chat orchestration environment** built around four pillars:

1. **Hierarchical Project Structure**  
   - Projects → Roadmap Lists → Chats → Messages

2. **LLM-Driven Coding & Analysis**  
   - Codex Agent (primary coding agent)
   - Meta-Agent (roadmap-level interpreter)

3. **Hybrid Workspace Environment**
   - Chat (conversational)
   - Terminal (persistent PTY)
   - Code Viewer (Monaco + diff)

4. **Git-Backed Storage + Database Layer**  
   - DB provides metadata, state, and relationships
   - Git stores project files, chat logs, snapshots

The system is designed to be modular, introspectable, and compatible with multiple LLM providers.

---

# 2. Monorepo Structure
```
/project-nexus
  /apps
    /frontend       (Next.js)
    /backend        (Node.js + API server)
  /packages
    /shared         (types, utils)
  /infra
    docker, deployment, configs
  README.md
  ARCHITECTURE.md
```

---

# 3. Backend Architecture
The backend exposes REST + WebSocket interfaces. Its responsibilities:
- store structured metadata in DB
- construct LLM prompts with correct context
- run template JS logic
- manage persistent PTY sessions
- handle git-backed storage

## 3.1 API Layers
### 3.1.1 REST Endpoints
- Project management
- Roadmap list management
- Chat management
- Template CRUD
- File API (read/write/list)
- Auth endpoints

### 3.1.2 WebSockets
- Terminal PTY streaming
- (Future) Live chat streaming

### 3.1.3 LLM Pipeline
Backend prepares payloads:
- project context
- roadmap context
- chat metadata
- template logic metadata
- pruned/summarized history
- optional file contents

It sends structured requests to the configured agent adapter.

---

## 3.2 Agent Adapters
A pluggable interface:
```ts
interface AgentAdapter {
  generate(req: AgentRequest): Promise<AgentResponseStream>;
}
```

Adapters exist for:
- OpenAI
- Anthropic
- Qwen
- Local inference engines (future)

The backend is provider-agnostic.

---

## 3.3 Template Engine
Templates define recurring task structures.
Each template can include:
- title, goal
- systemPrompt
- starterMessages
- metadata (key/value)
- javascriptPrompt (LLM-generated JS)
- javascript logic (run in meta-chat)

### Execution Flow:
1. Chat created from template → starterMessages seeded
2. Agent responds → JSON-before-stop (if required)
3. Backend runs template JS to interpret status
4. Meta-chat aggregates results

---

## 3.4 Meta-Chat Logic
One meta-chat per roadmap list.  
Its tasks:
- aggregate child chat JSON statuses
- run template JS logic
- produce roadmap progress
- surface errors and blocked states

Meta-chat may:
- execute JavaScript only
- or involve the LLM for clarifications

---

## 3.5 PTY / Terminal Manager
A persistent PTY instance per chat or per roadmap list:
- launched on backend server
- attached/detached via WebSocket
- survives frontend refreshes
- isolated to project directories

---

## 3.6 Git Storage Layer
### Directory Structure
```
/projects/PROJECT_ID/
  meta.json
  roadmapLists/
    ROADMAP_ID/
      meta.json
      chats/
        CHAT_ID/
          messages.jsonl
  workspace/
    ... actual code files ...
```

Git operations:
- commit on snapshot generation
- log-based historical reconstruction
- mapping DB IDs ↔ git paths

---

# 4. Frontend Architecture
Frontend uses Next.js with React Server Components and client-side interactivity.

## 4.1 Global Layout
Four vertical columns:
1. Projects
2. Roadmap Lists
3. Chats
4. Main Panel (tabs)

Main panel tabs:
- Chat (conversation)
- Terminal (PTY)
- Code (Monaco + diff)

---

## 4.2 State Management
Recommended:
- React Query (TanStack Query) for data fetching
- URL params as source of truth for selection
- Local UI state for filters, collapsed groups, theme

---

## 4.3 Theme Engine
Themes come from:
- OS/browser default
- user profile settings
- project-level overrides

Per-message-type styling is defined in a theme registry.

---

## 4.4 Component Layers
### 4.4.1 Project Column
- project list
- quick filter
- grouping
- right-click menus
- theme switching on select

### 4.4.2 Roadmap List Column
- progress bars
- tags
- status colors
- meta-chat access

### 4.4.3 Chats Column
- meta-chat pinned at top
- chat list with heuristic status lines
- percent indicators

### 4.4.4 Main Panel
#### Chat Tab
- header (title, AI status, tasks)
- message list
- filters
- composer with slash commands

#### Terminal Tab
- persistent PTY session
- attach/detach
- optional auto-open per user

#### Code Tab
- file tree
- Monaco view
- diff rendering

---

# 5. Data Flow Summary
## 5.1 Chat Interaction Flow
1. User sends message
2. Backend constructs context
3. Agent adapter sends request to LLM
4. LLM responds, optionally with JSON
5. Backend:
   - parses JSON
   - updates DB
   - updates roadmap progress via meta-chat
   - stores message in git + DB
6. Frontend receives streaming response

---

## 5.2 Roadmap Meta-Flow
1. All child chats produce JSON statuses
2. Meta-chat JS logic interprets them
3. Aggregated values update roadmap list
4. UI refreshes progress and status color

---

## 5.3 Terminal Flow
1. User attaches to PTY
2. WebSocket forwards keystrokes
3. PTY outputs streamed back
4. Terminal stays alive server-side
5. User can reattach later

---

# 6. Authentication & Security Model
- Session tokens stored server-side
- Optional keyfile-based login
- Mapping between OS users + virtual Nexus users
- Access isolation per project directory
- No agent is allowed to execute shell actions directly

---

# 7. Error & Fault Handling
- malformed JSON → automatic correction prompt
- truncated LLM responses → request retry
- PTY errors → reconnect and resume
- git conflicts → displayed in diff viewer
- JS logic errors → meta-chat fallback to AI explanation

---

# 8. Observability & Logging
Logs capture:
- agent interactions
- JSON status objects
- template versions
- errors and fallbacks
- PTY session events

Logs should be pluggable into external systems (Grafana, Loki, Sentry).

---

# 9. Extensibility
Future extension points:
- plugin architecture for templates and JS logic
- semantic search service
- multi-agent roles (architect/reviewer/runtime)
- distributed terminal clusters
- offline/local model inference

---

# 10. Architectural Principles
- **Separation of concerns**: UI, API, agent adapters, and storage remain decoupled.
- **Predictability over autonomy**: humans always approve file changes.
- **Composable templates**: task logic is declarative and modular.
- **Git as truth for history**: DB stores metadata; Git stores files and logs.
- **Provider-agnostic design**: swap LLMs without redesigning flows.

---

# End of Architecture Specification

