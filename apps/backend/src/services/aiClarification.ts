import type { Database } from "./projectRepository";
import { dbGetMetaChat, dbGetMetaChatMessages } from "./projectRepository";
import { getMetaChat, getMetaChatMessages } from "./mockStore";
import type { QwenClient } from "./qwenClient";

export interface ClarificationRequest {
  metaChatId: string;
  question: string;
  context?: {
    roadmapId?: string;
    chatIds?: string[];
    includeHistory?: boolean;
  };
}

export interface ClarificationResponse {
  answer: string;
  confidence: number;
  sources?: string[];
  suggestions?: string[];
}

/**
 * Request AI clarification for a meta-chat question
 *
 * This service analyzes the meta-chat context and provides AI-generated
 * clarifications to help with roadmap management and decision-making.
 *
 * Uses Qwen AI via TCP connection to provide intelligent responses.
 */
export async function requestClarification(
  db: Database | null,
  request: ClarificationRequest,
  qwenClient?: QwenClient
): Promise<ClarificationResponse> {
  // Gather context from meta-chat
  const metaChat = db
    ? await dbGetMetaChat(db, request.context?.roadmapId ?? "")
    : getMetaChat(request.context?.roadmapId ?? "");

  if (!metaChat) {
    throw new Error("Meta-chat not found");
  }

  // Get conversation history if requested
  let history: any[] = [];
  if (request.context?.includeHistory) {
    history = db
      ? await dbGetMetaChatMessages(db, request.metaChatId)
      : getMetaChatMessages(request.metaChatId);
  }

  // Check if AI is enabled and client is available
  const useAI = qwenClient !== undefined && qwenClient.isConnected();
  console.log(
    "[AIClarification] Qwen client available:",
    qwenClient !== undefined,
    "connected:",
    qwenClient?.isConnected(),
    "useAI:",
    useAI
  );

  let answer: string;
  let aiSucceeded = false;

  if (useAI && qwenClient) {
    console.log("[AIClarification] Using AI response");
    try {
      // Get AI response from Qwen
      answer = await generateAIResponse(request.question, metaChat, history, qwenClient);
      aiSucceeded = true;
      console.log("[AIClarification] AI response succeeded");
    } catch (err) {
      console.error("[AIClarification] AI request failed, falling back to placeholder:", err);
      // Fallback to placeholder if AI fails
      answer = await generatePlaceholderResponse(request.question, metaChat, history);
    }
  } else {
    console.log("[AIClarification] Using placeholder response (AI disabled or not connected)");
    // Use placeholder when AI is disabled
    answer = await generatePlaceholderResponse(request.question, metaChat, history);
  }

  return {
    answer,
    confidence: aiSucceeded ? 0.85 : 0.6,
    sources: aiSucceeded
      ? ["meta-chat context", "roadmap status", "AI analysis"]
      : ["meta-chat context", "roadmap status"],
    suggestions: extractSuggestions(answer, metaChat),
  };
}

/**
 * Generate AI response using Qwen
 */
async function generateAIResponse(
  question: string,
  metaChat: any,
  history: any[],
  client: QwenClient
): Promise<string> {
  // Build context prompt
  let contextPrompt = `You are an AI assistant helping with project roadmap management in the AgentManager system.

Current Meta-Chat Context:
- Status: ${metaChat.status}
- Progress: ${metaChat.progress}%
- Summary: ${metaChat.summary}
- Roadmap ID: ${metaChat.roadmapId || "unknown"}
`;

  // Add conversation history if available
  if (history.length > 0) {
    contextPrompt += `\nPrevious Meta-Chat Messages (${history.length} messages):\n`;
    for (const msg of history.slice(-5)) {
      // Include last 5 messages for context
      contextPrompt += `- [${msg.role}]: ${msg.content.substring(0, 150)}${msg.content.length > 150 ? "..." : ""}\n`;
    }
  }

  contextPrompt += `\nUser Question: ${question}

Please provide a helpful, actionable answer that:
1. Directly addresses the user's question
2. References the current roadmap status and progress
3. Suggests concrete next steps if applicable
4. Keeps the response concise and focused (2-3 paragraphs max)

Your response:`;

  // Get AI response
  const response = await client.ask(contextPrompt);

  return response.trim();
}

/**
 * Extract actionable suggestions from AI response
 */
