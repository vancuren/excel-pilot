import { NextRequest, NextResponse } from 'next/server';
import { naturalLanguageToSQL, analyzeDataWithLLM, isLLMAvailable } from '@/lib/llm';
import type { TableSchema } from '@/lib/llm';

// Store conversation context (in production, use a proper session store)
const conversationContext = new Map<string, any[]>();

export async function POST(request: NextRequest) {
  try {
    const { datasetId, message, tableSchemas, queryResults } = await request.json();
    
    if (!datasetId || !message) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }
    
    // Get or create conversation context
    const context = conversationContext.get(datasetId) || [];
    
    // Convert schemas to the format expected by LLM
    const schemas: TableSchema[] = tableSchemas || [];
    
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
      // Return the SQL query for client-side execution
      const response = {
        sql: sqlResult.query,
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