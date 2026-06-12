import { Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType } from 'docx'
import type { Bureau, DisputeItem, BureauReport } from '@/types'

interface LetterContent {
  subject: string
  body: string
  citations: string[]
}

export function generateCRADisputeLetter(
  bureau: Bureau,
  disputeItems: DisputeItem[],
  consumerName: string,
  consumerAddress: string
): LetterContent {
  const bureauItems = disputeItems.filter(item => item.bureau === bureau)
  const itemsList = bureauItems.map((item, i) =>
    `${i + 1}. ${item.creditorName} - ${item.reasons.join(', ')}`
  ).join('\n')

  return {
    subject: `Formal Dispute of Credit Report Information - FCRA §611(a) - ${bureau}`,
    body: `To the ${bureau} Consumer Dispute Department:

I am writing to formally dispute the following items on my ${bureau} credit report pursuant to the Fair Credit Reporting Act (FCRA) §611(a)(1)(A). These items are inaccurate, incomplete, or unverifiable.

Pursuant to FCRA §604, the burden of proof rests with the furnisher to demonstrate permissible purpose and accuracy of reporting. Additionally, FCRA §623(b) requires furnishers to investigate and correct inaccurate information upon notice of dispute.

The following items are disputed:

${itemsList}

${bureauItems.length === 0 ? 'N/A - Review attached findings.' : ''}

FORENSIC INACCURACIES IDENTIFIED:
${bureauItems.map(item =>
  `- ${item.creditorName}: ${item.reasons.join('; ')}`
).join('\n')}

I have previously provided Revocation of Authorization and a Validation Request, neither of which have been satisfied. Therefore, I demand:

1. DELETION of all disputed items within 30 days as required by FCRA §611(a)
2. OR tangible, verifiable proof of the accuracy and completeness of each item

Failure to comply will result in escalation to:
- Consumer Financial Protection Bureau (CFPB)
- Federal Trade Commission (FTC)
- State Attorney General

This dispute is being sent via Certified Mail Return Receipt Requested.

Sincerely,
${consumerName}
${consumerAddress}`,
    citations: ['FCRA §604', 'FCRA §611(a)', 'FCRA §623(b)', 'Cushman v. TransUnion'],
  }
}

export function generateRevocationLetter(
  bureau: Bureau,
  creditorName: string,
  consumerName: string,
  consumerAddress: string
): LetterContent {
  return {
    subject: `Revocation of Authorization to Furnish or Access Credit Information - ${creditorName}`,
    body: `To the Compliance Officer:

This letter serves as formal REVOCATION of any prior authorization to furnish, access, or otherwise process my credit information with any credit reporting agency, including ${bureau}.

My account with ${creditorName} is closed and I have no ongoing business relationship. Therefore:

1. Any further reporting of my information violates FCRA §623(a)
2. Any access to my credit file violates FCRA §604
3. Per Cushman v. TransUnion, continued reporting without permissible purpose constitutes a willful violation of the FCRA

I demand:
1. IMMEDIATE CESSATION of all credit reporting activities
2. Notification to all credit bureaus of this revocation
3. Proof of compliance within 30 days

Failure to comply will result in legal action under FCRA §§616-617.

Sincerely,
${consumerName}
${consumerAddress}`,
    citations: ['FCRA §604', 'FCRA §623(a)', 'Cushman v. TransUnion', 'Metro 2 Guidelines'],
  }
}

export function generateValidationRequest(
  bureau: Bureau,
  creditorName: string,
  consumerName: string,
  consumerAddress: string
): LetterContent {
  return {
    subject: `Debt Validation Request - ${creditorName}`,
    body: `To Whom It May Concern:

This is a formal request for validation of the alleged debt referenced on my ${bureau} credit report under ${creditorName}.

Please be advised that a Revocation of Authorization was previously sent. No satisfactory response was received.

Pursuant to FCRA §623(a) and §§616-617, I request the following documentation:

1. Original signed contract or agreement
2. Complete billing ledger from inception to present
3. Proof of ownership/chain of title (if sold/assigned)
4. Metro 2 furnishing agreement
5. Proof of permissible purpose under FCRA §604 to report or access my information
6. Date of first delinquency and charge-off date

Per Cushman v. TransUnion, failure to provide permissible purpose documentation constitutes a willful violation.

I require validation within 30 days. Failure to provide tangible verification will result in a demand for deletion and escalation to the CFPB, FTC, and State Attorney General.

Sincerely,
${consumerName}
${consumerAddress}`,
    citations: ['FCRA §604', 'FCRA §623(a)', 'FCRA §§616-617', 'Cushman v. TransUnion'],
  }
}

