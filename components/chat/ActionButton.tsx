'use client';

import { ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { ActionSuggestion } from '@/types';

interface ActionButtonProps {
  suggestion: ActionSuggestion;
  onClick: () => void;
  icon: ReactNode;
}

export function ActionButton({ suggestion, onClick, icon }: ActionButtonProps) {
  const getCategoryColor = (category: string) => {
    switch (category) {
      case 'invoice': return 'bg-purple-50 hover:bg-purple-100 border-purple-200/60 text-purple-700 dark:bg-purple-950/30 dark:hover:bg-purple-950/50 dark:border-purple-800/60 dark:text-purple-300';
      case 'export': return 'bg-green-50 hover:bg-green-100 border-green-200/60 text-green-700 dark:bg-green-950/30 dark:hover:bg-green-950/50 dark:border-green-800/60 dark:text-green-300';
      case 'approval': return 'bg-orange-50 hover:bg-orange-100 border-orange-200/60 text-orange-700 dark:bg-orange-950/30 dark:hover:bg-orange-950/50 dark:border-orange-800/60 dark:text-orange-300';
      case 'voucher': return 'bg-blue-50 hover:bg-blue-100 border-blue-200/60 text-blue-700 dark:bg-blue-950/30 dark:hover:bg-blue-950/50 dark:border-blue-800/60 dark:text-blue-300';
      default: return 'bg-muted/50 hover:bg-muted/80 border-border/60 text-foreground';
    }
  };

  return (
    <Button
      variant="ghost"
      className={`w-full justify-start h-auto p-3 rounded-xl border transition-all duration-200 shadow-sm hover:shadow-md ${getCategoryColor(suggestion.category)}`}
      onClick={onClick}
    >
      <div className="flex items-center gap-3 w-full">
        {icon}
        <span className="text-sm font-medium text-left flex-1">
          {suggestion.label}
        </span>
      </div>
    </Button>
  );
}