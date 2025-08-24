'use client';

import * as duckdb from '@duckdb/duckdb-wasm';
import { TablePreview, ColumnSchema } from '@/types';

let db: duckdb.AsyncDuckDB | null = null;
let conn: duckdb.AsyncDuckDBConnection | null = null;

export async function initClientDatabase() {
  if (db) return db;

  const JSDELIVR_BUNDLES = duckdb.getJsDelivrBundles();

  const bundle = await duckdb.selectBundle(JSDELIVR_BUNDLES);
  const worker_url = URL.createObjectURL(
    new Blob([`importScripts("${bundle.mainWorker}");`], {
      type: "text/javascript"
    })
  );

  const worker = new Worker(worker_url);
  const logger = new duckdb.ConsoleLogger();
  db = new duckdb.AsyncDuckDB(logger, worker);
  await db.instantiate(bundle.mainModule, bundle.pthreadWorker);
  
  conn = await db.connect();
  
  return db;
}

export async function getClientConnection() {
  if (!conn) {
    await initClientDatabase();
  }
  return conn!;
}

export async function createTableFromData(tableName: string, data: any[], dataTypes?: Record<string, string>) {
  const connection = await getClientConnection();
  
  if (data.length === 0) {
    throw new Error('Cannot create table from empty data');
  }

  // Drop table if exists
  try {
    await connection.query(`DROP TABLE IF EXISTS ${tableName}`);
  } catch (e) {
    // Ignore error if table doesn't exist
  }

  // If dataTypes are provided, create table with explicit schema
  if (dataTypes && Object.keys(dataTypes).length > 0) {
    try {
      // Build CREATE TABLE statement with explicit types
      const columns = Object.keys(data[0]);
      const columnDefs = columns.map(col => {
        const duckdbType = dataTypes[col] || 'VARCHAR';
        return `"${col}" ${duckdbType}`;
      }).join(', ');
      
      await connection.query(`CREATE TABLE ${tableName} (${columnDefs})`);
      
      // Prepare and insert data
      for (let i = 0; i < data.length; i += 1000) {
        const batch = data.slice(i, i + 1000);
        const values = batch.map(row => {
          const vals = columns.map(col => {
            const val = row[col];
            const colType = dataTypes[col] || 'VARCHAR';
            
            if (val === null || val === undefined) {
              return 'NULL';
            } else if (colType === 'BOOLEAN') {
              if (typeof val === 'boolean') return val ? 'TRUE' : 'FALSE';
              return val.toString().toLowerCase() === 'true' ? 'TRUE' : 'FALSE';
            } else if (colType === 'DATE') {
              // Ensure proper date format - handle various date formats
              if (typeof val === 'string') {
                // Check if it's already in ISO format (yyyy-mm-dd)
                if (/^\d{4}-\d{2}-\d{2}$/.test(val)) {
                  return `DATE '${val}'`;
                }
                // Check if it's in mm/dd/yyyy format
                if (/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(val)) {
                  // Parse and convert to ISO format for DuckDB
                  const parts = val.split('/');
                  const month = parts[0].padStart(2, '0');
                  const day = parts[1].padStart(2, '0');
                  const year = parts[2];
                  return `DATE '${year}-${month}-${day}'`;
                }
                // Try to parse other formats
                const parsed = new Date(val);
                if (!isNaN(parsed.getTime())) {
                  return `DATE '${parsed.getFullYear()}-${(parsed.getMonth() + 1).toString().padStart(2, '0')}-${parsed.getDate().toString().padStart(2, '0')}'`;
                }
                return `DATE '${val}'`;
              }
              if (val instanceof Date) return `DATE '${val.getFullYear()}-${(val.getMonth() + 1).toString().padStart(2, '0')}-${val.getDate().toString().padStart(2, '0')}'`;
              return `DATE '${val}'`;
            } else if (colType === 'TIMESTAMP') {
              // Ensure proper timestamp format
              if (typeof val === 'string') return `TIMESTAMP '${val}'`;
              if (val instanceof Date) return `TIMESTAMP '${val.toISOString()}'`;
              return `TIMESTAMP '${val}'`;
            } else if (colType === 'TIME') {
              // Ensure proper time format
              return `TIME '${val}'`;
            } else if (colType.startsWith('DECIMAL') || colType === 'DOUBLE' || colType === 'FLOAT') {
              // Numeric types
              return val;
            } else if (colType === 'INTEGER' || colType === 'BIGINT') {
              // Integer types
              return Math.floor(Number(val));
            } else if (colType === 'JSON') {
              // JSON type
              return `'${JSON.stringify(val).replace(/'/g, "''")}'::JSON`;
            } else {
              // String types (VARCHAR, UUID, etc.)
              return `'${val.toString().replace(/'/g, "''")}'`;
            }
          });
          return `(${vals.join(', ')})`;
        }).join(', ');
        
        if (values) {
          await connection.query(`INSERT INTO ${tableName} VALUES ${values}`);
        }
      }
      
      return tableName;
    } catch (error) {
      console.error('Failed to create table with explicit schema, falling back:', error);
      // Fall through to auto-detection method
    }
  }

  // Fallback: Use DuckDB's ability to parse JSON directly from a string literal
  const jsonString = JSON.stringify(data);
  const escapedJson = jsonString.replace(/'/g, "''");
  
  // Create table from JSON using a simpler approach
  const createQuery = `CREATE TABLE ${tableName} AS SELECT * FROM read_json_auto('${escapedJson}')`;
  
  try {
    await connection.query(createQuery);
  } catch (error) {
    console.error('Failed to create table with read_json_auto, trying alternative method:', error);
    
    // Fallback: Create table structure first, then insert data
    const firstRow = data[0];
    const columns = Object.keys(firstRow);
    
    // Build INSERT statement with literal values - not used in this fallback path
    
    // Create table with first row of values to infer types
    const firstRowValues = `(${columns.map(col => {
      const val = firstRow[col];
      if (val === null || val === undefined) return 'NULL';
      if (typeof val === 'string') return `'${val.replace(/'/g, "''")}'`;
      if (typeof val === 'boolean') return val ? 'TRUE' : 'FALSE';
      return val;
    }).join(', ')})`;
    
    await connection.query(`CREATE TABLE ${tableName} AS SELECT * FROM (VALUES ${firstRowValues}) AS t(${columns.map(c => `"${c}"`).join(', ')})`)
    
    // Insert remaining rows if any
    if (data.length > 1) {
      const remainingValues = data.slice(1).map(row => {
        const vals = columns.map(col => {
          const val = row[col];
          if (val === null || val === undefined) return 'NULL';
          if (typeof val === 'string') return `'${val.replace(/'/g, "''")}'`;
          if (typeof val === 'boolean') return val ? 'TRUE' : 'FALSE';
          return val;
        });
        return `(${vals.join(', ')})`;
      }).join(', ');
      
      await connection.query(`INSERT INTO ${tableName} VALUES ${remainingValues}`);
    }
  }

  return tableName;
}

