# Project Nexus CLI Documentation

The `nexus-cli` command-line tool provides comprehensive system administration and management for Project Nexus.

## Installation

The CLI is already set up in your project. Simply use the wrapper script from the project root:

```bash
./nexus-cli <command>
```

### Optional: Add to PATH

For system-wide access, you can add a symlink to your local bin directory:

```bash
# Create local bin directory if it doesn't exist
mkdir -p ~/.local/bin

# Create symlink
ln -s "$(pwd)/nexus-cli" ~/.local/bin/nexus-cli

# Make sure ~/.local/bin is in your PATH
echo 'export PATH="$HOME/.local/bin:$PATH"' >> ~/.bashrc
source ~/.bashrc

# Now you can use it from anywhere
nexus-cli --help
```

## Quick Start

### 1. Initial Setup

```bash
# Initialize database, storage, and create admin user
./nexus-cli setup --admin-password your_secure_password

# Or skip certain steps
./nexus-cli setup --skip-db --skip-storage
```

### 2. Check System Health

```bash
./nexus-cli health
```

This checks:

- Database connection
- Storage directory existence
- Git installation

## Command Reference

### Setup & Health

#### `setup` - Initialize Project Nexus

```bash
./nexus-cli setup [options]
```

**Options:**

- `--skip-db` - Skip database initialization
- `--skip-storage` - Skip storage directory initialization
- `--admin-user <username>` - Admin username (default: admin)
- `--admin-password <password>` - Admin password (required for user creation)

**Example:**

```bash
./nexus-cli setup --admin-user admin --admin-password secret123
```

#### `health` - System Health Check

```bash
./nexus-cli health
```

Validates:

- ✅ Database connection via DATABASE_URL
- ✅ Storage directory at PROJECTS_ROOT
- ✅ Git installation and version

---

### User Management

#### `user create` - Create New User

```bash
./nexus-cli user create -u <username> -p <password> [--admin] [--system]
```

**Options:**

- `-u, --username <username>` - Username (required)
- `-p, --password <password>` - Password (required)
- `--admin` - Grant admin privileges
- `--system` - Allow system account access (not yet implemented)

**Example:**

```bash
./nexus-cli user create -u alice -p secure_pass --admin
./nexus-cli user create -u developer -p dev123
```

#### `user list` - List All Users

```bash
./nexus-cli user list
```

Shows:

- Username
- Admin status (Yes/No)
- Account creation date

**Example Output:**

```
Username             Admin      Created
──────────────────────────────────────────────────
admin                Yes        11/26/2025
alice                Yes        11/26/2025
developer            No         11/26/2025
```

#### `user delete` - Delete User

```bash
./nexus-cli user delete -u <username> --force
```

**Options:**

- `-u, --username <username>` - Username to delete (required)
- `--force` - Skip confirmation (required)

**Example:**

```bash
./nexus-cli user delete -u olduser --force
```

⚠️ **Warning:** This will permanently delete the user and all their sessions.

#### `user password` - Change Password

```bash
./nexus-cli user password -u <username> -p <new_password>
```

**Options:**

- `-u, --username <username>` - Username (required)
- `-p, --password <password>` - New password (required)

**Example:**

```bash
./nexus-cli user password -u alice -p new_secure_password
```

---

### Project Management

#### `project list` - List All Projects

```bash
./nexus-cli project list
```

Shows:

- Project ID
- Project name
- Status (color-coded: green=active, yellow=other)
- Category

**Example Output:**

```
ID                        Name                           Status          Category
────────────────────────────────────────────────────────────────────────────────
proj-abc123               My First Project               active          Development
proj-def456               Testing Project                paused          Testing
```

#### `project init` - Initialize Git Storage

```bash
./nexus-cli project init -i <project-id>
```

**Options:**

- `-i, --id <projectId>` - Project ID (required)

Initializes git repository for an existing database project.

**Example:**

```bash
./nexus-cli project init -i proj-abc123
```

#### `project export` - Export as Git Bundle

```bash
./nexus-cli project export -i <project-id> -o <output-file>
```

**Options:**

- `-i, --id <projectId>` - Project ID (required)
- `-o, --output <file>` - Output bundle file path (required)

Creates a git bundle file containing the entire project history for backup or migration.

**Example:**

```bash
./nexus-cli project export -i proj-abc123 -o backups/project-backup-2025-11-26.bundle
```

#### `project import` - Import from Git Bundle

```bash
./nexus-cli project import -i <project-id> -b <bundle-file>
```

**Options:**

- `-i, --id <projectId>` - Project ID (required)
- `-b, --bundle <file>` - Bundle file path (required)

Imports a project from a git bundle. Note: This only restores the git storage; you'll need to register the project in the database via the UI.

**Example:**

```bash
./nexus-cli project import -i proj-restored -b backups/project-backup.bundle
```

---

### Storage Management

#### `storage info` - Show Storage Information

```bash
./nexus-cli storage info
```

Displays:

- Storage location (PROJECTS_ROOT)
- Number of projects
- Last commit date for each project (up to 10 most recent)

**Example Output:**

