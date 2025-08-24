import { EventEmitter } from 'events';
import {
  Task,
  TaskResult,
  ExecutionContext,
  AgentMessage,
  TaskPriority,
  Workflow,
  WorkflowStep,
  AgentStatus
} from './types';
import { BaseAgent } from './BaseAgent';

interface Intent {
  action: string;
  confidence: number;
  entities: Record<string, any>;
  suggestedAgents: string[];
}

interface AgentAssignment {
  agentId: string;
  tasks: Task[];
  priority: TaskPriority;
  dependencies: string[];
}

interface WorkflowExecution {
  id: string;
  workflow: Workflow;
  status: 'pending' | 'running' | 'completed' | 'failed';
  currentStep: string;
  context: ExecutionContext;
  results: Map<string, TaskResult>;
  startTime: Date;
  endTime?: Date;
}

export class OrchestratorAgent extends EventEmitter {
  private agents: Map<string, BaseAgent> = new Map();
  private workflows: Map<string, Workflow> = new Map();
  private activeExecutions: Map<string, WorkflowExecution> = new Map();
  private taskQueue: Task[] = [];
  private intentClassifier: any; // ML model for intent classification

  constructor() {
    super();
    this.initialize();
  }

  private initialize(): void {
    this.setupEventHandlers();
    this.loadWorkflows();
  }

  private setupEventHandlers(): void {
    this.on('agent-message', (message: AgentMessage) => {
      this.routeMessage(message);
    });

    this.on('task-completed', (result: TaskResult) => {
      this.handleTaskCompletion(result);
    });

    this.on('workflow-triggered', (trigger: any) => {
      this.handleWorkflowTrigger(trigger);
    });
  }

  private loadWorkflows(): void {
    // Load predefined workflows
    this.workflows.set('monthly_invoicing', {
      id: 'monthly_invoicing',
      name: 'Monthly Invoice Generation',
      description: 'Generate and send all monthly invoices',
      triggers: [{
        type: 'schedule',
        config: { cron: '0 9 1 * *' }
      }],
      steps: [
        {
          id: 'fetch_customers',
          agentId: 'database_agent',
          action: 'fetch_active_customers',
          onSuccess: 'generate_invoices'
        },
        {
          id: 'generate_invoices',
          agentId: 'invoice_agent',
          action: 'bulk_generate',
          input: '${fetch_customers.output}',
          parallel: true,
          onSuccess: 'send_invoices'
        },
        {
          id: 'send_invoices',
          agentId: 'invoice_agent',
          action: 'send_invoices',
          input: '${generate_invoices.output}',
          onSuccess: 'update_quickbooks'
        },
        {
          id: 'update_quickbooks',
          agentId: 'quickbooks_agent',
          action: 'create_invoices',
          input: '${generate_invoices.output}'
        }
      ],
      errorHandling: {
        retryPolicy: {
          maxAttempts: 3,
          backoff: 'exponential',
          initialDelay: 1000
        },
        alerting: {
          channels: ['email', 'slack'],
          severity: 'high'
        }
      },
      metadata: {}
    });

    this.workflows.set('overdue_collection', {
      id: 'overdue_collection',
      name: 'Overdue Invoice Collection',
      description: 'Follow up on overdue invoices',
      triggers: [{
        type: 'schedule',
        config: { cron: '0 10 * * *' } // Daily at 10 AM
      }],
      steps: [
        {
          id: 'check_overdue',
          agentId: 'invoice_agent',
          action: 'check_overdue',
          onSuccess: 'send_reminders'
        },
        {
          id: 'send_reminders',
          agentId: 'invoice_agent',
          action: 'follow_up',
          input: '${check_overdue.output}',
          conditions: [{
            field: 'overdueCount',
            operator: 'greater',
            value: 0
          }],
          onSuccess: 'log_activity'
        },
        {
          id: 'log_activity',
          agentId: 'crm_agent',
          action: 'log_collection_activity',
          input: '${send_reminders.output}'
        }
      ],
      errorHandling: {
        retryPolicy: {
          maxAttempts: 2,
          backoff: 'linear',
          initialDelay: 5000
        }
      },
      metadata: {}
    });
  }

  // Agent registration and management
  registerAgent(agent: BaseAgent): void {
    const agentId = agent.name.toLowerCase().replace(/\s+/g, '_');
    this.agents.set(agentId, agent);
    
    // Subscribe to agent events
    agent.on('message-sent', (message: AgentMessage) => {
      this.routeMessage(message);
    });

    agent.on('task-completed', (result: TaskResult) => {
      this.handleTaskCompletion(result);
    });

    agent.on('status-changed', (status: AgentStatus) => {
      this.emit('agent-status-changed', { agentId, status });
    });

    console.log(`Agent registered: ${agentId}`);
  }

