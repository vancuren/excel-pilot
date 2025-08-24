import { NextRequest, NextResponse } from 'next/server';
import { generateReport, generateEmail, generateInvoice, sendEmail } from '@/lib/llm-tools';

export async function POST(request: NextRequest) {
  try {
    const { tool, params } = await request.json();
    
    if (!tool || !params) {
      return NextResponse.json({ error: 'Missing tool or parameters' }, { status: 400 });
    }
    
    let result;
    
    switch (tool) {
      case 'generateReport':
        result = await generateReport(params);
        break;
        
      case 'generateEmail':
        result = await generateEmail(params);
        break;
        
      case 'generateInvoice':
        result = await generateInvoice(params.data, params.context);
        break;
        
      case 'sendEmail':
        result = await sendEmail(params);
        break;
        
      case 'exportData':
        // Simple CSV export
        result = await exportToCSV(params.data, params.filename);
        break;
        
      default:
        return NextResponse.json({ error: `Unknown tool: ${tool}` }, { status: 400 });
    }
    
    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 500 });
    }
    
    // If there's a file to download, return it as a response
    if (result.file) {
      const headers = new Headers();
      headers.set('Content-Type', result.file.mimetype);
      headers.set('Content-Disposition', `attachment; filename="${result.file.filename}"`);
      
      // Convert the file data to appropriate format
      let responseBody;
      if (result.file.data instanceof Buffer) {
        responseBody = result.file.data;
      } else if (result.file.data instanceof Blob) {
        responseBody = await result.file.data.arrayBuffer();
      } else {
        responseBody = result.file.data;
      }
      
      return new NextResponse(responseBody, { headers });
    }
    
    // Return HTML or other content
    return NextResponse.json(result);
    
  } catch (error) {
    console.error('Tool execution error:', error);
    return NextResponse.json({ 
      error: 'Tool execution failed',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

/**
 * Simple CSV export function
 */
async function exportToCSV(data: any[], filename: string = 'export.csv'): Promise<any> {
  if (!data || data.length === 0) {
    return {
      success: false,
      error: 'No data to export'
    };
  }
  
  // Get headers from first row
  const headers = Object.keys(data[0]);
  
  // Create CSV content
  const csvContent = [
    headers.join(','),
    ...data.map(row => 
      headers.map(header => {
        const value = row[header];
        // Escape values containing commas or quotes
        if (value === null || value === undefined) return '';
        const stringValue = String(value);
        if (stringValue.includes(',') || stringValue.includes('"') || stringValue.includes('\n')) {
          return `"${stringValue.replace(/"/g, '""')}"`;
        }
        return stringValue;
      }).join(',')
    )
  ].join('\n');
  
  return {
    success: true,
    type: 'export',
    file: {
      data: csvContent,
      filename: filename.endsWith('.csv') ? filename : `${filename}.csv`,
      mimetype: 'text/csv'
    }
  };
}