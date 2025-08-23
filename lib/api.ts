import { DatasetSummary, TablePreview, ChatMessage, ActionSuggestion, Artifact, AuditEvent } from '@/types';
import { getTablePreview } from './database';
import type { ParseProgress } from './fileParser';

// Mock data for development
const mockTables = {
  ap_ledger: {
    name: 'ap_ledger',
    schema: [
      { name: 'vendor_id', type: 'string' as const },
      { name: 'vendor_name', type: 'string' as const },
      { name: 'invoice_id', type: 'string' as const },
      { name: 'invoice_date', type: 'date' as const },
      { name: 'due_date', type: 'date' as const },
      { name: 'amount', type: 'currency' as const },
      { name: 'status', type: 'string' as const },
      { name: 'days_overdue', type: 'number' as const },
    ],
    rows: [
      { vendor_id: 'V001', vendor_name: 'ABC Supplies', invoice_id: 'INV-2024-001', invoice_date: '2024-01-15', due_date: '2024-02-14', amount: 5420.50, status: 'overdue', days_overdue: 45 },
      { vendor_id: 'V002', vendor_name: 'TechCorp Solutions', invoice_id: 'INV-2024-002', invoice_date: '2024-02-01', due_date: '2024-03-03', amount: 12750.00, status: 'overdue', days_overdue: 62 },
      { vendor_id: 'V003', vendor_name: 'Office Dynamics', invoice_id: 'INV-2024-003', invoice_date: '2024-02-10', due_date: '2024-03-12', amount: 890.25, status: 'paid', days_overdue: 0 },
      { vendor_id: 'V004', vendor_name: 'Cloud Services Inc', invoice_id: 'INV-2024-004', invoice_date: '2024-03-01', due_date: '2024-03-31', amount: 3200.00, status: 'pending', days_overdue: 0 },
    ],
    stats: {
      amount: { sum: 22260.75, avg: 5565.19, min: 890.25, max: 12750.00 },
      days_overdue: { avg: 26.75, max: 62 }
    }
  },
  invoices_q3: {
    name: 'invoices_q3',
    schema: [
      { name: 'customer_id', type: 'string' as const },
      { name: 'customer_name', type: 'string' as const },
      { name: 'invoice_number', type: 'string' as const },
      { name: 'issue_date', type: 'date' as const },
      { name: 'amount', type: 'currency' as const },
      { name: 'status', type: 'string' as const },
    ],
    rows: [
      { customer_id: 'C001', customer_name: 'Acme Corp', invoice_number: 'SI-2024-101', issue_date: '2024-07-15', amount: 15000.00, status: 'paid' },
      { customer_id: 'C002', customer_name: 'Beta Industries', invoice_number: 'SI-2024-102', issue_date: '2024-08-01', amount: 8500.50, status: 'pending' },
      { customer_id: 'C003', customer_name: 'Gamma Solutions', invoice_number: 'SI-2024-103', issue_date: '2024-09-10', amount: 22000.00, status: 'overdue' },
    ],
    stats: {
      amount: { sum: 45500.50, avg: 15166.83, min: 8500.50, max: 22000.00 }
    }
  }
};

class ApiService {
  async uploadFile(
    file: File, 
    onProgress?: (progress: ParseProgress) => void
  ): Promise<{ 
    datasetId: string; 
    summary: DatasetSummary; 
    sheets?: any[];
    metadata?: {
      type?: string;
      warnings?: string[];
      tableCount?: number;
      originalFileName?: string;
    };
  }> {
    const formData = new FormData();
    formData.append('file', file);
    
    // Simulate progress for upload (since we can't track server-side parsing progress via fetch)
    if (onProgress) {
      onProgress({ loaded: 0, total: file.size, percentage: 0, phase: 'reading' });
    }
    
    const response = await fetch('/api/upload', {
      method: 'POST',
      body: formData,
    });
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Upload failed');
    }
    
    const result = await response.json();
    
    // Simulate parsing progress completion
    if (onProgress) {
      onProgress({ loaded: file.size, total: file.size, percentage: 100, phase: 'complete' });
    }
    
