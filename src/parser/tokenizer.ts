// src/parser/tokenizer.ts
// Parser tokenizer - converts command line string into tokens

export interface Token {
  type: 'WORD' | 'FLAG' | 'EQUALS' | 'STRING' | 'NUMBER' | 'BOOLEAN' | 'LIST';
  value: string;
  position: number;
  raw: string;
}

export interface TokenError {
  error: true;
  message: string;
  position: number;
}

export type TokenResult = Token[] | TokenError;

export class Tokenizer {
  private input: string = '';
  private position: number = 0;

  tokenize(input: string): TokenResult {
    this.input = input;
    this.position = 0;
    const tokens: Token[] = [];

    while (this.position < this.input.length) {
      // Skip whitespace
      while (this.position < this.input.length && /\s/.test(this.input[this.position] || '')) {
        this.position++;
      }

      if (this.position >= this.input.length) {
        break;
      }

      const token = this.nextToken();

      if ('error' in token) {
        return token; // Return error immediately
      }

      tokens.push(token);
    }

    return tokens;
  }

  private nextToken(): Token | TokenError {
    const startPos = this.position;

    // Check for flags first
    const currentChar = this.input[this.position];
    if (currentChar === '-') {
      if (this.position + 1 < this.input.length && this.input[this.position + 1] === '-') {
        // Long flag: --flagname
        this.position += 2; // Skip --
        let flagName = '';

        while (this.position < this.input.length &&
               /[a-zA-Z0-9_-]/.test(this.input[this.position] || '')) {
          flagName += this.input[this.position];
          this.position++;
        }

        return {
          type: 'FLAG',
          value: flagName,
          position: startPos,
          raw: `--${flagName}`
        };
      } else {
        // Short flag: -f
        this.position++; // Skip -
        if (this.position >= this.input.length || !/[a-zA-Z0-9]/.test(this.input[this.position] || '')) {
          return {
            error: true,
            message: `Invalid short flag at position ${this.position}`,
            position: this.position
          };
        }

        const flagName = this.input[this.position] || '';
        this.position++;

        return {
          type: 'FLAG',
          value: flagName,
          position: startPos,
          raw: `-${flagName}`
        };
      }
    }

    // Check for equals sign
    if (currentChar === '=') {
      this.position++;
      return {
        type: 'EQUALS',
        value: '=',
        position: startPos,
        raw: '='
      };
    }

    // Check for quoted strings
    if (currentChar === '"' || currentChar === "'") {
      const quoteType = currentChar;
      this.position++; // Skip opening quote

      let value = '';

      let foundClosingQuote = false;
      while (this.position < this.input.length) {
        const char = this.input[this.position];

        if (char === quoteType) {
          // Closing quote found
          foundClosingQuote = true;
          this.position++; // Skip closing quote
          break;
        }

        if (char === '\\') {
          // Handle escape sequences
          this.position++; // Skip backslash
          if (this.position >= this.input.length) {
            return {
              error: true,
              message: `Unterminated quote, expected closing ${quoteType} at position ${startPos}`,
              position: startPos
            };
          }

          const escapeChar = this.input[this.position];
          switch (escapeChar) {
            case '"':
            case "'":
            case '\\':
              value += escapeChar;
              break;
            case 'n':
              value += '\n';
              break;
            case 't':
              value += '\t';
              break;
            default:
              value += escapeChar; // Treat as literal if not a known escape
          }
        } else {
          value += char;
        }

        this.position++;
      }

      // Check if we reached end of input without finding closing quote
      if (!foundClosingQuote) {
        return {
          error: true,
          message: `Unterminated quote, expected closing ${quoteType} at position ${startPos}`,
          position: startPos
        };
      }

      return {
        type: 'STRING',
        value,
        position: startPos,
        raw: quoteType + value + quoteType
      };
    }

    // Handle unquoted tokens (identifiers, numbers, booleans, etc.)
    let tokenValue = '';

    while (this.position < this.input.length &&
           !/\s/.test(this.input[this.position] || '') &&
           (this.input[this.position] || '') !== '=' &&
           (this.input[this.position] || '') !== '"' &&
           (this.input[this.position] || '') !== "'") {
      tokenValue += this.input[this.position];
      this.position++;
    }

    // Determine the type of the token
    if (/^-?\d+$/.test(tokenValue)) {
      // Integer
      return {
        type: 'NUMBER',
        value: tokenValue,
        position: startPos,
        raw: tokenValue
      };
    } else if (/^-?\d+\.\d+$/.test(tokenValue)) {
      // Float
      return {
        type: 'NUMBER',
        value: tokenValue,
        position: startPos,
        raw: tokenValue
      };
    } else if (tokenValue.toLowerCase() === 'true' || tokenValue.toLowerCase() === 'false') {
      // Boolean
      return {
        type: 'BOOLEAN',
        value: tokenValue.toLowerCase(),
        position: startPos,
        raw: tokenValue
      };
    } else if (tokenValue.startsWith('[') && tokenValue.endsWith(']')) {
      // List (simplified for now, would need more parsing for complex lists)
      const listContent = tokenValue.substring(1, tokenValue.length - 1);
      const items = listContent.split(',').map(item => item.trim());

      return {
        type: 'LIST',
        value: listContent,
        position: startPos,
        raw: tokenValue
      };
    } else {
      // Regular word/identifier
      return {
        type: 'WORD',
        value: tokenValue,
        position: startPos,
        raw: tokenValue
      };
    }
  }
}

export function tokenize(input: string): TokenResult {
  const tokenizer = new Tokenizer();
  return tokenizer.tokenize(input);
}