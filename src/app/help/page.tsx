'use client'

import React from 'react'
import { ArrowLeft } from 'lucide-react'
import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

const sections = [
  {
    title: 'Dashboard',
    icon: 'LayoutDashboard',
    path: '/',
    description: 'Landing page with a summary overview of your uploaded credit reports. Shows the number of reports loaded and quick links to key areas.',
    usage: 'Data appears automatically once you upload reports. Use it as a starting point to navigate the app.',
  },
  {
    title: 'Upload Center',
    icon: 'Upload',
    path: '/upload',
    description: 'Upload credit report files (.txt or .pdf) from any of the three bureaus — Experian, Equifax, and TransUnion.',
    usage: 'Drag & drop or click to select files. The app parses the report data and stores it locally. After upload, data is enriched with seed data for consistency.',
  },
  {
    title: 'Credit Summary',
    icon: 'BarChart3',
    path: '/summary',
    description: 'High-level statistics across all your credit reports: total accounts, open/closed counts, total balance, credit utilization, derogatory marks, charge-offs, collections, late accounts, bankruptcies, and inquiry counts.',
    usage: 'Click any stat tile to drill into the relevant section (e.g., click "Derogatory" to go to the Derogatory Accounts page).',
  },
  {
    title: 'Report Viewer',
    icon: 'FileText',
    path: '/report-viewer',
    description: 'Browse individual credit accounts from all bureaus in a searchable, filterable table. Filter by bureau (Experian, Equifax, TransUnion) or account status, and search by creditor name.',
    usage: 'Use the filter tabs and search bar to find specific accounts. Each row shows account type, balance, status, and payment history.',
  },
  {
    title: 'Bureau Comparison',
    icon: 'GitCompare',
    path: '/comparison',
    description: 'Side-by-side comparison of your credit data across all three bureaus. Highlights differences in accounts, inquiries, and derogatory items.',
    usage: 'Scroll through the comparison table to see which accounts appear on each bureau\'s report. Color-coded tags indicate account health (derog, charge-off, late, etc.).',
  },
  {
    title: 'Derogatory Accounts',
    icon: 'AlertTriangle',
    path: '/derogatory',
    description: 'Lists all negative or derogatory items found across your credit reports, including collections, charge-offs, late payments, and settlements.',
    usage: 'Review each item and use the information to generate dispute letters. Items shown here feed into the dispute letter generation.',
  },
  {
    title: 'Inquiry Tracker',
    icon: 'Search',
    path: '/inquiries',
    description: 'Shows all hard inquiries pulled from your credit reports, with creditor name, date, and bureau.',
    usage: 'Monitor who has accessed your credit. Hard inquiries can impact your credit score — use this page to track them.',
  },
  {
    title: 'AI Analysis',
    icon: 'Brain',
    path: '/ai-analysis',
    description: 'Automated analysis of your credit reports with AI-generated findings grouped by severity (high, medium, low).',
    usage: 'Review the findings to understand potential issues in your credit reports. High-severity items are actionable items that should be addressed first.',
  },
  {
    title: 'Dispute Letters',
    icon: 'Mail',
    path: '/dispute-letters',
    description: 'Generate formal dispute letters to credit bureaus (Experian, Equifax, TransUnion) under the FCRA. Supports three letter types: Dispute, Revocation of Authorization, and Validation Request.',
    usage: 'Select a letter type, fill in your name and address, then click "Generate Letter". You can copy the text to clipboard or download as .txt or .docx. Use the bureau tabs to toggle between letters for each bureau.',
  },
  {
    title: 'Dispute Tracker',
    icon: 'Gavel',
    path: '/disputes',
    description: 'Track the status of your filed disputes. Statuses include Not Filed, Filed, In Dispute, Resolved, and Closed.',
    usage: 'Create a new dispute record by providing the bureau, creditor name, account number, and reason. Update the status as the dispute progresses.',
  },
  {
    title: 'FICO Scores',
    icon: 'Activity',
    path: '/fico-scores',
    description: 'View and manually update your FICO scores for each bureau. Scores are color-coded: Poor (<580), Fair (580-669), Good (670-739), Very Good (740-799), Exceptional (800+).',
    usage: 'Scores are populated from your uploaded reports. You can manually edit a score by clicking the pencil icon next to it.',
  },
  {
    title: 'Score Simulator',
    icon: 'TrendingUp',
    path: '/score-simulator',
    description: 'Simulate how different actions could impact your credit score — such as paying down balances, removing derogatory items, or closing accounts.',
    usage: 'The simulator analyzes your current data and estimates potential score improvements for each action. Use this to prioritize which credit repair steps to take.',
  },
  {
    title: 'Export Center',
    icon: 'Download',
    path: '/export',
    description: 'Export your credit report data in JSON format for external use or backup.',
    usage: 'Click "Export as JSON" to download a file containing all your credit report data. Future export formats may include spreadsheet and PDF.',
  },
  {
    title: 'Settings',
    icon: 'User',
    path: '/settings',
    description: 'Update your account settings including email address and password.',
    usage: 'Enter your current email and new email to update your email address. Use the Change Password section to set a new password (minimum 6 characters).',
  },
]

export default function HelpPage() {
  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/" className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <h1 className="text-xl font-bold text-gray-900 dark:text-white">Help Guide</h1>
      </div>

      <p className="text-gray-600 dark:text-gray-400 text-sm">
        This guide explains every section of the sidebar and how to use each feature.
      </p>

      <div className="space-y-4">
        {sections.map((section) => (
          <Card key={section.path}>
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <Link href={section.path} className="text-blue-600 dark:text-blue-400 hover:underline">
                  {section.title}
                </Link>
                <span className="text-xs text-gray-400 font-mono">{section.path}</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <p className="text-gray-700 dark:text-gray-300">{section.description}</p>
              <div className="bg-gray-50 dark:bg-gray-800 rounded-md p-3">
                <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1">How to use</p>
                <p className="text-gray-600 dark:text-gray-400">{section.usage}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}