  // Intent analysis and task decomposition
  async analyzeIntent(prompt: string): Promise<Intent[]> {
    const intents: Intent[] = [];

    // Simple rule-based intent classification (would use ML in production)
    const lowerPrompt = prompt.toLowerCase();

    if (lowerPrompt.includes('invoice')) {
      if (lowerPrompt.includes('generate') || lowerPrompt.includes('create')) {
        intents.push({
          action: 'generate_invoice',
          confidence: 0.9,
          entities: this.extractEntities(prompt),
          suggestedAgents: ['invoice_agent']
        });
      }
      if (lowerPrompt.includes('send')) {
        intents.push({
          action: 'send_invoice',
          confidence: 0.85,
          entities: this.extractEntities(prompt),
          suggestedAgents: ['invoice_agent', 'communication_agent']
        });
      }
      if (lowerPrompt.includes('overdue') || lowerPrompt.includes('follow up')) {
        intents.push({
          action: 'follow_up_overdue',
          confidence: 0.88,
          entities: this.extractEntities(prompt),
          suggestedAgents: ['invoice_agent']
        });
      }
    }

    if (lowerPrompt.includes('payment')) {
      if (lowerPrompt.includes('track') || lowerPrompt.includes('status')) {
        intents.push({
          action: 'track_payment',
          confidence: 0.87,
          entities: this.extractEntities(prompt),
          suggestedAgents: ['invoice_agent', 'payment_agent']
        });
      }
    }

    if (lowerPrompt.includes('reconcile')) {
      intents.push({
        action: 'reconcile_accounts',
        confidence: 0.85,
        entities: this.extractEntities(prompt),
        suggestedAgents: ['invoice_agent', 'quickbooks_agent']
      });
    }

    if (lowerPrompt.includes('month-end') || lowerPrompt.includes('close books')) {
      intents.push({
        action: 'month_end_close',
        confidence: 0.92,
        entities: this.extractEntities(prompt),
        suggestedAgents: ['invoice_agent', 'quickbooks_agent', 'expense_agent', 'analysis_agent']
      });
    }

    return intents;
  }

  private extractEntities(prompt: string): Record<string, any> {
    const entities: Record<string, any> = {};

    // Extract dates
    const dateMatch = prompt.match(/\b(\d{1,2}\/\d{1,2}\/\d{4}|\w+ \d{1,2}, \d{4})\b/);
    if (dateMatch) {
      entities.date = new Date(dateMatch[0]);
    }

    // Extract customer names (simplified)
    const customerMatch = prompt.match(/customer\s+(\w+)/i);
    if (customerMatch) {
      entities.customer = customerMatch[1];
    }

    // Extract amounts
    const amountMatch = prompt.match(/\$?([\d,]+\.?\d*)/);
    if (amountMatch) {
      entities.amount = parseFloat(amountMatch[1].replace(',', ''));
    }

    // Relative ranges
    const lower = prompt.toLowerCase();
    const now = new Date();
    const startOfWeek = new Date(now);
    startOfWeek.setDate(now.getDate() - ((now.getDay() + 6) % 7)); // Monday
    startOfWeek.setHours(0,0,0,0);
    const endOfWeek = new Date(startOfWeek);
    endOfWeek.setDate(startOfWeek.getDate() + 6);
    endOfWeek.setHours(23,59,59,999);
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);

    if (lower.includes('this week')) {
      entities.dateRange = { start: startOfWeek, end: endOfWeek };
    } else if (lower.includes('this month')) {
      entities.dateRange = { start: startOfMonth, end: endOfMonth };
    } else if (lower.includes('last week')) {
      const lastWeekStart = new Date(startOfWeek);
      lastWeekStart.setDate(startOfWeek.getDate() - 7);
      const lastWeekEnd = new Date(endOfWeek);
      lastWeekEnd.setDate(endOfWeek.getDate() - 7);
      entities.dateRange = { start: lastWeekStart, end: lastWeekEnd };
    }

    // Everyone/all
    if (/(everyone|every one|all customers|all clients|for all)/i.test(prompt)) {
      entities.allCustomers = true;
    }

