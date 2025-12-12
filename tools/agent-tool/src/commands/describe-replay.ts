import { okResult, errorResult, outputResult } from '../utils/output';
import { PolicyDriftSummary, PolicyReviewSummary, ReplaySummary, ReplayStep } from '../types';
import { PolicyInferenceEngine, PolicyInferenceResult } from '../policy/inference';
import { PolicyTrace } from '../policy/trace';
import { PolicyDriftEngine } from '../policy/drift';
import fs from 'fs-extra';
import path from 'path';

interface BuildAttempt {
  attempt: number;
  exitCode: number | null;
}

interface PolicyTraceSummary {
  actionId: string;
  actionType: string;
  finalDecision: "allow" | "deny" | "review";
  finalRuleId?: string;
  summaryForHuman: string;
}

interface PolicyInferenceSummary {
  recommendationsCount: number;
  insightsCount: number;
  highConfidenceCount: number;
  summary: string[];
}

export const describeReplayCommand = {
  command: 'describe-replay',
  describe: 'Describe the replay summary of an artifact run directory',
  builder: (yargs: any) => {
    return yargs
      .option('artifact-run', {
        describe: 'Path to the artifact run directory',
        demandOption: true,
        type: 'string',
      });
  },
  handler: (argv: any) => {
    const { 'artifact-run': artifactRunPath } = argv;

    try {
      if (!fs.existsSync(artifactRunPath)) {
        outputResult(
          errorResult(
            'ARTIFACT_RUN_NOT_FOUND',
            `Artifact run directory not found: ${artifactRunPath}`
          )
        );
        return;
      }

      const result = analyzeArtifacts(artifactRunPath);
      outputResult(
        okResult(result)
      );
    } catch (error: any) {
      outputResult(
        errorResult(
          'DESCRIBE_REPLAY_ERROR',
          error.message || 'An error occurred while describing the replay',
          { error: error.stack }
        )
      );
    }
  },
};

