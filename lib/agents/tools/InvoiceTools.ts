import { Tool } from '../core/types';
import * as fs from 'fs/promises';
import * as path from 'path';

// Template Engine Tool
export class TemplateEngineTool implements Tool {
  name = 'template_engine';
  description = 'Render invoice templates with data';
  
  private templates: Map<string, string> = new Map();

  constructor() {
    this.loadDefaultTemplates();
  }

  private loadDefaultTemplates(): void {
    // Standard Invoice Template
    this.templates.set('standard', `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; margin: 40px; }
          .header { border-bottom: 2px solid #333; padding-bottom: 20px; margin-bottom: 20px; }
          .invoice-title { font-size: 28px; font-weight: bold; }
          .invoice-number { color: #666; margin-top: 10px; }
          .section { margin: 20px 0; }
          .customer-info { background: #f5f5f5; padding: 15px; border-radius: 5px; }
          .items-table { width: 100%; border-collapse: collapse; margin: 20px 0; }
          .items-table th { background: #333; color: white; padding: 10px; text-align: left; }
          .items-table td { padding: 10px; border-bottom: 1px solid #ddd; }
          .totals { text-align: right; margin-top: 20px; }
          .total-row { font-size: 18px; font-weight: bold; margin-top: 10px; }
          .footer { margin-top: 40px; padding-top: 20px; border-top: 1px solid #ddd; color: #666; font-size: 12px; }
        </style>
      </head>
      <body>
        <div class="header">
          <div class="invoice-title">INVOICE</div>
          <div class="invoice-number">Invoice #: {{invoiceNumber}}</div>
          <div>Date: {{invoiceDate}}</div>
          <div>Due Date: {{dueDate}}</div>
        </div>
        
        <div class="section customer-info">
          <h3>Bill To:</h3>
          <div>{{customerName}}</div>
          <div>{{customerEmail}}</div>
          {{#if customerAddress}}<div>{{customerAddress}}</div>{{/if}}
          {{#if customerPhone}}<div>{{customerPhone}}</div>{{/if}}
        </div>
        
        <div class="section">
          <table class="items-table">
            <thead>
              <tr>
                <th>Description</th>
                <th>Quantity</th>
                <th>Unit Price</th>
                <th>Total</th>
              </tr>
            </thead>
            <tbody>
              {{#each items}}
              <tr>
                <td>{{description}}</td>
                <td>{{quantity}}</td>
                <td>${{unitPrice}}</td>
                <td>${{total}}</td>
              </tr>
              {{/each}}
            </tbody>
          </table>
        </div>
        
        <div class="totals">
          <div>Subtotal: ${{subtotal}}</div>
          {{#if tax}}<div>Tax ({{taxRate}}%): ${{tax}}</div>{{/if}}
          {{#if discount}}<div>Discount: -${{discount}}</div>{{/if}}
          <div class="total-row">Total: ${{total}}</div>
        </div>
        
        {{#if notes}}
        <div class="section">
          <h3>Notes:</h3>
          <p>{{notes}}</p>
        </div>
        {{/if}}
        
        <div class="footer">
          <p>Payment Terms: {{terms}}</p>
          <p>Thank you for your business!</p>
        </div>
      </body>
      </html>
    `);

    // Professional Template
    this.templates.set('professional', `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: 'Helvetica Neue', Arial, sans-serif; margin: 0; padding: 40px; background: white; }
          .container { max-width: 800px; margin: 0 auto; }
          .header { display: flex; justify-content: space-between; align-items: start; padding-bottom: 30px; border-bottom: 3px solid #2c3e50; }
          .logo { font-size: 32px; font-weight: 300; color: #2c3e50; }
          .invoice-details { text-align: right; }
          .invoice-number { font-size: 24px; color: #e74c3c; margin-bottom: 10px; }
          .date-info { color: #7f8c8d; }
          /* Additional professional styling */
        </style>
      </head>
      <body>
        <div class="container">
          <!-- Professional template content -->
        </div>
      </body>
      </html>
    `);
  }