export async function getTablePreview(tableName: string): Promise<TablePreview> {
  const connection = await getClientConnection();

  // Get schema information
  const schemaResult = await connection.query(`DESCRIBE ${tableName}`);
  const schema: ColumnSchema[] = schemaResult.toArray().map((row: any) => ({
    name: row.column_name,
    type: mapDuckDBType(row.column_type, row.column_name),
    nullable: row.null === 'YES'
  }));

  // Get sample data (first 100 rows)
  const dataResult = await connection.query(`SELECT * FROM ${tableName} LIMIT 100`);
  const rows = dataResult.toArray().map(row => {
    // Convert any BigInt values to numbers in the row data
    const cleanRow: any = {};
    for (const [key, value] of Object.entries(row)) {
      cleanRow[key] = typeof value === 'bigint' ? Number(value) : value;
    }
    return cleanRow;
  });

  // Get basic stats
  const countResult = await connection.query(`SELECT COUNT(*) as total FROM ${tableName}`);
  const totalRows = Number(countResult.toArray()[0].total); // Convert BigInt to number
  
  // Calculate column statistics for numeric columns
  const stats: Record<string, any> = {
    totalRows,
    sampleRows: rows.length
  };
  
  for (const col of schema) {
    if (col.type === 'number' || col.type === 'currency') {
      try {
        const statsQuery = `
          SELECT 
            SUM(CAST("${col.name}" AS DOUBLE)) as sum,
            AVG(CAST("${col.name}" AS DOUBLE)) as avg,
            MIN(CAST("${col.name}" AS DOUBLE)) as min,
            MAX(CAST("${col.name}" AS DOUBLE)) as max
          FROM ${tableName}
          WHERE "${col.name}" IS NOT NULL
        `;
        const statsResult = await connection.query(statsQuery);
        const colStats = statsResult.toArray()[0];
        
        stats[col.name] = {
          sum: Number(colStats.sum || 0),
          avg: Number(colStats.avg || 0),
          min: Number(colStats.min || 0),
          max: Number(colStats.max || 0)
        };
      } catch (error) {
        console.warn(`Failed to calculate stats for column ${col.name}:`, error);
      }
    }
  }

  return {
    name: tableName,
    schema,
    rows,
    stats
  };
}

