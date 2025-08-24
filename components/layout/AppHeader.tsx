'use client';

import { MoonIcon, SunIcon, Database, FileSpreadsheet, Command as CommandIcon } from 'lucide-react';
import { useTheme } from 'next-themes';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useAppStore } from '@/lib/store';
import { CommandMenu } from './CommandMenu';

export function AppHeader() {
  const { theme, setTheme } = useTheme();
  const { datasets, currentDatasetId, setCurrentDataset } = useAppStore();

  return (
    <header className="border-b border-border/50 bg-background/80 backdrop-blur-md sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-6">
        <div className="flex items-center justify-between h-14">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg border border-border/60 bg-muted/50">
                <FileSpreadsheet className="h-5 w-5" />
              </div>
              <div>
                <h1 className="text-lg font-semibold tracking-tight">ExcelPilot</h1>
                <p className="text-xs text-muted-foreground -mt-0.5">AI Accounting Assistant</p>
              </div>
            </div>
            
            {datasets.length > 0 && (
              <Select value={currentDatasetId || undefined} onValueChange={setCurrentDataset}>
                <SelectTrigger className="w-56 h-9 bg-muted/50 border-border/60 hover:bg-muted/70 transition-colors rounded-lg">
                  <Database className="h-4 w-4 mr-2 text-muted-foreground" />
                  <SelectValue placeholder="Select dataset" />
                </SelectTrigger>
                <SelectContent>
                  {datasets.map((dataset) => (
                    <SelectItem key={dataset.id} value={dataset.id}>
                      {dataset.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>

          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="sm"
              className="h-9 px-3 hover:bg-muted/80 gap-2 hidden sm:flex"
              onClick={() => {
                const event = new KeyboardEvent('keydown', { key: 'k', metaKey: true });
                window.dispatchEvent(event);
              }}
            >
              <CommandIcon className="h-4 w-4" />
              <span className="text-sm">Command</span>
              <kbd className="ml-1 text-[10px] text-muted-foreground">⌘K</kbd>
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-9 w-9 hover:bg-muted/80"
              onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
            >
              <SunIcon className="h-4 w-4 rotate-0 scale-100 transition-all duration-200 dark:-rotate-90 dark:scale-0" />
              <MoonIcon className="h-4 w-4 absolute rotate-90 scale-0 transition-all duration-200 dark:rotate-0 dark:scale-100" />
              <span className="sr-only">Toggle theme</span>
            </Button>
          </div>
        </div>
      </div>
      <CommandMenu />
    </header>
  );
}
