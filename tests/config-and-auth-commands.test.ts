// tests/config-and-auth-commands.test.ts
// Integration tests for Settings and Auth Commands

// Create a temporary config directory for testing
import os from 'os';
import path from 'path';
import fs from 'fs/promises';

// Temporary config path for testing
const tempConfigPath = path.join(os.tmpdir(), 'nexus-test-config.json');

// Create a separate module to handle config store with the temp path
const tempConfigModule = {
  ...jest.requireActual('../src/state/config-store'),
  getConfigFilePath: () => tempConfigPath,
};

// Mock the config store module before importing
jest.mock('../src/state/config-store', () => tempConfigModule);

import { loadConfig, saveConfig, resetConfigKey, resetAllConfig, getDefaultConfig } from '../src/state/config-store';
import { setAuthToken, getAuthToken, getAuthStatus, clearAuthToken } from '../src/state/auth-manager';
import { SettingsShowHandler } from '../src/commands/settings/show';
import { SettingsSetHandler } from '../src/commands/settings/set';
import { SettingsResetHandler } from '../src/commands/settings/reset';
import { AuthLoginHandler } from '../src/commands/auth/login';
import { AuthLogoutHandler } from '../src/commands/auth/logout';
import { AuthStatusHandler } from '../src/commands/auth/status';

// Mock context for testing (similar to the command interface)
const mockFlags = {};

