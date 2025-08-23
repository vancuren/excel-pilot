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
      case 'invoice': return 'border-purple-200 hover:bg-purple-50 dark:border-purple-800 dark:hover:bg-purple-950/20';
      case 'export': return 'border-green-200 hover:bg-green-50 dark:border-green-800 dark:hover:bg-green-950/20';
      case 'approval': return 'border-orange-200 hover:bg-orange-50 dark:border-orange-800 dark:hover:bg-orange-950/20';
      case 'voucher': return 'border-blue-200 hover:bg-blue-50 dark:border-blue-800 dark:hover:bg-blue-950/20';
      default: return 'border-gray-200 hover:bg-gray-50 dark:border-gray-800 dark:hover:bg-gray-950/20';
    }
  };

  return (
    <Button
      variant="outline"
      className={`w-full justify-start h-auto p-3 ${getCategoryColor(suggestion.category)}`}
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