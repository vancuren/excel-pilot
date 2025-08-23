'use client';

import { format } from 'date-fns';
import { User, Bot, FileText, Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ChatMessage as ChatMessageType } from '@/types';
import { ToolActions } from './ToolActions';

interface ChatMessageProps {
  message: ChatMessageType & { queryData?: any[] };
}

export function ChatMessage({ message }: ChatMessageProps) {
  const isUser = message.role === 'user';

  return (
    <div className="flex items-start gap-3 group">
      {/* Avatar */}
      <div className={`
        flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center border transition-all duration-200
        ${isUser 
          ? 'bg-gradient-to-br from-blue-500 to-blue-600 border-blue-200/20 text-white' 
          : 'bg-gradient-to-br from-blue-500/10 to-purple-600/10 border-blue-200/20 text-blue-500'
        }
      `}>
        {isUser ? (
          <User className="h-3.5 w-3.5" />
        ) : (
          <Bot className="h-3.5 w-3.5" />
        )}
      </div>

      {/* Message Content */}
      <div className="flex-1 min-w-0">
        <div className={`
          rounded-2xl px-4 py-3 max-w-full transition-all duration-200
          ${isUser 
            ? 'bg-blue-600 text-white ml-8' 
            : 'bg-muted/60 border border-border/40 hover:bg-muted/80'
          }
        `}>
          <div className="prose prose-sm max-w-none dark:prose-invert">
            <p className={`text-sm leading-relaxed whitespace-pre-wrap m-0 ${
              isUser ? 'text-white' : 'text-foreground'
            }`}>
              {message.content}
            </p>
          </div>
          
          {message.artifacts && message.artifacts.length > 0 && (
            <div className="mt-3 pt-3 border-t border-border/20 space-y-2">
              <p className="text-xs font-medium text-muted-foreground">Generated Files:</p>
              <div className="space-y-1">
                {message.artifacts.map((artifact, idx) => (
                  <Button
                    key={idx}
                    variant="ghost"
                    size="sm"
                    className="h-auto p-2 justify-start w-full hover:bg-background/80"
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
          
          {/* Add tool actions for assistant messages with data */}
          {!isUser && message.queryData && message.queryData.length > 0 && (
            <div className="mt-3 pt-3 border-t border-border/20">
              <ToolActions 
                message={message.content} 
                data={message.queryData}
                onToolExecuted={(result) => {
                  console.log('Tool executed:', result);
                }}
              />
            </div>
          )}
        </div>
        
        {/* Timestamp */}
        <p className="text-xs text-muted-foreground mt-1.5 px-1 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
          {format(new Date(message.timestamp), 'HH:mm')}
        </p>
      </div>
    </div>
  );
}