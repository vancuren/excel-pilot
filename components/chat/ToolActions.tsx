'use client';

import { useState } from 'react';
import { 
  FileDown, 
  Mail, 
  FileText, 
  Download, 
  Send,
  Loader2,
  FileSpreadsheet,
  Receipt
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { 
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { toast } from 'sonner';

interface ToolActionsProps {
  message: string;
  data?: any[];
  onToolExecuted?: (result: any) => void;
}

export function ToolActions({ message, data = [], onToolExecuted }: ToolActionsProps) {
  const [isGenerating, setIsGenerating] = useState(false);
  const [showEmailDialog, setShowEmailDialog] = useState(false);
  const [emailRecipient, setEmailRecipient] = useState('');
  const [emailType, setEmailType] = useState<'report' | 'invoice' | 'reminder' | 'statement'>('report');
  const [reportFormat, setReportFormat] = useState<'pdf' | 'excel' | 'html'>('pdf');
  const [showReportDialog, setShowReportDialog] = useState(false);

  const handleGenerateReport = async () => {
    setIsGenerating(true);
    try {
      const response = await fetch('/api/tools', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          tool: 'generateReport',
          params: {
            title: `Analysis Report - ${new Date().toLocaleDateString()}`,
            data,
            format: reportFormat,
            userQuery: message
          }
        }),
      });

      if (response.ok) {
        // Handle file download
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `report_${Date.now()}.${reportFormat === 'excel' ? 'xlsx' : reportFormat}`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
        
        toast.success('Report generated successfully!');
        setShowReportDialog(false);
        onToolExecuted?.({ type: 'report', format: reportFormat });
      } else {
        throw new Error('Failed to generate report');
      }
    } catch (error) {
      console.error('Report generation error:', error);
      toast.error('Failed to generate report');
    }
    setIsGenerating(false);
  };

  const handleGenerateEmail = async () => {
    if (!emailRecipient) {
      toast.error('Please enter a recipient email');
      return;
    }

    setIsGenerating(true);
    try {
      const response = await fetch('/api/tools', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          tool: 'generateEmail',
          params: {
            type: emailType,
            recipient: emailRecipient,
            data,
            context: message
          }
        }),
      });

      if (response.ok) {
        const result = await response.json();
        
        // Open email client with generated content
        const subject = encodeURIComponent(`${emailType.charAt(0).toUpperCase() + emailType.slice(1)} - ${new Date().toLocaleDateString()}`);
        const body = encodeURIComponent(result.content || 'Please find the attached report.');
        const mailtoLink = `mailto:${emailRecipient}?subject=${subject}&body=${body}`;
        window.open(mailtoLink);
        
        toast.success('Email draft created!');
        setShowEmailDialog(false);
        onToolExecuted?.({ type: 'email', emailType });
      } else {
        throw new Error('Failed to generate email');
      }
    } catch (error) {
      console.error('Email generation error:', error);
      toast.error('Failed to generate email');
    }
    setIsGenerating(false);
  };

  const handleGenerateInvoice = async () => {
    setIsGenerating(true);
    try {
      const response = await fetch('/api/tools', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          tool: 'generateInvoice',
          params: {
            data,
            context: message
          }
        }),
      });

      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `invoice_${Date.now()}.pdf`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
        
        toast.success('Invoice generated successfully!');
        onToolExecuted?.({ type: 'invoice' });
      } else {
        throw new Error('Failed to generate invoice');
      }
    } catch (error) {
      console.error('Invoice generation error:', error);
      toast.error('Failed to generate invoice');
    }
    setIsGenerating(false);
  };

  const handleExportCSV = async () => {
    setIsGenerating(true);
    try {
      const response = await fetch('/api/tools', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          tool: 'exportData',
          params: {
            data,
            filename: `export_${Date.now()}.csv`
          }
        }),
      });

      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `export_${Date.now()}.csv`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
        
        toast.success('Data exported successfully!');
        onToolExecuted?.({ type: 'export', format: 'csv' });
      } else {
        throw new Error('Failed to export data');
      }
    } catch (error) {
      console.error('Export error:', error);
      toast.error('Failed to export data');
    }
    setIsGenerating(false);
  };

  return (
    <>
      <div className="flex flex-wrap gap-2 mt-4">
        <Button
          variant="ghost"
          size="sm"
          className="h-8 px-3 rounded-lg bg-muted/50 hover:bg-muted/70 border border-border/60 text-foreground"
          onClick={() => setShowReportDialog(true)}
          disabled={isGenerating || data.length === 0}
        >
          <FileText className="h-3.5 w-3.5 mr-1.5" />
          Generate Report
        </Button>

        <Button
          variant="ghost"
          size="sm"
          className="h-8 px-3 rounded-lg bg-muted/50 hover:bg-muted/70 border border-border/60 text-foreground"
          onClick={() => setShowEmailDialog(true)}
          disabled={isGenerating || data.length === 0}
        >
          <Mail className="h-3.5 w-3.5 mr-1.5" />
          Create Email
        </Button>

        <Button
          variant="ghost"
          size="sm"
          className="h-8 px-3 rounded-lg bg-muted/50 hover:bg-muted/70 border border-border/60 text-foreground"
          onClick={handleGenerateInvoice}
          disabled={isGenerating || data.length === 0}
        >
          {isGenerating ? (
            <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
          ) : (
            <Receipt className="h-3.5 w-3.5 mr-1.5" />
          )}
          Generate Invoice
        </Button>

        <Button
          variant="ghost"
          size="sm"
          className="h-8 px-3 rounded-lg bg-muted/50 hover:bg-muted/70 border border-border/60 text-foreground"
          onClick={handleExportCSV}
          disabled={isGenerating || data.length === 0}
        >
          {isGenerating ? (
            <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
          ) : (
            <FileSpreadsheet className="h-3.5 w-3.5 mr-1.5" />
          )}
          Export CSV
        </Button>
      </div>

      {/* Report Generation Dialog */}
      <Dialog open={showReportDialog} onOpenChange={setShowReportDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Generate Report</DialogTitle>
            <DialogDescription>
              Choose the format for your AI-generated report
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            <RadioGroup value={reportFormat} onValueChange={(value: any) => setReportFormat(value)}>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="pdf" id="pdf" />
                <Label htmlFor="pdf" className="flex items-center gap-2">
                  <FileText className="h-4 w-4" />
                  PDF Report
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="excel" id="excel" />
                <Label htmlFor="excel" className="flex items-center gap-2">
                  <FileSpreadsheet className="h-4 w-4" />
                  Excel Workbook
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="html" id="html" />
                <Label htmlFor="html" className="flex items-center gap-2">
                  <FileDown className="h-4 w-4" />
                  HTML Report
                </Label>
              </div>
            </RadioGroup>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowReportDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleGenerateReport} disabled={isGenerating}>
              {isGenerating ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Generating...
                </>
              ) : (
                <>
                  <Download className="h-4 w-4 mr-2" />
                  Generate
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Email Generation Dialog */}
      <Dialog open={showEmailDialog} onOpenChange={setShowEmailDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create Email</DialogTitle>
            <DialogDescription>
              Generate a professional email with your data
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            <div>
              <Label htmlFor="recipient">Recipient Email</Label>
              <Input
                id="recipient"
                type="email"
                placeholder="example@company.com"
                value={emailRecipient}
                onChange={(e) => setEmailRecipient(e.target.value)}
              />
            </div>

            <div>
              <Label>Email Type</Label>
              <RadioGroup value={emailType} onValueChange={(value: any) => setEmailType(value)}>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="report" id="report" />
                  <Label htmlFor="report">Report</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="invoice" id="invoice" />
                  <Label htmlFor="invoice">Invoice</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="reminder" id="reminder" />
                  <Label htmlFor="reminder">Payment Reminder</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="statement" id="statement" />
                  <Label htmlFor="statement">Statement</Label>
                </div>
              </RadioGroup>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowEmailDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleGenerateEmail} disabled={isGenerating || !emailRecipient}>
              {isGenerating ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Generating...
                </>
              ) : (
                <>
                  <Send className="h-4 w-4 mr-2" />
                  Create Email
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
