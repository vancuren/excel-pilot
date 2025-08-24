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

Generate a SQL query that answers this question. 

CRITICAL: You MUST respond with ONLY a valid JSON object, no additional text before or after.
Return your response in this EXACT format:
{
  "query": "SELECT ...",
  "explanation": "Brief explanation of what the query does",
  "suggestions": ["Optional follow-up question 1", "Optional follow-up question 2"]
}

SQL Requirements:
- Use DuckDB SQL syntax
- Use double quotes for column names with spaces or special characters
- For date comparisons, use CURRENT_DATE
- For currency/amount columns, handle them as DOUBLE or DECIMAL
- Include appropriate JOINs if the question spans multiple tables
- Always include ORDER BY and LIMIT clauses when appropriate
- Do NOT include semicolons at the end of the query`;

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
      // Clean the response text - remove markdown code blocks if present
      let cleanedText = content.text.trim();
      
      // Remove markdown JSON code blocks
      cleanedText = cleanedText.replace(/^```json?\s*/i, '').replace(/\s*```$/i, '');
      
      // Try to find JSON object in the response
      const jsonMatch = cleanedText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        try {
          const result = JSON.parse(jsonMatch[0]);
          
          // Validate the response structure
          if (result.query && typeof result.query === 'string') {
            // Clean up the SQL query
            let query = result.query.trim();
            
            // Remove any trailing semicolons (DuckDB doesn't need them)
            query = query.replace(/;\s*$/, '');
            
            // Validate basic SQL syntax
            if (!query.match(/^\s*(SELECT|WITH|INSERT|UPDATE|DELETE|CREATE|DROP|ALTER)/i)) {
              throw new Error('Invalid SQL query structure');
            }
            
            return {
              query: query,
              explanation: result.explanation || 'Generated SQL query',
              suggestions: Array.isArray(result.suggestions) ? result.suggestions : []
            };
          }
        } catch (parseError) {
          console.warn('Failed to parse JSON response:', parseError);
        }
      }
      
      // Fallback: Try to extract SQL directly from the response
      const sqlPatterns = [
        /```sql?\s*([\s\S]+?)\s*```/i,  // SQL in markdown code block
        /SELECT[\s\S]+?(?:FROM[\s\S]+?)(?:;|\s*$)/i,  // Direct SELECT statement
        /WITH[\s\S]+?SELECT[\s\S]+?(?:;|\s*$)/i,  // CTE query
      ];
      
      for (const pattern of sqlPatterns) {
        const match = cleanedText.match(pattern);
        if (match) {
          let query = (match[1] || match[0]).trim();
          query = query.replace(/;\s*$/, '');
          
          // Basic validation
          if (query.match(/^\s*(SELECT|WITH)/i)) {
            return {
              query: query,
              explanation: 'Extracted SQL query from response',
              suggestions: []
            };
          }
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
      model: 'claude-sonnet-4-20250514',
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
      model: 'claude-sonnet-4-20250514',
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
  const columns = schemas[0]?.columns || [];
  
  // Helper to find column names (case-insensitive)
  const findColumn = (patterns: string[]): string | null => {
    for (const pattern of patterns) {
      const col = columns.find(c => c.name.toLowerCase().includes(pattern));
      if (col) return `"${col.name}"`;
    }
    return null;
  };
  
  const amountCol = findColumn(['amount', 'total', 'price', 'cost', 'value']) || 'amount';
  const dateCol = findColumn(['date', 'created', 'updated', 'due']) || 'date';
  const statusCol = findColumn(['status', 'state']) || 'status';
  const nameCol = findColumn(['vendor', 'customer', 'name', 'company']) || 'name';
  
  // Clean up queries - remove extra whitespace and newlines
  const cleanQuery = (query: string) => query.trim().replace(/\s+/g, ' ');
  
  // Overdue analysis
  if (lowerQuestion.includes('overdue')) {
    return {
      query: cleanQuery(`SELECT * FROM ${tableName} WHERE ${dateCol} < CURRENT_DATE AND (${statusCol} != 'paid' OR ${statusCol} IS NULL) ORDER BY ${dateCol} ASC`),
      explanation: 'Find all overdue items based on due date',
      suggestions: ['Show overdue amounts by vendor', 'Calculate total overdue amount']
    };
  }
  
  // Summary queries
  if (lowerQuestion.includes('summary') || lowerQuestion.includes('overview')) {
    return {
      query: cleanQuery(`SELECT COUNT(*) as total_records, COUNT(DISTINCT ${nameCol}) as unique_entities, SUM(${amountCol}) as total_amount, AVG(${amountCol}) as avg_amount FROM ${tableName}`),
      explanation: 'Generate summary statistics',
      suggestions: ['Group by status', 'Show monthly trends']
    };
  }
  
  // Top queries
  if (lowerQuestion.includes('top') || lowerQuestion.includes('largest') || lowerQuestion.includes('highest')) {
    const numberMatch = lowerQuestion.match(/\d+/);
    const limit = numberMatch ? parseInt(numberMatch[0]) : 10;
    return {
      query: cleanQuery(`SELECT * FROM ${tableName} ORDER BY ${amountCol} DESC LIMIT ${limit}`),
      explanation: `Show top ${limit} records by amount`,
      suggestions: ['Group by vendor', 'Filter by date range']
    };
  }
  
  // Group by queries
  if (lowerQuestion.includes('by vendor') || lowerQuestion.includes('per vendor') || lowerQuestion.includes('group by')) {
    return {
      query: cleanQuery(`SELECT ${nameCol}, COUNT(*) as count, SUM(${amountCol}) as total_amount, AVG(${amountCol}) as avg_amount FROM ${tableName} GROUP BY ${nameCol} ORDER BY total_amount DESC`),
      explanation: 'Aggregate data by grouping',
      suggestions: ['Filter by status', 'Add date range']
    };
  }
  
  // Count queries
  if (lowerQuestion.includes('how many') || lowerQuestion.includes('count')) {
    return {
      query: cleanQuery(`SELECT COUNT(*) as total_count FROM ${tableName}`),
      explanation: 'Count total records',
      suggestions: ['Count by status', 'Count unique values']
    };
  }
  
  // Total/sum queries
  if (lowerQuestion.includes('total') || lowerQuestion.includes('sum')) {
    return {
      query: cleanQuery(`SELECT SUM(${amountCol}) as total_amount FROM ${tableName}`),
      explanation: 'Calculate total amount',
      suggestions: ['Total by month', 'Total by category']
    };
  }
  
  // Average queries
  if (lowerQuestion.includes('average') || lowerQuestion.includes('avg')) {
    return {
      query: cleanQuery(`SELECT AVG(${amountCol}) as average_amount FROM ${tableName}`),
      explanation: 'Calculate average amount',
      suggestions: ['Average by vendor', 'Average by month']
    };
  }
  
  // Default query - show sample with all columns
  return {
    query: cleanQuery(`SELECT * FROM ${tableName} LIMIT 25`),
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
 * Analyze user intent for email actions
 */
export async function analyzeEmailIntent(
  question: string,
  queryResults: any[]
): Promise<{
  shouldSendEmail: boolean;
  emailType?: 'invoice' | 'reminder' | 'statement' | 'report';
  recipients?: Array<{ email: string; name: string; data: any }>;
  subject?: string;
  message?: string;
}> {
  const lowerQuestion = question.toLowerCase();
  
  // Check for email-related keywords
  const emailKeywords = ['email', 'send', 'notify', 'remind', 'invoice'];
  const shouldSendEmail = emailKeywords.some(keyword => lowerQuestion.includes(keyword));
  
  if (!shouldSendEmail) {
    return { shouldSendEmail: false };
  }
  
  // Determine email type
  let emailType: 'invoice' | 'reminder' | 'statement' | 'report' = 'reminder';
  if (lowerQuestion.includes('invoice')) {
    emailType = 'invoice';
  } else if (lowerQuestion.includes('statement')) {
    emailType = 'statement';
  } else if (lowerQuestion.includes('report')) {
    emailType = 'report';
  }
  
  // Extract recipients from query results
  const recipients: Array<{ email: string; name: string; data: any }> = [];
  
  // Look for email columns in the data
  if (queryResults && queryResults.length > 0) {
    const emailColumns = Object.keys(queryResults[0]).filter(key => 
      key.toLowerCase().includes('email') || key.toLowerCase().includes('mail')
    );
    const nameColumns = Object.keys(queryResults[0]).filter(key => 
      key.toLowerCase().includes('name') || key.toLowerCase().includes('vendor') || 
      key.toLowerCase().includes('customer') || key.toLowerCase().includes('client')
    );
    
    const emailCol = emailColumns[0];
    const nameCol = nameColumns[0];
    
    if (emailCol) {
      queryResults.forEach(row => {
        if (row[emailCol]) {
          recipients.push({
            email: row[emailCol],
            name: nameCol ? row[nameCol] : 'Customer',
            data: row
          });
        }
      });
    }
  }
  
  // Generate subject and message based on type
  let subject = '';
  let message = '';
  
  switch (emailType) {
    case 'invoice':
      subject = 'Invoice Payment Reminder';
      message = 'Please find your invoice details below. Payment is due soon.';
      break;
    case 'reminder':
      subject = 'Payment Reminder';
      message = 'This is a friendly reminder about your outstanding balance.';
      break;
    case 'statement':
      subject = 'Account Statement';
      message = 'Please find your account statement attached.';
      break;
    case 'report':
      subject = 'Report Generated';
      message = 'Your requested report has been generated.';
      break;
  }
  
  return {
    shouldSendEmail: true,
    emailType,
    recipients,
    subject,
    message
  };
}

/**
 * Check if LLM is available
 */
export function isLLMAvailable(): boolean {
  return anthropic !== null;
}