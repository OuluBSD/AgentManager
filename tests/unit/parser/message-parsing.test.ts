// tests/unit/parser/message-parsing.test.ts
// Unit tests for message parsing with long content

import { tokenize, TokenResult } from '../../../src/parser/tokenizer';
import { parse, ParseResult } from '../../../src/parser/grammar-parser';
import { validate, ValidationResult } from '../../../src/parser/validator';

describe('Message Parsing for Long Content', () => {
  test('should parse quoted message with spaces correctly', () => {
    const input = 'agent chat send --message "Hello world with spaces"';

    const tokensOrError: TokenResult = tokenize(input);
    expect(Array.isArray(tokensOrError)).toBe(true);

    const tokens = tokensOrError as any; // Safe to cast since we checked it's an array
    const ast: ParseResult = parse(tokens, input);
    expect(ast).not.toHaveProperty('error');

    const result: ValidationResult = validate(ast as any);
    expect(result).not.toHaveProperty('error');

    expect((result as any).flags.message).toBe('Hello world with spaces');
  });

  test('should parse unquoted message with spaces correctly', () => {
    const input = 'agent chat send --message Hello world without quotes';

    const tokensOrError: TokenResult = tokenize(input);
    expect(Array.isArray(tokensOrError)).toBe(true);

    const tokens = tokensOrError as any; // Safe to cast since we checked it's an array
    const ast: ParseResult = parse(tokens, input);
    expect(ast).not.toHaveProperty('error');

    const result: ValidationResult = validate(ast as any);
    expect(result).not.toHaveProperty('error');

    expect((result as any).flags.message).toBe('Hello world without quotes');
  });

  test('should parse long unquoted message with multiple words', () => {
    const input = 'agent chat send --message This is a very long message without quotes that should be captured in full';

    const tokensOrError: TokenResult = tokenize(input);
    expect(Array.isArray(tokensOrError)).toBe(true);

    const tokens = tokensOrError as any; // Safe to cast since we checked it's an array
    const ast: ParseResult = parse(tokens, input);
    expect(ast).not.toHaveProperty('error');

    const result: ValidationResult = validate(ast as any);
    expect(result).not.toHaveProperty('error');

    expect((result as any).flags.message).toBe('This is a very long message without quotes that should be captured in full');
  });

  test('should parse AI message with unquoted text', () => {
    const input = 'ai message send --text This is a long AI message without quotes';

    const tokensOrError: TokenResult = tokenize(input);
    expect(Array.isArray(tokensOrError)).toBe(true);

    const tokens = tokensOrError as any; // Safe to cast since we checked it's an array
    const ast: ParseResult = parse(tokens, input);
    expect(ast).not.toHaveProperty('error');

    const result: ValidationResult = validate(ast as any);
    expect(result).not.toHaveProperty('error');

    expect((result as any).flags.text).toBe('This is a long AI message without quotes');
  });

  test('should parse message with special characters and newlines', () => {
    const input = 'agent chat send --message "Build successful\\n- Compiled 12/12 modules\\n- Tests: 45 passed, 0 failed\\n- Coverage: 92.3%"';

    const tokensOrError: TokenResult = tokenize(input);
    expect(Array.isArray(tokensOrError)).toBe(true);

    const tokens = tokensOrError as any; // Safe to cast since we checked it's an array
    const ast: ParseResult = parse(tokens, input);
    expect(ast).not.toHaveProperty('error');

    const result: ValidationResult = validate(ast as any);
    expect(result).not.toHaveProperty('error');

    // The tokenizer correctly converts escape sequences like \\n to actual newlines \n
    const expectedMessage = 'Build successful\n- Compiled 12/12 modules\n- Tests: 45 passed, 0 failed\n- Coverage: 92.3%';
    expect((result as any).flags.message).toBe(expectedMessage);
  });

  test('should handle message with single quotes inside', () => {
    const input = 'agent chat send --message "The command was console.log(\'hello world\');"';

    const tokensOrError: TokenResult = tokenize(input);
    expect(Array.isArray(tokensOrError)).toBe(true);

    const tokens = tokensOrError as any; // Safe to cast since we checked it's an array
    const ast: ParseResult = parse(tokens, input);
    expect(ast).not.toHaveProperty('error');

    const result: ValidationResult = validate(ast as any);
    expect(result).not.toHaveProperty('error');

    expect((result as any).flags.message).toBe("The command was console.log('hello world');");
  });

  test('should parse multiple flags properly with unquoted message', () => {
    const input = 'agent chat send --message This is a message with role --role assistant';

    const tokensOrError: TokenResult = tokenize(input);
    expect(Array.isArray(tokensOrError)).toBe(true);

    const tokens = tokensOrError as any; // Safe to cast since we checked it's an array
    const ast: ParseResult = parse(tokens, input);
    expect(ast).not.toHaveProperty('error');

    const result: ValidationResult = validate(ast as any);
    expect(result).not.toHaveProperty('error');

    expect((result as any).flags.message).toBe('This is a message with role');
    expect((result as any).flags.role).toBe('assistant');
  });

  test('should parse message with multiple special characters', () => {
    const input = 'agent chat send --message "This message contains @#$%^&*() special characters and [brackets] and {curly} braces"';

    const tokensOrError: TokenResult = tokenize(input);
    expect(Array.isArray(tokensOrError)).toBe(true);

    const tokens = tokensOrError as any; // Safe to cast since we checked it's an array
    const ast: ParseResult = parse(tokens, input);
    expect(ast).not.toHaveProperty('error');

    const result: ValidationResult = validate(ast as any);
    expect(result).not.toHaveProperty('error');

    expect((result as any).flags.message).toBe('This message contains @#$%^&*() special characters and [brackets] and {curly} braces');
  });
});