'use client';

import { useEffect, useState } from 'react';
import { Database, Moon, SunMedium, Trash2, Upload, Command as CommandIcon, HelpCircle } from 'lucide-react';
import { CommandDialog, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList, CommandSeparator } from '@/components/ui/command';
import { useTheme } from 'next-themes';
import { useAppStore } from '@/lib/store';

export function CommandMenu() {
  const [open, setOpen] = useState(false);
  const { theme, setTheme } = useTheme();
  const { datasets, currentDatasetId, setCurrentDataset, clearChat } = useAppStore();

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.key === 'k' || e.key === 'K') && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((v) => !v);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  return (
    <CommandDialog open={open} onOpenChange={setOpen}>
      <CommandInput placeholder="Search actions..." />
      <CommandList>
        <CommandEmpty>No results found.</CommandEmpty>

        <CommandGroup heading="Quick Actions">
          <CommandItem onSelect={() => { setOpen(false); document.querySelector<HTMLInputElement>('input[type=file]')?.click(); }}>
            <Upload className="mr-2 h-4 w-4" />
            <span>Upload data</span>
            <span className="ml-auto text-xs text-muted-foreground">U</span>
          </CommandItem>
          <CommandItem onSelect={() => { setOpen(false); clearChat(); }}>
            <Trash2 className="mr-2 h-4 w-4" />
            <span>Clear chat</span>
          </CommandItem>
          {theme === 'dark' ? (
            <CommandItem onSelect={() => { setTheme('light'); setOpen(false); }}>
              <SunMedium className="mr-2 h-4 w-4" />
              <span>Switch to Light</span>
            </CommandItem>
          ) : (
            <CommandItem onSelect={() => { setTheme('dark'); setOpen(false); }}>
              <Moon className="mr-2 h-4 w-4" />
              <span>Switch to Dark</span>
            </CommandItem>
          )}
        </CommandGroup>

        {datasets.length > 0 && (
          <>
            <CommandSeparator />
            <CommandGroup heading="Datasets">
              {datasets.map((d) => (
                <CommandItem key={d.id} onSelect={() => { setCurrentDataset(d.id); setOpen(false); }}>
                  <Database className="mr-2 h-4 w-4" />
                  <span>{d.name}</span>
                  {currentDatasetId === d.id && (
                    <span className="ml-auto text-xs text-primary">Current</span>
                  )}
                </CommandItem>
              ))}
            </CommandGroup>
          </>
        )}

        <CommandSeparator />
        <CommandGroup heading="Help">
          <CommandItem onSelect={() => { setOpen(false); window.open('https://github.com', '_blank'); }}>
            <HelpCircle className="mr-2 h-4 w-4" />
            <span>Docs & setup</span>
          </CommandItem>
          <CommandItem onSelect={() => setOpen(false)}>
            <CommandIcon className="mr-2 h-4 w-4" />
            <span>Shortcuts: ⌘K to open</span>
          </CommandItem>
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  );
}

