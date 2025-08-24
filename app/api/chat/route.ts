import { NextRequest, NextResponse } from 'next/server';
import { naturalLanguageToSQL, analyzeDataWithLLM, isLLMAvailable } from '@/lib/llm';
import type { TableSchema } from '@/lib/llm';
import { run } from '@openai/agents';
import { triageAgent } from '@/lib/openai/agents';

// Store conversation context (in production, use a proper session store)
const conversationContext = new Map<string, any[]>();

// Check if we should use OpenAI agents for this request
function shouldUseOpenAIAgents(message: string): boolean {
  const agentTriggers = [
    'invoice', 'payment', 'reconcile', 'remind',
    'generate report', 'bulk', 'follow up',
    'track', 'overdue', 'accounting',
    'financial planning', 'forecast', 'budget'
  ];
  
  const lowerMessage = message.toLowerCase();
  return agentTriggers.some(trigger => lowerMessage.includes(trigger));
}

export async function POST(request: NextRequest) {
  try {
    const { datasetId, message, tableSchemas, queryResults, useAgents = true } = await request.json();
    
    if (!datasetId || !message) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }
    
    // Get or create conversation context
    const context = conversationContext.get(datasetId) || [];
    
    // Convert schemas to the format expected by LLM
    const schemas: TableSchema[] = tableSchemas || [];
    
    // Check if OpenAI agents should handle this request
    if (useAgents && shouldUseOpenAIAgents(message)) {
      try {
        // Enhance message with context
        const enhancedMessage = `
Dataset: ${datasetId}
Tables: ${schemas.map(s => s.tableName).join(', ')}

${message}`;

        // Execute with OpenAI agent
        const agentResult = await run(triageAgent, enhancedMessage);
        
        // Format the response for the chat interface
        const agentResponse = formatAgentResponse(agentResult);
        
        // Update conversation context
        context.push({
          role: 'user',
          content: message,
          timestamp: new Date().toISOString()
        });
        
        context.push({
          role: 'assistant',
          content: agentResponse.content,
          timestamp: new Date().toISOString(),
          agentUsed: true
        });
        
        // Keep only last 10 messages
        if (context.length > 10) {
          context.splice(0, context.length - 10);
        }
        
        conversationContext.set(datasetId, context);
        
        return NextResponse.json({
          messages: [{
            id: `msg_${Date.now()}`,
            role: 'assistant' as const,
            content: agentResponse.content,
            timestamp: new Date().toISOString(),
            toolSuggestions: agentResponse.suggestions || [],
            artifacts: agentResponse.artifacts || [],
            metadata: {
              agentUsed: true,
              ...agentResponse.metadata
            }
          }]
        });
      } catch (agentError) {
        console.error('OpenAI Agent error:', agentError);
        // Fall back to regular processing
      }
    }
    
    // If query results are provided (from client-side execution), analyze them
    if (queryResults) {
      const analysis = await analyzeDataWithLLM(message, queryResults, schemas);
      
      // Update conversation context
      context.push({
        role: 'user',
        content: message,
        timestamp: new Date().toISOString()
      });
      
      context.push({
        role: 'assistant',
        content: analysis.content,
        timestamp: new Date().toISOString()
      });
      
      // Keep only last 10 messages for context
      if (context.length > 10) {
        context.splice(0, context.length - 10);
      }
      
      conversationContext.set(datasetId, context);
      
      const response = {
        messages: [{
          id: `msg_${Date.now()}`,
          role: 'assistant' as const,
          content: analysis.content,
          timestamp: new Date().toISOString(),
          toolSuggestions: analysis.suggestions || [],
          artifacts: queryResults.length > 0 ? [{
            type: 'query_result',
            data: queryResults,
            rowCount: queryResults.length
          }] : [],
          metadata: {
            rowCount: queryResults.length,
            llmUsed: isLLMAvailable()
          }
        }]
      };
      
      return NextResponse.json(response);
    }
    
    // Generate SQL from natural language (no execution on server)
    const sqlResult = await naturalLanguageToSQL(message, schemas);
    
    if (sqlResult.query && !sqlResult.error) {
      // Validate SQL syntax before sending to client
      const cleanedQuery = sqlResult.query.trim();
      
      // Basic SQL validation
      if (!cleanedQuery.match(/^\s*(SELECT|WITH|INSERT|UPDATE|DELETE|CREATE|DROP|ALTER)/i)) {
        return NextResponse.json({
          error: 'Invalid SQL query generated. Please try rephrasing your question.'
        }, { status: 400 });
      }
      
      // Check for common SQL injection patterns (extra safety)
      if (cleanedQuery.includes('--') || cleanedQuery.includes('/*') || cleanedQuery.includes('*/')) {
        return NextResponse.json({
          error: 'Generated SQL contains potentially unsafe patterns. Please try a different question.'
        }, { status: 400 });
      }
      
      // Return the SQL query for client-side execution
      const response = {
        sql: cleanedQuery,
        explanation: sqlResult.explanation,
        suggestions: sqlResult.suggestions,
        shouldExecuteClient: true
      };
      
      return NextResponse.json(response);
    } else {
      // Fallback response if SQL generation failed
      const fallbackMessage = sqlResult.error || 
        `I'm having trouble understanding your question. Could you please rephrase it? 

Here are some examples of questions I can help with:
- Show me all overdue invoices
- What is the total amount by vendor?
- Find transactions from last month
- Show top 10 largest payments
- Calculate average invoice amount

I can analyze your data, create summaries, and help identify patterns.`;
      
      const response = {
        messages: [{
          id: `msg_${Date.now()}`,
          role: 'assistant' as const,
          content: fallbackMessage,
          timestamp: new Date().toISOString(),
          toolSuggestions: [],
          artifacts: []
        }]
      };
      
      return NextResponse.json(response);
    }
    
  } catch (error) {
    console.error('Chat error:', error);
    return NextResponse.json({ 
      error: 'Chat processing failed',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

// Format OpenAI agent response for chat interface
function formatAgentResponse(result: any) {
  const response: any = {
    content: '',
    suggestions: [],
    artifacts: [],
    metadata: {}
  };

  // Extract content from various possible formats
  if (typeof result === 'string') {
    response.content = result;
  } else if (result && typeof result === 'object') {
    // Handle structured response
    if (result.content) {
      response.content = result.content;
    } else if (result.message) {
      response.content = result.message;
    } else if (result.text) {
      response.content = result.text;
    } else if (result.finalOutput) {
      response.content = result.finalOutput;
    } else {
      // Try to extract meaningful content
      response.content = JSON.stringify(result, null, 2);
    }

    // Extract tool execution results
    if (result.toolCalls || result.tool_calls) {
      const toolCalls = result.toolCalls || result.tool_calls;
      response.artifacts.push({
        type: 'tool_execution',
        tools: toolCalls
      });
      
      // Add tool-specific formatting
      toolCalls.forEach((call: any) => {
        const toolName = call.function?.name || call.name;
        if (toolName === 'generate_invoice' && call.result?.invoiceNumber) {
          response.content += `\n\n📄 Invoice ${call.result.invoiceNumber} generated successfully.`;
        } else if (toolName === 'track_payments' && call.result?.payments) {
          response.content += `\n\n💰 Tracked ${call.result.payments.length} payments.`;
        }
      });
    }

    // Generate contextual suggestions
    response.suggestions = generateContextualSuggestions(result);
    
    // Add metadata
    response.metadata = {
      model: result.model || 'gpt-4',
      agentName: result.agentName,
      handoff: result.handoff,
      toolsUsed: result.toolCalls?.map((tc: any) => tc.function?.name || tc.name) || []
    };
  }

  return response;
}

function generateContextualSuggestions(result: any): string[] {
  const suggestions = [];
  
  if (result.toolCalls) {
    const toolNames = result.toolCalls.map((tc: any) => tc.function?.name || tc.name);
    
    if (toolNames.includes('generate_invoice')) {
      suggestions.push('Send this invoice to the customer');
      suggestions.push('Generate more invoices');
      suggestions.push('Check payment status');
    }
    
    if (toolNames.includes('query_database')) {
      suggestions.push('Export results to Excel');
      suggestions.push('Create a chart from this data');
      suggestions.push('Run another analysis');
    }
  }
  
  // Add default suggestions if none were added
  if (!suggestions.length) {
    suggestions.push('Generate an invoice');
    suggestions.push('Analyze financial data');
    suggestions.push('Track payments');
  }
  
  return suggestions;
}

// Get conversation history
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const datasetId = searchParams.get('datasetId');
  
  if (!datasetId) {
    return NextResponse.json({ error: 'Dataset ID required' }, { status: 400 });
  }
  
  const context = conversationContext.get(datasetId) || [];
  
  return NextResponse.json({ context });
}