import { NextRequest, NextResponse } from 'next/server';
import { parseFile, detectDatasetType } from '@/lib/fileParser';

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }
    
    // Parse the uploaded file with enhanced parser
    // Note: We can't pass progress callback through HTTP, but the parser will handle it internally
    const parsedFile = await parseFile(file);
    
    if (parsedFile.sheets.length === 0) {
      return NextResponse.json({ error: 'No data found in file' }, { status: 400 });
    }

    // Detect dataset type for better analysis
    const datasetType = detectDatasetType(parsedFile.sheets);
    const datasetId = `dataset_${Date.now()}`;
    
    // Prepare enhanced sheet info for client-side processing
    const sheets = parsedFile.sheets.map(sheet => ({
      name: sheet.name,
      data: sheet.data,
      headers: sheet.headers,
      rowCount: sheet.data.length,
      columnCount: sheet.headers.length,
      metadata: sheet.metadata // Include metadata about the sheet
    }));

    // Create a basic summary without database
    const summary = {
      tables: sheets.map(sheet => ({
        name: sheet.name,
        rows: sheet.rowCount,
        columns: sheet.columnCount
      })),
      inferredJoins: [] // Will be computed client-side
    };

    // Collect all warnings from parsing
    const warnings = parsedFile.metadata?.warnings || [];
    
    // Add additional validation warnings
    sheets.forEach(sheet => {
      if (sheet.rowCount === 0) {
        warnings.push(`Sheet "${sheet.name}" is empty`);
      }
      if (sheet.rowCount > 100000) {
        warnings.push(`Sheet "${sheet.name}" has ${sheet.rowCount} rows - large datasets may take longer to process`);
      }
    });

    return NextResponse.json({ 
      datasetId, 
      sheets, // Send parsed data to client
      summary,
      metadata: {
        type: datasetType,
        tableCount: sheets.length,
        originalFileName: file.name,
        warnings: warnings.length > 0 ? warnings : undefined,
        fileSize: file.size,
        parseTime: parsedFile.metadata?.parseTime,
        totalRows: parsedFile.metadata?.totalRows
      }
    });
  } catch (error) {
    console.error('Upload error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Upload failed';
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}