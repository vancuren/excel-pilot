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
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-green-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900">
        <AppHeader />
        
        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="text-center mb-12 space-y-4">
            <h1 className="text-4xl sm:text-5xl font-bold bg-gradient-to-r from-green-600 via-green-800 to-green-600 bg-clip-text text-transparent">
              Transform Your Financial Data
            </h1>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
              Upload you spreadsheets or PDFs, ask questions, and then automate accounting workflows with AI-powered insights
            </p>
          </div>

          <div className="grid lg:grid-cols-1 gap-12 items-start">
            <div className="space-y-8">
              <FileUploader />
              
              {/* <div className="grid sm:grid-cols-2 gap-4">
                <Card>
                  <CardContent className="p-6">
                    <div className="flex items-start gap-3">
                      <div className="bg-blue-100 dark:bg-blue-900 p-2 rounded-lg">
                        <Sparkles className="h-5 w-5 text-blue-600" />
                      </div>
                      <div>
                        <h3 className="font-semibold mb-1">AI-Powered Analysis</h3>
                        <p className="text-sm text-muted-foreground">
                          Ask questions in natural language and get instant insights from your financial data
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className="p-6">
                    <div className="flex items-start gap-3">
                      <div className="bg-green-100 dark:bg-green-900 p-2 rounded-lg">
                        <Zap className="h-5 w-5 text-green-600" />
                      </div>
                      <div>
                        <h3 className="font-semibold mb-1">Automated Workflows</h3>
                        <p className="text-sm text-muted-foreground">
                          Generate invoices, create vouchers, and route approvals with one click
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div> */}
            </div>

            {/* <div className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <TrendingUp className="h-5 w-5" />
                    What you can do
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-3">
                    <div className="flex items-center gap-2">
                      <Badge variant="outline">Analysis</Badge>
                      <span className="text-sm">Find overdue vendors and payment trends</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline">Automation</Badge>
                      <span className="text-sm">Generate payment reminders and reports</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline">Reconciliation</Badge>
                      <span className="text-sm">Match transactions and identify discrepancies</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline">Compliance</Badge>
                      <span className="text-sm">Create audit trails and journal entries</span>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-6">
                  <div className="flex items-start gap-3">
                    <Shield className="h-5 w-5 text-orange-600 mt-1" />
                    <div>
                      <h3 className="font-semibold mb-2">Enterprise Security</h3>
                      <p className="text-sm text-muted-foreground mb-3">
                        Your data never leaves your browser. All processing happens locally with optional cloud backup.
                      </p>
                      <p className="text-xs text-muted-foreground italic">
                        Nothing is sent without your confirmation. All actions are logged to the audit trail.
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div> */}
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