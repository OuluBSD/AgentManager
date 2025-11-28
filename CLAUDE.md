# Agent Manager - AI Integration Notes

## Critical Security Issues

### � YOLO Mode - Tool Approval Disabled

**Status**: TEMPORARY WORKAROUND - MUST BE FIXED

**Location**: `apps/backend/src/services/qwenClient.ts:213`

**Current Issue**:
The Qwen backend is currently running with `--approval-mode yolo`, which completely disables tool approval checking. This allows the AI to execute ANY tool/command without user confirmation.

**Why This Is Dangerous**:

- AI can execute arbitrary bash commands
- AI can read/write/delete any files in the workspace
- AI can make network requests
- No safeguards against destructive operations

**Why We Did This**:
The proper tool approval flow was not working correctly:

1. Tool approval messages were being sent but not properly handled
2. The WebSocket approval protocol between frontend and backend was broken
3. Auto-approval logic in `apps/backend/src/routes/ai-chat.ts` was not functioning as expected

**What Needs To Be Fixed**:

1. **Implement proper tool approval UI in frontend**:
   - Display tool execution requests to the user
   - Show tool name, arguments, and confirmation details
   - Provide approve/reject buttons
   - Send approval responses back via WebSocket

2. **Fix approval protocol in backend**:
   - Ensure `tool_group` messages are properly forwarded to frontend
   - Wait for frontend approval before sending `tool_approval` to Qwen
   - Remove auto-approval logic from `apps/backend/src/routes/ai-chat.ts:66-80`

3. **Change approval mode back to default**:
   - In `apps/backend/src/services/qwenClient.ts:213`
   - Change from `--approval-mode yolo` to `--approval-mode default`

4. **Add timeout handling**:
   - Tool approval requests should timeout after reasonable period (30-60 seconds)
   - Timeout should result in denial, not approval

**Related Files**:

- `apps/backend/src/services/qwenClient.ts` - Qwen process spawning
- `apps/backend/src/routes/ai-chat.ts` - WebSocket message handling and auto-approval
- `apps/frontend/hooks/useAIChatBackend.ts` - Frontend WebSocket handling
- `apps/frontend/components/AIChat.tsx` - Chat UI (needs approval UI)

**Priority**: HIGH - This is a security risk in production environments
