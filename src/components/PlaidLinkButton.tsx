'use client'

import React, { useState, useCallback, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { usePlaidLink } from 'react-plaid-link'
import { Plug, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface PlaidLinkButtonProps {
  onConnected?: () => void
}

export function PlaidLinkButton({ onConnected }: PlaidLinkButtonProps) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [linkToken, setLinkToken] = useState<string | null>(null)

  const fetchLinkToken = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/budget/plaid/create-link-token', { cache: 'no-store' })
      const data = await res.json()
      if (!res.ok) {
        router.push('/budget/plaid-settings')
        return
      }
      setLinkToken(data.link_token)
    } catch {
      router.push('/budget/plaid-settings')
    }
    setLoading(false)
  }, [router])

  const { open, ready } = usePlaidLink({
    token: linkToken || '',
    onSuccess: async (publicToken: string | null, metadata: Parameters<import('react-plaid-link').PlaidLinkOnSuccess>[1]) => {
      if (!publicToken) return
      const inst = (metadata.institution as { name?: string })?.name || ''
      try {
        const exchangeRes = await fetch('/api/budget/plaid/exchange-public-token', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ public_token: publicToken, institution: inst }),
        })
        const exchangeData = await exchangeRes.json()
        if (exchangeRes.ok) {
          onConnected?.()
        } else {
          setError(exchangeData.error || 'Failed to connect account')
        }
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : 'Failed to exchange token')
      }
    },
    onExit: (err: unknown) => {
      if (err) setError('Link exited with error')
    },
  })

  useEffect(() => {
    if (linkToken && ready) {
      open()
    }
  }, [linkToken, ready, open])

  return (
    <div>
      <Button onClick={fetchLinkToken} disabled={loading} variant="secondary" size="sm">
        {loading ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Plug className="h-4 w-4 mr-1" />}
        {loading ? 'Connecting...' : 'Link Accounts'}
      </Button>
      {error && <p className="text-xs text-red-500 mt-1">{error}</p>}
    </div>
  )
}