export async function analyzeTable(tableName: string) {
  const connection = await getClientConnection();

  // Get basic statistics
  const stats = await connection.query(`
    SELECT 
      COUNT(*) as row_count
    FROM ${tableName}
  `);

  const schemaResult = await connection.query(`DESCRIBE ${tableName}`);
  const columns = schemaResult.toArray();

  // Analyze each column
  const columnAnalysis = [];
  for (const col of columns) {
    const colName = col.column_name;
    const colType = col.column_type;
    
    try {
      let analysis: any = {
        name: colName,
        type: colType,
        mapped_type: mapDuckDBType(colType, colName)
      };

      // Get null count and distinct values
      const nullResult = await connection.query(`
        SELECT 
          COUNT(*) - COUNT(${colName}) as null_count,
          COUNT(DISTINCT ${colName}) as distinct_count
        FROM ${tableName}
      `);
      
      const nullData = nullResult.toArray()[0];
      analysis.null_count = nullData.null_count;
      analysis.distinct_count = nullData.distinct_count;

      // Type-specific analysis
      if (isNumericType(colType)) {
        const numericResult = await connection.query(`
          SELECT 
            MIN(${colName}) as min_val,
            MAX(${colName}) as max_val,
            AVG(${colName}) as avg_val,
            STDDEV(${colName}) as std_dev
          FROM ${tableName}
          WHERE ${colName} IS NOT NULL
        `);
        const numericData = numericResult.toArray()[0];
        analysis = { ...analysis, ...numericData };
      }

      if (isTextType(colType)) {
        const textResult = await connection.query(`
          SELECT 
            MIN(LENGTH(${colName})) as min_length,
            MAX(LENGTH(${colName})) as max_length,
            AVG(LENGTH(${colName})) as avg_length
          FROM ${tableName}
          WHERE ${colName} IS NOT NULL
        `);
        const textData = textResult.toArray()[0];
        analysis = { ...analysis, ...textData };
      }

      columnAnalysis.push(analysis);
    } catch (error) {
      console.warn(`Failed to analyze column ${colName}:`, error);
      columnAnalysis.push({
        name: colName,
        type: colType,
        mapped_type: mapDuckDBType(colType, colName),
        error: 'Analysis failed'
      });
    }
  }

  return {
    table_stats: stats.toArray()[0],
    columns: columnAnalysis
  };
}

