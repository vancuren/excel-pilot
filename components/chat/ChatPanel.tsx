'use client';

import { useState } from 'react';
import { Send, Sparkles, FileDown, Receipt, Mail, CheckSquare, Bot, Zap } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
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
      
      // First, get SQL query from LLM
      const response = await fetch('/api/chat', {
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
          // Query execution failed
          const errorMessage = {
            id: `msg_${Date.now()}`,
            role: 'assistant' as const,
            content: `I understood your question and generated this SQL query:\n\n\`\`\`sql\n${data.sql}\n\`\`\`\n\nHowever, the query failed with error: ${queryError.message}\n\nLet me try a different approach or please refine your question.`,
            timestamp: new Date().toISOString(),
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
            placeholder={currentDatasetId ? "Ask about your financial data..." : "Upload data first..."}
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
        </div>
      </div>
    </div>
  );
}