import { Agent, tool } from '@openai/agents';
import { z } from 'zod';
import type { TableSchema } from '@/lib/llm';

// Set API key for agents
if (typeof process !== 'undefined' && process.env?.OPENAI_API_KEY) {
  process.env.OPENAI_API_KEY = process.env.OPENAI_API_KEY;
}

// ==================== Database Query Tool ====================
const queryDatabaseTool = tool({
  name: 'query_database',
  description: 'Query the uploaded data using SQL. Use this to fetch, filter, analyze, or aggregate data.',
  parameters: z.object({ 
    query: z.string().describe('Natural language query or SQL statement'),
    datasetId: z.string().describe('Dataset identifier')
  }),
  execute: async ({ query, datasetId }) => {
    try {
      // Return the SQL query as-is if it looks like SQL
      const isSql = query.trim().toUpperCase().startsWith('SELECT') || 
                    query.trim().toUpperCase().startsWith('INSERT') ||
                    query.trim().toUpperCase().startsWith('UPDATE') ||
                    query.trim().toUpperCase().startsWith('DELETE');
      
      if (isSql) {
        return {
          success: true,
          sql: query,
          explanation: 'Executing your SQL query',
          suggestions: [],
          shouldExecuteClient: true,
          datasetId: datasetId
        };
      }
      
      // For natural language, we need to convert it to SQL
      // This is a simplified conversion - in production you'd use a proper NL to SQL service
      return {
        success: true,
        sql: `SELECT * FROM ${datasetId}_customers LIMIT 10`,
        explanation: 'Converted your natural language query to SQL',
        suggestions: ['Try adding WHERE clauses', 'Use specific column names'],
        shouldExecuteClient: true,
        datasetId: datasetId
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Query failed'
      };
    }
  },
});

// ==================== Data Analysis Tool ====================
const analyzeDataTool = tool({
  name: 'analyze_data',
  description: 'Analyze query results to provide insights, patterns, and recommendations.',
  parameters: z.object({
    query: z.string().describe('The original user question'),
    resultCount: z.number().describe('Number of results to analyze').default(0)
  }),
  execute: async ({ query, resultCount }) => {
    try {
      // Simulate analysis
      return {
        success: true,
        content: `Analyzed ${resultCount} results for query: ${query}`,
        suggestions: ['Try grouping by category', 'Add time-based filtering'],
        insights: ['Most activity occurs on weekdays', 'Revenue trending upward']
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Analysis failed'
      };
    }
  },
});

// ==================== Invoice Generation Tool ====================
const generateInvoiceTool = tool({
  name: 'generate_invoice',
  description: 'Generate professional invoices with customizable templates and automatic calculations.',
  parameters: z.object({
    customerInfo: z.object({
      name: z.string(),
      email: z.string().email(),
      address: z.string().default(''),
      phone: z.string().default('')
    }).describe('Customer billing information'),
    items: z.array(z.object({
      description: z.string(),
      quantity: z.number().positive(),
      unitPrice: z.number().positive(),
      taxRate: z.number().default(0)
    })).describe('Line items for the invoice'),
    metadata: z.object({
      template: z.enum(['standard', 'professional', 'simple']).default('standard'),
      terms: z.string().default('Net 30'),
      notes: z.string().default(''),
      dueDate: z.string().default('')
    }).default({
      template: 'standard',
      terms: 'Net 30',
      notes: '',
      dueDate: ''
    })
  }),
  execute: async (input) => {
    try {
      // Calculate invoice totals
      let subtotal = 0;
      let totalTax = 0;
      
      for (const item of input.items) {
        const lineTotal = item.quantity * item.unitPrice;
        const lineTax = lineTotal * (item.taxRate / 100);
        subtotal += lineTotal;
        totalTax += lineTax;
      }
      
      const total = subtotal + totalTax;
      const invoiceNumber = `INV-${Date.now()}`;
      
      // In a real implementation, this would save to a database
      return {
        success: true,
        invoiceNumber,
        subtotal: subtotal.toFixed(2),
        tax: totalTax.toFixed(2),
        total: total.toFixed(2),
        message: `Invoice ${invoiceNumber} generated successfully. Total: $${total.toFixed(2)}`,
        customerInfo: input.customerInfo,
        items: input.items,
        metadata: input.metadata
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to generate invoice'
      };
    }
  },
});

