#!/bin/bash

# Build script for nexus-agent-tool
set -e

echo "Building nexus-agent-tool..."

# Install dependencies
npm install

# Compile TypeScript
npm run build

echo "Build completed successfully!"
echo "Binary available at: dist/index.js"