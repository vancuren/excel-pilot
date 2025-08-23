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
      <div className="min-h-screen bg-gradient-to-br from-background via-muted/20 to-background">
        <AppHeader />
        
        <main className="max-w-6xl mx-auto px-6 py-16">
          <div className="text-center mb-16 space-y-6">
            <h1 className="text-4xl sm:text-5xl font-bold text-foreground tracking-tight">
              Transform Your Financial Data
            </h1>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto leading-relaxed">
              Upload your spreadsheets or PDFs, ask questions, and automate accounting workflows with AI-powered insights
            </p>
          </div>

          <div className="max-w-3xl mx-auto">
            <div className="space-y-12">
              <FileUploader />
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