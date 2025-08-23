'use client';

import { useState } from 'react';
import { Panel, PanelGroup, PanelResizeHandle } from 'react-resizable-panels';
import { DataViewer } from '@/components/data/DataViewer';
import { ChatPanel } from '@/components/chat/ChatPanel';

export function SplitLayout() {
  return (
    <div className="h-[calc(100vh-4rem)]">
      <PanelGroup direction="horizontal" className="h-full">
        <Panel defaultSize={75} minSize={50}>
          <div className="h-full p-4">
            <DataViewer />
          </div>
        </Panel>
        
        <PanelResizeHandle className="w-2 bg-border hover:bg-blue-200 dark:hover:bg-blue-800 transition-colors" />
        
        <Panel defaultSize={25} minSize={20}>
          <div className="h-full p-4">
            <ChatPanel />
          </div>
        </Panel>
      </PanelGroup>
    </div>
  );
}