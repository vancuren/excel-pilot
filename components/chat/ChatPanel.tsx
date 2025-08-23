'use client';

import { useState } from 'react';
import { Send, Sparkles, FileDown, Receipt, Mail, CheckSquare } from 'lucide-react';
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
    <Card className="h-full flex flex-col">
      <CardHeader className="pb-4">
        <CardTitle className="flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-blue-600" />
          AI Assistant
        </CardTitle>
        {!currentDatasetId && (
          <p className="text-sm text-muted-foreground">
            Upload data to start asking questions
          </p>
        )}
      </CardHeader>

      <CardContent className="flex-1 flex flex-col gap-4 min-h-0">
        {/* Chat Messages */}
        <ScrollArea className="flex-1 pr-4">
          <div className="space-y-4">
            {chatMessages.length === 0 ? (
              <div className="text-center py-8 space-y-2">
                <Sparkles className="h-8 w-8 text-muted-foreground mx-auto" />
                <p className="text-sm text-muted-foreground">
                  Ask about overdue vendors, cash reconciliation, or JE creation
                </p>
              </div>
            ) : (
              chatMessages.map((message) => (
                <ChatMessage key={message.id} message={message} />
              ))
            )}
            
            {isTyping && (
              <div className="flex gap-2 items-center text-sm text-muted-foreground">
                <div className="flex space-x-1">
                  <div className="animate-bounce w-2 h-2 bg-blue-600 rounded-full" />
                  <div className="animate-bounce w-2 h-2 bg-blue-600 rounded-full" style={{ animationDelay: '0.1s' }} />
                  <div className="animate-bounce w-2 h-2 bg-blue-600 rounded-full" style={{ animationDelay: '0.2s' }} />
                </div>
                AI is thinking...
              </div>
            )}
          </div>
        </ScrollArea>

        {/* Smart Actions */}
        {suggestions.length > 0 && (
          <>
            <Separator />
            <div className="space-y-3">
              <h4 className="text-sm font-medium flex items-center gap-2">
                <Sparkles className="h-4 w-4" />
                Smart Actions
              </h4>
              <div className="space-y-2">
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
          </>
        )}

        {/* Message Input */}
        <div className="flex gap-2">
          <Input
            placeholder="Ask about your financial data..."
            value={inputMessage}
            onChange={(e) => setInputMessage(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSendMessage();
              }
            }}
            disabled={!currentDatasetId || isTyping}
          />
          <Button 
            onClick={handleSendMessage} 
            disabled={!inputMessage.trim() || !currentDatasetId || isTyping}
            size="icon"
          >
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}