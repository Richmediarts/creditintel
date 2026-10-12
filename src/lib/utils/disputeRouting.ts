import type { Bureau, LetterType } from '@/types'

export type DisputeMethod = 'online' | 'mail'

export interface RoutingVerdict {
  method: DisputeMethod
  requiresMail: boolean
  reasons: string[]
  rules: string[]
  /** The bureau's own online dispute portal — this is the FCRA §611(a)(1) channel. */
  portalUrl: string
  portalLabel: string
  /** The CFPB complaint portal — routes a complaint to the bureau and creates a paper trail. */
  cfpbUrl: string
  /** Secondary route: file with the CFPB as the regulator monitoring the bureau. */
  ftcUrl?: string
}

/**
 * Inaccuracies that are accepted through an online dispute portal with no
 * supporting documents required.
 */
const ONLINE_OK = new Set([
  'balance',
  'late_payment',
  'duplicate',
  'obsolete',
  'not_my_account',
  'missing_payment',
])

/**
 * Inaccuracies that trigger FCRA §611(a)(2) or similar, which the bureaus
 * generally will NOT process as a simple online form. These need an identity
 * packet and, in practice, a physical mailing address on file that matches a
 * government ID.
 */
const MAIL_REQUIRED = new Set([
  'identity_theft',
])

/** Inaccuracies the bureaus can escalate to a federal regulator on your behalf. */
const CFPB_ELIGIBLE = new Set([
  'identity_theft',
  'fcra_violation',
  'not_my_account',
])

const PORTALS: Record<Bureau, { url: string; label: string }> = {
  Experian: {
    url: 'https://www.experian.com/disputes/main.html',
    label: 'Experian Online Dispute Center',
  },
  Equifax: {
    url: 'https://www.equifax.com/personal/credit-report-services/credit-dispute/',
    label: 'Equifax Online Dispute Center',
  },
  TransUnion: {
    url: 'https://dispute.transunion.com/',
    label: 'TransUnion Online Dispute Center',
  },
}

const CFPB_COMPLAINT = 'https://www.consumerfinance.gov/complaint/'

/**
 * Decide how a dispute should be filed.
 *
 * Rules, in order of precedence:
 *  1. Identity theft under FCRA §611(a)(2) always requires mail. The bureau must
 *     validate the identity packet, and the FTC/CFPB will not accept an
 *     abbreviated online form for a §611(a)(2) block request.
 *  2. A Revocation of Authorization must be mailed — it terminates a business
 *     relationship, and the bureaus do not accept that revocation through a
 *     portal form.
 *  3. Everything else the bureaus accept can be filed online.
 */
export function routeDispute(
  bureau: Bureau,
  inaccuracies: string[],
  letterType: LetterType = 'dispute'
): RoutingVerdict {
  const reasons: string[] = []
  const rules: string[] = []
  let requiresMail = false

  const hasIdentityTheft = inaccuracies.some(i => MAIL_REQUIRED.has(i))
  const isRevocation = letterType === 'revocation'
  const cfpbEligible = inaccuracies.some(i => CFPB_ELIGIBLE.has(i))

  if (hasIdentityTheft) {
    requiresMail = true
    reasons.push(
      'Identity theft (FCRA §611(a)(2)) requires an identity packet: FTC Identity Theft Report, signed theft affidavit, and a copy of a government ID. The bureaus will not process a §611(a)(2) block through an online form.'
    )
    rules.push('FCRA §611(a)(2) — identity theft affidavit must be mailed with documentation')
  }

  if (isRevocation) {
    requiresMail = true
    reasons.push(
      'Revocation of Authorization must be delivered to the bureau\'s compliance officer by mail. It terminates your business relationship, and no online portal accepts it.'
    )
    rules.push('Cushman v. TransUnion — written revocation required to stop furnishing')
  }

  const unknown = inaccuracies.filter(i => !ONLINE_OK.has(i) && !MAIL_REQUIRED.has(i))
  if (unknown.length > 0) {
    reasons.push(
      `"${unknown.join(', ')}" is not a standard portal checkbox. The bureau may ask you to describe the issue in your own words, which most portals do support — submit online, then escalate to mail if they do not resolve it within 30 days.`
    )
    rules.push('FCRA §611(a)(1)(A) — consumer may dispute in writing or oral form')
  }

  if (!requiresMail) {
    const onlineOk = inaccuracies.filter(i => ONLINE_OK.has(i))
    if (onlineOk.length > 0) {
      reasons.push(
        `All flagged items (${onlineOk.join(', ')}) are accepted by the bureau's online dispute portal. File online and keep the confirmation number.`
      )
      rules.push('FCRA §611(a)(1)(A) — free online dispute is a valid written dispute')
      rules.push('FCRA §611(a)(2) — 30-day investigation clock starts when the bureau receives it')
      rules.push('FCRA §623(b) — bureau must send a written results notice you can review')
    }
  }

  const portal = PORTALS[bureau]
  return {
    method: requiresMail ? 'mail' : 'online',
    requiresMail,
    reasons,
    rules,
    portalUrl: portal.url,
    portalLabel: portal.label,
    cfpbUrl: CFPB_COMPLAINT,
    ftcUrl: hasIdentityTheft ? 'https://www.identitytheft.gov/#/Options' : undefined,
  }
}

/** Human-readable summary of why mail was required. */
export function mailFlagLabel(verdict: RoutingVerdict): string | null {
  if (!verdict.requiresMail) return null
  if (verdict.reasons.some(r => r.includes('Identity theft'))) {
    return 'PHYSICAL LETTER REQUIRED — Identity Theft (FCRA §611(a)(2))'
  }
  return 'PHYSICAL LETTER REQUIRED'
}
