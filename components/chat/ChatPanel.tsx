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
      const response = await api.sendChatMessage(currentDatasetId, inputMessage);
      response.messages.forEach(addMessage);
    } catch (error) {
      console.error('Chat error:', error);
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