import { PolicyEvaluationInput, PolicyEvaluationResult, PolicyTrace } from './trace';
export { v4 as uuidv4 } from 'uuid';
export { PolicyEvaluationInput, PolicyEvaluationResult, PolicyTrace } from './trace';
export declare function createPolicyTrace(input: PolicyEvaluationInput, matchingRules: any[], finalDecision: 'ALLOW' | 'DENY' | 'REVIEW', finalRule?: any): PolicyTrace;
export declare function evaluateRunCommand(input: PolicyEvaluationInput): PolicyEvaluationResult;
export declare function evaluateWriteFile(input: PolicyEvaluationInput): PolicyEvaluationResult;
export declare function evaluateStartSession(input: PolicyEvaluationInput): PolicyEvaluationResult;
export declare function evaluatePolicy(input: PolicyEvaluationInput): PolicyEvaluationResult;
export { evaluatePolicy, evaluateRunCommand, evaluateWriteFile, evaluateStartSession, createPolicyTrace };
//# sourceMappingURL=engine.d.ts.map