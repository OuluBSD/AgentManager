# Project Nexus – Agents Specification
This document defines the behavior, expectations, and interfaces for the primary AI coding agent ("Codex agent") within Project Nexus. It focuses on how the agent collaborates with users, roadmap lists, and meta-logic rather than on any specific model provider.

The goal is to keep the agent predictable, inspectable, and easy to swap across different LLM backends.

---

## 1. Agent Roles

### 1.1 Primary Coding Agent (Codex Agent)
The Codex agent is responsible for:
- understanding project and chat goals
- proposing, explaining, and implementing code changes
- reading and summarizing relevant files from the workspace
- generating diffs and patches
- updating JSON status when required by templates

It does **not**:
- autonomously execute terminal commands
- silently modify files without presenting changes
- manage user accounts, security, or access control

### 1.2 Meta-Agent (Roadmap Meta-Chat)
The meta-agent is tied to the roadmap list’s meta-chat. It:
- interprets JSON status messages from the Codex agent
- executes template-defined JavaScript logic
- aggregates progress into roadmap-level status
- updates heuristic summaries for the roadmap list

This meta-agent may call the same underlying model as the Codex agent, but with a different prompt and objective.

---

## 2. Context Model

When the Codex agent is invoked for a given chat, it receives structured context:

```jsonc
{
  "project": {
    "id": "PROJECT_ID",
    "name": "Project Name",
    "description": "Short description of the project",
    "tags": ["backend", "cli"]
  },
  "roadmapList": {
    "id": "ROADMAP_LIST_ID",
    "title": "Refactor authentication module",
    "tags": ["refactor", "security"],
    "progress": 0.42
  },
  "chat": {
    "id": "CHAT_ID",
    "title": "Implement JWT rotation",
    "goal": "Add a rotating JWT mechanism with minimal downtime.",
    "status": "in_progress",
    "templateId": "TEMPLATE_ID | null"
  },
  "template": {
    "id": "TEMPLATE_ID | null",
    "title": "Security feature implementation",
    "systemPrompt": "...",
    "javascript": "...",
    "metadata": { /* key/value */ }
  },
  "history": [
    // Chat messages selected by the backend (truncated/summarized when needed)
  ],
  "workspace": {
    "rootPath": "/projects/PROJECT_ID/workspace",
    "relevantFiles": [
      // Optionally included snippets or file paths
    ]
  }
}
```

The backend is responsible for constructing this payload, pruning and summarizing history as needed to stay within token limits.

---

## 3. Prompting Conventions

### 3.1 System Prompt Guidelines
System prompts for the Codex agent should:
- describe the project and chat goals
- define the expected output format (plain text, JSON, diff, etc.)
- state non-negotiable constraints (language, frameworks, security rules)
- remind the agent of the JSON status protocol when active

Example system prompt fragment:

> You are an AI coding assistant working inside Project Nexus.  
> You receive a project, a roadmap list, and a specific chat with a goal.  
> Always explain your reasoning concisely in natural language before producing code or diffs.  
> When the template requires it, output a JSON status object before you stop.

### 3.2 JSON-Before-Stop Protocol
Certain templates require the agent to output a JSON status object before every pause. The object is:

```jsonc
{
  "status": "in_progress | waiting | done | blocked",
  "progress": 0.0,
  "focus": "short description of what you are working on",
  "nextActions": ["..."],
  "notes": "optional freeform text",
  "errors": []
}
```

The backend or template-specific JavaScript uses this JSON to:
- update chat status
- compute roadmap progress
- raise alerts for blocked/error states

The agent’s response in these cases has two layers:
1. JSON object (machine-readable)
2. Human-readable explanation and any code/diff content

---

## 4. File and Diff Handling

### 4.1 Reading Files
The agent does not have arbitrary direct file access. It must:
- ask for specific files or directories
- receive content or summaries via the backend

Backend responsibilities:
- enforce path whitelists (project-scoped)
- allow only configured directories

### 4.2 Writing Files
The agent never writes files directly. Instead, it:
- proposes patches as diffs
- or provides full file replacements

Recommended diff format:

```diff
--- a/path/to/file.ts
+++ b/path/to/file.ts
@@ -10,6 +10,10 @@
 existing line
+new line
+another new line
 existing line
```

The frontend renders diffs with syntax highlighting and clear color coding.  
The backend applies diffs only after explicit user confirmation or according to configured policies.

---

## 5. Terminal Interaction

The Codex agent:
- may suggest commands to run
- may interpret command output pasted by the user

It does **not** directly control the terminal session.  
The terminal is user-owned and its PTY session is persistent on the server.

Recommended pattern:
- Agent proposes commands in fenced code blocks, e.g.:

```bash
# Suggested command
npm test -- --runInBand
```

The user may copy these commands into the terminal or use optional future tooling to run them with confirmation.

---

## 6. Meta-Chat & JavaScript Logic

Each roadmap list has a meta-chat linked to its templates and JS logic.

### 6.1 Meta-Chat Inputs
The meta-chat may receive:
- recent JSON status objects from child chats
- summarized chats histories
- roadmap configuration and thresholds

### 6.2 JavaScript Execution
Templates can provide JavaScript that:
- interprets JSON status
- aggregates progress
- generates human-readable summaries

Example pattern:

```js
function interpretStatus(json) {
  if (json.errors && json.errors.length > 0) {
    return { state: 'blocked', reason: json.errors[0] };
  }
  if (json.progress >= 1) {
    return { state: 'done', reason: 'All subtasks complete.' };
  }
  return { state: json.status || 'in_progress', reason: json.focus };
}
```

The meta-agent may call this function to derive aggregated status for UI display.

---

## 7. Error Handling & Robustness

The Codex agent should:
- fail gracefully when context is missing or ambiguous
- ask clarifying questions instead of hallucinating file structure
- explicitly mark uncertain assumptions

Backend safeguards:
- detect malformed JSON and request reformatting
- cap maximum number of file operations per interaction
- limit response size

---

## 8. Swappability

The agent spec is model-agnostic. Different providers (OpenAI, Anthropic, Qwen, etc.) can be swapped in as long as they support:
- streaming responses
- sufficient context window
- deterministic output formatting when asked

Adapter responsibilities per provider:
- map common config (temperature, max tokens)
- implement a common interface such as:

```ts
interface AgentAdapter {
  generate(opts: AgentRequest): Promise<AgentResponseStream>;
}
```

This allows the rest of Nexus to treat the Codex agent as a stable service.

---

## 9. Logging & Observability

For each agent interaction, log:
- projectId, roadmapListId, chatId
- templateId (if any)
- request metadata (model, maxTokens, temperature)
- response metadata (token count, truncated flags)
- JSON status object (if present)

Logs must be designed with privacy and security in mind, especially when containing code or proprietary logic.

---

## 10. Behavioral Principles
- **Assist, don’t override.** The agent proposes, the user decides.
- **Be explicit.** Always state what you are doing and why.
- **Respect scope.** Work within the current project, roadmap, and chat.
- **Surface status.** Keep JSON status and human-readable updates in sync.
- **Prefer small steps.** Incremental changes are easier to review and revert.

These principles should be reflected in system prompts, template design, and review tooling.

