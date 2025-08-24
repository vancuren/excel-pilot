import { InvoiceAgent } from '../specialized/InvoiceAgent';
import { OrchestratorAgent } from '../core/OrchestratorAgent';
import { InMemoryAgentMemory } from '../core/AgentMemory';
import { createInvoiceTools } from '../tools/InvoiceTools';
import { ExecutionContext, Task, AgentConfig } from '../core/types';

// Example: Setting up and using the Invoice Agent

export async function setupInvoiceAgentSystem() {
  console.log('🚀 Setting up Invoice Agent System...\n');

  // 1. Create memory system for the agent
  const memory = new InMemoryAgentMemory();

  // 2. Configure the Invoice Agent
  const invoiceAgentConfig: AgentConfig = {
    id: 'invoice_agent',
    name: 'Invoice Agent',
    description: 'Autonomous agent for invoice generation, tracking, and collection',
    version: '1.0.0',
    capabilities: [],
    tools: ['template_engine', 'pdf_generator', 'email_service', 'database', 'payment_gateway', 'quickbooks'],
    memory: {
      shortTermSize: 100,
      longTermTTL: 86400000, // 24 hours
      learningEnabled: true
    },
    monitoring: {
      metricsEnabled: true,
      loggingLevel: 'info',
      alertThresholds: {
        errorRate: 10,
        averageExecutionTime: 5000
      }
    }
  };

  // 3. Create and configure the Invoice Agent
  const invoiceAgent = new InvoiceAgent(invoiceAgentConfig, memory);
  
  // 4. Register tools with the agent
  const tools = createInvoiceTools();
  
  invoiceAgent.registerTool(tools.templateEngine);
  invoiceAgent.registerTool(tools.pdfGenerator);
  invoiceAgent.registerTool(tools.emailService);
  invoiceAgent.registerTool(tools.database);
  invoiceAgent.registerTool(tools.paymentGateway);
  invoiceAgent.registerTool(tools.quickbooks);

  // 5. Seed test data
  (tools.database as any).seedTestData();

  // 6. Start the agent
  await invoiceAgent.start();

  // 7. Create the orchestrator
  const orchestrator = new OrchestratorAgent();
  orchestrator.registerAgent(invoiceAgent);

  console.log('✅ Invoice Agent System initialized successfully!\n');

  return { invoiceAgent, orchestrator, tools };
}

// Example workflows

export async function exampleGenerateSingleInvoice() {
  console.log('📄 Example: Generate Single Invoice\n');
  
  const { invoiceAgent } = await setupInvoiceAgentSystem();

  const context: ExecutionContext = {
    userId: 'user_123',
    organizationId: 'org_acme',
    sessionId: 'session_456',
    permissions: [
      { resource: 'invoices', actions: ['create', 'read', 'update'] }
    ],
    metadata: {},
    traceId: 'trace_789'
  };

  const task: Task = {
    id: 'task_001',
    type: 'generate_invoice',
    description: 'Generate invoice for Acme Corporation',
    priority: 'normal',
    payload: {
      customerInfo: {
        id: 'cust_001',
        name: 'Acme Corporation',
        email: 'billing@acme.com',
        address: '123 Business St, New York, NY 10001'
      },
      items: [
        {
          description: 'Consulting Services - January',
          quantity: 40,
          unitPrice: 150
        },
        {
          description: 'Software License',
          quantity: 5,
          unitPrice: 299
        }
      ],
      metadata: {
        terms: 'Net 30',
        notes: 'Thank you for your continued business!'
      }
    },
    createdAt: new Date()
  };

  const result = await invoiceAgent.processTask(task, context);
  
  console.log('Invoice Generation Result:');
  console.log('- Status:', result.status);
  console.log('- Invoice Number:', result.data?.invoiceNumber);
  console.log('- Total Amount:', result.data?.data?.total);
  console.log('- Execution Time:', result.executionTime, 'ms');
  console.log('- Tools Used:', result.toolsUsed.join(', '));
  console.log();

  return result;
}

