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
        
        <PanelResizeHandle className="relative group w-1 bg-border/60 hover:bg-primary/30 transition-colors duration-200">
          <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-5 h-10 rounded-full bg-background/60 border border-border/60 shadow-sm opacity-0 group-hover:opacity-100 transition-opacity" />
        </PanelResizeHandle>
        
        <Panel defaultSize={25} minSize={20}>
          <div className="h-full">
            <ChatPanel />
          </div>
        </Panel>
      </PanelGroup>
    </div>
  );
}
