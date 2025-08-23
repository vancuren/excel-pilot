'use client';

import { useState, useEffect } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Search, BarChart3, Table as TableIcon, TrendingUp } from 'lucide-react';
import { DataTable } from './DataTable';
import { DataChart } from './DataChart';
import { QuickStats } from './QuickStats';
import { AuditTimeline } from './AuditTimeline';
import { useAppStore } from '@/lib/store';
import { api } from '@/lib/api';

export function DataViewer() {
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState('table');
  const [resultTabs, setResultTabs] = useState<string[]>([]);
  
  const { 
    currentDatasetId, 
    tables, 
    setTable, 
    chatMessages,
    setLoading 
  } = useAppStore();

  // Load tables when dataset changes
  useEffect(() => {
    if (currentDatasetId) {
      loadTables();
    }
  }, [currentDatasetId]);

  // Track result tabs from chat messages
  useEffect(() => {
    const newResultTabs = chatMessages
      .filter(msg => msg.role === 'assistant' && msg.artifacts?.length)
      .map(msg => `result_${msg.id}`);
    setResultTabs(newResultTabs);
  }, [chatMessages]);

  const loadTables = async () => {
    if (!currentDatasetId) return;
    
    setLoading(true);
    try {
      const { tables: tableList } = await api.getTables(currentDatasetId);
      tableList.forEach(table => {
        setTable(table.name, table);
      });
    } catch (error) {
      console.error('Failed to load tables:', error);
    }
    setLoading(false);
  };

  const tableNames = Object.keys(tables);
  const currentTable = tableNames[0] ? tables[tableNames[0]] : null;

  if (!currentDatasetId) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-center space-y-4">
          <TableIcon className="h-16 w-16 text-muted-foreground mx-auto" />
          <div>
            <h3 className="text-lg font-medium">No data loaded</h3>
            <p className="text-muted-foreground">Upload a CSV or XLSX file to begin analysis</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col space-y-4">
      {/* Controls */}
      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
        <div className="flex items-center gap-2 flex-wrap">
          {tableNames.map((tableName) => (
            <Badge key={tableName} variant="secondary" className="cursor-pointer">
              {tableName}
              <span className="ml-1 text-xs opacity-60">
                ({tables[tableName].rows.length})
              </span>
            </Badge>
          ))}
        </div>
        
        <div className="relative w-full sm:w-64">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search data..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9"
          />
        </div>
      </div>

      {/* Quick Stats */}
      {currentTable && (
        <QuickStats table={currentTable} />
      )}

      {/* Main Content */}
      <div className="flex-1 min-h-0">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="h-full flex flex-col">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="table" className="flex items-center gap-2">
              <TableIcon className="h-4 w-4" />
              Table
            </TabsTrigger>
            <TabsTrigger value="chart" className="flex items-center gap-2">
              <BarChart3 className="h-4 w-4" />
              Charts
            </TabsTrigger>
            <TabsTrigger value="results" className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4" />
              Results
              {resultTabs.length > 0 && (
                <Badge variant="secondary" className="ml-1 text-xs">
                  {resultTabs.length}
                </Badge>
              )}
            </TabsTrigger>
          </TabsList>

          <div className="flex-1 min-h-0">
            <TabsContent value="table" className="h-full">
              {currentTable ? (
                <DataTable table={currentTable} searchTerm={searchTerm} />
              ) : (
                <div className="h-full flex items-center justify-center">
                  <p className="text-muted-foreground">No table data available</p>
                </div>
              )}
            </TabsContent>

            <TabsContent value="chart" className="h-full">
              {currentTable ? (
                <DataChart table={currentTable} />
              ) : (
                <div className="h-full flex items-center justify-center">
                  <p className="text-muted-foreground">No chart data available</p>
                </div>
              )}
            </TabsContent>

            <TabsContent value="results" className="h-full">
              <div className="h-full space-y-4">
                {resultTabs.length === 0 ? (
                  <div className="h-full flex items-center justify-center">
                    <div className="text-center space-y-2">
                      <TrendingUp className="h-12 w-12 text-muted-foreground mx-auto" />
                      <p className="text-muted-foreground">No analysis results yet</p>
                      <p className="text-sm text-muted-foreground">Ask questions in the chat to generate insights</p>
                    </div>
                  </div>
                ) : (
                  <Card className="h-full">
                    <CardHeader>
                      <CardTitle>Analysis Results</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-muted-foreground">Recent analysis results will appear here</p>
                    </CardContent>
                  </Card>
                )}
              </div>
            </TabsContent>
          </div>
        </Tabs>
      </div>

      {/* Audit Timeline */}
      <AuditTimeline />
    </div>
  );
}