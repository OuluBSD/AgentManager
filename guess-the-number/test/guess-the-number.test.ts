// Simple tests for the GuessTheNumberGame class
// Note: These are conceptual tests since the game uses readline and is interactive

import { GuessTheNumberGame } from './src/guess-the-number-game';

// Mock readline for testing purposes
jest.mock('readline');

describe('GuessTheNumberGame', () => {
  let game: GuessTheNumberGame;

  beforeEach(() => {
    // Create a new game instance for each test
    // For now, this is just a high-level test as the actual implementation 
    // uses readline which makes unit testing more complex
    game = new GuessTheNumberGame(1, 10, 5);
  });

  test('should generate a random number within the specified range', () => {
    const secretNumber = (game as any).secretNumber; // Access private property for testing
    expect(secretNumber).toBeGreaterThanOrEqual(1);
    expect(secretNumber).toBeLessThanOrEqual(10);
  });

  test('should initialize with default values when no parameters provided', () => {
    const defaultGame = new GuessTheNumberGame();
    expect((defaultGame as any).minRange).toBe(1);
    expect((defaultGame as any).maxRange).toBe(100);
    expect((defaultGame as any).maxAttempts).toBe(7);
  });
});