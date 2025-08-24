import { NextRequest, NextResponse } from 'next/server';
import { OrchestratorAgent } from '@/lib/agents/core/OrchestratorAgent';
import { InvoiceAgent } from '@/lib/agents/specialized/InvoiceAgent';
import { InMemoryAgentMemory } from '@/lib/agents/core/AgentMemory';
import { createInvoiceTools } from '@/lib/agents/tools/InvoiceTools';

// Simple singleton to reuse agents across requests
let agentSystem: {
  orchestrator: OrchestratorAgent;
  invoiceAgent: InvoiceAgent;
} | null = null;

function getAgentSystem() {
  if (agentSystem) return agentSystem;

  const memory = new InMemoryAgentMemory();
  const invoiceAgent = new InvoiceAgent({
    id: 'invoice_agent',
    name: 'Invoice Agent',
    description: 'Autonomous agent for invoice operations',
    version: '1.0.0',
    capabilities: [],
    tools: ['template_engine', 'pdf_generator', 'email_service', 'database', 'payment_gateway', 'quickbooks'],
    memory: { shortTermSize: 100, longTermTTL: 86400000, learningEnabled: true },
    monitoring: { metricsEnabled: true, loggingLevel: 'info' }
  }, memory);
  const orchestrator = new OrchestratorAgent();
  const tools = createInvoiceTools();
  invoiceAgent.registerTool(tools.templateEngine);
  invoiceAgent.registerTool(tools.pdfGenerator);
  invoiceAgent.registerTool(tools.emailService);
  invoiceAgent.registerTool(tools.database);
  invoiceAgent.registerTool(tools.paymentGateway);
  invoiceAgent.registerTool(tools.quickbooks);
  orchestrator.registerAgent(invoiceAgent);
  invoiceAgent.start();

  agentSystem = { orchestrator, invoiceAgent };
  return agentSystem;
}

export async function POST(request: NextRequest) {
  try {
    const { naturalLanguage, datasetId, userId = 'user_default', organizationId = 'org_default' } = await request.json();
    if (!naturalLanguage) {
      return NextResponse.json({ error: 'Missing naturalLanguage' }, { status: 400 });
    }

    const { orchestrator, invoiceAgent } = getAgentSystem();

    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      start(controller) {
        const send = (data: any) => controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
        const end = () => { controller.enqueue(encoder.encode('data: [DONE]\n\n')); controller.close(); };

        // Wire agent events
        const statusHandler = (payload: any) => send({ type: 'status', ...payload });
        const progressHandler = (payload: any) => send({ type: 'progress', ...payload });
        const completedHandler = (result: any) => send({ type: 'task_completed', result });
        const failedHandler = (result: any) => send({ type: 'task_failed', result });

        const abortSignal = request.signal;
        if (abortSignal) {
          abortSignal.addEventListener('abort', () => {
            controller.close();
          });
        }

        invoiceAgent.on('status-changed', statusHandler);
        invoiceAgent.on('progress', progressHandler);
        invoiceAgent.on('task-completed', completedHandler);
        invoiceAgent.on('task-failed', failedHandler);

        // Kick off processing
        (async () => {
          try {
            send({ type: 'start', message: 'Processing your request...' });
            const context = {
              userId,
              organizationId,
              sessionId: `session_${Date.now()}`,
              permissions: [
                { resource: 'invoices', actions: ['create', 'read', 'update', 'delete'] },
                { resource: 'payments', actions: ['read', 'track'] },
                { resource: 'communications', actions: ['send'] }
              ],
              metadata: { datasetId },
              traceId: `trace_${Date.now()}`
            };
            const result = await orchestrator.processUserRequest(naturalLanguage, context);
            send({ type: 'summary', result });
            end();
          } catch (err: any) {
            send({ type: 'error', message: err?.message || 'Execution error' });
            end();
          } finally {
            invoiceAgent.off('status-changed', statusHandler);
            invoiceAgent.off('progress', progressHandler);
            invoiceAgent.off('task-completed', completedHandler);
            invoiceAgent.off('task-failed', failedHandler);
          }
        })();
      }
    });

    return new NextResponse(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive'
      }
    });
  } catch (error) {
    console.error('Agent stream error:', error);
    return NextResponse.json({ error: 'Agent stream failed' }, { status: 500 });
  }
}

