import * as XLSX from 'xlsx';
import Papa from 'papaparse';

export interface ParsedFile {
  name: string;
  sheets: ParsedSheet[];
  metadata?: {
    totalRows: number;
    totalSheets: number;
    fileSize: number;
    parseTime: number;
    warnings?: string[];
  };
}

export interface ParsedSheet {
  name: string;
  data: any[];
  headers: string[];
  metadata?: {
    hasFormulas?: boolean;
    hasMergedCells?: boolean;
    hasEmptyRows?: boolean;
    dataTypes?: Record<string, string>;
  };
}

export interface ParseProgress {
  loaded: number;
  total: number;
  percentage: number;
  phase: 'reading' | 'parsing' | 'validating' | 'complete';
}

export async function parseFile(
  file: File, 
  onProgress?: (progress: ParseProgress) => void
): Promise<ParsedFile> {
  const startTime = Date.now();
  const extension = file.name.split('.').pop()?.toLowerCase();
  
  onProgress?.({ loaded: 0, total: file.size, percentage: 0, phase: 'reading' });
  
  let result: ParsedFile;
  
  switch (extension) {
    case 'csv':
      result = await parseCSV(file, onProgress);
      break;
    case 'tsv':
      result = await parseTSV(file, onProgress);
      break;
    case 'xlsx':
    case 'xls':
    case 'xlsm':
      result = await parseExcel(file, onProgress);
      break;
    case 'json':
      result = await parseJSON(file, onProgress);
      break;
    case 'pdf':
      result = await parsePDF(file, onProgress);
      break;
    default:
      throw new Error(`Unsupported file type: ${extension}`);
  }
  
  const parseTime = Date.now() - startTime;
  
  result.metadata = {
    ...result.metadata,
    totalRows: result.sheets.reduce((sum, sheet) => sum + sheet.data.length, 0),
    totalSheets: result.sheets.length,
    fileSize: file.size,
    parseTime
  };
  
  onProgress?.({ loaded: file.size, total: file.size, percentage: 100, phase: 'complete' });
  
  return result;
}

async function parseCSV(
  file: File,
  onProgress?: (progress: ParseProgress) => void
): Promise<ParsedFile> {
  const text = await file.text();
  onProgress?.({ loaded: file.size * 0.3, total: file.size, percentage: 30, phase: 'parsing' });
  
  return new Promise((resolve, reject) => {
    Papa.parse(text, {
      header: true,
      skipEmptyLines: true,
      dynamicTyping: true,
      complete: (results) => {
        onProgress?.({ loaded: file.size * 0.6, total: file.size, percentage: 60, phase: 'validating' });
        
        const warnings: string[] = [];
        if (results.errors.length > 0) {
          console.warn('CSV parsing warnings:', results.errors);
          warnings.push(...results.errors.map(e => e.message));
        }
        
        const headers = results.meta.fields || [];
        const { cleanedData, dataTypes } = cleanAndValidateData(results.data, headers);
        
        const hasEmptyRows = results.data.length !== cleanedData.length;
        
        resolve({
          name: file.name,
          sheets: [{
            name: 'Sheet1',
            data: cleanedData,
            headers,
            metadata: {
              hasEmptyRows,
              dataTypes
            }
          }],
          metadata: { warnings, totalRows: 0, totalSheets: 0, fileSize: 0, parseTime: 0 }
        });
      },
      error: (error: any) => {
        reject(new Error(`CSV parsing failed: ${error.message}`));
      }
    });
  });
}

async function parseTSV(
  file: File,
  onProgress?: (progress: ParseProgress) => void
): Promise<ParsedFile> {
  const text = await file.text();
  onProgress?.({ loaded: file.size * 0.3, total: file.size, percentage: 30, phase: 'parsing' });
  
  return new Promise((resolve, reject) => {
    Papa.parse(text, {
      header: true,
      skipEmptyLines: true,
      dynamicTyping: true,
      delimiter: '\t',
      complete: (results) => {
        onProgress?.({ loaded: file.size * 0.6, total: file.size, percentage: 60, phase: 'validating' });
        
        const warnings: string[] = [];
        if (results.errors.length > 0) {
          warnings.push(...results.errors.map(e => e.message));
        }
        
        const headers = results.meta.fields || [];
        const { cleanedData, dataTypes } = cleanAndValidateData(results.data, headers);
        
        resolve({
          name: file.name,
          sheets: [{
            name: 'Sheet1',
            data: cleanedData,
            headers,
            metadata: { dataTypes }
          }],
          metadata: { warnings, totalRows: 0, totalSheets: 0, fileSize: 0, parseTime: 0 }
        });
      },
      error: (error: any) => {
        reject(new Error(`TSV parsing failed: ${error.message}`));
      }
    });
  });
}

