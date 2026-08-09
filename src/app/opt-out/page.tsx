'use client'

import React from 'react'
import { ArrowLeft, ExternalLink, ShieldAlert, Phone, Mail, FileText } from 'lucide-react'
import Link from 'next/link'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'

interface OptOutCompany {
  name: string
  description: string
  url: string
  urlLabel: string
  phone?: string
  mail?: string
  note: string
}

const companies: OptOutCompany[] = [
  {
    name: 'SageStream, LLC',
    description:
      'A LexisNexis-owned consumer reporting agency that compiles supplemental credit reports from utility payments, cell phone history, and other alternative data. Its reports are used by lenders, insurers, and wireless providers.',
    url: 'https://consumer.risk.lexisnexis.com/opt',
    urlLabel: 'consumer.risk.lexisnexis.com/opt',
    phone: '888-395-0277',
    mail: 'SageStream, LLC Consumer Office, P.O. Box 503793, San Diego, CA 92150',
    note: 'Opting out here also removes you from prescreen lists. SageStream is now part of LexisNexis Risk Solutions, so a LexisNexis prescreen opt-out covers your SageStream file too.',
  },
  {
    name: 'LexisNexis Risk Solutions',
    description:
      'One of the largest data brokers in the world. Maintains consumer disclosure reports, public records, and insurance/employment data used in background checks, underwriting, and identity verification.',
    url: 'https://optout.lexisnexis.com/',
    urlLabel: 'optout.lexisnexis.com',
    phone: '888-497-0011',
    note:
      'Request "Information Suppression." You can also request a free copy of your LexisNexis consumer report under FCRA §609 to review and dispute what they hold.',
  },
  {
    name: 'Innovis',
    description:
      'A national consumer reporting agency that supplies prescreen lists to creditors and insurers for unsolicited firm offers of credit and insurance. Maintains its own credit file on you.',
    url: 'https://www.innovis.com/personal/optOutOptIn',
    urlLabel: 'innovis.com/personal/optOutOptIn',
    phone: '1-800-540-2505',
    mail: 'Innovis Consumer Assistance, PO Box 530088, Atlanta, GA 30353-0088',
    note:
      'The quickest route is the centralized prescreen opt-out at optoutprescreen.com, which covers Innovis, Equifax, Experian, and TransUnion at once. You can also request a free annual Innovis credit report.',
  },
  {
    name: 'CoreLogic (Cotality)',
    description:
      'Provides property records, mortgage/loan data, and consumer risk profiles. Its Credco arm supplies merged credit reports to mortgage lenders — the "CREDCO/Corelogic" inquiry you may see on your reports.',
    url: 'https://www.corelogic.com/privacy/',
    urlLabel: 'corelogic.com/privacy',
    phone: '877-532-8778',
    mail: 'CoreLogic Credco, LLC, P.O. Box 509124, San Diego, CA 92150',
    note:
      'Submit a consumer privacy/opt-out request through their privacy portal. If you never applied for a mortgage but see a CREDCO inquiry, dispute it on your credit report under FCRA §611.',
  },
]

export default function OptOutPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/" className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <h1 className="text-xl font-bold text-gray-900 dark:text-white">Opt-Out Center</h1>
      </div>

      {/* Note */}
      <Card className="border-red-300 dark:border-red-800 bg-red-50/50 dark:bg-red-950/20">
        <CardContent className="p-4">
          <div className="flex items-start gap-3">
            <ShieldAlert className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
            <div className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed">
              <p className="font-semibold text-red-700 dark:text-red-300 mb-1">
                Do this alongside every dispute
              </p>
              <p>
                When you dispute items on your credit reports, also <strong>opt out</strong> of these supplemental
                consumer reporting agencies and data brokers. They compile reports from the same accounts, inquiries,
                and public records you are disputing — and errors often survive there even after the big-three bureaus
                remove them. Opting out (and requesting free reports to review) prevents these files from being pulled
                by lenders, insurers, landlords, and employers while your disputes are pending, and reduces unsolicited
                offers of credit. <strong>Do this once for each company</strong> and keep the confirmation for your records.
              </p>
              <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                Also consider freezing your file with each agency and using the centralized prescreen opt-out at{' '}
                <a href="https://www.optoutprescreen.com/" target="_blank" rel="noopener noreferrer" className="text-blue-600 dark:text-blue-400 underline">
                  optoutprescreen.com
                </a>{' '}
                to stop unsolicited credit/insurance offers from all four major bureaus at once.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Company cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {companies.map(c => (
          <Card key={c.name} className="border-t-4 border-t-blue-500">
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-2">
                <h3 className="font-semibold text-gray-900 dark:text-white">{c.name}</h3>
                <Badge variant="info">FCRA CRA</Badge>
              </div>
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-3 leading-relaxed">{c.description}</p>

              <a
                href={c.url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-sm font-medium text-blue-600 dark:text-blue-400 hover:underline mb-2"
              >
                <ExternalLink className="w-4 h-4" /> {c.urlLabel}
              </a>

              <div className="space-y-1.5 text-xs text-gray-600 dark:text-gray-400 mt-2">
                {c.phone && (
                  <p className="flex items-center gap-1.5">
                    <Phone className="w-3.5 h-3.5 shrink-0" /> {c.phone}
                  </p>
                )}
                {c.mail && (
                  <p className="flex items-start gap-1.5">
                    <Mail className="w-3.5 h-3.5 shrink-0 mt-0.5" /> {c.mail}
                  </p>
                )}
              </div>

              <p className="mt-3 p-2.5 rounded-lg bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 text-xs text-gray-700 dark:text-gray-300 leading-relaxed">
                <span className="font-semibold text-blue-700 dark:text-blue-300">Tip: </span>
                {c.note}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardContent className="p-4">
          <div className="flex items-start gap-3">
            <FileText className="w-5 h-5 text-gray-400 shrink-0 mt-0.5" />
            <div className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed">
              <p className="font-medium text-gray-800 dark:text-gray-200 mb-1">Free reports you are entitled to</p>
              <p>
                Under FCRA §609, each of these consumer reporting agencies must give you a <strong>free</strong> copy of
                your file on request. Requesting them (a) shows you exactly what they hold about you and (b) lets you
                spot and dispute errors before a lender sees them. Combine this with your free annual reports from
                annualcreditreport.com for the big-three bureaus.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
