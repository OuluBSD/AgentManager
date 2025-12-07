// src/declarations.d.ts
declare module 'uuid' {
  export function v4(): string;
}

declare module '*.json' {
  const value: any;
  export default value;
}