  async execute(params: {
    template: string;
    data: any;
  }): Promise<string> {
    const template = this.templates.get(params.template);
    if (!template) {
      throw new Error(`Template not found: ${params.template}`);
    }

    // Simple template rendering (in production, use a proper template engine)
    let rendered = template;
    const data = this.prepareData(params.data);

    // Replace placeholders
    for (const [key, value] of Object.entries(data)) {
      const regex = new RegExp(`{{${key}}}`, 'g');
      rendered = rendered.replace(regex, String(value));
    }

    // Handle conditionals (simplified)
    rendered = rendered.replace(/{{#if (\w+)}}(.*?){{\/if}}/gs, (match, condition, content) => {
      return data[condition] ? content : '';
    });

    // Handle loops (simplified)
    rendered = rendered.replace(/{{#each (\w+)}}(.*?){{\/each}}/gs, (match, arrayName, itemTemplate) => {
      const items = data[arrayName];
      if (!Array.isArray(items)) return '';
      
      return items.map(item => {
        let itemHtml = itemTemplate;
        for (const [key, value] of Object.entries(item)) {
          itemHtml = itemHtml.replace(new RegExp(`{{${key}}}`, 'g'), String(value));
        }
        return itemHtml;
      }).join('');
    });

    return rendered;
  }

  private prepareData(data: any): any {
    // Format dates
    if (data.invoiceDate instanceof Date) {
      data.invoiceDate = data.invoiceDate.toLocaleDateString();
    }
    if (data.dueDate instanceof Date) {
      data.dueDate = data.dueDate.toLocaleDateString();
    }

    // Calculate totals
    if (data.items && Array.isArray(data.items)) {
      data.subtotal = data.items.reduce((sum: number, item: any) => {
        item.total = item.quantity * item.unitPrice;
        return sum + item.total;
      }, 0).toFixed(2);

      if (data.taxRate) {
        data.tax = (parseFloat(data.subtotal) * data.taxRate / 100).toFixed(2);
      }

      const subtotalWithTax = parseFloat(data.subtotal) + (parseFloat(data.tax) || 0);
      if (data.discountRate) {
        data.discount = (subtotalWithTax * data.discountRate / 100).toFixed(2);
      }

      data.total = (subtotalWithTax - (parseFloat(data.discount) || 0)).toFixed(2);
    }

    // Extract customer info
    if (data.customerInfo) {
      data.customerName = data.customerInfo.name;
      data.customerEmail = data.customerInfo.email;
      data.customerAddress = data.customerInfo.address;
      data.customerPhone = data.customerInfo.phone;
    }

    // Set defaults
    data.terms = data.terms || 'Net 30';
    data.invoiceNumber = data.id || data.invoiceNumber || 'DRAFT';

    return data;
  }

  validate(params: any): boolean {
    return params.template && params.data;
  }
}

// PDF Generator Tool
export class PDFGeneratorTool implements Tool {
  name = 'pdf_generator';
  description = 'Generate PDF from HTML content';
  cost = 0.01; // Cost per PDF generation

  async execute(params: {
    html: string;
    options?: {
      format?: string;
      margin?: string;
    };
  }): Promise<Buffer> {
    // In production, use puppeteer or similar for real PDF generation
    // For now, return a mock PDF buffer
    const mockPdfContent = `%PDF-1.4
1 0 obj
<< /Type /Catalog /Pages 2 0 R >>
endobj
2 0 obj
<< /Type /Pages /Kids [3 0 R] /Count 1 >>
endobj
3 0 obj
<< /Type /Page /Parent 2 0 R /Resources << /Font << /F1 << /Type /Font /Subtype /Type1 /BaseFont /Helvetica >> >> >> /MediaBox [0 0 612 792] /Contents 4 0 R >>
endobj
4 0 obj
<< /Length 44 >>
stream
BT
/F1 12 Tf
100 700 Td
(Invoice PDF) Tj
ET
endstream
endobj
xref
0 5
0000000000 65535 f
0000000009 00000 n
0000000058 00000 n
0000000115 00000 n
0000000274 00000 n
trailer
<< /Size 5 /Root 1 0 R >>
startxref
365
%%EOF`;

    return Buffer.from(mockPdfContent);
  }

  validate(params: any): boolean {
    return params.html && typeof params.html === 'string';
  }
}

// Email Service Tool
export class EmailServiceTool implements Tool {
  name = 'email_service';
  description = 'Send emails with attachments';
  cost = 0.002; // Cost per email

  private emailQueue: any[] = [];

  async execute(params: {
    to: string;
    subject: string;
    template?: string;
    html?: string;
    text?: string;
    data?: any;
    attachments?: Array<{
      filename: string;
      content: Buffer | string;
    }>;
  }): Promise<any> {
    // Validate email
    if (!this.isValidEmail(params.to)) {
      throw new Error(`Invalid email address: ${params.to}`);
    }

    // Prepare email content
    const emailContent = params.html || this.renderEmailTemplate(params.template, params.data) || params.text;

    const email = {
      messageId: `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      to: params.to,
      subject: params.subject,
      content: emailContent,
      attachments: params.attachments || [],
      sentAt: new Date(),
      status: 'queued'
    };

    // Queue email for sending
    this.emailQueue.push(email);

    // Simulate async sending
    setTimeout(() => {
      email.status = 'sent';
      console.log(`Email sent to ${params.to}: ${params.subject}`);
    }, 1000);

    return {
      messageId: email.messageId,
      status: 'queued',
      queuePosition: this.emailQueue.length
    };
  }

  private isValidEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  private renderEmailTemplate(template?: string, data?: any): string | null {
    if (!template) return null;

    const templates: Record<string, string> = {
      standard: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2>Invoice from {{organizationName}}</h2>
          <p>Dear {{customerName}},</p>
          <p>Please find attached your invoice #{{invoiceNumber}}.</p>
          <p>Amount Due: ${{total}}</p>
          <p>Due Date: {{dueDate}}</p>
          <p>Thank you for your business!</p>
        </div>
      `,
      friendly_reminder: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2>Friendly Payment Reminder</h2>
          <p>Hi {{customerName}},</p>
          <p>This is a friendly reminder that invoice #{{invoiceNumber}} is due for payment.</p>
          <p>Amount: ${{total}}</p>
          <p>Days Overdue: {{daysOverdue}}</p>
          <p>Please let us know if you have any questions!</p>
        </div>
      `,
      urgent_reminder: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; border: 2px solid #e74c3c; padding: 20px;">
          <h2 style="color: #e74c3c;">Urgent Payment Required</h2>
          <p>Dear {{customerName}},</p>
          <p><strong>Invoice #{{invoiceNumber}} is now {{daysOverdue}} days overdue.</strong></p>
          <p>Amount Due: ${{total}}</p>
          <p>Please arrange payment immediately to avoid service interruption.</p>
        </div>
      `
    };

    let html = templates[template] || '';
    
    if (data) {
      for (const [key, value] of Object.entries(data)) {
        html = html.replace(new RegExp(`{{${key}}}`, 'g'), String(value));
      }
    }

    return html;
  }

  validate(params: any): boolean {
    return params.to && params.subject && (params.html || params.text || params.template);
  }

  // Utility method to check email queue
  getQueueStatus(): any {
    return {
      queued: this.emailQueue.filter(e => e.status === 'queued').length,
      sent: this.emailQueue.filter(e => e.status === 'sent').length,
      total: this.emailQueue.length
    };
  }
}

// Database Tool
export class DatabaseTool implements Tool {
  name = 'database';
  description = 'Database operations for invoice data (persistent)';

  async execute(params: {
    operation: 'select' | 'insert' | 'update' | 'delete' | 'increment';
    table?: string;
    key?: string;
    data?: any;
    where?: any;
    datasetId?: string;
  }): Promise<any> {
    switch (params.operation) {
      case 'select':
        return await (await import('@/lib/serverStore')).select(params.table!, params.where, params.datasetId);
      case 'insert':
        return await (await import('@/lib/serverStore')).insert(params.table!, params.data, params.datasetId);
      case 'update':
        return await (await import('@/lib/serverStore')).update(params.table!, params.where, params.data, params.datasetId);
      case 'delete':
        return await (await import('@/lib/serverStore')).remove(params.table!, params.where, params.datasetId);
      case 'increment':
        return await (await import('@/lib/serverStore')).increment(params.key!);
      default:
        throw new Error(`Unknown operation: ${params.operation}`);
    }
  }

  validate(params: any): boolean {
    return params.operation && ['select', 'insert', 'update', 'delete', 'increment'].includes(params.operation);
  }
}

// Payment Gateway Tool (Mock)
export class PaymentGatewayTool implements Tool {
  name = 'payment_gateway';
  description = 'Check payment status and process payments';
  cost = 0.005;

  private payments: Map<string, any> = new Map();

  async execute(params: {
    action: 'check_status' | 'list_payments' | 'process_payment';
    invoiceId?: string;
    dateRange?: { start: Date; end: Date };
    amount?: number;
    method?: string;
  }): Promise<any> {
    switch (params.action) {
      case 'check_status':
        return this.checkStatus(params.invoiceId!);
      
      case 'list_payments':
        return this.listPayments(params.dateRange);
      
      case 'process_payment':
        return this.processPayment(params);
      
      default:
        throw new Error(`Unknown action: ${params.action}`);
    }
  }

  private checkStatus(invoiceId: string): any {
    const payment = this.payments.get(invoiceId);
    
    if (payment) {
      return {
        paid: true,
        paidAt: payment.paidAt,
        amount: payment.amount,
        method: payment.method,
        transactionId: payment.transactionId
      };
    }

    // Simulate random payment status for demo
    if (Math.random() > 0.7) {
      const mockPayment = {
        paid: true,
        paidAt: new Date(),
        amount: Math.floor(Math.random() * 10000),
        method: 'credit_card',
        transactionId: `txn_${Date.now()}`
      };
      this.payments.set(invoiceId, mockPayment);
      return mockPayment;
    }

    return {
      paid: false
    };
  }

  private listPayments(dateRange?: { start: Date; end: Date }): any[] {
    const allPayments = Array.from(this.payments.values());
    
    if (!dateRange) {
      return allPayments;
    }

    return allPayments.filter(p => 
      p.paidAt >= dateRange.start && p.paidAt <= dateRange.end
    );
  }

  private processPayment(params: any): any {
    const payment = {
      invoiceId: params.invoiceId,
      amount: params.amount,
      method: params.method || 'credit_card',
      paidAt: new Date(),
      transactionId: `txn_${Date.now()}`,
      status: 'success'
    };

    this.payments.set(params.invoiceId, payment);
    return payment;
  }

  validate(params: any): boolean {
    return params.action && ['check_status', 'list_payments', 'process_payment'].includes(params.action);
  }
}

// QuickBooks Integration Tool (Mock)
export class QuickBooksTool implements Tool {
  name = 'quickbooks';
  description = 'QuickBooks integration for accounting';
  cost = 0.01;

  private entries: any[] = [];

  async execute(params: {
    action: 'create_invoice' | 'create_payment' | 'create_journal_entry';
    data: any;
  }): Promise<any> {
    switch (params.action) {
      case 'create_invoice':
        return this.createInvoice(params.data);
      
      case 'create_payment':
        return this.createPayment(params.data);
      
      case 'create_journal_entry':
        return this.createJournalEntry(params.data);
      
      default:
        throw new Error(`Unknown action: ${params.action}`);
    }
  }

  private createInvoice(data: any): any {
    const qbInvoice = {
      id: `qb_inv_${Date.now()}`,
      invoiceNumber: data.invoiceId,
      customer: data.customerId,
      amount: data.amount,
      createdAt: new Date(),
      syncStatus: 'synced'
    };

    this.entries.push({ type: 'invoice', ...qbInvoice });
    return qbInvoice;
  }

  private createPayment(data: any): any {
    const qbPayment = {
      id: `qb_pmt_${Date.now()}`,
      invoiceId: data.invoiceId,
      amount: data.amount,
      date: data.date,
      method: data.method,
      createdAt: new Date(),
      syncStatus: 'synced'
    };

    this.entries.push({ type: 'payment', ...qbPayment });
    return qbPayment;
  }

  private createJournalEntry(data: any): any {
    const qbEntry = {
      id: `qb_je_${Date.now()}`,
      description: data.description,
      debits: data.debits,
      credits: data.credits,
      date: data.date || new Date(),
      createdAt: new Date(),
      syncStatus: 'synced'
    };

    this.entries.push({ type: 'journal_entry', ...qbEntry });
    return qbEntry;
  }

  validate(params: any): boolean {
    return params.action && params.data;
  }
}

// Export all tools
export const createInvoiceTools = () => {
  return {
    templateEngine: new TemplateEngineTool(),
    pdfGenerator: new PDFGeneratorTool(),
    emailService: new EmailServiceTool(),
    database: new DatabaseTool(),
    paymentGateway: new PaymentGatewayTool(),
    quickbooks: new QuickBooksTool()
  };
};
