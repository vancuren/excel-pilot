'use client';

import { ReactNode } from 'react';
import { ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ActionSuggestion } from '@/types';

interface ActionButtonProps {
  suggestion: ActionSuggestion;
  onClick: () => void;
  icon: ReactNode;
}

export function ActionButton({ suggestion, onClick, icon }: ActionButtonProps) {
  const getCategoryColor = () =>
    'bg-muted/50 hover:bg-muted/70 border-border/60 text-foreground';

  return (
    <Button
      variant="ghost"
      className={`w-full justify-start h-auto p-3 rounded-xl border transition-all duration-200 shadow-sm hover:shadow-md hover:-translate-y-0.5 ${getCategoryColor()}`}
      onClick={onClick}
    >
      <div className="flex items-center gap-3 w-full">
        <div className="h-7 w-7 rounded-md bg-background/60 flex items-center justify-center border border-border/60">
          {icon}
        </div>
        <span className="text-sm font-medium text-left flex-1">
          {suggestion.label}
        </span>
        <ChevronRight className="h-4 w-4 opacity-60" />
      </div>
    </Button>
  );
}
