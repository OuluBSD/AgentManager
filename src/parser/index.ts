// src/parser/index.ts
// Parser module entry point

import { tokenize } from './tokenizer';
import { parse as grammarParse } from './grammar-parser';
import { validate } from './validator';
import { CommandAST } from './grammar-parser';
import { ValidatedCommand } from './validator';

export { tokenize, TokenResult, Token } from './tokenizer';
export { parse, CommandAST } from './grammar-parser';
export { validate, ValidatedCommand, ValidationError } from './validator';

export interface ParsedCommand {
  commandPath: string[]; // [namespace, resource, action]
  arguments: {
    positional: string[];
    named: Record<string, string | boolean | string[]>;
  };
  rawInput: string;
}

export interface ParseError {
  code: string;
  message: string;
  position?: number;
  token?: string;
}

export interface ValidationResult {
  isValid: boolean;
  errors: ParseError[];
  normalized?: ParsedCommand;
}

// Main parser function that connects tokenizer → parser → validator
export function parseCommandLine(input: string): ValidatedCommand {
  // First tokenize the input
  const tokensOrError = tokenize(input);
  if (Array.isArray(tokensOrError)) {
    // If tokens are valid, parse them
    const ast = grammarParse(tokensOrError, input);

    if ('error' in ast) {
      // Handle parsing error
      throw new Error(`Parsing error: ${ast.message} at position ${ast.position}`);
    }

    // Validate the parsed AST
    const validationResult = validate(ast as CommandAST);

    if ('error' in validationResult) {
      // Handle validation error
      throw new Error(`Validation error: ${validationResult.message}`);
    }

    return validationResult as ValidatedCommand;
  } else {
    // Handle tokenization error
    throw new Error(`Tokenization error: ${tokensOrError.message} at position ${tokensOrError.position}`);
  }
}