async function parseJSON(
  file: File,
  onProgress?: (progress: ParseProgress) => void
): Promise<ParsedFile> {
  try {
    const text = await file.text();
    onProgress?.({ loaded: file.size * 0.3, total: file.size, percentage: 30, phase: 'parsing' });
    
    const jsonData = JSON.parse(text);
    onProgress?.({ loaded: file.size * 0.6, total: file.size, percentage: 60, phase: 'validating' });
    
    let data: any[];
    let headers: string[];
    
    if (Array.isArray(jsonData)) {
      data = jsonData;
      headers = data.length > 0 ? Object.keys(data[0]) : [];
    } else if (jsonData && typeof jsonData === 'object') {
      // Handle single object or nested structure
      if (jsonData.data && Array.isArray(jsonData.data)) {
        data = jsonData.data;
        headers = data.length > 0 ? Object.keys(data[0]) : [];
      } else {
        // Convert single object to array
        data = [jsonData];
        headers = Object.keys(jsonData);
      }
    } else {
      throw new Error('Invalid JSON structure for tabular data');
    }
    
    const { cleanedData, dataTypes } = cleanAndValidateData(data, headers);
    
    return {
      name: file.name,
      sheets: [{
        name: 'Sheet1',
        data: cleanedData,
        headers,
        metadata: { dataTypes }
      }],
      metadata: { totalRows: 0, totalSheets: 0, fileSize: 0, parseTime: 0 }
    };
  } catch (error) {
    throw new Error(`JSON parsing failed: ${error}`);
  }
}

async function parseExcel(
  file: File,
  onProgress?: (progress: ParseProgress) => void
): Promise<ParsedFile> {
  try {
    const buffer = await file.arrayBuffer();
    const data = new Uint8Array(buffer);
    onProgress?.({ loaded: file.size * 0.3, total: file.size, percentage: 30, phase: 'parsing' });
    
    const workbook = XLSX.read(data, { 
      type: 'array',
      cellFormula: true,
      cellHTML: false,
      cellDates: true,
      sheetStubs: true
    });
    
    const sheets: ParsedSheet[] = [];
    const warnings: string[] = [];
    
    workbook.SheetNames.forEach((sheetName, index) => {
      onProgress?.({
        loaded: file.size * (0.3 + (0.4 * (index + 1) / workbook.SheetNames.length)),
        total: file.size,
        percentage: 30 + (40 * (index + 1) / workbook.SheetNames.length),
        phase: 'parsing'
      });
      
      const worksheet = workbook.Sheets[sheetName];
      
      // Check for merged cells
      const hasMergedCells = worksheet['!merges'] && worksheet['!merges'].length > 0;
      if (hasMergedCells) {
        warnings.push(`Sheet "${sheetName}" contains merged cells which have been expanded`);
        // Handle merged cells by expanding them
        if (worksheet['!merges']) {
          worksheet['!merges'].forEach((merge: any) => {
            const startCell = XLSX.utils.encode_cell(merge.s);
            const value = worksheet[startCell]?.v;
            for (let r = merge.s.r; r <= merge.e.r; r++) {
              for (let c = merge.s.c; c <= merge.e.c; c++) {
                const cell = XLSX.utils.encode_cell({ r, c });
                if (!worksheet[cell]) {
                  worksheet[cell] = { t: 's', v: value || '' };
                }
              }
            }
          });
        }
      }
      
      // Check for formulas
      const hasFormulas = Object.keys(worksheet).some(key => 
        key[0] !== '!' && worksheet[key]?.f
      );
      
      // Convert to JSON with better options
      const jsonData = XLSX.utils.sheet_to_json(worksheet, { 
        defval: null,
        raw: false,
        dateNF: 'yyyy-mm-dd',
        blankrows: false
      });
      
      if (jsonData.length === 0) {
        // Check if it's truly empty or just has headers
        const range = worksheet['!ref'];
        if (range) {
          const headers = extractHeaders(worksheet, range);
          if (headers.length > 0) {
            sheets.push({
              name: sheetName,
              data: [],
              headers,
              metadata: { hasFormulas, hasMergedCells }
            });
            warnings.push(`Sheet "${sheetName}" has headers but no data`);
            return;
          }
        }
        
        sheets.push({
          name: sheetName,
          data: [],
          headers: [],
          metadata: { hasFormulas, hasMergedCells }
        });
        return;
      }
      
      const headers = Object.keys(jsonData[0] as any);
      const { cleanedData, dataTypes } = cleanAndValidateData(jsonData, headers);
      
      sheets.push({
        name: sheetName,
        data: cleanedData,
        headers,
        metadata: {
          hasFormulas,
          hasMergedCells,
          dataTypes
        }
      });
    });
    
    onProgress?.({ loaded: file.size * 0.8, total: file.size, percentage: 80, phase: 'validating' });
    
    return {
      name: file.name,
      sheets,
      metadata: { warnings, totalRows: 0, totalSheets: 0, fileSize: 0, parseTime: 0 }
    };
    
  } catch (error) {
    throw new Error(`Excel parsing failed: ${error}`);
  }
}