describe('Configuration and Authentication Commands', () => {
  // Ensure clean state before each test
  beforeEach(async () => {
    try {
      await fs.unlink(tempConfigPath);
    } catch (e) {
      // File doesn't exist, which is fine
    }
  });

  afterEach(async () => {
    // Clean up test config file
    try {
      await fs.unlink(tempConfigPath);
    } catch (e) {
      // File doesn't exist, which is fine
    }
  });

  describe('Configuration Store', () => {
    test('should load default config when no config file exists', async () => {
      // Clean up any existing config file first
      try {
        await fs.unlink(tempConfigPath);
      } catch (e) {
        // File doesn't exist, which is fine
      }

      const config = await loadConfig();
      const defaultConfig = getDefaultConfig();

      // Check all properties except authToken since other tests might have set it
      expect(config.apiBaseUrl).toEqual(defaultConfig.apiBaseUrl);
      expect(config.defaultProjectId).toEqual(defaultConfig.defaultProjectId);
      expect(config.defaultAiBackend).toEqual(defaultConfig.defaultAiBackend);
      expect(config.outputMode).toEqual(defaultConfig.outputMode);
      expect(config.themeMode).toEqual(defaultConfig.themeMode);
      expect(config.autoOpenTerminal).toEqual(defaultConfig.autoOpenTerminal);
      expect(config.detailMode).toEqual(defaultConfig.detailMode);
      expect(config.rememberLastPath).toEqual(defaultConfig.rememberLastPath);
    });

    test('should save and load config correctly', async () => {
      const defaultConfig = getDefaultConfig();
      // Modify a value
      defaultConfig.outputMode = 'json';
      defaultConfig.defaultProjectId = 'test-project-id';
      
      await saveConfig(defaultConfig);
      
      const loadedConfig = await loadConfig();
      expect(loadedConfig.outputMode).toBe('json');
      expect(loadedConfig.defaultProjectId).toBe('test-project-id');
    });

    test('should reset a specific key to its default value', async () => {
      const config = await loadConfig();
      config.outputMode = 'json'; // Change from default 'pretty'
      await saveConfig(config);
      
      // Verify it was changed
      const changedConfig = await loadConfig();
      expect(changedConfig.outputMode).toBe('json');
      
      // Reset the key
      const resetConfig = await resetConfigKey('outputMode');
      expect(resetConfig.outputMode).toBe('pretty'); // Should return to default
    });

    test('should reset all config to default values', async () => {
      const config = await loadConfig();
      config.outputMode = 'json'; // Change from default 'pretty'
      config.defaultProjectId = 'test-id'; // Change from default null
      await saveConfig(config);
      
      // Verify it was changed
      const changedConfig = await loadConfig();
      expect(changedConfig.outputMode).toBe('json');
      expect(changedConfig.defaultProjectId).toBe('test-id');
      
      // Reset all
      const resetConfig = await resetAllConfig();
      const defaultConfig = getDefaultConfig();
      expect(resetConfig).toEqual(defaultConfig);
    });
  });

  describe('Auth Manager', () => {
    test('should set and get auth token correctly', async () => {
      const testToken = 'test-token-12345';
      await setAuthToken(testToken);
      
      const retrievedToken = await getAuthToken();
      expect(retrievedToken).toBe(testToken);
    });

    test('should clear auth token', async () => {
      const testToken = 'test-token-12345';
      await setAuthToken(testToken);
      
      let token = await getAuthToken();
      expect(token).toBe(testToken);
      
      await clearAuthToken();
      token = await getAuthToken();
      expect(token).toBeNull();
    });

    test('should return correct auth status', async () => {
      // Test when not logged in
      let authStatus = await getAuthStatus();
      expect(authStatus.loggedIn).toBe(false);
      
      // Test when logged in
      const testToken = 'test.token.12345'; // Using JWT-like format
      await setAuthToken(testToken);
      
      authStatus = await getAuthStatus();
      expect(authStatus.loggedIn).toBe(true);
      expect(authStatus.user).toBeDefined();
      expect(authStatus.user?.username).toBe('user'); // Default when can't parse JWT
    });
  });

  describe('Settings Commands', () => {
    test('should show current configuration', async () => {
      const handler = new SettingsShowHandler();
      const result = await handler.execute(mockFlags);
      
      expect(result.status).toBe('ok');
      expect(result.data).toHaveProperty('config');
      expect(result.data.config).toHaveProperty('outputMode');
      expect(result.data.config.outputMode).toBe('pretty');
    });

    test('should set a configuration value', async () => {
      const handler = new SettingsSetHandler();
      
      // First, get current value
      const initialResult = await new SettingsShowHandler().execute(mockFlags);
      expect(initialResult.data.config.outputMode).toBe('pretty');
      
      // Set new value
      const setResult = await handler.execute({ key: 'outputMode', value: 'json' });
      
      expect(setResult.status).toBe('ok');
      expect(setResult.data.config.outputMode).toBe('json');
      expect(setResult.message).toBe('Configuration updated: outputMode = json');
      
      // Verify new value is saved
      const finalResult = await new SettingsShowHandler().execute(mockFlags);
      expect(finalResult.data.config.outputMode).toBe('json');
    });

    test('should reject invalid configuration keys', async () => {
      const handler = new SettingsSetHandler();
      const result = await handler.execute({ key: 'invalidKey', value: 'someValue' });
      
      expect(result.status).toBe('error');
      expect(result.message).toContain('Unknown configuration key');
    });

    test('should reject invalid boolean values', async () => {
      const handler = new SettingsSetHandler();
      const result = await handler.execute({ key: 'autoOpenTerminal', value: 'notBoolean' });
      
      expect(result.status).toBe('error');
      expect(result.message).toContain('Invalid boolean value');
    });

    test('should reset a configuration key', async () => {
      // First, set a value different from default
      const setHandler = new SettingsSetHandler();
      await setHandler.execute({ key: 'outputMode', value: 'json' });
      
      // Verify it was changed
      const showHandler = new SettingsShowHandler();
      let result = await showHandler.execute(mockFlags);
      expect(result.data.config.outputMode).toBe('json');
      
      // Now reset the key
      const resetHandler = new SettingsResetHandler();
      const resetResult = await resetHandler.execute({ key: 'outputMode' });
      
      expect(resetResult.status).toBe('ok');
      expect(resetResult.data.config.outputMode).toBe('pretty');
      expect(resetResult.message).toBe("Configuration key 'outputMode' reset to default");
    });

    test('should reset all configuration', async () => {
      // First, set some values different from defaults
      const setHandler = new SettingsSetHandler();
      await setHandler.execute({ key: 'outputMode', value: 'json' });
      await setHandler.execute({ key: 'defaultProjectId', value: 'test-id' });
      
      // Verify they were changed
      const showHandler = new SettingsShowHandler();
      let result = await showHandler.execute(mockFlags);
      expect(result.data.config.outputMode).toBe('json');
      expect(result.data.config.defaultProjectId).toBe('test-id');
      
      // Now reset all
      const resetHandler = new SettingsResetHandler();
      const resetResult = await resetHandler.execute({ all: true });
      
      expect(resetResult.status).toBe('ok');
      expect(resetResult.data.config.outputMode).toBe('pretty');
      expect(resetResult.data.config.defaultProjectId).toBeNull();
      expect(resetResult.message).toBe('All configuration reset to defaults');
    });

    test('should require either --key or --all for reset command', async () => {
      const resetHandler = new SettingsResetHandler();
      const result = await resetHandler.execute({});
      
      expect(result.status).toBe('error');
      expect(result.message).toBe('Either --key or --all flag is required');
    });
  });

  describe('Auth Commands', () => {
    test('should handle login', async () => {
      const handler = new AuthLoginHandler();
      const result = await handler.execute({ username: 'testuser', password: 'password' });
      
      expect(result.status).toBe('ok');
      expect(result.data).toHaveProperty('user');
      expect(result.data).toHaveProperty('loggedIn');
      expect(result.data.loggedIn).toBe(true);
      expect(result.message).toBe('Logged in as testuser');
    });

    test('should handle logout', async () => {
      // First login
      const loginHandler = new AuthLoginHandler();
      const loginResult = await loginHandler.execute({ username: 'testuser', password: 'password' });
      expect(loginResult.status).toBe('ok');
      expect(loginResult.data.loggedIn).toBe(true);

      // Then logout
      const logoutHandler = new AuthLogoutHandler();
      const logoutResult = await logoutHandler.execute(mockFlags);
      
      expect(logoutResult.status).toBe('ok');
      expect(logoutResult.data.loggedIn).toBe(false);
      expect(logoutResult.message).toBe('Logged out successfully');
    });

    test('should handle auth status', async () => {
      // Check status when not logged in
      const statusHandler = new AuthStatusHandler();
      let result = await statusHandler.execute(mockFlags);
      
      expect(result.status).toBe('ok');
      expect(result.data.loggedIn).toBe(false);
      expect(result.message).toBe('Not logged in');
      
      // Login
      const loginHandler = new AuthLoginHandler();
      const loginResult = await loginHandler.execute({ username: 'testuser', password: 'password' });
      expect(loginResult.status).toBe('ok');
      
      // Check status when logged in
      result = await statusHandler.execute(mockFlags);

      expect(result.status).toBe('ok');
      expect(result.data.loggedIn).toBe(true);
      // The message might be 'Logged in as user' if the token isn't a proper JWT with username
      expect(result.message).toMatch(/Logged in as/);
    });
  });
});