    return result;
  }

  async getTables(datasetId: string): Promise<{ tables: TablePreview[] }> {
    const response = await fetch(`/api/tables/${datasetId}`);
    
    if (!response.ok) {
      // Fallback to mock data for development
      console.warn('Failed to fetch real tables, using mock data');
      await new Promise(resolve => setTimeout(resolve, 500));
      return { tables: Object.values(mockTables) };
    }
    
    return await response.json();
  }

  async sendChatMessage(datasetId: string, message: string): Promise<{
    messages: ChatMessage[];
    resultTable?: TablePreview;
    chart?: any;
  }> {
    await new Promise(resolve => setTimeout(resolve, 1000));

    const assistantMessage: ChatMessage = {
      id: `msg_${Date.now()}`,
      role: 'assistant',
      content: this.generateMockResponse(message),
      timestamp: new Date().toISOString(),
      toolSuggestions: this.generateToolSuggestions(message),
    };

    return {
      messages: [assistantMessage],
      resultTable: message.toLowerCase().includes('overdue') ? this.getOverdueVendorsTable() : undefined,
    };
  }

  private generateMockResponse(message: string): string {
    if (message.toLowerCase().includes('overdue')) {
      return `Based on your AP ledger analysis, I found **2 vendors** that are 60+ days overdue with a total exposure of **$18,170.50**:

- **TechCorp Solutions**: $12,750.00 (62 days overdue)
- **ABC Supplies**: $5,420.50 (45 days overdue)

These represent 81.6% of your total overdue amount. I recommend immediate action to collect these outstanding receivables.`;
    }
    
    if (message.toLowerCase().includes('cash') || message.toLowerCase().includes('reconciliation')) {
      return `I'll help you reconcile your cash accounts. Based on the bank transactions and AP ledger, I can identify discrepancies and suggest journal entries to balance your books.`;
    }

    return `I've analyzed your request against the available financial data. Here are the key insights and recommended actions based on your current datasets.`;
  }

  private generateToolSuggestions(message: string): ActionSuggestion[] {
    if (message.toLowerCase().includes('overdue')) {
      return [
        {
          id: 'draft_reminders',
          label: 'Draft payment reminder emails',
          category: 'invoice',
        },
        {
          id: 'create_aging_report',
          label: 'Generate aging report',
          category: 'analysis',
        },
        {
          id: 'export_overdue_csv',
          label: 'Export overdue vendors to CSV',
          category: 'export',
        },
      ];
    }

    return [
      {
        id: 'export_csv',
        label: 'Export current view to CSV',
        category: 'export',
      },
    ];
  }

  private getOverdueVendorsTable(): TablePreview {
    return {
      name: 'overdue_vendors_60plus',
      schema: mockTables.ap_ledger.schema,
      rows: mockTables.ap_ledger.rows.filter(row => row.days_overdue >= 45),
      stats: {
        amount: { sum: 18170.50, avg: 9085.25, min: 5420.50, max: 12750.00 },
        days_overdue: { avg: 53.5, max: 62 }
      }
    };
  }

  async executeAction(actionId: string, params?: any): Promise<{
    artifacts: Artifact[];
    audit: AuditEvent;
  }> {
    await new Promise(resolve => setTimeout(resolve, 800));

    const mockArtifacts: Artifact[] = [];
    let summary = '';

    switch (actionId) {
      case 'draft_reminders':
        mockArtifacts.push({
          kind: 'pdf',
          name: 'Payment_Reminder_TechCorp.pdf',
          url: '/mock/reminder_techcorp.pdf',
          size: 245760
        });
        summary = 'Generated 2 payment reminder emails for overdue vendors';
        break;
      
      case 'export_overdue_csv':
        mockArtifacts.push({
          kind: 'csv',
          name: 'Overdue_Vendors_Report.csv',
          url: '/mock/overdue_vendors.csv',
          size: 1024
        });
        summary = 'Exported overdue vendors list to CSV';
        break;
      
      case 'create_voucher':
        mockArtifacts.push({
          kind: 'pdf',
          name: 'Journal_Voucher_JV2024001.pdf',
          url: '/mock/voucher_jv2024001.pdf',
          size: 128000
        });
        summary = 'Created journal voucher JV2024001';
        break;
      
      default:
        summary = `Executed action: ${actionId}`;
    }

    const audit: AuditEvent = {
      id: `audit_${Date.now()}`,
      at: new Date().toISOString(),
      summary,
      artifacts: mockArtifacts,
      category: 'action'
    };

    return { artifacts: mockArtifacts, audit };
  }
}

export const api = new ApiService();