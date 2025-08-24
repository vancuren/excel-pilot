'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { TrendingUp, TrendingDown, Calculator, Calendar, ArrowRight } from 'lucide-react';
import { TablePreview } from '@/types';
import { Button } from '@/components/ui/button';

interface QuickStatsProps {
  table: TablePreview;
}

const StatCard = ({ icon: Icon, title, value, trend, trendLabel }) => (
  <Card className="border-border/50 shadow-sm hover:shadow-lg transition-all duration-300 ease-in-out transform hover:-translate-y-1 bg-background/50 backdrop-blur-sm">
    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
      <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
      <Icon className="h-5 w-5 text-muted-foreground" />
    </CardHeader>
    <CardContent>
      <div className="text-2xl font-bold text-foreground">{value}</div>
      {trend && (
        <p className="text-xs text-muted-foreground flex items-center">
          <span className={`flex items-center mr-1 ${trend > 0 ? 'text-green-500' : 'text-red-500'}`}>
            {trend > 0 ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />}
          </span>
          {trend > 0 ? `+${trend}%` : `${trend}%`} {trendLabel}
        </p>
      )}
    </CardContent>
  </Card>
);


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
        notation: 'compact',
        maximumFractionDigits: 1,
      }).format(value);
    }
    return new Intl.NumberFormat('en-US', {
      notation: 'compact',
      maximumFractionDigits: 1,
    }).format(value);
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard 
          icon={Calculator}
          title="Total Rows"
          value={table.rows.length.toLocaleString()}
        />
        <StatCard 
          icon={Calendar}
          title="Total Columns"
          value={table.schema.length.toLocaleString()}
        />
        
        {numericColumns.slice(0, 2).map((column) => {
          const columnStats = stats[column.name];
          if (!columnStats) return null;

          return (
            <StatCard
              key={column.name}
              icon={TrendingUp}
              title={`Total ${column.name}`}
              value={formatStatValue(columnStats.sum || 0, column.type)}
            />
          );
        })}
      </div>
    </div>
  );
}