    return entities;
  }

  async decomposeTask(intent: Intent): Promise<Task[]> {
    const tasks: Task[] = [];
    const baseTaskId = `task_${Date.now()}`;

    switch (intent.action) {
      case 'generate_invoice':
        if (intent.entities.allCustomers) {
          tasks.push({
            id: `${baseTaskId}_bulk`,
            type: 'bulk_generate',
            description: 'Generate invoices for all customers',
            priority: 'high',
            payload: {
              customers: ['ALL'],
              dateRange: intent.entities.dateRange || undefined,
              autoSend: false
            },
            createdAt: new Date()
          });
        } else {
          tasks.push({
            id: `${baseTaskId}_1`,
            type: 'fetch_customer_data',
            description: 'Fetch customer information',
            priority: 'normal',
            payload: { customerId: intent.entities.customer },
            createdAt: new Date()
          });
          tasks.push({
            id: `${baseTaskId}_2`,
            type: 'fetch_billable_items',
            description: 'Fetch billable items for customer',
            priority: 'normal',
            payload: { customerId: intent.entities.customer },
            dependencies: [`${baseTaskId}_1`],
            createdAt: new Date()
          });
          tasks.push({
            id: `${baseTaskId}_3`,
            type: 'generate_invoice',
            description: 'Generate invoice document',
            priority: 'normal',
            payload: { 
              customerData: `\${${baseTaskId}_1.output}`,
              items: `\${${baseTaskId}_2.output}`,
              dateRange: intent.entities.dateRange || undefined
            },
            dependencies: [`${baseTaskId}_1`, `${baseTaskId}_2`],
            createdAt: new Date()
          });
        }
        break;

      case 'month_end_close':
        tasks.push({
          id: `${baseTaskId}_invoices`,
          type: 'generate_pending_invoices',
          description: 'Generate all pending invoices',
          priority: 'high',
          payload: {},
          createdAt: new Date()
        });
        tasks.push({
          id: `${baseTaskId}_payments`,
          type: 'process_pending_payments',
          description: 'Process all pending payments',
          priority: 'high',
          payload: {},
          createdAt: new Date()
        });
        tasks.push({
          id: `${baseTaskId}_expenses`,
          type: 'finalize_expenses',
          description: 'Finalize expense reports',
          priority: 'high',
          payload: {},
          createdAt: new Date()
        });
        tasks.push({
          id: `${baseTaskId}_reconcile`,
          type: 'reconcile_accounts',
          description: 'Reconcile all accounts',
          priority: 'high',
          payload: {},
          dependencies: [
            `${baseTaskId}_invoices`,
            `${baseTaskId}_payments`,
            `${baseTaskId}_expenses`
          ],
          createdAt: new Date()
        });
        tasks.push({
          id: `${baseTaskId}_reports`,
          type: 'generate_reports',
          description: 'Generate financial reports',
          priority: 'normal',
          payload: {},
          dependencies: [`${baseTaskId}_reconcile`],
          createdAt: new Date()
        });
        break;

      default:
        tasks.push({
          id: baseTaskId,
          type: intent.action,
          description: `Execute ${intent.action}`,
          priority: 'normal',
          payload: intent.entities,
          createdAt: new Date()
        });
    }

    return tasks;
  }

  selectAgents(tasks: Task[]): AgentAssignment[] {
    const assignments: AgentAssignment[] = [];
    const agentTasks = new Map<string, Task[]>();

    for (const task of tasks) {
      let agentId: string;

      // Determine which agent should handle this task
      if (task.type.includes('invoice') || task.type.includes('payment')) {
        agentId = 'invoice_agent';
      } else if (task.type.includes('expense')) {
        agentId = 'expense_agent';
      } else if (task.type.includes('quickbooks') || task.type.includes('reconcile')) {
        agentId = 'quickbooks_agent';
      } else if (task.type.includes('report') || task.type.includes('analysis')) {
        agentId = 'analysis_agent';
      } else {
        agentId = 'general_agent';
      }

      if (!agentTasks.has(agentId)) {
        agentTasks.set(agentId, []);
      }
      agentTasks.get(agentId)!.push(task);
    }

    // Create assignments
    for (const [agentId, tasks] of agentTasks) {
      assignments.push({
        agentId,
        tasks,
        priority: this.determinePriority(tasks),
        dependencies: this.extractDependencies(tasks)
      });
    }

    return assignments;
  }

  private determinePriority(tasks: Task[]): TaskPriority {
    const priorities = tasks.map(t => t.priority);
    if (priorities.includes('critical')) return 'critical';
    if (priorities.includes('high')) return 'high';
    if (priorities.includes('normal')) return 'normal';
    return 'low';
  }

  private extractDependencies(tasks: Task[]): string[] {
    const deps: string[] = [];
    for (const task of tasks) {
      if (task.dependencies) {
        deps.push(...task.dependencies);
      }
    }
    return [...new Set(deps)];
  }

  // Workflow execution
  async executeWorkflow(workflowId: string, context: ExecutionContext): Promise<any> {
    const workflow = this.workflows.get(workflowId);
    if (!workflow) {
      throw new Error(`Workflow not found: ${workflowId}`);
    }

    const execution: WorkflowExecution = {
      id: `exec_${Date.now()}`,
      workflow,
      status: 'running',
      currentStep: workflow.steps[0].id,
      context,
      results: new Map(),
      startTime: new Date()
    };

    this.activeExecutions.set(execution.id, execution);
    this.emit('workflow-started', execution);

    try {
      // Execute steps in sequence (with parallel support)
      for (const step of workflow.steps) {
        await this.executeStep(step, execution);
      }

      execution.status = 'completed';
      execution.endTime = new Date();
      this.emit('workflow-completed', execution);

      return {
        executionId: execution.id,
        status: 'completed',
        results: Array.from(execution.results.entries())
      };

    } catch (error) {
      execution.status = 'failed';
      execution.endTime = new Date();
      this.emit('workflow-failed', { execution, error });

      // Handle error according to strategy
      await this.handleWorkflowError(workflow, execution, error as Error);

      throw error;
    } finally {
      this.activeExecutions.delete(execution.id);
    }
  }

  private async executeStep(step: WorkflowStep, execution: WorkflowExecution): Promise<void> {
    execution.currentStep = step.id;
    this.emit('step-started', { step, execution });

    // Check conditions
    if (step.conditions && !this.evaluateConditions(step.conditions, execution)) {
      this.emit('step-skipped', { step, reason: 'conditions not met' });
      return;
    }

    // Get the agent
    const agent = this.agents.get(step.agentId);
    if (!agent) {
      throw new Error(`Agent not found: ${step.agentId}`);
    }

    // Prepare input
    const input = this.resolveInput(step.input, execution);

    // Create task
    const task: Task = {
      id: `${execution.id}_${step.id}`,
      type: step.action,
      description: `Execute ${step.action} for workflow ${execution.workflow.name}`,
      priority: 'normal',
      payload: {
        ...step.params,
        ...input
      },
      createdAt: new Date()
    };

    // Execute with timeout
    const timeoutMs = step.timeout || 30000;
    const result = await Promise.race([
      agent.processTask(task, execution.context),
      this.timeout(timeoutMs)
    ]);

    // Store result
    execution.results.set(step.id, result as TaskResult);
    this.emit('step-completed', { step, result });

    // Determine next step
    if (result && (result as TaskResult).status === 'success' && step.onSuccess) {
      // Continue to success step
    } else if (result && (result as TaskResult).status === 'failure' && step.onFailure) {
      // Go to failure step
      execution.currentStep = step.onFailure;
    }
  }

  private evaluateConditions(conditions: any[], execution: WorkflowExecution): boolean {
    for (const condition of conditions) {
      const value = this.getValueFromPath(condition.field, execution);
      
      switch (condition.operator) {
        case 'equals':
          if (value !== condition.value) return false;
          break;
        case 'contains':
          if (!value || !value.includes(condition.value)) return false;
          break;
        case 'greater':
          if (value <= condition.value) return false;
          break;
        case 'less':
          if (value >= condition.value) return false;
          break;
        case 'exists':
          if (value === undefined || value === null) return false;
          break;
      }
    }
    return true;
  }

  private resolveInput(input: any, execution: WorkflowExecution): any {
    if (!input) return {};
    
    if (typeof input === 'string' && input.startsWith('${')) {
      // Resolve reference to previous step output
      const match = input.match(/\$\{(.+?)\.output\}/);
      if (match) {
        const stepId = match[1];
        const result = execution.results.get(stepId);
        return result?.data || {};
      }
    }

    return input;
  }

  private getValueFromPath(path: string, execution: WorkflowExecution): any {
    const parts = path.split('.');
    let value: any = execution;

    for (const part of parts) {
      if (value && typeof value === 'object') {
        value = value[part];
      } else {
        return undefined;
      }
    }

    return value;
  }

  private async handleWorkflowError(
    workflow: Workflow,
    execution: WorkflowExecution,
    error: Error
  ): Promise<void> {
    const { errorHandling } = workflow;

    if (errorHandling.alerting) {
      // Send alerts
      for (const channel of errorHandling.alerting.channels) {
        await this.sendAlert(channel, {
          workflow: workflow.name,
          executionId: execution.id,
          error: error.message,
          severity: errorHandling.alerting.severity
        });
      }
    }

    if (errorHandling.fallback) {
      // Execute fallback
      const agent = this.agents.get(errorHandling.fallback.agentId);
      if (agent) {
        await agent.processTask({
          id: `fallback_${execution.id}`,
          type: errorHandling.fallback.action,
          description: 'Fallback action',
          priority: 'high',
          payload: { error: error.message, execution },
          createdAt: new Date()
        }, execution.context);
      }
    }
  }

  // Message routing
  private async routeMessage(message: AgentMessage): Promise<void> {
    const recipients = Array.isArray(message.to) ? message.to : [message.to];

    for (const recipientId of recipients) {
      const agent = this.agents.get(recipientId);
      if (agent) {
        await agent.handleMessage(message);
      } else if (recipientId === 'orchestrator') {
        await this.handleMessage(message);
      } else {
        console.warn(`Agent not found: ${recipientId}`);
      }
    }
  }

  private async handleMessage(message: AgentMessage): Promise<void> {
    // Handle messages directed to the orchestrator
    console.log(`Orchestrator received message from ${message.from}`);
  }

  // Task completion handling
  private handleTaskCompletion(result: TaskResult): void {
    this.emit('task-result', result);

    // Check if this completes any workflows
    for (const execution of this.activeExecutions.values()) {
      const currentStep = execution.workflow.steps.find(s => s.id === execution.currentStep);
      if (currentStep && result.taskId.includes(currentStep.id)) {
        // Move to next step
        const nextIndex = execution.workflow.steps.findIndex(s => s.id === currentStep.id) + 1;
        if (nextIndex < execution.workflow.steps.length) {
          execution.currentStep = execution.workflow.steps[nextIndex].id;
        }
      }
    }
  }

  // Workflow triggers
  private handleWorkflowTrigger(trigger: any): void {
    for (const [id, workflow] of this.workflows) {
      for (const wfTrigger of workflow.triggers) {
        if (this.matchesTrigger(wfTrigger, trigger)) {
          this.executeWorkflow(id, trigger.context);
        }
      }
    }
  }

  private matchesTrigger(wfTrigger: any, trigger: any): boolean {
    return wfTrigger.type === trigger.type &&
           JSON.stringify(wfTrigger.config) === JSON.stringify(trigger.config);
  }

  // Utility methods
  private timeout(ms: number): Promise<never> {
    return new Promise((_, reject) => 
      setTimeout(() => reject(new Error('Operation timed out')), ms)
    );
  }

  private async sendAlert(channel: string, alert: any): Promise<void> {
    console.log(`Alert sent to ${channel}:`, alert);
    // Implement actual alerting (email, Slack, etc.)
  }

  // Public API
  async processUserRequest(prompt: string, context: ExecutionContext): Promise<any> {
    try {
      // Analyze intent
      const intents = await this.analyzeIntent(prompt);
      if (intents.length === 0) {
        return {
          status: 'error',
          message: 'Could not understand the request'
        };
      }

      // Use highest confidence intent
      const primaryIntent = intents.reduce((a, b) => a.confidence > b.confidence ? a : b);

      // Decompose into tasks
      const tasks = await this.decomposeTask(primaryIntent);

      // Assign to agents
      const assignments = this.selectAgents(tasks);

      // Execute assignments
      const results = [];
      for (const assignment of assignments) {
        const agent = this.agents.get(assignment.agentId);
        if (!agent) continue;

        for (const task of assignment.tasks) {
          const result = await agent.processTask(task, context);
          results.push(result);
        }
      }

      return {
        status: 'success',
        intent: primaryIntent,
        results
      };

    } catch (error) {
      console.error('Error processing user request:', error);
      return {
        status: 'error',
        message: error.message
      };
    }
  }

  getAgentStatus(): Map<string, AgentStatus> {
    const status = new Map<string, AgentStatus>();
    for (const [id, agent] of this.agents) {
      status.set(id, agent.getStatus());
    }
    return status;
  }

  getActiveWorkflows(): WorkflowExecution[] {
    return Array.from(this.activeExecutions.values());
  }
}
