import { NextRequest, NextResponse } from 'next/server';
import { getTablePreview, initDatabase } from '@/lib/database';

export async function GET(
  request: NextRequest,
  { params }: { params: { datasetId: string } }
) {
  try {
    const { datasetId } = params;
    
    // Initialize database
    await initDatabase();
    
    // For now, we'll use a simple approach to find tables for this dataset
    // In a production app, you'd store dataset metadata in a persistent store
    
    // Mock implementation - get all tables that start with the dataset ID
    // This is a simplified approach for the hackathon
    const mockTables = [
      `${datasetId}_sheet1`,
      `${datasetId}_data`,
      `${datasetId}_summary`
    ];
    
    const tables = [];
    
    for (const tableName of mockTables) {
      try {
        const tablePreview = await getTablePreview(tableName);
        tables.push(tablePreview);
      } catch (error) {
        // Table doesn't exist, skip it
        console.log(`Table ${tableName} not found, skipping`);
      }
    }
    
    return NextResponse.json({ tables });
  } catch (error) {
    console.error('Get tables error:', error);
    return NextResponse.json({ error: 'Failed to get tables' }, { status: 500 });
  }
}