import { NextRequest, NextResponse } from 'next/server';
import { initEmailService, getEmailService } from '@/lib/emailService';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { recipients, config } = body;

    // Initialize email service if config is provided
    let emailService = getEmailService();
    if (config) {
      emailService = initEmailService(config);
    }

    if (!emailService) {
      // Use environment variables as fallback
      const apiKey = process.env.MAILGUN_API_KEY;
      const domain = process.env.MAILGUN_DOMAIN;
      const from = process.env.MAILGUN_FROM || 'accounts@example.com';

      if (!apiKey || !domain) {
        return NextResponse.json(
          { 
            error: 'Email service not configured. Please provide Mailgun API credentials.',
            required: ['apiKey', 'domain', 'from']
          },
          { status: 400 }
        );
      }

      emailService = initEmailService({ apiKey, domain, from });
    }

    // Handle single recipient
    if (!Array.isArray(recipients)) {
      const { email, name, invoiceNumber, amountDue, dueDate } = recipients;
      
      const result = await emailService.sendInvoiceReminder(
        email,
        name,
        invoiceNumber,
        amountDue,
        dueDate
      );

      if (result.success) {
        return NextResponse.json(result, { status: 200 });
      } else {
        return NextResponse.json(result, { status: 500 });
      }
    }

    // Handle multiple recipients
    const result = await emailService.sendBulkInvoiceReminders(recipients);
    
    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    console.error('Invoice reminder API error:', error);
    return NextResponse.json(
      { error: 'Failed to send invoice reminders', details: error },
      { status: 500 }
    );
  }
}