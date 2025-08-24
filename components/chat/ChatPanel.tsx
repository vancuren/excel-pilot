'use client';

import { useState, useRef, useEffect } from 'react';
import { Send, Bot, Zap, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { ChatMessage } from './ChatMessage';
import { useAppStore } from '@/lib/store';
import { getTablePreview, executeQuery } from '@/lib/clientDatabase';
import type { ActionSuggestion } from '@/types';

export function ChatPanel() {
  const [inputMessage, setInputMessage] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamingContent, setStreamingContent] = useState('');
  const abortControllerRef = useRef<AbortController | null>(null);
  
  const { 
    currentDatasetId, 
    chatMessages, 
    addMessage, 
    updateMessage
  } = useAppStore();

  // Check if message should use OpenAI agents
  const shouldUseAgents = (message: string) => {
    const agentKeywords = [
      'invoice', 'payment', 'reconcile', 'remind',
      'generate report', 'bulk', 'follow up',
      'track', 'overdue', 'accounting',
      'financial planning', 'forecast', 'budget'
    ];
    
    const lowerMessage = message.toLowerCase();
    return agentKeywords.some(keyword => lowerMessage.includes(keyword));
  };

  const handleSendMessage = async () => {
    if (!inputMessage.trim() || !currentDatasetId) return;

    const userMessage = {
      id: `msg_${Date.now()}_user`,
      role: 'user' as const,
      content: inputMessage,
      timestamp: new Date().toISOString(),
    };

    addMessage(userMessage);
    const messageToSend = inputMessage;
    setInputMessage('');
    setIsTyping(true);

    try {
      // Get table schemas for this dataset
      const storedTables = localStorage.getItem(`dataset_${currentDatasetId}_tables`);
      let tableSchemas: any[] = [];
      
      if (storedTables) {
        const tableInfo = JSON.parse(storedTables);
        
        // Get schema for each table
        for (const info of tableInfo) {
          try {
            const tablePreview = await getTablePreview(info.name);
            tableSchemas.push({
              tableName: info.name,
              columns: tablePreview.schema.map(col => ({
                name: col.name,
                type: col.type,
                nullable: col.nullable
              })),
              rowCount: tablePreview.stats?.totalRows
            });
          } catch (error) {
            console.error(`Failed to get schema for ${info.name}:`, error);
          }
        }
      }

      // Check if we should use OpenAI agents with streaming
      if (shouldUseAgents(messageToSend)) {
        await handleAgentStreaming(messageToSend, tableSchemas);
      } else {
        // Regular SQL processing
        await handleRegularChat(messageToSend, tableSchemas);
      }
      
    } catch (error) {
      console.error('Chat error:', error);
      
      const errorMessage = {
        id: `msg_${Date.now()}_error`,
        role: 'assistant' as const,
        content: 'I encountered an error while processing your request. Please make sure your data is properly loaded and try again.',
        timestamp: new Date().toISOString(),
      };
      
      addMessage(errorMessage);
    }

    setIsTyping(false);
    setIsStreaming(false);
    setStreamingContent('');
  };

  const handleAgentStreaming = async (message: string, tableSchemas: any[]) => {
    setIsStreaming(true);
    
    // Create a message that will be updated as streaming happens
    const assistantMessageId = `msg_${Date.now()}_assistant`;
    const assistantMessage = {
      id: assistantMessageId,
      role: 'assistant' as const,
      content: '',
      timestamp: new Date().toISOString(),
      metadata: {
        agentUsed: true,
        streaming: true
      }
    };
    
    addMessage(assistantMessage);

    // Abort any previous streaming
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    
    abortControllerRef.current = new AbortController();

    try {
      // Use OpenAI Agents streaming for real-time progress and execution
      let response = await fetch('/api/openai-agents', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message,
          datasetId: currentDatasetId,
          tableSchemas,
          streaming: true
        }),
        signal: abortControllerRef.current.signal
      });

      if (!response.ok) {
        throw new Error(`Agent API failed: ${response.statusText}`);
      }

      // Handle streaming response
      const reader = response.body?.getReader();
      const decoder = new TextDecoder();

      if (!reader) {
        throw new Error('No response body');
      }

      let accumulatedContent = '';
      
      while (true) {
        const { done, value } = await reader.read();
        
        if (done) break;
        
        const chunk = decoder.decode(value);
        const lines = chunk.split('\n');
        
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6);
            
            if (data === '[DONE]') {
              // Streaming complete; now execute concrete actions via local agents
              setIsStreaming(false);
              try {
                const execRes = await fetch('/api/agents', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    naturalLanguage: message,
                    datasetId: currentDatasetId,
                    userId: 'user_default',
                    organizationId: 'org_default'
                  })
                });
                if (execRes.ok) {
                  const execData = await execRes.json();
                  const summary = execData.summary || 'Request processed successfully.';
                  const details = execData.tasks?.length ? `\n\nCompleted ${execData.tasks.length} task(s).` : '';
                  accumulatedContent += `${accumulatedContent ? '\n\n' : ''}${summary}${details}`;
                } else {
                  // If local execution fails, append a helpful note
                  accumulatedContent += `${accumulatedContent ? '\n\n' : ''}Could not execute actions automatically.`;
                }
              } catch (e) {
                accumulatedContent += `${accumulatedContent ? '\n\n' : ''}Execution error: ${(e as Error).message}`;
              }
              // Final update with any tool results or suggestions
              updateMessage(assistantMessageId, {
                content: accumulatedContent,
                toolSuggestions: generateAgentSuggestions(accumulatedContent)
              });
              break;
            }
            
            try {
              // Try to parse as JSON first (for structured responses)
              const parsed = JSON.parse(data);
              if (typeof parsed === 'string') {
                accumulatedContent += parsed;
              } else if (parsed.content) {
                accumulatedContent += parsed.content;
              } else if (parsed.text) {
                accumulatedContent += parsed.text;
              } else if (parsed.delta) {
                accumulatedContent += parsed.delta;
              }
            } catch {
              // If not JSON, treat as plain text
              accumulatedContent += data;
            }
            
            // Update message with accumulated content
            updateMessage(assistantMessageId, {
              content: accumulatedContent
            });
          }
        }
      }
    } catch (error: any) {
      if (error.name === 'AbortError') {
        console.log('Streaming aborted');
      } else {
        console.error('Streaming error:', error);
        updateMessage(assistantMessageId, {
          content: `Error during agent execution: ${error.message}. Please try again.`
        });
      }
    } finally {
      setIsStreaming(false);
      abortControllerRef.current = null;
    }
  };

  const handleRegularChat = async (message: string, tableSchemas: any[]) => {
    // First, get SQL query from LLM
    const response = await fetch('/api/chat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        datasetId: currentDatasetId,
        message,
        tableSchemas,
        useAgents: false // Explicitly disable agents for SQL queries
      }, (_key, value) => {
        // Convert BigInt to number for JSON serialization
        if (typeof value === 'bigint') {
          return Number(value);
        }
        return value;
      }),
    });
    
    if (!response.ok) {
      throw new Error(`Chat API failed: ${response.statusText}`);
    }
    
    const data = await response.json();
    
    // Check if we need to execute SQL on client side
    if (data.shouldExecuteClient && data.sql) {
      try {
        // Execute SQL query on client side
        const queryResult = await executeQuery(data.sql);
        const queryResults = queryResult.toArray().map(row => {
          // Convert BigInt values to numbers
          const cleanRow: any = {};
          for (const [key, value] of Object.entries(row)) {
            cleanRow[key] = typeof value === 'bigint' ? Number(value) : value;
          }
          return cleanRow;
        });
        
        // Send results back to API for analysis
        const analysisResponse = await fetch('/api/chat', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            datasetId: currentDatasetId,
            message,
            tableSchemas,
            queryResults,
            useAgents: false
          }, (_key, value) => {
            if (typeof value === 'bigint') {
              return Number(value);
            }
            return value;
          }),
        });
        
        if (analysisResponse.ok) {
          const analysisData = await analysisResponse.json();
          if (analysisData.messages) {
            analysisData.messages.forEach((msg: any) => {
              addMessage({
                ...msg,
                queryData: queryResults, // Add query results to message
                metadata: {
                  ...msg.metadata,
                  query: data.sql,
                  explanation: data.explanation
                }
              });
            });
          }
        }
      } catch (queryError: any) {
        // Query execution failed - provide helpful error message
        console.error('Query execution error:', queryError);
        
        let errorDetails = queryError.message || 'Unknown error';
        let suggestion = '';
        
        // Parse common DuckDB errors and provide suggestions
        if (errorDetails.includes('not found') || errorDetails.includes('does not exist')) {
          suggestion = '\n\nThis might be a column name issue. The available columns are:\n' + 
            tableSchemas.map(s => `Table ${s.tableName}: ${s.columns.map((c: any) => c.name).join(', ')}`).join('\n');
        } else if (errorDetails.includes('syntax error')) {
          suggestion = '\n\nThere might be a syntax issue with the generated SQL. Please try rephrasing your question more specifically.';
        } else if (errorDetails.includes('type mismatch') || errorDetails.includes('cannot cast')) {
          suggestion = '\n\nThis appears to be a data type issue. Try being more specific about the columns or values you want to query.';
        }
        
        const errorMessage = {
          id: `msg_${Date.now()}`,
          role: 'assistant' as const,
          content: `I understood your question and generated this SQL query:\n\n\`\`\`sql\n${data.sql}\n\`\`\`\n\n❌ Query execution failed: ${errorDetails}${suggestion}\n\nWould you like to try rephrasing your question?`,
          timestamp: new Date().toISOString(),
          suggestions: data.suggestions || ['Show me all data', 'Show summary statistics', 'Show top 10 records']
        };
        addMessage(errorMessage);
      }
    } else if (data.messages) {
      // Direct response without SQL execution
      data.messages.forEach((msg: any) => {
        addMessage(msg);
      });
    }
  };

  const generateAgentSuggestions = (content: string): ActionSuggestion[] => {
    const suggestions: ActionSuggestion[] = [];
    
    // Generate suggestions based on content
    if (content.toLowerCase().includes('invoice')) {
      suggestions.push({
        id: 'send_invoice',
        label: 'Send this invoice to the customer',
        category: 'invoice'
      });
      suggestions.push({
        id: 'generate_more',
        label: 'Generate more invoices',
        category: 'invoice'
      });
      suggestions.push({
        id: 'track_payment',
        label: 'Track payment status',
        category: 'analysis'
      });
    } else if (content.toLowerCase().includes('payment')) {
      suggestions.push({
        id: 'send_reminders',
        label: 'Send payment reminders',
        category: 'invoice'
      });
      suggestions.push({
        id: 'reconcile',
        label: 'Reconcile with bank statements',
        category: 'analysis'
      });
      suggestions.push({
        id: 'aging_report',
        label: 'Generate aging report',
        category: 'export'
      });
    } else if (content.toLowerCase().includes('report')) {
      suggestions.push({
        id: 'export_excel',
        label: 'Export to Excel',
        category: 'export'
      });
      suggestions.push({
        id: 'create_viz',
        label: 'Create visualization',
        category: 'analysis'
      });
      suggestions.push({
        id: 'schedule_reports',
        label: 'Schedule regular reports',
        category: 'export'
      });
    } else {
      suggestions.push({
        id: 'generate_invoices',
        label: 'Generate invoices',
        category: 'invoice'
      });
      suggestions.push({
        id: 'track_payments',
        label: 'Track payments',
        category: 'analysis'
      });
      suggestions.push({
        id: 'financial_analysis',
        label: 'Run financial analysis',
        category: 'analysis'
      });
    }
    
    return suggestions;
  };


  const suggestions = chatMessages
    .filter(msg => msg.toolSuggestions?.length)
    .flatMap(msg => msg.toolSuggestions || []);

  // Auto-scroll to bottom when new messages arrive
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (scrollAreaRef.current) {
      scrollAreaRef.current.scrollTop = scrollAreaRef.current.scrollHeight;
    }
  }, [chatMessages, streamingContent]);

  return (
    <div className="h-full flex flex-col bg-background/50 backdrop-blur-sm border-l border-border/50">
      {/* Header */}
      <div className="flex-shrink-0 px-6 py-4 border-b border-border/50 bg-background/95 backdrop-blur-md">
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center w-9 h-9 rounded-xl bg-gradient-to-br from-primary to-primary/80 shadow-sm">
            <Bot className="h-4 w-4 text-primary-foreground" />
          </div>
          <div className="flex-1">
            <h3 className="text-sm font-semibold text-foreground">AI Assistant</h3>
            <p className="text-xs text-muted-foreground">
              {currentDatasetId ? 'Ready to analyze your data' : 'Upload data to get started'}
            </p>
          </div>
          {isStreaming && (
            <Badge variant="secondary" className="animate-pulse">
              <Loader2 className="h-3 w-3 mr-1 animate-spin" />
              Streaming
            </Badge>
          )}
        </div>
      </div>

      {/* Chat Messages */}
      <div className="flex-1 min-h-0 relative">
        <ScrollArea className="h-full" ref={scrollAreaRef}>
          <div className="px-6 py-6 space-y-8">
            {chatMessages.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-64 text-center">
                <Bot className="h-12 w-12 text-muted-foreground/50 mb-4" />
                <p className="text-sm text-muted-foreground mb-4">
                  {currentDatasetId 
                    ? "Ask questions about your data or request financial operations"
                    : "Upload a dataset to start analyzing"}
                </p>
                {currentDatasetId && (
                  <div className="flex flex-wrap gap-2 justify-center">
                    <Badge variant="secondary" className="text-xs">
                      Try: "Show me all unpaid invoices"
                    </Badge>
                    <Badge variant="secondary" className="text-xs">
                      Try: "Generate an invoice for Acme Corp"
                    </Badge>
                    <Badge variant="secondary" className="text-xs">
                      Try: "Send payment reminders"
                    </Badge>
                  </div>
                )}
              </div>
            ) : (
              chatMessages.map((message) => (
                <ChatMessage key={message.id} message={message} />
              ))
            )}
            
            {isTyping && !isStreaming && (
              <div className="flex items-center gap-2 text-muted-foreground">
                <div className="flex gap-1">
                  <span className="h-2 w-2 bg-primary/60 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                  <span className="h-2 w-2 bg-primary/60 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                  <span className="h-2 w-2 bg-primary/60 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                </div>
                <span className="text-xs">AI is thinking...</span>
              </div>
            )}
          </div>
        </ScrollArea>
      </div>

      {/* Suggestions */}
      {suggestions.length > 0 && (
        <div className="flex-shrink-0 px-6 py-3 border-t border-border/50">
          <p className="text-xs text-muted-foreground mb-2">Suggestions:</p>
          <div className="flex flex-wrap gap-2">
            {suggestions.slice(0, 3).map((suggestion, index) => (
              <Button
                key={index}
                variant="outline"
                size="sm"
                onClick={() => setInputMessage(suggestion.label)}
                className="text-xs"
              >
                <Zap className="h-3 w-3 mr-1" />
                {suggestion.label}
              </Button>
            ))}
          </div>
        </div>
      )}

      {/* Input */}
      <div className="flex-shrink-0 p-6 border-t border-border/50 bg-background/95 backdrop-blur-md">
        <div className="flex gap-3">
          <Input
            value={inputMessage}
            onChange={(e) => setInputMessage(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSendMessage();
              }
            }}
            placeholder={currentDatasetId ? "Ask a question or request an action..." : "Upload data first"}
            disabled={!currentDatasetId || isTyping}
            className="flex-1 bg-background/50"
          />
          <Button 
            onClick={handleSendMessage}
            disabled={!currentDatasetId || !inputMessage.trim() || isTyping}
            size="icon"
            className="shrink-0"
          >
            {isTyping ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
