"use client"

import { MoonIcon, SunIcon, Database, FileSpreadsheet } from "lucide-react"
import { useTheme } from "next-themes"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useAppStore } from "@/lib/store"

export function AppHeader() {
  const { theme, setTheme } = useTheme()
  const { datasets, currentDatasetId, setCurrentDataset } = useAppStore()

  return (
    /* Enhanced header with subtle backdrop blur and refined spacing */
    <header className="border-b border-border/40 bg-background/80 backdrop-blur-xl sticky top-0 z-50 shadow-sm">
      <div className="max-w-7xl mx-auto px-8">
        <div className="flex items-center justify-between h-16">
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-4">
              <div className="bg-gradient-to-br from-primary via-primary to-primary/90 p-2.5 rounded-xl shadow-sm ring-1 ring-primary/10">
                <FileSpreadsheet className="h-6 w-6 text-primary-foreground" />
              </div>
              <div className="space-y-0.5">
                <h1 className="text-xl font-bold text-foreground tracking-tight">ExcelPilot</h1>
                <p className="text-sm text-muted-foreground font-medium">AI Accounting Assistant</p>
              </div>
            </div>

            {datasets.length > 0 && (
              /* Enhanced dataset selector with better styling */
              <Select value={currentDatasetId || undefined} onValueChange={setCurrentDataset}>
                <SelectTrigger className="w-64 h-10 bg-card/50 border-border/60 hover:bg-card/80 transition-all duration-200 shadow-sm">
                  <Database className="h-4 w-4 mr-3 text-muted-foreground" />
                  <SelectValue placeholder="Select dataset" />
                </SelectTrigger>
                <SelectContent className="border-border/60 shadow-xl">
                  {datasets.map((dataset) => (
                    <SelectItem key={dataset.id} value={dataset.id} className="hover:bg-muted/60">
                      {dataset.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>

          <Button
            variant="ghost"
            size="icon"
            className="h-10 w-10 hover:bg-muted/60 transition-all duration-200 rounded-xl"
            onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
          >
            <SunIcon className="h-5 w-5 rotate-0 scale-100 transition-all duration-300 dark:-rotate-90 dark:scale-0" />
            <MoonIcon className="h-5 w-5 absolute rotate-90 scale-0 transition-all duration-300 dark:rotate-0 dark:scale-100" />
            <span className="sr-only">Toggle theme</span>
          </Button>
        </div>
      </div>
    </header>
  )
}
