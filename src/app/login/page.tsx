'use client'

import { Sun, Moon } from 'lucide-react'
import Image from 'next/image'
import { useTheme } from '@/lib/theme-context'
import AuthForm from '@/components/auth/AuthForm'

export default function LoginPage() {
  const { darkMode, toggleDarkMode } = useTheme()

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-950 px-4 relative">
      <button
        onClick={toggleDarkMode}
        className="absolute top-4 right-4 flex items-center gap-2 px-3 py-2 text-sm text-gray-600 dark:text-gray-300 bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors shadow-sm"
        aria-label={darkMode ? 'Switch to light mode' : 'Switch to dark mode'}
      >
        {darkMode ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
        <span className="hidden sm:inline">{darkMode ? 'Light Mode' : 'Dark Mode'}</span>
      </button>
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <Image
            src="/card-logos/NewRETTEEE.png"
            alt="RETTEEE CreditIntel"
            width={86}
            height={86}
            className="w-20 h-20 mx-auto mb-3"
          />
          <h1 className="text-xl font-bold text-gray-900 dark:text-white">RETTEEE CreditIntel</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Sign in to your account
          </p>
        </div>

        <AuthForm initialMode="signin" />
      </div>
    </div>
  )
}