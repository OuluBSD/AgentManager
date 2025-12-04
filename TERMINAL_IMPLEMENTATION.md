# Terminal Implementation Summary

## Overview

The terminal feature in the AgentManager page has been enhanced with comprehensive settings, worker server validation, and persistent user preferences. The implementation includes both frontend and backend components.

## Implementation Status

### ✅ Completed Features

1. **Worker Server Attachment Validation**
   - Backend validates worker server availability before creating terminal sessions
   - Checks project workspace assignments for worker servers
   - Returns clear error messages when no worker server is attached
   - Validates server status (must be "online")

2. **Terminal Settings UI**
   - Modal dialog with tabbed settings interface
   - OK/Cancel buttons for confirming or discarding changes
   - Real-time preview of settings changes
   - Organized into logical sections: Font, Theme, Gradient, Background, Scrollback

3. **Persistent Terminal Settings**
   - Dual storage: localStorage (client) + database (server)
   - Settings sync across devices for logged-in users
   - Automatic fallback to localStorage if backend is unavailable
   - Per-user settings stored in:
     - PostgreSQL: `user_terminal_settings` table
     - JSON filesystem: `db/terminal-settings.json` file
   - **Works seamlessly with both database backends**

4. **Background Image Support**
   - URL-based background images
   - Adjustable opacity (0.0 - 1.0)
   - Cover/center positioning
   - Layered rendering with terminal content on top

5. **Color Gradients**
   - Vertical gradient by default (matches page theme)
   - Three gradient directions: vertical, horizontal, diagonal
   - Customizable start and end colors
   - Adjustable gradient opacity
   - Can be combined with color themes

6. **Color Themes**
   - 4 built-in themes: Dark (default), Solarized, Dracula, Monokai
   - Full ANSI color support (16 colors + bright variants)
   - Customizable via settings dialog

7. **Core Terminal Features** (Already Present)
   - ✅ Colors (ANSI color support via xterm.js)
   - ✅ Emojis (full Unicode support)
   - ✅ ncurses applications (via xterm.js PTY)
   - ✅ Scrollback buffer (default 1000 lines, configurable up to 10,000)

### 🔄 Pending Features

1. **Manager Proxy Support**
   - Currently, terminals connect directly to worker servers
   - Need to implement proxy mode where manager routes traffic
   - This requires:
     - Backend proxy endpoint on manager server
     - Connection mode detection (direct vs. proxied)
     - WebSocket proxy implementation

## File Structure

### Frontend Files

```
apps/frontend/components/
├── Terminal.tsx              # Main terminal component (UPDATED)
└── TerminalSettings.tsx      # Settings dialog component (NEW)
```

### Backend Files

```
apps/backend/src/
├── routes/
│   ├── terminal.ts          # Terminal session routes (UPDATED)
│   ├── user-settings.ts     # User settings API (NEW)
│   └── index.ts             # Route registration (UPDATED)
└── services/
    ├── terminalManager.ts   # Terminal session management (unchanged)
    └── jsonDatabase.ts      # JSON filesystem database (UPDATED)

packages/shared/db/
└── schema.ts                # Database schema (UPDATED)
```

## API Endpoints

### Terminal Sessions

```
POST /api/terminal/sessions
Body: { projectId?: string, cwd?: string }
Response: { sessionId: string }
Errors:
  - 404: Project not found
  - 400: No worker server attached
  - 400: Worker server offline
```

### User Settings

```
GET /api/user/settings/terminal
Response: { settings: TerminalSettings | null }

PUT /api/user/settings/terminal
Body: { settings: TerminalSettings }
Response: { success: true, settings: TerminalSettings }
```

## Database Schema

### PostgreSQL

**New Table: `user_terminal_settings`**

```sql
CREATE TABLE user_terminal_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  settings JSONB NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

### JSON Filesystem Database

**New File: `db/terminal-settings.json`**

```json
[
  {
    "id": "uuid",
    "userId": "user-uuid",
    "settings": { ... },
    "createdAt": "2024-01-01T00:00:00.000Z",
    "updatedAt": "2024-01-01T00:00:00.000Z"
  }
]
```

The file is automatically created on initialization and supports the same operations as PostgreSQL through the `JsonDatabase` class.

### Settings JSON Structure

```typescript
interface TerminalSettings {
  // Font settings
  fontSize: number;              // 8-24
  fontFamily: string;
  cursorBlink: boolean;
  scrollback: number;            // 100-10,000

  // Theme settings
  theme: TerminalTheme;          // 16-color ANSI palette
  themeName: string;             // "dark" | "solarized" | "dracula" | "monokai"

  // Background settings
  backgroundImage?: string;      // URL
  backgroundOpacity: number;     // 0.0-1.0

