# OpenAI Agents Integration Guide

## Overview

Excel Pilot now includes OpenAI's Agents SDK for advanced, autonomous AI capabilities. The agents automatically handle complex accounting and financial tasks through natural conversation in the chat window.

## How It Works

### Automatic Agent Activation

The chat automatically detects when to use OpenAI agents based on your request. Simply type naturally in the chat window - no special commands needed.

**Agent triggers include:**
- Invoice operations (generate, send, track)
- Payment management (tracking, reminders, reconciliation)
- Financial reporting and analysis
- Accounting tasks (bookkeeping, month-end close)
- Budget planning and forecasting

### Agent Architecture

```
User Message → Triage Agent → Specialized Agent → Tools → Response
                     ↓
          Routes to appropriate agent:
          • Data Analysis Agent
          • Invoice Management Agent  
          • Accounting Agent
          • Financial Planning Agent
```

## Usage Examples

### 1. Invoice Generation

**Simple Invoice:**
```
"Generate an invoice for Acme Corp for $5,000 in consulting services"
```

The Invoice Agent will:
- Create a professional invoice
- Calculate totals and taxes
- Generate a PDF
- Provide the invoice number

**Bulk Invoicing:**
```
"Generate invoices for all customers with unbilled items from January"
```

The agent will:
- Query your data for unbilled items
- Group by customer
- Generate multiple invoices
- Optionally send them automatically

### 2. Payment Tracking

**Check Payment Status:**
```
"Which invoices are still unpaid?"
```

**Send Reminders:**
```
"Send payment reminders for invoices overdue by more than 30 days"
```

The agent will:
- Identify overdue invoices
- Determine appropriate reminder level
- Send personalized reminders
- Track communication history

### 3. Financial Analysis

**Data Queries:**
```
"Show me revenue trends for the last 6 months"
"What are our top 5 expense categories?"
"Calculate our average collection period"
```

The Data Analysis Agent will:
- Generate appropriate SQL queries
- Analyze results
- Provide insights and visualizations
- Suggest follow-up analyses

### 4. Accounting Operations

**Reconciliation:**
```
"Reconcile January invoices with payments received"
```

**Month-End Close:**
```
"Run the month-end close process for January"
```

The Accounting Agent will:
- Match transactions
- Identify discrepancies
- Generate journal entries
- Produce financial reports

### 5. Complex Multi-Step Tasks

**Example:**
```
"Generate January invoices, send them to customers, and create an aging report"
```

The Triage Agent coordinates multiple specialized agents to:
1. Generate all pending invoices (Invoice Agent)
2. Send emails with attachments (Invoice Agent)
3. Create aging report (Accounting Agent)
4. Present consolidated results

## Available Tools

Each agent has access to specialized tools:

### Data Analysis Agent Tools
- `query_database` - Execute SQL queries on your data
- `analyze_data` - Provide insights from query results
- `generate_report` - Create formatted reports

### Invoice Management Agent Tools
- `generate_invoice` - Create single invoices
- `bulk_invoice` - Generate multiple invoices
- `track_payments` - Monitor payment status
- `send_reminders` - Send overdue notices

### Accounting Agent Tools
- `reconcile_accounts` - Match invoices with payments
- `generate_report` - Create financial statements
- `query_database` - Access financial data

### Financial Planning Agent Tools
- `query_database` - Analyze historical data
- `analyze_data` - Identify trends and patterns
- `generate_report` - Create forecasts and budgets

## Advanced Features

### Context Awareness

Agents understand context from:
- Your uploaded data (CSV/Excel files)
- Previous conversation history
- Available table schemas
- Business rules and patterns

### Intelligent Handoffs

When tasks require multiple specializations, agents automatically hand off to each other:

```
User: "Analyze last month's revenue and generate invoices for unbilled items"
→ Triage Agent identifies two tasks
→ Hands off to Data Analysis Agent for revenue analysis
→ Then to Invoice Agent for invoice generation
→ Coordinates and presents combined results
```

### Learning and Adaptation

Agents improve over time by:
- Learning from successful patterns
- Adapting to your business processes
- Remembering preferences
- Optimizing execution paths

## Configuration

### Enable/Disable Agents

In your chat request, you can control agent usage:

```javascript
// Always use agents (default)
{ useAgents: true }

// Disable agents for this request
{ useAgents: false }
```

### Streaming Responses

For real-time responses, enable streaming:

```javascript
const response = await fetch('/api/openai-agents', {
  method: 'POST',
  body: JSON.stringify({
    message: 'Your request',
    datasetId: 'your-dataset',
    streaming: true
  })
});
```

## Tips for Best Results

### 1. Be Specific
```
Good: "Generate an invoice for Acme Corp for January consulting services totaling $5,000"
Better: "Generate an invoice for Acme Corp (billing@acme.com) for 40 hours of consulting at $125/hour, due in 30 days"
```

### 2. Provide Context
```
Good: "Show me unpaid invoices"
Better: "Show me unpaid invoices from Q1 2024 sorted by amount"
```

### 3. Chain Operations
```
"First show me customers with overdue invoices, then send appropriate reminders based on how overdue they are"
```

### 4. Use Natural Language
The agents understand natural, conversational language:
```
"Can you help me figure out why our cash flow was negative last month?"
"I need to invoice all my January consulting clients"
"Let's reconcile the books for year-end"
```

## Common Workflows

### Weekly Invoice Run
```
"Generate and send invoices for all completed work this week"
```

### Monthly Financial Review
```
"Show me this month's P&L, identify any unusual expenses, and forecast next month's cash flow"
```

### Overdue Collections
```
"List all invoices overdue by more than 30 days, send reminders, and create a collections report"
```

### Quarter-End Close
```
"Run the quarter-end close: reconcile all accounts, generate financial statements, and identify any discrepancies"
```

## Troubleshooting

### Agent Not Activating
- Check if your message contains agent trigger words
- Ensure `useAgents` is not set to false
- Verify OpenAI API key is configured

### Slow Response
- Complex tasks may take longer
- Consider breaking into smaller requests
- Enable streaming for real-time feedback

### Incorrect Results
- Provide more specific context
- Verify your data is properly formatted
- Check table schemas are correct

## API Reference

### Chat API with Agents
```typescript
POST /api/chat
{
  datasetId: string,
  message: string,
  tableSchemas?: TableSchema[],
  useAgents?: boolean  // Default: true
}
```

### Direct Agent API
```typescript
POST /api/openai-agents
{
  message: string,
  datasetId: string,
  tableSchemas?: TableSchema[],
  streaming?: boolean  // Default: false
}
```

## Security

- All agent operations are logged
- Sensitive data is never sent to external services
- SQL queries are validated before execution
- Role-based access control is enforced

## Coming Soon

- Custom agent creation
- Scheduled agent tasks
- Multi-user collaboration
- Advanced workflow automation
- Integration with more accounting systems

## Support

For issues or questions:
1. Check agent suggestions in chat
2. Review this documentation
3. Check the execution logs
4. Report issues on GitHub

The OpenAI agents make Excel Pilot a powerful, autonomous financial assistant that can handle complex accounting tasks through simple conversation.