// Core types for the agentic system

export type AgentStatus = 'idle' | 'thinking' | 'executing' | 'waiting' | 'error' | 'completed';
export type TaskPriority = 'low' | 'normal' | 'high' | 'critical';
export type MessageType = 'request' | 'response' | 'event' | 'error' | 'notification';

export interface AgentCapability {
  name: string;
  description: string;
  requiredTools: string[];
  inputSchema?: any;
  outputSchema?: any;
}

export interface Tool {
  name: string;
  description: string;
  execute: (params: any) => Promise<any>;
  validate?: (params: any) => boolean;
  cost?: number; // Optional cost metric for tool usage
}

export interface Task {
  id: string;
  type: string;
  description: string;
  priority: TaskPriority;
  payload: any;
  constraints?: TaskConstraints;
  dependencies?: string[];
  createdAt: Date;
  deadline?: Date;
  retryCount?: number;
  maxRetries?: number;
}

export interface TaskConstraints {
  timeout?: number;
  maxCost?: number;
  requiredAccuracy?: number;
  allowedTools?: string[];
  forbiddenTools?: string[];
}

export interface TaskResult {
  taskId: string;
  status: 'success' | 'failure' | 'partial';
  data?: any;
  error?: Error;
  executionTime: number;
  toolsUsed: string[];
  cost?: number;
  confidence?: number;
  suggestions?: string[];
}

export interface AgentMessage {
  id: string;
  from: string;
  to: string | string[];
  type: MessageType;
  priority: TaskPriority;
  payload: {
    action: string;
    data: any;
    context: ExecutionContext;
    constraints?: TaskConstraints;
  };
  timestamp: Date;
  ttl?: number;
  replyTo?: string;
}

export interface ExecutionContext {
  userId: string;
  organizationId: string;
  sessionId: string;
  parentTaskId?: string;
  permissions: Permission[];
  metadata: Record<string, any>;
  traceId: string;
  environment?: 'development' | 'staging' | 'production';
}

export interface Permission {
  resource: string;
  actions: string[];
  conditions?: Record<string, any>;
}

export interface AgentMemory {
  shortTerm: Map<string, any>;
  longTerm: {
    get: (key: string) => Promise<any>;
    set: (key: string, value: any, ttl?: number) => Promise<void>;
    search: (query: string, limit?: number) => Promise<any[]>;
  };
  episodic: {
    store: (event: AgentEvent) => Promise<void>;
    recall: (filter: EventFilter) => Promise<AgentEvent[]>;
  };
  semantic: {
    addRelation: (subject: string, predicate: string, object: string) => Promise<void>;
    query: (pattern: QueryPattern) => Promise<any[]>;
  };
}

export interface AgentEvent {
  id: string;
  agentId: string;
  type: string;
  timestamp: Date;
  data: any;
  outcome?: 'success' | 'failure';
  learnings?: string[];
}

export interface EventFilter {
  agentId?: string;
  type?: string;
  startDate?: Date;
  endDate?: Date;
  outcome?: 'success' | 'failure';
}

export interface QueryPattern {
  subject?: string;
  predicate?: string;
  object?: string;
}

export interface WorkflowStep {
  id: string;
  agentId: string;
  action: string;
  input?: any;
  params?: Record<string, any>;
  conditions?: WorkflowCondition[];
  onSuccess?: string; // Next step ID
  onFailure?: string; // Fallback step ID
  parallel?: boolean;
  timeout?: number;
}

export interface WorkflowCondition {
  field: string;
  operator: 'equals' | 'contains' | 'greater' | 'less' | 'exists';
  value: any;
}

export interface Workflow {
  id: string;
  name: string;
  description: string;
  triggers: WorkflowTrigger[];
  steps: WorkflowStep[];
  errorHandling: ErrorHandlingStrategy;
  metadata: Record<string, any>;
}

export interface WorkflowTrigger {
  type: 'manual' | 'schedule' | 'event' | 'condition';
  config: any;
}

export interface ErrorHandlingStrategy {
  retryPolicy: {
    maxAttempts: number;
    backoff: 'linear' | 'exponential';
    initialDelay: number;
  };
  fallback?: {
    agentId: string;
    action: string;
  };
  alerting?: {
    channels: string[];
    severity: 'low' | 'medium' | 'high' | 'critical';
  };
}

export interface AgentMetrics {
  performance: {
    tasksCompleted: number;
    averageExecutionTime: number;
    successRate: number;
    errorRate: number;
    lastExecutionTime?: Date;
  };
  resource: {
    apiCallsCount: number;
    tokenUsage: number;
    computeTime: number;
    storageUsed: number;
  };
  business: {
    [key: string]: number; // Flexible business metrics
  };
}

export interface LearningFeedback {
  taskId: string;
  agentId: string;
  rating: number; // 1-5
  feedback?: string;
  corrections?: any;
  timestamp: Date;
}

export interface AgentConfig {
  id: string;
  name: string;
  description: string;
  version: string;
  capabilities: AgentCapability[];
  tools: string[];
  memory?: {
    shortTermSize?: number;
    longTermTTL?: number;
    learningEnabled?: boolean;
  };
  monitoring?: {
    metricsEnabled?: boolean;
    loggingLevel?: 'debug' | 'info' | 'warn' | 'error';
    alertThresholds?: Record<string, number>;
  };
}