import { NextRequest, NextResponse } from 'next/server';
import { processWithTools, executeToolCalls } from '@/lib/llm-with-tools';
import { naturalLanguageToSQL } from '@/lib/llm';

export async function POST(request: NextRequest) {
  try {
    const { datasetId, message, tableSchemas, queryResults } = await request.json();
    
    if (!datasetId || !message) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }
    
    // First, check if this is an email/tool-related request
    const lowerMessage = message.toLowerCase();
    const isToolRequest = 
      lowerMessage.includes('email') || 
      lowerMessage.includes('send') || 
      lowerMessage.includes('notify') || 
      lowerMessage.includes('remind') ||
      lowerMessage.includes('invoice') ||
      lowerMessage.includes('report') ||
      lowerMessage.includes('purchase') ||
      lowerMessage.includes('order') ||
      lowerMessage.includes('buy');
    
    if (isToolRequest) {
      // Process with tool-enabled LLM, passing queryResults if available
      const llmResponse = await processWithTools(message, tableSchemas || [], queryResults);
      
      // Check if any tool calls need SQL execution first
      const hasSqlTool = llmResponse.toolCalls?.some(t => t.name === 'execute_sql');
      
      // If we already have query results, skip SQL execution
      if (queryResults && queryResults.length > 0 && llmResponse.toolCalls) {
        // We already have results, execute tools directly with the data
        const nonSqlTools = llmResponse.toolCalls.filter(t => t.name !== 'execute_sql');
        
        // Update tool inputs with query results data
        const updatedTools = nonSqlTools.map((tool: any) => {
          if (tool.name === 'send_email') {
            // Extract email addresses from results
            const emailField = Object.keys(queryResults[0]).find(key => 
              key.toLowerCase().includes('email')
            );
            
            if (emailField) {
              const emails = queryResults
                .map((row: any) => row[emailField])
                .filter((email: string) => email && typeof email === 'string' && email.includes('@'));
              
              if (emails.length > 0) {
                tool.input.to = tool.input.to || emails;
                tool.input.data = queryResults;
              }
            }
          } else if (tool.name === 'purchase_product') {
            // Extract product URL from results
            const urlField = Object.keys(queryResults[0]).find(key => 
              key.toLowerCase().includes('url') || key.toLowerCase().includes('link')
            );
            
            if (urlField && queryResults[0][urlField]) {
              tool.input.productUrl = tool.input.productUrl || queryResults[0][urlField];
            }
          }
          return tool;
        });
        
        const toolResults = await executeToolCalls(updatedTools);
        
        // Build response message
        let responseContent = llmResponse.content || '';
        
        for (const result of toolResults) {
          if (result.result.success) {
            if (result.tool === 'send_email') {
              responseContent += `\n\n✅ ${result.result.content || 'Email sent successfully'}`;
            } else if (result.tool === 'purchase_product') {
              responseContent += `\n\n${result.result.content || '✅ Product ordered successfully'}`;
            }
          } else {
            responseContent += `\n\n❌ ${result.tool} failed: ${result.result.error}`;
          }
        }
        
        return NextResponse.json({
          messages: [{
            id: `msg_${Date.now()}`,
            role: 'assistant',
            content: responseContent,
            timestamp: new Date().toISOString(),
            toolResults: toolResults
          }]
        });
      }
      
      if (hasSqlTool && llmResponse.toolCalls) {
        // Find the SQL tool call
        const sqlTool = llmResponse.toolCalls.find(t => t.name === 'execute_sql');
        if (sqlTool && sqlTool.input && sqlTool.input.query) {
          // Clean the SQL query - remove trailing semicolon if present
          let cleanedQuery = sqlTool.input.query.trim();
          if (cleanedQuery.endsWith(';')) {
            cleanedQuery = cleanedQuery.slice(0, -1);
          }
          
          // Return SQL for client-side execution with pending tools
          return NextResponse.json({
            sql: cleanedQuery,
            explanation: sqlTool.input.explanation || 'Finding data for email',
            shouldExecuteClient: true,
            pendingTools: llmResponse.toolCalls.filter(t => t.name !== 'execute_sql') // Other tools to execute after SQL
          });
        }
      }
      
      // Execute non-SQL tools immediately
      let toolResults: any[] = [];
      if (llmResponse.shouldExecuteTools && llmResponse.toolCalls) {
        const nonSqlTools = llmResponse.toolCalls.filter(t => t.name !== 'execute_sql');
        if (nonSqlTools.length > 0) {
          toolResults = await executeToolCalls(nonSqlTools);
        }
      }
      
      // Build response message
      let responseContent = llmResponse.content || '';
      
      // Add tool execution results to the response
      for (const result of toolResults) {
        if (result.result.success) {
          if (result.tool === 'send_email') {
            responseContent += `\n\n✅ ${result.result.content || 'Email sent successfully'}`;
          } else if (result.tool === 'generate_report') {
            responseContent += '\n\n✅ Report generated successfully';
          } else if (result.tool === 'purchase_product') {
            responseContent += `\n\n${result.result.content || '✅ Product ordered successfully'}`;
          }
        } else {
          responseContent += `\n\n❌ ${result.tool} failed: ${result.result.error}`;
        }
      }
      
      // Return the response
      return NextResponse.json({
        messages: [{
          id: `msg_${Date.now()}`,
          role: 'assistant',
          content: responseContent,
          timestamp: new Date().toISOString(),
          toolResults: toolResults,
          artifacts: toolResults
            .filter(r => r.result.file)
            .map(r => ({
              type: 'file',
              data: r.result.file
            }))
        }]
      });
      
    } else {
      // For non-tool requests, use the standard SQL generation
      const sqlResult = await naturalLanguageToSQL(message, tableSchemas || []);
      
      if (sqlResult.query && !sqlResult.error) {
        return NextResponse.json({
          sql: sqlResult.query,
          explanation: sqlResult.explanation,
          suggestions: sqlResult.suggestions,
          shouldExecuteClient: true
        });
      } else {
        return NextResponse.json({
          messages: [{
            id: `msg_${Date.now()}`,
            role: 'assistant',
            content: sqlResult.error || 'Could not understand the query. Please try rephrasing.',
            timestamp: new Date().toISOString()
          }]
        });
      }
    }
    
  } catch (error) {
    console.error('Chat with tools error:', error);
    return NextResponse.json({ 
      error: 'Processing failed',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

// Handle tool execution after SQL results
export async function PUT(request: NextRequest) {
  try {
    const { pendingTools, queryResults } = await request.json();
    
    if (!pendingTools || pendingTools.length === 0) {
      // No pending tools, just return the query results
      return NextResponse.json({
        messages: [{
          id: `msg_${Date.now()}`,
          role: 'assistant',
          content: `Found ${queryResults?.length || 0} results from the query.`,
          timestamp: new Date().toISOString(),
          queryData: queryResults
        }]
      });
    }
    
    // Update tool inputs with query results if needed
    const updatedTools = pendingTools.map((tool: any) => {
      if (tool.name === 'send_email') {
        // If we have query results, use them to populate email data
        if (queryResults && queryResults.length > 0) {
          // Extract email addresses from results
          const emailField = Object.keys(queryResults[0]).find(key => 
            key.toLowerCase().includes('email')
          );
          const nameField = Object.keys(queryResults[0]).find(key => 
            key.toLowerCase().includes('name')
          );
          
          if (emailField) {
            const emails = queryResults
              .map((row: any) => row[emailField])
              .filter((email: string) => email && typeof email === 'string' && email.includes('@'));
            
            if (emails.length > 0) {
              // Update the tool input with found emails
              tool.input.to = emails;
              tool.input.data = queryResults;
              
              // Generate personalized message if we have names
              if (nameField && queryResults[0][nameField]) {
                const name = queryResults[0][nameField];
                tool.input.subject = tool.input.subject || `Message for ${name}`;
                tool.input.message = tool.input.message || `Hello ${name},\n\nThis is an important message regarding your account.\n\nBest regards,\nExcel Pilot Team`;
              }
            } else {
              // No valid emails found in results
              tool.input.error = 'No valid email addresses found in query results';
            }
          } else {
            // No email field in results
            tool.input.error = 'No email field found in query results';
          }
        }
        
        // Ensure we have required fields
        if (!tool.input.to || (Array.isArray(tool.input.to) && tool.input.to.length === 0)) {
          tool.input.error = tool.input.error || 'No recipient email addresses provided';
        }
        if (!tool.input.subject) {
          tool.input.subject = 'Important Message';
        }
        if (!tool.input.message) {
          tool.input.message = 'This is an automated message from Excel Pilot.';
        }
      }
      return tool;
    });
    
    // Execute the tools with updated data
    const toolResults = await executeToolCalls(updatedTools);
    
    // Build response
    let responseContent = '';
    let hasSuccess = false;
    let hasFailure = false;
    
    for (const result of toolResults) {
      if (result.result.success) {
        hasSuccess = true;
        if (result.tool === 'send_email') {
          responseContent += `✅ Email sent successfully!\n${result.result.content || 'Message delivered to recipient(s)'}`;
        } else {
          responseContent += `✅ ${result.tool} completed successfully`;
        }
      } else {
        hasFailure = true;
        if (result.tool === 'send_email') {
          responseContent += `❌ Could not send email: ${result.result.error || 'Unknown error'}`;
          
          // Add helpful suggestions based on error
          if (result.result.error?.includes('No valid email')) {
            responseContent += '\n\nTip: Make sure the selected person has a valid email address in the database.';
          } else if (result.result.error?.includes('not configured')) {
            responseContent += '\n\nTip: Email service needs to be configured. Please add Mailgun credentials to your environment variables.';
          }
        } else {
          responseContent += `❌ ${result.tool} failed: ${result.result.error}`;
        }
      }
      responseContent += '\n\n';
    }
    
    // Add query results summary if available
    if (queryResults && queryResults.length > 0 && !hasSuccess) {
      responseContent = `Found ${queryResults.length} result(s) from the database.\n\n` + responseContent;
    }
    
    return NextResponse.json({
      messages: [{
        id: `msg_${Date.now()}`,
        role: 'assistant',
        content: responseContent,
        timestamp: new Date().toISOString(),
        toolResults: toolResults
      }]
    });
    
  } catch (error) {
    console.error('Tool execution error:', error);
    return NextResponse.json({ 
      error: 'Tool execution failed',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}