'use client'

import React from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { usePathname, useRouter } from 'next/navigation'
import {
  LayoutDashboard, Upload, FileText, BarChart3, GitCompare,
  AlertTriangle, Search, Brain, Mail, TrendingUp, Download,
  Sun, Moon, Menu, X, ChevronLeft, ChevronRight,
  Gavel, Shield, LogIn, LogOut, User, Activity, HelpCircle,
  Wallet, Banknote, Receipt, Landmark, CreditCard, Users, Tag,
  PieChart, Target, FileUp, Plug, FolderArchive, ListChecks,
} from 'lucide-react'
import { useCredit } from '@/lib/store/creditStore'
import { useAuth } from '@/lib/auth-context'
import { useTheme } from '@/lib/theme-context'
import { Badge } from '@/components/ui/badge'

interface SidebarProps {
  darkMode: boolean
  toggleDarkMode: () => void
  collapsed: boolean
  setCollapsed: (v: boolean) => void
  mobileOpen: boolean
  setMobileOpen: (v: boolean) => void
}

const navItems = [
  { href: '/', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/getting-started', label: 'Getting Started', icon: ListChecks },
  { href: '/upload', label: 'Upload Center', icon: Upload },
  { href: '/summary', label: 'Credit Summary', icon: BarChart3 },
  { href: '/report-viewer', label: 'Report Viewer', icon: FileText },
  { href: '/comparison', label: 'Bureau Comparison', icon: GitCompare },
  { href: '/derogatory', label: 'Derogatory Accounts', icon: AlertTriangle },
  { href: '/inquiries', label: 'Inquiry Tracker', icon: Search },
  { href: '/ai-analysis', label: 'AI Analysis', icon: Brain },
  { href: '/dispute-letters', label: 'Dispute Letters', icon: Mail },
  { href: '/disputes', label: 'Dispute Tracker', icon: Gavel },
  { href: '/opt-out', label: 'Opt-Out Center', icon: Shield },
  { href: '/letters', label: 'Letters Library', icon: FolderArchive },
  { href: '/fico-scores', label: 'FICO® Scores', icon: Activity },
  { href: '/score-simulator', label: 'Score Simulator', icon: TrendingUp },
  { href: '/export', label: 'Export Center', icon: Download },
  { href: '/help', label: 'Help Guide', icon: HelpCircle },
]

const budgetItems = [
  { href: '/budget', label: 'Budget Dashboard', icon: Wallet },
  { href: '/budget/interactive', label: 'Interactive Budget', icon: PieChart },
  { href: '/budget/paychecks', label: 'Paychecks', icon: Banknote },
  { href: '/budget/bills', label: 'Bills', icon: Receipt },
  { href: '/budget/bank-accounts', label: 'Bank Accounts', icon: Landmark },
  { href: '/budget/credit-cards', label: 'Credit Cards', icon: CreditCard },
  { href: '/budget/payees', label: 'Payees', icon: Users },
  { href: '/budget/categories', label: 'Categories', icon: Tag },
  { href: '/budget/reports', label: 'Reports', icon: BarChart3 },
  { href: '/budget/modified-income', label: 'Modified Income', icon: FileUp },
  { href: '/budget/goals', label: 'Goals & Net Worth', icon: Target },
  { href: '/budget/import-statement', label: 'Import Statement', icon: Upload },
  { href: '/budget/plaid-settings', label: 'Acct Link Settings', icon: Plug },
]

export function Sidebar({ darkMode, toggleDarkMode, collapsed, setCollapsed, mobileOpen, setMobileOpen }: SidebarProps) {
  const pathname = usePathname()
  const { state } = useCredit()
  const { user, logout } = useAuth()
  const router = useRouter()
  const reportCount = state.reports.length

  const handleLogout = async () => {
    await logout()
    router.push('/')
  }

  return (
    <>
      {mobileOpen && (
        <div className="fixed inset-0 bg-black/50 z-40 lg:hidden" onClick={() => setMobileOpen(false)} />
      )}
      <aside className={`
        fixed top-0 left-0 z-50 h-full bg-white dark:bg-gray-900 border-r border-gray-200 dark:border-gray-800
        transition-all duration-300 flex flex-col
        ${collapsed ? 'w-16' : 'w-64'}
        ${mobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
      `}>
        <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-800">
          {!collapsed && (
            <Link href="/" className="flex items-center gap-2">
              <Image
                src="/card-logos/NewRETTEEE.png"
                alt="RETTEEE CreditIntel"
                width={86}
                height={86}
                className="w-8 h-8"
              />
              <span className="font-bold text-gray-900 dark:text-white text-sm">RETTEEE CreditIntel</span>
            </Link>
          )}
          <button onClick={() => setCollapsed(!collapsed)} className="hidden lg:block text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
            {collapsed ? <ChevronRight className="w-5 h-5" /> : <ChevronLeft className="w-5 h-5" />}
          </button>
          <button onClick={() => setMobileOpen(false)} className="lg:hidden text-gray-400 hover:text-gray-600">
            <X className="w-5 h-5" />
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto p-2 space-y-1">
          {navItems.map(item => {
            const isActive = pathname === item.href
            const Icon = item.icon
            return (
              <Link key={item.href} href={item.href}
                onClick={() => setMobileOpen(false)}
                title={collapsed ? item.label : undefined}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors text-sm
                  ${isActive
                    ? 'bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 font-medium'
                    : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800'
                  }
                `}
              >
                <Icon className="w-5 h-5 flex-shrink-0" />
                {!collapsed && <span>{item.label}</span>}
                {!collapsed && item.href === '/' && reportCount > 0 && (
                  <Badge variant="info" className="ml-auto">{reportCount}</Badge>
                )}
              </Link>
            )
          })}

          {/* Budget section */}
          <div className="pt-3 pb-1 px-3">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500">Budget</p>
          </div>
          {budgetItems.map(item => {
            const isActive = pathname === item.href || pathname.startsWith(item.href + '/')
            const Icon = item.icon
            return (
              <Link key={item.href} href={item.href}
                onClick={() => setMobileOpen(false)}
                title={collapsed ? item.label : undefined}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors text-sm
                  ${isActive
                    ? 'bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 font-medium'
                    : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800'
                  }
                `}
              >
                <Icon className="w-5 h-5 flex-shrink-0" />
                {!collapsed && <span>{item.label}</span>}
              </Link>
            )
          })}

          {/* Admin link - only for admins */}
          {user?.role === 'admin' && !collapsed && (
            <>
              <div className="pt-3 pb-1 px-3">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500">Admin</p>
              </div>
              <Link href="/admin/users"
                onClick={() => setMobileOpen(false)}
                title={collapsed ? 'Manage Users' : undefined}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors text-sm ${
                  pathname === '/admin/users'
                    ? 'bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 font-medium'
                    : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800'
                }`}
              >
                <Shield className="w-5 h-5 flex-shrink-0" />
                <span>Manage Users</span>
              </Link>
            </>
          )}
        </nav>

        {/* User section */}
        <div className="border-t border-gray-200 dark:border-gray-800">
          {user ? (
            <div className="p-3 space-y-1">
              <div className="flex items-center gap-3 px-3 py-2 text-sm text-gray-700 dark:text-gray-300">
                <User className="w-4 h-4 flex-shrink-0" />
                {!collapsed && (
                  <div className="min-w-0">
                    <p className="truncate font-medium">{user.name}</p>
                    <p className="text-[10px] text-gray-400 capitalize">{user.role}</p>
                  </div>
                )}
              </div>
              {!user.isExample && (
              <Link href="/settings"
                onClick={() => setMobileOpen(false)}
                title={collapsed ? 'Settings' : undefined}
                className="flex items-center gap-3 w-full px-3 py-2 rounded-lg text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors text-sm"
              >
                <User className="w-4 h-4 flex-shrink-0" />
                {!collapsed && <span>Settings</span>}
              </Link>
            )}
              <button onClick={handleLogout}
                title={collapsed ? 'Sign Out' : undefined}
                className="flex items-center gap-3 w-full px-3 py-2 rounded-lg text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors text-sm"
              >
                <LogOut className="w-4 h-4 flex-shrink-0" />
                {!collapsed && <span>Sign Out</span>}
              </button>
            </div>
          ) : (
            <div className="p-3">
              <Link href="/login"
                title={collapsed ? 'Sign In' : undefined}
                className="flex items-center gap-3 w-full px-3 py-2 rounded-lg text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors text-sm"
              >
                <LogIn className="w-4 h-4 flex-shrink-0" />
                {!collapsed && <span>Sign In</span>}
              </Link>
            </div>
          )}

          <div className="px-3 pb-3">
            <button onClick={toggleDarkMode}
              title={collapsed ? (darkMode ? 'Light Mode' : 'Dark Mode') : undefined}
              className="flex items-center gap-3 w-full px-3 py-2 rounded-lg text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors text-sm"
            >
              {darkMode ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
              {!collapsed && <span>{darkMode ? 'Light Mode' : 'Dark Mode'}</span>}
            </button>
          </div>
        </div>
      </aside>
    </>
  )
}

export function Header({ setMobileOpen }: { setMobileOpen: (v: boolean) => void }) {
  const { user } = useAuth()
  const { darkMode, toggleDarkMode } = useTheme()

  return (
    <header className="h-16 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 flex items-center justify-between px-4 lg:px-6 sticky top-0 z-30">
      <button onClick={() => setMobileOpen(true)} className="lg:hidden text-gray-600 dark:text-gray-400">
        <Menu className="w-6 h-6" />
      </button>
      <div className="flex-1" />
      <div className="flex items-center gap-3">
        <button
          onClick={toggleDarkMode}
          className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-gray-600 dark:text-gray-300 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
          aria-label={darkMode ? 'Switch to light mode' : 'Switch to dark mode'}
        >
          {darkMode ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
          <span className="hidden sm:inline">{darkMode ? 'Light Mode' : 'Dark Mode'}</span>
        </button>
        <span className="text-sm text-gray-500 dark:text-gray-400 truncate max-w-[40vw] sm:max-w-none">
          {user ? (
            <>
              {user.name}
              <span className="hidden md:inline"> — Credit Intelligence Dashboard</span>
            </>
          ) : (
            'Credit Intelligence Dashboard'
          )}
        </span>
      </div>
    </header>
  )
}
