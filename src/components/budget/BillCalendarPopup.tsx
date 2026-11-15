'use client'

import { useEffect, useId, useRef } from 'react'
import { X } from 'lucide-react'
import { toDateString } from '@/lib/utils/recurrence'

interface CalendarEntry {
  id: number
  name: string
  date: string
  amount: number | null
  paid: boolean
  planned: boolean
}
export function BillCalendarPopup({ period, entries, total, onClose }: {
  period: { start: string; end: string; label: string }
  entries: CalendarEntry[]
  total: number
  onClose: () => void
}) {
  const dialog = useRef<HTMLDialogElement>(null)
  const titleId = useId()
  useEffect(() => {
    const element = dialog.current
    element?.showModal()
    return () => { element?.close() }
  }, [])
  const close = () => { dialog.current?.close(); onClose() }
  const money = (amount: number) => amount.toLocaleString('en-US', { style: 'currency', currency: 'USD' })
  const start = new Date(period.start + 'T00:00:00')
  const end = new Date(period.end + 'T00:00:00')
  const months: Date[] = []
  for (let month = new Date(start.getFullYear(), start.getMonth(), 1); month <= end; month = new Date(month.getFullYear(), month.getMonth() + 1, 1)) {
    months.push(month)
  }
  const today = toDateString(new Date())
  return (
    <dialog ref={dialog} aria-labelledby={titleId}
      onCancel={event => { event.preventDefault(); close() }}
      onClick={event => {
        if (event.target !== event.currentTarget) return
        const rect = event.currentTarget.getBoundingClientRect()
        if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) close()
      }}
      className="m-auto max-h-[85dvh] w-[calc(100%-1rem)] max-w-5xl overflow-y-auto rounded-2xl border border-gray-200 bg-white p-4 text-gray-900 shadow-2xl backdrop:bg-black/50 dark:border-gray-700 dark:bg-gray-900 dark:text-white sm:p-6">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <h2 id={titleId} className="text-lg font-semibold">Bills calendar</h2>
          <p className="mt-1 text-sm text-gray-600 dark:text-gray-300">
            {start.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })} – {end.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
          </p>
          <p className="mt-1 text-sm">Remaining this period: <strong>{money(total)}</strong></p>
        </div>
        <button type="button" onClick={close} aria-label="Close bills calendar"
          className="rounded-lg p-2 hover:bg-gray-100 focus-visible:outline-2 focus-visible:outline-blue-500 dark:hover:bg-gray-800">
          <X className="h-5 w-5" />
        </button>
      </div>
      <p className="mb-4 text-xs text-gray-500 dark:text-gray-400">Shows the bills in this pay-period list, including your current filters. Planned payment dates take priority over due dates; paid bills appear on their payment date.</p>
      <div className="space-y-5">
        {months.map(month => {
          const year = month.getFullYear()
          const monthIndex = month.getMonth()
          const count = new Date(year, monthIndex + 1, 0).getDate()
          const padding = month.getDay()
          const cells = Array.from({ length: Math.ceil((padding + count) / 7) * 7 }, (_, index) => {
            const day = index - padding + 1
            return day < 1 || day > count ? null : new Date(year, monthIndex, day)
          })
          return <section key={toDateString(month)} aria-label={month.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}>
            <h3 className="mb-2 font-semibold">{month.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}</h3>
            <div className="overflow-x-auto pb-2">
              <div className="min-w-[560px]">
                <div className="grid grid-cols-7 text-center text-xs font-medium text-gray-500 dark:text-gray-400">
                  {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => <div key={day} className="py-2">{day}</div>)}
                </div>
                <div className="grid grid-cols-7 gap-1">
                  {cells.map((day, index) => {
                    if (!day) return <div key={'blank-' + index} />
                    const date = toDateString(day)
                    const selected = date >= period.start && date <= period.end
                    const dayEntries = entries.filter(entry => entry.date === date)
                    return <div key={date} className={`min-h-24 rounded-lg border p-2 ${selected ? 'border-blue-300 bg-blue-50 dark:border-blue-700 dark:bg-blue-950/30' : 'border-gray-100 bg-gray-50 text-gray-400 dark:border-gray-800 dark:bg-gray-950/30'} ${date === today ? 'ring-2 ring-blue-500' : ''}`}>
                      <time dateTime={date} title={day.toLocaleDateString('en-US', { dateStyle: 'full' })} className="text-xs font-semibold">{day.getDate()}{date === today && <span className="ml-1 text-[10px] text-blue-600 dark:text-blue-300">Today</span>}</time>
                      <div className="mt-1 space-y-1">{dayEntries.map(entry => (
                        <div key={entry.id} className={`rounded p-1 text-[11px] leading-snug ${entry.paid ? 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-200' : entry.amount == null ? 'bg-amber-100 text-amber-900 dark:bg-amber-900/40 dark:text-amber-200' : 'bg-white text-gray-800 dark:bg-gray-800 dark:text-gray-100'}`}>
                          <p className="break-words font-medium">{entry.name}</p>
                          <p className="mt-0.5 tabular-nums">{entry.paid ? 'Paid ✓' : entry.amount == null ? 'Unknown amount' : money(entry.amount)}</p>
                          {entry.planned && !entry.paid && <span className="text-[10px]">Planned payment</span>}
                        </div>
                      ))}</div>
                    </div>
                  })}
                </div>
              </div>
            </div>
          </section>
        })}
      </div>
      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-gray-200 pt-3 dark:border-gray-700">
        <p className="text-xs text-gray-500 dark:text-gray-400">Blue background: selected pay period · Green: paid · Amber: unknown amount</p>
        <button type="button" onClick={close} className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700">Close calendar</button>
      </div>
    </dialog>
  )
}
