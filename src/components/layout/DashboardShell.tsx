'use client'

import React, { useState } from 'react'
import { Lock } from 'lucide-react'
import { CreditProvider } from '@/lib/store/creditStore'
import { AuthProvider, useAuth } from '@/lib/auth-context'
import { ThemeProvider, useTheme } from '@/lib/theme-context'
import { Sidebar, Header } from '@/components/layout/Sidebar'

function AppShell({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth()
  const { darkMode, toggleDarkMode } = useTheme()
  const [collapsed, setCollapsed] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)

  if (loading || !user) return <>{children}</>

  const isExample = !!user.isExample

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
      <Sidebar
        darkMode={darkMode}
        toggleDarkMode={toggleDarkMode}
        collapsed={collapsed}
        setCollapsed={setCollapsed}
        mobileOpen={mobileOpen}
        setMobileOpen={setMobileOpen}
      />
      <div className={`transition-all duration-300 ${collapsed ? 'lg:ml-16' : 'lg:ml-64'}`}>
        <Header setMobileOpen={setMobileOpen} />
        {isExample && (
          <div className="flex items-center gap-2 bg-amber-100 dark:bg-amber-900/40 border-b border-amber-200 dark:border-amber-800 px-4 py-2 text-xs text-amber-800 dark:text-amber-300">
            <Lock className="w-3.5 h-3.5 flex-shrink-0" />
            <span>You are viewing the <strong>example account</strong> (read-only mirror of the admin data). Editing and deleting are disabled.</span>
          </div>
        )}
        <main className={`p-4 lg:p-6 ${isExample ? 'readonly-mode' : ''}`}>
          {children}
        </main>
      </div>
    </div>
  )
}

export function DashboardShell({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider>
      <AuthProvider>
        <CreditProvider>
          <AppShell>{children}</AppShell>
        </CreditProvider>
      </AuthProvider>
    </ThemeProvider>
  )
}