export function generateCombinedDisputeLetter(
  reports: BureauReport[],
  disputeItems: DisputeItem[],
  consumerName: string,
  consumerAddress: string
): string {
  const bureaus = [...new Set(disputeItems.map(d => d.bureau))]

  let letter = `CREDIT DISPUTE AND DELETION DEMAND\n`
  letter += `Consumer: ${consumerName}\n`
  letter += `Address: ${consumerAddress}\n`
  letter += `Date: ${new Date().toLocaleDateString()}\n\n`
  letter += `TO THE COMPLIANCE DEPARTMENTS:\n\n`

  for (const bureau of bureaus) {
    const letterContent = generateCRADisputeLetter(bureau, disputeItems, consumerName, consumerAddress)
    letter += `--- ${bureau} ---\n`
    letter += `${letterContent.body}\n\n`
  }

  letter += `\nESCALATION NOTICE:\n`
  letter += `This dispute is sent pursuant to FCRA §611(a). Failure to comply within 30 days will result in:\n`
  letter += `- CFPB Complaint (consumerfinance.gov)\n`
  letter += `- FTC Complaint (ftc.gov)\n`
  letter += `- State Attorney General Complaint\n`
  letter += `- Legal action under FCRA §§616-617 (statutory damages $1,000 per violation)\n`

  return letter
}

const FONT = 'Times New Roman'
const FONT_SIZE = 22

type HeadingValue = (typeof HeadingLevel)[keyof typeof HeadingLevel]
type AlignValue = (typeof AlignmentType)[keyof typeof AlignmentType]

function heading(text: string, level: HeadingValue = HeadingLevel.HEADING_1, align: AlignValue = AlignmentType.CENTER) {
  const sizes: Record<string, number> = {
    [HeadingLevel.HEADING_1]: 52,
    [HeadingLevel.HEADING_2]: 44,
    [HeadingLevel.HEADING_3]: 28,
  }
  const size = sizes[level] || 22
  return new Paragraph({
    heading: level,
    alignment: align,
    spacing: { before: 240, after: 120 },
    children: [new TextRun({ text, font: FONT, size, bold: true })],
  })
}

function body(text: string, opts: { bold?: boolean; indent?: number; spacing?: { before?: number; after?: number } } = {}) {
  return new Paragraph({
    alignment: AlignmentType.JUSTIFIED,
    spacing: { before: opts.spacing?.before ?? 0, after: opts.spacing?.after ?? 120 },
    indent: opts.indent ? { left: opts.indent } : undefined,
    children: [new TextRun({ text, font: FONT, size: FONT_SIZE, bold: opts.bold })],
  })
}

function bullet(text: string, level: number = 0) {
  return new Paragraph({
    bullet: { level },
    spacing: { before: 60, after: 60 },
    children: [new TextRun({ text, font: FONT, size: FONT_SIZE })],
  })
}

function line(text: string) {
  return new Paragraph({
    spacing: { before: 0, after: 0 },
    children: [new TextRun({ text, font: FONT, size: FONT_SIZE })],
  })
}

export async function letterTextToDocx(letterText: string): Promise<Blob> {
  const lines = letterText.split('\n')
  const children: Paragraph[] = []

  for (const raw of lines) {
    const t = raw.trim()
    if (!t && children.length === 0) continue
    if (!t) { children.push(new Paragraph({ spacing: { before: 240, after: 0 }, children: [] })); continue }

    // Title line (all caps, first line)
    if (children.length === 0 || t === t.toUpperCase() && t.length > 5) {
      const isShortHeader = t.length < 60
      if (isShortHeader) {
        children.push(heading(t, children.length < 3 ? HeadingLevel.HEADING_1 : HeadingLevel.HEADING_2,
          children.length < 3 ? AlignmentType.CENTER : AlignmentType.LEFT))
        continue
      }
    }

    // Section header like "--- Experian ---"
    if (t.startsWith('---')) {
      children.push(heading(t.replace(/---/g, '').trim(), HeadingLevel.HEADING_2, AlignmentType.LEFT))
      continue
    }

    // Numbered list item
    if (t.match(/^\d+\.\s/)) {
      children.push(new Paragraph({
        numbering: { reference: 'numbered-list', level: 0 },
        spacing: { before: 60, after: 60 },
        children: [new TextRun({ text: t.replace(/^\d+\.\s*/, ''), font: FONT, size: FONT_SIZE })],
      }))
      continue
    }

    // Bullet item
    if (t.startsWith('- ') || t.startsWith('-')) {
      children.push(bullet(t.replace(/^-\s*/, '')))
      continue
    }

    // Bold header lines (all caps, short)
    if (t === t.toUpperCase() && t.length > 3 && t.length < 60) {
      children.push(body(t, { bold: true, spacing: { before: 200, after: 80 } }))
      continue
    }

    // Consumer info lines
    if (t.startsWith('Consumer:') || t.startsWith('Address:') || t.startsWith('Date:')) {
      children.push(body(t, { spacing: { before: 40, after: 40 } }))
      continue
    }

    // Default body text
    children.push(body(t))
  }

  const doc = new Document({
    styles: {
      default: {
        document: { run: { font: FONT, size: FONT_SIZE } },
      },
    },
    numbering: {
      config: [{
        reference: 'numbered-list',
        levels: [{ level: 0, format: 'decimal', text: '%1.', alignment: 'left' }],
      }],
    },
    sections: [{ children }],
  })

  return await Packer.toBlob(doc)
}
