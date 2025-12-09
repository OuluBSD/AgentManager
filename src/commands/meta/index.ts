// src/commands/meta/index.ts
// Meta-orchestration namespace module entry point

import { MetaOrchestrateHandler } from './orchestrate';

export const metaCommands = {
  orchestrate: new MetaOrchestrateHandler(),
};
