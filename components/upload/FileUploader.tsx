'use client';

import { useCallback, useState, useEffect } from 'react';
import { useDropzone } from 'react-dropzone';
import { Upload, FileSpreadsheet, CheckCircle, AlertCircle, FileJson, FileText, Loader2 } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { api } from '@/lib/api';
import { useAppStore } from '@/lib/store';
import { initClientDatabase, createTableFromData, generateDatasetSummary } from '@/lib/clientDatabase';
import type { ParseProgress } from '@/lib/fileParser';

interface FileUploadState {
  status: 'idle' | 'uploading' | 'success' | 'error';
  progress: number;
  error?: string;
  phase?: 'reading' | 'parsing' | 'validating' | 'processing' | 'complete';
  message?: string;
  warnings?: string[];
}

export function FileUploader() {
  const [uploadState, setUploadState] = useState<FileUploadState>({
    status: 'idle',
    progress: 0,
  });
  
  const { addDataset, addAuditEvent } = useAppStore();
  
  // Initialize database on mount
  useEffect(() => {
    initClientDatabase().catch(console.error);
  }, []);

  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    const file = acceptedFiles[0];
    if (!file) return;

    setUploadState({ status: 'uploading', progress: 0, phase: 'reading' });
    
    try {
      // Step 1: Upload and parse file on server with progress tracking
      setUploadState({ 
        status: 'uploading', 
        progress: 10, 
        phase: 'reading',
        message: `Reading ${file.name}...`
      });
      
      const result = await api.uploadFile(file, (progress: ParseProgress) => {
        setUploadState(prev => ({
          ...prev,
          progress: Math.min(40, progress.percentage * 0.4),
          phase: progress.phase as any,
          message: `${progress.phase === 'parsing' ? 'Parsing' : progress.phase === 'validating' ? 'Validating' : 'Processing'} file...`
        }));
      });
      
      // Collect warnings
      const warnings = result.metadata?.warnings || [];
      
      // Step 2: Initialize client database
      setUploadState({ 
        status: 'uploading', 
        progress: 45, 
        phase: 'processing',
        message: 'Initializing database...',
        warnings
      });
      await initClientDatabase();
      
      // Step 3: Create tables in client-side DuckDB
      const tableNames = [];
      let tablesCreated = 0;
      const totalSheets = result.sheets?.length || 0;
      
      if ('sheets' in result && result.sheets && Array.isArray(result.sheets)) {
        for (const sheet of result.sheets) {
          if (sheet.data.length > 0) {
            const progress = 50 + (30 * tablesCreated / totalSheets);
            setUploadState({ 
              status: 'uploading', 
              progress,
              phase: 'processing',
              message: `Creating table for "${sheet.name}" (${sheet.data.length} rows)...`,
              warnings
            });
            
            const tableName = `${result.datasetId}_${sheet.name.toLowerCase().replace(/[^a-z0-9]/g, '_')}`;
            await createTableFromData(tableName, sheet.data);
            tableNames.push(tableName);
            tablesCreated++;
            
            // Add metadata warnings if any
            if (sheet.metadata?.hasMergedCells) {
              warnings.push(`Sheet "${sheet.name}" had merged cells that were expanded`);
            }
            if (sheet.metadata?.hasFormulas) {
              warnings.push(`Sheet "${sheet.name}" contained formulas (values were used)`);
            }
          } else {
            warnings.push(`Sheet "${sheet.name}" was empty and skipped`);
          }
        }
      }
      
      // Step 4: Generate comprehensive summary using DuckDB
      setUploadState({ 
        status: 'uploading', 
        progress: 85,
        phase: 'validating',
        message: 'Analyzing data structure...',
        warnings
      });
      
      const datasetType = (result.metadata?.type || 'general') as 'financial' | 'inventory' | 'sales' | 'hr' | 'general';
      const detailedSummary = tableNames.length > 0 
        ? await generateDatasetSummary(tableNames, datasetType)
        : result.summary;
      
      setUploadState({ 
        status: 'success', 
        progress: 100,
        phase: 'complete',
        warnings: warnings.length > 0 ? warnings : undefined
      });

      // Add to store with detailed summary
      addDataset({
        id: result.datasetId,
        name: file.name.replace(/\.[^/.]+$/, ''),
        uploadedAt: new Date().toISOString(),
        summary: detailedSummary,
      });

      // Store table names in global state for later use
      const tables = tableNames.map(name => ({ name, datasetId: result.datasetId }));
      localStorage.setItem(`dataset_${result.datasetId}_tables`, JSON.stringify(tables));

      // Add audit event with warnings
      const totalRows = detailedSummary.tables.reduce((acc, t) => acc + t.rows, 0);
      addAuditEvent({
        id: `upload_${Date.now()}`,
        at: new Date().toISOString(),
        summary: `Uploaded dataset: ${file.name}`,
        detail: `${detailedSummary.tables.length} tables created, ${totalRows} total rows${warnings.length > 0 ? `. Warnings: ${warnings.join('; ')}` : ''}`,
        category: 'upload'
      });

      // Reset after delay
      setTimeout(() => {
        setUploadState({ status: 'idle', progress: 0 });
      }, 3000);

    } catch (error) {
      console.error('Upload error:', error);
      setUploadState({
        status: 'error',
        progress: 0,
        error: error instanceof Error ? error.message : 'Failed to upload file. Please try again.',
      });
    }
  }, [addDataset, addAuditEvent]);

  const { getRootProps, getInputProps, isDragActive, acceptedFiles } = useDropzone({
    onDrop,
    accept: {
      'text/csv': ['.csv'],
      'text/tab-separated-values': ['.tsv'],
      'text/plain': ['.tsv'], // Some systems use text/plain for TSV
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
      'application/vnd.ms-excel': ['.xls'],
      'application/vnd.ms-excel.sheet.macroEnabled.12': ['.xlsm'],
      'application/json': ['.json'],
      'application/pdf': ['.pdf'],
    },
    maxFiles: 1,
    disabled: uploadState.status === 'uploading',
  });

  const getFileIcon = (fileName: string) => {
    const ext = fileName.split('.').pop()?.toLowerCase();
    switch (ext) {
      case 'json':
        return <FileJson className="h-5 w-5" />;
      case 'pdf':
        return <FileText className="h-5 w-5" />;
      default:
        return <FileSpreadsheet className="h-5 w-5" />;
    }
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const getUploadContent = () => {
    switch (uploadState.status) {
      case 'uploading':
        return (
          <div className="space-y-4">
            <Loader2 className="h-12 w-12 text-blue-600 mx-auto animate-spin" />
            <div className="space-y-2">
              <p className="font-medium">{uploadState.message || 'Processing your file...'}</p>
              <Progress value={uploadState.progress} className="w-64 mx-auto" />
              <p className="text-sm text-muted-foreground">
                {uploadState.progress}% complete
              </p>
              {uploadState.phase && (
                <Badge variant="secondary" className="mx-auto">
                  {uploadState.phase === 'reading' ? 'Reading file' :
                   uploadState.phase === 'parsing' ? 'Parsing data' :
                   uploadState.phase === 'validating' ? 'Validating' :
                   uploadState.phase === 'processing' ? 'Processing' : 'Finalizing'}
                </Badge>
              )}
            </div>
          </div>
        );

      case 'success':
        return (
          <div className="space-y-4">
            <CheckCircle className="h-12 w-12 text-green-600 mx-auto" />
            <div>
              <p className="font-medium text-green-700">Upload successful!</p>
              <p className="text-sm text-muted-foreground">Your data is ready for analysis</p>
            </div>
            {uploadState.warnings && uploadState.warnings.length > 0 && (
              <Alert className="text-left max-w-md mx-auto">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  <div className="space-y-1">
                    <p className="font-medium">Processing notes:</p>
                    {uploadState.warnings.map((warning, i) => (
                      <p key={i} className="text-xs">• {warning}</p>
                    ))}
                  </div>
                </AlertDescription>
              </Alert>
            )}
          </div>
        );

      case 'error':
        return (
          <div className="space-y-4">
            <AlertCircle className="h-12 w-12 text-red-600 mx-auto" />
            <div>
              <p className="font-medium text-red-700">Upload failed</p>
              <p className="text-sm text-muted-foreground">{uploadState.error}</p>
            </div>
            <Button 
              onClick={() => setUploadState({ status: 'idle', progress: 0 })}
              variant="outline"
            >
              Try Again
            </Button>
          </div>
        );

      default:
        return (
          <div className="space-y-4">
            <Upload className={`h-12 w-12 mx-auto transition-colors ${
              isDragActive ? 'text-blue-600' : 'text-muted-foreground'
            }`} />
            <div>
              <p className="font-medium">
                {isDragActive ? 'Drop your file here' : 'Upload your financial data'}
              </p>
              <p className="text-sm text-muted-foreground">
                Drag & drop or click to browse
              </p>
            </div>
            
            {acceptedFiles.length > 0 && (
              <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
                {getFileIcon(acceptedFiles[0].name)}
                <span>{acceptedFiles[0].name}</span>
                <span>({formatFileSize(acceptedFiles[0].size)})</span>
              </div>
            )}
            
            <div className="flex gap-2 flex-wrap justify-center">
              <Badge variant="secondary">
                <FileSpreadsheet className="h-3 w-3 mr-1" />
                CSV
              </Badge>
              <Badge variant="secondary">
                <FileSpreadsheet className="h-3 w-3 mr-1" />
                TSV
              </Badge>
              <Badge variant="secondary">
                <FileSpreadsheet className="h-3 w-3 mr-1" />
                Excel
              </Badge>
              <Badge variant="secondary">
                <FileJson className="h-3 w-3 mr-1" />
                JSON
              </Badge>
              <Badge variant="secondary">
                <FileText className="h-3 w-3 mr-1" />
                PDF
              </Badge>
            </div>
            
            <Button variant="outline">Browse Files</Button>
          </div>
        );
    }
  };

  return (
    <Card className="w-full max-w-2xl mx-auto">
      <CardContent className="p-8">
        <div
          {...getRootProps()}
          className={`
            border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-all
            ${isDragActive 
              ? 'border-blue-500 bg-blue-50 dark:bg-blue-950/20' 
              : 'border-muted-foreground/25 hover:border-muted-foreground/50'
            }
            ${uploadState.status !== 'idle' ? 'pointer-events-none' : ''}
          `}
        >
          <input {...getInputProps()} />
          {getUploadContent()}
        </div>
      </CardContent>
    </Card>
  );
}