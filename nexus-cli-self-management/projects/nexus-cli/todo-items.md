# Nexus CLI Self-Management: TODO Items

## Based on AI Agent Usage Experience

### TODO Item 1: Fix Module Resolution System
- **Description**: The CLI has ES module resolution issues that prevent execution due to directory import problems
- **Classification**: schema issue
- **Details**: The error "Directory import '/home/sblo/Dev/AgentManager/dist/parser' is not supported resolving ES modules" prevents basic CLI functionality
- **Impact**: Completely blocks CLI usage
- **Status**: High priority

### TODO Item 2: Enhance Process Correlation with Semantic Context
- **Description**: Debug and network outputs need clearer project context metadata to help AI agents correlate processes with development activities
- **Classification**: DX (Developer Experience)
- **Details**: Current debug outputs don't clearly link processes to project, roadmap, or chat contexts
- **Impact**: Makes it difficult for AI agents to understand which processes belong to which projects
- **Status**: Medium priority

### TODO Item 3: Improve Error Message Contextualization
- **Description**: Error messages need more contextual information to help AI agents understand and resolve issues
- **Classification**: error handling
- **Details**: Errors like module resolution failures should suggest specific remediation steps
- **Impact**: Reduces AI agent efficiency when troubleshooting
- **Status**: Medium priority