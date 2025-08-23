import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const { datasetId, message } = await request.json();

    // Mock AI response
    await new Promise(resolve => setTimeout(resolve, 800));

    const response = {
      messages: [{
        id: `msg_${Date.now()}`,
        role: 'assistant',
        content: generateMockResponse(message),
        timestamp: new Date().toISOString(),
        toolSuggestions: generateToolSuggestions(message),
      }]
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error('Chat error:', error);
    return NextResponse.json({ error: 'Chat failed' }, { status: 500 });
  }
}

function generateMockResponse(message: string): string {
  if (message.toLowerCase().includes('overdue')) {
    return `Based on your AP ledger analysis, I found **2 vendors** that are 60+ days overdue with a total exposure of **$18,170.50**:

- **TechCorp Solutions**: $12,750.00 (62 days overdue)
- **ABC Supplies**: $5,420.50 (45 days overdue)

These represent 81.6% of your total overdue amount. I recommend immediate action to collect these outstanding receivables.`;
  }
  
  return `I've analyzed your request against the available financial data. Here are the key insights and recommended actions based on your current datasets.`;
}

function generateToolSuggestions(message: string) {
  if (message.toLowerCase().includes('overdue')) {
    return [
      {
        id: 'draft_reminders',
        label: 'Draft payment reminder emails',
        category: 'invoice',
      },
      {
        id: 'export_overdue_csv',
        label: 'Export overdue vendors to CSV',
        category: 'export',
      },
    ];
  }

  return [];
}