  // Gradient settings
  enableGradient: boolean;
  gradientDirection: "vertical" | "horizontal" | "diagonal";
  gradientStartColor: string;    // Hex color
  gradientEndColor: string;      // Hex color
  gradientOpacity: number;       // 0.0-1.0
}
```

## Worker Server Architecture

### Connection Flow

1. User clicks "Attach" or "Start" in terminal
2. Frontend sends `POST /api/terminal/sessions` with `projectId`
3. Backend validates:
   - Project exists
   - Project has workspace assignment to a worker server
   - Worker server type is "worker"
   - Worker server status is "online"
4. If validation passes:
   - Create PTY session on backend
   - Return session ID
   - Frontend establishes WebSocket connection
5. If validation fails:
   - Return 400 error with descriptive message
   - Frontend displays error to user

### Server Types

- **worker**: Executes terminal sessions and code
- **manager**: Routes traffic and manages topology (proxy mode - not yet implemented)
- **ai**: Handles AI model inference

## Usage

### Starting a Terminal Session

1. Select a project in the AgentManager
2. Navigate to the "Tools" tab
3. Click "Terminal" sub-tab
4. Click "Start" button (or auto-connects if enabled)
5. Terminal validates worker server and creates session
6. WebSocket connection established
7. Interactive shell ready for use

### Accessing Settings

1. Click "⚙ Settings" button in terminal toolbar
2. Modify desired settings:
   - Font size and family
   - Color theme
   - Gradient colors and direction
   - Background image URL
   - Scrollback buffer size
3. Click "Save" to apply changes
4. Settings persist to database (if logged in) and localStorage

### Error Handling

**No Worker Server Attached:**
```
Error: No worker server attached to this project.
Please attach a worker server in the project roadmap settings.
```

**Worker Server Offline:**
```
Error: Worker server is offline or not configured.
Please ensure a worker server is online and attached to this project.
```

**No Online Workers (JSON DB mode):**
```
Error: No online worker servers available.
Please start a worker server or check server status.
```

## Implementation Notes

### Database Backend Support

The implementation works seamlessly with both database backends:

1. **PostgreSQL** (`fastify.db`)
   - Settings stored in `user_terminal_settings` table
   - Relational integrity with foreign keys
   - Requires migration: `npx drizzle-kit push`

2. **JSON Filesystem** (`fastify.jsonDb`)
   - Settings stored in `db/terminal-settings.json`
   - No migration required - file created automatically
   - In-memory caching with 5-minute TTL
   - Perfect for local development

3. **No Database** (neither `fastify.db` nor `fastify.jsonDb`)
   - Falls back to localStorage only
   - Settings not synced across devices
   - Still fully functional

### Why Dual Storage?

- **localStorage**: Fast, works offline, no server dependency
- **Database**: Persists across devices, survives cache clears, user-specific

### Settings Sync Strategy

1. On component mount:
   - Try to fetch from backend (requires auth)
   - Fallback to localStorage if backend unavailable
   - Fallback to DEFAULT_SETTINGS if neither available

2. On settings change:
   - Update React state (triggers re-render)
   - Save to localStorage (synchronous)
   - Save to backend (asynchronous, fire-and-forget)

### Terminal Re-initialization

When settings change:
- Dispose existing xterm.js instance
- Create new instance with updated settings
- Reattach WebSocket if connected
- Terminal content is preserved by WebSocket session

## Next Steps

### Manager Proxy Implementation

To support remote network scenarios where traffic must be proxied through the manager:

1. **Backend Proxy Endpoint**
   ```typescript
   // apps/backend/src/routes/terminal.ts
   fastify.get("/terminal/sessions/:sessionId/proxy", { websocket: true }, ...)
   ```

2. **Connection Mode Detection**
   - Check project's server assignments
   - If manager server exists, use proxy mode
   - Otherwise, use direct connection

3. **WebSocket Proxy Logic**
   - Manager receives client WebSocket
   - Manager establishes connection to worker server
   - Bidirectional data forwarding
   - Error handling and connection lifecycle management

4. **Frontend Connection Builder**
   ```typescript
   function buildTerminalWebSocketUrl(sessionId: string, useProxy: boolean) {
     if (useProxy) {
       return `${wsProtocol}//${managerHost}/api/terminal/sessions/${sessionId}/proxy`;
     }
     return `${wsProtocol}//${workerHost}/api/terminal/sessions/${sessionId}/stream`;
   }
   ```

## Testing Checklist

### Terminal Session Tests
- [ ] Create terminal session without project (should work with local CWD)
- [ ] Create terminal session with valid project and worker server
- [ ] Create terminal session with project but no worker server (should fail)
- [ ] Create terminal session with offline worker server (should fail)

### Settings Persistence Tests
- [ ] Change settings and verify they persist to localStorage
- [ ] Change settings with PostgreSQL database and verify sync
- [ ] Change settings with JSON database and verify sync
- [ ] Verify `db/terminal-settings.json` file is created automatically
- [ ] Log out and log in, verify settings persist
- [ ] Clear localStorage, verify settings reload from database

### Visual Tests
- [ ] Test all 4 color themes (Dark, Solarized, Dracula, Monokai)
- [ ] Test gradient with vertical direction
- [ ] Test gradient with horizontal direction
- [ ] Test gradient with diagonal direction
- [ ] Test gradient opacity adjustment
- [ ] Test background image with URL
- [ ] Test background image opacity
- [ ] Verify gradient fits page color theme

### Terminal Functionality Tests
- [ ] Test ncurses applications (vim, htop, nano, etc.)
- [ ] Test Unicode and emoji rendering
- [ ] Test scrollback with long output (over 1000 lines)
- [ ] Test scrollback buffer size change (100 to 10,000)
- [ ] Verify settings dialog OK/Cancel behavior
- [ ] Test font size changes
- [ ] Test cursor blink toggle

## Known Limitations

1. **Proxy Mode Not Implemented**
   - Currently only supports direct worker connections
   - Manager proxy for remote networks is pending

2. **PostgreSQL Migration Required (if using PostgreSQL)**
   - New `user_terminal_settings` table must be created
   - Run: `npx drizzle-kit push` or create migration
   - **Not required for JSON filesystem database** (auto-creates file)

3. **Worker Server Topology**
   - Assumes local development setup by default
   - Production deployments need explicit server configuration

## References

- xterm.js: https://xtermjs.org/
- Terminal Manager Service: `apps/backend/src/services/terminalManager.ts`
- Server Repository: `apps/backend/src/services/serverRepository.ts`
- Database Schema: `packages/shared/db/schema.ts`