export async function findPotentialJoins(tables: string[]): Promise<Array<{ left: string; right: string; on: string[] }>> {
  if (tables.length < 2) return [];

  const connection = await getClientConnection();
  const joins = [];

  for (let i = 0; i < tables.length; i++) {
    for (let j = i + 1; j < tables.length; j++) {
      const table1 = tables[i];
      const table2 = tables[j];

      try {
        // Get column names for both tables
        const schema1 = await connection.query(`DESCRIBE ${table1}`);
        const schema2 = await connection.query(`DESCRIBE ${table2}`);
        
        const cols1 = schema1.toArray().map((row: any) => row.column_name);
        const cols2 = schema2.toArray().map((row: any) => row.column_name);

        // Find common column names
        const commonCols = cols1.filter((col: string) => cols2.includes(col));
        
        if (commonCols.length > 0) {
          // Check if the common columns have overlapping values
          for (const col of commonCols.slice(0, 2)) { // Limit to first 2 common columns
            const overlapResult = await connection.query(`
              SELECT COUNT(*) as overlap_count 
              FROM (
                SELECT DISTINCT ${col} FROM ${table1} 
                INTERSECT 
                SELECT DISTINCT ${col} FROM ${table2}
              )
            `);
            
            const overlap = overlapResult.toArray()[0].overlap_count;
            if (overlap > 0) {
              joins.push({
                left: table1,
                right: table2,
                on: [col]
              });
              break; // Only add one join per table pair
            }
          }
        }
      } catch (error) {
        console.warn(`Failed to analyze join potential between ${table1} and ${table2}:`, error);
      }
    }
  }

  return joins;
}

function mapDuckDBType(duckdbType: string, columnName?: string): ColumnSchema['type'] {
  const type = duckdbType.toLowerCase();
  const colName = columnName?.toLowerCase() || '';
  
  // Check for date types
  if (type.includes('date') || type.includes('timestamp')) {
    return 'date';
  }
  
  // Check for boolean types
  if (type.includes('bool')) {
    return 'boolean';
  }
  
  // Check for numeric types
  if (type.includes('int') || type.includes('bigint') || type.includes('double') || type.includes('decimal') || type.includes('float')) {
    // Check column name for currency indicators
    const currencyIndicators = ['amount', 'price', 'cost', 'revenue', 'expense', 'balance', 'total', 'payment', 'fee', 'salary', 'wage'];
    if (currencyIndicators.some(indicator => colName.includes(indicator))) {
      return 'currency';
    }
    // Decimals and doubles are often currency in financial data
    if (type.includes('decimal') || type.includes('double')) {
      return 'currency';
    }
    return 'number';
  }
  
  return 'string';
}

function isNumericType(type: string): boolean {
  const t = type.toLowerCase();
  return t.includes('int') || t.includes('double') || t.includes('decimal') || t.includes('float') || t.includes('numeric');
}

function isTextType(type: string): boolean {
  const t = type.toLowerCase();
  return t.includes('varchar') || t.includes('text') || t.includes('string');
}

export async function executeQuery(query: string) {
  const connection = await getClientConnection();
  return await connection.query(query);
}

export async function closeDatabase() {
  if (conn) {
    await conn.close();
    conn = null;
  }
  if (db) {
    await db.terminate();
    db = null;
  }
}

export async function detectOverdueVendors(tableName: string) {
  try {
    const analysis = await analyzeTable(tableName);
    const columns = analysis.columns;
    
    // Find date and amount columns
    const dateColumns = columns.filter((col: any) => 
      col.name.toLowerCase().includes('date') ||
      col.name.toLowerCase().includes('due') ||
      col.mapped_type === 'date'
    );
    
    const amountColumns = columns.filter((col: any) => 
      col.name.toLowerCase().includes('amount') || 
      col.name.toLowerCase().includes('balance') ||
      col.mapped_type === 'number'
    );
    
    const vendorColumns = columns.filter((col: any) => 
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

export async function generateDatasetSummary(
  tableNames: string[],
  _datasetType: 'financial' | 'inventory' | 'sales' | 'hr' | 'general'
) {
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