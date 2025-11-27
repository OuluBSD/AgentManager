/**
 * Terminal UI for Qwen Chat using Ink (React for CLIs)
 */

import React, { useState, useEffect } from "react";
import { Box, Text, useInput } from "ink";
import type { QwenChatSession, ChatMessage, ChatStatus } from "@nexus/shared/chat";
import chalk from "chalk";

interface ChatUIProps {
  session: QwenChatSession;
  onSendMessage: (message: string) => void;
  onExit: () => void;
}

export const ChatUI: React.FC<ChatUIProps> = ({ session, onSendMessage, onExit }) => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [status, setStatus] = useState<ChatStatus>(session.getStatus());
  const [input, setInput] = useState("");
  const [streamingMessage, setStreamingMessage] = useState<ChatMessage | null>(null);

  useEffect(() => {
    // Subscribe to session events
    const unsubscribe = session.on((event) => {
      switch (event.type) {
        case "message":
          setMessages(session.getMessages() as ChatMessage[]);
          break;
        case "status":
          setStatus(event.data as ChatStatus);
          break;
        case "streaming_start":
          setStreamingMessage(event.data as ChatMessage);
          break;
        case "streaming_chunk":
          setStreamingMessage((event.data as any).message);
          break;
        case "streaming_end":
          setStreamingMessage(null);
          break;
      }
    });

    return unsubscribe;
  }, [session]);

  useInput((input_char, key) => {
    if (key.escape || (key.ctrl && input_char === "c")) {
      onExit();
    } else if (key.return) {
      if (input.trim()) {
        onSendMessage(input.trim());
        setInput("");
      }
    } else if (key.backspace || key.delete) {
      setInput((prev) => prev.slice(0, -1));
    } else if (!key.ctrl && !key.meta && input_char) {
      setInput((prev) => prev + input_char);
    }
  });

  const renderMessage = (msg: ChatMessage) => {
    const color = msg.role === "user" ? chalk.green : chalk.cyan;
    const prefix = msg.role === "user" ? "You" : "Assistant";

    return (
      <Box key={msg.id} flexDirection="column" marginBottom={1}>
        <Text color={msg.role === "user" ? "green" : "cyan"} bold>
          {prefix}:
        </Text>
        <Text>{msg.content}</Text>
      </Box>
    );
  };

  const renderStatus = () => {
    if (status.state === "connecting") {
      return <Text color="yellow">Connecting...</Text>;
    } else if (status.state === "responding") {
      return (
        <Text color="yellow">
          {status.thought ? `Thinking: ${status.thought}` : "Responding..."}
        </Text>
      );
    } else if (status.state === "error") {
      return <Text color="red">Error: {status.message}</Text>;
    }
    return null;
  };

  return (
    <Box flexDirection="column" padding={1}>
      <Box flexDirection="column" marginBottom={1}>
        <Text bold color="blue">
          === Qwen Interactive Chat ===
        </Text>
        <Text dimColor>Model: {session.getInfo().model || "qwen-2.5-flash"}</Text>
        <Text dimColor>Type your message and press Enter. Press Esc or Ctrl+C to exit.</Text>
      </Box>

      <Box flexDirection="column" marginY={1}>
        {messages.map(renderMessage)}

        {streamingMessage && (
          <Box flexDirection="column" marginBottom={1}>
            <Text color="cyan" bold>
              Assistant:
            </Text>
            <Text>{streamingMessage.content}</Text>
          </Box>
        )}
      </Box>

      {renderStatus()}

      <Box marginTop={1}>
        <Text color="green" bold>
          You:{" "}
        </Text>
        <Text>{input}</Text>
        <Text>_</Text>
      </Box>
    </Box>
  );
};
