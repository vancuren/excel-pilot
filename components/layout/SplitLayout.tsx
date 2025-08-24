"use client"
import { Panel, PanelGroup, PanelResizeHandle } from "react-resizable-panels"
import { DataViewer } from "@/components/data/DataViewer"
import { ChatPanel } from "@/components/chat/ChatPanel"

export function SplitLayout() {
  return (
    <div className="h-[calc(100vh-4rem)]">
      <PanelGroup direction="horizontal" className="h-full">
        <Panel defaultSize={75} minSize={50}>
          <div className="h-full p-8 bg-muted/20">
            <DataViewer />
          </div>
        </Panel>

        <PanelResizeHandle className="w-1.5 bg-border/40 hover:bg-accent/30 transition-all duration-200 relative group">
          <div className="absolute inset-y-0 left-1/2 w-1 -translate-x-1/2 bg-accent/0 group-hover:bg-accent/20 transition-colors duration-200 rounded-full" />
        </PanelResizeHandle>

        <Panel defaultSize={25} minSize={20}>
          <div className="h-full bg-card/30 border-l border-border/40">
            <ChatPanel />
          </div>
        </Panel>
      </PanelGroup>
    </div>
  )
}
