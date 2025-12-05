import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..", "..");
const repoScriptsPath = path.join(repoRoot, "deps", "qwen-code", "scripts", "qwen-code");
const repoLegacyScriptPath = path.join(repoRoot, "deps", "qwen-code", "script", "qwen-code");
const homeScriptsPath = path.join(
  process.env.HOME || process.env.USERPROFILE || "",
  "Dev",
  "qwen-code",
  "scripts",
  "qwen-code"
);
const homeLegacyScriptPath = path.join(
  process.env.HOME || process.env.USERPROFILE || "",
  "Dev",
  "qwen-code",
  "script",
  "qwen-code"
);

function expandHome(p?: string): string {
  if (!p) return "";
  if (p.startsWith("~/")) {
    return path.join(process.env.HOME || process.env.USERPROFILE || "", p.slice(2));
  }
  return p;
}

/**
 * Resolve qwen-code executable path.
 * Priority:
 * 1. Explicit override (argument or QWEN_PATH env), with ~ expansion
 * 2. Local submodule at deps/qwen-code/scripts/qwen-code (if present)
 * 3. Legacy local submodule at deps/qwen-code/script/qwen-code (if present)
 * 4. Legacy ~/Dev/qwen-code/scripts/qwen-code or ~/Dev/qwen-code/script/qwen-code path
 * 5. New local submodule path (even if missing) as final fallback
 */
export function resolveQwenPath(explicitPath?: string): string {
  const override = expandHome(explicitPath || process.env.QWEN_PATH);
  if (override) {
    return override;
  }

  if (existsSync(repoScriptsPath)) {
    return repoScriptsPath;
  }

  if (existsSync(repoLegacyScriptPath)) {
    return repoLegacyScriptPath;
  }

  if (existsSync(homeScriptsPath)) {
    return homeScriptsPath;
  }

  if (existsSync(homeLegacyScriptPath)) {
    return homeLegacyScriptPath;
  }

  // Prefer the new scripts/ path even if it does not exist yet (will be created by build step)
  return repoScriptsPath;
}

export function getRepoQwenPath(): string {
  return existsSync(repoScriptsPath) ? repoScriptsPath : repoLegacyScriptPath;
}
