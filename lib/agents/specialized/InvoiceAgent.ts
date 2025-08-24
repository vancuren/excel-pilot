import { BaseAgent } from '../core/BaseAgent';
import {
  AgentCapability,
  Task,
  TaskResult,
  ExecutionContext,
  AgentMessage,
  AgentMemory,
  AgentConfig,
  Tool
} from '../core/types';

export interface InvoiceData {
  id?: string;
  customerInfo: {
    id: string;
    name: string;
    email: string;
    address?: string;
    phone?: string;
  };
  items: InvoiceItem[];
  metadata?: {
    poNumber?: string;
    terms?: string;
    notes?: string;
    dueDate?: Date;
    invoiceDate?: Date;
  };
  status?: 'draft' | 'sent' | 'viewed' | 'paid' | 'overdue' | 'cancelled';
  total?: number;
  tax?: number;
  discount?: number;
}

export interface InvoiceItem {
  description: string;
  quantity: number;
  unitPrice: number;
  total?: number;
  taxRate?: number;
}

export interface BulkInvoiceRequest {
  template: string;
  customers: string[];
  dateRange?: {
    start: Date;
    end: Date;
  };
  itemFilter?: any;
  autoSend?: boolean;
}

export class InvoiceAgent extends BaseAgent {
  private invoiceTemplates: Map<string, any> = new Map();
  private processingQueue: Task[] = [];
  private batchSize = 10;

  get name(): string {
    return 'InvoiceAgent';
  }

  get capabilities(): AgentCapability[] {
    return [
      {
        name: 'generate_invoice',
        description: 'Generate a single invoice from data',
        requiredTools: ['template_engine', 'pdf_generator'],
        inputSchema: {
          type: 'object',
          properties: {
            customerData: { type: 'object' },
            items: { type: 'array' },
            template: { type: 'string' }
          }
        }
      },
      {
        name: 'bulk_generate',
        description: 'Generate multiple invoices in batch',
        requiredTools: ['template_engine', 'pdf_generator', 'database'],
        inputSchema: {
          type: 'object',
          properties: {
            customers: { type: 'array' },
            template: { type: 'string' },
            dateRange: { type: 'object' }
          }
        }
      },
      {
        name: 'send_invoices',
        description: 'Send invoices via email',
        requiredTools: ['email_service', 'pdf_generator'],
        inputSchema: {
          type: 'object',
          properties: {
            invoiceIds: { type: 'array' },
            emailTemplate: { type: 'string' }
          }
        }
      },
      {
        name: 'track_payments',
        description: 'Track invoice payment status',
        requiredTools: ['database', 'payment_gateway'],
        inputSchema: {
          type: 'object',
          properties: {
            invoiceIds: { type: 'array' }
          }
        }
      },
      {
        name: 'follow_up',
        description: 'Send payment reminders for overdue invoices',
        requiredTools: ['email_service', 'database'],
        inputSchema: {
          type: 'object',
          properties: {
            daysOverdue: { type: 'number' },
            reminderTemplate: { type: 'string' }
          }
        }
      },
      {
        name: 'reconcile',
        description: 'Reconcile invoices with payments',
        requiredTools: ['database', 'payment_gateway', 'quickbooks'],
        inputSchema: {
          type: 'object',
          properties: {
            dateRange: { type: 'object' }
          }
        }
      }
    ];
  }

  protected initialize(): void {
    this.loadTemplates();
    this.setupTools();
    this.initializePatternRecognition();
  }

  private loadTemplates(): void {
    // Load default invoice templates
    this.invoiceTemplates.set('standard', {
      name: 'Standard Invoice',
      sections: ['header', 'customer', 'items', 'totals', 'footer']
    });
    
    this.invoiceTemplates.set('professional', {
      name: 'Professional Invoice',
      sections: ['logo', 'header', 'customer', 'items', 'totals', 'terms', 'footer']
    });

    this.invoiceTemplates.set('simple', {
      name: 'Simple Invoice',
      sections: ['header', 'customer', 'items', 'totals']
    });
  }

