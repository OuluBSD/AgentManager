// src/commands/system/index.ts
// System namespace module entry point

import { SystemHelpHandler } from './help';
import { SystemVersionHandler } from './version';
import { SystemParityHandler } from './parity';
import { SystemCompletionHandler } from './completion';
import { SystemDoctorHandler } from './doctor';
import { SystemChatSmokeHandler } from './chat-smoke';
import { SystemChatQwenProbeHandler } from './chat-qwen-probe';

export const systemCommands = {
  help: new SystemHelpHandler(),
  version: new SystemVersionHandler(),
  parity: new SystemParityHandler(),
  completion: new SystemCompletionHandler(),
  doctor: new SystemDoctorHandler(),
  'chat-smoke': new SystemChatSmokeHandler(),
  'chat-qwen-probe': new SystemChatQwenProbeHandler()
};