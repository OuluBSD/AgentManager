// test-network-commands.js
// Simple test script to verify network commands are properly registered

const { parseCommandLine } = require('./dist/parser');
const { executeCommand } = require('./dist/runtime');

async function testNetworkCommands() {
  console.log('Testing Network Command Registration...');
  
  try {
    // Test parsing of network element list command
    const listCmd = parseCommandLine('network element list');
    console.log('✓ network element list command parsed:', listCmd.commandId);
    
    // Test parsing of network element view command
    const viewCmd = parseCommandLine('network element view --id element-1');
    console.log('✓ network element view command parsed:', viewCmd.commandId);
    
    // Test parsing of network status command  
    const statusCmd = parseCommandLine('network status');
    console.log('✓ network status command parsed:', statusCmd.commandId);
    
    console.log('\nAll network commands are properly recognized by the parser!');
    
  } catch (error) {
    console.error('✗ Error testing commands:', error.message);
  }
}

// Run the test
testNetworkCommands();