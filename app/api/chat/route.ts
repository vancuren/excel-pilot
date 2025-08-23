import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const { datasetId, message } = await request.json();
    
    // Generate response based on message (database operations happen client-side)
    const analysisResult = await analyzeMessage(message, datasetId);
    
    const response = {
      messages: [{
        id: `msg_${Date.now()}`,
        role: 'assistant' as const,
        content: analysisResult.content,
        timestamp: new Date().toISOString(),
        toolSuggestions: generateToolSuggestions(message),
        artifacts: analysisResult.artifacts || [],
      }]
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error('Chat error:', error);
    return NextResponse.json({ error: 'Chat failed' }, { status: 500 });
  }
}

async function analyzeMessage(message: string, datasetId: string) {
  const lowerMessage = message.toLowerCase();
  
  // Since database operations happen client-side, we provide guidance
  // The actual data analysis will be performed by the client
  
  if (lowerMessage.includes('overdue')) {
    return {
      content: `I'll help you analyze overdue vendors. The analysis is being performed on your data locally. Look for vendors with past-due dates and outstanding amounts. You can:\n\n- Filter by days overdue (30, 60, 90+ days)\n- Sort by amount or date\n- Export the results to CSV\n\nUse the data viewer to explore your overdue accounts in detail.`,
      artifacts: [],
      analysisType: 'overdue' // Client can use this to trigger specific analysis
    };
  }
  
  if (lowerMessage.includes('summary') || lowerMessage.includes('overview')) {
    return {
      content: `I'll provide a summary of your dataset. The data is being analyzed locally in your browser. You can view:\n\n- Total number of records\n- Key financial metrics\n- Data quality indicators\n- Table relationships\n\nCheck the data viewer for detailed statistics.`,
      artifacts: [],
      analysisType: 'summary'
    };
  }
  
  if (lowerMessage.includes('pivot') || lowerMessage.includes('group')) {
    return {
      content: `I can help you create pivot tables and grouped analysis. You can:\n\n- Group by vendor, date, or category\n- Aggregate amounts, counts, or averages\n- Create cross-tabulations\n- Export results to Excel\n\nWhat fields would you like to group by?`,
      artifacts: [],
      analysisType: 'pivot'
    };
  }
  
  return {
    content: `I understand you want to: "${message}". I can help you with:\n\n- **Overdue Analysis**: Find vendors with past-due payments\n- **Data Summaries**: Get overview statistics\n- **Pivot Tables**: Group and aggregate your data\n- **Exports**: Generate CSV or Excel reports\n\nYour data is processed locally for maximum security. What specific analysis would you like to perform?`,
    artifacts: []
  };
}

function generateToolSuggestions(message: string) {
  if (message.toLowerCase().includes('overdue')) {
    return [
      {
        id: 'draft_reminders',
        label: 'Draft payment reminder emails',
        category: 'invoice' as const,
      },
      {
        id: 'export_overdue_csv',
        label: 'Export overdue vendors to CSV',
        category: 'export' as const,
      },
    ];
  }

  return [];
}