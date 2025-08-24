'use client';

import { useState, useMemo, useEffect } from 'react';
import { ChevronUp, ChevronDown, ArrowUpDown, MoreHorizontal } from 'lucide-react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { TablePreview } from '@/types';

interface DataTableProps {
  table: TablePreview;
  searchTerm: string;
}

type SortConfig = {
  key: string;
  direction: 'asc' | 'desc';
} | null;

const ROWS_PER_PAGE = 15;

export function DataTable({ table, searchTerm }: DataTableProps) {
  const [sortConfig, setSortConfig] = useState<SortConfig>(null);
  const [currentPage, setCurrentPage] = useState(1);

  const filteredRows = useMemo(() => {
    if (!searchTerm) return table.rows;
    return table.rows.filter(row =>
      Object.values(row).some(value =>
        String(value).toLowerCase().includes(searchTerm.toLowerCase())
      )
    );
  }, [table.rows, searchTerm]);

  const sortedRows = useMemo(() => {
    let sortableRows = [...filteredRows];
    if (sortConfig) {
      sortableRows.sort((a, b) => {
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
    return sortableRows;
  }, [filteredRows, sortConfig]);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, sortConfig]);

  const paginatedRows = useMemo(() => {
    const start = (currentPage - 1) * ROWS_PER_PAGE;
    const end = start + ROWS_PER_PAGE;
    return sortedRows.slice(start, end);
  }, [sortedRows, currentPage]);

  const totalPages = Math.ceil(sortedRows.length / ROWS_PER_PAGE);

  const handleSort = (columnName: string) => {
    setSortConfig(current => {
      if (current?.key === columnName && current.direction === 'asc') {
        return { key: columnName, direction: 'desc' };
      } else if (current?.key === columnName && current.direction === 'desc') {
        return null;
      } else {
        return { key: columnName, direction: 'asc' };
      }
    });
  };

  const getTypeBadge = (type: string) => {
    const baseClasses = 'text-xs font-semibold px-2 py-0.5 rounded-full border';
    switch (type) {
      case 'currency': return <Badge variant="outline" className={`${baseClasses} bg-green-100 text-green-800 border-green-200`}>{type}</Badge>;
      case 'date': return <Badge variant="outline" className={`${baseClasses} bg-blue-100 text-blue-800 border-blue-200`}>{type}</Badge>;
      case 'number': return <Badge variant="outline" className={`${baseClasses} bg-indigo-100 text-indigo-800 border-indigo-200`}>{type}</Badge>;
      default: return <Badge variant="outline" className={`${baseClasses} bg-gray-100 text-gray-700 border-gray-200`}>{type}</Badge>;
    }
  };

  const formatCellValue = (value: any, type: string) => {
    if (value === null || value === undefined) return <span className="text-muted-foreground">-</span>;
    switch (type) {
      case 'currency':
        return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(Number(value));
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
      return <ArrowUpDown className="h-4 w-4 text-muted-foreground/70" />;
    }
    return sortConfig.direction === 'asc' 
      ? <ChevronUp className="h-4 w-4 text-primary" />
      : <ChevronDown className="h-4 w-4 text-primary" />;
  };

  return (
    <Card className="h-full flex flex-col border-border/50 shadow-sm bg-background/50 backdrop-blur-sm">
      <CardHeader>
        <CardTitle className="text-lg">Data Table</CardTitle>
      </CardHeader>
      <CardContent className="flex-1 p-0 overflow-hidden">
        <div className="h-full overflow-auto">
          <Table>
            <TableHeader className="sticky top-0 z-10 bg-background/80 backdrop-blur-sm">
              <TableRow>
                {table.schema.map((column) => (
                  <TableHead key={column.name} className="cursor-pointer group" onClick={() => handleSort(column.name)}>
                    <div className="flex items-center justify-between p-2">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-foreground truncate">{column.name}</span>
                        {getTypeBadge(column.type)}
                      </div>
                      {getSortIcon(column.name)}
                    </div>
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {paginatedRows.map((row, index) => (
                <TableRow key={index} className="hover:bg-muted/40 transition-colors duration-150">
                  {table.schema.map((column) => (
                    <TableCell key={column.name} className="font-mono text-[13px] px-4 py-2 truncate max-w-xs">
                      {formatCellValue(row[column.name], column.type)}
                    </TableCell>
                  ))}
                </TableRow>
              ))}
            </TableBody>
          </Table>
          
          {paginatedRows.length === 0 && (
            <div className="text-center py-12">
              <p className="text-muted-foreground">
                {searchTerm ? 'No matching records found' : 'No data available'}
              </p>
            </div>
          )}
        </div>
      </CardContent>
      <div className="flex items-center justify-between p-4 border-t border-border/50">
        <span className="text-sm text-muted-foreground">
          Showing {Math.min(sortedRows.length, (currentPage - 1) * ROWS_PER_PAGE + 1)} - {Math.min(currentPage * ROWS_PER_PAGE, sortedRows.length)} of {sortedRows.length} rows
        </span>
        <div className="flex items-center gap-2">
          <Button 
            variant="outline" 
            size="sm" 
            onClick={() => setCurrentPage(p => Math.max(1, p - 1))} 
            disabled={currentPage === 1}
          >
            Previous
          </Button>
          <span className="text-sm">Page {currentPage} of {totalPages}</span>
          <Button 
            variant="outline" 
            size="sm" 
            onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} 
            disabled={currentPage === totalPages}
          >
            Next
          </Button>
        </div>
      </div>
    </Card>
  );
}

