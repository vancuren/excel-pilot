import { NextRequest, NextResponse } from 'next/server';
import { initEmailService, getEmailService } from '@/lib/emailService';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { to, subject, text, html, config } = body;

    // Initialize email service if config is provided
    let emailService = getEmailService();
    if (config) {
      emailService = initEmailService(config);
    }

    if (!emailService) {
      // Use environment variables as fallback
      const apiKey = process.env.MAILGUN_API_KEY;
      const domain = process.env.MAILGUN_DOMAIN;
      const from = process.env.MAILGUN_FROM || 'noreply@example.com';

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

    const result = await emailService.sendEmail({
      to,
      subject,
      text,
      html,
    });

    if (result.success) {
      return NextResponse.json(result, { status: 200 });
    } else {
      return NextResponse.json(result, { status: 500 });
    }
  } catch (error) {
    console.error('Email API error:', error);
    return NextResponse.json(
      { error: 'Failed to send email', details: error },
      { status: 500 }
    );
  }
}