import Anthropic from '@anthropic-ai/sdk';
import { analyzeTable, executeQuery } from './database';

// Initialize Anthropic client
// Note: In production, use environment variables
const anthropic = process.env.ANTHROPIC_API_KEY 
  ? new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY,
    })
  : null;

export interface TableSchema {
  tableName: string;
  columns: Array<{
    name: string;
    type: string;
    nullable?: boolean;
  }>;
  rowCount?: number;
}

export interface SQLQueryResult {
  query: string;
  explanation: string;
  suggestions?: string[];
  error?: string;
}

export interface AnalysisResult {
  content: string;
  query?: string;
  data?: any[];
  insights?: string[];
  suggestions?: Array<{
    id: string;
    label: string;
    category: 'invoice' | 'voucher' | 'approval' | 'export' | 'analysis';
  }>;
}

/**
 * Convert natural language to SQL query
 */
export async function naturalLanguageToSQL(
  question: string,
  schemas: TableSchema[]
): Promise<SQLQueryResult> {
  if (!anthropic) {
    // Fallback to pattern matching if no API key
    return fallbackNLToSQL(question, schemas);
  }

  try {
    const schemaDescription = schemas.map(s => 
      `Table: ${s.tableName}\nColumns: ${s.columns.map(c => `${c.name} (${c.type})`).join(', ')}\nRows: ${s.rowCount || 'unknown'}`
    ).join('\n\n');

    const prompt = `You are a SQL expert helping to analyze financial data in DuckDB. Convert the following natural language question to a SQL query.

Database Schema:
${schemaDescription}

Question: ${question}

Generate a SQL query that answers this question. Return your response in this exact JSON format:
{
  "query": "SELECT ...",
  "explanation": "Brief explanation of what the query does",
  "suggestions": ["Optional follow-up questions"]
}

Important:
- Use DuckDB SQL syntax
- Use double quotes for column names with spaces or special characters
- For date comparisons, use CURRENT_DATE
- For currency/amount columns, handle them as DOUBLE or DECIMAL
- Include appropriate JOINs if the question spans multiple tables
- Always include ORDER BY and LIMIT clauses when appropriate`;

    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1000,
      temperature: 0,
      system: 'You are a SQL expert. Always respond with valid JSON.',
      messages: [
        {
          role: 'user',
          content: prompt
        }
      ]
    });

    const content = response.content[0];
    if (content.type === 'text') {
      try {
        const result = JSON.parse(content.text);
        return {
          query: result.query,
          explanation: result.explanation,
          suggestions: result.suggestions
        };
      } catch (parseError) {
        // Try to extract SQL from the response
        const sqlMatch = content.text.match(/SELECT[\s\S]+?(?:;|$)/i);
        if (sqlMatch) {
          return {
            query: sqlMatch[0],
            explanation: 'Generated SQL query',
            suggestions: []
          };
        }
      }
    }

    return fallbackNLToSQL(question, schemas);
  } catch (error) {
    console.error('Error in naturalLanguageToSQL:', error);
    return fallbackNLToSQL(question, schemas);
  }
}

/**
 * Analyze data and provide insights
 */
export async function analyzeDataWithLLM(
  question: string,
  queryResult: any[],
  schemas: TableSchema[]
): Promise<AnalysisResult> {
  if (!anthropic) {
    return {
      content: formatQueryResults(queryResult),
      data: queryResult
    };
  }

  try {
    const prompt = `You are a financial data analyst. Analyze the following query results and provide insights.

Question: ${question}

Query Results (first 10 rows):
${JSON.stringify(queryResult.slice(0, 10), null, 2)}

Total rows returned: ${queryResult.length}

Provide:
1. A clear summary of the findings
2. Key insights from the data
3. Any patterns or anomalies you notice
4. Suggestions for follow-up analysis

Format your response in markdown with clear headings.`;

    const response = await anthropic.messages.create({
      model: 'claude-3-haiku-20240307',
      max_tokens: 1500,
      temperature: 0.3,
      messages: [
        {
          role: 'user',
          content: prompt
        }
      ]
    });

    const content = response.content[0];
    if (content.type === 'text') {
      // Generate suggestions based on the analysis
      const suggestions = generateSuggestions(question, queryResult);
      
      return {
        content: content.text,
        data: queryResult,
        suggestions
      };
    }

    return {
      content: formatQueryResults(queryResult),
      data: queryResult
    };
  } catch (error) {
    console.error('Error in analyzeDataWithLLM:', error);
    return {
      content: formatQueryResults(queryResult),
      data: queryResult
    };
  }
}

