import { CommandResult } from '../types';

export function outputResult(result: CommandResult): void {
  console.log(JSON.stringify(result, null, 2));
}

export function okResult<T = any>(data?: T): CommandResult<T> {
  return {
    status: 'ok',
    data,
    errors: [],
  };
}

export function errorResult(
  type: string,
  message: string,
  details?: any
): CommandResult {
  return {
    status: 'error',
    errors: [{
      type,
      message,
      details
    }]
  };
}