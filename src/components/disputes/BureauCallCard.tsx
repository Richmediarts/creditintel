'use client'

import React, { useState } from 'react'
import Link from 'next/link'
import { Phone, Copy, Check, UserSearch, Mic } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'

interface BureauCallInfo {
  name: string
  phone: string
  hours: string
  department: string
  askFor: string
  script: string[]
}

const callInfo: BureauCallInfo[] = [
  {
    name: 'Experian',
    phone: '888-397-3742',
    hours: 'Mon–Fri, 9am–5pm local time',
    department: 'Consumer Affairs / Dispute Department',
    askFor:
      'Ask for the "Consumer Affairs" or "Dispute Department." Inquiries are handled by the same department that takes credit report disputes — the automated system will route you. Say you are disputing an unauthorized hard inquiry.',
    script: [
      'My name is [Your Full Name], and I am calling to dispute a hard inquiry on my Experian credit report.',
      'The inquiry was made by [Creditor Name] on [Date]. I did not apply for credit with this company and I did not authorize this inquiry.',
      'Under FCRA §604(a)(2), a hard inquiry may only appear if I made a request or there was a permissible-purpose transaction. There was none.',
      'I am requesting that this inquiry be removed from my credit report immediately.',
      'Please provide me with a dispute reference number and send written confirmation once it is removed.',
    ],
  },
  {
    name: 'Equifax',
    phone: '866-349-5191',
    hours: 'Mon–Fri, 9am–9pm ET; Sat 9am–6pm ET',
    department: 'Dispute Department',
    askFor:
      'Ask for the "Dispute Department." Use the automated prompt for "file a dispute" or "dispute an item." Say the item you are disputing is an unauthorized inquiry.',
    script: [
      'My name is [Your Full Name], and I am calling to dispute a hard inquiry on my Equifax credit report.',
      'The inquiry was made by [Creditor Name] on [Date]. I did not apply for credit with this company and I did not authorize this inquiry.',
      'Under FCRA §604(a)(2), a hard inquiry may only appear if I made a request or there was a permissible-purpose transaction. There was none.',
      'I am requesting that this inquiry be removed from my credit report immediately.',
      'Please provide me with a dispute reference number and send written confirmation once it is removed.',
    ],
  },
  {
    name: 'TransUnion',
    phone: '800-916-8800',
    hours: 'Mon–Fri, 8am–11pm ET; Sat–Sun 8am–5pm ET',
    department: 'Consumer Dispute Center',
    askFor:
      'Ask for the "Consumer Dispute Center" or the "Inquiry Investigation" team. TransUnion routes disputes to a dedicated team — request to speak with a dispute analyst about an unauthorized inquiry.',
    script: [
      'My name is [Your Full Name], and I am calling to dispute a hard inquiry on my TransUnion credit report.',
      'The inquiry was made by [Creditor Name] on [Date]. I did not apply for credit with this company and I did not authorize this inquiry.',
      'Under FCRA §604(a)(2), a hard inquiry may only appear if I made a request or there was a permissible-purpose transaction. There was none.',
      'I am requesting that this inquiry be removed from my credit report immediately.',
      'Please provide me with a dispute reference number and send written confirmation once it is removed.',
    ],
  },
]

export default function BureauCallCard() {
  const [copiedBureau, setCopiedBureau] = useState<string | null>(null)

  const handleCopy = async (name: string, script: string[]) => {
    await navigator.clipboard.writeText(script.join('\n'))
    setCopiedBureau(name)
    setTimeout(() => setCopiedBureau(null), 2000)
  }

  return (
    <Card className="border-t-4 border-t-emerald-500">
      <CardContent className="p-4">
        <div className="flex items-center gap-2 mb-1">
          <Phone className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
          <h3 className="text-base font-semibold text-gray-900 dark:text-white">
            Call the Bureau to Dispute Inquiries
          </h3>
        </div>
        <p className="text-sm text-gray-600 dark:text-gray-400 mb-4 leading-relaxed">
          Calling is the fastest way to start an inquiry dispute. Have your credit report, the creditor name, and the
          inquiry date in front of you. Say you are disputing an <strong>unauthorized hard inquiry</strong> and always get a{' '}
          <strong>dispute reference number</strong>. Follow up with a written letter to keep your paper trail (FCRA §611 gives
          the bureau 30 days to investigate).
        </p>

        <div className="space-y-3">
          {callInfo.map(b => (
            <div key={b.name} className="rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 p-4">
              <div className="flex items-center justify-between flex-wrap gap-2 mb-2">
                <div className="flex items-center gap-2">
                  <span className="text-base font-semibold text-gray-900 dark:text-white">{b.name}</span>
                  <a
                    href={`tel:${b.phone.replace(/[^0-9]/g, '')}`}
                    className="inline-flex items-center gap-1.5 text-sm font-medium text-emerald-600 dark:text-emerald-400 hover:underline"
                  >
                    <Phone className="w-4 h-4" /> {b.phone}
                  </a>
                </div>
                <span className="text-xs text-gray-500 dark:text-gray-400">{b.hours}</span>
              </div>

              <div className="text-xs mb-3">
                <p className="text-gray-600 dark:text-gray-400">
                  <span className="font-semibold text-gray-800 dark:text-gray-200">Department: </span>
                  {b.department}
                </p>
              </div>

              <div className="mb-3 p-2.5 rounded-lg bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800">
                <p className="flex items-start gap-1.5 text-xs text-gray-700 dark:text-gray-300 leading-relaxed">
                  <UserSearch className="w-4 h-4 text-blue-500 shrink-0 mt-0.5" />
                  <span><span className="font-semibold text-blue-700 dark:text-blue-300">Who to ask for: </span>{b.askFor}</span>
                </p>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <p className="flex items-center gap-1.5 text-xs font-semibold text-gray-700 dark:text-gray-300">
                    <Mic className="w-4 h-4 text-emerald-500" /> Removal Script
                  </p>
                  <button
                    onClick={() => handleCopy(b.name, b.script)}
                    className="inline-flex items-center gap-1 text-xs font-medium text-emerald-600 dark:text-emerald-400 hover:underline"
                  >
                    {copiedBureau === b.name ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                    {copiedBureau === b.name ? 'Copied' : 'Copy script'}
                  </button>
                </div>
                <ol className="list-decimal pl-5 space-y-1 text-xs text-gray-600 dark:text-gray-400 leading-relaxed">
                  {b.script.map((line, i) => (
                    <li key={i}>{line}</li>
                  ))}
                </ol>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-4 p-3 rounded-lg bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 text-xs text-gray-700 dark:text-gray-300 leading-relaxed">
          <p className="font-semibold text-amber-700 dark:text-amber-300 mb-1">Tips for the call</p>
          <ul className="list-disc pl-4 space-y-1">
            <li>Fill in the [bracketed] placeholders before you call so you don&apos;t stumble.</li>
            <li>Stay calm and factual. Do not admit the inquiry was yours — if it was yours, skip the call and handle it normally.</li>
            <li>If the representative says they&apos;ll &quot;look into it,&quot; ask for a <strong>reference number</strong> and their <strong>name or employee ID</strong>.</li>
            <li>If they refuse to remove it, escalate to a supervisor and say you will file an FCRA complaint with the CFPB (cfpb.gov/complaint) and the FTC (ftc.gov/complaint).</li>
            <li>Then send the written <Link href="/dispute-letters" className="text-amber-700 dark:text-amber-300 underline">Inquiry Dispute letter</Link> by certified mail for the paper trail.</li>
          </ul>
        </div>
      </CardContent>
    </Card>
  )
}
