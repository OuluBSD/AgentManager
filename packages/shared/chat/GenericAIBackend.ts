/**
 * Generic AI Backend Client Implementation
 * Works with stdin-based AI backends (qwen/claude/gemini/codex)
 */

import { spawn, type ChildProcess } from "node:child_process";
import * as readline from "node:readline";
import type {
  AIBackend,
  AIBackendConfig,
  AIBackendEventHandlers,
  AIBackendMessage,
} from "./AIBackend";
import { buildBackendArgs, getDefaultBackendPath, normalizeBackendMessage } from "./AIBackend";

export class GenericAIBackend implements AIBackend {
  private process: ChildProcess | null = null;
  private config: AIBackendConfig;
  private handlers: AIBackendEventHandlers;
  private connected = false;
  private initReceived = false;

  constructor(config: AIBackendConfig, handlers: AIBackendEventHandlers = {}) {
    this.config = config;
    this.handlers = handlers;
  }

  async start(): Promise<void> {
    const homeDir = process.env.HOME || "";
    const backendPath = this.config.backendPath ?? getDefaultBackendPath(this.config.type, homeDir);
    const workspaceRoot = this.config.workspaceRoot ?? process.cwd();

    // Build args with tool/filesystem restrictions
    const args = buildBackendArgs({
      ...this.config,
      workspaceRoot,
      serverMode: this.config.serverMode ?? "stdin",
    });

    this.handlers.onStatus?.({ state: "connecting", message: `Starting ${this.config.type}...` });

    this.process = spawn(backendPath, args, {
      stdio: ["pipe", "pipe", "inherit"],
      cwd: workspaceRoot,
      env: process.env,
    });

    // Handle process events
    this.process.on("exit", (code, signal) => {
      this.connected = false;
      this.handlers.onStatus?.({
        state: "error",
        message: `${this.config.type} exited (code: ${code}, signal: ${signal})`,
      });
      this.handlers.onDisconnect?.();
    });

    this.process.on("error", (err) => {
      this.connected = false;
      this.handlers.onError?.(`Process error: ${err.message}`);
      this.handlers.onDisconnect?.();
    });

    // Set up stdout reader
    if (this.process.stdout) {
      const rl = readline.createInterface({
        input: this.process.stdout,
        crlfDelay: Infinity,
      });

      rl.on("line", (line) => {
        if (line.trim()) {
          try {
            const msg = JSON.parse(line);
            this.handleMessage(msg);
          } catch (err) {
            console.error(`Failed to parse message:`, line, err);
          }
        }
      });
    }

    // Wait for init message
    await this.waitForInit();
  }

  async stop(): Promise<void> {
    if (this.process) {
      this.process.kill();
      this.process = null;
      this.connected = false;
      this.initReceived = false;
    }
  }

  sendMessage(content: string): void {
    if (!this.process || !this.process.stdin) {
      throw new Error("Process not running");
    }

    const cmd =
      JSON.stringify({
        type: "user_input",
        content,
      }) + "\n";

    this.process.stdin.write(cmd);
  }

  interrupt(): void {
    if (!this.process || !this.process.stdin) {
      return;
    }

    // Send interrupt/stop signal
    const cmd =
      JSON.stringify({
        type: "interrupt",
      }) + "\n";

    this.process.stdin.write(cmd);
  }

  isConnected(): boolean {
    return this.connected;
  }

  getBackendType() {
    return this.config.type;
  }

  private handleMessage(msg: AIBackendMessage): void {
    const normalized = normalizeBackendMessage(msg, this.config.type);

    switch (normalized.type) {
      case "init":
        this.initReceived = true;
        this.connected = true;
        this.handlers.onInit?.({
          version: normalized.version,
          model: normalized.model,
          workspaceRoot: normalized.workspaceRoot,
        });
        this.handlers.onStatus?.({ state: "idle", message: "Connected" });
        break;

      case "conversation":
        if (normalized.role === "assistant") {
          if (normalized.isStreaming !== false) {
            if (normalized.content) {
              this.handlers.onStreamingChunk?.(normalized.content);
            }
          } else {
            this.handlers.onStreamingEnd?.();
          }
        }
        break;

      case "status":
        this.handlers.onStatus?.({
          state: (normalized.state as any) || "idle",
          message: normalized.message,
          thought: normalized.thought,
        });
        break;

      case "error":
        this.handlers.onError?.(normalized.message || "Unknown error");
        this.handlers.onStreamingEnd?.();
        break;

      case "info":
        // Optional: handle info messages
        break;
    }
  }

  private async waitForInit(timeout = 10000): Promise<void> {
    if (this.initReceived) return;

    return new Promise<void>((resolve, reject) => {
      const startTime = Date.now();

      const checkInit = () => {
        if (this.initReceived) {
          resolve();
        } else if (Date.now() - startTime > timeout) {
          reject(new Error("Init timeout"));
        } else {
          setTimeout(checkInit, 100);
        }
      };

      checkInit();
    });
  }
}
