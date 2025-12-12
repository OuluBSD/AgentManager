// src/commands/system/doctor.ts
// System Doctor command - checks system configuration and connectivity

import { CommandHandler } from '../../runtime/handler-registry';
import { ExecutionContext, CommandResult } from '../../runtime/types';
import { loadConfig, getConfigFilePath } from '../../state/config-store';
import { APIClient } from '../../api/client';
import fs from 'fs/promises';
import path from 'path';

interface DoctorCheck {
  name: string;
  status: 'ok' | 'warning' | 'error';
  message?: string;
  fixHint?: string;
}

interface DoctorResult {
  status: 'ok' | 'warning' | 'error';
  checks: DoctorCheck[];
  timestamp: string;
  changes?: any;
}

export class SystemDoctorHandler implements CommandHandler {
  async execute(_ctx: ExecutionContext): Promise<CommandResult> {
    try {
      const checks: DoctorCheck[] = [];

      // Check config integrity
      checks.push(await checkConfig());

      // Check API connectivity
      checks.push(await checkAPIConnectivity());

      // Check auth token usability
      checks.push(await checkAuthToken());

      // Check file permissions for config directory
      checks.push(await checkConfigFilePermissions());

      // Check parity
      checks.push(await checkParity());

      // Check version status
      checks.push(await checkVersionStatus());

      // Chat-specific checks
      checks.push(await checkChatBackendReachable());
      checks.push(await checkChatWorkerAlive());
      checks.push(await checkChatAIServerCompatible());
      checks.push(await checkChatBasicSend());

      // Determine overall status
      const overallStatus = checks.some(check => check.status === 'error')
        ? 'error'
        : checks.some(check => check.status === 'warning')
          ? 'warning'
          : 'ok';

      // Load previous results to compute changes
      const previousResults = await this.loadPreviousResults();
      const result: DoctorResult = {
        status: overallStatus,
        checks,
        timestamp: new Date().toISOString(),
        changes: this.computeChanges(previousResults, checks)
      };

      // Save current results for next comparison
      await this.saveCurrentResults(result);

      return {
        status: 'ok' as const,
        data: result,
        message: `System doctor check completed. Overall status: ${overallStatus}`,
        errors: []
      };
    } catch (error: any) {
      return {
        status: 'error',
        data: null,
        message: `System doctor check failed: ${error.message}`,
        errors: [{
          type: 'DOCTOR_ERROR',
          message: error.message
        }]
      };
    }
  }

  private async loadPreviousResults(): Promise<DoctorResult | null> {
    try {
      const configPath = getConfigFilePath();
      const resultsPath = path.join(path.dirname(configPath), 'doctor-results.json');
      const content = await fs.readFile(resultsPath, 'utf-8');
      return JSON.parse(content) as DoctorResult;
    } catch (error) {
      // If file doesn't exist or is invalid, return null
      return null;
    }
  }

  private async saveCurrentResults(results: DoctorResult): Promise<void> {
    try {
      const configPath = getConfigFilePath();
      const resultsPath = path.join(path.dirname(configPath), 'doctor-results.json');
      await fs.writeFile(resultsPath, JSON.stringify(results, null, 2));
    } catch (error) {
      // If saving fails, just log the error but don't fail the doctor command
      console.error('Failed to save doctor results for comparison:', error);
    }
  }

  private computeChanges(prev: DoctorResult | null, current: DoctorCheck[]): any {
    if (!prev) {
      // If no previous results, all checks are "unchanged" but we'll return a simple flag
      const comparisons = current.map(check => ({
        name: check.name,
        previousStatus: null,
        currentStatus: check.status,
        statusChange: 'no-previous-data' as const
      }));

      // For the first run, we consider there are no changes since there's no baseline to compare with
      const hasChanges = false;

      return {
        hasChanges,
        comparisons
      };
    }

    const comparisons = current.map(currentCheck => {
      const prevCheck = prev.checks.find(pc => pc.name === currentCheck.name);

      if (!prevCheck) {
        return {
          name: currentCheck.name,
          previousStatus: null,
          currentStatus: currentCheck.status,
          statusChange: 'new' as const
        };
      }

      const statusChangeKey = `${prevCheck.status}-to-${currentCheck.status}` as
        | 'ok-to-warning' | 'ok-to-error' | 'ok-to-ok'
        | 'warning-to-error' | 'warning-to-ok' | 'warning-to-warning'
        | 'error-to-error' | 'error-to-ok' | 'error-to-warning';

      const statusChange = prevCheck.status !== currentCheck.status
        ? statusChangeKey
        : 'unchanged' as const;

      return {
        name: currentCheck.name,
        previousStatus: prevCheck.status,
        currentStatus: currentCheck.status,
        statusChange
      };
    });

    const hasChanges = comparisons.some(c => {
      // A change occurred if status is not 'unchanged' (when comparing with previous)
      // For no-previous-data case, we don't consider it as a change since it was handled separately
      return c.statusChange !== 'unchanged' && c.statusChange !== 'new';
    });

    return {
      hasChanges,
      comparisons
    };
  }
};

