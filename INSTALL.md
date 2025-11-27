# Agent Manager - Installation Guide

## Quick Start

### 1. Run the Installation Script

```bash
./install.sh
```

The installation script will:

- Ask for a git repository directory for persistent storage (default: `~/.local/share/agent-manager/data`)
- Optionally configure PostgreSQL database (or use in-memory store)
- Set up administrator and regular user accounts
- Configure server settings (host, port)
- Set up projects directory
- Save configuration to `~/.config/agent-manager/config.env`

### 2. Start the Application

```bash
./run.sh
```

The run script will:

- Load configuration from `~/.config/agent-manager/config.env`
- Start the backend server (default: http://localhost:3001)
- Start the frontend server (default: http://localhost:3000)

### 3. Access the Application

Open your browser and navigate to:

```
http://localhost:3000
```

Login with the credentials you configured during installation.

## Configuration

### Configuration File Location

The configuration is stored in:

```
~/.config/agent-manager/config.env
```

### Configuration Options

```bash
# Git repository for persistence
AGENT_MANAGER_REPO_DIR=/path/to/data/repo

# Server configuration
HOST=0.0.0.0
PORT=3001

# Database URL (PostgreSQL connection string, leave empty for in-memory store)
DATABASE_URL=postgres://user:password@localhost:5432/nexus

# Projects root directory
PROJECTS_ROOT=/path/to/projects

# Terminal idle timeout in milliseconds (0 disables idle shutdowns)
TERMINAL_IDLE_MS=600000

# Frontend configuration
NEXT_PUBLIC_BACKEND_HTTP_BASE=http://localhost:3001

# Initial setup user credentials (remove after first login for security)
SETUP_ADMIN_USERNAME=admin
SETUP_ADMIN_PASSWORD=your_admin_password
SETUP_REGULAR_USERNAME=user
SETUP_REGULAR_PASSWORD=your_user_password
```

### Database Modes

#### PostgreSQL (Persistent)

For persistent sessions and user accounts across restarts:

```bash
DATABASE_URL=postgres://user:password@localhost:5432/nexus
```

Requirements:

- PostgreSQL server running
- Database created
- Network access to the database

#### In-Memory (Development)

For development or testing (data lost on restart):

```bash
DATABASE_URL=
```

Note: When using in-memory mode, users configured in `SETUP_ADMIN_USERNAME` and `SETUP_REGULAR_USERNAME` will be recreated on each restart.

## Security Notes

1. **Remove Setup Credentials**: After first login, remove the `SETUP_*` environment variables from your config file for security:

   ```bash
   vi ~/.config/agent-manager/config.env
   # Delete or comment out SETUP_ADMIN_USERNAME, SETUP_ADMIN_PASSWORD, etc.
   ```

2. **File Permissions**: The install script creates the config file with restricted permissions (0600).

3. **Database**: Use PostgreSQL for production deployments to ensure data persistence and security.

## Troubleshooting

### Installation Issues

**Problem**: Config file not found when running `./run.sh`

**Solution**: Run `./install.sh` first to create the configuration.

---

**Problem**: Permission denied when running scripts

**Solution**: Make scripts executable:

```bash
chmod +x install.sh run.sh
```

### Runtime Issues

**Problem**: Backend fails to start

**Solution**: Check the logs for errors. Common issues:

- Database connection (if using PostgreSQL)
- Port already in use
- Missing dependencies (run `pnpm install`)

---

**Problem**: Cannot login after restart (in-memory mode)

**Solution**: In-memory mode does not persist users. Either:

1. Re-run `./install.sh` to recreate config with user credentials
2. Switch to PostgreSQL mode for persistence

### Development

To run in development mode with auto-reload:

```bash
# Backend only
./run.sh backend

# Frontend only
./run.sh frontend

# Both (default)
./run.sh both
```

## File Structure

```
~/.config/agent-manager/
└── config.env              # Main configuration file

~/.local/share/agent-manager/data/  # Default data repository
├── .git/                   # Git repository for version control
├── projects/               # Project workspaces
└── README.md              # Repository info
```

## Uninstallation

To remove Agent Manager:

1. Stop the application if running (Ctrl+C)
2. Remove the configuration:
   ```bash
   rm -rf ~/.config/agent-manager
   ```
3. Remove the data repository (if desired):
   ```bash
   rm -rf ~/.local/share/agent-manager
   ```
4. Remove the source code directory

Note: If using PostgreSQL, you may also want to drop the database.
