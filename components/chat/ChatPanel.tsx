'use client';

import { useState } from 'react';
import { Send, Sparkles, FileDown, Receipt, CheckSquare, Bot, Zap } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { ChatMessage } from './ChatMessage';
import { ActionButton } from './ActionButton';
import { useAppStore } from '@/lib/store';
import { api } from '@/lib/api';
import { getTablePreview, executeQuery } from '@/lib/clientDatabase';

export function ChatPanel() {
  const [inputMessage, setInputMessage] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  
  const { 
    currentDatasetId, 
    chatMessages, 
    addMessage, 
    addAuditEvent,
    setLoading 
  } = useAppStore();

  // Helper function to format query results for display
  const formatQueryResults = (results: any[], explanation?: string) => {
    if (!results || results.length === 0) {
      return explanation ? `${explanation}\n\nNo results found.` : 'No results found for your query.';
    }
    
    let content = explanation ? `${explanation}\n\n` : '';
    content += `Found **${results.length} result${results.length !== 1 ? 's' : ''}**\n\n`;
    
    // Show first few results in a readable format
    const preview = results.slice(0, 5);
    if (preview.length > 0) {
      content += '### Results:\n\n';
      
      // Create a simple table view for the data
      const columns = Object.keys(preview[0]);
      
      // Format as markdown table
      content += '| ' + columns.join(' | ') + ' |\n';
      content += '| ' + columns.map(() => '---').join(' | ') + ' |\n';
      
      preview.forEach(row => {
        const values = columns.map(col => {
          const value = row[col];
          if (value === null || value === undefined) return 'N/A';
          if (typeof value === 'number') {
            return value.toLocaleString('en-US', { maximumFractionDigits: 2 });
          }
          return String(value);
        });
        content += '| ' + values.join(' | ') + ' |\n';
      });
      
      if (results.length > 5) {
        content += `\n*...and ${results.length - 5} more row${results.length - 5 !== 1 ? 's' : ''}*\n`;
      }
    }
    
    // Add summary statistics for numeric columns
    const numericColumns = Object.keys(results[0]).filter(key => 
      typeof results[0][key] === 'number'
    );
    
    if (numericColumns.length > 0) {
      content += '\n### Summary:\n\n';
      numericColumns.forEach(col => {
        const values = results.map(r => r[col]).filter(v => v !== null && v !== undefined);
        if (values.length > 0) {
          const sum = values.reduce((a, b) => a + b, 0);
          const avg = sum / values.length;
          const min = Math.min(...values);
          const max = Math.max(...values);
          
          content += `**${col}:**\n`;
          content += `- Total: ${sum.toLocaleString('en-US', { maximumFractionDigits: 2 })}\n`;
          content += `- Average: ${avg.toLocaleString('en-US', { maximumFractionDigits: 2 })}\n`;
          content += `- Range: ${min.toLocaleString('en-US', { maximumFractionDigits: 2 })} to ${max.toLocaleString('en-US', { maximumFractionDigits: 2 })}\n\n`;
        }
      });
    }
    
    return content;
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
      
      // First, get SQL query from LLM (use tool-enabled endpoint)
      const response = await fetch('/api/chat-with-tools', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          datasetId: currentDatasetId,
          message: inputMessage,
          tableSchemas
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
          const queryResults = queryResult.toArray().map((row: any) => {
            // Convert BigInt values to numbers
            const cleanRow: any = {};
            for (const [key, value] of Object.entries(row)) {
              cleanRow[key] = typeof value === 'bigint' ? Number(value) : value;
            }
            return cleanRow;
          });
          
          // Check if there are pending tools to execute after SQL
          if (data.pendingTools && data.pendingTools.length > 0) {
            console.log('Executing pending tools with query results:', {
              tools: data.pendingTools,
              resultsCount: queryResults.length
            });
            
            // Execute pending tools with query results
            const toolResponse = await fetch('/api/chat-with-tools', {
              method: 'PUT',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                pendingTools: data.pendingTools,
                queryResults
              }, (_key, value) => {
                if (typeof value === 'bigint') {
                  return Number(value);
                }
                return value;
              }),
            });
            
            if (toolResponse.ok) {
              const toolData = await toolResponse.json();
              if (toolData.messages) {
                toolData.messages.forEach((msg: any) => {
                  addMessage(msg);
                });
              }
            } else {
              console.error('Tool execution failed:', await toolResponse.text());
            }
          } else {
            // No pending tools - check if this was originally a tool request
            const lowerMessage = inputMessage.toLowerCase();
            const isEmailRequest = 
              lowerMessage.includes('email') || 
              lowerMessage.includes('send') || 
              lowerMessage.includes('notify') || 
              lowerMessage.includes('remind');
            const isPurchaseRequest = 
              lowerMessage.includes('purchase') || 
              lowerMessage.includes('order') || 
              lowerMessage.includes('buy') ||
              lowerMessage.includes('reorder');
            
            if (isEmailRequest || isPurchaseRequest) {
              // This was a tool request - re-process with the query results
              console.log('Re-processing tool request with query results');
              
              // Call the tool endpoint again with the query results
              const toolResponse = await fetch('/api/chat-with-tools', {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                  datasetId: currentDatasetId,
                  message: inputMessage,
                  tableSchemas,
                  queryResults  // Include the query results this time
                }, (_key, value) => {
                  if (typeof value === 'bigint') {
                    return Number(value);
                  }
                  return value;
                }),
              });
              
              if (toolResponse.ok) {
                const toolData = await toolResponse.json();
                if (toolData.messages) {
                  toolData.messages.forEach((msg: any) => {
                    addMessage(msg);
                  });
                }
              } else {
                // Tool execution failed
                addMessage({
                  id: `msg_${Date.now()}`,
                  role: 'assistant' as const,
                  content: '❌ Could not execute the requested action. Please check the data and try again.',
                  timestamp: new Date().toISOString()
                });
              }
            } else {
              // Not a tool request - send to /api/chat for natural language analysis
              const analysisResponse = await fetch('/api/chat', {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                  datasetId: currentDatasetId,
                  message: inputMessage,
                  tableSchemas,
                  queryResults
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
                      queryData: queryResults,
                      metadata: {
                        ...msg.metadata,
                        query: data.sql,
                        explanation: data.explanation
                      }
                    });
                  });
                }
              } else {
                // Fallback to basic formatting if analysis fails
                const resultMessage = {
                  id: `msg_${Date.now()}`,
                  role: 'assistant' as const,
                  content: formatQueryResults(queryResults, data.explanation),
                  timestamp: new Date().toISOString(),
                  queryData: queryResults,
                  metadata: {
                    query: data.sql,
                    explanation: data.explanation
                  },
                  suggestions: data.suggestions
                };
                addMessage(resultMessage);
              }
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
      
    } catch (error) {
      console.error('Chat error:', error);
      
      // Fallback to client-side analysis if API fails
      const errorMessage = {
        id: `msg_${Date.now()}_error`,
        role: 'assistant' as const,
        content: 'I encountered an error while processing your request. Please make sure your data is properly loaded and try again. If you haven\'t set up an API key yet, I\'ll use basic pattern matching to help analyze your data.',
        timestamp: new Date().toISOString(),
      };
      
      addMessage(errorMessage);
    }

    setIsTyping(false);
  };

  const handleActionClick = async (actionId: string) => {
    setLoading(true);
    try {
      const result = await api.executeAction(actionId);
      addAuditEvent(result.audit);
      
      // Add confirmation message
      addMessage({
        id: `msg_${Date.now()}_action`,
        role: 'assistant',
        content: `✅ ${result.audit.summary}`,
        artifacts: result.artifacts,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      console.error('Action error:', error);
    }
    setLoading(false);
  };

  const getActionIcon = (category: string) => {
    switch (category) {
      case 'invoice': return <Receipt className="h-4 w-4" />;
      case 'export': return <FileDown className="h-4 w-4" />;
      case 'approval': return <CheckSquare className="h-4 w-4" />;
      case 'voucher': return <FileDown className="h-4 w-4" />;
      default: return <Sparkles className="h-4 w-4" />;
    }
  };

  const suggestions = chatMessages
    .filter(msg => msg.toolSuggestions?.length)
    .flatMap(msg => msg.toolSuggestions || []);

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
        </div>
      </div>

      {/* Chat Messages */}
      <div className="flex-1 min-h-0 relative">
        <ScrollArea className="h-full">
          <div className="px-6 py-6 space-y-8">
            {chatMessages.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full min-h-[300px] text-center space-y-6">
                <div className="flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-primary/10 to-primary/5 border border-primary/20">
                  <Sparkles className="h-8 w-8 text-primary" />
                </div>
                <div className="space-y-3">
                  <h4 className="text-base font-semibold text-foreground">Start a conversation</h4>
                  <p className="text-xs text-muted-foreground max-w-[200px]">
                    Ask about overdue vendors, cash reconciliation, or journal entries
                  </p>
                </div>
              <div className="flex flex-wrap gap-2 justify-center max-w-[250px]">
                <Badge variant="secondary" className="text-xs bg-muted/60">Overdue analysis</Badge>
                <Badge variant="secondary" className="text-xs bg-muted/60">Cash flow</Badge>
                <Badge variant="secondary" className="text-xs bg-muted/60">Reconciliation</Badge>
              </div>
            </div>
          ) : (
              <>
                {chatMessages.map((message) => (
                  <ChatMessage key={message.id} message={message} />
                ))}
                
                {isTyping && (
                  <div className="flex items-start gap-3">
                    <div className="flex items-center justify-center w-8 h-8 rounded-xl bg-gradient-to-br from-primary/10 to-primary/5 border border-primary/20 flex-shrink-0">
                      <Bot className="h-4 w-4 text-primary" />
                    </div>
                    <div className="flex-1 pt-1">
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <div className="flex space-x-1">
                          <div className="w-2 h-2 bg-primary rounded-full animate-bounce" />
                          <div className="w-2 h-2 bg-primary rounded-full animate-bounce" style={{ animationDelay: '0.1s' }} />
                          <div className="w-2 h-2 bg-primary rounded-full animate-bounce" style={{ animationDelay: '0.2s' }} />
                        </div>
                        <span>AI is analyzing...</span>
                      </div>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </ScrollArea>
      </div>

      {/* Smart Actions */}
      {suggestions.length > 0 && (
        <div className="flex-shrink-0 px-6 py-4 border-t border-border/50 bg-muted/30">
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <Zap className="h-4 w-4 text-amber-500" />
              <span className="text-sm font-medium text-foreground">Quick Actions</span>
            </div>
            <div className="space-y-3">
              {suggestions.map((suggestion) => (
                <ActionButton
                  key={suggestion.id}
                  suggestion={suggestion}
                  onClick={() => handleActionClick(suggestion.id)}
                  icon={getActionIcon(suggestion.category)}
                />
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Message Input */}
      <div className="flex-shrink-0 p-6 border-t border-border/50 bg-background/95 backdrop-blur-md">
        <div className="relative">
          <Input
            placeholder={currentDatasetId ? "Ask about your financial data... (Enter to send)" : "Upload data first..."}
            value={inputMessage}
            onChange={(e) => setInputMessage(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSendMessage();
              }
            }}
            disabled={!currentDatasetId || isTyping}
            className="pr-12 bg-muted/30 border-border/60 focus:bg-background focus:border-primary/60 focus:ring-primary/20 transition-all duration-200 rounded-xl"
          />
          <Button 
            onClick={handleSendMessage} 
            disabled={!inputMessage.trim() || !currentDatasetId || isTyping}
            size="sm"
            className="absolute right-2 top-2 h-8 w-8 p-0 bg-primary hover:bg-primary/90 disabled:bg-muted disabled:text-muted-foreground transition-all duration-200 rounded-lg"
          >
            <Send className="h-4 w-4" />
          </Button>
          <div className="absolute -bottom-5 left-0 text-[11px] text-muted-foreground/80">
            Press Enter to send • Shift+Enter for new line • ⌘K for Command
          </div>
        </div>
      </div>
    </div>
  );
}