  private setupTools(): void {
    // These tools would be injected in a real implementation
    // For now, we'll create mock implementations
    
    this.registerTool({
      name: 'template_engine',
      description: 'Render invoice templates',
      execute: async (params) => this.renderTemplate(params)
    });

    this.registerTool({
      name: 'pdf_generator',
      description: 'Generate PDF from HTML',
      execute: async (params) => this.generatePDF(params)
    });

    this.registerTool({
      name: 'email_service',
      description: 'Send emails',
      execute: async (params) => this.sendEmail(params)
    });

    this.registerTool({
      name: 'database',
      description: 'Database operations',
      execute: async (params) => this.databaseOperation(params)
    });
  }

  private initializePatternRecognition(): void {
    // Set up pattern recognition for common invoice scenarios
    this.on('pattern-detected', async (pattern) => {
      await this.handlePattern(pattern);
    });
  }

  async execute(task: Task, context: ExecutionContext): Promise<TaskResult> {
    const startTime = Date.now();
    
    try {
      // Analyze task intent
      const intent = await this.analyzeIntent(task);
      
      // Check if we can use learned patterns
      const pattern = await this.findPattern(intent);
      if (pattern && pattern.confidence > 0.8) {
        this.log('info', `Using learned pattern for ${intent.action}`);
        return await this.executePattern(pattern, task, context);
      }

      // Execute based on intent
      let result: any;
      switch (intent.action) {
        case 'generate_single':
          result = await this.generateSingleInvoice(task.payload, context);
          break;
          
        case 'generate_bulk':
          result = await this.generateBulkInvoices(task.payload, context);
          break;
          
        case 'send':
          result = await this.sendInvoices(task.payload, context);
          break;
          
        case 'track':
          result = await this.trackPayments(task.payload, context);
          break;
          
        case 'follow_up':
          result = await this.followUpOverdue(task.payload, context);
          break;
          
        case 'reconcile':
          result = await this.reconcileInvoices(task.payload, context);
          break;
          
        default:
          throw new Error(`Unknown action: ${intent.action}`);
      }

      // Store successful execution for learning
      const taskResult: TaskResult = {
        taskId: task.id,
        status: 'success',
        data: result,
        executionTime: Date.now() - startTime,
        toolsUsed: this.getUsedTools(),
        confidence: intent.confidence
      };

      // Learn from this execution
      await this.learn(task, taskResult);

      return taskResult;

    } catch (error) {
      this.log('error', `Task execution failed: ${task.id}`, error);
      
      return {
        taskId: task.id,
        status: 'failure',
        error: error as Error,
        executionTime: Date.now() - startTime,
        toolsUsed: this.getUsedTools(),
        suggestions: await this.generateSuggestions(error as Error)
      };
    }
  }

  private async analyzeIntent(task: Task): Promise<any> {
    // Analyze task to determine the specific action needed
    const payload = task.payload;
    
    if (payload.customers && payload.customers.length > 1) {
      return { action: 'generate_bulk', confidence: 0.95 };
    } else if (payload.invoiceIds && payload.send) {
      return { action: 'send', confidence: 0.9 };
    } else if (payload.trackPayments) {
      return { action: 'track', confidence: 0.9 };
    } else if (payload.overdueCheck) {
      return { action: 'follow_up', confidence: 0.85 };
    } else if (payload.reconcile) {
      return { action: 'reconcile', confidence: 0.9 };
    } else {
      return { action: 'generate_single', confidence: 0.8 };
    }
  }

  private async generateSingleInvoice(
    data: InvoiceData,
    context: ExecutionContext
  ): Promise<any> {
    // Generate invoice number
    const invoiceNumber = await this.generateInvoiceNumber(context.organizationId);
    
    // Prepare invoice data
    const invoiceData = {
      ...data,
      id: invoiceNumber,
      metadata: {
        ...data.metadata,
        invoiceDate: data.metadata?.invoiceDate || new Date(),
        dueDate: data.metadata?.dueDate || this.calculateDueDate(data.metadata?.terms)
      },
      total: this.calculateTotal(data.items, data.tax, data.discount)
    };

    // Render template
    const html = await this.callTool('template_engine', {
      template: 'standard',
      data: invoiceData
    });

    // Generate PDF
    const pdf = await this.callTool('pdf_generator', {
      html,
      options: { format: 'A4' }
    });

    // Store invoice
    await this.callTool('database', {
      operation: 'insert',
      table: 'invoices',
      data: invoiceData,
      datasetId: context.metadata?.datasetId
    });

    // Store in memory for quick access
    await this.remember(`invoice_${invoiceNumber}`, invoiceData, 86400000); // 24 hours

    return {
      invoiceNumber,
      pdf,
      data: invoiceData
    };
  }

