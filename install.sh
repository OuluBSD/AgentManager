#!/bin/bash
set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
CONFIG_DIR="$HOME/.config/agent-manager"
CONFIG_FILE="$CONFIG_DIR/config.env"

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}  Agent Manager Installation Script${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""

# Function to prompt for input with default
prompt_input() {
    local prompt="$1"
    local default="$2"
    local value

    if [ -n "$default" ]; then
        read -p "$prompt [$default]: " value
        echo "${value:-$default}"
    else
        read -p "$prompt: " value
        echo "$value"
    fi
}

# Function to prompt for password
prompt_password() {
    local prompt="$1"
    local password
    local password_confirm

    while true; do
        read -sp "$prompt: " password
        echo ""
        read -sp "Confirm password: " password_confirm
        echo ""

        if [ "$password" = "$password_confirm" ]; then
            echo "$password"
            return
        else
            echo -e "${RED}Passwords do not match. Please try again.${NC}"
        fi
    done
}

# Create config directory
echo -e "${YELLOW}Creating configuration directory...${NC}"
mkdir -p "$CONFIG_DIR"

# Check if config already exists
if [ -f "$CONFIG_FILE" ]; then
    echo -e "${YELLOW}Configuration file already exists at $CONFIG_FILE${NC}"
    read -p "Do you want to reconfigure? [y/N]: " reconfigure
    if [[ ! "$reconfigure" =~ ^[Yy]$ ]]; then
        echo -e "${GREEN}Using existing configuration.${NC}"
        exit 0
    fi
fi

echo ""
echo -e "${BLUE}Step 1: Git Repository Configuration${NC}"
echo -e "${YELLOW}This repository will be used for persistent storage of projects, users, and sessions.${NC}"
echo ""

# Prompt for git repository directory
DEFAULT_REPO_DIR="$HOME/.local/share/agent-manager/data"
REPO_DIR=$(prompt_input "Enter the directory for the git repository" "$DEFAULT_REPO_DIR")

# Expand ~ to home directory
REPO_DIR="${REPO_DIR/#\~/$HOME}"

# Create repository directory if it doesn't exist
if [ ! -d "$REPO_DIR" ]; then
    echo -e "${YELLOW}Creating repository directory at $REPO_DIR...${NC}"
    mkdir -p "$REPO_DIR"

    # Initialize git repository
    cd "$REPO_DIR"
    if [ ! -d ".git" ]; then
        echo -e "${YELLOW}Initializing git repository...${NC}"
        git init
        git config user.name "Agent Manager"
        git config user.email "system@agent-manager.local"

        # Create initial commit
        echo "# Agent Manager Data Repository" > README.md
        echo "This repository stores persistent data for Agent Manager." >> README.md
        echo "" >> README.md
        echo "Created: $(date)" >> README.md
        git add README.md
        git commit -m "Initial commit"
        echo -e "${GREEN}Git repository initialized.${NC}"
    fi
else
    echo -e "${GREEN}Using existing directory at $REPO_DIR${NC}"

    # Check if it's a git repository
    if [ ! -d "$REPO_DIR/.git" ]; then
        echo -e "${YELLOW}Directory exists but is not a git repository. Initializing...${NC}"
        cd "$REPO_DIR"
        git init
        git config user.name "Agent Manager"
        git config user.email "system@agent-manager.local"

        # Create initial commit if there are no commits
        if ! git rev-parse HEAD &> /dev/null; then
            echo "# Agent Manager Data Repository" > README.md
            git add -A
            git commit -m "Initial commit"
        fi
        echo -e "${GREEN}Git repository initialized.${NC}"
    fi
fi

echo ""
echo -e "${BLUE}Step 2: Database Configuration${NC}"
echo -e "${YELLOW}Choose your database backend for persistent storage:${NC}"
echo -e "  ${GREEN}1)${NC} JSON files in git repository (recommended, simple)"
echo -e "  ${GREEN}2)${NC} PostgreSQL database (advanced, requires setup)"
echo -e "  ${GREEN}3)${NC} In-memory only (development, data lost on restart)"
echo ""

read -p "Select option [1/2/3]: " db_choice

case "$db_choice" in
    1)
        echo -e "${GREEN}Using JSON file storage in git repository.${NC}"
        DATABASE_TYPE="json"
        DATABASE_URL=""
        ;;
    2)
        echo -e "${YELLOW}Configuring PostgreSQL...${NC}"
        DATABASE_TYPE="postgres"
        DATABASE_URL=$(prompt_input "PostgreSQL connection URL" "postgres://user:password@localhost:5432/nexus")
        ;;
    3|"")
        echo -e "${YELLOW}Using in-memory store (not persistent).${NC}"
        DATABASE_TYPE="memory"
        DATABASE_URL=""
        ;;
    *)
        echo -e "${YELLOW}Invalid option. Defaulting to JSON file storage.${NC}"
        DATABASE_TYPE="json"
        DATABASE_URL=""
        ;;
esac

