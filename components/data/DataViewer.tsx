'use client';

import { useState, useEffect } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Search, BarChart3, Table as TableIcon, TrendingUp, FileWarning } from 'lucide-react';
import { DataTable } from './DataTable';
import { DataChart } from './DataChart';
import { QuickStats } from './QuickStats';
import { useAppStore } from '@/lib/store';
import { api } from '@/lib/api';
import { getTablePreview } from '@/lib/clientDatabase';
import { Skeleton } from '@/components/ui/skeleton';

export function DataViewer() {
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState('table');
  
  const { 
    currentDatasetId, 
    tables, 
    setTable, 
    isLoading,
    setLoading 
  } = useAppStore();

  useEffect(() => {
    if (currentDatasetId) {
      loadTables();
    }
  }, [currentDatasetId]);

  const loadTables = async () => {
    if (!currentDatasetId) return;
    setLoading(true);
    try {
      const storedTables = localStorage.getItem(`dataset_${currentDatasetId}_tables`);
      if (storedTables) {
        const tableInfo = JSON.parse(storedTables);
        for (const info of tableInfo) {
          try {
            const tablePreview = await getTablePreview(info.name);
            setTable(info.name, tablePreview);
          } catch (error) {
            console.error(`Failed to load table ${info.name}:`, error);
          }
        }
      } else {
        const { tables: tableList } = await api.getTables(currentDatasetId);
        tableList.forEach(table => {
          setTable(table.name, table);
        });
      }
    } catch (error) {
      console.error('Failed to load tables:', error);
    }
    setLoading(false);
  };

  const tableNames = Object.keys(tables);
  const currentTable = tableNames[0] ? tables[tableNames[0]] : null;

  if (isLoading) {
    return <DataViewerSkeleton />;
  }

  if (!currentDatasetId || !currentTable) {
    return (
      <div className="h-full flex items-center justify-center bg-background/50 rounded-lg border-2 border-dashed border-border/60">
        <div className="text-center space-y-4 p-8">
          <FileWarning className="h-16 w-16 text-muted-foreground mx-auto" />
          <div>
            <h3 className="text-xl font-semibold">No Data Loaded</h3>
            <p className="text-muted-foreground mt-2 max-w-sm mx-auto">Upload a CSV or XLSX file to begin your analysis. Your data will appear here.</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col space-y-4">
      <header className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-foreground">{tableNames[0] || 'Data Analysis'}</h1>
          <p className="text-muted-foreground">Explore and analyze your dataset</p>
        </div>
        <div className="relative w-full sm:w-72">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search table data..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9 bg-background/60 border-border/60 focus:bg-background transition-colors"
          />
        </div>
      </header>

      <QuickStats table={currentTable} />

      <div className="flex-1 min-h-0">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="h-full flex flex-col">
          <TabsList className="bg-muted/50 p-1 rounded-lg self-start">
            <TabsTrigger value="table" className="flex items-center gap-2">
              <TableIcon className="h-4 w-4" />
              Table
            </TabsTrigger>
            <TabsTrigger value="chart" className="flex items-center gap-2">
              <BarChart3 className="h-4 w-4" />
              Charts
            </TabsTrigger>
          </TabsList>

          <div className="flex-1 min-h-0 mt-4">
            <TabsContent value="table" className="h-full mt-0">
              <DataTable table={currentTable} searchTerm={searchTerm} />
            </TabsContent>

            <TabsContent value="chart" className="h-full mt-0">
              <DataChart table={currentTable} />
            </TabsContent>
            
          </div>
        </Tabs>
      </div>
    </div>
  );
}

const DataViewerSkeleton = () => (
  <div className="space-y-4">
    <div className="flex justify-between items-center">
      <Skeleton className="h-10 w-1/3" />
      <Skeleton className="h-10 w-1/4" />
    </div>
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      <Skeleton className="h-24" />
      <Skeleton className="h-24" />
      <Skeleton className="h-24" />
      <Skeleton className="h-24" />
    </div>
    <Skeleton className="h-10 w-1/4 mb-4" />
    <Card className="h-[400px]">
      <CardContent className="p-6">
        <Skeleton className="h-full" />
      </CardContent>
    </Card>
  </div>
);