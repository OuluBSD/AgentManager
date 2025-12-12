import { Command } from "commander";
import fs from "node:fs/promises";
import path from "node:path";
import { FederatedPolicyEngine, ProjectPolicySnapshot } from "../../../src/policy/federated";

// Command to perform federated policy analysis across multiple projects
export const federatedPolicyCommand = new Command("federated-policy")
  .description("Perform federated policy analysis across multiple projects")
  .option("-p, --projects <projectIds...>", "Project IDs to analyze (comma-separated)")
  .option("-r, --artifact-roots <paths...>", "Artifact root paths to load policy snapshots from (comma-separated)")
  .option("-o, --output <outputFile>", "Output file for the federated analysis (default: federated.json)")
  .option("--cluster-threshold <threshold>", "Similarity threshold for clustering (default: 0.5)", parseFloat)
  .option("--outlier-threshold <threshold>", "Similarity threshold for outlier detection (default: 0.3)", parseFloat)
  .action(async (options) => {
    try {
      // Validate required options
      if (!options.projects && !options.artifactRoots) {
        console.error("Error: Either --projects or --artifact-roots must be provided");
        process.exit(1);
      }

      // If projects are provided, we'll need to load snapshots from artifact roots
      // For now, we'll assume artifact roots are always provided for the purpose of this implementation
      if (!options.artifactRoots || options.artifactRoots.length === 0) {
        console.error("Error: --artifact-roots must be provided with paths to policy snapshots");
        process.exit(1);
      }

      // Parse project IDs
      let projectIds: string[] = [];
      if (options.projects) {
        if (typeof options.projects === 'string') {
          projectIds = options.projects.split(',');
        } else if (Array.isArray(options.projects)) {
          projectIds = options.projects;
        }
      }

      // Parse artifact roots
      const artifactRoots = options.artifactRoots;

      // Load policy snapshots from the specified artifact roots
      const snapshots: ProjectPolicySnapshot[] = [];
      
      for (let i = 0; i < artifactRoots.length; i++) {
        const rootPath = artifactRoots[i];
        const projectId = projectIds[i] || `project_${i}`;
        
        // Look for policy snapshot files in the artifact root
        const snapshotPath = path.join(rootPath, 'policy-snapshot.json');
        try {
          const snapshotData = await fs.readFile(snapshotPath, 'utf8');
          const snapshot: ProjectPolicySnapshot = {
            ...JSON.parse(snapshotData),
            projectId
          };
          snapshots.push(snapshot);
        } catch (error) {
          console.warn(`Warning: Could not load policy snapshot from ${snapshotPath}:`, error.message);
        }
      }

      // Ensure we have at least one snapshot to analyze
      if (snapshots.length < 1) {
        console.error("Error: No policy snapshots could be loaded from the provided artifact roots");
        process.exit(1);
      }

      // Initialize the federated policy engine
      const engine = new FederatedPolicyEngine();

      // Compute federated policy health
      const health = await engine.computeFederatedHealth(
        snapshots,
        options.clusterThreshold || 0.5,
        options.outlierThreshold || 0.3
      );

      // Determine output file
      const outputFile = options.output || 'federated.json';
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const outputFilePath = path.join(path.dirname(outputFile), `federated-${timestamp}.json`);

      // Create output directory if it doesn't exist
      await fs.mkdir(path.dirname(outputFilePath), { recursive: true });

      // Write results to file
      await fs.writeFile(outputFilePath, JSON.stringify(health, null, 2));
      console.log(`Federated policy analysis saved to: ${outputFilePath}`);

      // Print summary
      console.log('\nFederated Policy Analysis Summary:');
      console.log(`- Projects analyzed: ${health.similarityMatrix.projectIds.length}`);
      console.log(`- Clusters detected: ${health.clusters.length}`);
      console.log(`- Outliers detected: ${health.outliers.length}`);
      console.log(`- System stability score: ${health.systemStabilityScore.toFixed(2)}`);
      console.log(`- Narrative summary: ${health.narrativeSummary}`);

      // Set appropriate exit code based on findings
      // 0 = stable, 1 = divergent clusters found, 2 = system unstable
      let exitCode = 0;
      if (health.clusters.length > 1) {
        exitCode = 1;  // Divergent clusters found
      } else if (health.systemStabilityScore < 0.5) {
        exitCode = 2;  // System unstable
      }

      process.exit(exitCode);
    } catch (error: any) {
      console.error(`Error in federated policy analysis: ${error.message}`);
      process.exit(1);
    }
  });