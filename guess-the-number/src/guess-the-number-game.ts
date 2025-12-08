#!/usr/bin/env node
/**
 * Guess the Number Game
 * 
 * A simple console game where the player tries to guess a randomly generated number.
 * The game provides feedback on whether the guess is too high or too low.
 */

import * as readline from 'readline';

// Create interface for reading user input
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

class GuessTheNumberGame {
  private secretNumber: number;
  private attempts: number;
  private maxAttempts: number;
  private minRange: number;
  private maxRange: number;

  constructor(minRange: number = 1, maxRange: number = 100, maxAttempts: number = 7) {
    this.minRange = minRange;
    this.maxRange = maxRange;
    this.maxAttempts = maxAttempts;
    this.secretNumber = this.generateRandomNumber();
    this.attempts = 0;
  }

  private generateRandomNumber(): number {
    return Math.floor(Math.random() * (this.maxRange - this.minRange + 1)) + this.minRange;
  }

  public start(): void {
    console.log(`\n🎯 Welcome to "Guess the Number" game!`);
    console.log(`I'm thinking of a number between ${this.minRange} and ${this.maxRange}.`);
    console.log(`You have ${this.maxAttempts} attempts to guess the number.`);
    console.log('Can you guess it? 🤔\n');
    
    this.playRound();
  }

  private playRound(): void {
    if (this.attempts >= this.maxAttempts) {
      console.log(`\n😔 Game Over! You've used all ${this.maxAttempts} attempts.`);
      console.log(`The number I was thinking of was: ${this.secretNumber}`);
      this.askToPlayAgain();
      return;
    }

    rl.question(`Attempt ${this.attempts + 1}/${this.maxAttempts} - Enter your guess: `, (input) => {
      const guess = parseInt(input.trim());

      // Validate the input
      if (isNaN(guess)) {
        console.log('⚠️ Please enter a valid number.\n');
        this.playRound();
        return;
      }

      if (guess < this.minRange || guess > this.maxRange) {
        console.log(`⚠️ Please enter a number between ${this.minRange} and ${this.maxRange}.\n`);
        this.playRound();
        return;
      }

      this.attempts++;
      
      // Check the guess
      if (guess === this.secretNumber) {
        console.log(`🎉 Congratulations! You guessed the number in ${this.attempts} attempts!`);
        this.askToPlayAgain();
      } else if (guess < this.secretNumber) {
        console.log(`📈 Too low! Try a higher number.\n`);
        this.playRound();
      } else {
        console.log(`📉 Too high! Try a lower number.\n`);
        this.playRound();
      }
    });
  }

  private askToPlayAgain(): void {
    rl.question('\nWould you like to play again? (y/n): ', (answer) => {
      const normalizedAnswer = answer.trim().toLowerCase();
      
      if (normalizedAnswer === 'y' || normalizedAnswer === 'yes') {
        // Reset the game with a new number
        this.secretNumber = this.generateRandomNumber();
        this.attempts = 0;
        this.start();
      } else {
        console.log('\n👋 Thanks for playing! Goodbye!');
        rl.close();
      }
    });
  }
}

// Start the game when the file is executed directly
if (require.main === module) {
  const game = new GuessTheNumberGame();
  game.start();
}

export { GuessTheNumberGame };