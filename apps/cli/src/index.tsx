#!/usr/bin/env node
/**
 * AgentManager CLI Chat
 * Interactive chat interface using shared QwenChatSession and Ink UI
 * Also supports --eval for non-interactive testing
 */

import React from "react";
import { render } from "ink";
import { QwenChatSession } from "@nexus/shared/chat";
import { QwenChatClient } from "./QwenChatClient.js";
import { ChatUI } from "./ChatUI.js";

/**
 * Non-interactive eval mode
 */
async function evalMode(message: string) {
  const session = new QwenChatSession();
  const client = new QwenChatClient(session, {
    workspaceRoot: process.cwd(),
  });

  try {
    await client.start();
  } catch (err) {
    console.error("Failed to start Qwen client:", err);
    process.exit(1);
  }

  // Wait for response
  let responseComplete = false;
  let fullResponse = "";

  const unsubscribe = session.on((event) => {
    if (event.type === "streaming_chunk") {
      const data = event.data as any;
      fullResponse = data.message?.content || "";
    } else if (event.type === "streaming_end") {
      responseComplete = true;
    } else if (event.type === "message") {
      const messages = session.getMessages();
      const lastMessage = messages[messages.length - 1];
      if (lastMessage?.role === "assistant") {
        fullResponse = lastMessage.content;
        responseComplete = true;
      }
    } else if (event.type === "error") {
      console.error("Error:", (event.data as any).message);
      process.exit(1);
    }
  });

  // Send the message
  client.sendMessage(message);

  // Wait for response to complete (with timeout)
  const timeout = 30000; // 30 seconds
  const startTime = Date.now();

  while (!responseComplete && Date.now() - startTime < timeout) {
    await new Promise((resolve) => setTimeout(resolve, 100));
  }

  unsubscribe();
  await client.stop();

  if (responseComplete && fullResponse) {
    console.log(fullResponse);
    process.exit(0);
  } else {
    console.error("Timeout waiting for response");
    process.exit(1);
  }
}

/**
 * Interactive mode with Ink UI
 */
async function interactiveMode() {
  // Create chat session (shared state)
  const session = new QwenChatSession();

  // Create client (connects to qwen-code backend)
  const client = new QwenChatClient(session, {
    workspaceRoot: process.cwd(),
  });

  // Start the client
  try {
    await client.start();
  } catch (err) {
    console.error("Failed to start Qwen client:", err);
    process.exit(1);
  }

  // Render the UI
  const { unmount, waitUntilExit } = render(
    <ChatUI
      session={session}
      onSendMessage={(message) => client.sendMessage(message)}
      onExit={() => {
        client.stop();
        unmount();
        process.exit(0);
      }}
    />
  );

  // Handle process exit
  process.on("SIGINT", () => {
    client.stop();
    unmount();
    process.exit(0);
  });

  await waitUntilExit();
}

async function main() {
  // Parse command line arguments
  const args = process.argv.slice(2);
  const evalIndex = args.indexOf("--eval");

  if (evalIndex !== -1 && args[evalIndex + 1]) {
    // Non-interactive eval mode
    const message = args[evalIndex + 1];
    await evalMode(message);
  } else {
    // Interactive mode
    await interactiveMode();
  }
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