export async function exampleBulkInvoiceGeneration() {
  console.log('📚 Example: Bulk Invoice Generation\n');
  
  const { invoiceAgent } = await setupInvoiceAgentSystem();

  const context: ExecutionContext = {
    userId: 'user_123',
    organizationId: 'org_acme',
    sessionId: 'session_bulk',
    permissions: [
      { resource: 'invoices', actions: ['create', 'read', 'update'] }
    ],
    metadata: {},
    traceId: 'trace_bulk'
  };

  const task: Task = {
    id: 'task_bulk',
    type: 'bulk_invoice_generation',
    description: 'Generate monthly invoices for all customers',
    priority: 'high',
    payload: {
      customers: ['cust_001', 'cust_002'],
      template: 'standard',
      dateRange: {
        start: new Date('2024-01-01'),
        end: new Date('2024-01-31')
      },
      autoSend: true
    },
    createdAt: new Date()
  };

  // Monitor progress
  invoiceAgent.on('progress', (progress) => {
    console.log(`Progress: ${progress.completed}/${progress.total} invoices generated`);
  });

  const result = await invoiceAgent.processTask(task, context);
  
  console.log('\nBulk Generation Result:');
  console.log('- Status:', result.status);
  console.log('- Invoices Generated:', result.data?.generated);
  console.log('- Failed:', result.data?.failed);
  console.log('- Execution Time:', result.executionTime, 'ms');
  console.log();

  return result;
}

export async function exampleOverdueFollowUp() {
  console.log('🔔 Example: Overdue Invoice Follow-up\n');
  
  const { invoiceAgent } = await setupInvoiceAgentSystem();

  const context: ExecutionContext = {
    userId: 'user_123',
    organizationId: 'org_acme',
    sessionId: 'session_followup',
    permissions: [
      { resource: 'invoices', actions: ['read', 'update'] },
      { resource: 'communications', actions: ['send'] }
    ],
    metadata: {},
    traceId: 'trace_followup'
  };

  const task: Task = {
    id: 'task_followup',
    type: 'overdue_followup',
    description: 'Send reminders for overdue invoices',
    priority: 'high',
    payload: {
      overdueCheck: true,
      daysOverdue: 7,
      reminderTemplate: 'friendly_reminder'
    },
    createdAt: new Date()
  };

  const result = await invoiceAgent.processTask(task, context);
  
  console.log('Follow-up Result:');
  console.log('- Status:', result.status);
  console.log('- Reminders Sent:', result.data?.remindersSet);
  console.log('- Execution Time:', result.executionTime, 'ms');
  console.log();

  return result;
}

export async function exampleOrchestratorWorkflow() {
  console.log('🎯 Example: Orchestrator-Driven Workflow\n');
  
  const { orchestrator } = await setupInvoiceAgentSystem();

  const context: ExecutionContext = {
    userId: 'user_123',
    organizationId: 'org_acme',
    sessionId: 'session_orchestrated',
    permissions: [
      { resource: 'invoices', actions: ['create', 'read', 'update'] },
      { resource: 'payments', actions: ['read'] },
      { resource: 'accounting', actions: ['create'] }
    ],
    metadata: {},
    traceId: 'trace_orchestrated'
  };

  // Natural language request
  const userRequest = "Generate and send invoices for all customers with unbilled items from last month";

  console.log('User Request:', userRequest);
  console.log('Processing...\n');

  const result = await orchestrator.processUserRequest(userRequest, context);

  console.log('Orchestrator Result:');
  console.log('- Status:', result.status);
  console.log('- Intent Action:', result.intent?.action);
  console.log('- Intent Confidence:', result.intent?.confidence);
  console.log('- Number of Tasks:', result.results?.length);
  
  if (result.results) {
    result.results.forEach((taskResult: any, index: number) => {
      console.log(`\nTask ${index + 1}:`);
      console.log('  - Status:', taskResult.status);
      console.log('  - Execution Time:', taskResult.executionTime, 'ms');
    });
  }

  return result;
}

