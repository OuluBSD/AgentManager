# Project Nexus – UX Specification

A detailed, evolving description of user experience, UI structure, interaction flows, and behavioral conventions.

This document captures the intended feel of the application from the user's perspective. It describes what is "obviously true" in the interface based on earlier discussion and assumptions that flow naturally from the system’s goals.

---

# 1. Global Structure

Project Nexus is organized around **four vertical columns** and a **multi-tab main panel**. The interface is designed to feel like a hybrid between a project command center and a structured conversation workspace.

Layout:

```
[ Projects ] | [ Roadmap Lists ] | [ Chats ] | [ Main Panel: Chat / Terminal / Code ]
```

The leftmost three columns are persistent navigational layers. The rightmost, widest panel displays the currently active content.

Large screens keep all columns visible. Smaller screens may collapse columns into overlays, but only when explicitly toggled.

---

# 2. Column 1 – Projects List

A list of ~20 projects, each with visual cues indicating state and activity.

## 2.1 Project Item Content

Each project row includes:

- **Name** (primary, high-contrast)
- **Icon** (technology, domain, or custom badge)
- **Category Tag** (e.g., client work, research, maintenance)
- **Activity Indicator** using color:
  - Gray — no agents working
  - Yellow — agents waiting for the user
  - Green — agents actively working
- **Subtle Info Line** (muted color blending into the background):
  - recent change summary
  - currently running thread or task focus

## 2.2 Interactions

- **Quick Filter** field: filters visible projects without reordering
- **Grouping** by category or custom group
- **Right-click context menu** with options:
  - View / Edit project details
  - Change category
  - Add to favorites
  - Open project settings
  - Quick access to favorited templates

## 2.3 Dynamic Theming

Selecting a project may alter the theme of the UI to match the project’s color scheme.
Themes can originate from:

- user's OS/browser preferred theme
- global user settings
- per-project overrides

---

# 3. Column 2 – Roadmap Lists

(Renamed from "Task List List".)

A project may contain multiple roadmap lists that represent collections of tasks or phases. They bundle related chats and goals.

## 3.1 Roadmap List Item Content

Each roadmap list displays:

- **Title**
- **Tags / Attributes** (e.g., feature, refactor, bugfix, research)
- **Progress Percentage** (derived from child chats or meta-status)
- **Status Color** (parallel to project colors):
  - Gray — paused
  - Yellow — waiting
  - Green — active
  - Red/Orange — error or blocked
- **Subtle Info Text** blending into the UI background:
  - e.g., "3 chats active, focusing on API layer"

## 3.2 Context Menu

Right-clicking shows:

- Edit roadmap list
- Change tags or category
- Create new chat (from template)
- Open meta-status view
- Favorite templates (fast access)

---

# 4. Column 3 – Chats List

Each roadmap list contains multiple chats. These chats may represent tasks, subthreads, investigations, or discussions.

## 4.1 Chat Item Content

Each chat row includes:

- **Chat Title** (primary text)
- **Heuristic Status Line** (subtle, e.g. "AI: Implemented part 2 of CLI")
- **Percent Completion** (derived from JSON-status logic and roadmap correlations)
- **Status Color** consistent with global schema

## 4.2 Special Chat Entry – Meta-Chat

Every roadmap list has exactly one **meta-chat**, which appears at the top of the chat list, separated visually from regular chats.

The meta-chat:

- is responsible for interpreting task progress
- may execute pure JavaScript logic
- may also contain AI messages
- produces aggregated statuses for the roadmap list

It acts as the “brain” of the roadmap list.

---

# 5. Main Panel – Chat / Terminal / Code Tabs

The main panel is a horizontally split environment where the user performs actual work. Tabs control which mode is active.

Tabs:

1. **Chat** – conversational interface with structure and controls
2. **Terminal** – persistent tmux/screen-like session
3. **Code** – file tree + viewer/editor (read-only or more advanced modes)

---

# 6. Chat Panel UX

## 6.1 Header

