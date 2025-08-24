'use client';

import { useState, useMemo } from 'react';
import { ChevronUp, ChevronDown, ArrowUpDown } from 'lucide-react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { TablePreview } from '@/types';

interface DataTableProps {
  table: TablePreview;
  searchTerm: string;
}

type SortConfig = {
  key: string;
  direction: 'asc' | 'desc';
} | null;

export function DataTable({ table, searchTerm }: DataTableProps) {
  const [sortConfig, setSortConfig] = useState<SortConfig>(null);

  const filteredAndSortedRows = useMemo(() => {
    let filtered = table.rows;

    // Apply search filter
    if (searchTerm) {
      filtered = filtered.filter(row =>
        Object.values(row).some(value =>
          String(value).toLowerCase().includes(searchTerm.toLowerCase())
        )
      );
    }

    // Apply sorting
    if (sortConfig) {
      filtered = [...filtered].sort((a, b) => {
        const aVal = a[sortConfig.key];
        const bVal = b[sortConfig.key];
        
        if (aVal === bVal) return 0;
        
        const isAsc = sortConfig.direction === 'asc';
        if (typeof aVal === 'number' && typeof bVal === 'number') {
          return isAsc ? aVal - bVal : bVal - aVal;
        }
        
        const aStr = String(aVal).toLowerCase();
        const bStr = String(bVal).toLowerCase();
        return isAsc ? aStr.localeCompare(bStr) : bStr.localeCompare(aStr);
      });
    }

    return filtered;
  }, [table.rows, searchTerm, sortConfig]);

  const handleSort = (columnName: string) => {
    setSortConfig(current => {
      if (current?.key === columnName) {
        return current.direction === 'asc' 
          ? { key: columnName, direction: 'desc' }
          : null;
      }
      return { key: columnName, direction: 'asc' };
    });
  };

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'currency': return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
      case 'date': return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200';
      case 'number': return 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200';
      default: return 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200';
    }
  };

  const formatCellValue = (value: any, type: string) => {
    if (value === null || value === undefined) return '-';
    
    switch (type) {
      case 'currency':
        return new Intl.NumberFormat('en-US', {
          style: 'currency',
          currency: 'USD',
        }).format(Number(value));
      case 'date':
        return new Date(value).toLocaleDateString();
      case 'number':
        return typeof value === 'number' ? value.toLocaleString() : value;
      default:
        return String(value);
    }
  };

  const getSortIcon = (columnName: string) => {
    if (sortConfig?.key !== columnName) {
      return <ArrowUpDown className="h-4 w-4" />;
    }
    return sortConfig.direction === 'asc' 
      ? <ChevronUp className="h-4 w-4" />
      : <ChevronDown className="h-4 w-4" />;
  };

  return (
    <Card className="h-full flex flex-col border-border/50 shadow-sm">
      <CardContent className="flex-1 p-0 overflow-hidden">
        <div className="h-full overflow-auto">
          <Table className="relative">
            <TableHeader className="sticky top-0 z-10">
              <TableRow className="border-b border-border/60 bg-muted/50 backdrop-blur-sm hover:bg-muted/50">
                {table.schema.map((column) => (
                  <TableHead
                    key={column.name}
                    className="cursor-pointer hover:bg-muted/70 transition-colors duration-150 px-5 py-3 font-semibold"
                    onClick={() => handleSort(column.name)}
                  >
                    <div className="flex items-center gap-2">
                      <div className="flex flex-col gap-1">
                        <span className="font-semibold text-foreground">{column.name}</span>
                        <Badge variant="outline" className={`text-xs border-0 ${getTypeColor(column.type)}`}>
                          {column.type}
                        </Badge>
                      </div>
                      {getSortIcon(column.name)}
                    </div>
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredAndSortedRows.map((row, index) => (
                <TableRow key={index} className={`hover:bg-muted/40 transition-colors duration-150 ${index % 2 === 0 ? 'bg-background' : 'bg-muted/20'}`}>
                  {table.schema.map((column) => (
                    <TableCell key={column.name} className="font-mono text-[13px] px-5 py-3">
                      {formatCellValue(row[column.name], column.type)}
                    </TableCell>
                  ))}
                </TableRow>
              ))}
            </TableBody>
          </Table>
          
          {filteredAndSortedRows.length === 0 && (
            <div className="text-center py-12">
              <p className="text-muted-foreground">
                {searchTerm ? 'No matching records found' : 'No data available'}
              </p>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
