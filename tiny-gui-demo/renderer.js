// Get DOM elements
const counterElement = document.getElementById('counter');
const incrementBtn = document.getElementById('incrementBtn');
const resetBtn = document.getElementById('resetBtn');

// Function to update the counter display
async function updateCounterDisplay() {
  try {
    const counterValue = await window.electronAPI.getCounter();
    counterElement.textContent = counterValue;
  } catch (error) {
    console.error('Error getting counter value:', error);
  }
}

// Add event listeners to buttons
incrementBtn.addEventListener('click', async () => {
  try {
    await window.electronAPI.incrementCounter();
    updateCounterDisplay();
  } catch (error) {
    console.error('Error incrementing counter:', error);
  }
});

resetBtn.addEventListener('click', async () => {
  try {
    await window.electronAPI.resetCounter();
    updateCounterDisplay();
  } catch (error) {
    console.error('Error resetting counter:', error);
  }
});

// Initialize the display when the page loads
document.addEventListener('DOMContentLoaded', updateCounterDisplay);