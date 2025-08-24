'use client';

import React, { useState } from 'react';
import { Panel, PanelGroup, PanelResizeHandle } from 'react-resizable-panels';
import { DataViewer } from '@/components/data/DataViewer';
import { ChatPanel } from '@/components/chat/ChatPanel';
import { InvoiceAgentPanel } from '@/components/agents/InvoiceAgentPanel';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Bot, MessageSquare, Table } from 'lucide-react';

interface EnhancedSplitLayoutProps {
  datasetId: string;
}

export function EnhancedSplitLayout({ datasetId }: EnhancedSplitLayoutProps) {
  const [activeRightPanel, setActiveRightPanel] = useState('chat');

  return (
    <div className="h-full w-full">
      <PanelGroup direction="horizontal" className="h-full">
        {/* Left Panel - Data Viewer */}
        <Panel defaultSize={65} minSize={30}>
          <DataViewer datasetId={datasetId} />
        </Panel>
        
        <PanelResizeHandle className="w-1 bg-border hover:bg-primary/10 transition-colors" />
        
        {/* Right Panel - Chat/Agent */}
        <Panel defaultSize={35} minSize={20}>
          <div className="h-full flex flex-col">
            <Tabs value={activeRightPanel} onValueChange={setActiveRightPanel} className="h-full flex flex-col">
              <div className="border-b px-4">
                <TabsList className="h-12 w-full justify-start bg-transparent p-0">
                  <TabsTrigger 
                    value="chat" 
                    className="flex items-center gap-2 data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none"
                  >
                    <MessageSquare className="h-4 w-4" />
                    Chat
                  </TabsTrigger>
                  <TabsTrigger 
                    value="agent" 
                    className="flex items-center gap-2 data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none"
                  >
                    <Bot className="h-4 w-4" />
                    Invoice Agent
                  </TabsTrigger>
                </TabsList>
              </div>
              
              <TabsContent value="chat" className="flex-1 overflow-hidden mt-0">
                <ChatPanel datasetId={datasetId} />
              </TabsContent>
              
              <TabsContent value="agent" className="flex-1 overflow-hidden mt-0">
                <InvoiceAgentPanel 
                  datasetId={datasetId}
                  onAgentAction={(action, result) => {
                    console.log('Agent action completed:', action, result);
                    // You can add additional handling here, like updating the data view
                  }}
                />
              </TabsContent>
            </Tabs>
          </div>
        </Panel>
      </PanelGroup>
    </div>
  );
}