function analyzeArtifacts(artifactRunPath: string): ReplaySummary {
  const result: ReplaySummary = {
    artifactRunPath,
    meta: {
      sessionId: '',
      events: 0
    },
    steps: []
  };

  // Analyze meta directory
  const metaDir = path.join(artifactRunPath, 'meta');
  if (fs.existsSync(metaDir)) {
    const metaEventsPath = path.join(metaDir, 'events.log');
    let metaEvents = 0;
    if (fs.existsSync(metaEventsPath)) {
      const eventsContent = fs.readFileSync(metaEventsPath, 'utf8');
      metaEvents = eventsContent.trim().split('\n').filter(line => line.trim() !== '').length;
    }

    // Try to extract session ID from session-state.json if available
    const metaSessionStatePath = path.join(metaDir, 'session-state.json');
    let metaSessionId = '';
    if (fs.existsSync(metaSessionStatePath)) {
      const sessionState = fs.readJsonSync(metaSessionStatePath);
      metaSessionId = sessionState.sessionId || '';
    }

    result.meta = {
      sessionId: metaSessionId,
      events: metaEvents
    };
  }

  // Analyze steps directories
  const stepsDir = path.join(artifactRunPath, 'steps');
  if (fs.existsSync(stepsDir)) {
    const stepDirs = fs.readdirSync(stepsDir)
      .filter(item => fs.statSync(path.join(stepsDir, item)).isDirectory())
      .sort(); // Sort to ensure consistent ordering

    for (const stepDir of stepDirs) {
      const match = stepDir.match(/^step-(\d+)$/);
      if (match && match[1]) {
        const stepIndex = parseInt(match[1], 10);
        const stepPath = path.join(stepsDir, stepDir);

        // Get files written
        const filesDir = path.join(stepPath, 'files');
        let filesWritten: string[] = [];
        if (fs.existsSync(filesDir)) {
          filesWritten = collectFiles(filesDir, filesDir);
        }

        // Get events and commands
        const eventsPath = path.join(stepPath, 'events.log');
        let commands: Array<{ cmd: string, exitCode: number | null }> = [];
        if (fs.existsSync(eventsPath)) {
          const eventsContent = fs.readFileSync(eventsPath, 'utf8');
          const eventLines = eventsContent.trim().split('\n').filter(line => line.trim() !== '');
          commands = eventLines
            .map(line => {
              try {
                const event = JSON.parse(line);
                if (event.type === 'command') {
                  return { cmd: event.cmd, exitCode: event.exitCode };
                }
                return null;
              } catch {
                return null;
              }
            })
            .filter(event => event !== null) as Array<{ cmd: string, exitCode: number | null }>;
        }

        // Get policy traces
        const policyTraces = getPolicyTraces(stepPath);

        // Get build attempts
        const buildAttempts = getBuildAttempts(artifactRunPath, stepIndex);

        // Extract session ID from session-state.json if available
        const stepSessionStatePath = path.join(stepPath, 'session-state.json');
        let stepSessionId = '';
        if (fs.existsSync(stepSessionStatePath)) {
          const sessionState = fs.readJsonSync(stepSessionStatePath);
          stepSessionId = sessionState.sessionId || '';
        }

        result.steps.push({
          index: stepIndex,
          sessionId: stepSessionId,
          filesWritten,
          commands,
          buildAttempts,
          policyTraces // Include policy traces in the step
        });
      }
    }
  }

  // Perform policy inference if policy traces exist
  const allPolicyTraces = result.steps.flatMap(step => step.policyTraces || []);
  if (allPolicyTraces.length > 0) {
    try {
      // For the describe-replay integration, we'll add a summary instead of running full inference
      // since full inference would require access to the full PolicyTrace objects
      const inferenceSummary = generatePolicyInferenceSummary(allPolicyTraces);
      (result as any).policyInference = inferenceSummary;
    } catch (error) {
      console.warn('Could not generate policy inference summary:', error);
    }
  }

  // Look for policy review results in the artifact directory
  try {
    const reviewDir = path.join(artifactRunPath, 'policy-review');
    if (fs.existsSync(reviewDir)) {
      const reviewFiles = fs.readdirSync(reviewDir).filter(file =>
        file.startsWith('review-') && file.endsWith('.json')
      );

      if (reviewFiles.length > 0) {
        // Take the most recent review file
        const sortedFiles = reviewFiles.sort((a, b) => {
          // Extract timestamp from filename and sort
          const timestampA = a.replace('review-', '').replace('.json', '');
          const timestampB = b.replace('review-', '').replace('.json', '');
          return timestampB.localeCompare(timestampA); // Descending order
        });

        const latestReviewFile = sortedFiles[0];
        if (!latestReviewFile) {
          console.warn('No review file found after sorting');
        } else {
          const reviewPath = path.join(reviewDir, latestReviewFile);

          try {
            const reviewData = fs.readJsonSync(reviewPath);
            (result as any).policyReview = reviewData;
          } catch (error) {
            console.warn('Could not read policy review data:', error);
          }
        }
      }
    }
  } catch (error) {
    console.warn('Could not fetch policy review data:', error);
  }

  // Look for policy drift analysis in the artifact directory
  try {
    const driftDir = path.join(artifactRunPath, 'policy-drift');
    if (fs.existsSync(driftDir)) {
      const driftFiles = fs.readdirSync(driftDir).filter(file =>
        file.startsWith('drift-') && file.endsWith('.json')
      );

      if (driftFiles.length > 0) {
        // Take the most recent drift file
        const sortedFiles = driftFiles.sort((a, b) => {
          // Extract timestamp from filename and sort
          const timestampA = a.replace('drift-', '').replace('.json', '');
          const timestampB = b.replace('drift-', '').replace('.json', '');
          return timestampB.localeCompare(timestampA); // Descending order
        });

        const latestDriftFile = sortedFiles[0];
        if (!latestDriftFile) {
          console.warn('No drift file found after sorting');
        } else {
          const driftPath = path.join(driftDir, latestDriftFile);

          try {
            const driftData = fs.readJsonSync(driftPath);
            (result as any).policyDrift = {
              overallDriftScore: driftData.analysis?.overallDriftScore || 0,
              stabilityIndex: driftData.analysis?.stabilityIndex || 1,
              classification: driftData.analysis?.classification || 'stable',
              signals: driftData.analysis?.signals || []
            };
          } catch (error) {
            console.warn('Could not read policy drift data:', error);
          }
        }
      }
    }
  } catch (error) {
    console.warn('Could not fetch policy drift data:', error);
  }

  // Look for federated policy analysis in the artifact directory
  try {
    const federatedDir = path.join(artifactRunPath, 'federated-policy');
    if (fs.existsSync(federatedDir)) {
      const federatedFiles = fs.readdirSync(federatedDir).filter(file =>
        file.startsWith('federated-') && file.endsWith('.json')
      );

      if (federatedFiles.length > 0) {
        // Take the most recent federated policy file
        const sortedFiles = federatedFiles.sort((a, b) => {
          // Extract timestamp from filename and sort
          const timestampA = a.replace('federated-', '').replace('.json', '');
          const timestampB = b.replace('federated-', '').replace('.json', '');
          return timestampB.localeCompare(timestampA); // Descending order
        });

        const latestFederatedFile = sortedFiles[0];
        if (!latestFederatedFile) {
          console.warn('No federated file found after sorting');
        } else {
          const federatedPath = path.join(federatedDir, latestFederatedFile);

          try {
            const federatedData = fs.readJsonSync(federatedPath);
            (result as any).federatedPolicy = {
              clusters: federatedData.clusters || [],
              outliers: federatedData.outliers || [],
              systemStabilityScore: federatedData.systemStabilityScore || 0
            };
          } catch (error) {
            console.warn('Could not read federated policy data:', error);
          }
        }
      }
    }
  } catch (error) {
    console.warn('Could not fetch federated policy data:', error);
  }

  // Look for counterfactual policy simulation results in the artifact directory
  try {
    const cfDir = path.join(artifactRunPath, 'policy-counterfactual');
    if (fs.existsSync(cfDir)) {
      const cfFiles = fs.readdirSync(cfDir).filter(file =>
        file.startsWith('cf-') && file.endsWith('.json')
      );

      if (cfFiles.length > 0) {
        // Take the most recent counterfactual file
        const sortedFiles = cfFiles.sort((a, b) => {
          // Extract timestamp from filename and sort
          const timestampA = a.replace('cf-', '').replace('.json', '');
          const timestampB = b.replace('cf-', '').replace('.json', '');
          return timestampB.localeCompare(timestampA); // Descending order
        });

        const latestCfFile = sortedFiles[0];
        if (!latestCfFile) {
          console.warn('No counterfactual file found after sorting');
        } else {
          const cfPath = path.join(cfDir, latestCfFile);

          try {
            const cfData = fs.readJsonSync(cfPath);
            (result as any).counterfactual = {
              contradictions: cfData.summary?.contradictions || 0,
              stronger: cfData.summary?.strongerCount || 0,
              weaker: cfData.summary?.weakerCount || 0,
              narrativeSummary: cfData.narrativeSummary || ""
            };
          } catch (error) {
            console.warn('Could not read counterfactual data:', error);
          }
        }
      }
    }
  } catch (error) {
    console.warn('Could not fetch counterfactual data:', error);
  }

  // Look for policy futures forecast results in the artifact directory
  try {
    const futuresDir = path.join(artifactRunPath, 'policy-futures');
    if (fs.existsSync(futuresDir)) {
      const futuresFiles = fs.readdirSync(futuresDir).filter(file =>
        file.startsWith('future-') && file.endsWith('.json')
      );

      if (futuresFiles.length > 0) {
        // Take the most recent futures file
        const sortedFiles = futuresFiles.sort((a, b) => {
          // Extract timestamp from filename and sort
          const timestampA = a.replace('future-', '').replace('.json', '');
          const timestampB = b.replace('future-', '').replace('.json', '');
          return timestampB.localeCompare(timestampA); // Descending order
        });

        const latestFuturesFile = sortedFiles[0];
        if (!latestFuturesFile) {
          console.warn('No futures file found after sorting');
        } else {
          const futuresPath = path.join(futuresDir, latestFuturesFile);

          try {
            const futuresData = fs.readJsonSync(futuresPath);
            (result as any).futures = {
              volatilityIndex: futuresData.aggregate?.volatilityIndex || 0,
              riskLevel: futuresData.aggregate?.riskLevel || 'stable',
              mostProbableNarrative: futuresData.aggregate?.mostProbableNarrative || "",
              worstCaseNarrative: futuresData.aggregate?.worstCaseNarrative || "",
              bestCaseNarrative: futuresData.aggregate?.bestCaseNarrative || ""
            };
          } catch (error) {
            console.warn('Could not read futures data:', error);
          }
        }
      }
    }
  } catch (error) {
    console.warn('Could not fetch futures data:', error);
  }

  // Look for autopilot cycle results in the artifact directory
  try {
    const autopilotDir = path.join(artifactRunPath, 'policy-autopilot');
    if (fs.existsSync(autopilotDir)) {
      const autopilotFiles = fs.readdirSync(autopilotDir).filter(file =>
        file.startsWith('cycle-') && file.endsWith('.json')
      );

      if (autopilotFiles.length > 0) {
        // Take the most recent autopilot file
        const sortedFiles = autopilotFiles.sort((a, b) => {
          // Extract timestamp from filename and sort
          const timestampA = a.replace('cycle-', '').replace('.json', '');
          const timestampB = b.replace('cycle-', '').replace('.json', '');
          return timestampB.localeCompare(timestampA); // Descending order
        });

        const latestAutopilotFile = sortedFiles[0];
        if (!latestAutopilotFile) {
          console.warn('No autopilot file found after sorting');
        } else {
          const autopilotPath = path.join(autopilotDir, latestAutopilotFile);

          try {
            const autopilotData = fs.readJsonSync(autopilotPath);
            (result as any).autopilot = {
              globalRisk: autopilotData.result?.risk?.globalRisk || 'stable',
              recommendedActions: autopilotData.result?.recommendedActions || [],
              narrative: autopilotData.result?.narrative || ""
            };
          } catch (error) {
            console.warn('Could not read autopilot data:', error);
          }
        }
      }
    }
  } catch (error) {
    console.warn('Could not fetch autopilot data:', error);
  }

  // Look for policy runbook results in the artifact directory
  try {
    const runbookDir = path.join(artifactRunPath, 'policy-runbook');
    if (fs.existsSync(runbookDir)) {
      const runbookFiles = fs.readdirSync(runbookDir).filter(file =>
        file.startsWith('runbook-') && file.endsWith('.json')
      );

      if (runbookFiles.length > 0) {
        // Take the most recent runbook file
        const sortedFiles = runbookFiles.sort((a, b) => {
          // Extract timestamp from filename and sort
          const timestampA = a.replace('runbook-', '').replace('.json', '');
          const timestampB = b.replace('runbook-', '').replace('.json', '');
          return timestampB.localeCompare(timestampA); // Descending order
        });

        const latestRunbookFile = sortedFiles[0];
        if (!latestRunbookFile) {
          console.warn('No runbook file found after sorting');
        } else {
          const runbookPath = path.join(runbookDir, latestRunbookFile);

          try {
            const runbookData = fs.readJsonSync(runbookPath);
            (result as any).runbook = {
              severity: runbookData.result?.severity || runbookData.severity || 'low',
              steps: runbookData.result?.steps || runbookData.steps || [],
              narrative: runbookData.result?.narrative || runbookData.narrative || ""
            };
          } catch (error) {
            console.warn('Could not read runbook data:', error);
          }
        }
      }
    }
  } catch (error) {
    console.warn('Could not fetch runbook data:', error);
  }

  return result;
}

