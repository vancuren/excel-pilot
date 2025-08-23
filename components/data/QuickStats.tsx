'use client';

import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { TrendingUp, TrendingDown, Calculator, Calendar } from 'lucide-react';
import { TablePreview } from '@/types';

interface QuickStatsProps {
  table: TablePreview;
}

export function QuickStats({ table }: QuickStatsProps) {
  const stats = table.stats || {};
  const numericColumns = table.schema.filter(col => 
    col.type === 'currency' || col.type === 'number'
  );

  const formatStatValue = (value: number, type: string) => {
    if (type === 'currency') {
      return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
        notation: value >= 1000000 ? 'compact' : 'standard',
      }).format(value);
    }
    return value.toLocaleString();
  };

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-4">
      <Card className="border-border/50 shadow-sm hover:shadow-md transition-shadow duration-200">
        <CardContent className="p-5">
          <div className="flex items-center gap-2">
            <Calculator className="h-4 w-4 text-primary" />
            <div>
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Total Rows</p>
              <p className="text-xl font-semibold text-foreground">{table.rows.length.toLocaleString()}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="border-border/50 shadow-sm hover:shadow-md transition-shadow duration-200">
        <CardContent className="p-5">
          <div className="flex items-center gap-2">
            <Calendar className="h-4 w-4 text-green-500" />
            <div>
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Columns</p>
              <p className="text-xl font-semibold text-foreground">{table.schema.length}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {numericColumns.slice(0, 4).map((column) => {
        const columnStats = stats[column.name];
        if (!columnStats) return null;

        return (
          <Card key={column.name} className="border-border/50 shadow-sm hover:shadow-md transition-shadow duration-200">
            <CardContent className="p-5">
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <TrendingUp className="h-4 w-4 text-purple-500" />
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide truncate">{column.name}</p>
                </div>
                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">Sum:</span>
                    <span className="font-mono text-sm font-medium">
                      {formatStatValue(columnStats.sum || 0, column.type)}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">Avg:</span>
                    <span className="font-mono text-sm font-medium">
                      {formatStatValue(columnStats.avg || 0, column.type)}
                    </span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}