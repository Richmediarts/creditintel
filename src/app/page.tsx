'use client'

import Link from 'next/link'
import Image from 'next/image'
import { CreditCard, Wallet } from 'lucide-react'
import { useAuth } from '@/lib/auth-context'
import AuthForm from '@/components/auth/AuthForm'

function LandingOption({
  href,
  icon: Icon,
  title,
  description,
  color,
}: {
  href: string
  icon: React.ElementType
  title: string
  description: string
  color: string
}) {
  return (
    <Link href={href} className="block group">
      <div className="border border-gray-200 dark:border-gray-800 rounded-xl p-6 flex flex-col items-center text-center hover:border-blue-500 dark:hover:border-blue-400 hover:shadow-md transition-all">
        <div className={`w-16 h-16 rounded-full flex items-center justify-center mb-4 bg-${color}-100 dark:bg-${color}-900/30 text-${color}-600 dark:text-${color}-400`}>
          <Icon className="w-8 h-8" />
        </div>
        <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-2">{title}</h2>
        <p className="text-sm text-gray-500 dark:text-gray-400">{description}</p>
      </div>
    </Link>
  )
}

export default function LandingPage() {
  const { user, loading } = useAuth()

  if (loading) return null

  return (
    <div className="min-h-[80vh] flex flex-col items-center justify-center px-4">
      <div className="text-center mb-10">
        <Image
          src="/card-logos/NewRETTEEE.png"
          alt="RETTEEE CreditIntel"
          width={86}
          height={86}
          className="w-20 h-20 mx-auto mb-4"
        />
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">RETTEEE CreditIntel</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400">Choose a dashboard to continue</p>
      </div>

      {user ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 max-w-lg w-full">
          <LandingOption
            href="/dashboard"
            icon={CreditCard}
            title="Credit Dashboard"
            description="View credit reports, disputes, scores, and more."
            color="blue"
          />
          <LandingOption
            href="/budget"
            icon={Wallet}
            title="Budget Dashboard"
            description="Manage budgets, paychecks, bills, and bank accounts."
            color="emerald"
          />
        </div>
      ) : (
        <div className="w-full max-w-sm">
          <AuthForm initialMode="signin" />
        </div>
      )}
    </div>
  )
}