function collectFiles(filesDir: string, currentDir: string): string[] {
  let files: string[] = [];

  const items = fs.readdirSync(currentDir);

  for (const item of items) {
    const fullPath = path.join(currentDir, item);
    const relativePath = path.relative(filesDir, fullPath);

    if (fs.statSync(fullPath).isDirectory()) {
      // Recursively collect files in subdirectories
      files = files.concat(collectFiles(filesDir, fullPath));
    } else {
      files.push(relativePath);
    }
  }

  return files;
}

function getPolicyTraces(stepPath: string): PolicyTraceSummary[] {
  const policyTraceDir = path.join(stepPath, 'policy-trace');
  if (!fs.existsSync(policyTraceDir)) {
    return [];
  }

  const traceFiles = fs.readdirSync(policyTraceDir).filter(file => file.startsWith('trace-') && file.endsWith('.json'));
  const policyTraces: PolicyTraceSummary[] = [];

  for (const traceFile of traceFiles) {
    const tracePath = path.join(policyTraceDir, traceFile);
    try {
      const traceData = fs.readJsonSync(tracePath);
      policyTraces.push({
        actionId: traceData.actionId,
        actionType: traceData.actionType,
        finalDecision: traceData.finalDecision,
        finalRuleId: traceData.finalRuleId,
        summaryForHuman: traceData.summaryForHuman
      });
    } catch (error) {
      // Skip files that can't be parsed
      continue;
    }
  }

  return policyTraces;
}