// ==================== Bulk Invoice Tool ====================
const bulkInvoiceTool = tool({
  name: 'bulk_invoice',
  description: 'Generate multiple invoices at once for different customers.',
  parameters: z.object({
    customers: z.array(z.string()).describe('List of customer IDs or names'),
    dateRange: z.object({
      start: z.string(),
      end: z.string()
    }).describe('Date range for billable items').default({
      start: '',
      end: ''
    }),
    autoSend: z.boolean().default(false).describe('Automatically send invoices after generation')
  }),
  execute: async (input) => {
    try {
      // Simulate bulk invoice generation
      const generated = input.customers.length;
      const failed = 0;
      
      const invoiceNumbers = input.customers.map(customer => 
        `INV-${customer.substring(0, 3).toUpperCase()}-${Date.now()}`
      );
      
      return {
        success: true,
        generated,
        failed,
        invoiceNumbers,
        message: `Generated ${generated} invoices successfully${failed > 0 ? `, ${failed} failed` : ''}`,
        dateRange: input.dateRange,
        autoSend: input.autoSend
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Bulk generation failed'
      };
    }
  },
});

// ==================== Payment Tracking Tool ====================
const trackPaymentsTool = tool({
  name: 'track_payments',
  description: 'Track payment status for invoices and identify overdue accounts.',
  parameters: z.object({
    invoiceIds: z.array(z.string()).describe('Specific invoice IDs to track').default([]),
    checkOverdue: z.boolean().default(false).describe('Check for overdue invoices')
  }),
  execute: async (input) => {
    try {
      // Simulate payment tracking
      const payments = input.invoiceIds.length > 0 
        ? input.invoiceIds.map(id => ({
            invoiceId: id,
            status: Math.random() > 0.5 ? 'paid' : 'pending',
            dueDate: new Date(Date.now() + Math.random() * 30 * 24 * 60 * 60 * 1000).toISOString(),
            amount: (Math.random() * 10000).toFixed(2)
          }))
        : [];
      
      const overdueCount = input.checkOverdue 
        ? payments.filter(p => p.status === 'pending' && new Date(p.dueDate) < new Date()).length
        : 0;
      
      return {
        success: true,
        payments,
        overdueCount,
        message: `Payment status retrieved successfully${overdueCount > 0 ? `. ${overdueCount} invoices are overdue.` : ''}`
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Payment tracking failed'
      };
    }
  },
});

// ==================== Follow-up Reminders Tool ====================
const sendRemindersTool = tool({
  name: 'send_reminders',
  description: 'Send payment reminders for overdue invoices with escalating levels.',
  parameters: z.object({
    daysOverdue: z.number().positive().describe('Minimum days overdue'),
    reminderLevel: z.enum(['friendly', 'firm', 'urgent', 'final']).default('friendly')
  }),
  execute: async (input) => {
    try {
      // Simulate sending reminders
      const remindersSet = Math.floor(Math.random() * 10) + 1;
      
      return {
        success: true,
        remindersSet,
        reminderLevel: input.reminderLevel,
        daysOverdue: input.daysOverdue,
        message: `Sent ${remindersSet} ${input.reminderLevel} payment reminders for invoices overdue by ${input.daysOverdue}+ days`
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to send reminders'
      };
    }
  },
});

// ==================== Reconciliation Tool ====================
const reconcileTool = tool({
  name: 'reconcile_accounts',
  description: 'Reconcile invoices with payments and identify discrepancies.',
  parameters: z.object({
    dateRange: z.object({
      start: z.string(),
      end: z.string()
    }).describe('Date range for reconciliation')
  }),
  execute: async (input) => {
    try {
      // Simulate reconciliation
      const reconciled = Math.floor(Math.random() * 50) + 10;
      const unmatched = Math.floor(Math.random() * 5);
      
      return {
        success: true,
        reconciled,
        unmatched,
        dateRange: input.dateRange,
        message: `Reconciled ${reconciled} transactions, ${unmatched} unmatched for period ${input.dateRange.start} to ${input.dateRange.end}`
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Reconciliation failed'
      };
    }
  },
});