The top of the chat panel shows:

- **Chat Title**
- **AI-generated status line** (derived from JSON status and template logic)
- **Relevant tasks** from the parent roadmap list
- **Link to template** (if the chat was created from one)
- **Action buttons**:
  - Mark as done
  - Request status update
  - Open meta-chat
  - Open associated folder in terminal

## 6.2 Messages

Message types follow customizable thematic rules (color, border, icon, spacing):

- user
- assistant
- system
- status
- meta

Messages can be filtered:

- show all / only AI / only user / only status / only meta

Navigation shortcuts:

- previous user message
- next user message

## 6.3 Composer

- multiline input
- Enter sends, Shift+Enter adds line
- supports **slash-commands** with autocomplete (/status, /review, /plan, ...)
- future support for attaching files from the **server-side file system**

---

# 7. Terminal Tab UX

- Always corresponds to a **persistent server-side PTY session**
- Session begins in project root or a task-specific folder
- Play/Stop controls attach/detach
- Setting: auto-open terminal when entering a chat (off by default)
- Terminal commands are **not** mirrored to chat messages

The terminal is strictly a user tool, not automatically controlled by AI.

---

# 8. Code Tab UX

The code tab includes:

- File tree (project root or task-specific scope)
- Monaco-based code viewer/editor (initially read-only)
- Diff viewer for AI-generated patches

Diffs are displayed using conventional color highlights:

- green = added
- red = removed
- inline/side-by-side switching optional

---

# 9. Meta-Logic, Templates, and JSON Status

## 9.1 Template Structure

Templates may include:

- title
- goal
- systemPrompt
- starterMessages
- optional JavaScript prompt (LLM-generated code)
- JavaScript logic (for interpreting JSON responses)
- key/value metadata

## 9.2 JSON-before-stop Protocol

In certain templates, AI replies with a structured JSON object _before every pause_.  
JSON includes:

- status
- progress
- activeTask
- errors

The JS logic in the template interprets JSON to produce:

- chat status
- roadmap list aggregated progress
- error flags
- meta-chat signals

## 9.3 Meta-Chat Behavior

The roadmap-level meta-chat:

- may run pure JS logic
- may request clarifying information from the AI
- always appears at the top of the chat list
- acts as the authoritative source of interpreted status

---

# 10. Git-Backed Architecture

All projects and their substructures exist within a private Git repository.

Directory structure:

```
/projects/
  PROJECT_ID/
    meta.json
    tasklists/
      TASKLIST_ID/
        meta.json
        chats/
          CHAT_ID/
            messages.jsonl
    workspace/
```

Snapshots come naturally from Git commits.  
Metadata (status, progress, structural changes) is also stored or inferred from commit messages.

---

# 11. Security & Accounts

- User accounts based on username/password or keyfile
- Optionally tied to OS-level users
- Virtual user IDs possible
- Sessions recorded for auditability
- First-time setup triggers onboarding or guided flow

---

# 12. Interaction Flow (Typical)

1. User opens a project
2. Creates a new roadmap list
3. Adjusts roadmap list settings
4. Creates a chat under that roadmap list
5. Assigns the chat to a roadmap item
6. Watches the initial AI-driven bootstrap conversation
7. Uses chat, terminal, and code tabs to progress the task
8. Meta-chat and JSON logic update roadmap status
9. Git commits capture snapshot history

---

# 13. Visual Style Philosophy

Default appearance is minimalist and unobtrusive.  
Advanced details reveal themselves through:

- right-click actions
- expanding sections
- context-aware hints

Animations exist but do not distract. Sidebar animations are disabled on large screens.

Multiple themes are supported, including project-driven themes.

---

# 14. UX Summary

Project Nexus is a structured interaction environment that merges AI-assisted conversations, project decomposition, and operational tooling. It prioritizes clarity, predictability, and a sense of controlled progression. The system’s UX reflects a balance between minimalism and depth, allowing power users to reveal complexity only when needed while keeping routine workflows smooth and unobstructed.
