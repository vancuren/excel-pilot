import { NextRequest, NextResponse } from 'next/server';

export async function POST(
  request: NextRequest,
  { params }: { params: { actionId: string } }
) {
  try {
    const { actionId } = params;

    // Mock action execution
    await new Promise(resolve => setTimeout(resolve, 500));

    const mockArtifacts = [];
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
      
      default:
        summary = `Executed action: ${actionId}`;
    }

    const audit = {
      id: `audit_${Date.now()}`,
      at: new Date().toISOString(),
      summary,
      artifacts: mockArtifacts,
      category: 'action'
    };

    return NextResponse.json({ artifacts: mockArtifacts, audit });
  } catch (error) {
    console.error('Action error:', error);
    return NextResponse.json({ error: 'Action failed' }, { status: 500 });
  }
}