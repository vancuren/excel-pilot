import Anthropic from '@anthropic-ai/sdk';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import ExcelJS from 'exceljs';

// Initialize Anthropic client
const anthropic = process.env.ANTHROPIC_API_KEY 
  ? new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY,
    })
  : null;

export interface ToolExecutionResult {
  success: boolean;
  type: 'report' | 'email' | 'invoice' | 'export';
  content?: string;
  file?: {
    data: Buffer | Blob | string;
    filename: string;
    mimetype: string;
  };
  html?: string;
  error?: string;
}

export interface ReportGenerationParams {
  title: string;
  data: any[];
  analysis?: string;
  format: 'pdf' | 'excel' | 'html';
  userQuery: string;
}

export interface EmailGenerationParams {
  type: 'invoice' | 'report' | 'reminder' | 'statement';
  recipient: string;
  data: any[];
  context: string;
}

export interface EmailSendParams {
  to: string | string[];
  subject: string;
  message: string;
  data?: any[];
  mailgunConfig?: {
    apiKey: string;
    domain: string;
    from: string;
  };
}

export interface PurchaseProductParams {
  productUrl: string;
  recipientEmail?: string;
}

/**
 * Generate a comprehensive report using LLM analysis
 */
export async function generateReport(params: ReportGenerationParams): Promise<ToolExecutionResult> {
  try {
    // First, get LLM to analyze and structure the report content
    const reportContent = await generateReportContent(params);
    
    switch (params.format) {
      case 'pdf':
        return await generatePDFReport(reportContent, params);
      case 'excel':
        return await generateExcelReport(reportContent, params);
      case 'html':
        return await generateHTMLReport(reportContent, params);
      default:
        throw new Error(`Unsupported format: ${params.format}`);
    }
  } catch (error) {
    console.error('Report generation error:', error);
    return {
      success: false,
      type: 'report',
      error: error instanceof Error ? error.message : 'Report generation failed'
    };
  }
}

/**
 * Generate report content using LLM
 */
async function generateReportContent(params: ReportGenerationParams): Promise<any> {
  if (!anthropic) {
    // Fallback content without LLM
    return {
      title: params.title,
      summary: 'Data analysis report',
      sections: [
        {
          heading: 'Data Overview',
          content: `Total records: ${params.data.length}`,
          data: params.data.slice(0, 10)
        }
      ],
      insights: [],
      recommendations: []
    };
  }

  const prompt = `You are creating a professional financial report. Analyze the following data and create a structured report.

User Query: ${params.userQuery}
Report Title: ${params.title}
Data Sample (first 10 rows): ${JSON.stringify(params.data.slice(0, 10), null, 2)}
Total Records: ${params.data.length}

Generate a comprehensive report with the following structure:
1. Executive Summary
2. Key Findings
3. Data Analysis
4. Insights and Patterns
5. Recommendations
6. Next Steps

Format your response as JSON with this structure:
{
  "title": "Report title",
  "executiveSummary": "Brief overview",
  "keyFindings": ["finding 1", "finding 2"],
  "analysis": {
    "summary": "Analysis summary",
    "metrics": [{"name": "metric", "value": "value", "trend": "up/down/stable"}]
  },
  "insights": ["insight 1", "insight 2"],
  "recommendations": ["recommendation 1", "recommendation 2"],
  "nextSteps": ["step 1", "step 2"]
}`;

  try {
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 2000,
      temperature: 0.3,
      system: 'You are a financial analyst creating professional reports. Always respond with valid JSON.',
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
        return JSON.parse(content.text);
      } catch {
        // Try to extract JSON from the response
        const jsonMatch = content.text.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          return JSON.parse(jsonMatch[0]);
        }
      }
    }
  } catch (error) {
    console.error('LLM report generation error:', error);
  }

  // Fallback structure
  return {
    title: params.title,
    executiveSummary: `Analysis of ${params.data.length} records`,
    keyFindings: [`Dataset contains ${params.data.length} records`],
    analysis: {
      summary: 'Data analysis completed',
      metrics: []
    },
    insights: [],
    recommendations: [],
    nextSteps: []
  };
}