function extractSuggestions(answer: string, metaChat: any): string[] {
  const suggestions: string[] = [];

  // Add status-based suggestions
  if (metaChat.progress < 30) {
    suggestions.push("Focus on initial setup and planning tasks");
  } else if (metaChat.progress < 70) {
    suggestions.push("Monitor active work and unblock dependencies");
  } else if (metaChat.progress < 100) {
    suggestions.push("Complete remaining tasks and prepare for delivery");
  }

  // Add status-specific suggestions
  switch (metaChat.status) {
    case "blocked":
      suggestions.push("Identify and resolve blocking issues");
      break;
    case "error":
      suggestions.push("Review errors and create remediation plan");
      break;
    case "waiting":
      suggestions.push("Follow up on external dependencies");
      break;
    case "in_progress":
      suggestions.push("Ensure steady progress on active tasks");
      break;
  }

  // Extract numbered suggestions from AI response
  const numberedPattern = /\d+\.\s+(.+)/g;
  let match;
  while ((match = numberedPattern.exec(answer)) !== null && suggestions.length < 5) {
    const suggestion = match[1].trim();
    if (suggestion.length > 10 && !suggestions.includes(suggestion)) {
      suggestions.push(suggestion);
    }
  }

  // Limit to 5 suggestions
  return suggestions.slice(0, 5);
}

/**
 * Generate a placeholder response until AI integration is complete
 * This helps demonstrate the API structure and can be replaced with actual AI calls
 */
async function generatePlaceholderResponse(
  question: string,
  metaChat: any,
  history: any[]
): Promise<string> {
  const lowerQuestion = question.toLowerCase();

  // Provide contextual responses based on question type
  if (lowerQuestion.includes("status") || lowerQuestion.includes("progress")) {
    return `Based on the current meta-chat analysis:

Status: ${metaChat.status}
Progress: ${metaChat.progress}%
Summary: ${metaChat.summary}

The roadmap is currently ${metaChat.status}. ${getStatusAdvice(metaChat.status)}`;
  }

  if (lowerQuestion.includes("next") || lowerQuestion.includes("what should")) {
    return `Recommended next steps:

1. Review any blocked or error chats in the roadmap
2. Ensure in-progress chats have clear goals and timelines
3. Consider prioritizing chats based on dependencies
4. Update meta-chat with any new insights or decisions

Current roadmap progress is at ${metaChat.progress}%, with ${metaChat.summary.toLowerCase()}.`;
  }

  if (lowerQuestion.includes("why") || lowerQuestion.includes("explain")) {
    return `Let me explain the current situation:

The meta-chat aggregates status from all child chats in the roadmap. Currently:
- Overall status: ${metaChat.status}
- Progress: ${metaChat.progress}%
- ${metaChat.summary}

${history.length > 0 ? `Based on ${history.length} previous messages in this meta-chat, ` : ""}the system is tracking the roadmap's overall health and can help identify blockers or areas needing attention.`;
  }

  // Generic fallback
  return `I've analyzed your question: "${question}"

Current meta-chat context:
- Status: ${metaChat.status}
- Progress: ${metaChat.progress}%
- Summary: ${metaChat.summary}

This is a placeholder response. Once AI integration is complete, I'll provide more sophisticated analysis and recommendations based on:
- Child chat messages and status updates
- Roadmap goals and constraints
- Historical patterns and decisions
- Best practices for project management

Please integrate an AI service (Claude, Qwen, etc.) to enable full clarification capabilities.`;
}

function getStatusAdvice(status: string): string {
  switch (status) {
    case "blocked":
      return "There are blockers preventing progress. Review child chats to identify and resolve them.";
    case "error":
      return "Errors have been detected. Immediate attention is needed to get the roadmap back on track.";
    case "waiting":
      return "The roadmap is waiting on external dependencies. Check what needs to be unblocked.";
    case "in_progress":
      return "Active work is happening. Monitor progress and ensure teams have what they need.";
    case "done":
      return "The roadmap is complete! Consider archiving or starting a new roadmap.";
    case "idle":
      return "No active work detected. Consider kicking off the next phase.";
    default:
      return "Review the current state and determine next actions.";
  }
}

/**
 * Execute simple JavaScript logic expressions
 * This allows meta-chat to perform calculations and data transformations
 *
 * SECURITY: This is sandboxed to safe operations only
 */
export function executeJSLogic(expression: string, context: Record<string, any>): any {
  // TODO: Implement safe JS execution using a sandboxed environment
  // For now, return a placeholder that indicates this feature is coming

  throw new Error(
    "JS logic execution not yet implemented. This feature requires a sandboxed JS runtime."
  );
}
