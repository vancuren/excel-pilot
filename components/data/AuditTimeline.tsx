'use client';

import { useState } from 'react';
import { ChevronDown, ChevronUp, FileText, Mail, Upload, Download, Receipt } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { useAppStore } from '@/lib/store';
import { format } from 'date-fns';

export function AuditTimeline() {
  const [isOpen, setIsOpen] = useState(false);
  const { auditEvents } = useAppStore();

  const getEventIcon = (category: string) => {
    switch (category) {
      case 'upload': return <Upload className="h-4 w-4" />;
      case 'export': return <Download className="h-4 w-4" />;
      case 'action': return <Receipt className="h-4 w-4" />;
      default: return <FileText className="h-4 w-4" />;
    }
  };

  const getEventColor = (category: string) => {
    switch (category) {
      case 'upload': return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200';
      case 'export': return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
      case 'action': return 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200';
      default: return 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200';
    }
  };

  if (auditEvents.length === 0) {
    return null;
  }

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <Card>
        <CollapsibleTrigger asChild>
          <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <CardTitle className="text-lg">Audit Timeline</CardTitle>
                <Badge variant="secondary">{auditEvents.length} events</Badge>
              </div>
              {isOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </div>
          </CardHeader>
        </CollapsibleTrigger>
        
        <CollapsibleContent>
          <CardContent className="pt-0">
            <div className="space-y-4 max-h-64 overflow-y-auto">
              {auditEvents.map((event, index) => (
                <div key={event.id} className="flex gap-4 p-3 rounded-lg border bg-card">
                  <div className={`p-2 rounded-lg ${getEventColor(event.category)}`}>
                    {getEventIcon(event.category)}
                  </div>
                  
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="font-medium text-sm">{event.summary}</p>
                        {event.detail && (
                          <p className="text-xs text-muted-foreground mt-1">{event.detail}</p>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground whitespace-nowrap">
                        {format(new Date(event.at), 'MMM dd, HH:mm')}
                      </p>
                    </div>
                    
                    {event.artifacts && event.artifacts.length > 0 && (
                      <div className="flex gap-2 mt-2 flex-wrap">
                        {event.artifacts.map((artifact, idx) => (
                          <Button
                            key={idx}
                            variant="outline"
                            size="sm"
                            className="h-7 text-xs"
                            onClick={() => window.open(artifact.url, '_blank')}
                          >
                            {artifact.kind === 'pdf' ? <FileText className="h-3 w-3 mr-1" /> : 
                             artifact.kind === 'csv' ? <Download className="h-3 w-3 mr-1" /> : null}
                            {artifact.name}
                          </Button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
}