#!/bin/bash
# Kill script for AgentManager backend processes
# Gracefully terminates processes, waits, then force kills if necessary

set -e

# Get the directory where this script is located
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# Also get the real path (resolving symlinks)
REAL_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd -P)"

echo "=== AgentManager Process Killer ==="
echo "Script directory: $SCRIPT_DIR"
if [ "$SCRIPT_DIR" != "$REAL_DIR" ]; then
    echo "Real directory:   $REAL_DIR"
fi
echo

# Kill orphaned qwen processes using PID file
QWEN_PID_FILE="$HOME/.config/agent-manager/qwen.pid"
if [ -f "$QWEN_PID_FILE" ]; then
    QWEN_PID=$(cat "$QWEN_PID_FILE" 2>/dev/null)
    if [ -n "$QWEN_PID" ]; then
        if kill -0 "$QWEN_PID" 2>/dev/null; then
            echo "Killing orphaned qwen process (PID: $QWEN_PID) from PID file..."
            kill -TERM "$QWEN_PID" 2>/dev/null || true
            sleep 2
            if kill -0 "$QWEN_PID" 2>/dev/null; then
                echo "  Force killing qwen process..."
                kill -9 "$QWEN_PID" 2>/dev/null || true
            fi
        fi
    fi
    rm -f "$QWEN_PID_FILE"
    echo "✓ Cleaned up qwen PID file"
    echo
fi

# Find PIDs of node processes in this directory (check both paths in case of symlinks)
if [ "$SCRIPT_DIR" != "$REAL_DIR" ]; then
    PIDS=$(ps aux | grep node | grep -E "($SCRIPT_DIR|$REAL_DIR)" | grep -v grep | grep -v "kill.sh" | awk '{print $2}')
else
    PIDS=$(ps aux | grep node | grep "$SCRIPT_DIR" | grep -v grep | grep -v "kill.sh" | awk '{print $2}')
fi

if [ -z "$PIDS" ]; then
    echo "No matching processes found."
    exit 0
fi

echo "Found processes:"
if [ "$SCRIPT_DIR" != "$REAL_DIR" ]; then
    ps aux | grep node | grep -E "($SCRIPT_DIR|$REAL_DIR)" | grep -v grep | grep -v "kill.sh" || true
else
    ps aux | grep node | grep "$SCRIPT_DIR" | grep -v grep | grep -v "kill.sh" || true
fi
echo

# Convert PIDs to array
PID_ARRAY=($PIDS)
echo "PIDs to terminate: ${PID_ARRAY[@]}"
echo

# Send SIGTERM to all processes
echo "Sending SIGTERM to processes..."
for pid in "${PID_ARRAY[@]}"; do
    if kill -0 "$pid" 2>/dev/null; then
        echo "  Terminating PID $pid"
        kill -TERM "$pid" 2>/dev/null || true
    fi
done
echo

# Wait up to 120 seconds for processes to terminate
echo "Waiting for processes to terminate (up to 120 seconds)..."
for i in {1..120}; do
    # Check if any processes are still alive
    ALIVE=()
    for pid in "${PID_ARRAY[@]}"; do
        if kill -0 "$pid" 2>/dev/null; then
            ALIVE+=("$pid")
        fi
    done

    if [ ${#ALIVE[@]} -eq 0 ]; then
        echo "✓ All processes terminated successfully after $i seconds"
        exit 0
    fi

    # Show progress every 10 seconds
    if [ $((i % 10)) -eq 0 ]; then
        echo "  Still waiting... ${#ALIVE[@]} process(es) alive: ${ALIVE[@]}"
    fi

    sleep 1
done

echo

# If we get here, some processes are still alive after 120 seconds
echo "⚠ Timeout reached. Checking for remaining processes..."
STILL_ALIVE=()
for pid in "${PID_ARRAY[@]}"; do
    if kill -0 "$pid" 2>/dev/null; then
        STILL_ALIVE+=("$pid")
    fi
done

if [ ${#STILL_ALIVE[@]} -eq 0 ]; then
    echo "✓ All processes terminated successfully"
    exit 0
fi

echo "✗ ${#STILL_ALIVE[@]} process(es) still alive: ${STILL_ALIVE[@]}"
echo "Sending SIGKILL to remaining processes..."
for pid in "${STILL_ALIVE[@]}"; do
    echo "  Force killing PID $pid"
    kill -9 "$pid" 2>/dev/null || true
done

# Final verification
sleep 1
FINAL_CHECK=()
for pid in "${STILL_ALIVE[@]}"; do
    if kill -0 "$pid" 2>/dev/null; then
        FINAL_CHECK+=("$pid")
    fi
done

if [ ${#FINAL_CHECK[@]} -eq 0 ]; then
    echo "✓ All processes terminated (some required force kill)"
    exit 0
else
    echo "✗ Failed to kill ${#FINAL_CHECK[@]} process(es): ${FINAL_CHECK[@]}"
    exit 1
fi