  private async generateBulkInvoices(
    request: BulkInvoiceRequest,
    context: ExecutionContext
  ): Promise<any> {
    // Resolve target customers
    let targetCustomers = request.customers || [];
    if (!targetCustomers.length || targetCustomers.some(c => String(c).toUpperCase().includes('ALL'))) {
      try {
        const allCustomers = await this.callTool('database', {
          operation: 'select',
          table: 'customers',
          datasetId: context.metadata?.datasetId
        });
        targetCustomers = (allCustomers || []).map((c: any) => c.id).filter(Boolean);
      } catch {
        targetCustomers = [];
      }
    }

    const results = [];
    const batches = this.createBatches(targetCustomers, this.batchSize);

    for (const batch of batches) {
      const batchResults = await Promise.all(
        batch.map(async (customerId) => {
          try {
            // Fetch customer data
            const customerData = await this.fetchCustomerData(customerId, context);
            
            // Fetch billable items
            const items = await this.fetchBillableItems(customerId, request.dateRange, context);
            
            if (items.length === 0) {
              this.log('info', `No billable items for customer ${customerId}`);
              return null;
            }

            // Generate invoice
            const invoice = await this.generateSingleInvoice(
              {
                customerInfo: customerData,
                items,
                metadata: {
                  terms: customerData.terms || 'Net 30'
                }
              },
              context
            );

            // Auto-send if requested
            if (request.autoSend) {
              await this.sendInvoices({
                invoiceIds: [invoice.invoiceNumber],
                emailTemplate: 'standard'
              }, context);
            }

            return invoice;
          } catch (error) {
            this.log('error', `Failed to generate invoice for customer ${customerId}`, error);
            return { error, customerId };
          }
        })
      );

      results.push(...batchResults.filter(r => r !== null));
      
      // Update progress
      this.emit('progress', {
        completed: results.length,
        total: request.customers.length
      });
    }

    return {
      generated: results.filter(r => !r.error).length,
      failed: results.filter(r => r?.error).length,
      invoices: results
    };
  }

  private async sendInvoices(
    payload: { invoiceIds: string[], emailTemplate: string },
    context: ExecutionContext
  ): Promise<any> {
    const results = [];

    for (const invoiceId of payload.invoiceIds) {
      try {
        // Fetch invoice data
        const invoice = await this.recall(`invoice_${invoiceId}`) ||
                       await this.callTool('database', {
                         operation: 'select',
                         table: 'invoices',
                         where: { id: invoiceId },
                         datasetId: context.metadata?.datasetId
                       });

        if (!invoice) {
          throw new Error(`Invoice not found: ${invoiceId}`);
        }

        // Send email
        const emailResult = await this.callTool('email_service', {
          to: invoice.customerInfo.email,
          subject: `Invoice ${invoiceId} from ${context.organizationId}`,
          template: payload.emailTemplate,
          data: invoice,
          attachments: [{
            filename: `invoice_${invoiceId}.pdf`,
            content: invoice.pdf
          }]
        });

        // Update invoice status
        await this.callTool('database', {
          operation: 'update',
          table: 'invoices',
          where: { id: invoiceId },
          data: { status: 'sent', sentAt: new Date() },
          datasetId: context.metadata?.datasetId
        });

        results.push({
          invoiceId,
          status: 'sent',
          emailId: emailResult.messageId
        });

      } catch (error) {
        this.log('error', `Failed to send invoice ${invoiceId}`, error);
        results.push({
          invoiceId,
          status: 'failed',
          error: error.message
        });
      }
    }

    return {
      sent: results.filter(r => r.status === 'sent').length,
      failed: results.filter(r => r.status === 'failed').length,
      results
    };
  }

