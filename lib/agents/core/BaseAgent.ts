import { EventEmitter } from 'events';
import {
  AgentCapability,
  Tool,
  Task,
  TaskResult,
  AgentStatus,
  AgentMemory,
  AgentEvent,
  ExecutionContext,
  AgentMetrics,
  LearningFeedback,
  AgentConfig,
  AgentMessage,
  MessageType,
  TaskPriority
} from './types';

export abstract class BaseAgent extends EventEmitter {
  protected status: AgentStatus = 'idle';
  protected memory: AgentMemory;
  protected tools: Map<string, Tool> = new Map();
  protected metrics: AgentMetrics;
  protected config: AgentConfig;
  protected currentTask: Task | null = null;
  protected taskQueue: Task[] = [];
  protected executionHistory: TaskResult[] = [];

  constructor(config: AgentConfig, memory: AgentMemory) {
    super();
    this.config = config;
    this.memory = memory;
    this.metrics = this.initializeMetrics();
    this.initialize();
  }

  // Abstract methods that must be implemented by specific agents
  abstract get name(): string;
  abstract get capabilities(): AgentCapability[];
  abstract execute(task: Task, context: ExecutionContext): Promise<TaskResult>;
  abstract validate(input: any): Promise<boolean>;

  // Core agent lifecycle methods
  protected abstract initialize(): void;
  protected abstract shutdown(): Promise<void>;

  // Tool management
  registerTool(tool: Tool): void {
    this.tools.set(tool.name, tool);
    this.log('info', `Tool registered: ${tool.name}`);
  }

  protected async callTool(toolName: string, params: any): Promise<any> {
    const tool = this.tools.get(toolName);
    if (!tool) {
      throw new Error(`Tool not found: ${toolName}`);
    }

    if (tool.validate && !tool.validate(params)) {
      throw new Error(`Invalid parameters for tool: ${toolName}`);
    }

    const startTime = Date.now();
    try {
      const result = await tool.execute(params);
      
      // Update metrics
      this.metrics.resource.apiCallsCount++;
      this.metrics.resource.computeTime += Date.now() - startTime;
      
      if (tool.cost) {
        this.emit('cost-incurred', { tool: toolName, cost: tool.cost });
      }

      return result;
    } catch (error) {
      this.log('error', `Tool execution failed: ${toolName}`, error);
      throw error;
    }
  }

  // Task management
  async processTask(task: Task, context: ExecutionContext): Promise<TaskResult> {
    this.currentTask = task;
    this.status = 'thinking';
    this.emit('status-changed', this.status);

    const startTime = Date.now();
    let result: TaskResult;

    try {
      // Store task in short-term memory
      this.memory.shortTerm.set(`task_${task.id}`, task);

      // Validate the task
      const isValid = await this.validate(task.payload);
      if (!isValid) {
        throw new Error('Task validation failed');
      }

      // Plan the execution
      this.status = 'executing';
      this.emit('status-changed', this.status);
      
      // Execute the task
      result = await this.executeWithRetry(task, context);

      // Store successful result
      await this.storeExecution(task, result, context);
      
      // Update metrics
      this.updateMetrics(result, Date.now() - startTime);

      // Learn from execution if enabled
      if (this.config.memory?.learningEnabled) {
        await this.learn(task, result);
      }

      this.status = 'completed';
      this.emit('task-completed', result);

    } catch (error) {
      result = {
        taskId: task.id,
        status: 'failure',
        error: error as Error,
        executionTime: Date.now() - startTime,
        toolsUsed: []
      };

      this.status = 'error';
      this.emit('task-failed', result);
      this.log('error', `Task execution failed: ${task.id}`, error);
    } finally {
      this.currentTask = null;
      this.status = 'idle';
      this.emit('status-changed', this.status);
    }

    return result;
  }

