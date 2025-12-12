// src/commands/agent/chat/send.ts
// Agent Chat send command handler

import { CommandHandler } from '../../../runtime/handler-registry';
import { ExecutionContext } from '../../../runtime/types';
import { API_CLIENT } from '../../../api/client';
import { ContextManager } from '../../../state/context-manager';
import * as fs from 'fs/promises';
import * as process from 'process';

export class AgentChatSendHandler implements CommandHandler {
  async execute(context: ExecutionContext): Promise<any> {
    try {
      const { message, stdin: readStdin, file, role = 'user' } = context.flags;
      const { activeChatId } = context.contextState || {};

      if (!activeChatId) {
        throw new Error('An active chat is required to send a message');
      }

      // Determine the message content based on input method
      let messageContent: string;

      if (file) {
        // Read message from file
        try {
          messageContent = await fs.readFile(file, 'utf8');
        } catch (error) {
          throw new Error(`Failed to read message from file ${file}: ${(error as Error).message}`);
        }
      } else if (readStdin) {
        // Read message from stdin
        const chunks: Buffer[] = [];
        for await (const chunk of process.stdin) {
          chunks.push(chunk);
        }
        messageContent = Buffer.concat(chunks).toString('utf8');
      } else if (message !== undefined) {
        // Use the message flag value
        messageContent = message;
      } else {
        // This should not happen due to validation, but as a fallback
        throw new Error('No message content provided. Use --message, --stdin, or --file flag.');
      }

      // Get the current chat to update it with the new message
      const chatResponse = await API_CLIENT.getChatById(activeChatId);

      if (chatResponse.status === 'error') {
        throw new Error(`Failed to get chat: ${chatResponse.message}`);
      }

      if (chatResponse.status === 'auth_error') {
        throw new Error(`Authentication error: ${chatResponse.message}`);
      }

      const chat = chatResponse.data.chat;

      if (!chat) {
        throw new Error(`Chat with ID ${activeChatId} not found`);
      }

      // Add the new message to the chat
      if (!chat.messages) {
        chat.messages = [];
      }

      const newMessage = {
        id: chat.messages.length + 1,
        role,
        content: messageContent,
        timestamp: Date.now(),
        metadata: {},
        displayRole: role.charAt(0).toUpperCase() + role.slice(1)
      };

      chat.messages.push(newMessage);

      // In a real implementation we would update the chat via the API
      // For the mock implementation, we'll just return the updated chat
      return {
        status: 'ok',
        data: { chat },
        message: `Message sent to chat "${chat.title}"`
      };
    } catch (error) {
      const errorMessage = `Failed to send message to chat: ${error instanceof Error ? error.message : 'Unknown error'}`;
      const err = new Error(errorMessage);
      if (error instanceof Error) {
        err.stack = error.stack; // Preserve original stack trace
      }
      throw err;
    }
  }

  validate(args: any): any {
    const { message, stdin, file } = args;

    // Check that at least one input method is provided
    if (!message && !stdin && !file) {
      throw new Error('No message content provided. Use --message, --stdin, or --file flag.');
    }

    // The validator in the parser already handles the mutually exclusive constraint,
    // so we don't need to duplicate that logic here

    return {
      isValid: true,
      args
    };
  }
}