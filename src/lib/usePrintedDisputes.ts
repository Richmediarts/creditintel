'use client'

import { useState, useEffect } from 'react'

interface TrackedDispute {
  id: number
  creditorName: string
  bureau: string
  status: string
  printedAt: string | null
}

export function usePrintedDisputes() {
  const [printedKeys, setPrintedKeys] = useState<Set<string>>(new Set())
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    let cancelled = false
    fetch('/api/disputes')
      .then(res => (res.ok ? res.json() : { disputes: [] }))
      .then(data => {
        if (cancelled) return
        const keys = new Set<string>()
        for (const d of (data.disputes || []) as TrackedDispute[]) {
          if (d.printedAt) {
            keys.add(`${d.creditorName}|${d.bureau}`)
          }
        }
        setPrintedKeys(keys)
        setLoaded(true)
      })
      .catch(() => {
        if (!cancelled) setLoaded(true)
      })
    return () => { cancelled = true }
  }, [])

  const isPrinted = (creditorName: string, bureau: string) => printedKeys.has(`${creditorName}|${bureau}`)

  return { isPrinted, loaded }
}
