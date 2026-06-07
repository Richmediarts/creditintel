import type { Metadata } from 'next'
import './globals.css'
import { DashboardShell } from '@/components/layout/DashboardShell'

export const metadata: Metadata = {
  title: 'CreditIntel - Credit Intelligence Dashboard',
  description: 'Forensic credit report analysis and dispute management platform',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="antialiased">
        <DashboardShell>{children}</DashboardShell>
      </body>
    </html>
  )
}