/**
 * Generate PDF report
 */
async function generatePDFReport(content: any, params: ReportGenerationParams): Promise<ToolExecutionResult> {
  const doc = new jsPDF();
  let yPosition = 20;

  // Title
  doc.setFontSize(20);
  doc.text(content.title || params.title, 20, yPosition);
  yPosition += 15;

  // Date
  doc.setFontSize(10);
  doc.text(`Generated: ${new Date().toLocaleDateString()}`, 20, yPosition);
  yPosition += 10;

  // Executive Summary
  if (content.executiveSummary) {
    doc.setFontSize(14);
    doc.text('Executive Summary', 20, yPosition);
    yPosition += 8;
    doc.setFontSize(10);
    const summaryLines = doc.splitTextToSize(content.executiveSummary, 170);
    doc.text(summaryLines, 20, yPosition);
    yPosition += summaryLines.length * 5 + 5;
  }

  // Key Findings
  if (content.keyFindings && content.keyFindings.length > 0) {
    doc.setFontSize(14);
    doc.text('Key Findings', 20, yPosition);
    yPosition += 8;
    doc.setFontSize(10);
    content.keyFindings.forEach((finding: string) => {
      doc.text(`• ${finding}`, 25, yPosition);
      yPosition += 6;
    });
    yPosition += 5;
  }

  // Add data table
  if (params.data.length > 0) {
    doc.setFontSize(14);
    doc.text('Data Table', 20, yPosition);
    yPosition += 8;

    const headers = Object.keys(params.data[0]);
    const rows = params.data.slice(0, 20).map(row => 
      headers.map(header => {
        const value = row[header];
        if (value === null || value === undefined) return '';
        if (typeof value === 'number') return value.toLocaleString();
        return String(value);
      })
    );

    autoTable(doc, {
      head: [headers],
      body: rows,
      startY: yPosition,
      styles: { fontSize: 8 },
      headStyles: { fillColor: [41, 128, 185] }
    });
  }

  // Add new page for insights if needed
  if (content.insights && content.insights.length > 0) {
    doc.addPage();
    yPosition = 20;
    doc.setFontSize(14);
    doc.text('Insights & Recommendations', 20, yPosition);
    yPosition += 10;
    
    doc.setFontSize(10);
    content.insights.forEach((insight: string) => {
      doc.text(`• ${insight}`, 25, yPosition);
      yPosition += 6;
    });
    
    if (content.recommendations && content.recommendations.length > 0) {
      yPosition += 5;
      doc.setFontSize(12);
      doc.text('Recommendations:', 20, yPosition);
      yPosition += 8;
      doc.setFontSize(10);
      content.recommendations.forEach((rec: string) => {
        doc.text(`→ ${rec}`, 25, yPosition);
        yPosition += 6;
      });
    }
  }

  const pdfData = doc.output('blob');
  
  return {
    success: true,
    type: 'report',
    file: {
      data: pdfData,
      filename: `report_${Date.now()}.pdf`,
      mimetype: 'application/pdf'
    }
  };
}

/**
 * Generate Excel report with multiple sheets
 */
