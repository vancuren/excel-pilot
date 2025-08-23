import { analyzeTable, findPotentialJoins, executeQuery } from './database';
import { DatasetSummary } from '@/types';

export async function generateDatasetSummary(
  tableNames: string[],
  datasetType: 'financial' | 'inventory' | 'sales' | 'hr' | 'general'
): Promise<DatasetSummary> {
  const tables = [];
  
  // Analyze each table
  for (const tableName of tableNames) {
    try {
      const analysis = await analyzeTable(tableName);
      tables.push({
        name: tableName,
        rows: analysis.table_stats.row_count,
        columns: analysis.columns.length
      });
    } catch (error) {
      console.error(`Failed to analyze table ${tableName}:`, error);
      tables.push({
        name: tableName,
        rows: 0,
        columns: 0
      });
    }
  }
  
  // Find potential joins
  const inferredJoins = await findPotentialJoins(tableNames);
  
  return {
    tables,
    inferredJoins
  };
}

export async function generateFinancialInsights(tableNames: string[]) {
  const insights = [];
  
  for (const tableName of tableNames) {
    try {
      const analysis = await analyzeTable(tableName);
      const columns = analysis.columns;
      
      // Look for financial patterns
      const amountColumns = columns.filter(col => 
        col.name.toLowerCase().includes('amount') || 
        col.name.toLowerCase().includes('balance') ||
        col.name.toLowerCase().includes('total') ||
        col.mapped_type === 'number'
      );
      
      const dateColumns = columns.filter(col => 
        col.name.toLowerCase().includes('date') ||
        col.mapped_type === 'date'
      );
      
      const vendorColumns = columns.filter(col => 
        col.name.toLowerCase().includes('vendor') ||
        col.name.toLowerCase().includes('supplier') ||
        col.name.toLowerCase().includes('customer')
      );
      
      // Generate specific insights based on detected patterns
      if (amountColumns.length > 0 && dateColumns.length > 0) {
        // Potential AP/AR analysis
        for (const amountCol of amountColumns.slice(0, 2)) { // Limit to first 2 amount columns
          try {
            const result = await executeQuery(`
              SELECT 
                COUNT(*) as total_records,
                SUM(CASE WHEN ${amountCol.name} > 0 THEN 1 ELSE 0 END) as positive_amounts,
                SUM(CASE WHEN ${amountCol.name} < 0 THEN 1 ELSE 0 END) as negative_amounts,
                SUM(${amountCol.name}) as total_amount,
                AVG(${amountCol.name}) as avg_amount,
                MIN(${amountCol.name}) as min_amount,
                MAX(${amountCol.name}) as max_amount
              FROM ${tableName}
              WHERE ${amountCol.name} IS NOT NULL
            `);
            
            const stats = result.toArray()[0];
            insights.push({
              table: tableName,
              type: 'financial_summary',
              column: amountCol.name,
              data: stats
            });
            
            // Check for overdue analysis if there's a date column
            if (dateColumns.length > 0) {
              const dateCol = dateColumns[0];
              try {
                const overdueResult = await executeQuery(`
                  SELECT 
                    COUNT(*) as overdue_count,
                    SUM(${amountCol.name}) as overdue_amount,
                    AVG(CURRENT_DATE - ${dateCol.name}::DATE) as avg_days_overdue
                  FROM ${tableName}
                  WHERE ${dateCol.name}::DATE < CURRENT_DATE - INTERVAL '30 days'
                    AND ${amountCol.name} > 0
                    AND ${dateCol.name} IS NOT NULL
                `);
                
                const overdueStats = overdueResult.toArray()[0];
                if (overdueStats.overdue_count > 0) {
                  insights.push({
                    table: tableName,
                    type: 'overdue_analysis',
                    column: `${amountCol.name} + ${dateCol.name}`,
                    data: overdueStats
                  });
                }
              } catch (error) {
                console.warn(`Overdue analysis failed for ${tableName}:`, error);
              }
            }
            
          } catch (error) {
            console.warn(`Financial analysis failed for ${tableName}.${amountCol.name}:`, error);
          }
        }
      }
      
      // Vendor analysis
      if (vendorColumns.length > 0 && amountColumns.length > 0) {
        const vendorCol = vendorColumns[0];
        const amountCol = amountColumns[0];
        
        try {
          const vendorResult = await executeQuery(`
            SELECT 
              ${vendorCol.name} as vendor,
              COUNT(*) as transaction_count,
              SUM(${amountCol.name}) as total_amount,
              AVG(${amountCol.name}) as avg_amount
            FROM ${tableName}
            WHERE ${vendorCol.name} IS NOT NULL 
              AND ${amountCol.name} IS NOT NULL
            GROUP BY ${vendorCol.name}
            ORDER BY total_amount DESC
            LIMIT 10
          `);
          
          const vendorStats = vendorResult.toArray();
          insights.push({
            table: tableName,
            type: 'vendor_analysis',
            column: `${vendorCol.name} + ${amountCol.name}`,
            data: vendorStats
          });
          
        } catch (error) {
          console.warn(`Vendor analysis failed for ${tableName}:`, error);
        }
      }
      
    } catch (error) {
      console.error(`Failed to generate insights for table ${tableName}:`, error);
    }
  }
  
  return insights;
}

