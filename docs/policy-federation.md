# Policy Federation Layer

## Overview

The Policy Federation Layer implements a **Federated Policy Consensus Engine** that operates across multiple projects to provide governance insights at the ecosystem level. It loads policy traces, inference results, review outputs, and drift metrics across multiple projects and synthesizes them into a unified governance framework.

## Architecture

The federated policy system consists of several key components:

### Core Components

1. **Federated Policy Engine** (`src/policy/federated.ts`)
   - Computes cross-project policy similarity matrices
   - Performs clustering analysis to detect convergence/divergence patterns
   - Calculates consensus policy vectors
   - Generates system health reports

2. **CLI Command** (`nexus-agent-tool federated-policy`)
   - Command-line interface for running federated analysis
   - Accepts project IDs and artifact roots as input
   - Outputs comprehensive JSON reports
   - Implements exit codes for different system states

3. **Replay Integration**
   - Extends the `describe-replay` command to include federated policy data
   - Reads federated analysis results from artifact directories
   - Provides ecosystem-level governance insights

## Mathematical Formulas

### Cosine Similarity
The similarity between two policy vectors A and B is calculated using cosine similarity:

```
similarity(A, B) = (A · B) / (||A|| × ||B||)
```

Where:
- `A · B` is the dot product of the vectors
- `||A||` and `||B||` are the magnitudes of the vectors

The result is normalized to the range [0, 1] where 0 represents completely dissimilar policies and 1 represents identical policies.

### Policy-to-Vector Conversion
Each policy is converted to a numerical vector by:
1. Taking a hash-based representation of the policy structure
2. Converting to a fixed-length numerical vector (128 dimensions)
3. Padding with zeros if necessary

### System Stability Score
The system stability score is calculated as:

```
stability = base_stability - (cluster_penalty * extra_clusters) - (outlier_penalty * outliers) * avg_similarity
```

Where:
- Base stability starts at 1.0
- Cluster penalty reduces stability for each extra policy cluster beyond the first
- Outlier penalty reduces stability for each outlier project
- Average similarity is factored in to weight the final score

## Clustering Logic

The system uses agglomerative hierarchical clustering to group projects with similar policies:

1. Each project starts as its own cluster
2. The algorithm repeatedly merges the two closest clusters based on average inter-cluster similarity
3. Merging stops when the similarity between clusters falls below the threshold
4. This creates distinct policy subcultures within the ecosystem

### Cluster Threshold
Projects or clusters are merged when their average similarity exceeds the cluster threshold (default 0.5). Higher thresholds result in more, smaller clusters. Lower thresholds produce fewer, larger clusters.

## Influence Graph Logic

The influence graph models how projects affect each other's policy choices:

1. **Direct Influence**: Calculated based on policy similarity
2. **Drift-Adjusted Influence**: Projects with lower drift scores are considered more stable and potentially more influential
3. **Weight Calculation**: Influence is weighted by the similarity between policies and the source project's stability

The influence weight from project A to project B is calculated as:
```
influence_weight(A → B) = similarity(A, B) * (1 - drift_score(A))
```

## Design Philosophy

### Meta-Governance Approach
The federated policy layer operates as a "meta-governance council" that synthesizes governance health across the entire ecosystem. Rather than replacing project-level policy systems, it provides an additional layer of insight for understanding cross-project governance patterns.

### Deterministic Processing
All computations are deterministic to ensure reproducible results. Given the same input policy snapshots, the system will produce identical outputs every time.

### Comprehensive Health Assessment
The system provides multiple dimensions of policy health:
- **Similarity Matrix**: Pairwise policy relationships
- **Cluster Detection**: Policy subcultures forming in the ecosystem
- **Outlier Detection**: Projects with highly deviant policies
- **Consensus Vector**: Weighted agreement across projects
- **Influence Graph**: How policies propagate through the ecosystem
- **Stability Score**: Overall ecosystem governance stability

## Example Outputs

### Federated Policy Health Report
```json
{
  "similarityMatrix": {
    "projectIds": ["projectA", "projectB", "projectC"],
    "values": [
      [1.0, 0.7, 0.2],
      [0.7, 1.0, 0.3],
      [0.2, 0.3, 1.0]
    ]
  },
  "clusters": [
    {
      "clusterId": "cluster_0",
      "members": ["projectA", "projectB"]
    }
  ],
  "outliers": ["projectC"],
  "consensus": {
    "baselineRules": [...],
    "similarityWeightedRules": [...],
    "driftWeightedRules": [...]
  },
  "influenceGraph": [
    {
      "from": "projectA",
      "to": "projectB",
      "weight": 0.68
    }
  ],
  "systemStabilityScore": 0.65,
  "narrativeSummary": "The system exhibits two distinct policy clusters with one outlier project. Overall stability is moderate."
}
```

### CLI Command Output
```
$ nexus-agent-tool federated-policy --projects projectA,projectB,projectC --artifact-roots /path/A,/path/B,/path/C --output federated.json

Federated policy analysis saved to: federated-2025-01-01T12-34-56-789Z.json

Federated Policy Analysis Summary:
- Projects analyzed: 3
- Clusters detected: 2
- Outliers detected: 1
- System stability score: 0.65
- Narrative summary: The system exhibits two distinct policy clusters with one outlier project. Overall stability is moderate.
```

## Governance Implications

### Convergence Monitoring
The system helps identify when projects are converging on similar policies, which generally indicates healthy ecosystem governance. However, excessive convergence (where all projects follow identical policies) may indicate reduced innovation.

### Divergence Detection
Early detection of policy divergence clusters allows governance teams to intervene before incompatible policy subcultures form. This is particularly important in multi-team projects where coordination is critical.

### Outlier Identification
Identifying outlier projects helps governance teams understand which projects may need additional support or different policy approaches. Outliers may represent:
- Innovation in policy approaches
- Projects facing unique challenges
- Governance issues requiring attention

### Stability Assessment
The system stability score provides a single key metric for assessing overall ecosystem governance health. This score can be used for:
- Governance dashboard metrics
- Automated alerts when stability falls below thresholds
- Long-term trend analysis of governance evolution

## Integration Points

### With Policy Tracing
The federated system can utilize trace information from individual projects to understand actual policy enforcement patterns.

### With Policy Inference
Policy recommendations from individual projects can be synthesized to identify broader ecosystem needs.

### With Policy Review
Review verdicts from multiple projects can be aggregated to identify governance patterns across the ecosystem.

### With Policy Drift Detection
Cross-project drift patterns can reveal systemic changes in governance needs or effectiveness.

## Command Line Usage

The `nexus-agent-tool federated-policy` command provides access to the federated analysis capabilities:

```
nexus-agent-tool federated-policy \
  --projects projectA,projectB,projectC \
  --artifact-roots /path/X,/path/Y,/path/Z \
  --output federated.json \
  --cluster-threshold 0.5 \
  --outlier-threshold 0.3
```

### Exit Codes
- `0`: System stable
- `1`: Divergent clusters found
- `2`: System unstable or fractured