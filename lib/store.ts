import { create } from 'zustand';
import { AppState, DatasetInfo, TablePreview, ChatMessage, AuditEvent } from '@/types';

interface AppStore extends AppState {
  // Dataset actions
  addDataset: (dataset: DatasetInfo) => void;
  setCurrentDataset: (id: string) => void;
  
  // Table actions
  setTable: (tableName: string, table: TablePreview) => void;
  
  // Chat actions
  addMessage: (message: ChatMessage) => void;
  updateMessage: (id: string, updates: Partial<ChatMessage>) => void;
  clearChat: () => void;
  
  // Audit actions
  addAuditEvent: (event: AuditEvent) => void;
  
  // UI state
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
}

export const useAppStore = create<AppStore>((set, get) => ({
  // Initial state
  datasets: [],
  currentDatasetId: null,
  tables: {},
  chatMessages: [],
  auditEvents: [],
  isLoading: false,
  error: null,

  // Actions
  addDataset: (dataset) =>
    set((state) => ({
      datasets: [...state.datasets, dataset],
      currentDatasetId: dataset.id,
    })),

  setCurrentDataset: (id) => set({ currentDatasetId: id }),

  setTable: (tableName, table) =>
    set((state) => ({
      tables: { ...state.tables, [tableName]: table },
    })),

  addMessage: (message) =>
    set((state) => ({
      chatMessages: [...state.chatMessages, message],
    })),

  updateMessage: (id, updates) =>
    set((state) => ({
      chatMessages: state.chatMessages.map((msg) =>
        msg.id === id ? { ...msg, ...updates } : msg
      ),
    })),

  clearChat: () => set({ chatMessages: [] }),

  addAuditEvent: (event) =>
    set((state) => ({
      auditEvents: [...state.auditEvents, event],
    })),

  setLoading: (loading) => set({ isLoading: loading }),
  setError: (error) => set({ error }),
}));