#!/usr/bin/env node

import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';
import { startCommand } from './commands/start';
import { logCommand } from './commands/log';
import { writeFileCommand } from './commands/write-file';
import { runCommandCommand } from './commands/run-command';
import { describeStateCommand } from './commands/describe-state';
import { describeReplayCommand } from './commands/describe-replay';
import { inferPolicyCommand } from './commands/infer-policy';
import { reviewPolicyCommand } from './commands/review-policy';
import { detectDriftCommand } from './commands/detect-drift';
import { simulatePolicyCommand } from './commands/simulate-policy';
import { forecastPolicyCommand } from './commands/forecast-policy';
import { autopilotCycleCommand } from './commands/autopilot-cycle';
import { makeRunbookCommand } from './commands/make-runbook';

async function run() {
  const argv = await yargs(hideBin(process.argv))
    .scriptName('nexus-agent-tool')
    .usage('$0 <cmd> [args]')
    .option('artifact-dir', {
      describe: 'Directory to store artifacts for this command execution',
      type: 'string',
    })
    .command(startCommand)
    .command(logCommand)
    .command(writeFileCommand)
    .command(runCommandCommand)
    .command(describeStateCommand)
    .command(describeReplayCommand)
    .command(inferPolicyCommand)
    .command(reviewPolicyCommand)
    .command(detectDriftCommand)
    .command(simulatePolicyCommand)
    .command(forecastPolicyCommand)
    .command(autopilotCycleCommand)
    .command(makeRunbookCommand)
    .demandCommand(1, 'A command is required')
    .strict()
    .alias('h', 'help')
    .alias('v', 'version')
    .argv;
}

run().catch(err => {
  console.error(err);
  process.exit(1);
});