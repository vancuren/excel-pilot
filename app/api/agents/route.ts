import { NextRequest, NextResponse } from 'next/server';
import { InvoiceAgent } from '@/lib/agents/specialized/InvoiceAgent';
import { OrchestratorAgent } from '@/lib/agents/core/OrchestratorAgent';
import { InMemoryAgentMemory } from '@/lib/agents/core/AgentMemory';
import { createInvoiceTools } from '@/lib/agents/tools/InvoiceTools';
import { ExecutionContext, Task, AgentConfig } from '@/lib/agents/core/types';

// Initialize agent system (singleton)
let agentSystem: {
  orchestrator: OrchestratorAgent;
  invoiceAgent: InvoiceAgent;
  tools: ReturnType<typeof createInvoiceTools>;
} | null = null;

function initializeAgentSystem() {
  if (agentSystem) return agentSystem;

  // Create memory system
  const memory = new InMemoryAgentMemory();

  // Configure Invoice Agent
  const invoiceAgentConfig: AgentConfig = {
    id: 'invoice_agent',
    name: 'Invoice Agent',
    description: 'Autonomous agent for invoice operations',
    version: '1.0.0',
    capabilities: [],
    tools: ['template_engine', 'pdf_generator', 'email_service', 'database', 'payment_gateway', 'quickbooks'],
    memory: {
      shortTermSize: 100,
      longTermTTL: 86400000,
      learningEnabled: true
    },
    monitoring: {
      metricsEnabled: true,
      loggingLevel: 'info'
    }
  };

  // Create agents
  const invoiceAgent = new InvoiceAgent(invoiceAgentConfig, memory);
  const orchestrator = new OrchestratorAgent();
  
  // Create and register tools
  const tools = createInvoiceTools();
  invoiceAgent.registerTool(tools.templateEngine);
  invoiceAgent.registerTool(tools.pdfGenerator);
  invoiceAgent.registerTool(tools.emailService);
  invoiceAgent.registerTool(tools.database);
  invoiceAgent.registerTool(tools.paymentGateway);
  invoiceAgent.registerTool(tools.quickbooks);

  // Register agent with orchestrator
  orchestrator.registerAgent(invoiceAgent);

  // Start agents
  invoiceAgent.start();

  agentSystem = { orchestrator, invoiceAgent, tools };
  return agentSystem;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { action, data, naturalLanguage } = body;

    // Initialize agent system if needed
    const { orchestrator, invoiceAgent } = initializeAgentSystem();

    // Create execution context
  const context: ExecutionContext = {
    userId: body.userId || 'user_default',
    organizationId: body.organizationId || 'org_default',
    sessionId: body.sessionId || `session_${Date.now()}`,
      permissions: [
        { resource: 'invoices', actions: ['create', 'read', 'update', 'delete'] },
        { resource: 'payments', actions: ['read', 'track'] },
        { resource: 'communications', actions: ['send'] }
      ],
    metadata: { ...(body.metadata || {}), datasetId: body.datasetId },
    traceId: `trace_${Date.now()}`
  };

    let result;

    // Handle natural language requests through orchestrator
    if (naturalLanguage) {
      result = await orchestrator.processUserRequest(naturalLanguage, context);
      
      // Format the response for the chat interface
      const formattedResponse = formatOrchestratorResponse(result);
      return NextResponse.json(formattedResponse);
    }

    // Handle specific agent actions
    switch (action) {
      case 'generate_invoice':
        result = await handleGenerateInvoice(invoiceAgent, data, context);
        break;
        
      case 'bulk_generate':
        result = await handleBulkGenerate(invoiceAgent, data, context);
        break;
        
      case 'send_invoices':
        result = await handleSendInvoices(invoiceAgent, data, context);
        break;
        
      case 'track_payments':
        result = await handleTrackPayments(invoiceAgent, data, context);
        break;
        
      case 'follow_up_overdue':
        result = await handleFollowUpOverdue(invoiceAgent, data, context);
        break;
        
      case 'reconcile':
        result = await handleReconcile(invoiceAgent, data, context);
        break;
        
      case 'get_agent_status':
        result = {
          status: 'success',
          agents: orchestrator.getAgentStatus(),
          activeWorkflows: orchestrator.getActiveWorkflows()
        };
        break;
        
      case 'get_metrics':
        result = {
          status: 'success',
          metrics: invoiceAgent.getMetrics()
        };
        break;
        
      default:
        return NextResponse.json(
          { error: 'Unknown action', supportedActions: [
            'generate_invoice', 'bulk_generate', 'send_invoices', 
            'track_payments', 'follow_up_overdue', 'reconcile',
            'get_agent_status', 'get_metrics'
          ]},
          { status: 400 }
        );
    }

    return NextResponse.json(result);

  } catch (error) {
    console.error('Agent API error:', error);
    return NextResponse.json(
      { error: 'Agent execution failed', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

// Handler functions for specific actions

async function handleGenerateInvoice(agent: InvoiceAgent, data: any, context: ExecutionContext) {
  const task: Task = {
    id: `task_${Date.now()}`,
    type: 'generate_invoice',
    description: 'Generate invoice from data',
    priority: 'normal',
    payload: data,
    createdAt: new Date()
  };

  const result = await agent.processTask(task, context);
  
  return {
    status: result.status,
    invoiceNumber: result.data?.invoiceNumber,
    total: result.data?.data?.total,
    pdf: result.data?.pdf ? 'PDF generated successfully' : null,
    executionTime: result.executionTime
  };
}

async function handleBulkGenerate(agent: InvoiceAgent, data: any, context: ExecutionContext) {
  const task: Task = {
    id: `task_bulk_${Date.now()}`,
    type: 'bulk_invoice_generation',
    description: 'Generate multiple invoices',
    priority: 'high',
    payload: data,
    createdAt: new Date()
  };

  const result = await agent.processTask(task, context);
  
  return {
    status: result.status,
    generated: result.data?.generated,
    failed: result.data?.failed,
    invoices: result.data?.invoices?.map((inv: any) => ({
      invoiceNumber: inv.invoiceNumber,
      customer: inv.data?.customerInfo?.name,
      total: inv.data?.total
    })),
    executionTime: result.executionTime
  };
}

async function handleSendInvoices(agent: InvoiceAgent, data: any, context: ExecutionContext) {
  const task: Task = {
    id: `task_send_${Date.now()}`,
    type: 'send_invoices',
    description: 'Send invoices via email',
    priority: 'normal',
    payload: {
      ...data,
      send: true
    },
    createdAt: new Date()
  };

  const result = await agent.processTask(task, context);
  
  return {
    status: result.status,
    sent: result.data?.sent,
    failed: result.data?.failed,
    details: result.data?.results,
    executionTime: result.executionTime
  };
}

async function handleTrackPayments(agent: InvoiceAgent, data: any, context: ExecutionContext) {
  const task: Task = {
    id: `task_track_${Date.now()}`,
    type: 'track_payments',
    description: 'Track payment status',
    priority: 'normal',
    payload: {
      ...data,
      trackPayments: true
    },
    createdAt: new Date()
  };

  const result = await agent.processTask(task, context);
  
  return {
    status: result.status,
    payments: result.data,
    executionTime: result.executionTime
  };
}

async function handleFollowUpOverdue(agent: InvoiceAgent, data: any, context: ExecutionContext) {
  const task: Task = {
    id: `task_followup_${Date.now()}`,
    type: 'overdue_followup',
    description: 'Send overdue reminders',
    priority: 'high',
    payload: {
      ...data,
      overdueCheck: true
    },
    createdAt: new Date()
  };

  const result = await agent.processTask(task, context);
  
  return {
    status: result.status,
    remindersSet: result.data?.remindersSet,
    details: result.data?.results,
    executionTime: result.executionTime
  };
}

async function handleReconcile(agent: InvoiceAgent, data: any, context: ExecutionContext) {
  const task: Task = {
    id: `task_reconcile_${Date.now()}`,
    type: 'reconcile',
    description: 'Reconcile invoices with payments',
    priority: 'normal',
    payload: {
      ...data,
      reconcile: true
    },
    createdAt: new Date()
  };

  const result = await agent.processTask(task, context);
  
  return {
    status: result.status,
    reconciled: result.data?.reconciled,
    unmatched: result.data?.unmatched,
    orphanPayments: result.data?.orphanPayments,
    executionTime: result.executionTime
  };
}

function formatOrchestratorResponse(result: any) {
  if (result.status === 'error') {
    return {
      status: 'error',
      message: result.message
    };
  }

  const response: any = {
    status: 'success',
    intent: result.intent,
    summary: generateSummary(result)
  };

  // Add detailed results if available
  if (result.results && result.results.length > 0) {
    response.tasks = result.results.map((taskResult: any) => ({
      status: taskResult.status,
      executionTime: taskResult.executionTime,
      data: taskResult.data
    }));
  }

  return response;
}

function generateSummary(result: any): string {
  const { intent, results } = result;
  
  if (!intent) return 'Request processed successfully';

  const successCount = results?.filter((r: any) => r.status === 'success').length || 0;
  const totalCount = results?.length || 0;

  switch (intent.action) {
    case 'generate_invoice':
      return `Invoice generated successfully (${successCount}/${totalCount} tasks completed)`;
    case 'send_invoice':
      return `Invoices sent successfully (${successCount}/${totalCount} tasks completed)`;
    case 'follow_up_overdue':
      return `Overdue reminders sent (${successCount}/${totalCount} tasks completed)`;
    case 'track_payment':
      return `Payment tracking completed (${successCount}/${totalCount} tasks completed)`;
    case 'reconcile_accounts':
      return `Account reconciliation completed (${successCount}/${totalCount} tasks completed)`;
    case 'month_end_close':
      return `Month-end close process completed (${successCount}/${totalCount} tasks completed)`;
    default:
      return `${intent.action} completed (${successCount}/${totalCount} tasks completed)`;
  }
}
