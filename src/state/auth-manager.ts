// src/state/auth-manager.ts
// Authentication management for the Nexus CLI

import { loadConfig, saveConfig, Config } from './config-store';

export interface AuthStatus {
  loggedIn: boolean;
  user?: {
    id: string;
    username: string;
  };
}

// Set the authentication token in config
export async function setAuthToken(token: string | null): Promise<void> {
  const config = await loadConfig();
  config.authToken = token;
  await saveConfig(config);
}

// Get the authentication token from config
export async function getAuthToken(): Promise<string | null> {
  const config = await loadConfig();
  return config.authToken;
}

// Get the current authentication status
export async function getAuthStatus(): Promise<AuthStatus> {
  const config = await loadConfig();
  
  if (config.authToken) {
    // In a real implementation, we would decode the token or make a call to validate it
    // For now, we'll just check if it exists and return a mock user
    try {
      // Simple validation: check if token looks like a JWT
      const parts = config.authToken.split('.');
      if (parts.length === 3 && parts[1]) {
        // Decode the payload part to get user info
        try {
          const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString());
          return {
            loggedIn: true,
            user: {
              id: payload.sub || 'unknown',
              username: payload.username || payload.name || 'user'
            }
          };
        } catch (e) {
          // If we can't parse the JWT payload, return basic info
          return {
            loggedIn: true,
            user: {
              id: 'unknown',
              username: 'user'
            }
          };
        }
      } else {
        // If not a JWT, return a simple logged-in status
        return {
          loggedIn: true,
          user: {
            id: 'unknown',
            username: 'user'
          }
        };
      }
    } catch (error) {
      // If we can't parse the token, assume the user is logged in but we can't get details
      return {
        loggedIn: true,
        user: {
          id: 'unknown',
          username: 'user'
        }
      };
    }
  } else {
    return {
      loggedIn: false
    };
  }
}

// Clear the authentication token (logout)
export async function clearAuthToken(): Promise<void> {
  await setAuthToken(null);
}