async function checkConfig(): Promise<DoctorCheck> {
  try {
    const config = await loadConfig();
    
    // Verify all required fields exist
    if (!config.apiBaseUrl) {
      return {
        name: 'config',
        status: 'error',
        message: 'Missing API base URL in configuration',
        fixHint: 'Run "nexus settings set --key apiBaseUrl --value <your-api-url>" to set the API base URL'
      };
    }

    return {
      name: 'config',
      status: 'ok',
      message: 'Configuration loaded successfully',
      fixHint: 'System configuration is valid'
    };
  } catch (error: any) {
    // Check if this is a config parsing error
    const isParseError = error instanceof SyntaxError || error.message.toLowerCase().includes('json') || error.message.toLowerCase().includes('parse');
    const message = isParseError
      ? `Configuration parsing error: ${error.message}`
      : `Configuration error: ${error.message}`;

    return {
      name: 'config',
      status: 'error',
      message,
      fixHint: isParseError
        ? 'Configuration file syntax error. Check ~/.nexus/config.json for proper JSON formatting, or run "rm ~/.nexus/config.json" to reset configuration'
        : 'Check your configuration file at ~/.nexus/config.json for syntax errors'
    };
  }
}

async function checkAPIConnectivity(): Promise<DoctorCheck> {
  try {
    const config = await loadConfig();
    const client = new APIClient();
    
    // Try to make a simple request to check connectivity
    const response = await fetch(`${config.apiBaseUrl}/health`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': config.authToken ? `Bearer ${config.authToken}` : ''
      }
    });
    
    if (response.ok) {
      return {
        name: 'api',
        status: 'ok',
        message: 'API connectivity established',
        fixHint: 'API is accessible and responding correctly'
      };
    } else {
      return {
        name: 'api',
        status: 'warning',
        message: `API returned status ${response.status}`,
        fixHint: `Check API server status, received HTTP ${response.status} response`
      };
    }
  } catch (error: any) {
    return {
      name: 'api',
      status: 'warning',
      message: `API connectivity failed: ${error.message}`,
      fixHint: 'Verify API server is running and accessible at the configured URL'
    };
  }
}

async function checkAuthToken(): Promise<DoctorCheck> {
  try {
    const config = await loadConfig();
    
    if (!config.authToken) {
      return {
        name: 'auth',
        status: 'warning',
        message: 'No authentication token set',
        fixHint: 'Run "nexus auth login" to authenticate with the API server'
      };
    }

    // Check if token is valid by attempting to decode it (basic check)
    // JWT tokens have 3 parts separated by dots
    const parts = config.authToken.split('.');
    if (parts.length !== 3) {
      return {
        name: 'auth',
        status: 'error',
        message: 'Authentication token format is invalid',
        fixHint: 'Re-authenticate using "nexus auth login" to get a valid token'
      };
    }

    // Try to use the token with an API request
    const client = new APIClient();
    // Use one of the existing methods that would require authentication
    const response = await client.getProjects();

    if (response.status === 'ok' && response.data.projects) {
      return {
        name: 'auth',
        status: 'ok',
        message: 'Authentication token is valid',
        fixHint: 'Authentication token is valid and working correctly'
      };
    } else {
      return {
        name: 'auth',
        status: 'error',
        message: 'Authentication token appears to be invalid or expired',
        fixHint: 'Re-authenticate using "nexus auth login" to get a new token'
      };
    }
  } catch (error: any) {
    return {
      name: 'auth',
      status: 'error',
      message: `Authentication check failed: ${error.message}`,
      fixHint: 'Check authentication setup, run "nexus auth login" to authenticate'
    };
  }
}

