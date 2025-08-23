export type TableName = string;

export interface DatasetSummary {
  tables: Array<{ name: string; rows: number; columns: number }>;
  inferredJoins?: Array<{ left: string; right: string; on: string[] }>;
}

export interface ColumnSchema {
  name: string;
  type: 'string' | 'number' | 'date' | 'boolean' | 'currency';
  nullable?: boolean;
}

export interface TablePreview {
  name: TableName;
  schema: ColumnSchema[];
  rows: Array<Record<string, any>>;
  stats?: Record<string, any>;
}

export interface ChartSpec {
  type: 'bar' | 'line' | 'pie';
  x: string;
  y: string;
  series?: string;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  toolSuggestions?: Array<ActionSuggestion>;
  artifacts?: Array<Artifact>;
  timestamp: string;
}

export interface ActionSuggestion {
  id: string;
  label: string;
  paramsSchema?: Record<string, any>;
  category: 'invoice' | 'voucher' | 'approval' | 'export' | 'analysis';
}

export type Artifact =
  | { kind: 'pdf'; name: string; url: string; size?: number }
  | { kind: 'csv'; name: string; url: string; size?: number }
  | { kind: 'json'; name: string; url: string; size?: number };

export interface AuditEvent {
  id: string;
  at: string;
  summary: string;
  detail?: string;
  artifacts?: Artifact[];
  category: 'upload' | 'query' | 'action' | 'export';
}

export interface DatasetInfo {
  id: string;
  name: string;
  uploadedAt: string;
  summary: DatasetSummary;
}

export interface AppState {
  datasets: DatasetInfo[];
  currentDatasetId: string | null;
  tables: Record<string, TablePreview>;
  chatMessages: ChatMessage[];
  auditEvents: AuditEvent[];
  isLoading: boolean;
  error: string | null;
}