function generatePolicyInferenceSummary(policyTraces: PolicyTraceSummary[]): PolicyInferenceSummary {
  // Count decisions
  const decisionCounts = {
    allow: policyTraces.filter(trace => trace.finalDecision === 'allow').length,
    deny: policyTraces.filter(trace => trace.finalDecision === 'deny').length,
    review: policyTraces.filter(trace => trace.finalDecision === 'review').length
  };

  // Generate summary insights
  const summary: string[] = [];
  if (decisionCounts.deny > decisionCounts.allow) {
    summary.push("Higher denial rate detected - policy may be overly restrictive");
  }

  // Look for patterns in rule ids that indicate frequent denials
  const denyRuleCounts = new Map<string, number>();
  policyTraces.forEach(trace => {
    if (trace.finalDecision === 'deny' && trace.finalRuleId) {
      denyRuleCounts.set(trace.finalRuleId, (denyRuleCounts.get(trace.finalRuleId) || 0) + 1);
    }
  });

  // Identify any rules that caused frequent denials
  for (const [ruleId, count] of denyRuleCounts) {
    if (count >= 3) {
      summary.push(`${count} denials matched pattern from rule '${ruleId}' - consider adding exception rule`);
    }
  }

  // Look for patterns in override usage
  const overridePatternMatches = policyTraces.filter(trace =>
    trace.summaryForHuman.includes('override') || trace.finalRuleId?.includes('override')
  );

  if (overridePatternMatches.length >= 2) {
    summary.push(`${overridePatternMatches.length} overrides detected - consider adjusting policies`);
  }

  return {
    recommendationsCount: summary.length, // For this simplified version, we count insights as recommendations
    insightsCount: summary.length,
    highConfidenceCount: 0, // Placeholder - in a full implementation, we'd calculate confidence
    summary
  };
}

function getBuildAttempts(artifactRunPath: string, stepIndex: number): BuildAttempt[] {
  const buildDir = path.join(artifactRunPath, 'build');
  if (!fs.existsSync(buildDir)) {
    return [];
  }

  const stepBuildAttemptPattern = new RegExp(`^step-${stepIndex}-attempt-(\\d+)$`);
  const buildAttempts: BuildAttempt[] = [];

  const items = fs.readdirSync(buildDir);
  for (const item of items) {
    const match = item.match(stepBuildAttemptPattern);
    if (match && match[1]) {
      const attemptIndex = parseInt(match[1], 10);
      const attemptDir = path.join(buildDir, item);

      let exitCode: number | null = null;
      const exitCodePath = path.join(attemptDir, 'exitcode');
      if (fs.existsSync(exitCodePath)) {
        try {
          exitCode = parseInt(fs.readFileSync(exitCodePath, 'utf8').trim(), 10);
        } catch {
          exitCode = null;
        }
      }

      buildAttempts.push({
        attempt: attemptIndex,
        exitCode
      });
    }
  }

  // Sort by attempt number
  buildAttempts.sort((a, b) => a.attempt - b.attempt);

  return buildAttempts;
}