```
Storage Information

Location: /path/to/data/projects

Projects: 3

  proj-abc123                    Last commit: 2025-11-26 12:30:45 +0200
  proj-def456                    Last commit: 2025-11-25 10:15:30 +0200
  proj-xyz789                    Last commit: 2025-11-24 14:22:18 +0200
```

#### `storage cleanup` - Clean Up Orphaned Directories

```bash
./nexus-cli storage cleanup [--dry-run] [--force]
```

**Options:**

- `--dry-run` - Show what would be deleted without deleting
- `--force` - Skip confirmation and delete (required for actual deletion)

Finds and removes project storage directories that no longer have corresponding database entries.

**Example:**

```bash
# Preview what would be deleted
./nexus-cli storage cleanup --dry-run

# Actually delete orphaned directories
./nexus-cli storage cleanup --force
```

---

## Environment Variables

The CLI reads these environment variables from your `.env` file:

- **`DATABASE_URL`** - PostgreSQL connection string (required)

  ```
  DATABASE_URL=postgresql://user:password@localhost:5432/nexus
  ```

- **`PROJECTS_ROOT`** - Project storage directory (optional)
  ```
  PROJECTS_ROOT=/path/to/projects
  ```
  Default: `./apps/backend/data/projects`

---

## Common Workflows

### Initial Setup (Fresh Installation)

```bash
# 1. Setup database and storage
./nexus-cli setup --admin-password admin123

# 2. Verify health
./nexus-cli health

# 3. Create additional users
./nexus-cli user create -u developer -p dev123
./nexus-cli user create -u tester -p test123
```

### Backup Workflow

```bash
# List projects to backup
./nexus-cli project list

# Export each project
./nexus-cli project export -i proj-abc123 -o backup-abc123.bundle
./nexus-cli project export -i proj-def456 -o backup-def456.bundle

# Verify backups exist
ls -lh *.bundle
```

### Restore Workflow

```bash
# Import from bundle
./nexus-cli project import -i proj-restored -b backup-abc123.bundle

# Register in database via UI
# (Open UI and create project with ID: proj-restored)

# Verify storage
./nexus-cli storage info
```

### Maintenance Workflow

```bash
# Check system health
./nexus-cli health

# View storage info
./nexus-cli storage info

# Find orphaned directories
./nexus-cli storage cleanup --dry-run

# Clean up if needed
./nexus-cli storage cleanup --force

# List users
./nexus-cli user list
```

---

## Troubleshooting

### "DATABASE_URL not configured"

Add `DATABASE_URL` to your `.env` file:

```bash
echo "DATABASE_URL=postgresql://user:password@localhost:5432/nexus" >> .env
```

### "Storage directory: NOT FOUND"

Run setup to create the storage directory:

```bash
./nexus-cli setup --skip-db
```

Or manually create it:

```bash
mkdir -p apps/backend/data/projects
```

### "Git: NOT FOUND"

Install git:

```bash
# Ubuntu/Debian
sudo apt install git

# macOS
brew install git

# Verify
git --version
```

### "Failed to connect to database"

1. Check DATABASE_URL is correct
2. Verify PostgreSQL is running
3. Test connection manually:
   ```bash
   psql "$DATABASE_URL" -c "SELECT 1"
   ```

---

## Advanced Usage

### Script Automation

You can use the CLI in scripts:

```bash
#!/bin/bash

# Automated backup script
DATE=$(date +%Y-%m-%d)
BACKUP_DIR="backups/$DATE"
mkdir -p "$BACKUP_DIR"

# Get all project IDs
./nexus-cli project list | tail -n +4 | awk '{print $1}' | while read -r project_id; do
  echo "Backing up $project_id..."
  ./nexus-cli project export -i "$project_id" -o "$BACKUP_DIR/${project_id}.bundle"
done

echo "Backup complete: $BACKUP_DIR"
```

### Cron Jobs

```bash
# Add to crontab (run 'crontab -e')

# Daily backup at 2 AM
0 2 * * * cd /path/to/AgentManager && ./nexus-cli storage cleanup --dry-run >> logs/cleanup.log 2>&1

# Weekly cleanup check
0 3 * * 0 cd /path/to/AgentManager && ./nexus-cli storage cleanup --force >> logs/cleanup.log 2>&1
```

---

## Security Notes

⚠️ **Important Security Considerations:**

1. **Password Security**: Never commit passwords to git. Use environment variables or secure password managers.

2. **Admin Access**: Be cautious with `--admin` flag. Admin users have full system access.

3. **Backup Security**: Git bundles contain full project history. Store backups securely.

4. **User Deletion**: The `--force` flag is required to prevent accidental deletions.

5. **System Access**: The `--system` flag (when implemented) will allow OS user access. Use carefully.

---

## Future Features (Planned)

- [ ] System account access controls (enable/disable OS user access)
- [ ] User isolation and sandboxing
- [ ] Automated backup scheduling
- [ ] Log viewing and rotation
- [ ] Storage usage reports and quotas
- [ ] Batch operations (bulk user/project management)
- [ ] Interactive password prompts (currently requires --admin-password flag)
- [ ] Project validation and repair commands
- [ ] Database migration commands

---

## Support

For issues or feature requests, please refer to the main project documentation or contact your system administrator.
