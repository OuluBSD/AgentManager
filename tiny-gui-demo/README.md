# Tiny GUI Demo

A minimal GUI application built with Electron. This is a simple counter application that demonstrates a basic GUI with interactive elements.

## Features

- Click a button to increment a counter
- Reset button to reset the counter to zero
- Simple, clean interface

## How to Run

1. Make sure you have Node.js and npm installed
2. Install dependencies: `npm install`
3. Start the application: `npm start`

## Development

To run in development mode with developer tools: `npm run dev`

## Project Structure

- `main.js`: Main process - handles app lifecycle and window management
- `preload.js`: Preload script - securely exposes APIs to renderer
- `renderer.js`: Renderer process - handles UI logic
- `index.html`: User interface
- `package.json`: Project configuration and dependencies