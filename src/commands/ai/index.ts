// src/commands/ai/index.ts
// AI namespace module entry point

import { AISessionListHandler } from './session/list';
import { AISessionCreateHandler } from './session/create';
import { AISessionDeleteHandler } from './session/delete';
import { AISessionSelectHandler } from './session/switch'; // Note: switched to select
import { AISessionViewHandler } from './session/view';
import { AISessionCurrentHandler } from './session/current';

import { AIMessageSendHandler } from './message/send';
import { AIMessageListHandler } from './message/list';
import { AIMessageStreamHandler } from './message/stream';
import { AIMessageClearHandler } from './message/clear';

import { AIBackendListHandler } from './backend/list';
import { AIBackendSelectHandler } from './backend/select';
import { AIBackendStatusHandler } from './backend/status';

export const aiCommands = {
  session: {
    list: new AISessionListHandler(),
    create: new AISessionCreateHandler(),
    delete: new AISessionDeleteHandler(),
    select: new AISessionSelectHandler(),
    view: new AISessionViewHandler(),
    current: new AISessionCurrentHandler(),
  },
  message: {
    send: new AIMessageSendHandler(),
    list: new AIMessageListHandler(),
    stream: new AIMessageStreamHandler(),
    clear: new AIMessageClearHandler(),
  },
  backend: {
    list: new AIBackendListHandler(),
    select: new AIBackendSelectHandler(),
    status: new AIBackendStatusHandler(),
  }
};