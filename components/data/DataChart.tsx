'use client';

import { useState } from 'react';
import { BarChart, Bar, LineChart, Line, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { TablePreview, ChartSpec } from '@/types';

interface DataChartProps {
  table: TablePreview;
}

const COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#06B6D4'];

export function DataChart({ table }: DataChartProps) {
  const [chartConfig, setChartConfig] = useState<ChartSpec>({
    type: 'bar',
    x: table.schema[0]?.name || '',
    y: table.schema.find(col => col.type === 'currency' || col.type === 'number')?.name || '',
  });

  const numericColumns = table.schema.filter(col => 
    col.type === 'currency' || col.type === 'number'
  );
  
  const categoricalColumns = table.schema.filter(col => 
    col.type === 'string' || col.type === 'date'
  );

  // Prepare chart data
  const chartData = table.rows.map(row => ({
    ...row,
    [chartConfig.y]: typeof row[chartConfig.y] === 'number' ? row[chartConfig.y] : 0,
  }));

  const renderChart = () => {
    switch (chartConfig.type) {
      case 'bar':
        return (
          <BarChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
            <XAxis 
              dataKey={chartConfig.x} 
              className="text-sm"
              tick={{ fontSize: 12 }}
            />
            <YAxis 
              className="text-sm"
              tick={{ fontSize: 12 }}
              tickFormatter={(value) => 
                numericColumns.find(col => col.name === chartConfig.y)?.type === 'currency'
                  ? `$${(value / 1000).toFixed(0)}k`
                  : value.toLocaleString()
              }
            />
            <Tooltip 
              formatter={(value: any) => [
                numericColumns.find(col => col.name === chartConfig.y)?.type === 'currency'
                  ? new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(value)
                  : value.toLocaleString(),
                chartConfig.y
              ]}
            />
            <Legend />
            <Bar dataKey={chartConfig.y} fill={COLORS[0]} radius={[4, 4, 0, 0]} />
          </BarChart>
        );
      
      case 'line':
        return (
          <LineChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
            <XAxis dataKey={chartConfig.x} />
            <YAxis />
            <Tooltip />
            <Legend />
            <Line 
              type="monotone" 
              dataKey={chartConfig.y} 
              stroke={COLORS[0]} 
              strokeWidth={3}
              dot={{ fill: COLORS[0], strokeWidth: 2, r: 4 }}
              activeDot={{ r: 6 }}
            />
          </LineChart>
        );
      
      case 'pie':
        return (
          <PieChart>
            <Pie
              data={chartData}
              cx="50%"
              cy="50%"
              labelLine={false}
              label={({ name, value }) => `${name}: ${value}`}
              outerRadius={100}
              fill="#8884d8"
              dataKey={chartConfig.y}
              nameKey={chartConfig.x}
            >
              {chartData.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
              ))}
            </Pie>
            <Tooltip />
          </PieChart>
        );
      
      default:
        return null;
    }
  };

  return (
    <Card className="h-full flex flex-col">
      <CardHeader className="pb-4">
        <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            Data Visualization
            <Badge variant="outline">{table.name}</Badge>
          </CardTitle>
          
          <div className="flex gap-2 flex-wrap">
            <Select value={chartConfig.type} onValueChange={(value: any) => 
              setChartConfig(prev => ({ ...prev, type: value }))
            }>
              <SelectTrigger className="w-24">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="bar">Bar</SelectItem>
                <SelectItem value="line">Line</SelectItem>
                <SelectItem value="pie">Pie</SelectItem>
              </SelectContent>
            </Select>

            <Select value={chartConfig.x} onValueChange={(value) =>
              setChartConfig(prev => ({ ...prev, x: value }))
            }>
              <SelectTrigger className="w-32">
                <SelectValue placeholder="X-Axis" />
              </SelectTrigger>
              <SelectContent>
                {categoricalColumns.map((col) => (
                  <SelectItem key={col.name} value={col.name}>
                    {col.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={chartConfig.y} onValueChange={(value) =>
              setChartConfig(prev => ({ ...prev, y: value }))
            }>
              <SelectTrigger className="w-32">
                <SelectValue placeholder="Y-Axis" />
              </SelectTrigger>
              <SelectContent>
                {numericColumns.map((col) => (
                  <SelectItem key={col.name} value={col.name}>
                    {col.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </CardHeader>
      
      <CardContent className="flex-1 min-h-0">
        <div className="h-full">
          <ResponsiveContainer width="100%" height="100%">
            {renderChart() || <div />}
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}