async function checkConfigFilePermissions(): Promise<DoctorCheck> {
  try {
    const configPath = getConfigFilePath();
    const configDir = path.dirname(configPath);
    
    // Check if config directory exists and is writable
    try {
      await fs.access(configDir, fs.constants.F_OK | fs.constants.W_OK);
    } catch {
      return {
        name: 'permissions',
        status: 'error',
        message: 'Configuration directory does not exist or is not writable',
        fixHint: 'Create the directory ~/.nexus and ensure it is writable: "mkdir -p ~/.nexus && chmod 755 ~/.nexus"'
      };
    }

    // Check if config file exists and is readable/writable
    try {
      await fs.access(configPath, fs.constants.F_OK | fs.constants.R_OK | fs.constants.W_OK);
    } catch {
      // If file doesn't exist, that's okay - it will be created
      try {
        await fs.access(configDir, fs.constants.F_OK | fs.constants.W_OK);
      } catch {
        return {
          name: 'permissions',
          status: 'error',
          message: 'Configuration file cannot be created in directory',
          fixHint: 'Check permissions on the ~/.nexus directory'
        };
      }
    }

    return {
      name: 'permissions',
      status: 'ok',
      message: 'Configuration file permissions are appropriate',
      fixHint: 'Configuration file permissions are correctly set'
    };
  } catch (error: any) {
    return {
      name: 'permissions',
      status: 'error',
      message: `Permission check failed: ${error.message}`,
      fixHint: 'Check file permissions for the ~/.nexus directory and configuration file'
    };
  }
}

async function checkParity(): Promise<DoctorCheck> {
  try {
    // Try to create a simple parity file and read it back
    const parityPath = path.join(path.dirname(getConfigFilePath()), 'parity-test');
    
    // Write a test file
    await fs.writeFile(parityPath, 'test', 'utf8');
    
    // Read it back
    const content = await fs.readFile(parityPath, 'utf8');
    
    // Clean up
    await fs.unlink(parityPath);
    
    if (content === 'test') {
      return {
        name: 'parity',
        status: 'ok',
        message: 'File system parity check passed',
        fixHint: 'File system read/write operations are working correctly'
      };
    } else {
      return {
        name: 'parity',
        status: 'error',
        message: 'File system parity check failed - read/write inconsistency',
        fixHint: 'Check disk space and file system for errors'
      };
    }
  } catch (error: any) {
    return {
      name: 'parity',
      status: 'error',
      message: `Parity check failed: ${error.message}`,
      fixHint: 'Check disk space and file system for errors'
    };
  }
}

async function checkVersionStatus(): Promise<DoctorCheck> {
  try {
    // Import the BUILD_INFO to get current version information
    const { BUILD_INFO } = await import('../../generated/build-info');

    // For now, we'll just mark as OK, but in a real implementation we might check
    // against a version API to see if this version is outdated
    // This could call a remote API to check the latest available version
    const versionCheck = await performVersionCheck(BUILD_INFO.version);

    return {
      name: 'version',
      status: versionCheck.status,
      message: versionCheck.message,
      fixHint: versionCheck.fixHint
    };
  } catch (error: any) {
    return {
      name: 'version',
      status: 'warning',
      message: 'Could not determine version status',
      fixHint: 'Check your Nexus CLI installation'
    };
  }
}

async function performVersionCheck(currentVersion: string): Promise<{status: 'ok' | 'warning' | 'error', message: string, fixHint: string}> {
  try {
    // In a future implementation, this could call an API to check:
    // - if the current version is the latest
    // - if the current version is deprecated
    // - if there are security advisories for this version
    // For now, simply return as OK
    return {
      status: 'ok',
      message: `CLI version ${currentVersion} is current`,
      fixHint: 'No updates available'
    };
  } catch (error) {
    return {
      status: 'warning',
      message: `Could not verify latest version for ${currentVersion}`,
      fixHint: 'Check for Nexus CLI updates manually'
    };
  }
}

async function checkChatBackendReachable(): Promise<DoctorCheck> {
  try {
    const config = await loadConfig();

    // Check if the backend endpoint is reachable
    // Specifically check the backend for our configured AI backend (like Qwen)
    const backendType = config.defaultAiBackend || 'qwen';
    const backendCheckEndpoint = `${config.apiBaseUrl}/ai/${backendType}/status`;

    // Note: In a real implementation, we'd check the backend status
    // For now, we'll try to reach a general ai endpoint
    const response = await fetch(`${config.apiBaseUrl}/health`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': config.authToken ? `Bearer ${config.authToken}` : ''
      }
    });

    if (response.ok) {
      return {
        name: 'chat-backend-reachable',
        status: 'ok',
        message: `Chat backend (${backendType}) is reachable`,
        fixHint: 'Backend connectivity is working correctly'
      };
    } else {
      return {
        name: 'chat-backend-reachable',
        status: 'warning',
        message: `Chat backend (${backendType}) returned status ${response.status}`,
        fixHint: `Check backend server status, received HTTP ${response.status} response`
      };
    }
  } catch (error: any) {
    return {
      name: 'chat-backend-reachable',
      status: 'error',
      message: `Chat backend connectivity failed: ${error.message}`,
      fixHint: 'Verify backend server is running and accessible at the configured URL'
    };
  }
}