export async function detectOverdueVendors(tableName: string) {
  try {
    const analysis = await analyzeTable(tableName);
    const columns = analysis.columns;
    
    // Find date and amount columns
    const dateColumns = columns.filter(col => 
      col.name.toLowerCase().includes('date') ||
      col.name.toLowerCase().includes('due') ||
      col.mapped_type === 'date'
    );
    
    const amountColumns = columns.filter(col => 
      col.name.toLowerCase().includes('amount') || 
      col.name.toLowerCase().includes('balance') ||
      col.mapped_type === 'number'
    );
    
    const vendorColumns = columns.filter(col => 
      col.name.toLowerCase().includes('vendor') ||
      col.name.toLowerCase().includes('supplier') ||
      col.name.toLowerCase().includes('customer') ||
      col.name.toLowerCase().includes('company')
    );
    
    if (dateColumns.length === 0 || amountColumns.length === 0) {
      return { error: 'Cannot detect overdue vendors: missing date or amount columns' };
    }
    
    const dateCol = dateColumns[0].name;
    const amountCol = amountColumns[0].name;
    const vendorCol = vendorColumns.length > 0 ? vendorColumns[0].name : null;
    
    let query = `
      SELECT 
        ${vendorCol ? `${vendorCol} as vendor,` : "'Unknown' as vendor,"}
        ${amountCol} as amount,
        ${dateCol} as due_date,
        CURRENT_DATE - ${dateCol}::DATE as days_overdue
      FROM ${tableName}
      WHERE ${dateCol}::DATE < CURRENT_DATE 
        AND ${amountCol} > 0
        AND ${dateCol} IS NOT NULL
        AND ${amountCol} IS NOT NULL
      ORDER BY days_overdue DESC, ${amountCol} DESC
    `;
    
    const result = await executeQuery(query);
    const overdueVendors = result.toArray();
    
    // Calculate summary stats
    const totalOverdue = overdueVendors.reduce((sum: number, vendor: any) => sum + vendor.amount, 0);
    const avgDaysOverdue = overdueVendors.length > 0 
      ? overdueVendors.reduce((sum: number, vendor: any) => sum + vendor.days_overdue, 0) / overdueVendors.length 
      : 0;
    
    return {
      vendors: overdueVendors,
      summary: {
        total_overdue_amount: totalOverdue,
        vendor_count: overdueVendors.length,
        avg_days_overdue: Math.round(avgDaysOverdue)
      }
    };
    
  } catch (error) {
    console.error('Error detecting overdue vendors:', error);
    return { error: `Failed to detect overdue vendors: ${error}` };
  }
}

export async function generatePivotTable(
  tableName: string,
  rowField: string,
  columnField?: string,
  valueField?: string,
  aggregation: 'sum' | 'count' | 'avg' | 'max' | 'min' = 'sum'
) {
  try {
    let query = '';
    
    if (!columnField) {
      // Simple grouping
      query = `
        SELECT 
          ${rowField},
          ${valueField ? `${aggregation.toUpperCase()}(${valueField})` : 'COUNT(*)'} as value
        FROM ${tableName}
        WHERE ${rowField} IS NOT NULL
        ${valueField ? `AND ${valueField} IS NOT NULL` : ''}
        GROUP BY ${rowField}
        ORDER BY value DESC
      `;
    } else {
      // Pivot table
      const pivotValues = await executeQuery(`
        SELECT DISTINCT ${columnField} 
        FROM ${tableName} 
        WHERE ${columnField} IS NOT NULL
        LIMIT 20
      `);
      
      const values = pivotValues.toArray().map((row: any) => row[columnField]);
      
      const pivotColumns = values.map(val => 
        `${aggregation.toUpperCase()}(CASE WHEN ${columnField} = '${val}' THEN ${valueField || '1'} END) as "${val}"`
      ).join(', ');
      
      query = `
        SELECT 
          ${rowField},
          ${pivotColumns}
        FROM ${tableName}
        WHERE ${rowField} IS NOT NULL
        ${valueField ? `AND ${valueField} IS NOT NULL` : ''}
        GROUP BY ${rowField}
        ORDER BY ${rowField}
      `;
    }
    
    const result = await executeQuery(query);
    return result.toArray();
    
  } catch (error) {
    console.error('Error generating pivot table:', error);
    throw new Error(`Failed to generate pivot table: ${error}`);
  }
}