  private async trackPayments(
    payload: { invoiceIds: string[] },
    context: ExecutionContext
  ): Promise<any> {
    const results = [];

    for (const invoiceId of payload.invoiceIds) {
      // Check payment gateway
      const paymentStatus = await this.callTool('payment_gateway', {
        action: 'check_status',
        invoiceId
      });

      // Update database
      if (paymentStatus.paid) {
        await this.callTool('database', {
          operation: 'update',
          table: 'invoices',
          where: { id: invoiceId },
          data: {
            status: 'paid',
            paidAt: paymentStatus.paidAt,
            paymentMethod: paymentStatus.method
          },
          datasetId: context.metadata?.datasetId
        });
      }

      results.push({
        invoiceId,
        status: paymentStatus.paid ? 'paid' : 'unpaid',
        ...paymentStatus
      });
    }

    return results;
  }

  private async followUpOverdue(
    payload: { daysOverdue: number, reminderTemplate: string },
    context: ExecutionContext
  ): Promise<any> {
    // Fetch overdue invoices
    const overdueInvoices = await this.callTool('database', {
      operation: 'select',
      table: 'invoices',
      where: {
        status: ['sent', 'viewed'],
        dueDate: { $lt: new Date(Date.now() - payload.daysOverdue * 86400000) }
      },
      datasetId: context.metadata?.datasetId
    });

    const results = [];

    for (const invoice of overdueInvoices) {
      // Check payment one more time
      const paymentCheck = await this.trackPayments({
        invoiceIds: [invoice.id]
      }, context);

      if (paymentCheck[0].status === 'paid') {
        continue; // Skip if paid
      }

      // Determine reminder level based on days overdue
      const daysOverdue = Math.floor((Date.now() - invoice.dueDate) / 86400000);
      const reminderLevel = this.determineReminderLevel(daysOverdue);

      // Send reminder
      const reminderResult = await this.callTool('email_service', {
        to: invoice.customerInfo.email,
        subject: `${reminderLevel.prefix} Payment Reminder - Invoice ${invoice.id}`,
        template: reminderLevel.template || payload.reminderTemplate,
        data: {
          ...invoice,
          daysOverdue,
          reminderLevel: reminderLevel.level
        }
      });

      // Log reminder
      await this.callTool('database', {
        operation: 'insert',
        table: 'reminders',
        data: {
          invoiceId: invoice.id,
          reminderLevel: reminderLevel.level,
          sentAt: new Date(),
          emailId: reminderResult.messageId
        },
        datasetId: context.metadata?.datasetId
      });

      results.push({
        invoiceId: invoice.id,
        reminderLevel: reminderLevel.level,
        sent: true
      });
    }

    return {
      remindersSet: results.length,
      results
    };
  }

  private async reconcileInvoices(
    payload: { dateRange: { start: Date, end: Date } },
    context: ExecutionContext
  ): Promise<any> {
    // Fetch invoices in date range
    const invoices = await this.callTool('database', {
      operation: 'select',
      table: 'invoices',
      where: {
        createdAt: {
          $gte: payload.dateRange.start,
          $lte: payload.dateRange.end
        }
      }
    });

    // Fetch payments from payment gateway
    const payments = await this.callTool('payment_gateway', {
      action: 'list_payments',
      dateRange: payload.dateRange
    });

    // Match invoices with payments
    const reconciled = [];
    const unmatched = [];

    for (const invoice of invoices) {
      const payment = payments.find(p => 
        p.reference === invoice.id || 
        (p.amount === invoice.total && 
         Math.abs(new Date(p.date) - invoice.dueDate) < 7 * 86400000)
      );

      if (payment) {
        reconciled.push({
          invoice,
          payment,
          matched: true
        });

        // Update QuickBooks
        await this.callTool('quickbooks', {
          action: 'create_payment',
          data: {
            invoiceId: invoice.id,
            amount: payment.amount,
            date: payment.date,
            method: payment.method
          }
        });
      } else if (invoice.status === 'paid') {
        unmatched.push({
          invoice,
          issue: 'marked_paid_no_payment'
        });
      }
    }

    // Find orphan payments
    const orphanPayments = payments.filter(p =>
      !reconciled.find(r => r.payment.id === p.id)
    );

    return {
      reconciled: reconciled.length,
      unmatched: unmatched.length,
      orphanPayments: orphanPayments.length,
      details: {
        reconciled,
        unmatched,
        orphanPayments
      }
    };
  }

