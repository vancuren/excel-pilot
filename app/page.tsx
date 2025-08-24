'use client';

import { useEffect } from 'react';
import { FileUploader } from '@/components/upload/FileUploader';
import { AppHeader } from '@/components/layout/AppHeader';
import { SplitLayout } from '@/components/layout/SplitLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useAppStore } from '@/lib/store';
import { Sparkles, Shield, Zap, TrendingUp } from 'lucide-react';

export default function Home() {
  const { currentDatasetId, datasets } = useAppStore();

  if (!currentDatasetId && datasets.length === 0) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background via-muted/20 to-background relative overflow-hidden">
        <AppHeader />
        {/* Decorative background */}
        <div className="pointer-events-none absolute inset-0 bg-radial-soft" />

        <main className="relative max-w-6xl mx-auto px-6 py-16">
          <div className="text-center mb-14 space-y-6">
            <h1 className="text-4xl sm:text-5xl font-bold tracking-tight">
              Transform Your Financial Data
            </h1>
            <p className="text-lg sm:text-xl text-muted-foreground max-w-2xl mx-auto leading-relaxed">
              Upload spreadsheets or PDFs, ask questions, and automate workflows with AI-powered analysis.
            </p>
            <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground">
              <span className="px-2 py-1 rounded bg-muted/60">Client-side DuckDB</span>
              <span className="px-2 py-1 rounded bg-muted/60">Privacy-first</span>
              <span className="px-2 py-1 rounded bg-muted/60">Dark mode</span>
            </div>
          </div>

          <div className="max-w-3xl mx-auto">
            <div className="space-y-10">
              <FileUploader />
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
                <div className="rounded-lg border border-border/60 bg-card p-4 text-left">
                  <div className="text-sm font-medium">Instant insights</div>
                  <p className="text-xs text-muted-foreground mt-1">Ask natural questions; get SQL and charts.</p>
                </div>
                <div className="rounded-lg border border-border/60 bg-card p-4 text-left">
                  <div className="text-sm font-medium">Trust & control</div>
                  <p className="text-xs text-muted-foreground mt-1">Process data locally with DuckDB WASM.</p>
                </div>
                <div className="rounded-lg border border-border/60 bg-card p-4 text-left">
                  <div className="text-sm font-medium">Automations</div>
                  <p className="text-xs text-muted-foreground mt-1">Export, reconcile, and generate documents.</p>
                </div>
              </div>
            </div>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <AppHeader />
      <SplitLayout />
    </div>
  );
}