// ==================== Export/Report Tool ====================
const generateReportTool = tool({
  name: 'generate_report',
  description: 'Generate financial reports and export data in various formats.',
  parameters: z.object({
    reportType: z.enum(['summary', 'detailed', 'aging', 'cashflow']),
    format: z.enum(['pdf', 'excel', 'csv']).default('pdf'),
    dateRange: z.object({
      start: z.string(),
      end: z.string()
    }).default({
      start: '',
      end: ''
    })
  }),
  execute: async (input) => {
    try {
      // Simulate report generation
      const reportId = `RPT-${Date.now()}`;
      
      return {
        success: true,
        reportId,
        reportType: input.reportType,
        format: input.format,
        dateRange: input.dateRange,
        message: `Generated ${input.reportType} report (${reportId}) in ${input.format} format`,
        downloadUrl: `/reports/${reportId}.${input.format}`
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Report generation failed'
      };
    }
  },
});

// ==================== SPECIALIZED AGENTS ====================

// Data Analysis Agent - Focuses on querying and analyzing data
export const dataAnalysisAgent = new Agent({
  name: 'Data Analysis Agent',
  model: 'gpt-4-turbo-preview',
  instructions: `You are a data analysis expert specializing in financial data.
Your role is to:
- Query and analyze uploaded data efficiently
- Identify patterns, trends, and anomalies
- Provide clear insights and visualizations
- Suggest follow-up analyses
- Calculate financial metrics and KPIs

Always be precise with numbers and provide context for your findings.`,
  tools: [queryDatabaseTool, analyzeDataTool, generateReportTool]
});

// Invoice Management Agent - Handles all invoice operations
export const invoiceAgent = new Agent({
  name: 'Invoice Management Agent',
  model: 'gpt-4-turbo-preview',
  instructions: `You are an invoice management specialist.
Your responsibilities include:
- Generating professional invoices with accurate calculations
- Managing bulk invoice operations efficiently
- Tracking payment status and identifying overdue accounts
- Sending appropriate payment reminders
- Ensuring proper invoice formatting and compliance

Always verify customer information and calculate totals accurately.`,
  tools: [generateInvoiceTool, bulkInvoiceTool, trackPaymentsTool, sendRemindersTool]
});

// Accounting Agent - Handles reconciliation and bookkeeping
export const accountingAgent = new Agent({
  name: 'Accounting Agent',
  model: 'gpt-4-turbo-preview',
  instructions: `You are an accounting and bookkeeping specialist.
Your tasks include:
- Reconciling accounts and identifying discrepancies
- Maintaining accurate financial records
- Generating financial reports
- Ensuring compliance with accounting standards
- Performing month-end close procedures

Focus on accuracy and maintaining proper audit trails.`,
  tools: [reconcileTool, generateReportTool, queryDatabaseTool]
});

// Financial Planning Agent - Provides strategic insights
export const financialPlanningAgent = new Agent({
  name: 'Financial Planning Agent',
  model: 'gpt-4-turbo-preview',
  instructions: `You are a financial planning and strategy expert.
Your role is to:
- Analyze financial trends and patterns
- Provide cash flow forecasts
- Identify cost-saving opportunities
- Suggest revenue optimization strategies
- Create budget plans and projections

Provide actionable recommendations backed by data.`,
  tools: [queryDatabaseTool, analyzeDataTool, generateReportTool]
});

// ==================== MASTER TRIAGE AGENT ====================
// This is the main entry point that routes requests to specialized agents

export const triageAgent = new Agent({
  name: 'Excel Pilot Assistant',
  model: 'gpt-4-turbo-preview',
  instructions: `You are Excel Pilot's main AI assistant, helping users with financial data analysis and accounting tasks.

Your role is to:
1. Understand the user's intent and use the appropriate tools
2. Handle data queries and analysis tasks
3. Manage invoice operations and accounting tasks

Capabilities:
- Query and analyze data using SQL
- Generate professional invoices
- Track payments and send reminders
- Reconcile accounts
- Generate financial reports

Always be helpful, accurate, and proactive in suggesting relevant follow-up actions.`,
  tools: [queryDatabaseTool, analyzeDataTool, generateInvoiceTool, bulkInvoiceTool, trackPaymentsTool, sendRemindersTool, reconcileTool, generateReportTool]
});

// ==================== AGENT EXECUTION UTILITIES ====================

export interface AgentContext {
  datasetId: string;
  tableSchemas?: TableSchema[];
  userId?: string;
  organizationId?: string;
}

export async function executeAgent(
  message: string,
  context: AgentContext,
  streaming: boolean = false
) {
  // This would be called from the chat interface
  // The actual execution would use the OpenAI agents SDK
  // For now, returning a placeholder structure
  
  return {
    agent: triageAgent,
    context,
    message,
    streaming
  };
}

// All agents are already exported above