async function generateExcelReport(content: any, params: ReportGenerationParams): Promise<ToolExecutionResult> {
  const workbook = new ExcelJS.Workbook();
  
  // Summary sheet
  const summarySheet = workbook.addWorksheet('Summary');
  summarySheet.columns = [
    { header: 'Section', key: 'section', width: 30 },
    { header: 'Content', key: 'content', width: 70 }
  ];

  summarySheet.addRow({ section: 'Report Title', content: content.title });
  summarySheet.addRow({ section: 'Generated Date', content: new Date().toLocaleDateString() });
  summarySheet.addRow({ section: 'Total Records', content: params.data.length });
  summarySheet.addRow({});
  summarySheet.addRow({ section: 'Executive Summary', content: content.executiveSummary });
  
  if (content.keyFindings) {
    content.keyFindings.forEach((finding: string, index: number) => {
      summarySheet.addRow({ section: `Finding ${index + 1}`, content: finding });
    });
  }

  // Style the header row
  summarySheet.getRow(1).font = { bold: true };
  summarySheet.getRow(1).fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FF2980B9' }
  };

  // Data sheet
  const dataSheet = workbook.addWorksheet('Data');
  if (params.data.length > 0) {
    const headers = Object.keys(params.data[0]);
    dataSheet.columns = headers.map(header => ({
      header: header,
      key: header,
      width: 15
    }));

    params.data.forEach(row => {
      dataSheet.addRow(row);
    });

    // Style the data sheet
    dataSheet.getRow(1).font = { bold: true };
    dataSheet.getRow(1).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFE0E0E0' }
    };
  }

  // Insights sheet
  if (content.insights || content.recommendations) {
    const insightsSheet = workbook.addWorksheet('Insights');
    insightsSheet.columns = [
      { header: 'Type', key: 'type', width: 20 },
      { header: 'Description', key: 'description', width: 80 }
    ];

    content.insights?.forEach((insight: string) => {
      insightsSheet.addRow({ type: 'Insight', description: insight });
    });

    content.recommendations?.forEach((rec: string) => {
      insightsSheet.addRow({ type: 'Recommendation', description: rec });
    });

    insightsSheet.getRow(1).font = { bold: true };
  }

  const buffer = await workbook.xlsx.writeBuffer();
  
  return {
    success: true,
    type: 'export',
    file: {
      data: Buffer.from(buffer),
      filename: `report_${Date.now()}.xlsx`,
      mimetype: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    }
  };
}

/**
 * Generate HTML report
 */
