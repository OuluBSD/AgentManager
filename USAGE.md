# Project Nexus - Usage Guide

A comprehensive guide to using Project Nexus for AI-powered project management and automation.

## Table of Contents

- [Quick Start](#quick-start)
- [Core Concepts](#core-concepts)
- [Installation](#installation)
- [First Steps](#first-steps)
- [Creating Projects](#creating-projects)
- [Working with Roadmaps](#working-with-roadmaps)
- [Chat Threads & Templates](#chat-threads--templates)
- [File Workspace](#file-workspace)
- [Terminal Access](#terminal-access)
- [CLI Management](#cli-management)
- [Advanced Features](#advanced-features)

---

## Quick Start

### "Hello World" Example

```bash
# 1. Install dependencies
pnpm install

# 2. Set up database (optional - uses in-memory store if not configured)
echo "DATABASE_URL=postgresql://user:pass@localhost:5432/nexus" > .env

# 3. Initialize system (creates storage, admin user)
./nexus-cli setup --admin-password admin123

# 4. Start backend
pnpm --filter nexus-backend dev

# 5. Start frontend (in another terminal)
pnpm --filter nexus-frontend dev

# 6. Open browser
# Visit http://localhost:3000
# Login with: admin / admin123

# 7. Create your first project
# Click "+ New Project" in the UI
# Name: "Hello World"
# Category: "Tutorial"

# 8. Create a roadmap
# Click project → "+ New Roadmap"
# Title: "Getting Started"

# 9. Create a chat
# Click roadmap → "+ New Chat"
# Start chatting with the AI!
```

---

## Core Concepts

### Projects

**Projects** are top-level containers that group related work. Each project has:

- **Name** - Descriptive title
- **Category** - Organizational grouping (Development, Research, etc.)
- **Status** - Current state (active, paused, archived, done)
- **Theme** - Visual color scheme
- **Git Storage** - Each project gets its own git repository

**Example Use Cases:**

- Software development projects
- Research initiatives
- Documentation efforts
- Automation workflows

### Roadmaps

**Roadmaps** (called "Roadmap Lists" internally) organize work within a project. Each roadmap contains:

- **Title** - What this roadmap accomplishes
- **Tags** - Keywords for filtering/organization
- **Progress** - 0-100% completion tracking
- **Meta-Chat** - Special chat that summarizes child chat statuses
- **Child Chats** - Individual chat threads for specific tasks

**Example Roadmap Structure:**

```
Project: "E-Commerce Platform"
├── Roadmap: "Backend API" (80% complete)
│   ├── Chat: "User Authentication"
│   ├── Chat: "Product Catalog"
│   └── Chat: "Payment Integration"
├── Roadmap: "Frontend UI" (45% complete)
│   ├── Chat: "Dashboard Design"
│   └── Chat: "Shopping Cart"
└── Roadmap: "Deployment" (20% complete)
    └── Chat: "Docker Setup"
```

### Chat Threads

**Chats** are individual conversation threads with AI assistants. Each chat has:

- **Goal** - What the chat aims to accomplish
- **Status** - Current state (idle, in_progress, done, failed)
- **Progress** - Percentage completion (0-100%)
- **Template** - Optional template defining AI behavior
- **Messages** - Conversation history
- **Workspace** - Dedicated file directory for this chat

**Chat Features:**

- Real-time AI conversation
- File operations (create, edit, read files)
- Terminal access (run commands)
- Message navigation (jump between user messages)
- Status tracking with JSON protocol

### Templates

**Templates** define AI assistant behavior and capabilities. Templates include:

- **System Prompt** - Instructions for the AI
- **Goal** - Default chat goal
- **JavaScript Logic** - Custom status computation
- **JSON Required** - Whether chat must report structured status
- **Metadata** - Additional configuration

**Example Template:**

```json
{
  "title": "Code Reviewer",
  "goal": "Review code for quality and best practices",
  "systemPrompt": "You are an expert code reviewer...",
  "javascriptLogic": "context.result.progress = Math.min(100, context.json.linesReviewed / context.json.totalLines * 100);",
  "jsonRequired": true
}
```

---

## Installation

### Prerequisites

- **Node.js** 20+ (for TypeScript, Next.js)
- **pnpm** 9+ (package manager)
- **PostgreSQL** 15+ (optional - uses in-memory store if not configured)
- **Git** (for project storage)

### Install Dependencies

```bash
# Clone repository
git clone <your-repo-url>
cd AgentManager

# Install all dependencies
pnpm install
```

### Configure Environment

Create `.env` files:

**Backend** (`.env` in project root):

```bash
# Database (optional - uses in-memory if not set)
DATABASE_URL=postgresql://user:password@localhost:5432/nexus

# Storage location (optional - defaults to ./apps/backend/data/projects)
PROJECTS_ROOT=/path/to/projects

# Server settings
PORT=3001
HOST=0.0.0.0
```

**Frontend** (`apps/frontend/.env.local`):

```bash
# Backend API URL
NEXT_PUBLIC_API_URL=http://localhost:3001

# Demo credentials (optional - for auto-login during development)
NEXT_PUBLIC_DEMO_USERNAME=admin
NEXT_PUBLIC_DEMO_PASSWORD=admin123
```

### Initialize System

```bash
# Create storage directories, initialize database, create admin user
./nexus-cli setup --admin-password your_secure_password

# Verify health
./nexus-cli health
```

### Start Services

```bash
# Terminal 1: Start backend
pnpm --filter nexus-backend dev

# Terminal 2: Start frontend
pnpm --filter nexus-frontend dev

# Visit http://localhost:3000
```

---

## First Steps

### 1. Login

Visit `http://localhost:3000` and login with:

- **Username**: `admin`
- **Password**: (whatever you set during setup)

Or use keyfile authentication by uploading a token file.

### 2. Create Your First Project

1. Click **"+ New Project"** in the Projects column
2. Fill in details:
   - Name: "My First Project"
   - Category: "Learning"
   - Status: "active"
3. Click **Create**

### 3. Create a Roadmap

1. Click on your new project
2. Click **"+ New Roadmap"** in the Roadmaps column
3. Fill in:
   - Title: "Getting Started"
   - Tags: learning, tutorial
4. Click **Create**

### 4. Start a Chat

1. Click on your new roadmap
2. Click **"+ New Chat"** in the Chats column
3. Options:
   - **Empty Chat** - Start from scratch
   - **From Template** - Use a pre-defined template
4. Type a message and hit Enter!

---

## Creating Projects

### Manual Creation (UI)

1. Click **"+ New Project"** button
2. Fill in form:
   ```
   Name: "Web Scraper Tool"
   Category: "Development"
   Status: "active"
   Description: "Build a web scraping utility"
   ```
3. Click **Create**

### Via CLI

```bash
# Projects are created via UI, but CLI can initialize storage
./nexus-cli project list
./nexus-cli project init -i <project-id>
```

### Project Organization Best Practices

**By Project Type:**

- Development projects: "Frontend", "Backend", "Infrastructure"
- Research projects: "Literature Review", "Experiments", "Analysis"
- Documentation: "User Guide", "API Docs", "Architecture"

**By Phase:**

- "Phase 1: Planning"
- "Phase 2: Implementation"
- "Phase 3: Testing"

**By Feature:**

- "Authentication System"
- "Payment Gateway"
- "Reporting Dashboard"

---

## Working with Roadmaps

### Creating Roadmaps

1. Select a project
2. Click **"+ New Roadmap"**
3. Fill in:
   - **Title**: "Authentication System"
   - **Tags**: backend, security, auth
4. Meta-chat is created automatically

### Using Meta-Chat

The **meta-chat** is a special chat that:

- Summarizes status of all child chats in the roadmap
- Automatically updates when child chats report status
- Can be used to coordinate multiple chats
- Has no workspace (uses project workspace)

**Example Meta-Chat Flow:**

```
1. Create roadmap "API Development"
2. Create child chats: "Auth", "Database", "Endpoints"
3. Each child chat reports JSON status
4. Meta-chat aggregates: "API Development is 65% complete"
```

### Roadmap Patterns

**Sequential Tasks:**

```
Roadmap: "Deployment Pipeline"
├── Chat 1: "Setup CI/CD" (done ✓)
├── Chat 2: "Configure Staging" (in_progress 75%)
└── Chat 3: "Production Deploy" (idle)
```

**Parallel Workstreams:**

```
Roadmap: "Mobile App"
├── Chat: "iOS Implementation" (in_progress 60%)
├── Chat: "Android Implementation" (in_progress 55%)
└── Chat: "Backend API" (in_progress 80%)
```

**Iterative Development:**

```
Roadmap: "Feature Development"
├── Chat: "Sprint 1" (done ✓)
├── Chat: "Sprint 2" (done ✓)
└── Chat: "Sprint 3" (in_progress 30%)
```

---

## Chat Threads & Templates

### Creating Chats

**Empty Chat:**

```
1. Click "+ New Chat"
2. Select "Empty"
3. Enter title and optional goal
4. Start chatting
```

**From Template:**

```
1. Click "+ New Chat"
2. Select "From Template"
3. Choose template (e.g., "Code Reviewer")
4. Template's system prompt and goal are applied
5. Start chatting
```

### Chat Features

#### Message Types

- **User Messages** - Your input
- **Assistant Messages** - AI responses
- **System Messages** - Status updates, errors
- **Meta Messages** - Aggregated status from child chats

#### Message Navigation

- **Prev/Next Buttons** - Jump between user messages
- **Auto-Scroll** - Maintains position when at bottom
- **Smooth Scrolling** - Visual feedback during navigation

#### Slash Commands

Type `/` to see available commands:

- `/help` - Show all commands
- `/status` - Show current chat status and progress
- `/meta` - Navigate to parent meta-chat
- `/clear` - Clear chat history (local only)

#### Chat Actions

- **Rename** - Right-click → Rename
- **Merge** - Right-click → Merge (combine with another chat)
- **Open Folder** - Right-click → Open Folder (view workspace)

### Creating Templates

1. Click **"Templates"** tab in context panel
2. Click **"+ Create Template"**
3. Fill in basic info:
   ```
   Title: "Bug Fixer"
   Goal: "Identify and fix bugs in the codebase"
   JSON Required: ✓
   ```
4. Expand **"Advanced"** section:

   ```javascript
   // System Prompt
   You are an expert debugger. Analyze code, identify bugs,
   and propose fixes. Always report progress as JSON.

   // JavaScript Logic (for progress computation)
   if (context.json.status === 'analyzing') {
     context.result.progress = 25;
   } else if (context.json.status === 'fixing') {
     context.result.progress = 50;
   } else if (context.json.status === 'testing') {
     context.result.progress = 75;
   } else if (context.json.status === 'done') {
     context.result.progress = 100;
   }
   context.result.status = context.json.status;
   ```

5. Click **Create**

### JSON Status Protocol

When `jsonRequired: true`, chats must report structured status:

**Assistant Response Format:**

```json
{
  "status": "in_progress",
  "progress": 65,
  "details": "Implemented authentication, working on authorization"
}
```

**JavaScript Logic Context:**

```javascript
// Available in template's javascriptLogic
context.json; // Parsed JSON from assistant
context.result; // Output (modify status/progress)
context.chat; // Chat metadata
context.message; // Current message
```

**Status Values:**

- `idle` - Not started
- `in_progress` - Working
- `done` - Completed successfully
- `failed` - Encountered error

---

## File Workspace

Each chat has a dedicated **workspace directory** for file operations.

### Workspace Structure

```
/data/projects/
└── <project-id>/
    └── roadmaps/
        └── <roadmap-id>/
            └── chats/
                └── <chat-id>/
                    ├── chat.json          # Chat metadata
                    ├── messages.jsonl     # Message history
                    └── workspace/         # File workspace ← THIS
                        ├── file1.txt
                        ├── script.py
                        └── data/
                            └── output.csv
```

### Using the Code Tab

1. Click **"Code"** tab in main panel
2. View file tree on left
3. Click file to view/edit
4. Click **"Save"** to write changes

### File Operations

**Read File:**

```
You: Can you read config.json?
AI: [reads workspace/config.json]
```

**Write File:**

```
You: Create a Python script that processes data
AI: [creates workspace/data_processor.py]
```

**Edit File:**

```
You: Update the API endpoint in server.js
AI: [modifies workspace/server.js]
```

**Directory Operations:**

```
You: Create a data/ directory with sample CSVs
AI: [creates workspace/data/ with files]
```

### Viewing Diffs

When files are modified:

1. Click **"Diff"** tab
2. View color-coded changes:
   - 🟢 Green = additions
   - 🔴 Red = deletions
   - 🔵 Blue = headers

---

## Terminal Access

Each chat can access a **persistent terminal session** in the workspace directory.

### Using the Terminal Tab

1. Click **"Terminal"** tab in main panel
2. Terminal automatically starts in chat workspace
3. Type commands and hit Enter
4. Session persists until closed or timeout (15 min default)

### Terminal Features

- **Full xterm.js terminal** - VT100 compatible
- **WebSocket connection** - Real-time output
- **Persistent sessions** - Survives page refresh
- **Workspace CWD** - Starts in chat workspace directory
- **Idle timeout** - Closes after 15 minutes (configurable)

### Example Workflows

**Run Tests:**

```bash
$ pytest tests/
$ npm test
```

**Build Project:**

```bash
$ npm run build
$ cargo build --release
```

**Install Dependencies:**

```bash
$ pip install -r requirements.txt
$ npm install
```

**Git Operations:**

```bash
$ git init
$ git add .
$ git commit -m "Initial commit"
```

### Terminal Security

- ⚠️ **No sudo access** by default
- ⚠️ **Sandboxed to workspace** (chat can escape via cd ..)
- ⚠️ **Audit logging** - All commands logged
- ⚠️ **Session timeout** - Auto-closes idle terminals

---

## CLI Management

Project Nexus includes a powerful CLI tool for system administration.

### CLI Installation

The CLI is already available as `./nexus-cli` in the project root:

```bash
# Check installation
./nexus-cli --help
./nexus-cli --version

# For system-wide access
ln -s "$(pwd)/nexus-cli" ~/.local/bin/nexus-cli
```

### Common CLI Commands

**System Setup:**

```bash
# Initialize everything
./nexus-cli setup --admin-password secret123

# Check health
./nexus-cli health
```

**User Management:**

```bash
# Create users
./nexus-cli user create -u alice -p pass123 --admin
./nexus-cli user create -u developer -p dev123

# List users
./nexus-cli user list

# Change password
./nexus-cli user password -u alice -p newpass

# Delete user
./nexus-cli user delete -u olduser --force
```

**Project Management:**

```bash
# List projects
./nexus-cli project list

# Initialize git storage for project
./nexus-cli project init -i proj-abc123

# Backup project
./nexus-cli project export -i proj-abc123 -o backup.bundle

# Restore project
./nexus-cli project import -i proj-restored -b backup.bundle
```

**Storage Management:**

```bash
# View storage info
./nexus-cli storage info

# Find orphaned directories
./nexus-cli storage cleanup --dry-run

# Clean up
./nexus-cli storage cleanup --force
```

For complete CLI documentation, see [CLI.md](./CLI.md).

---

## Advanced Features

### Git-Backed Storage

Every project is a **git repository** with automatic version control:

**Directory Structure:**

```
/data/projects/<project-id>/
├── .git/                    # Full git repo
├── .gitignore               # Excludes workspace/
├── project.json             # Project metadata
├── roadmaps/
│   └── <roadmap-id>/
│       ├── roadmap.json
│       ├── meta-chat.json
│       └── chats/
│           └── <chat-id>/
│               ├── chat.json
│               ├── messages.jsonl
│               └── workspace/  # Gitignored
└── templates/
    └── <template-id>.json
```

**Automatic Commits:**

- Every chat/roadmap/template update creates a commit
- Message updates append to JSONL (atomic writes)
- Full audit trail via git log

**Version Control Operations:**

```bash
# View project history
cd /data/projects/<project-id>
git log --oneline

# Create snapshot
./nexus-cli project export -i <id> -o snapshot.bundle

# View specific commit
git show <commit-sha>

# Diff between commits
git diff <sha1> <sha2>
```

### Authentication & Security

**Login Methods:**

- **Password** - Traditional username/password
- **Keyfile** - Token file authentication

**Session Management:**

- 7-day session expiry
- Automatic session cleanup (every 15 minutes)
- Rate limiting (5 failed attempts = 2min lockout)

**Password Security:**

- PBKDF2 hashing (120,000 iterations)
- SHA256 digest
- Salt per password

**Audit Logging:**

- All file operations logged
- Terminal commands recorded
- User actions tracked
- IP address captured

### Backup & Restore

**Manual Backup:**

```bash
# Export single project
./nexus-cli project export -i proj-abc -o backup.bundle

# Backup all projects
for id in $(./nexus-cli project list | tail -n +4 | awk '{print $1}'); do
  ./nexus-cli project export -i "$id" -o "backup-$id.bundle"
done
```

**Automated Backup Script:**

```bash
#!/bin/bash
# backup.sh

DATE=$(date +%Y-%m-%d)
BACKUP_DIR="backups/$DATE"
mkdir -p "$BACKUP_DIR"

./nexus-cli project list | tail -n +4 | awk '{print $1}' | while read id; do
  echo "Backing up $id..."
  ./nexus-cli project export -i "$id" -o "$BACKUP_DIR/$id.bundle"
done

echo "Backup complete: $BACKUP_DIR"
```

**Restore:**

```bash
# Import project
./nexus-cli project import -i proj-restored -b backup.bundle

# Register in database (via UI)
# Open UI → Create Project → Use ID: proj-restored
```

### Deployment

**Production Checklist:**

- [ ] Set strong DATABASE_URL
- [ ] Configure PROJECTS_ROOT for persistent storage
- [ ] Set secure admin password
- [ ] Disable demo credentials (remove NEXT*PUBLIC_DEMO*\*)
- [ ] Enable HTTPS
- [ ] Configure firewall rules
- [ ] Set up automated backups
- [ ] Enable audit logging
- [ ] Review security settings

**Environment Variables:**

```bash
# .env (production)
DATABASE_URL=postgresql://nexus:secure_pass@db:5432/nexus_prod
PROJECTS_ROOT=/var/lib/nexus/projects
PORT=3001
HOST=0.0.0.0
NODE_ENV=production
```

**Docker Deployment** (planned):

```bash
docker-compose up -d
```

---

## Getting Help

### Documentation

- **[README.md](./README.md)** - Project overview
- **[USAGE.md](./USAGE.md)** - This guide (usage patterns)
- **[CLI.md](./CLI.md)** - CLI tool documentation
- **[API_CONTRACTS.md](./API_CONTRACTS.md)** - API reference
- **[TASKS.md](./TASKS.md)** - Development roadmap

### Troubleshooting

**Backend won't start:**

```bash
# Check database connection
./nexus-cli health

# View logs
pnpm --filter nexus-backend dev
```

**Frontend won't start:**

```bash
# Check backend is running
curl http://localhost:3001/health

# View Next.js logs
pnpm --filter nexus-frontend dev
```

**Can't login:**

```bash
# Reset admin password
./nexus-cli user password -u admin -p newpass123

# List users
./nexus-cli user list
```

**Storage issues:**

```bash
# Check storage health
./nexus-cli storage info

# Clean up orphaned data
./nexus-cli storage cleanup --dry-run
./nexus-cli storage cleanup --force
```

### Support

For bugs, feature requests, or questions, please contact your system administrator or refer to the project repository.

---

## Next Steps

- Read [CLI.md](./CLI.md) for detailed CLI usage
- Check [TASKS.md](./TASKS.md) for upcoming features
- Review [API_CONTRACTS.md](./API_CONTRACTS.md) for API integration
- Explore templates in the UI
- Create your first automated workflow

Happy building! 🚀