echo ""
echo -e "${BLUE}Step 3: User Account Setup${NC}"
echo -e "${YELLOW}Initial user accounts will be created on first startup.${NC}"
echo ""

# Admin user setup
echo -e "${YELLOW}Setting up administrator account...${NC}"
ADMIN_USERNAME=$(prompt_input "Admin username" "admin")
ADMIN_PASSWORD=$(prompt_password "Admin password")

echo ""

# Regular user setup
read -p "Do you want to create a regular user account? [Y/n]: " create_regular
if [[ ! "$create_regular" =~ ^[Nn]$ ]]; then
    echo -e "${YELLOW}Setting up regular user account...${NC}"
    REGULAR_USERNAME=$(prompt_input "Regular user username" "user")
    REGULAR_PASSWORD=$(prompt_password "Regular user password")
fi

echo ""
echo -e "${BLUE}Step 4: Server Configuration${NC}"
echo ""

# Server configuration
HOST=$(prompt_input "Server host" "0.0.0.0")
PORT=$(prompt_input "Server port" "3001")

# Projects root
DEFAULT_PROJECTS_ROOT="$REPO_DIR/projects"
PROJECTS_ROOT=$(prompt_input "Projects root directory" "$DEFAULT_PROJECTS_ROOT")
PROJECTS_ROOT="${PROJECTS_ROOT/#\~/$HOME}"

echo ""
echo -e "${YELLOW}Writing configuration to $CONFIG_FILE...${NC}"

# Write configuration file directly with values (no placeholder replacement needed)
cat > "$CONFIG_FILE" <<EOF
# Agent Manager Configuration
# Generated on $(date)

# Git repository for persistence
AGENT_MANAGER_REPO_DIR="$REPO_DIR"

# Server configuration
HOST="$HOST"
PORT="$PORT"

# Database configuration
# Type: json (JSON files), postgres (PostgreSQL), memory (in-memory, not persistent)
DATABASE_TYPE="$DATABASE_TYPE"

# Database URL (PostgreSQL connection string, only needed for DATABASE_TYPE=postgres)
DATABASE_URL="$DATABASE_URL"

# Projects root directory
PROJECTS_ROOT="$PROJECTS_ROOT"

# Terminal idle timeout in milliseconds (0 disables idle shutdowns)
TERMINAL_IDLE_MS=600000

# Frontend configuration
NEXT_PUBLIC_BACKEND_HTTP_BASE="http://localhost:$PORT"
EOF

# Add user credentials if created
if [ -n "$ADMIN_USERNAME" ]; then
    cat >> "$CONFIG_FILE" <<EOF

# Admin user credentials (for initial setup only)
SETUP_ADMIN_USERNAME="$ADMIN_USERNAME"
SETUP_ADMIN_PASSWORD="$ADMIN_PASSWORD"
EOF
fi

if [ -n "$REGULAR_USERNAME" ]; then
    cat >> "$CONFIG_FILE" <<EOF

# Regular user credentials (for initial setup only)
SETUP_REGULAR_USERNAME="$REGULAR_USERNAME"
SETUP_REGULAR_PASSWORD="$REGULAR_PASSWORD"
EOF
fi

echo -e "${GREEN}Configuration saved successfully!${NC}"

# Create projects directory if it doesn't exist
if [ ! -d "$PROJECTS_ROOT" ]; then
    echo -e "${YELLOW}Creating projects directory at $PROJECTS_ROOT...${NC}"
    mkdir -p "$PROJECTS_ROOT"
fi

echo ""
echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}  Installation Complete!${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""
echo -e "${BLUE}Configuration:${NC}"
echo -e "  Config file: ${YELLOW}$CONFIG_FILE${NC}"
echo -e "  Data repository: ${YELLOW}$REPO_DIR${NC}"
echo -e "  Projects directory: ${YELLOW}$PROJECTS_ROOT${NC}"
case "$DATABASE_TYPE" in
    json)
        echo -e "  Database: ${YELLOW}JSON files in $REPO_DIR/db${NC}"
        ;;
    postgres)
        echo -e "  Database: ${YELLOW}PostgreSQL at $DATABASE_URL${NC}"
        ;;
    memory)
        echo -e "  Database: ${YELLOW}In-memory (not persistent)${NC}"
        ;;
esac
echo ""
echo -e "${BLUE}Next steps:${NC}"
echo -e "  1. Run ${YELLOW}./run.sh${NC} to start the application"
echo -e "  2. Open ${YELLOW}http://localhost:$PORT${NC} in your browser"
if [ -n "$ADMIN_USERNAME" ]; then
    echo -e "  3. Login with admin username: ${YELLOW}$ADMIN_USERNAME${NC}"
fi
if [ -n "$REGULAR_USERNAME" ]; then
    echo -e "  4. Or login with regular username: ${YELLOW}$REGULAR_USERNAME${NC}"
fi
echo ""
echo -e "${YELLOW}Note: User credentials are stored in $CONFIG_FILE for initial setup.${NC}"
echo -e "${YELLOW}You should delete them from the config file after first login for security.${NC}"
echo ""
