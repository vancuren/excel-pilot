# Email Functionality Setup Guide

## Overview
Excel Pilot now includes email functionality that allows the AI to send emails automatically based on your data and queries. For example:
- "Email invoices to all clients with balance due this week"
- "Send payment reminders to overdue customers"
- "Notify Jane Doe about her outstanding invoice"

## Setup Instructions

### 1. Get Mailgun Credentials
1. Sign up for a free account at [Mailgun](https://www.mailgun.com)
2. Verify your domain or use the sandbox domain for testing
3. Get your API key from the Mailgun dashboard

### 2. Configure Environment Variables
Copy the email configuration to your `.env.local` file:

```bash
# Copy from the example file
cp .env.email.example .env.local

# Or add these lines to your existing .env.local:
MAILGUN_API_KEY=your-api-key-here
MAILGUN_DOMAIN=your-domain.mailgun.org
MAILGUN_FROM=noreply@yourdomain.com
```

### 3. Install Dependencies
The required packages should already be installed, but if not:
```bash
npm install mailgun.js form-data
```

## How It Works

### Natural Language Processing
The AI understands various email-related requests:
- **Invoice reminders**: "Email invoice reminders to all overdue accounts"
- **Payment notifications**: "Send payment confirmation to John Smith"
- **Reports**: "Email monthly sales report to management"
- **Custom messages**: "Send a thank you email to our top 10 customers"

### Automatic Data Extraction
When you request email sending, the system will:
1. Analyze your query to understand the intent
2. Execute the necessary SQL query to find recipients
3. Extract email addresses from your data
4. Generate appropriate email content
5. Send emails via Mailgun

### Email Templates
The system includes professional templates for:
- Invoice reminders
- Payment notifications
- Account statements
- Custom reports

## Example Queries

### Send Invoice Reminders
```
"Please email invoice reminders to all clients with invoices due this week"
```
The AI will:
- Find all invoices due within 7 days
- Extract client email addresses
- Send personalized reminders with invoice details

### Send to Specific Recipients
```
"Email Jane Doe at jane@example.com about her outstanding balance of $500"
```
The AI will:
- Create a personalized message
- Include the balance amount
- Send directly to the specified email

### Bulk Email with Data
```
"Send monthly statements to all active customers"
```
The AI will:
- Query for all active customers
- Generate statements with transaction data
- Send personalized emails to each customer

## Testing

### Using Sandbox Domain
For testing, Mailgun provides a sandbox domain:
1. Add authorized recipients in Mailgun dashboard
2. Use the sandbox domain in your configuration
3. Emails will only send to authorized addresses

### Production Setup
For production use:
1. Verify your own domain in Mailgun
2. Update DNS records as instructed
3. Change `MAILGUN_DOMAIN` to your verified domain
4. Remove sandbox restrictions

## Troubleshooting

### "Email service not configured"
- Check that your `.env.local` file contains the Mailgun variables
- Restart the development server after adding environment variables

### "Failed to send email"
- Verify your API key is correct
- Check that the domain is verified (or using sandbox correctly)
- Ensure recipient emails are valid

### No emails received
- Check Mailgun logs in their dashboard
- Verify recipient email addresses
- Check spam/junk folders
- For sandbox: ensure recipients are authorized

## Security Notes
- Never commit `.env.local` to version control
- Use environment variables for production deployments
- Rotate API keys regularly
- Monitor Mailgun usage to prevent abuse

## Advanced Features

### Custom Email Templates
You can customize email templates by modifying:
- `/lib/emailService.ts` - Email sending logic
- `/lib/llm-tools.ts` - Email content generation

### Adding New Email Types
To add new email types:
1. Update the email type enum in `/lib/llm-tools.ts`
2. Add template logic in `generateEmailContent()`
3. Update the intent analysis in `/lib/llm.ts`

### Rate Limiting
Mailgun has rate limits based on your plan:
- Free: 100 emails/hour
- Paid plans: Higher limits available

## Support
For issues or questions:
- Check Mailgun documentation
- Review the error messages in the browser console
- Check server logs for detailed error information