export async function exampleLearningAndImprovement() {
  console.log('🧠 Example: Learning from Patterns\n');
  
  const { invoiceAgent } = await setupInvoiceAgentSystem();

  const context: ExecutionContext = {
    userId: 'user_123',
    organizationId: 'org_acme',
    sessionId: 'session_learning',
    permissions: [
      { resource: 'invoices', actions: ['create', 'read', 'update'] }
    ],
    metadata: {},
    traceId: 'trace_learning'
  };

  // Execute multiple similar tasks to establish patterns
  const tasks = [
    {
      id: 'learn_001',
      type: 'generate_invoice',
      description: 'Invoice generation task 1',
      priority: 'normal' as const,
      payload: {
        customerInfo: { id: 'cust_001', name: 'Customer 1', email: 'cust1@example.com' },
        items: [{ description: 'Service A', quantity: 10, unitPrice: 100 }]
      },
      createdAt: new Date()
    },
    {
      id: 'learn_002',
      type: 'generate_invoice',
      description: 'Invoice generation task 2',
      priority: 'normal' as const,
      payload: {
        customerInfo: { id: 'cust_002', name: 'Customer 2', email: 'cust2@example.com' },
        items: [{ description: 'Service B', quantity: 5, unitPrice: 200 }]
      },
      createdAt: new Date()
    }
  ];

  console.log('Training agent with multiple tasks...\n');

  for (const task of tasks) {
    const result = await invoiceAgent.processTask(task, context);
    console.log(`Task ${task.id}: ${result.status} (${result.executionTime}ms)`);
  }

  // Get memory statistics
  const memoryStats = await (invoiceAgent as any).memory.getMemoryStats();
  console.log('\nMemory Statistics:');
  console.log('- Short-term items:', memoryStats.shortTermSize);
  console.log('- Long-term items:', memoryStats.longTermSize);
  console.log('- Episodic events:', memoryStats.episodicEvents);
  console.log('- Semantic relations:', memoryStats.semanticRelations);

  // Analyze patterns
  const patternAnalysis = await (invoiceAgent as any).memory.analyzePatterns('generate_invoice');
  console.log('\nPattern Analysis:');
  console.log('- Average execution time:', patternAnalysis.insights[0]);
  console.log('- Average confidence:', patternAnalysis.insights[1]);
  
  if (patternAnalysis.recommendations.length > 0) {
    console.log('- Recommendations:', patternAnalysis.recommendations.join(', '));
  }

  // Provide feedback to improve
  await invoiceAgent.receiveFeedback({
    taskId: 'learn_001',
    agentId: 'invoice_agent',
    rating: 5,
    feedback: 'Excellent invoice generation',
    timestamp: new Date()
  });

  console.log('\n✅ Agent has learned from the patterns and feedback!');
}

// Main execution function
export async function runAllExamples() {
  console.log('=' .repeat(60));
  console.log('INVOICE AGENT SYSTEM - COMPREHENSIVE EXAMPLES');
  console.log('=' .repeat(60));
  console.log();

  try {
    // Run examples sequentially
    await exampleGenerateSingleInvoice();
    console.log('-'.repeat(60) + '\n');

    await exampleBulkInvoiceGeneration();
    console.log('-'.repeat(60) + '\n');

    await exampleOverdueFollowUp();
    console.log('-'.repeat(60) + '\n');

    await exampleOrchestratorWorkflow();
    console.log('-'.repeat(60) + '\n');

    await exampleLearningAndImprovement();
    
    console.log('\n' + '='.repeat(60));
    console.log('ALL EXAMPLES COMPLETED SUCCESSFULLY!');
    console.log('='.repeat(60));

  } catch (error) {
    console.error('Error running examples:', error);
  }
}

// Export for use in other parts of the application
export { InvoiceAgent, OrchestratorAgent, InMemoryAgentMemory, createInvoiceTools };

// If running directly
if (require.main === module) {
  runAllExamples().catch(console.error);
}