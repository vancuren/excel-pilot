"use client"
import { FileUploader } from "@/components/upload/FileUploader"
import { AppHeader } from "@/components/layout/AppHeader"
import { SplitLayout } from "@/components/layout/SplitLayout"
import { useAppStore } from "@/lib/store"
import { Sparkles, Shield, Zap } from "lucide-react"
import { EnhancedSplitLayout } from "@/components/layout/EnhancedSplitLayout"

export default function Home() {
  const { currentDatasetId, datasets } = useAppStore()

  if (!currentDatasetId && datasets.length === 0) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background via-muted/10 to-background">
        <AppHeader />

        <main className="max-w-7xl mx-auto px-8 py-20">
          <div className="text-center mb-20 space-y-8">
            <div className="space-y-4">
              <h1 className="text-5xl sm:text-6xl font-bold text-foreground tracking-tight leading-tight">
                Transform Your
                <span className="bg-gradient-to-r from-accent via-accent to-secondary bg-clip-text text-transparent">
                  {" "}
                  Financial Data
                </span>
              </h1>
              <p className="text-xl text-muted-foreground max-w-3xl mx-auto leading-relaxed font-medium">
                Upload your spreadsheets or PDFs, ask questions, and automate accounting workflows with AI-powered
                insights
              </p>
            </div>

            <div className="flex flex-wrap justify-center gap-4 mt-8">
              <div className="flex items-center gap-2 px-4 py-2 bg-card/60 rounded-full border border-border/40">
                <Sparkles className="h-4 w-4 text-accent" />
                <span className="text-sm font-medium text-foreground">AI-Powered Analysis</span>
              </div>
              <div className="flex items-center gap-2 px-4 py-2 bg-card/60 rounded-full border border-border/40">
                <Shield className="h-4 w-4 text-accent" />
                <span className="text-sm font-medium text-foreground">Secure Processing</span>
              </div>
              <div className="flex items-center gap-2 px-4 py-2 bg-card/60 rounded-full border border-border/40">
                <Zap className="h-4 w-4 text-accent" />
                <span className="text-sm font-medium text-foreground">Instant Insights</span>
              </div>
            </div>
          </div>

          <div className="max-w-4xl mx-auto">
            <FileUploader />
          </div>
        </main>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background">
      <AppHeader />
      <SplitLayout />
      {/* {currentDatasetId && <EnhancedSplitLayout datasetId={currentDatasetId} />} */}
      {/* {!currentDatasetId && <SplitLayout />} */}
    </div>
  )
}
