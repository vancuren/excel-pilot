'use client';

import { MoonIcon, SunIcon, Database, FileSpreadsheet } from 'lucide-react';
import { useTheme } from 'next-themes';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useAppStore } from '@/lib/store';

export function AppHeader() {
  const { theme, setTheme } = useTheme();
  const { datasets, currentDatasetId, setCurrentDataset } = useAppStore();

  return (
    <header className="border-b bg-background/80 backdrop-blur-sm sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <div className="bg-gradient-to-r from-blue-600 to-green-600 p-2 rounded-lg">
                <FileSpreadsheet className="h-6 w-6 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-bold bg-gradient-to-r from-blue-600 to-green-600 bg-clip-text text-transparent">
                  SheetPilot
                </h1>
                <p className="text-xs text-muted-foreground">AI Accounting Automator</p>
              </div>
            </div>
            
            {datasets.length > 0 && (
              <Select value={currentDatasetId || undefined} onValueChange={setCurrentDataset}>
                <SelectTrigger className="w-64">
                  <Database className="h-4 w-4 mr-2" />
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

          <Button
            variant="outline"
            size="icon"
            onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
          >
            <SunIcon className="h-4 w-4 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
            <MoonIcon className="h-4 w-4 absolute rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
            <span className="sr-only">Toggle theme</span>
          </Button>
        </div>
      </div>
    </header>
  );
}