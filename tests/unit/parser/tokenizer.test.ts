// tests/unit/parser/tokenizer.test.ts
// Tokenizer unit tests

import { tokenize, Token, TokenError } from '../../../src/parser/tokenizer';

describe('Tokenizer', () => {
  describe('Basic Tokenization', () => {
    test('should tokenize simple command', () => {
      const result = tokenize('nexus agent project list');
      expect(Array.isArray(result)).toBe(true);
      if (Array.isArray(result)) {
        expect(result).toHaveLength(4);
        expect(result[0]).toEqual({
          type: 'WORD',
          value: 'nexus',
          position: 0,
          raw: 'nexus'
        });
        expect(result[1]).toEqual({
          type: 'WORD',
          value: 'agent',
          position: 6,
          raw: 'agent'
        });
        expect(result[2]).toEqual({
          type: 'WORD',
          value: 'project',
          position: 12,
          raw: 'project'
        });
        expect(result[3]).toEqual({
          type: 'WORD',
          value: 'list',
          position: 20,
          raw: 'list'
        });
      }
    });

    test('should handle spaces correctly', () => {
      const result = tokenize('nexus   agent    project list');
      expect(Array.isArray(result)).toBe(true);
      if (Array.isArray(result)) {
        expect(result).toHaveLength(4);
        // All tokens should be words
        expect(result.every(token => token.type === 'WORD')).toBe(true);
      }
    });

    test('should tokenize flags', () => {
      const result = tokenize('nexus --flag value');
      expect(Array.isArray(result)).toBe(true);
      if (Array.isArray(result)) {
        expect(result).toHaveLength(3);
        expect(result[1]).toEqual({
          type: 'FLAG',
          value: 'flag',
          position: 6,
          raw: '--flag'
        });
      }
    });

    test('should tokenize short flags', () => {
      const result = tokenize('nexus -f value');
      expect(Array.isArray(result)).toBe(true);
      if (Array.isArray(result)) {
        expect(result).toHaveLength(3);
        expect(result[1]).toEqual({
          type: 'FLAG',
          value: 'f',
          position: 6,
          raw: '-f'
        });
      }
    });

    test('should tokenize equals signs', () => {
      const result = tokenize('nexus --flag=value');
      expect(Array.isArray(result)).toBe(true);
      if (Array.isArray(result)) {
        expect(result).toHaveLength(4); // nexus, --flag, =, value
        expect(result[2]).toEqual({
          type: 'EQUALS',
          value: '=',
          position: 12, // Position after --flag
          raw: '='
        });
      }
    });
  });

  describe('String Tokenization', () => {
    test('should tokenize double-quoted strings', () => {
      const result = tokenize('nexus --message="hello world"');
      expect(Array.isArray(result)).toBe(true);
      if (Array.isArray(result)) {
        expect(result).toHaveLength(4);
        expect(result[3]).toEqual({
          type: 'STRING',
          value: 'hello world',
          position: 16, // At the opening quote position
          raw: '"hello world"'
        });
      }
    });

    test('should tokenize single-quoted strings', () => {
      const result = tokenize("nexus --message='hello world'");
      expect(Array.isArray(result)).toBe(true);
      if (Array.isArray(result)) {
        expect(result).toHaveLength(4);
        expect(result[3]).toEqual({
          type: 'STRING',
          value: 'hello world',
          position: 16, // At the opening quote position
          raw: "'hello world'"
        });
      }
    });

    test('should handle escapes in double-quoted strings', () => {
      const result = tokenize('nexus --message="hello \\"world\\""');
      expect(Array.isArray(result)).toBe(true);
      if (Array.isArray(result)) {
        expect(result).toHaveLength(4);
        expect(result[3]).toEqual({
          type: 'STRING',
          value: 'hello "world"',
          position: 16,
          raw: '"hello "world""'
        });
      }
    });

    test('should handle escapes in single-quoted strings', () => {
      const result = tokenize("nexus --message='hello \\'world\\''");
      expect(Array.isArray(result)).toBe(true);
      if (Array.isArray(result)) {
        expect(result).toHaveLength(4);
        expect(result[3]).toEqual({
          type: 'STRING',
          value: "hello 'world'",
          position: 16,
          raw: "'hello 'world''"
        });
      }
    });

    test('should handle newline and tab escapes', () => {
      const result = tokenize('nexus --message="line1\\nline2\\tindented"');
      expect(Array.isArray(result)).toBe(true);
      if (Array.isArray(result)) {
        expect(result).toHaveLength(4);
        expect(result[3]).toEqual({
          type: 'STRING',
          value: 'line1\nline2\tindented',
          position: 16,
          raw: '"line1\nline2\tindented"'
        });
      }
    });
  });

  describe('Value Types', () => {
    test('should recognize integers', () => {
      const result = tokenize('nexus --limit 10');
      expect(Array.isArray(result)).toBe(true);
      if (Array.isArray(result)) {
        expect(result[2]).toEqual({
          type: 'NUMBER',
          value: '10',
          position: 14,
          raw: '10'
        });
      }
    });

    test('should recognize floats', () => {
      const result = tokenize('nexus --limit 10.5');
      expect(Array.isArray(result)).toBe(true);
      if (Array.isArray(result)) {
        expect(result[2]).toEqual({
          type: 'NUMBER',
          value: '10.5',
          position: 14,
          raw: '10.5'
        });
      }
    });

    test('should recognize boolean tokens', () => {
      const result = tokenize('nexus true false');
      expect(Array.isArray(result)).toBe(true);
      if (Array.isArray(result)) {
        expect(result[1]).toEqual({
          type: 'BOOLEAN',
          value: 'true',
          position: 6, // After 'nexus '
          raw: 'true'
        });
        expect(result[2]).toEqual({
          type: 'BOOLEAN',
          value: 'false',
          position: 11, // After 'nexus true '
          raw: 'false'
        });
      }
    });

    test('should handle mixed case booleans', () => {
      const result = tokenize('nexus True FALSE');
      expect(Array.isArray(result)).toBe(true);
      if (Array.isArray(result)) {
        expect(result[1]).toEqual({
          type: 'BOOLEAN',
          value: 'true',
          position: 6,
          raw: 'True'
        });
        expect(result[2]).toEqual({
          type: 'BOOLEAN',
          value: 'false',
          position: 11,
          raw: 'FALSE'
        });
      }
    });
  });

  describe('Error Handling', () => {
    test('should return error for unterminated double quotes', () => {
      const result = tokenize('nexus --message="hello world'); // No closing quote
      expect(result).toEqual({
        error: true,
        message: 'Unterminated quote, expected closing " at position 16',
        position: 16 // Position of the opening quote
      });
    });

    test('should return error for unterminated single quotes', () => {
      const result = tokenize("nexus --message='hello world"); // No closing quote
      expect(result).toEqual({
        error: true,
        message: "Unterminated quote, expected closing ' at position 16",
        position: 16 // Position of the opening quote
      });
    });

    test('should return error for escape at end of string', () => {
      const result = tokenize('nexus --message="hello world\\');
      expect(result).toEqual({
        error: true,
        message: 'Unterminated quote, expected closing " at position 16',
        position: 16
      });
    });

    test('should return error for invalid short flag', () => {
      const result = tokenize('nexus -');
      expect(result).toEqual({
        error: true,
        message: 'Invalid short flag at position 7',
        position: 7
      });
    });
  });

  describe('Complex Examples', () => {
    test('should tokenize complex command with multiple elements', () => {
      const result = tokenize('nexus agent project create --name="My Project" --category web --limit 10');
      expect(Array.isArray(result)).toBe(true);
      if (Array.isArray(result)) {
        expect(result).toHaveLength(11); // nexus, agent, project, create, --name, =, "My Project", --category, web, --limit, 10
        expect(result[0]).toEqual({ type: 'WORD', value: 'nexus', position: 0, raw: 'nexus' });
        expect(result[1]).toEqual({ type: 'WORD', value: 'agent', position: 6, raw: 'agent' });
        expect(result[2]).toEqual({ type: 'WORD', value: 'project', position: 12, raw: 'project' });
        expect(result[3]).toEqual({ type: 'WORD', value: 'create', position: 20, raw: 'create' });
        expect(result[4]).toEqual({ type: 'FLAG', value: 'name', position: 27, raw: '--name' });
        expect(result[5]).toEqual({ type: 'EQUALS', value: '=', position: 33, raw: '=' });
        expect(result[6]).toEqual({
          type: 'STRING',
          value: 'My Project',
          position: 34,
          raw: '"My Project"'
        });
        expect(result[7]).toEqual({ type: 'FLAG', value: 'category', position: 47, raw: '--category' });
        expect(result[8]).toEqual({ type: 'WORD', value: 'web', position: 58, raw: 'web' });
        expect(result[9]).toEqual({ type: 'FLAG', value: 'limit', position: 62, raw: '--limit' });
        expect(result[10]).toEqual({ type: 'NUMBER', value: '10', position: 70, raw: '10' });
      }
    });

    test('should tokenize command with equals and separate value', () => {
      const result = tokenize('nexus --flag=value --other separate_value');
      expect(Array.isArray(result)).toBe(true);
      if (Array.isArray(result)) {
        expect(result).toHaveLength(6);
        expect(result[1]).toEqual({ type: 'FLAG', value: 'flag', position: 6, raw: '--flag' });
        expect(result[2]).toEqual({ type: 'EQUALS', value: '=', position: 12, raw: '=' });
        expect(result[3]).toEqual({ type: 'WORD', value: 'value', position: 13, raw: 'value' });
        expect(result[4]).toEqual({ type: 'FLAG', value: 'other', position: 19, raw: '--other' });
        expect(result[5]).toEqual({ type: 'WORD', value: 'separate_value', position: 27, raw: 'separate_value' });
      }
    });
  });
});