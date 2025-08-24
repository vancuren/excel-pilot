import * as duckdb from '@duckdb/duckdb-wasm';
import { TablePreview, ColumnSchema } from '@/types';

let db: duckdb.AsyncDuckDB | null = null;
let conn: duckdb.AsyncDuckDBConnection | null = null;

export async function initDatabase() {
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

export async function getConnection() {
  if (!conn) {
    await initDatabase();
  }
  return conn!;
}

export async function createTableFromData(tableName: string, data: any[]) {
  const connection = await getConnection();
  
  if (data.length === 0) {
    throw new Error('Cannot create table from empty data');
  }

  // Drop table if exists
  try {
    await connection.query(`DROP TABLE IF EXISTS ${tableName}`);
  } catch (e) {
    // Ignore error if table doesn't exist
  }

  // Insert data directly - DuckDB will infer schema
  const insertQuery = `CREATE TABLE ${tableName} AS SELECT * FROM read_json('${JSON.stringify(data).replace(/'/g, "''")}', sample_size=-1)`;
  await connection.query(insertQuery);

  return tableName;
}

export async function getTablePreview(tableName: string): Promise<TablePreview> {
  const connection = await getConnection();

  // Get schema information
  const schemaResult = await connection.query(`DESCRIBE ${tableName}`);
  const schema: ColumnSchema[] = schemaResult.toArray().map((row: any) => ({
    name: row.column_name,
    type: mapDuckDBType(row.column_type),
    nullable: row.null === 'YES'
  }));

  // Get sample data (first 100 rows)
  const dataResult = await connection.query(`SELECT * FROM ${tableName} LIMIT 100`);
  const rows = dataResult.toArray();

  // Get basic stats
  const countResult = await connection.query(`SELECT COUNT(*) as total FROM ${tableName}`);
  const totalRows = countResult.toArray()[0].total;

  return {
    name: tableName,
    schema,
    rows,
    stats: {
      totalRows,
      sampleRows: rows.length
    }
  };
}

export async function analyzeTable(tableName: string) {
  const connection = await getConnection();

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
        mapped_type: mapDuckDBType(colType)
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
        mapped_type: mapDuckDBType(colType),
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

  const connection = await getConnection();
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
        const commonCols = cols1.filter(col => cols2.includes(col));
        
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

function mapDuckDBType(duckdbType: string): ColumnSchema['type'] {
  const type = duckdbType.toLowerCase();
  
  if (type.includes('int') || type.includes('bigint') || type.includes('double') || type.includes('decimal') || type.includes('float')) {
    return 'number';
  }
  if (type.includes('date') || type.includes('timestamp')) {
    return 'date';
  }
  if (type.includes('bool')) {
    return 'boolean';
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
  const connection = await getConnection();
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