/**
 * Generate financial insights from table analysis
 */
export async function generateFinancialInsights(
  tableName: string,
  analysis: any
): Promise<string> {
  if (!anthropic) {
    return formatTableAnalysis(analysis);
  }

  try {
    const prompt = `You are a financial analyst. Analyze the following table statistics and provide actionable insights.

Table: ${tableName}
Analysis: ${JSON.stringify(analysis, null, 2)}

Provide:
1. Summary of the data structure
2. Key financial metrics identified
3. Data quality observations
4. Recommendations for analysis

Keep your response concise and focused on actionable insights.`;

    const response = await anthropic.messages.create({
      model: 'claude-3-haiku-20240307',
      max_tokens: 800,
      temperature: 0.3,
      messages: [
        {
          role: 'user',
          content: prompt
        }
      ]
    });

    const content = response.content[0];
    if (content.type === 'text') {
      return content.text;
    }

    return formatTableAnalysis(analysis);
  } catch (error) {
    console.error('Error in generateFinancialInsights:', error);
    return formatTableAnalysis(analysis);
  }
}

/**
 * Fallback pattern matching for NL to SQL
 */
function fallbackNLToSQL(question: string, schemas: TableSchema[]): SQLQueryResult {
  const lowerQuestion = question.toLowerCase();
  const tableName = schemas[0]?.tableName || 'table';
  
  // Overdue analysis
  if (lowerQuestion.includes('overdue')) {
    return {
      query: `
        SELECT * 
        FROM ${tableName}
        WHERE due_date < CURRENT_DATE 
          AND (status != 'paid' OR status IS NULL)
        ORDER BY due_date ASC`,
      explanation: 'Find all overdue items based on due date',
      suggestions: ['Show overdue amounts by vendor', 'Calculate total overdue amount']
    };
  }
  
  // Summary queries
  if (lowerQuestion.includes('summary') || lowerQuestion.includes('overview')) {
    return {
      query: `
        SELECT 
          COUNT(*) as total_records,
          COUNT(DISTINCT vendor_name) as unique_vendors,
          SUM(amount) as total_amount,
          AVG(amount) as avg_amount
        FROM ${tableName}`,
      explanation: 'Generate summary statistics',
      suggestions: ['Group by status', 'Show monthly trends']
    };
  }
  
  // Top queries
  if (lowerQuestion.includes('top') || lowerQuestion.includes('largest')) {
    return {
      query: `
        SELECT *
        FROM ${tableName}
        ORDER BY amount DESC
        LIMIT 10`,
      explanation: 'Show top 10 records by amount',
      suggestions: ['Group by vendor', 'Filter by date range']
    };
  }
  
  // Group by queries
  if (lowerQuestion.includes('by vendor') || lowerQuestion.includes('per vendor')) {
    return {
      query: `
        SELECT 
          vendor_name,
          COUNT(*) as invoice_count,
          SUM(amount) as total_amount,
          AVG(amount) as avg_amount
        FROM ${tableName}
        GROUP BY vendor_name
        ORDER BY total_amount DESC`,
      explanation: 'Aggregate data by vendor',
      suggestions: ['Filter by status', 'Add date range']
    };
  }
  
  // Default query
  return {
    query: `SELECT * FROM ${tableName} LIMIT 100`,
    explanation: 'Show sample data from the table',
    suggestions: ['Add filters', 'Aggregate by columns', 'Search for specific values']
  };
}

/**
 * Format query results as readable text
 */