  async validate(input: any): Promise<boolean> {
    // Validate input based on the action
    if (input.customerInfo && !input.customerInfo.email) {
      this.log('warn', 'Customer email is required');
      return false;
    }

    if (input.items && input.items.length === 0) {
      this.log('warn', 'At least one item is required');
      return false;
    }

    return true;
  }

  protected async handleRequest(message: AgentMessage): Promise<void> {
    // Handle requests from other agents
    const { action, data } = message.payload;

    switch (action) {
      case 'generate_invoice':
        const result = await this.execute({
          id: this.generateId(),
          type: 'invoice_generation',
          description: 'Generate invoice requested by ' + message.from,
          priority: message.priority,
          payload: data,
          createdAt: new Date()
        }, message.payload.context);

        await this.sendMessage(message.from, {
          type: 'response',
          replyTo: message.id,
          payload: {
            action: 'invoice_generated',
            data: result,
            context: message.payload.context
          }
        });
        break;

      default:
        this.log('warn', `Unknown request action: ${action}`);
    }
  }

  protected async handleResponse(message: AgentMessage): Promise<void> {
    // Handle responses from other agents
    this.log('info', `Received response from ${message.from}`);
  }

  protected async handleEvent(message: AgentMessage): Promise<void> {
    // Handle events from other agents
    const { action, data } = message.payload;

    if (action === 'customer_updated') {
      // Invalidate cached customer data
      await this.memory.longTerm.set(`customer_${data.customerId}`, null);
    }
  }

  protected async handleError(message: AgentMessage): Promise<void> {
    // Handle errors from other agents
    this.log('error', `Error from ${message.from}: ${message.payload.data}`);
  }

  protected async applyCorrections(taskId: string, corrections: any): Promise<void> {
    // Apply corrections from feedback
    const task = await this.recall(`task_${taskId}`);
    if (task && corrections.template) {
      // Update template preference
      await this.remember(`preferred_template_${task.payload.customerId}`, corrections.template);
    }
  }

  protected async shutdown(): Promise<void> {
    // Clean up resources
    this.processingQueue = [];
    this.invoiceTemplates.clear();
  }

  // Helper methods
  private async generateInvoiceNumber(organizationId: string): Promise<string> {
    const counter = await this.callTool('database', {
      operation: 'increment',
      key: `invoice_counter_${organizationId}`
    });
    
    const date = new Date();
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    
    return `INV-${year}${month}-${String(counter).padStart(5, '0')}`;
  }

  private calculateDueDate(terms?: string): Date {
    const daysMap: Record<string, number> = {
      'Net 15': 15,
      'Net 30': 30,
      'Net 45': 45,
      'Net 60': 60,
      'Due on Receipt': 0
    };

    const days = daysMap[terms || 'Net 30'] || 30;
    return new Date(Date.now() + days * 86400000);
  }

  private calculateTotal(items: InvoiceItem[], tax?: number, discount?: number): number {
    const subtotal = items.reduce((sum, item) => {
      const itemTotal = item.quantity * item.unitPrice;
      return sum + itemTotal;
    }, 0);

    const taxAmount = tax ? subtotal * (tax / 100) : 0;
    const discountAmount = discount ? subtotal * (discount / 100) : 0;

    return subtotal + taxAmount - discountAmount;
  }

  private createBatches<T>(items: T[], batchSize: number): T[][] {
    const batches: T[][] = [];
    for (let i = 0; i < items.length; i += batchSize) {
      batches.push(items.slice(i, i + batchSize));
    }
    return batches;
  }