function extractHeaders(worksheet: any, range: string): string[] {
  const decoded = XLSX.utils.decode_range(range);
  const headers: string[] = [];
  
  for (let c = decoded.s.c; c <= decoded.e.c; c++) {
    const cell = worksheet[XLSX.utils.encode_cell({ r: decoded.s.r, c })];
    if (cell && cell.v) {
      headers.push(String(cell.v));
    }
  }
  
  return headers;
}

async function parsePDF(
  file: File,
  onProgress?: (progress: ParseProgress) => void
): Promise<ParsedFile> {
  // Note: For production, you'd want to use a library like pdf.js or pdf-parse
  // This is a simplified implementation that extracts text and attempts to identify tables
  
  try {
    onProgress?.({ loaded: file.size * 0.3, total: file.size, percentage: 30, phase: 'parsing' });
    
    // For now, we'll do basic text extraction
    // In a real implementation, you'd use pdf.js or similar to extract structured data
    const text = await file.text();
    const warnings: string[] = ['PDF table extraction is simplified. For better results, consider converting to Excel first.'];
    
    onProgress?.({ loaded: file.size * 0.6, total: file.size, percentage: 60, phase: 'validating' });
    
    // Try to identify table-like structures
    const lines = text.split('\n').filter(line => line.trim() !== '');
    const tables = extractTablesFromText(lines);
    
    if (tables.length > 0) {
      const sheets = tables.map((table, index) => ({
        name: `Table_${index + 1}`,
        data: table.data,
        headers: table.headers,
        metadata: {
          dataTypes: table.dataTypes
        }
      }));
      
      return {
        name: file.name,
        sheets,
        metadata: { warnings, totalRows: 0, totalSheets: 0, fileSize: 0, parseTime: 0 }
      };
    }
    
    // Fallback: Create a simple line-by-line extraction
    const data = lines.map((line, index) => ({
      line_number: index + 1,
      content: line.trim()
    }));
    
    return {
      name: file.name,
      sheets: [{
        name: 'PDF_Content',
        data,
        headers: ['line_number', 'content'],
        metadata: {
          dataTypes: { line_number: 'number', content: 'string' }
        }
      }],
      metadata: { warnings, totalRows: 0, totalSheets: 0, fileSize: 0, parseTime: 0 }
    };
    
  } catch (error) {
    console.error('PDF parsing error:', error);
    return {
      name: file.name,
      sheets: [{
        name: 'PDF_Content',
        data: [],
        headers: [],
        metadata: {}
      }],
      metadata: { 
        warnings: [`PDF parsing failed: ${error}`],
        totalRows: 0,
        totalSheets: 0,
        fileSize: 0,
        parseTime: 0
      }
    };
  }
}

