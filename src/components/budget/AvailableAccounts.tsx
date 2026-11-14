'use client'

import React, { useEffect, useRef, useState } from 'react'
import { X } from 'lucide-react'

interface Account {
  id: number
  name: string
  accountType: string
  balance: number
  included: boolean
}

const formatMoney = (value: number) => value.toLocaleString('en-US', { style: 'currency', currency: 'USD' })

export function AvailableAccounts({
  onClose, onSaved, projected,
}: {
  onClose: () => void
  onSaved: () => Promise<void>
  projected: boolean
}) {
  const dialog = useRef<HTMLDialogElement>(null)
  const [accounts, setAccounts] = useState<Account[]>([])
  const [selected, setSelected] = useState<number[]>([])
  const [canEdit, setCanEdit] = useState(false)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    const controller = new AbortController()
    const element = dialog.current
    element?.showModal()
    async function load() {
      try {
        const response = await fetch('/api/budget/available-accounts', { signal: controller.signal })
        const data = await response.json()
        if (!response.ok) throw new Error(data.error || 'Unable to load accounts.')
        if (controller.signal.aborted) return
        setAccounts(data.accounts)
        setSelected(data.accounts.filter((account: Account) => account.included).map((account: Account) => account.id))
        setCanEdit(data.canEdit)
      } catch (err) {
        if (!controller.signal.aborted) setError(err instanceof Error ? err.message : 'Unable to load accounts.')
      } finally {
        if (!controller.signal.aborted) setLoading(false)
      }
    }
    void load()
    return () => {
      controller.abort()
      element?.close()
    }
  }, [])

  const save = async () => {
    setSaving(true)
    setError('')
    let persisted = saved
    try {
      if (!persisted) {
        const response = await fetch('/api/budget/available-accounts', {
          method: 'PUT', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ accountIds: selected }),
        })
        const data = await response.json()
        if (!response.ok) throw new Error(data.error || 'Unable to save accounts.')
        persisted = true
        setSaved(true)
      }
      await onSaved()
      onClose()
    } catch (err) {
      setError(persisted ? 'Selection saved, but the plan could not refresh. Try Refresh plan below.' : err instanceof Error ? err.message : 'Unable to save accounts.')
    } finally { setSaving(false) }
  }

  const total = accounts.reduce((sum, account) => sum + (selected.includes(account.id) ? Math.round(account.balance * 100) : 0), 0) / 100

  return (
    <dialog ref={dialog} aria-labelledby="available-accounts-title"
      onCancel={event => { event.preventDefault(); if (!saving) onClose() }}
      className="m-auto w-[calc(100%-2rem)] max-w-lg max-h-[85dvh] overflow-y-auto rounded-2xl border border-gray-200 bg-white p-5 text-gray-900 shadow-xl backdrop:bg-black/50 dark:border-gray-700 dark:bg-gray-900 dark:text-white">
      <div className="flex items-start justify-between gap-3">
        <h2 id="available-accounts-title" className="text-xl font-semibold">Accounts available for your budget</h2>
        <button type="button" aria-label="Close account selection" disabled={saving} onClick={onClose}
          className="rounded p-1 hover:bg-gray-100 focus-visible:ring-2 dark:hover:bg-gray-800"><X className="h-5 w-5" /></button>
      </div>
      <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
        Choose which saved account balances fund your pay-period plan. Loans are excluded.
        Unchecked accounts stay connected and keep syncing.
      </p>
      {projected && <p className="mt-2 text-sm text-amber-700 dark:text-amber-300">This is the starting cash for the plan. A later period&apos;s displayed amount also includes projected carry-over.</p>}
      {error && <p role="alert" className="mt-4 text-sm text-red-600 dark:text-red-400">{error}</p>}
      {loading ? <p role="status" className="py-6">Loading accounts…</p> : (
        <>
          {!canEdit && <p className="mt-3 text-sm text-gray-500">Only the household budget owner can change this selection. Example accounts are read-only.</p>}
          <fieldset disabled={!canEdit || saving || saved} className="mt-4 space-y-2">
            <legend className="sr-only">Include accounts in available money</legend>
            {accounts.length === 0 && <p className="text-sm text-gray-500">No active bank accounts yet. Add an account on the Bank Accounts page.</p>}
            {accounts.map(account => (
              <label key={account.id} className="flex cursor-pointer items-center gap-3 rounded-xl border border-gray-200 p-3 dark:border-gray-700">
                <input type="checkbox" checked={selected.includes(account.id)}
                  onChange={event => setSelected(ids => event.target.checked ? [...ids, account.id] : ids.filter(id => id !== account.id))}
                  className="h-5 w-5 shrink-0 accent-blue-600" />
                <span className="min-w-0 flex-1"><span className="block break-words font-medium">{account.name}</span><span className="text-xs capitalize text-gray-500 dark:text-gray-400">{account.accountType}</span></span>
                <span className="shrink-0 text-sm font-semibold tabular-nums">{formatMoney(account.balance)}</span>
              </label>
            ))}
          </fieldset>
          <div aria-live="polite" className="mt-4 flex justify-between gap-3 border-t border-gray-200 pt-4 font-semibold dark:border-gray-700">
            <span>Selected starting cash</span><span className="tabular-nums">{formatMoney(total)}</span>
          </div>
          {selected.length === 0 && <p className="mt-2 text-sm text-amber-700 dark:text-amber-300">No accounts selected. Your plan will start with $0.00.</p>}
          <div className="mt-5 flex flex-wrap justify-end gap-2">
            <button type="button" disabled={saving} onClick={onClose} className="rounded-lg border border-gray-300 px-4 py-2 dark:border-gray-600">{canEdit ? 'Cancel' : 'Close'}</button>
            {canEdit && <button type="button" onClick={save} disabled={saving || (!!error && accounts.length === 0)}
              className="rounded-lg bg-blue-600 px-4 py-2 font-medium text-white hover:bg-blue-700 disabled:opacity-50">
              {saving ? 'Saving…' : saved ? 'Refresh plan' : 'Save accounts'}
            </button>}
          </div>
        </>
      )}
    </dialog>
  )
}