function formatQueryResults(results: any[]): string {
  if (!results || results.length === 0) {
    return 'No results found for your query.';
  }
  
  let content = `Found **${results.length} results**\n\n`;
  
  // Show first few results
  const preview = results.slice(0, 5);
  if (preview.length > 0) {
    content += '### Sample Results:\n\n';
    preview.forEach((row, i) => {
      content += `**Row ${i + 1}:**\n`;
      Object.entries(row).forEach(([key, value]) => {
        if (value !== null && value !== undefined) {
          content += `- ${key}: ${formatValue(value)}\n`;
        }
      });
      content += '\n';
    });
    
    if (results.length > 5) {
      content += `*...and ${results.length - 5} more rows*\n`;
    }
  }
  
  // Add summary statistics for numeric columns
  const numericColumns = Object.keys(results[0]).filter(key => 
    typeof results[0][key] === 'number'
  );
  
  if (numericColumns.length > 0) {
    content += '\n### Summary Statistics:\n\n';
    numericColumns.forEach(col => {
      const values = results.map(r => r[col]).filter(v => v !== null);
      const sum = values.reduce((a, b) => a + b, 0);
      const avg = sum / values.length;
      const min = Math.min(...values);
      const max = Math.max(...values);
      
      content += `**${col}:**\n`;
      content += `- Total: ${formatValue(sum)}\n`;
      content += `- Average: ${formatValue(avg)}\n`;
      content += `- Min: ${formatValue(min)}\n`;
      content += `- Max: ${formatValue(max)}\n\n`;
    });
  }
  
  return content;
}

/**
 * Format table analysis results
 */
function formatTableAnalysis(analysis: any): string {
  let content = '### Table Analysis\n\n';
  
  if (analysis.table_stats) {
    content += `**Overview:**\n`;
    content += `- Total Rows: ${analysis.table_stats.row_count}\n`;
    content += `- Unique Rows: ${analysis.table_stats.unique_rows}\n\n`;
  }
  
  if (analysis.columns && analysis.columns.length > 0) {
    content += '**Column Analysis:**\n\n';
    analysis.columns.forEach((col: any) => {
      content += `**${col.name}** (${col.type}):\n`;
      if (col.null_count !== undefined) {
        content += `- Null values: ${col.null_count}\n`;
      }
      if (col.distinct_count !== undefined) {
        content += `- Distinct values: ${col.distinct_count}\n`;
      }
      if (col.min_val !== undefined) {
        content += `- Range: ${formatValue(col.min_val)} to ${formatValue(col.max_val)}\n`;
      }
      content += '\n';
    });
  }
  
  return content;
}

/**
 * Format a value for display
 */
function formatValue(value: any): string {
  if (value === null || value === undefined) return 'N/A';
  if (typeof value === 'number') {
    if (value >= 1000) {
      return value.toLocaleString('en-US', { maximumFractionDigits: 2 });
    }
    return value.toString();
  }
  if (value instanceof Date) {
    return value.toLocaleDateString();
  }
  return String(value);
}

/**
 * Generate action suggestions based on query results
 */
function generateSuggestions(question: string, results: any[]): AnalysisResult['suggestions'] {
  const suggestions: AnalysisResult['suggestions'] = [];
  const lowerQuestion = question.toLowerCase();
  
  if (lowerQuestion.includes('overdue') && results.length > 0) {
    suggestions.push({
      id: 'draft_reminders',
      label: 'Draft payment reminder emails',
      category: 'invoice'
    });
    suggestions.push({
      id: 'export_overdue',
      label: 'Export overdue list to Excel',
      category: 'export'
    });
    suggestions.push({
      id: 'aging_report',
      label: 'Generate aging report',
      category: 'analysis'
    });
  }
  
  if (results.length > 0) {
    suggestions.push({
      id: 'export_results',
      label: 'Export results to CSV',
      category: 'export'
    });
  }
  
  if (lowerQuestion.includes('vendor') || lowerQuestion.includes('customer')) {
    suggestions.push({
      id: 'create_statement',
      label: 'Create account statement',
      category: 'invoice'
    });
  }
  
  return suggestions;
}

/**
 * Check if LLM is available
 */
export function isLLMAvailable(): boolean {
  return anthropic !== null;
}