function extractTablesFromText(lines: string[]): Array<{
  headers: string[];
  data: any[];
  dataTypes: Record<string, string>;
}> {
  const tables: Array<{ headers: string[]; data: any[]; dataTypes: Record<string, string> }> = [];
  
  // Look for table-like patterns (lines with consistent delimiters)
  let currentTable: { headers: string[]; rows: string[][] } | null = null;
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    
    // Check if line looks like a table row (has multiple columns separated by spaces/tabs)
    const columns = line.split(/\s{2,}|\t/).filter(col => col.trim() !== '');
    
    if (columns.length >= 2) {
      if (!currentTable) {
        // Start new table with this as headers
        currentTable = {
          headers: columns.map(col => col.trim()),
          rows: []
        };
      } else if (currentTable.rows.length < 100) {
        // Add as data row (limit to prevent huge tables)
        currentTable.rows.push(columns.map(col => col.trim()));
      }
    } else if (currentTable && currentTable.rows.length > 0) {
      // End of table, process it
      const { cleanedData, dataTypes } = processTableData(
        currentTable.headers,
        currentTable.rows
      );
      
      if (cleanedData.length > 0) {
        tables.push({
          headers: currentTable.headers,
          data: cleanedData,
          dataTypes
        });
      }
      
      currentTable = null;
    }
  }
  
  // Process last table if exists
  if (currentTable && currentTable.rows.length > 0) {
    const { cleanedData, dataTypes } = processTableData(
      currentTable.headers,
      currentTable.rows
    );
    
    if (cleanedData.length > 0) {
      tables.push({
        headers: currentTable.headers,
        data: cleanedData,
        dataTypes
      });
    }
  }
  
  return tables;
}

function processTableData(
  headers: string[],
  rows: string[][]
): { cleanedData: any[]; dataTypes: Record<string, string> } {
  const data = rows.map(row => {
    const obj: any = {};
    headers.forEach((header, index) => {
      const value = row[index] || null;
      if (value) {
        // Try to parse as number
        const numValue = parseNumericValue(value);
        if (numValue !== null) {
          obj[header] = numValue;
        } else if (isDateString(value)) {
          obj[header] = value;
        } else {
          obj[header] = value;
        }
      } else {
        obj[header] = null;
      }
    });
    return obj;
  });
  
  return cleanAndValidateData(data, headers);
}

function cleanAndValidateData(
  data: any[],
  headers: string[]
): { cleanedData: any[], dataTypes: Record<string, string> } {
  const dataTypes: Record<string, string> = {};
  const typeCounters: Record<string, Record<string, number>> = {};
  
  // Initialize type counters
  headers.forEach(header => {
    typeCounters[header] = { string: 0, number: 0, date: 0, boolean: 0, null: 0 };
  });
  
  // Clean data and count types
  const cleanedData = data.filter(row => {
    // Filter out completely empty rows
    const hasData = headers.some(header => row[header] !== null && row[header] !== undefined && row[header] !== '');
    if (!hasData) return false;
    
    // Clean and validate each cell
    for (const header of headers) {
      let value = row[header];
      
      // Clean and detect type
      if (value === undefined || value === '' || value === null) {
        row[header] = null;
        typeCounters[header].null++;
      } else if (typeof value === 'boolean') {
        typeCounters[header].boolean++;
      } else if (typeof value === 'number') {
        // Validate number
        if (!isFinite(value)) {
          row[header] = null;
          typeCounters[header].null++;
        } else {
          typeCounters[header].number++;
        }
      } else if (typeof value === 'string') {
        value = value.trim();
        
        // Try to parse as number
        const numericValue = parseNumericValue(value);
        if (numericValue !== null) {
          row[header] = numericValue;
          typeCounters[header].number++;
        } else if (isDateString(value)) {
          // Keep as string but mark as date
          row[header] = value;
          typeCounters[header].date++;
        } else if (value.toLowerCase() === 'true' || value.toLowerCase() === 'false') {
          row[header] = value.toLowerCase() === 'true';
          typeCounters[header].boolean++;
        } else {
          row[header] = value;
          typeCounters[header].string++;
        }
      }
    }
    
    return true;
  });
  
  // Determine dominant type for each column
  headers.forEach(header => {
    const counts = typeCounters[header];
    const totalNonNull = counts.string + counts.number + counts.date + counts.boolean;
    
    if (totalNonNull === 0) {
      dataTypes[header] = 'null';
    } else {
      // Find dominant type (excluding null)
      let dominantType = 'string';
      let maxCount = counts.string;
      
      if (counts.number > maxCount) {
        dominantType = 'number';
        maxCount = counts.number;
      }
      if (counts.date > maxCount) {
        dominantType = 'date';
        maxCount = counts.date;
      }
      if (counts.boolean > maxCount) {
        dominantType = 'boolean';
      }
      
      dataTypes[header] = dominantType;
    }
  });
  
  return { cleanedData, dataTypes };
}

