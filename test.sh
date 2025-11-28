#!/bin/bash

# Nexus Monorepo Test Script
# This script builds the project and runs all tests

set -e  # Exit immediately if a command exits with a non-zero status

echo "Building the project..."

# Build all packages
pnpm -r build

echo "Running tests..."

# Run tests across all packages
pnpm test

echo "All tests passed!"