async function generateHTMLReport(content: any, params: ReportGenerationParams): Promise<ToolExecutionResult> {
  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>${content.title}</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; margin: 40px; color: #333; }
    h1 { color: #2c3e50; border-bottom: 3px solid #3498db; padding-bottom: 10px; }
    h2 { color: #34495e; margin-top: 30px; }
    .summary { background: #ecf0f1; padding: 20px; border-radius: 8px; margin: 20px 0; }
    .findings { background: #e8f4f8; padding: 15px; border-left: 4px solid #3498db; margin: 10px 0; }
    .metric { display: inline-block; margin: 10px 20px 10px 0; padding: 10px; background: white; border-radius: 5px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
    .metric-value { font-size: 24px; font-weight: bold; color: #2980b9; }
    .metric-label { font-size: 12px; color: #7f8c8d; }
    table { width: 100%; border-collapse: collapse; margin: 20px 0; }
    th { background: #3498db; color: white; padding: 12px; text-align: left; }
    td { padding: 10px; border-bottom: 1px solid #ecf0f1; }
    tr:hover { background: #f8f9fa; }
    .insights { background: #fff3cd; padding: 15px; border-radius: 5px; margin: 10px 0; }
    .recommendations { background: #d4edda; padding: 15px; border-radius: 5px; margin: 10px 0; }
    ul { line-height: 1.8; }
    .footer { margin-top: 40px; padding-top: 20px; border-top: 1px solid #dee2e6; color: #6c757d; font-size: 14px; }
  </style>
</head>
<body>
  <h1>${content.title}</h1>
  <p><strong>Generated:</strong> ${new Date().toLocaleString()}</p>
  
  <div class="summary">
    <h2>Executive Summary</h2>
    <p>${content.executiveSummary}</p>
  </div>

  ${content.keyFindings && content.keyFindings.length > 0 ? `
    <div class="findings">
      <h2>Key Findings</h2>
      <ul>
        ${content.keyFindings.map((finding: string) => `<li>${finding}</li>`).join('')}
      </ul>
    </div>
  ` : ''}

  ${content.analysis && content.analysis.metrics && content.analysis.metrics.length > 0 ? `
    <h2>Metrics</h2>
    <div>
      ${content.analysis.metrics.map((metric: any) => `
        <div class="metric">
          <div class="metric-value">${metric.value}</div>
          <div class="metric-label">${metric.name}</div>
        </div>
      `).join('')}
    </div>
  ` : ''}

  <h2>Data Sample</h2>
  <table>
    <thead>
      <tr>
        ${params.data.length > 0 ? Object.keys(params.data[0]).map(key => `<th>${key}</th>`).join('') : ''}
      </tr>
    </thead>
    <tbody>
      ${params.data.slice(0, 10).map(row => `
        <tr>
          ${Object.values(row).map(value => `<td>${value ?? ''}</td>`).join('')}
        </tr>
      `).join('')}
    </tbody>
  </table>

  ${content.insights && content.insights.length > 0 ? `
    <div class="insights">
      <h2>Insights</h2>
      <ul>
        ${content.insights.map((insight: string) => `<li>${insight}</li>`).join('')}
      </ul>
    </div>
  ` : ''}

  ${content.recommendations && content.recommendations.length > 0 ? `
    <div class="recommendations">
      <h2>Recommendations</h2>
      <ul>
        ${content.recommendations.map((rec: string) => `<li>${rec}</li>`).join('')}
      </ul>
    </div>
  ` : ''}

  <div class="footer">
    <p>This report was generated automatically using AI-powered analysis.</p>
  </div>
</body>
</html>`;

  return {
    success: true,
    type: 'report',
    html,
    file: {
      data: html,
      filename: `report_${Date.now()}.html`,
      mimetype: 'text/html'
    }
  };
}

/**
 * Generate email with LLM-created content
 */
export async function generateEmail(params: EmailGenerationParams): Promise<ToolExecutionResult> {
  try {
    const emailContent = await generateEmailContent(params);
    const html = await createEmailHTML(emailContent, params);
    
    return {
      success: true,
      type: 'email',
      html,
      content: emailContent.plainText
    };
  } catch (error) {
    console.error('Email generation error:', error);
    return {
      success: false,
      type: 'email',
      error: error instanceof Error ? error.message : 'Email generation failed'
    };
  }
}

/**
 * Generate email content using LLM
 */
async function generateEmailContent(params: EmailGenerationParams): Promise<any> {
  if (!anthropic) {
    // Fallback content
    return {
      subject: `${params.type.charAt(0).toUpperCase() + params.type.slice(1)} - ${new Date().toLocaleDateString()}`,
      greeting: `Dear ${params.recipient},`,
      body: `Please find the ${params.type} attached.`,
      closing: 'Best regards,',
      signature: 'Excel Pilot Team',
      plainText: `Dear ${params.recipient},\n\nPlease find the ${params.type} attached.\n\nBest regards,\nExcel Pilot Team`
    };
  }

  const prompt = `You are creating a professional email for a financial context. Generate email content based on the following:

Type: ${params.type}
Recipient: ${params.recipient}
Context: ${params.context}
Data Summary: ${params.data.length} records

Generate professional email content appropriate for the type. Return JSON with this structure:
{
  "subject": "Email subject line",
  "greeting": "Dear...",
  "body": "Main email content with proper formatting",
  "closing": "Professional closing",
  "signature": "Sender signature",
  "attachmentNote": "Note about attachments if applicable",
  "plainText": "Plain text version of the email"
}

For invoices: Include payment terms, due dates, and total amounts
For reports: Include executive summary and key findings
For reminders: Include urgency and specific action items
For statements: Include account summary and period covered`;

  try {
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1000,
      temperature: 0.3,
      system: 'You are a professional business communication expert. Always respond with valid JSON.',
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
        return JSON.parse(content.text);
      } catch {
        const jsonMatch = content.text.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          return JSON.parse(jsonMatch[0]);
        }
      }
    }
  } catch (error) {
    console.error('LLM email generation error:', error);
  }

  // Fallback
  return {
    subject: `${params.type} - ${new Date().toLocaleDateString()}`,
    greeting: `Dear ${params.recipient},`,
    body: `Please find the ${params.type} information below.`,
    closing: 'Best regards,',
    signature: 'Excel Pilot Team',
    plainText: `Dear ${params.recipient},\n\nPlease find the ${params.type} information below.\n\nBest regards,\nExcel Pilot Team`
  };
}

/**
 * Create HTML email template
 */
async function createEmailHTML(content: any, params: EmailGenerationParams): Promise<string> {
  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${content.subject}</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; border-radius: 10px 10px 0 0; text-align: center; }
    .content { background: white; padding: 30px; border: 1px solid #e0e0e0; border-top: none; }
    .data-table { width: 100%; border-collapse: collapse; margin: 20px 0; }
    .data-table th { background: #f5f5f5; padding: 10px; text-align: left; border-bottom: 2px solid #ddd; }
    .data-table td { padding: 10px; border-bottom: 1px solid #eee; }
    .footer { text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #e0e0e0; color: #666; font-size: 14px; }
    .button { display: inline-block; padding: 12px 24px; background: #667eea; color: white; text-decoration: none; border-radius: 5px; margin: 20px 0; }
    .invoice-total { font-size: 24px; font-weight: bold; color: #667eea; margin: 20px 0; }
  </style>
</head>
<body>
  <div class="header">
    <h1>${params.type === 'invoice' ? 'INVOICE' : params.type.toUpperCase()}</h1>
    ${params.type === 'invoice' ? `<p>Date: ${new Date().toLocaleDateString()}</p>` : ''}
  </div>
  
  <div class="content">
    <p>${content.greeting}</p>
    
    <div style="margin: 20px 0;">
      ${content.body.split('\n').map((para: string) => `<p>${para}</p>`).join('')}
    </div>

    ${params.data.length > 0 ? `
      <h3>Details</h3>
      <table class="data-table">
        <thead>
          <tr>
            ${Object.keys(params.data[0]).slice(0, 5).map(key => `<th>${key}</th>`).join('')}
          </tr>
        </thead>
        <tbody>
          ${params.data.slice(0, 5).map(row => `
            <tr>
              ${Object.values(row).slice(0, 5).map(value => `<td>${value ?? ''}</td>`).join('')}
            </tr>
          `).join('')}
        </tbody>
      </table>
      ${params.data.length > 5 ? `<p><em>...and ${params.data.length - 5} more items</em></p>` : ''}
    ` : ''}

    ${params.type === 'invoice' && params.data.length > 0 ? `
      <div class="invoice-total">
        Total: $${params.data.reduce((sum: number, row: any) => sum + (row.amount || 0), 0).toLocaleString()}
      </div>
    ` : ''}

    ${content.attachmentNote ? `<p><em>${content.attachmentNote}</em></p>` : ''}

    <p>${content.closing}</p>
    <p><strong>${content.signature}</strong></p>
  </div>

  <div class="footer">
    <p>This email was generated by Excel Pilot</p>
    <p>&copy; ${new Date().getFullYear()} Excel Pilot. All rights reserved.</p>
  </div>
</body>
</html>`;

  return html;
}

/**
 * Send email with optional data
 */
export async function sendEmail(params: EmailSendParams): Promise<ToolExecutionResult> {
  try {
    // Prepare the email content
    const emailHtml = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="white-space: pre-wrap;">${params.message}</div>
        ${params.data && params.data.length > 0 ? `
          <table style="width: 100%; border-collapse: collapse; margin-top: 20px;">
            <thead>
              <tr style="background-color: #f5f5f5;">
                ${Object.keys(params.data[0]).map(key => 
                  `<th style="padding: 10px; text-align: left; border: 1px solid #ddd;">${key}</th>`
                ).join('')}
              </tr>
            </thead>
            <tbody>
              ${params.data.map(row => `
                <tr>
                  ${Object.values(row).map(value => 
                    `<td style="padding: 10px; border: 1px solid #ddd;">${value ?? ''}</td>`
                  ).join('')}
                </tr>
              `).join('')}
            </tbody>
          </table>
        ` : ''}
      </div>
    `;

    // Send via API - use absolute URL for server-side fetch
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';
    const response = await fetch(`${baseUrl}/api/email/send`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        to: params.to,
        subject: params.subject,
        text: params.message,
        html: emailHtml,
        config: params.mailgunConfig
      })
    });

    const result = await response.json();
    
    if (response.ok && result.success) {
      return {
        success: true,
        type: 'email',
        content: `Email sent successfully to ${Array.isArray(params.to) ? params.to.join(', ') : params.to}`
      };
    } else {
      return {
        success: false,
        type: 'email',
        error: result.error || 'Failed to send email'
      };
    }
  } catch (error) {
    console.error('Email sending error:', error);
    return {
      success: false,
      type: 'email',
      error: error instanceof Error ? error.message : 'Failed to send email'
    };
  }
}

/**
 * Generate invoice using LLM
 */
export async function generateInvoice(data: any[], context: string): Promise<ToolExecutionResult> {
  const invoiceData = await generateInvoiceContent(data, context);
  return await createInvoicePDF(invoiceData);
}

/**
 * Generate invoice content using LLM
 */
async function generateInvoiceContent(data: any[], context: string): Promise<any> {
  if (!anthropic) {
    return {
      invoiceNumber: `INV-${Date.now()}`,
      date: new Date().toLocaleDateString(),
      dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toLocaleDateString(),
      items: data,
      subtotal: 0,
      tax: 0,
      total: 0
    };
  }

  const prompt = `Generate a professional invoice based on this data:
Context: ${context}
Data: ${JSON.stringify(data.slice(0, 10), null, 2)}

Return JSON with invoice details including:
- Invoice number
- Dates
- Line items with descriptions
- Calculations (subtotal, tax, total)
- Payment terms`;

  try {
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1500,
      temperature: 0,
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
        return JSON.parse(content.text);
      } catch {
        // Extract JSON if wrapped in text
        const jsonMatch = content.text.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          return JSON.parse(jsonMatch[0]);
        }
      }
    }
  } catch (error) {
    console.error('Invoice generation error:', error);
  }

  // Fallback
  return {
    invoiceNumber: `INV-${Date.now()}`,
    date: new Date().toLocaleDateString(),
    dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toLocaleDateString(),
    items: data,
    subtotal: data.reduce((sum: number, item: any) => sum + (item.amount || 0), 0),
    tax: 0,
    total: data.reduce((sum: number, item: any) => sum + (item.amount || 0), 0)
  };
}

/**
 * Create invoice PDF
 */
async function createInvoicePDF(invoiceData: any): Promise<ToolExecutionResult> {
  const doc = new jsPDF();
  
  // Header
  doc.setFontSize(24);
  doc.text('INVOICE', 105, 30, { align: 'center' });
  
  // Invoice details
  doc.setFontSize(10);
  doc.text(`Invoice #: ${invoiceData.invoiceNumber}`, 20, 50);
  doc.text(`Date: ${invoiceData.date}`, 20, 57);
  doc.text(`Due Date: ${invoiceData.dueDate}`, 20, 64);
  
  // Items table
  if (invoiceData.items && invoiceData.items.length > 0) {
    const headers = Object.keys(invoiceData.items[0]);
    const rows = invoiceData.items.map((item: any) => 
      headers.map(h => item[h] ?? '')
    );

    autoTable(doc, {
      head: [headers],
      body: rows,
      startY: 80,
      styles: { fontSize: 9 },
      headStyles: { fillColor: [102, 126, 234] }
    });
  }

  // Totals
  const finalY = (doc as any).lastAutoTable?.finalY || 150;
  doc.setFontSize(12);
  doc.text(`Subtotal: $${invoiceData.subtotal?.toLocaleString() || '0'}`, 140, finalY + 20);
  doc.text(`Tax: $${invoiceData.tax?.toLocaleString() || '0'}`, 140, finalY + 28);
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text(`Total: $${invoiceData.total?.toLocaleString() || '0'}`, 140, finalY + 38);

  const pdfData = doc.output('blob');
  
  return {
    success: true,
    type: 'invoice',
    file: {
      data: pdfData,
      filename: `invoice_${invoiceData.invoiceNumber}.pdf`,
      mimetype: 'application/pdf'
    }
  };
}

/**
 * Purchase a product using Crossmint API
 */
export async function purchaseProduct(params: PurchaseProductParams): Promise<ToolExecutionResult> {
  try {

    console.log('Purchase Product Params', params);
    
    // Use static values for physical address
    const physicalAddress = {
      name: 'Customer',
      line1: '123 ABC Street',
      city: 'New York City',
      state: 'NY',
      postalCode: '10007',
      country: 'US'
    };

    // Use provided email or default to russell@vancuren.net
    const recipientEmail = params.recipientEmail || 'russell@vancuren.net';

    // Prepare the Crossmint API request
    const apiKey = process.env.CROSSMINT_API_KEY || 'sk_staging_28sy4L4GCMS4XTSnVqhgbBwdza3C32QSftqfhs5bCVsBgA6pMWMM2zawPEi9GKdgra6BcKpWL3e9PudfssxpCjqbEm4B7e91JXypwrAiWPEQhMZNZZLXiyxbdF91uzkzwtmhVpz5L7jn6fRYHrfbvb6dmS1gnLyX3M8cmHmMKv5zYCadXtsnEfCYptEPGAyrWUcHvnZqnw2TzDnM5rMx6dd';
    const apiUrl = process.env.CROSSMINT_ENV === 'production' 
      ? 'https://www.crossmint.com/api/2022-06-09/orders'
      : 'https://staging.crossmint.com/api/2022-06-09/orders';

    const requestBody = {
      recipient: {
        email: recipientEmail,
        physicalAddress: physicalAddress
      },
      locale: 'en-US',
      payment: {
        receiptEmail: recipientEmail,
        method: 'stripe-payment-element',
        currency: 'usd'
      },
      lineItems: {
        productLocator: `amazon:${params.productUrl}`
      }
    };

    // Make the API request to Crossmint
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'X-API-KEY': apiKey,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(requestBody)
    });

    const result = await response.json();

    console.log('Purchase Product Result', result);

    if (response.ok && result.order) {
      // Extract payment link from Stripe client secret if available
      const paymentInfo = result.order.payment?.preparation?.stripeClientSecret 
        ? `\nPayment Link: Complete payment at checkout`
        : '';
      
      return {
        success: true,
        type: 'export',
        content: `✅ Product order created successfully!
Order ID: ${result.order.orderId}
Product URL: ${params.productUrl}
Recipient: ${recipientEmail}
Total Price: $${result.order.quote?.totalPrice?.amount || 'N/A'}
Status: ${result.order.payment?.status || 'awaiting-payment'}${paymentInfo}`,
        file: {
          data: JSON.stringify(result, null, 2),
          filename: `order_${result.order.orderId}.json`,
          mimetype: 'application/json'
        }
      };
    } else {
      return {
        success: false,
        type: 'export',
        error: result.message || result.error || 'Failed to create product order'
      };
    }
  } catch (error) {
    console.error('Product purchase error:', error);
    return {
      success: false,
      type: 'export',
      error: error instanceof Error ? error.message : 'Failed to purchase product'
    };
  }
}