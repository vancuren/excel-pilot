'use client';

import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, FileText, Send, DollarSign, Clock, CheckCircle, AlertCircle, TrendingUp } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface InvoiceAgentPanelProps {
  datasetId?: string;
  onAgentAction?: (action: string, data: any) => void;
}

export function InvoiceAgentPanel({ datasetId, onAgentAction }: InvoiceAgentPanelProps) {
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('generate');
  const [agentMetrics, setAgentMetrics] = useState<any>(null);
  const { toast } = useToast();

  // Form states
  const [invoiceForm, setInvoiceForm] = useState({
    customerName: '',
    customerEmail: '',
    items: [{ description: '', quantity: 1, unitPrice: 0 }],
    template: 'standard'
  });

  const [bulkForm, setBulkForm] = useState({
    customers: '',
    dateRange: { start: '', end: '' },
    autoSend: false
  });

  const callAgent = async (action: string, data: any) => {
    setLoading(true);
    try {
      const response = await fetch('/api/agents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action,
          data,
          datasetId,
          userId: 'user_default',
          organizationId: 'org_default'
        })
      });

      if (!response.ok) {
        throw new Error('Agent request failed');
      }

      const result = await response.json();
      
      toast({
        title: 'Agent Task Completed',
        description: result.summary || `${action} completed successfully`,
      });

      if (onAgentAction) {
        onAgentAction(action, result);
      }

      return result;
    } catch (error) {
      toast({
        title: 'Agent Error',
        description: error instanceof Error ? error.message : 'Failed to execute agent task',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  const handleGenerateInvoice = async () => {
    const data = {
      customerInfo: {
        name: invoiceForm.customerName,
        email: invoiceForm.customerEmail
      },
      items: invoiceForm.items.filter(item => item.description),
      metadata: {
        template: invoiceForm.template
      }
    };

    await callAgent('generate_invoice', data);
  };

  const handleBulkGenerate = async () => {
    const customerList = bulkForm.customers.split(',').map(c => c.trim()).filter(Boolean);
    
    const data = {
      customers: customerList,
      template: 'standard',
      dateRange: bulkForm.dateRange,
      autoSend: bulkForm.autoSend
    };

    await callAgent('bulk_generate', data);
  };

  const handleFollowUp = async (daysOverdue: number) => {
    await callAgent('follow_up_overdue', {
      daysOverdue,
      reminderTemplate: daysOverdue > 30 ? 'urgent_reminder' : 'friendly_reminder'
    });
  };

  const handleTrackPayments = async () => {
    await callAgent('track_payments', {
      invoiceIds: [] // Will track all recent invoices
    });
  };

  const fetchMetrics = async () => {
    const result = await callAgent('get_metrics', {});
    setAgentMetrics(result?.metrics);
  };

  const addInvoiceItem = () => {
    setInvoiceForm({
      ...invoiceForm,
      items: [...invoiceForm.items, { description: '', quantity: 1, unitPrice: 0 }]
    });
  };

  const updateInvoiceItem = (index: number, field: string, value: any) => {
    const newItems = [...invoiceForm.items];
    newItems[index] = { ...newItems[index], [field]: value };
    setInvoiceForm({ ...invoiceForm, items: newItems });
  };

  return (
    <Card className="h-full">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Invoice Agent
            </CardTitle>
            <CardDescription>
              Autonomous invoice generation and management
            </CardDescription>
          </div>
          {agentMetrics && (
            <div className="flex gap-2">
              <Badge variant="outline">
                <CheckCircle className="h-3 w-3 mr-1" />
                {agentMetrics.performance?.successRate?.toFixed(0)}% Success
              </Badge>
              <Badge variant="outline">
                <Clock className="h-3 w-3 mr-1" />
                {agentMetrics.performance?.averageExecutionTime?.toFixed(0)}ms Avg
              </Badge>
            </div>
          )}
        </div>
      </CardHeader>
      <CardContent>
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="generate">Generate</TabsTrigger>
            <TabsTrigger value="bulk">Bulk</TabsTrigger>
            <TabsTrigger value="track">Track</TabsTrigger>
            <TabsTrigger value="followup">Follow Up</TabsTrigger>
          </TabsList>

          <TabsContent value="generate" className="space-y-4">
            <div className="grid gap-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="customerName">Customer Name</Label>
                  <Input
                    id="customerName"
                    value={invoiceForm.customerName}
                    onChange={(e) => setInvoiceForm({ ...invoiceForm, customerName: e.target.value })}
                    placeholder="Acme Corporation"
                  />
                </div>
                <div>
                  <Label htmlFor="customerEmail">Customer Email</Label>
                  <Input
                    id="customerEmail"
                    type="email"
                    value={invoiceForm.customerEmail}
                    onChange={(e) => setInvoiceForm({ ...invoiceForm, customerEmail: e.target.value })}
                    placeholder="billing@acme.com"
                  />
                </div>
              </div>

              <div>
                <Label>Invoice Items</Label>
                {invoiceForm.items.map((item, index) => (
                  <div key={index} className="grid grid-cols-3 gap-2 mt-2">
                    <Input
                      placeholder="Description"
                      value={item.description}
                      onChange={(e) => updateInvoiceItem(index, 'description', e.target.value)}
                    />
                    <Input
                      type="number"
                      placeholder="Quantity"
                      value={item.quantity}
                      onChange={(e) => updateInvoiceItem(index, 'quantity', parseInt(e.target.value))}
                    />
                    <Input
                      type="number"
                      placeholder="Unit Price"
                      value={item.unitPrice}
                      onChange={(e) => updateInvoiceItem(index, 'unitPrice', parseFloat(e.target.value))}
                    />
                  </div>
                ))}
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={addInvoiceItem}
                  className="mt-2"
                >
                  Add Item
                </Button>
              </div>

              <div>
                <Label htmlFor="template">Template</Label>
                <Select 
                  value={invoiceForm.template}
                  onValueChange={(value) => setInvoiceForm({ ...invoiceForm, template: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="standard">Standard</SelectItem>
                    <SelectItem value="professional">Professional</SelectItem>
                    <SelectItem value="simple">Simple</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <Button 
                onClick={handleGenerateInvoice}
                disabled={loading || !invoiceForm.customerName || !invoiceForm.customerEmail}
                className="w-full"
              >
                {loading ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <FileText className="h-4 w-4 mr-2" />
                )}
                Generate Invoice
              </Button>
            </div>
          </TabsContent>

          <TabsContent value="bulk" className="space-y-4">
            <div className="grid gap-4">
              <div>
                <Label htmlFor="customers">Customer IDs (comma-separated)</Label>
                <Textarea
                  id="customers"
                  value={bulkForm.customers}
                  onChange={(e) => setBulkForm({ ...bulkForm, customers: e.target.value })}
                  placeholder="cust_001, cust_002, cust_003"
                  rows={3}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="startDate">Start Date</Label>
                  <Input
                    id="startDate"
                    type="date"
                    value={bulkForm.dateRange.start}
                    onChange={(e) => setBulkForm({ 
                      ...bulkForm, 
                      dateRange: { ...bulkForm.dateRange, start: e.target.value }
                    })}
                  />
                </div>
                <div>
                  <Label htmlFor="endDate">End Date</Label>
                  <Input
                    id="endDate"
                    type="date"
                    value={bulkForm.dateRange.end}
                    onChange={(e) => setBulkForm({ 
                      ...bulkForm, 
                      dateRange: { ...bulkForm.dateRange, end: e.target.value }
                    })}
                  />
                </div>
              </div>

              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  id="autoSend"
                  checked={bulkForm.autoSend}
                  onChange={(e) => setBulkForm({ ...bulkForm, autoSend: e.target.checked })}
                  className="h-4 w-4"
                />
                <Label htmlFor="autoSend">Automatically send invoices after generation</Label>
              </div>

              <Button 
                onClick={handleBulkGenerate}
                disabled={loading || !bulkForm.customers}
                className="w-full"
              >
                {loading ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Send className="h-4 w-4 mr-2" />
                )}
                Generate Bulk Invoices
              </Button>
            </div>
          </TabsContent>

          <TabsContent value="track" className="space-y-4">
            <Alert>
              <DollarSign className="h-4 w-4" />
              <AlertDescription>
                Track payment status for all recent invoices and sync with payment gateways.
              </AlertDescription>
            </Alert>

            <Button 
              onClick={handleTrackPayments}
              disabled={loading}
              className="w-full"
            >
              {loading ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <TrendingUp className="h-4 w-4 mr-2" />
              )}
              Track All Payments
            </Button>

            <div className="space-y-2">
              <Button 
                variant="outline"
                onClick={() => callAgent('reconcile', { 
                  dateRange: { 
                    start: new Date(Date.now() - 30 * 86400000).toISOString(),
                    end: new Date().toISOString()
                  }
                })}
                disabled={loading}
                className="w-full"
              >
                Reconcile Last 30 Days
              </Button>
            </div>
          </TabsContent>

          <TabsContent value="followup" className="space-y-4">
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                Automatically send payment reminders based on how overdue invoices are.
              </AlertDescription>
            </Alert>

            <div className="grid gap-2">
              <Button 
                variant="outline"
                onClick={() => handleFollowUp(7)}
                disabled={loading}
                className="justify-start"
              >
                <Clock className="h-4 w-4 mr-2 text-yellow-500" />
                Follow up on 7+ days overdue (Friendly)
              </Button>

              <Button 
                variant="outline"
                onClick={() => handleFollowUp(30)}
                disabled={loading}
                className="justify-start"
              >
                <Clock className="h-4 w-4 mr-2 text-orange-500" />
                Follow up on 30+ days overdue (Firm)
              </Button>

              <Button 
                variant="outline"
                onClick={() => handleFollowUp(60)}
                disabled={loading}
                className="justify-start"
              >
                <Clock className="h-4 w-4 mr-2 text-red-500" />
                Follow up on 60+ days overdue (Final Notice)
              </Button>
            </div>
          </TabsContent>
        </Tabs>

        {!agentMetrics && (
          <div className="mt-4 pt-4 border-t">
            <Button 
              variant="ghost" 
              size="sm"
              onClick={fetchMetrics}
              className="w-full"
            >
              Load Agent Metrics
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}