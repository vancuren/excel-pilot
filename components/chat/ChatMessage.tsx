'use client';

import { format } from 'date-fns';
import { User, Bot, FileText, Download } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ChatMessage as ChatMessageType } from '@/types';

interface ChatMessageProps {
  message: ChatMessageType;
}

export function ChatMessage({ message }: ChatMessageProps) {
  const isUser = message.role === 'user';

  return (
    <div className={`flex gap-3 ${isUser ? 'flex-row-reverse' : 'flex-row'}`}>
      <div className={`
        flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center
        ${isUser ? 'bg-blue-100 dark:bg-blue-900' : 'bg-green-100 dark:bg-green-900'}
      `}>
        {isUser ? (
          <User className="h-4 w-4 text-blue-600 dark:text-blue-400" />
        ) : (
          <Bot className="h-4 w-4 text-green-600 dark:text-green-400" />
        )}
      </div>

      <div className={`flex-1 max-w-[85%] ${isUser ? 'text-right' : 'text-left'}`}>
        <Card className={`${isUser ? 'bg-blue-50 dark:bg-blue-950/20' : 'bg-muted/30'}`}>
          <CardContent className="p-3">
            <div className="prose prose-sm max-w-none dark:prose-invert">
              <p className="text-sm leading-relaxed whitespace-pre-wrap">
                {message.content}
              </p>
            </div>
            
            {message.artifacts && message.artifacts.length > 0 && (
              <div className="mt-3 pt-3 border-t space-y-2">
                <p className="text-xs font-medium text-muted-foreground">Generated Files:</p>
                <div className="space-y-1">
                  {message.artifacts.map((artifact, idx) => (
                    <Button
                      key={idx}
                      variant="ghost"
                      size="sm"
                      className="h-auto p-2 justify-start w-full"
                      onClick={() => window.open(artifact.url, '_blank')}
                    >
                      <div className="flex items-center gap-2 w-full">
                        {artifact.kind === 'pdf' ? (
                          <FileText className="h-4 w-4 text-red-500" />
                        ) : (
                          <Download className="h-4 w-4 text-green-500" />
                        )}
                        <span className="text-xs truncate flex-1 text-left">
                          {artifact.name}
                        </span>
                        {artifact.size && (
                          <span className="text-xs text-muted-foreground">
                            {(artifact.size / 1024).toFixed(1)}KB
                          </span>
                        )}
                      </div>
                    </Button>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
        
        <p className="text-xs text-muted-foreground mt-1 px-1">
          {format(new Date(message.timestamp), 'HH:mm')}
        </p>
      </div>
    </div>
  );
}