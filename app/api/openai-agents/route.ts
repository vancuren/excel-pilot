import { NextRequest, NextResponse } from 'next/server';
import { run } from '@openai/agents';
import { triageAgent, AgentContext } from '@/lib/openai/agents';
import type { TableSchema } from '@/lib/llm';

export async function POST(request: NextRequest) {
  try {
    const { message, datasetId, tableSchemas, streaming = false } = await request.json();
    
    if (!message || !datasetId) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Create context for the agent
    const context: AgentContext = {
      datasetId,
      tableSchemas: tableSchemas as TableSchema[],
      userId: request.headers.get('x-user-id') || 'default',
      organizationId: request.headers.get('x-org-id') || 'default'
    };

    // Enhance the message with context
    const enhancedMessage = `
Context:
- Dataset ID: ${context.datasetId}
- Available tables: ${tableSchemas?.map((s: any) => s.tableName).join(', ') || 'None'}

User Request: ${message}
`;

    if (streaming) {
      // For streaming, we'll use the regular run but stream the response
      const encoder = new TextEncoder();
      const stream = new ReadableStream({
        async start(controller) {
          try {
            // Run the agent
            console.log('Starting agent execution with message:', enhancedMessage);
            const result = await run(triageAgent, enhancedMessage);
            console.log('Agent execution completed');
            
            // Process and stream the agent's thinking process
            const messages: string[] = [];
            
            console.log('Processing agent result, type:', typeof result, 'isArray:', Array.isArray(result));
            
            // Check if result is the new format with state
            if (result && result.state) {
              console.log('Result has state property');
              console.log('Result state keys:', Object.keys(result.state));
              console.log('Result sample:', JSON.stringify(result).substring(0, 500));
            }
            
            // Extract messages based on result structure
            let itemsToProcess = [];
            
            // Handle different result formats from OpenAI agents
            if (Array.isArray(result)) {
              console.log('Result is array with', result.length, 'items');
              itemsToProcess = result;
            } else if (result && result.state) {
              // New OpenAI agents format with state
              if (result.state._generatedItems) {
                console.log('Result has state._generatedItems');
                itemsToProcess = result.state._generatedItems;
              } else if (result.state.messages) {
                console.log('Result has state.messages');
                itemsToProcess = result.state.messages;
              }
            } else if (result && result.messages) {
              console.log('Result has messages property');
              itemsToProcess = result.messages;
            }
            
            // Process the items
            if (itemsToProcess.length > 0) {
              console.log('Processing', itemsToProcess.length, 'items');
              
              for (const item of itemsToProcess) {
                console.log('Processing item type:', item.type, 'name:', item.name);
                
                if (item.type === 'function_call') {
                  // Format tool call message
                  const args = JSON.parse(item.arguments || '{}');
                  let thinkingMessage = '';
                  
                  if (item.name === 'query_database') {
                    thinkingMessage = `🔍 Searching database: ${args.query || 'Running query...'}`;
                  } else if (item.name === 'bulk_invoice') {
                    const customerCount = args.customers ? args.customers.length : 0;
                    thinkingMessage = `📄 Generating invoices for ${customerCount} customer(s)...`;
                  } else if (item.name === 'generate_invoice') {
                    const name = args.customerInfo?.name || args.customerName || 'customer';
                    thinkingMessage = `📄 Creating invoice for ${name}...`;
                  } else if (item.name === 'track_payments') {
                    thinkingMessage = `💰 Tracking payment status...`;
                  } else {
                    thinkingMessage = `⚙️ Processing ${item.name}...`;
                  }
                  
                  console.log('Adding thinking message:', thinkingMessage);
                  messages.push(thinkingMessage);
                  
                } else if (item.type === 'function_call_result') {
                  // Add result confirmation
                  try {
                    const output = JSON.parse(item.output?.text || '{}');
                    if (output.success) {
                      let resultMessage = '';
                      if (item.name === 'query_database') {
                        resultMessage = '✅ Query executed successfully';
                      } else if (item.name === 'bulk_invoice' && output.generated) {
                        resultMessage = `✅ Generated ${output.generated} invoice(s)`;
                      } else if (item.name === 'generate_invoice' && output.invoiceNumber) {
                        resultMessage = `✅ Invoice created: ${output.invoiceNumber}`;
                      }
                      if (resultMessage) {
                        console.log('Adding result message:', resultMessage);
                        messages.push(resultMessage);
                      }
                    }
                  } catch (e) {
                    console.log('Error parsing function result:', e);
                  }
                  
                } else if (item.type === 'message' && item.role === 'assistant' && item.content) {
                  // Extract the final assistant message
                  const textContent = item.content.find((c: any) => c.type === 'output_text');
                  if (textContent && textContent.text) {
                    console.log('Adding assistant message');
                    messages.push('\n---\n' + textContent.text);
                  }
                }
              }
            } else {
              console.log('No items to process, trying processAgentResult');
              const processedResult = processAgentResult(result, context);
              if (processedResult.content) {
                // Check if content is an array (shouldn't be, but handle it)
                if (Array.isArray(processedResult.content)) {
                  console.log('processedResult.content is an array, processing it');
                  // Extract messages from the array
                  for (const item of processedResult.content) {
                    if (item.type === 'function_call') {
                      const args = JSON.parse(item.arguments || '{}');
                      if (item.name === 'query_database') {
                        messages.push(`🔍 Searching database...`);
                      } else if (item.name === 'bulk_invoice') {
                        messages.push(`📄 Generating invoices...`);
                      }
                    } else if (item.type === 'message' && item.role === 'assistant') {
                      const textContent = item.content?.find((c: any) => c.type === 'output_text');
                      if (textContent?.text) {
                        messages.push(textContent.text);
                      }
                    }
                  }
                } else {
                  messages.push(processedResult.content);
                }
              } else {
                console.log('processAgentResult returned no content');
                messages.push('Processing your request...');
              }
            }
            
            console.log('Total messages collected:', messages.length);
            console.log('Messages:', messages);
            
            // If no messages were collected, add a fallback
            if (messages.length === 0) {
              messages.push('Processing your request...');
              messages.push('Request completed successfully.');
            }
            
            // Stream each message separately for better UX
            for (const message of messages) {
              // Split longer messages into chunks for smoother streaming
              if (message.length > 100) {
                const messageChunks = message.match(/.{1,50}/g) || [message];
                for (const chunk of messageChunks) {
                  controller.enqueue(encoder.encode(`data: ${JSON.stringify(chunk)}\n\n`));
                  await new Promise(resolve => setTimeout(resolve, 30));
                }
              } else {
                // Send shorter messages as single chunks
                controller.enqueue(encoder.encode(`data: ${JSON.stringify(message)}\n\n`));
                await new Promise(resolve => setTimeout(resolve, 200)); // Longer pause between thinking steps
              }
            }
            
            controller.enqueue(encoder.encode('data: [DONE]\n\n'));
            controller.close();
          } catch (error) {
            console.error('Agent execution error:', error);
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ error: errorMessage })}\n\n`));
            controller.close();
          }
        }
      });

      return new NextResponse(stream, {
        headers: {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          'Connection': 'keep-alive',
        },
      });
    } else {
      // Non-streaming mode
      try {
        console.log('Running agent with message:', enhancedMessage);
        
        const result = await run(triageAgent, enhancedMessage);
        
        console.log('Agent execution completed, result type:', typeof result, Array.isArray(result) ? 'array' : 'not array');
        
        // Extract the actual message content from the result
        let messageContent = '';
        let toolCalls = [];
        
        // The run function returns an array of items
        if (Array.isArray(result)) {
          console.log('Result is array with', result.length, 'items');
          
          // Process each item in the result
          for (const item of result) {
            console.log('Processing item type:', item.type);
            
            if (item.type === 'message' && item.role === 'assistant') {
              // Found the assistant's message
              if (Array.isArray(item.content)) {
                // Look for output_text in the content array
                const textContent = item.content.find((c: any) => c.type === 'output_text');
                if (textContent && textContent.text) {
                  messageContent = textContent.text;
                  console.log('Extracted message content:', messageContent.substring(0, 100));
                }
              } else if (typeof item.content === 'string') {
                messageContent = item.content;
              }
            } else if (item.type === 'function_call') {
              // Extract tool call information
              toolCalls.push({
                tool: item.name,
                arguments: JSON.parse(item.arguments || '{}'),
                result: null
              });
            } else if (item.type === 'function_call_result') {
              // Add result to the last tool call
              if (toolCalls.length > 0) {
                const lastCall = toolCalls[toolCalls.length - 1];
                if (item.output && item.output.text) {
                  try {
                    lastCall.result = JSON.parse(item.output.text);
                  } catch {
                    lastCall.result = item.output.text;
                  }
                }
              }
            }
          }
        } else {
          // Fallback to the existing processing
          const processedResult = processAgentResult(result, context);
          messageContent = processedResult.content;
          toolCalls = processedResult.toolCalls;
        }
        
        // If we still don't have content, provide a meaningful fallback
        if (!messageContent) {
          console.log('Warning: Could not extract message content from agent response');
          
          // Check if we have tool calls to describe what was done
          if (toolCalls.length > 0) {
            const actions = toolCalls.map((tc: any) => {
              if (tc.tool === 'query_database') {
                return 'Executed database query';
              } else if (tc.tool === 'bulk_invoice') {
                const result = tc.result;
                if (result && result.generated) {
                  return `Generated ${result.generated} invoice(s) successfully`;
                }
                return 'Generated invoices';
              } else if (tc.tool === 'generate_invoice') {
                return 'Generated invoice';
              }
              return `Executed ${tc.tool}`;
            });
            
            messageContent = actions.join('. ') + '.';
          } else {
            messageContent = 'Request processed successfully.';
          }
        }
        
        return NextResponse.json({
          success: true,
          result: {
            content: messageContent,
            toolCalls: toolCalls,
            suggestions: generateSuggestions({ toolCalls }, context),
            artifacts: [],
            metadata: {
              agentUsed: 'triageAgent',
              toolsUsed: toolCalls.map((tc: any) => tc.tool)
            }
          },
          context
        });
      } catch (error) {
        console.error('Agent execution error:', error);
        
        // Return error details for debugging
        return NextResponse.json({
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
          details: error instanceof Error ? error.stack : null
        });
      }
    }
  } catch (error) {
    console.error('OpenAI Agent error:', error);
    return NextResponse.json(
      { 
        error: 'Agent execution failed', 
        details: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : null
      },
      { status: 500 }
    );
  }
}

function processAgentResult(result: any, context: AgentContext) {
  // Extract and structure the agent's response
  const processed: any = {
    content: '',
    toolCalls: [],
    suggestions: [],
    artifacts: [],
    metadata: {}
  };

  console.log('Processing result type:', typeof result);
  console.log('Result keys:', result ? Object.keys(result) : 'null');

  // Handle different result types from OpenAI agents
  if (typeof result === 'string') {
    processed.content = result;
  } else if (result && typeof result === 'object') {
    // Handle OpenAI agents SDK response format with state
    if (result.state) {
      // Try different state properties
      const itemsToProcess = result.state._generatedItems || result.state.generatedItems || [];
      
      console.log('Found', itemsToProcess.length, 'generated items');
      
      // Process generated items
      for (const item of itemsToProcess) {
        if (item.type === 'tool_call_item') {
          processed.toolCalls.push({
            tool: item.rawItem.name,
            arguments: JSON.parse(item.rawItem.arguments || '{}'),
            result: null
          });
        } else if (item.type === 'tool_call_output_item') {
          // Find matching tool call and add result
          const lastToolCall = processed.toolCalls[processed.toolCalls.length - 1];
          if (lastToolCall) {
            lastToolCall.result = JSON.parse(item.output || '{}');
          }
        } else if (item.type === 'message_output_item' && item.rawItem.content) {
          // Extract text from message content
          const textContent = item.rawItem.content.find((c: any) => c.type === 'output_text');
          if (textContent && textContent.text) {
            processed.content = textContent.text;
          }
        }
      }
    }
    // Fallback to other possible fields
    else if (result.content) {
      processed.content = result.content;
    } else if (result.message) {
      processed.content = result.message;
    } else if (result.text) {
      processed.content = result.text;
    } else if (result.output) {
      processed.content = result.output;
    } else if (result.response) {
      processed.content = result.response;
    } else if (result.finalOutput) {
      processed.content = result.finalOutput;
    } else {
      // Check if state has _lastTurnResponse which might contain the message
      if (result.state && result.state._lastTurnResponse) {
        const lastResponse = result.state._lastTurnResponse;
        if (lastResponse.content && Array.isArray(lastResponse.content)) {
          const textContent = lastResponse.content.find((c: any) => c.type === 'text' || c.type === 'output_text');
          if (textContent && textContent.text) {
            processed.content = textContent.text;
          }
        }
      }
      
      // Still no content - provide a fallback
      if (!processed.content) {
        processed.content = 'Request processed successfully.';
      }
    }

    // Extract tool calls if any
    if (result.toolCalls && Array.isArray(result.toolCalls)) {
      processed.toolCalls = result.toolCalls.map((call: any) => ({
        tool: call.function?.name || call.tool,
        arguments: call.function?.arguments || call.arguments,
        result: call.result
      }));
    }

    // Extract SQL queries if generated
    if (result.sql) {
      processed.artifacts.push({
        type: 'sql_query',
        content: result.sql,
        explanation: result.explanation
      });
    }

    // Extract invoice data if generated
    if (result.invoiceNumber) {
      processed.artifacts.push({
        type: 'invoice',
        invoiceNumber: result.invoiceNumber,
        total: result.total,
        status: result.status
      });
    }

    // Generate suggestions based on the action performed
    processed.suggestions = generateSuggestions(result, context);
    
    // Add metadata
    processed.metadata = {
      agentUsed: result.state?.currentAgent?.name || 'triageAgent',
      executionTime: result.executionTime,
      toolsUsed: processed.toolCalls.map((tc: any) => tc.tool)
      // Don't include rawResult to avoid sending huge JSON to client
    };
  }

  return processed;
}

function generateSuggestions(result: any, _context: AgentContext): string[] {
  const suggestions = [];

  // Based on tool calls, suggest follow-up actions
  if (result.toolCalls) {
    const toolNames = result.toolCalls.map((tc: any) => tc.function?.name || tc.tool);
    
    if (toolNames.includes('query_database')) {
      suggestions.push('Analyze the results for trends');
      suggestions.push('Export data to Excel');
      suggestions.push('Create a visualization');
    }
    
    if (toolNames.includes('generate_invoice')) {
      suggestions.push('Send the invoice to customer');
      suggestions.push('Track payment status');
      suggestions.push('Generate bulk invoices');
    }
    
    if (toolNames.includes('track_payments')) {
      suggestions.push('Send reminders for overdue invoices');
      suggestions.push('Reconcile with bank statements');
      suggestions.push('Generate aging report');
    }
  }

  // Add general suggestions
  if (!suggestions.length) {
    suggestions.push('Ask about your data');
    suggestions.push('Generate financial reports');
    suggestions.push('Create invoices');
  }

  return suggestions;
}
