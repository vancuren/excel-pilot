'use client';

import { useState } from 'react';
import { format } from 'date-fns';
import { User, Bot, FileText, Download, Copy, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ChatMessage as ChatMessageType } from '@/types';
import { ToolActions } from './ToolActions';
import { marked } from 'marked';

interface ChatMessageProps {
  message: ChatMessageType & { queryData?: any[] };
}

export function ChatMessage({ message }: ChatMessageProps) {
  const isUser = message.role === 'user';
  const [copied, setCopied] = useState(false);

  const styleContent = (content: string) => {
    return content
      .replace(/^## (.*$)/gim, '<span class="font-bold text-lg">$1</span>')
      .replace(/^### (.*$)/gim, '<span class="font-semibold text-base">$1</span>')
      .replace(/\*\*(.*?)\*\*/gim, '<span class="font-bold">$1</span>')
      .replace(/\*(.*?)\*/gim, '<span class="italic">$1</span>');
  }

  const chatContent = isUser ? message.content : styleContent(message.content);

  console.log(chatContent);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(message.content);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {}
  };

  return (
    <div className="flex items-start gap-3 group">
      {/* Avatar */}
      <div className={`
        flex-shrink-0 w-8 h-8 rounded-xl flex items-center justify-center border transition-all duration-200
        ${isUser 
          ? 'bg-gradient-to-br from-primary to-primary/80 border-primary/20 text-primary-foreground shadow-sm' 
          : 'bg-gradient-to-br from-primary/10 to-primary/5 border-primary/20 text-primary'
        }
      `}>
        {isUser ? (
          <User className="h-4 w-4" />
        ) : (
          <Bot className="h-4 w-4" />
        )}
      </div>

      {/* Message Content */}
      <div className="flex-1 min-w-0">
        <div className={`relative rounded-2xl px-5 py-4 max-w-full transition-all duration-200 shadow-sm
          ${isUser 
            ? 'bg-primary text-primary-foreground ml-8' 
            : 'bg-muted/50 border border-border/50 hover:bg-muted/70'
          }
        `}>
          {/* Bubble tails */}
          {isUser ? (
            <span className="absolute -right-1 top-4 h-3 w-3 rotate-45 bg-primary" />
          ) : (
            <span className="absolute -left-1 top-4 h-3 w-3 rotate-45 bg-muted/50 border border-border/50" />
          )}

          {/* Copy button for assistant */}
          {!isUser && (
            <button
              aria-label="Copy"
              onClick={handleCopy}
              className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-foreground"
            >
              {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
            </button>
          )}

          <div className="markdown-body">

            {isUser ? (
              <p className={`text-sm leading-relaxed whitespace-pre-wrap m-0 text-primary-foreground`}>
                {message.content}
              </p>
            ) : (
              <div
                id="chat-message-content"
                className="text-sm leading-relaxed whitespace-normal m-0 text-foreground"
                dangerouslySetInnerHTML={{ __html: marked.parse(message.content) as string }}
              />
            )}

            {/* <p className={`text-sm leading-relaxed whitespace-pre-wrap m-0 ${
              isUser ? 'text-primary-foreground' : 'text-foreground'
            }`}>
              {isUser ? message.content : marked.parse(message.content)}
            </p> */}
          </div>
          
          {message.artifacts && message.artifacts.length > 0 && (
            <div className="mt-4 pt-4 border-t border-border/30 space-y-3">
              <p className="text-xs font-medium text-muted-foreground">Generated Files:</p>
              <div className="space-y-2">
                {message.artifacts.map((artifact, idx) => (
                  <Button
                    key={idx}
                    variant="ghost"
                    size="sm"
                    className="h-auto p-3 justify-start w-full hover:bg-background/80 rounded-lg"
                    onClick={() => window.open(artifact.url, '_blank')}
                  >
                    <div className="flex items-center gap-2 w-full">
                      {artifact.kind === 'pdf' ? (
                        <FileText className="h-4 w-4 text-red-500" />
                      ) : (
                        <Download className="h-4 w-4 text-green-500" />
                      )}
                      <span className="text-sm truncate flex-1 text-left">
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
            <div className="mt-4 pt-4 border-t border-border/30">
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
        <p className="text-xs text-muted-foreground mt-2 px-1 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
          {format(new Date(message.timestamp), 'HH:mm')}
        </p>
      </div>
    </div>
  );
}