  private determineReminderLevel(daysOverdue: number): any {
    if (daysOverdue <= 7) {
      return {
        level: 1,
        prefix: 'Friendly',
        template: 'friendly_reminder'
      };
    } else if (daysOverdue <= 30) {
      return {
        level: 2,
        prefix: 'Important',
        template: 'firm_reminder'
      };
    } else if (daysOverdue <= 60) {
      return {
        level: 3,
        prefix: 'Urgent',
        template: 'urgent_reminder'
      };
    } else {
      return {
        level: 4,
        prefix: 'Final Notice',
        template: 'final_notice'
      };
    }
  }

  private async fetchCustomerData(customerId: string, context: ExecutionContext): Promise<any> {
    // Check cache first
    const cached = await this.recall(`customer_${customerId}`);
    if (cached) return cached;

    // Fetch from database
    const customer = await this.callTool('database', {
      operation: 'select',
      table: 'customers',
      where: { id: customerId },
      datasetId: context.metadata?.datasetId
    });

    // Cache for future use
    await this.remember(`customer_${customerId}`, customer, 3600000); // 1 hour

    return customer;
  }

  private async fetchBillableItems(customerId: string, dateRange: any | undefined, context: ExecutionContext): Promise<InvoiceItem[]> {
    return await this.callTool('database', {
      operation: 'select',
      table: 'billable_items',
      where: {
        customerId,
        billed: false,
        ...(dateRange && {
          date: {
            $gte: dateRange.start,
            $lte: dateRange.end
          }
        })
      },
      datasetId: context.metadata?.datasetId
    });
  }

  private async findPattern(intent: any): Promise<any> {
    const patterns = await this.memory.longTerm.search(`pattern_${intent.action}`, 5);
    if (patterns.length > 0) {
      // Return the most confident pattern
      return patterns.reduce((best, current) => 
        current.confidence > best.confidence ? current : best
      );
    }
    return null;
  }

  private async executePattern(pattern: any, task: Task, context: ExecutionContext): Promise<TaskResult> {
    // Execute using learned pattern
    const startTime = Date.now();
    const toolResults = [];

    for (const toolName of pattern.toolsUsed) {
      const tool = this.tools.get(toolName);
      if (tool) {
        const result = await this.callTool(toolName, task.payload);
        toolResults.push(result);
      }
    }

    return {
      taskId: task.id,
      status: 'success',
      data: toolResults,
      executionTime: Date.now() - startTime,
      toolsUsed: pattern.toolsUsed,
      confidence: pattern.confidence
    };
  }

  private async handlePattern(pattern: any): Promise<void> {
    // Store detected pattern for future use
    await this.memory.semantic.addRelation(
      pattern.trigger,
      'leads_to',
      pattern.outcome
    );
  }

  private getUsedTools(): string[] {
    // This would track actual tool usage during execution
    return Array.from(this.tools.keys());
  }

  private async generateSuggestions(error: Error): Promise<string[]> {
    const suggestions: string[] = [];

    if (error.message.includes('email')) {
      suggestions.push('Check customer email address is valid');
      suggestions.push('Verify email service configuration');
    }

    if (error.message.includes('template')) {
      suggestions.push('Verify template exists and is properly formatted');
      suggestions.push('Check template data requirements');
    }

    if (error.message.includes('database')) {
      suggestions.push('Check database connection');
      suggestions.push('Verify required fields are present');
    }

    return suggestions;
  }

  // Tool implementations (these would be real integrations in production)
  private async renderTemplate(params: any): Promise<string> {
    // Mock template rendering
    return `<html><body>Invoice HTML</body></html>`;
  }

  private async generatePDF(params: any): Promise<Buffer> {
    // Mock PDF generation
    return Buffer.from('PDF content');
  }

  private async sendEmail(params: any): Promise<any> {
    // Mock email sending
    return { messageId: `msg_${Date.now()}`, status: 'sent' };
  }

  private async databaseOperation(params: any): Promise<any> {
    // Mock database operation
    return { success: true, data: params.data };
  }
}
