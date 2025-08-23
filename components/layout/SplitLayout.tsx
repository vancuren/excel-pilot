'use client';

import { useState } from 'react';
import { Panel, PanelGroup, PanelResizeHandle } from 'react-resizable-panels';
import { DataViewer } from '@/components/data/DataViewer';
import { ChatPanel } from '@/components/chat/ChatPanel';

export function SplitLayout() {
  return (
    <div className="h-[calc(100vh-3.5rem)]">
      <PanelGroup direction="horizontal" className="h-full">
        <Panel defaultSize={75} minSize={50}>
          <div className="h-full p-6">
            <DataViewer />
          </div>
        </Panel>
        
        <PanelResizeHandle className="w-1 bg-border/60 hover:bg-primary/20 transition-colors duration-200" />
        
        <Panel defaultSize={25} minSize={20}>
          <div className="h-full">
            <ChatPanel />
          </div>
        </Panel>
      </PanelGroup>
    </div>
  );
}