  private async executeWithRetry(task: Task, context: ExecutionContext): Promise<TaskResult> {
    let lastError: Error | undefined;
    const maxRetries = task.maxRetries || 3;
    
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        if (attempt > 0) {
          this.log('info', `Retrying task ${task.id}, attempt ${attempt}/${maxRetries}`);
          await this.delay(Math.pow(2, attempt) * 1000); // Exponential backoff
        }
        
        return await this.execute(task, context);
      } catch (error) {
        lastError = error as Error;
        this.log('warn', `Task attempt ${attempt} failed: ${error}`);
      }
    }

    throw lastError || new Error('Task execution failed after retries');
  }

  // Memory operations
  protected async remember(key: string, value: any, ttl?: number): Promise<void> {
    await this.memory.longTerm.set(key, value, ttl);
  }

  protected async recall(key: string): Promise<any> {
    return await this.memory.longTerm.get(key);
  }

  protected async search(query: string, limit: number = 10): Promise<any[]> {
    return await this.memory.longTerm.search(query, limit);
  }

  protected async storeEvent(event: Partial<AgentEvent>): Promise<void> {
    const fullEvent: AgentEvent = {
      id: this.generateId(),
      agentId: this.config.id,
      timestamp: new Date(),
      ...event
    } as AgentEvent;

    await this.memory.episodic.store(fullEvent);
  }

  private async storeExecution(task: Task, result: TaskResult, context: ExecutionContext): Promise<void> {
    const execution = {
      task,
      result,
      context,
      timestamp: new Date()
    };

    // Store in long-term memory
    await this.remember(`execution_${task.id}`, execution);

    // Store as event
    await this.storeEvent({
      type: 'task_execution',
      data: execution,
      outcome: result.status === 'success' ? 'success' : 'failure'
    });

    // Add to execution history
    this.executionHistory.push(result);
    if (this.executionHistory.length > 100) {
      this.executionHistory.shift(); // Keep only last 100 executions
    }
  }

  // Learning system
  protected async learn(task: Task, result: TaskResult): Promise<void> {
    // Identify patterns from successful executions
    if (result.status === 'success') {
      const pattern = {
        taskType: task.type,
        toolsUsed: result.toolsUsed,
        executionTime: result.executionTime,
        confidence: result.confidence || 1
      };

      await this.remember(`pattern_${task.type}_${Date.now()}`, pattern);
      
      // Update semantic knowledge
      await this.memory.semantic.addRelation(
        task.type,
        'solved_by',
        result.toolsUsed.join(',')
      );
    }

    // Store learnings as event
    await this.storeEvent({
      type: 'learning',
      data: {
        task,
        result,
        insights: await this.extractInsights(task, result)
      }
    });
  }

  protected async extractInsights(task: Task, result: TaskResult): Promise<string[]> {
    const insights: string[] = [];

    // Analyze execution time
    if (result.executionTime > 5000) {
      insights.push(`Task type ${task.type} takes longer than expected`);
    }

    // Analyze tool usage
    if (result.toolsUsed.length > 3) {
      insights.push(`Complex task requiring multiple tools: ${result.toolsUsed.join(', ')}`);
    }

    // Check for patterns in failures
    if (result.status === 'failure') {
      const similarFailures = await this.memory.episodic.recall({
        type: 'task_execution',
        outcome: 'failure'
      });

      if (similarFailures.length > 5) {
        insights.push(`Recurring failure pattern detected for ${task.type}`);
      }
    }

    return insights;
  }

  // Communication with other agents
  async sendMessage(to: string | string[], message: Partial<AgentMessage>): Promise<void> {
    const fullMessage: AgentMessage = {
      id: this.generateId(),
      from: this.config.id,
      to,
      type: message.type || 'request',
      priority: message.priority || 'normal',
      timestamp: new Date(),
      ...message
    } as AgentMessage;

    this.emit('message-sent', fullMessage);
  }

  async handleMessage(message: AgentMessage): Promise<void> {
    this.log('info', `Received message from ${message.from}: ${message.payload.action}`);

    // Process based on message type
    switch (message.type) {
      case 'request':
        await this.handleRequest(message);
        break;
      case 'response':
        await this.handleResponse(message);
        break;
      case 'event':
        await this.handleEvent(message);
        break;
      case 'error':
        await this.handleError(message);
        break;
      default:
        this.log('warn', `Unknown message type: ${message.type}`);
    }
  }

  protected abstract handleRequest(message: AgentMessage): Promise<void>;
  protected abstract handleResponse(message: AgentMessage): Promise<void>;
  protected abstract handleEvent(message: AgentMessage): Promise<void>;
  protected abstract handleError(message: AgentMessage): Promise<void>;

  // Metrics and monitoring
  private initializeMetrics(): AgentMetrics {
    return {
      performance: {
        tasksCompleted: 0,
        averageExecutionTime: 0,
        successRate: 0,
        errorRate: 0
      },
      resource: {
        apiCallsCount: 0,
        tokenUsage: 0,
        computeTime: 0,
        storageUsed: 0
      },
      business: {}
    };
  }

  private updateMetrics(result: TaskResult, executionTime: number): void {
    this.metrics.performance.tasksCompleted++;
    
    // Update average execution time
    const totalTasks = this.metrics.performance.tasksCompleted;
    const prevAvg = this.metrics.performance.averageExecutionTime;
    this.metrics.performance.averageExecutionTime = 
      (prevAvg * (totalTasks - 1) + executionTime) / totalTasks;

    // Update success/error rates
    const successCount = this.executionHistory.filter(r => r.status === 'success').length;
    const failureCount = this.executionHistory.filter(r => r.status === 'failure').length;
    
    this.metrics.performance.successRate = 
      totalTasks > 0 ? (successCount / totalTasks) * 100 : 0;
    this.metrics.performance.errorRate = 
      totalTasks > 0 ? (failureCount / totalTasks) * 100 : 0;

    this.metrics.performance.lastExecutionTime = new Date();
  }

  getMetrics(): AgentMetrics {
    return { ...this.metrics };
  }

  // Feedback and improvement
  async receiveFeedback(feedback: LearningFeedback): Promise<void> {
    // Store feedback
    await this.remember(`feedback_${feedback.taskId}`, feedback);

    // Update confidence based on feedback
    if (feedback.rating < 3) {
      this.log('info', `Low rating received for task ${feedback.taskId}: ${feedback.feedback}`);
      
      // Store negative feedback pattern
      await this.memory.semantic.addRelation(
        `task_${feedback.taskId}`,
        'needs_improvement',
        feedback.feedback || 'low_rating'
      );
    }

    // Apply corrections if provided
    if (feedback.corrections) {
      await this.applyCorrections(feedback.taskId, feedback.corrections);
    }

    this.emit('feedback-received', feedback);
  }

  protected abstract applyCorrections(taskId: string, corrections: any): Promise<void>;

  // Utility methods
  protected log(level: 'debug' | 'info' | 'warn' | 'error', message: string, data?: any): void {
    const logEntry = {
      timestamp: new Date(),
      agentId: this.config.id,
      level,
      message,
      data
    };

    this.emit('log', logEntry);
    
    if (this.config.monitoring?.loggingLevel) {
      const levels = ['debug', 'info', 'warn', 'error'];
      const configLevel = levels.indexOf(this.config.monitoring.loggingLevel);
      const messageLevel = levels.indexOf(level);
      
      if (messageLevel >= configLevel) {
        console.log(`[${this.name}] ${level.toUpperCase()}: ${message}`, data || '');
      }
    }
  }

  protected generateId(): string {
    return `${this.config.id}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  protected delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // Lifecycle management
  async start(): Promise<void> {
    this.log('info', `Agent ${this.name} starting...`);
    this.status = 'idle';
    this.emit('agent-started');
  }

  async stop(): Promise<void> {
    this.log('info', `Agent ${this.name} stopping...`);
    this.status = 'idle';
    await this.shutdown();
    this.emit('agent-stopped');
  }

  getStatus(): AgentStatus {
    return this.status;
  }

  getCurrentTask(): Task | null {
    return this.currentTask;
  }
}