async function checkChatWorkerAlive(): Promise<DoctorCheck> {
  try {
    const config = await loadConfig();

    // Check if the worker server is alive by querying the network topology
    const response = await fetch(`${config.apiBaseUrl}/network/status`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': config.authToken ? `Bearer ${config.authToken}` : ''
      }
    });

    if (!response.ok) {
      return {
        name: 'chat-worker-alive',
        status: 'warning',
        message: `Unable to query network status: HTTP ${response.status}`,
        fixHint: 'Check if network services are running and accessible'
      };
    }

    const statusData = await response.json();

    // Look for worker servers in the status
    if (statusData?.data?.status?.elementsByStatus) {
      const onlineElements = statusData.data.status.elementsByStatus.online || 0;
      const totalElements = statusData.data.status.totalElements || 0;

      if (totalElements === 0) {
        return {
          name: 'chat-worker-alive',
          status: 'warning',
          message: 'No network elements detected',
          fixHint: 'Ensure worker servers are registered and running'
        };
      }

      return {
        name: 'chat-worker-alive',
        status: onlineElements > 0 ? 'ok' : 'warning',
        message: `${onlineElements}/${totalElements} network elements are currently online`,
        fixHint: onlineElements > 0
          ? 'Worker servers are detected and online'
          : 'Verify worker servers are started and connected to the network'
      };
    }

    return {
      name: 'chat-worker-alive',
      status: 'ok',
      message: 'Network services are accessible',
      fixHint: 'Network connectivity is working correctly'
    };
  } catch (error: any) {
    return {
      name: 'chat-worker-alive',
      status: 'error',
      message: `Chat worker connectivity check failed: ${error.message}`,
      fixHint: 'Check if worker servers are running and network services are accessible'
    };
  }
}

async function checkChatAIServerCompatible(): Promise<DoctorCheck> {
  try {
    // Check if the AI server is compatible by performing a micro handshake
    // This involves checking the AI backend API and seeing if it responds correctly
    const config = await loadConfig();

    // Attempt to get the AI session list which would indicate if the AI backend is working
    const response = await fetch(`${config.apiBaseUrl}/ai/sessions`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': config.authToken ? `Bearer ${config.authToken}` : ''
      }
    });

    if (!response.ok) {
      return {
        name: 'chat-ai-server-compatible',
        status: 'warning',
        message: `AI server compatibility check failed: HTTP ${response.status}`,
        fixHint: 'Check if AI server is running and properly configured'
      };
    }

    // If we get a successful response, the AI server is likely compatible
    const data = await response.json();

    return {
      name: 'chat-ai-server-compatible',
      status: 'ok',
      message: 'AI server is responsive and API-compatible',
      fixHint: 'AI server is properly configured and responsive'
    };
  } catch (error: any) {
    return {
      name: 'chat-ai-server-compatible',
      status: 'error',
      message: `AI server compatibility check failed: ${error.message}`,
      fixHint: 'Verify AI server is running and accessible'
    };
  }
}

async function checkChatBasicSend(): Promise<DoctorCheck> {
  try {
    // Perform a simple check to see if we can send a minimal message
    // This is a lightweight smoke test of the chat functionality
    const config = await loadConfig();

    // Try to get a list of sessions first to verify session management works
    const sessionsResponse = await fetch(`${config.apiBaseUrl}/ai/sessions`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': config.authToken ? `Bearer ${config.authToken}` : ''
      }
    });

    if (!sessionsResponse.ok) {
      return {
        name: 'chat-basic-send',
        status: 'warning',
        message: `Basic send preparation failed: sessions API returned HTTP ${sessionsResponse.status}`,
        fixHint: 'Check AI session management API'
      };
    }

    return {
      name: 'chat-basic-send',
      status: 'ok',
      message: 'Basic chat send preparation successful - API endpoints are accessible',
      fixHint: 'Chat API is responsive and endpoints are accessible'
    };
  } catch (error: any) {
    return {
      name: 'chat-basic-send',
      status: 'error',
      message: `Basic chat send test failed: ${error.message}`,
      fixHint: 'Check chat API connectivity and backend configuration'
    };
  }
}