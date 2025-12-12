#!/usr/bin/env bash
# Meta-Roadmap Orchestrator Wrapper
# Calls the nexus CLI meta orchestrate command with artifact capture support

# Generate timestamp for artifact run directory
TIMESTAMP=$(date +%Y%m%d-%H%M%S)
RANDOM_ID=$(openssl rand -hex 4 2>/dev/null || echo "tempid")
ARTIFACT_RUN="run-${TIMESTAMP}-${RANDOM_ID}"

# Get project directory from arguments
PROJECT_DIR=""
for arg in "$@"; do
  if [[ "$arg" == --project-dir=* ]]; then
    PROJECT_DIR="${arg#--project-dir=}"
  elif [[ "$arg" == --project-dir ]]; then
    # Next argument should be the project directory
    continue
  fi
done

# If project dir was specified with --project-dir (not --project-dir=), get the next arg
for i in $(seq 1 $#); do
  arg=${!i}
  if [[ "$arg" == "--project-dir" ]]; then
    j=$((i+1))
    PROJECT_DIR=${!j}
    break
  fi
done

# If PROJECT_DIR is still empty, try to extract from positional arguments based on common patterns
if [[ -z "$PROJECT_DIR" && $# -gt 0 ]]; then
  # Usually the first argument is the project directory
  PROJECT_DIR="$1"
fi

# Validate PROJECT_DIR and expand it if it starts with ~
if [[ "$PROJECT_DIR" == ~* ]]; then
  PROJECT_DIR="$HOME${PROJECT_DIR:1}"
fi

# If project directory exists, create artifact directory
if [[ -n "$PROJECT_DIR" && -d "$PROJECT_DIR" ]]; then
  ARTIFACT_ROOT="$PROJECT_DIR/.nexus-artifacts/$ARTIFACT_RUN"
  mkdir -p "$ARTIFACT_ROOT/meta"
  mkdir -p "$ARTIFACT_ROOT/steps"
  mkdir -p "$ARTIFACT_ROOT/build"
  mkdir -p "$ARTIFACT_ROOT/sessions"
  mkdir -p "$ARTIFACT_ROOT/logs"

  echo "Artifacts will be stored in: $ARTIFACT_ROOT"

  # Pass the artifact root directory to the meta orchestrate command
  exec nexus meta orchestrate --artifact-run-dir="$ARTIFACT_ROOT" "$@"
else
  # If we couldn't determine project directory, run without artifact capture
  exec nexus meta orchestrate "$@"
fi
