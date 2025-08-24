import Anthropic from '@anthropic-ai/sdk';
import { sendEmail } from './llm-tools';

// Initialize Anthropic client
const anthropic = process.env.ANTHROPIC_API_KEY 
  ? new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY,
    })
  : null;

// Define available tools for the LLM
const tools: Anthropic.Tool[] = [
  {
    name: 'send_email',
    description: 'Send an email to one or more recipients with invoice reminders, payment notifications, or reports',
    input_schema: {
      type: 'object',
      properties: {
        to: {
          type: 'array',
          items: { type: 'string' },
          description: 'Email addresses of recipients'
        },
        subject: {
          type: 'string',
          description: 'Email subject line'
        },
        message: {
          type: 'string',
          description: 'Email body message'
        },
        data: {
          type: 'array',
          items: { type: 'object' },
          description: 'Optional data to include in the email as a table'
        }
      },
      required: ['to', 'subject', 'message']
    }
  },
  {
    name: 'execute_sql',
    description: 'Execute a SQL query against the database',
    input_schema: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'SQL query to execute'
        },
        explanation: {
          type: 'string',
          description: 'Explanation of what the query does'
        }
      },
      required: ['query']
    }
  },
  {
    name: 'generate_report',
    description: 'Generate a formatted report (PDF, Excel, or HTML) from data',
    input_schema: {
      type: 'object',
      properties: {
        title: {
          type: 'string',
          description: 'Report title'
        },
        format: {
          type: 'string',
          enum: ['pdf', 'excel', 'html'],
          description: 'Output format for the report'
        },
        data: {
          type: 'array',
          items: { type: 'object' },
          description: 'Data to include in the report'
        }
      },
      required: ['title', 'format', 'data']
    }
  }
];

export interface LLMResponse {
  content: string;
  toolCalls?: Array<{
    name: string;
    input: any;
  }>;
  shouldExecuteTools: boolean;
}

/**
 * Process user message with tool-enabled LLM
 */
export async function processWithTools(
  message: string,
  tableSchemas: any[],
  queryResults?: any[]
): Promise<LLMResponse> {
  if (!anthropic) {
    return {
      content: 'LLM is not configured. Please add your Anthropic API key.',
      shouldExecuteTools: false
    };
  }

  try {
    // Build context about available data
    const schemaContext = tableSchemas.map(s => 
      `Table: ${s.tableName}\nColumns: ${s.columns.map((c: any) => `${c.name} (${c.type})`).join(', ')}`
    ).join('\n\n');

    const dataContext = queryResults && queryResults.length > 0
      ? `\nCurrent query results: ${queryResults.length} rows\nSample: ${JSON.stringify(queryResults[0], null, 2)}`
      : '';

    const systemPrompt = `You are an AI assistant helping users analyze financial data and perform actions like sending emails, generating reports, and executing SQL queries.

Available database schema:
${schemaContext}
${dataContext}

When users ask to:
- Send emails/invoices/reminders: Use the send_email tool
- Query data: Use the execute_sql tool
- Generate reports: Use the generate_report tool

Analyze the user's intent and use the appropriate tools to help them.`;

    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 2000,
      temperature: 0.3,
      system: systemPrompt,
      messages: [
        {
          role: 'user',
          content: message
        }
      ],
      tools: tools,
      tool_choice: { type: 'auto' }
    });

    // Process the response
    let finalContent = '';
    const toolCalls: Array<{ name: string; input: any }> = [];
    
    for (const block of response.content) {
      if (block.type === 'text') {
        finalContent += block.text;
      } else if (block.type === 'tool_use') {
        toolCalls.push({
          name: block.name,
          input: block.input
        });
      }
    }

    return {
      content: finalContent,
      toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
      shouldExecuteTools: toolCalls.length > 0
    };

  } catch (error) {
    console.error('LLM with tools error:', error);
    return {
      content: 'Failed to process your request. Please try again.',
      shouldExecuteTools: false
    };
  }
}

/**
 * Execute tool calls made by the LLM
 */
export async function executeToolCalls(
  toolCalls: Array<{ name: string; input: any }>
): Promise<Array<{ tool: string; result: any }>> {
  const results = [];

  for (const call of toolCalls) {
    try {
      let result;
      
      // Check if the tool input has an error
      if (call.input?.error) {
        results.push({
          tool: call.name,
          result: {
            success: false,
            error: call.input.error
          }
        });
        continue;
      }
      
      switch (call.name) {
        case 'send_email':
          // Check if we have email configuration
          const hasMailgunConfig = process.env.MAILGUN_API_KEY && process.env.MAILGUN_DOMAIN;
          
          if (!hasMailgunConfig) {
            result = {
              success: false,
              error: 'Email service not configured. Please add Mailgun credentials to your environment variables.'
            };
          } else {
            result = await sendEmail({
              to: call.input.to,
              subject: call.input.subject,
              message: call.input.message,
              data: call.input.data
            });
          }
          break;

        case 'execute_sql':
          // Return SQL for client-side execution
          result = {
            success: true,
            type: 'sql_query',
            query: call.input.query,
            explanation: call.input.explanation || 'Executing SQL query',
            shouldExecuteClient: true
          };
          break;

        case 'generate_report':
          // Use the existing generate report functionality
          const { generateReport } = await import('./llm-tools');
          result = await generateReport({
            title: call.input.title,
            format: call.input.format,
            data: call.input.data,
            analysis: '',
            userQuery: ''
          });
          break;

        default:
          result = {
            success: false,
            error: `Unknown tool: ${call.name}`
          };
      }

      results.push({
        tool: call.name,
        result
      });
    } catch (error) {
      results.push({
        tool: call.name,
        result: {
          success: false,
          error: error instanceof Error ? error.message : 'Tool execution failed'
        }
      });
    }
  }

  return results;
}