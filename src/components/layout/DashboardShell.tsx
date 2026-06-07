'use client'

import React, { useState } from 'react'
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
        <main className="p-4 lg:p-6">
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
