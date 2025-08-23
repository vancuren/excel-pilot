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
      case 'invoice': return 'bg-purple-50 hover:bg-purple-100 border-purple-200 text-purple-700 dark:bg-purple-950/20 dark:hover:bg-purple-950/40 dark:border-purple-800 dark:text-purple-300';
      case 'export': return 'bg-green-50 hover:bg-green-100 border-green-200 text-green-700 dark:bg-green-950/20 dark:hover:bg-green-950/40 dark:border-green-800 dark:text-green-300';
      case 'approval': return 'bg-orange-50 hover:bg-orange-100 border-orange-200 text-orange-700 dark:bg-orange-950/20 dark:hover:bg-orange-950/40 dark:border-orange-800 dark:text-orange-300';
      case 'voucher': return 'bg-blue-50 hover:bg-blue-100 border-blue-200 text-blue-700 dark:bg-blue-950/20 dark:hover:bg-blue-950/40 dark:border-blue-800 dark:text-blue-300';
      default: return 'bg-gray-50 hover:bg-gray-100 border-gray-200 text-gray-700 dark:bg-gray-950/20 dark:hover:bg-gray-950/40 dark:border-gray-800 dark:text-gray-300';
    }
  };

  return (
    <Button
      variant="ghost"
      className={`w-full justify-start h-auto p-2.5 rounded-lg border transition-all duration-200 ${getCategoryColor(suggestion.category)}`}
      onClick={onClick}
    >
      <div className="flex items-center gap-2.5 w-full">
        {icon}
        <span className="text-xs font-medium text-left flex-1">
          {suggestion.label}
        </span>
      </div>
    </Button>
  );
}