function parseNumericValue(str: string): number | null {
  // Remove common currency symbols and formatting
  const cleaned = str.replace(/[$,€£¥₹\s]/g, '').trim();
  
  // Handle parentheses as negative (accounting format)
  const isNegative = cleaned.startsWith('(') && cleaned.endsWith(')');
  const numStr = isNegative ? cleaned.slice(1, -1) : cleaned;
  
  // Handle percentage
  const isPercentage = numStr.endsWith('%');
  const baseStr = isPercentage ? numStr.slice(0, -1) : numStr;
  
  // Try to parse as number
  const num = parseFloat(baseStr);
  
  if (!isNaN(num) && isFinite(num)) {
    let result = isNegative ? -num : num;
    if (isPercentage) result = result / 100;
    return result;
  }
  
  return null;
}

function isDateString(str: string): boolean {
  const trimmed = str.trim();
  
  // Check for common date formats
  const datePatterns = [
    /^\d{1,2}\/\d{1,2}\/\d{4}$/,     // MM/dd/yyyy
    /^\d{1,2}-\d{1,2}-\d{4}$/,      // MM-dd-yyyy
    /^\d{4}-\d{1,2}-\d{1,2}$/,      // yyyy-MM-dd
    /^\d{1,2}\/\d{1,2}\/\d{2}$/,    // MM/dd/yy
    /^\d{1,2}\.\d{1,2}\.\d{4}$/,    // dd.MM.yyyy
    /^\d{4}\/\d{1,2}\/\d{1,2}$/,    // yyyy/MM/dd
    /^\w{3}\s+\d{1,2},?\s+\d{4}$/,  // Jan 1, 2024
    /^\d{1,2}\s+\w{3}\s+\d{4}$/,    // 1 Jan 2024
  ];
  
  // First check pattern
  const matchesPattern = datePatterns.some(pattern => pattern.test(trimmed));
  if (!matchesPattern) return false;
  
  // Then validate it's a real date
  const parsed = Date.parse(trimmed);
  if (isNaN(parsed)) return false;
  
  // Check if the date is reasonable (between 1900 and 2100)
  const date = new Date(parsed);
  const year = date.getFullYear();
  return year >= 1900 && year <= 2100;
}

export function detectDatasetType(sheets: ParsedSheet[]): 'financial' | 'inventory' | 'sales' | 'hr' | 'general' {
  const allHeaders = sheets.flatMap(sheet => sheet.headers.map(h => h.toLowerCase()));
  
  // Financial indicators
  const financialTerms = ['amount', 'balance', 'debit', 'credit', 'invoice', 'payment', 'vendor', 'account', 'ledger', 'revenue', 'expense', 'cost'];
  const financialCount = financialTerms.filter(term => 
    allHeaders.some(header => header.includes(term))
  ).length;
  
  // Sales indicators
  const salesTerms = ['sales', 'customer', 'product', 'quantity', 'price', 'order', 'purchase'];
  const salesCount = salesTerms.filter(term => 
    allHeaders.some(header => header.includes(term))
  ).length;
  
  // Inventory indicators
  const inventoryTerms = ['inventory', 'stock', 'warehouse', 'item', 'sku', 'quantity'];
  const inventoryCount = inventoryTerms.filter(term => 
    allHeaders.some(header => header.includes(term))
  ).length;
  
  // HR indicators
  const hrTerms = ['employee', 'salary', 'wage', 'department', 'position', 'hire'];
  const hrCount = hrTerms.filter(term => 
    allHeaders.some(header => header.includes(term))
  ).length;
  
  // Return the category with the highest score
  const scores = {
    financial: financialCount,
    sales: salesCount,
    inventory: inventoryCount,
    hr: hrCount
  };
  
  const maxCategory = Object.entries(scores).reduce((a, b) => scores[a[0] as keyof typeof scores] > scores[b[0] as keyof typeof scores] ? a : b)[0];
  
  return maxCategory as 'financial' | 'inventory' | 'sales' | 'hr' | 'general' || 'general';
}