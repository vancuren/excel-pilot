# LLM Integration Setup

## Overview
Excel Pilot now supports AI-powered natural language queries using Claude (Anthropic) or OpenAI. The system can:
- Convert natural language questions to SQL queries
- Analyze query results and provide insights
- Generate financial recommendations
- Maintain conversation context

## Setup Instructions

### 1. Get an API Key

#### For Claude (Recommended):
1. Go to https://console.anthropic.com/
2. Sign up or log in
3. Navigate to API Keys
4. Create a new API key
5. Copy the key (starts with `sk-ant-`)

#### For OpenAI (Alternative):
1. Go to https://platform.openai.com/
2. Sign up or log in
3. Navigate to API Keys
4. Create a new API key
5. Copy the key (starts with `sk-`)

### 2. Configure Environment Variables

1. Copy the example environment file:
```bash
cp .env.local.example .env.local
```

2. Edit `.env.local` and add your API key:
```env
ANTHROPIC_API_KEY=sk-ant-your-key-here
```

3. Restart the development server:
```bash
npm run dev
```

## Features

### With LLM Integration:
- **Natural Language Queries**: Ask questions in plain English
  - "Show me all overdue invoices"
  - "What's the total amount by vendor?"
  - "Find the top 10 largest transactions"
  
- **Intelligent Analysis**: Get insights and recommendations
  - Pattern detection
  - Anomaly identification
  - Trend analysis
  
- **Context Awareness**: Multi-turn conversations
  - Follow-up questions
  - Refinement of queries
  - Reference to previous results

### Without LLM (Fallback Mode):
If no API key is configured, the system falls back to pattern matching:
- Basic keyword detection
- Pre-defined query templates
- Simple data aggregations

## Example Queries

### Financial Analysis:
- "Show me overdue vendors with amounts over $5000"
- "Calculate the average invoice amount by month"
- "Which vendors have the highest outstanding balance?"
- "Group transactions by category and show totals"

### Data Exploration:
- "Summarize this dataset"
- "Show me the data schema"
- "Find duplicate entries"
- "What date range does this data cover?"

### Reporting:
- "Create an aging report"
- "Show payment trends over time"
- "List all transactions from last quarter"
- "Compare this month to last month"

## How It Works

1. **Query Generation**: Your natural language question is converted to SQL
2. **Execution**: The SQL runs against your local DuckDB database
3. **Analysis**: Results are analyzed by the LLM for insights
4. **Response**: You get both data and narrative explanations

## Privacy & Security

- **Local Processing**: All data stays in your browser
- **No Data Transmission**: Only the schema (column names and types) is sent to the LLM
- **Query Only**: The LLM generates queries but never sees your actual data
- **Optional**: LLM integration is optional; the app works without it

## Troubleshooting

### "LLM not available" message:
- Check that your API key is correctly set in `.env.local`
- Ensure the server was restarted after adding the key
- Verify the API key is valid and has credits

### Queries failing:
- Check that your data is properly loaded
- Ensure table names don't have special characters
- Try simpler queries first

### Slow responses:
- Complex queries may take a few seconds
- Large datasets might need optimization
- Consider adding indexes for frequently queried columns

## Cost Considerations

### Claude (Anthropic):
- Haiku model: ~$0.25 per million input tokens
- Typical query: 500-1000 tokens
- Estimated cost: <$0.001 per query

### OpenAI:
- GPT-3.5: ~$0.50 per million input tokens
- GPT-4: ~$10 per million input tokens
- Similar token usage as Claude

## Advanced Configuration

### Custom Model Selection:
Edit `lib/llm.ts` to change the model:
```typescript
// For Claude Sonnet (more capable):
model: 'claude-3-sonnet-20240229'

// For OpenAI GPT-4:
model: 'gpt-4-turbo-preview'
```

### Adjust Temperature:
Lower = more deterministic (0.0)
Higher = more creative (1.0)
Default: 0.3 for analysis, 0.0 for SQL generation

### Context Window:
Default keeps last 10 messages
Adjust in `app/api/chat/route.ts`:
```typescript
if (context.length > 20) { // Increase to 20
  context.splice(0, context.length - 20);
}
```