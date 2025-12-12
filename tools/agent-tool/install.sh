#!/bin/bash

# Installation script for nexus-agent-tool
set -e

echo "Installing nexus-agent-tool..."

# Build the tool
./build.sh

# Determine installation directory
if [ -z "$PREFIX" ]; then
    INSTALL_DIR="/usr/local/bin"
else
    INSTALL_DIR="$PREFIX/bin"
fi

echo "Installing to: $INSTALL_DIR"

# Create installation directory if it doesn't exist
sudo mkdir -p "$INSTALL_DIR"

# Install the binary
sudo cp dist/index.js "$INSTALL_DIR/nexus-agent-tool"

# Make it executable
sudo chmod +x "$INSTALL_DIR/nexus-agent-tool"

echo "Installation completed successfully!"
echo "nexus-agent-tool is now available in your PATH as 'nexus-agent-tool'"