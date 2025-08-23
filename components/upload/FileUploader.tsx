'use client';

import { useCallback, useState } from 'react';
import { useDropzone } from 'react-dropzone';
import { Upload, FileSpreadsheet, CheckCircle, AlertCircle } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import { api } from '@/lib/api';
import { useAppStore } from '@/lib/store';

interface FileUploadState {
  status: 'idle' | 'uploading' | 'success' | 'error';
  progress: number;
  error?: string;
}

export function FileUploader() {
  const [uploadState, setUploadState] = useState<FileUploadState>({
    status: 'idle',
    progress: 0,
  });
  
  const { addDataset, addAuditEvent } = useAppStore();

  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    const file = acceptedFiles[0];
    if (!file) return;

    setUploadState({ status: 'uploading', progress: 0 });

    try {
      // Simulate upload progress
      const progressInterval = setInterval(() => {
        setUploadState(prev => ({
          ...prev,
          progress: Math.min(prev.progress + 10, 90)
        }));
      }, 150);

      const result = await api.uploadFile(file);
      
      clearInterval(progressInterval);
      setUploadState({ status: 'success', progress: 100 });

      // Add to store
      addDataset({
        id: result.datasetId,
        name: file.name.replace(/\.[^/.]+$/, ''),
        uploadedAt: new Date().toISOString(),
        summary: result.summary,
      });

      // Add audit event
      addAuditEvent({
        id: `upload_${Date.now()}`,
        at: new Date().toISOString(),
        summary: `Uploaded dataset: ${file.name}`,
        detail: `${result.summary.tables.length} tables detected, ${result.summary.tables.reduce((acc, t) => acc + t.rows, 0)} total rows`,
        category: 'upload'
      });

      // Reset after delay
      setTimeout(() => {
        setUploadState({ status: 'idle', progress: 0 });
      }, 2000);

    } catch (error) {
      setUploadState({
        status: 'error',
        progress: 0,
        error: 'Failed to upload file. Please try again.',
      });
    }
  }, [addDataset, addAuditEvent]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'text/csv': ['.csv'],
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
      'application/vnd.ms-excel': ['.xls'],
      'application/pdf': ['.pdf'],
    },
    maxFiles: 1,
  });

  const getUploadContent = () => {
    switch (uploadState.status) {
      case 'uploading':
        return (
          <div className="space-y-4">
            <div className="animate-spin mx-auto">
              <FileSpreadsheet className="h-12 w-12 text-blue-600" />
            </div>
            <div className="space-y-2">
              <p className="font-medium">Processing your file...</p>
              <Progress value={uploadState.progress} className="w-64 mx-auto" />
              <p className="text-sm text-muted-foreground">{uploadState.progress}% complete</p>
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
                {isDragActive ? 'Drop your file here' : 'Upload spreadsheet or PDF'}
              </p>
              <p className="text-sm text-muted-foreground">
                Supports CSV, XLSX, XLS, and PDF files
              </p>
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