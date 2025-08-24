# Invoice Agent - Usage Guide

## Overview

The Invoice Agent is a fully autonomous AI agent integrated into Excel Pilot that handles all invoice-related operations. It can generate invoices, send them via email, track payments, follow up on overdue accounts, and reconcile with accounting systems.

## How to Use the Invoice Agent

### 1. Through Natural Language Chat

Simply type invoice-related requests in the chat panel. The system automatically detects and routes these to the Invoice Agent:

#### Examples:
```
"Generate an invoice for Acme Corporation for consulting services"
"Send invoices to all customers with unbilled items from last month"
"Follow up on all overdue invoices"
"Track payment status for recent invoices"
"Reconcile invoices with payments from this month"
"Run the month-end invoice process"
```

The agent will:
- Understand your intent
- Break down complex tasks into steps
- Execute autonomously
- Report back with results

### 2. Through the Invoice Agent Panel

Add the `InvoiceAgentPanel` component to your app:

```tsx
import { InvoiceAgentPanel } from '@/components/agents/InvoiceAgentPanel';

// In your component
<InvoiceAgentPanel 
  datasetId={currentDatasetId}
  onAgentAction={(action, result) => {
    console.log('Agent completed:', action, result);
  }}
/>
```

The panel provides tabs for:
- **Generate**: Create single invoices with custom items
- **Bulk**: Generate multiple invoices at once
- **Track**: Monitor payment status
- **Follow Up**: Send automated reminders

### 3. Through Direct API Calls

For programmatic access:

```typescript
// Generate a single invoice
const response = await fetch('/api/agents', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    action: 'generate_invoice',
    data: {
      customerInfo: {
        name: 'Acme Corporation',
        email: 'billing@acme.com'
      },
      items: [
        { description: 'Consulting', quantity: 10, unitPrice: 150 }
      ]
    }
  })
});

// Natural language request
const response = await fetch('/api/agents', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    naturalLanguage: 'Generate and send all monthly invoices'
  })
});
```

## Agent Capabilities

### 1. Invoice Generation
- Single invoice creation with customizable templates
- Bulk generation for multiple customers
- Automatic calculation of totals, taxes, and discounts
- PDF generation with professional formatting

### 2. Invoice Delivery
- Email invoices with PDF attachments
- Customizable email templates
- Bulk sending with progress tracking
- Delivery status monitoring

### 3. Payment Tracking
- Real-time payment status checks
- Integration with payment gateways
- Automatic status updates
- Payment history tracking

### 4. Overdue Management
- Automated follow-up reminders
- Escalating reminder levels:
  - 7 days: Friendly reminder
  - 30 days: Firm reminder
  - 60 days: Final notice
- Customizable reminder templates

### 5. Reconciliation
- Match invoices with payments
- Identify unmatched transactions
- QuickBooks integration
- Automated journal entries

### 6. Learning & Optimization
- Pattern recognition from successful operations
- Performance optimization over time
- Learns customer preferences
- Adapts to your business processes

## Integration with Your Data

The Invoice Agent can work with data from:
1. **Uploaded Files**: CSV/Excel files with customer and transaction data
2. **Database Tables**: Direct access to invoice and customer tables
3. **External Systems**: QuickBooks, payment gateways, CRM systems

### Example Workflow

1. **Upload your data**:
   - Customer list (CSV/Excel)
   - Billable items or services
   - Previous invoice history

2. **Use natural language**:
   ```
   "Generate invoices for all customers with unbilled consulting hours from January"
   ```

3. **Agent automatically**:
   - Queries your data for unbilled items
   - Groups by customer
   - Generates invoices with proper formatting
   - Sends emails with PDF attachments
   - Updates tracking database
   - Reports completion status

4. **Follow-up actions**:
   ```
   "Check which invoices have been paid"
   "Send reminders for invoices overdue by more than 2 weeks"
   "Reconcile all January payments with QuickBooks"
   ```

## Advanced Features

### Workflow Automation

The agent supports complex workflows:

```typescript
// Monthly invoice workflow
"Every month on the 1st:
1. Generate invoices for all active customers
2. Send them via email
3. Update QuickBooks
4. Schedule follow-ups for Net 30 terms"
```

### Smart Suggestions

Based on your data and patterns, the agent suggests:
- Optimal invoice timing
- Customers needing follow-up
- Payment trends and risks
- Process improvements

### Memory & Learning

The agent remembers:
- Customer preferences (templates, terms)
- Successful patterns
- Common issues and solutions
- Your business rules

## Monitoring & Metrics

Track agent performance:
- Success rate
- Average execution time
- Invoices processed
- Payments collected
- Time saved

Access metrics via:
```typescript
const metrics = await fetch('/api/agents', {
  method: 'POST',
  body: JSON.stringify({ action: 'get_metrics' })
});
```

## Security & Permissions

The agent operates with:
- Role-based access control
- Audit logging of all actions
- Secure data handling
- Encrypted communications

## Troubleshooting

### Common Issues:

1. **"Agent not responding"**
   - Check API endpoint is running
   - Verify agent initialization
   - Check error logs

2. **"Invoice generation failed"**
   - Ensure customer data is complete
   - Verify email addresses
   - Check template availability

3. **"Emails not sending"**
   - Verify email service configuration
   - Check recipient email validity
   - Review email queue status

## Getting Help

For questions or issues:
1. Check agent suggestions in chat
2. Review execution logs
3. Use `get_agent_status` action
4. Contact support with trace ID

## Next Steps

1. **Customize Templates**: Add your branding to invoice templates
2. **Configure Integrations**: Connect QuickBooks, Stripe, etc.
3. **Set Up Automation**: Create scheduled workflows
4. **Train the Agent**: Provide feedback to improve accuracy

The Invoice Agent continuously learns and improves, becoming more efficient at handling your specific business needs over time.