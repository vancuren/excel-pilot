import './globals.css';
import type { Metadata } from 'next';
// Using global font import in CSS to avoid build-time network fetch
import { ThemeProvider } from '@/components/providers/ThemeProvider';


export const metadata: Metadata = {
  title: 'SheetPilot - AI Spreadsheet & Accounting Automator',
  description: 'Transform your financial data with AI-powered analysis and automated accounting workflows',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}
