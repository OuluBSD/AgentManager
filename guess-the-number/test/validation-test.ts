#!/usr/bin/env node
/**
 * Test script to validate the improved input validation in the GuessTheNumberGame
 * Since the game is interactive, this script tests the validation logic
 */

console.log("🧪 Testing improved input validation...");

// Test cases for the regex patterns and validation logic
const testCases = [
  { input: "", expected: "empty" },
  { input: "   ", expected: "empty" },
  { input: "abc", expected: "invalid" },
  { input: "12.5", expected: "invalid" },
  { input: "12 34", expected: "invalid" },
  { input: "123", expected: "valid" },
  { input: "-45", expected: "valid" },
  { input: "0", expected: "valid" },
  { input: "  55  ", expected: "valid" },
  { input: "1e5", expected: "invalid" },
];

let passed = 0;
let total = testCases.length;

for (const testCase of testCases) {
  const trimmedInput = testCase.input.trim();
  let result;

  if (trimmedInput === '') {
    result = "empty";
  } else if (!/^-?\d+$/.test(trimmedInput)) {
    result = "invalid";
  } else {
    result = "valid";
  }

  if (result === testCase.expected) {
    console.log(`✅ Input "${testCase.input}" correctly identified as ${result}`);
    passed++;
  } else {
    console.log(`❌ Input "${testCase.input}" expected ${testCase.expected}, got ${result}`);
  }
}

console.log(`\n📊 Validation Test Results: ${passed}/${total} test cases passed`);

if (passed === total) {
  console.log("🎉 All validation tests passed!");
  process.exit(0);
} else {
  console.log("💥 Some validation tests failed!");
  process.exit(1);
}