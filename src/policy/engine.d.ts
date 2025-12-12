import { PolicyEvaluationInput, PolicyEvaluationResult, PolicyTrace } from './trace';
export declare function createPolicyTrace(input: PolicyEvaluationInput, matchingRules: any[], finalDecision: 'ALLOW' | 'DENY' | 'REVIEW', finalRule?: any): PolicyTrace;
export declare function evaluateRunCommand(input: PolicyEvaluationInput): PolicyEvaluationResult;
export declare function evaluateWriteFile(input: PolicyEvaluationInput): PolicyEvaluationResult;
export declare function evaluateStartSession(input: PolicyEvaluationInput): PolicyEvaluationResult;
export declare function evaluatePolicy(input: PolicyEvaluationInput): PolicyEvaluationResult;
//# sourceMappingURL=engine.d.ts.map