# Example META-Chat Transcript: Building a Task Management API

This document illustrates how the Meta-Roadmap Orchestrator works through a fictional example of creating a task management API.

## Initial Interaction

```
$ ./tools/meta/meta-roadmap-orchestrator.sh
=== Meta-Roadmap Orchestrator ===
Project directory path: /home/user/task-api
Project description: A REST API for managing tasks with CRUD operations
Minimum number of roadmap steps (integer): 3
Maximum number of roadmap steps (integer): 5
Build mode options:
  1. none - do not build at all
  2. after-each - after each phase, run a build command
Choose build mode (none/after-each): after-each
Build command (e.g. npm run build, cargo build): npm run build
Fix until builds (yes/no): yes
```

## Meta Session: Roadmap Creation

After starting the meta session (`meta-1704234567-a1b2c3d4`), the orchestrator sends a prompt to Qwen:

```
[USER → Qwen]
You are a project planning expert. Your task is to create a detailed roadmap for a software project with the following description:

Project Description: A REST API for managing tasks with CRUD operations
Minimum Steps: 3
Maximum Steps: 5

Create a roadmap that follows these requirements:
1. The roadmap must have between 3 and 5 steps
2. Each step should have:
   - A title
   - A description
   - Suggested commands to execute
3. All file operations must be done using nexus-agent-tool
4. Write the roadmap to .nexus-meta/meta-roadmap.md using the following command format:
   printf '...roadmap content...' | nexus-agent-tool write-file --session-id "meta-1704234567-a1b2c3d4" --rel-path ".nexus-meta/meta-roadmap.md" --content-from-stdin

Format the roadmap as a markdown document with the following structure:
## Step 1: [Title]
[Description]
- Command: [command to execute]

## Step 2: [Title]
[Description]
- Command: [command to execute]

(Continue for each step up to 5)
```

Qwen responds with the roadmap and writes it to the specified file using `nexus-agent-tool`:

```
[Qwen → nexus-agent-tool]
printf '# Task Management API Roadmap

## Step 1: Initialize Project Structure
Set up the basic project structure, package.json, and initial dependencies.
- Command: npm init -y
- Command: npm install express
- Command: mkdir src
- Command: touch src/server.js

## Step 2: Implement Basic Task Model and Routes
Create the core data model and API endpoints for task CRUD operations.
- Command: touch src/models/task.js
- Command: touch src/routes/tasks.js
- Command: npm install uuid

## Step 3: Add Database Integration
Integrate with a database for persistent storage.
- Command: npm install sqlite3
- Command: touch src/database.js
- Command: touch src/migrations/001_initial_schema.sql
' | nexus-agent-tool write-file --session-id "meta-1704234567-a1b2c3d4" --rel-path ".nexus-meta/meta-roadmap.md" --content-from-stdin
```

## Child Session Execution: Step 1

The orchestrator creates a child session (`child-1-1704234567`) and begins executing commands for Step 1:

```
[ORCHESTRATOR → nexus-agent-tool]
nexus-agent-tool start --session-id "child-1-1704234567" --project-path "/home/user/task-api"
```

```
[ORCHESTRATOR → nexus-agent-tool.log]
Executing Step 1: Initialize Project Structure
```

Executing commands from Step 1:

```
[ORCHESTRATOR → nexus-agent-tool]
nexus-agent-tool run-command --session-id "child-1-1704234567" --cmd "npm init -y"
```

```
[ORCHESTRATOR → nexus-agent-tool]
nexus-agent-tool run-command --session-id "child-1-1704234567" --cmd "npm install express"
```

```
[ORCHESTRATOR → nexus-agent-tool]
nexus-agent-tool run-command --session-id "child-1-1704234567" --cmd "mkdir src"
```

```
[ORCHESTRATOR → nexus-agent-tool]
nexus-agent-tool run-command --session-id "child-1-1704234567" --cmd "touch src/server.js"
```

## Build Verification: Step 1

Since `BUILD_MODE=after-each`, the orchestrator runs the build command after Step 1:

```
[ORCHESTRATOR → nexus-agent-tool]
nexus-agent-tool run-command --session-id "child-1-1704234567" --cmd "npm run build"
```

The build fails with an error because the `build` script is not defined in `package.json`:

```
[SYSTEM → nexus-agent-tool]
npm ERR! Missing script: "build"
```

Since `FIX_UNTIL_BUILDS=yes`, the orchestrator sends a fix prompt to Qwen:

```
[ORCHESTRATOR → Qwen]
Build failed with the following output:
npm ERR! Missing script: "build"

Please analyze the build errors and fix them using nexus-agent-tool to:
1. Modify necessary files to resolve the build issues
2. Rerun the build command: npm run build

Focus only on fixing the errors that are preventing the build from completing.
```

Qwen responds by adding a build script to `package.json`:

```
[Qwen → nexus-agent-tool]
nexus-agent-tool read-file --session-id "child-1-1704234567" --rel-path "package.json" > temp_package.json
```

```
[Qwen → nexus-agent-tool]
# Modify the package.json to add a build script
cat temp_package.json | jq '.scripts.build = "node src/server.js"' > modified_package.json
```

```
[Qwen → nexus-agent-tool]
nexus-agent-tool write-file --session-id "child-1-1704234567" --rel-path "package.json" --content-from-file "modified_package.json"
```

The orchestrator tries the build again:

```
[ORCHESTRATOR → nexus-agent-tool]
nexus-agent-tool run-command --session-id "child-1-1704234567" --cmd "npm run build"
```

Now the build succeeds (or at least doesn't fail with a missing script error).

## Child Session Execution: Step 2

The orchestrator creates another child session (`child-2-1704234567`) for Step 2 and begins executing commands for implementing the basic task model and routes.

```
[ORCHESTRATOR → nexus-agent-tool]
nexus-agent-tool start --session-id "child-2-1704234567" --project-path "/home/user/task-api"
```

```
[ORCHESTRATOR → nexus-agent-tool.log]
Executing Step 2: Implement Basic Task Model and Routes
```

Executing commands from Step 2:

```
[ORCHESTRATOR → nexus-agent-tool]
nexus-agent-tool run-command --session-id "child-2-1704234567" --cmd "touch src/models/task.js"
```

```
[ORCHESTRATOR → nexus-agent-tool]
nexus-agent-tool run-command --session-id "child-2-1704234567" --cmd "touch src/routes/tasks.js"
```

```
[ORCHESTRATOR → nexus-agent-tool]
nexus-agent-tool run-command --session-id "child-2-1704234567" --cmd "npm install uuid"
```

## Narrative Summary

This example demonstrates the flow of the Meta-Roadmap Orchestrator:

1. The human provides basic project information
2. The meta session is created, and Qwen generates a roadmap
3. The orchestrator executes each step in dedicated child sessions
4. After each step, the build is verified and fixes are applied if necessary
5. The process continues until all steps are completed

The system maintains clear separation between planning (meta session) and execution (child sessions), with all changes tracked through the `nexus-agent-tool` sessions. This creates a verifiable history of how the project was developed through AI-assisted steps, with session JSON files providing a detailed log of what happened at each stage.