// src/utils/formatters.ts
// Formatting utilities

export function formatOutput(data: any): string {
  // Format the data as JSON string
  return JSON.stringify(data, null, 2);
}

export function formatError(error: any): string {
  // Format the error as JSON string
  return JSON.stringify({
    status: 'error',
    data: null,
    message: error?.message || 'An unknown error occurred',
    errors: [{
      type: 'GENERAL_ERROR',
      message: error?.message || 'An unknown error occurred',
      timestamp: new Date().toISOString()
    }]
  }, null, 2);
}