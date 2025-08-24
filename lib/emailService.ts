import FormData from 'form-data';
import Mailgun from 'mailgun.js';

const mailgun = new Mailgun(FormData);

export interface EmailConfig {
  apiKey: string;
  domain: string;
  from: string;
}

export interface EmailMessage {
  to: string | string[];
  subject: string;
  text?: string;
  html?: string;
}

export class EmailService {
  private client: any;
  private domain: string;
  private from: string;

  constructor(config: EmailConfig) {
    this.client = mailgun.client({
      username: 'api',
      key: config.apiKey,
    });
    this.domain = config.domain;
    this.from = config.from;
  }

  async sendEmail(message: EmailMessage): Promise<any> {
    try {
      const messageData = {
        from: this.from,
        to: Array.isArray(message.to) ? message.to : [message.to],
        subject: message.subject,
        text: message.text,
        html: message.html,
      };

      const result = await this.client.messages.create(this.domain, messageData);
      return {
        success: true,
        messageId: result.id,
        message: `Email sent successfully to ${messageData.to.join(', ')}`,
      };
    } catch (error: any) {
      console.error('Failed to send email:', error);
      return {
        success: false,
        error: error.message || 'Failed to send email',
      };
    }
  }

  async sendInvoiceReminder(
    recipientEmail: string,
    recipientName: string,
    invoiceNumber: string,
    amountDue: number,
    dueDate: string
  ): Promise<any> {
    const subject = `Invoice Reminder: #${invoiceNumber} - Payment Due`;
    
    const text = `Dear ${recipientName},

This is a friendly reminder that invoice #${invoiceNumber} with an amount of $${amountDue.toFixed(2)} is due on ${dueDate}.

Please ensure payment is made by the due date to avoid any late fees.

If you have already made the payment, please disregard this message.

Thank you for your prompt attention to this matter.

Best regards,
Accounts Receivable`;

    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #333;">Invoice Payment Reminder</h2>
        <p>Dear ${recipientName},</p>
        <p>This is a friendly reminder that the following invoice requires your attention:</p>
        <div style="background-color: #f5f5f5; padding: 15px; border-radius: 5px; margin: 20px 0;">
          <p><strong>Invoice Number:</strong> #${invoiceNumber}</p>
          <p><strong>Amount Due:</strong> $${amountDue.toFixed(2)}</p>
          <p><strong>Due Date:</strong> ${dueDate}</p>
        </div>
        <p>Please ensure payment is made by the due date to avoid any late fees.</p>
        <p style="color: #666; font-style: italic;">If you have already made the payment, please disregard this message.</p>
        <p>Thank you for your prompt attention to this matter.</p>
        <p>Best regards,<br>Accounts Receivable</p>
      </div>
    `;

    return this.sendEmail({
      to: recipientEmail,
      subject,
      text,
      html,
    });
  }

  async sendBulkInvoiceReminders(
    recipients: Array<{
      email: string;
      name: string;
      invoiceNumber: string;
      amountDue: number;
      dueDate: string;
    }>
  ): Promise<any> {
    const results = [];
    
    for (const recipient of recipients) {
      const result = await this.sendInvoiceReminder(
        recipient.email,
        recipient.name,
        recipient.invoiceNumber,
        recipient.amountDue,
        recipient.dueDate
      );
      results.push({
        recipient: recipient.email,
        ...result,
      });
    }

    return {
      success: true,
      totalSent: results.filter(r => r.success).length,
      totalFailed: results.filter(r => !r.success).length,
      results,
    };
  }
}

// Initialize with environment variables or config
let emailService: EmailService | null = null;

export function initEmailService(config: EmailConfig) {
  emailService = new EmailService(config);
  return emailService;
}

export function getEmailService(): EmailService | null {
  return emailService;
}