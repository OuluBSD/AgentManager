# Debugging the Tiny GUI Demo Application

## Expected Nexus CLI Debug Outputs

Since the Nexus CLI is not functional in this environment due to module system issues, I'll document what the typical outputs would look like when debugging the GUI application.

### 1. `nexus debug process list`

This command would list all running processes related to the Nexus ecosystem. The expected output would be something like:

```json
{
  "status": "ok",
  "data": {
    "processes": [
      {
        "pid": 12345,
        "name": "electron",
        "command": "/path/to/electron /path/to/tiny-gui-demo",
        "project": "tiny-gui-demo",
        "startTime": "2025-12-08T14:30:00Z",
        "status": "running",
        "resources": {
          "cpu": 5.2,
          "memory": 120480
        }
      },
      {
        "pid": 12346,
        "name": "electron-renderer",
        "command": "electron --type=renderer",
        "project": "tiny-gui-demo",
        "startTime": "2025-12-08T14:30:00Z", 
        "status": "running",
        "resources": {
          "cpu": 2.1,
          "memory": 95600
        }
      }
    ],
    "count": 2
  },
  "message": "Found 2 processes for project tiny-gui-demo"
}
```

### 2. `nexus debug process view --id <pid>`

This would provide detailed information about a specific process:

```json
{
  "status": "ok",
  "data": {
    "process": {
      "pid": 12345,
      "name": "electron",
      "command": "/path/to/electron /path/to/tiny-gui-demo",
      "project": "tiny-gui-demo",
      "status": "running",
      "startTime": "2025-12-08T14:30:00Z",
      "memoryUsage": 120480,
      "cpuUsage": 5.2,
      "networkConnections": [],
      "fileHandles": ["/path/to/tiny-gui-demo/main.js", "/path/to/tiny-gui-demo/renderer.js"],
      "environment": {
        "NODE_ENV": "development",
        "ELECTRON_RUN_AS_NODE": "",
        "USER": "sblo"
      },
      "metadata": {
        "nexusProject": "tiny-gui-demo",
        "nexusRoadmap": "MVP",
        "nexusContext": {
          "activeProjectId": "uuid123",
          "activeRoadmapId": "uuid456",
          "activeChatId": "uuid789"
        }
      }
    }
  },
  "message": "Process details for PID 12345"
}
```

### 3. `nexus debug process logs --id <pid>`

This would stream or retrieve logs from the specific process:

```json
{
  "status": "ok",
  "data": {
    "logs": [
      {
        "timestamp": "2025-12-08T14:30:01Z",
        "level": "info",
        "message": "App starting",
        "process": "main",
        "metadata": {
          "nexusProject": "tiny-gui-demo"
        }
      },
      {
        "timestamp": "2025-12-08T14:30:02Z", 
        "level": "info",
        "message": "Window created",
        "process": "main",
        "metadata": {
          "nexusProject": "tiny-gui-demo"
        }
      },
      {
        "timestamp": "2025-12-08T14:30:15Z",
        "level": "info", 
        "message": "Counter incremented to 1",
        "process": "renderer",
        "metadata": {
          "nexusProject": "tiny-gui-demo"
        }
      }
    ]
  },
  "message": "Last 100 log entries for process PID 12345"
}
```

### 4. `nexus network element list`

For GUI applications, this would typically list network elements (though Electron apps might not have many):

```json
{
  "status": "ok",
  "data": {
    "elements": [
      {
        "id": "net-12345",
        "type": "local-socket",
        "name": "electron-ipc",
        "status": "active",
        "project": "tiny-gui-demo",
        "metadata": {
          "nexusProject": "tiny-gui-demo",
          "connectionType": "inter-process"
        }
      }
    ],
    "count": 1
  },
  "message": "Found 1 network element for project tiny-gui-demo"
}
```

## Analysis of Correlation Challenges

### Current Correlation Difficulties

1. **Process Identification**: Without clear project metadata embedded in processes, it's hard to know which process belongs to which Nexus project.

2. **Metadata Gaps**: The debugging outputs currently don't have enough Nexus-specific metadata to link processes directly to project, roadmap, and chat contexts.

3. **GUI Process Complexity**: GUI applications typically have multiple processes (main, renderer, GPU process, etc.), making it difficult to track the complete application state.

## What Metadata Would Make Correlation Trivial

1. **Process Tags**: Each process should have tags indicating its Nexus project, roadmap, and chat IDs.

2. **Application Context**: Include the current application state and context in all debugging outputs.

3. **Traceability Links**: Create clear links between processes, network elements, and Nexus project artifacts.

4. **Unified Process View**: Combine related processes under a single application view rather than listing them separately.

## Proposed Improvement for Debug/Network Outputs

The most valuable improvement would be to add unified, project-aware metadata to all debug outputs that directly links to the Nexus project context (project ID, roadmap ID, chat ID). This would allow an AI agent to easily:

1. Identify which processes belong to which project
2. Track application state changes in the context of project roadmaps
3. Correlate debugging information with development conversations happening in chats
4. Understand how individual processes contribute to overall project goals