import { parseTransUnion } from './transunionParser'
import { parseExperian } from './experianParser'
import { parseEquifax } from './equifaxParser'
import { parseGeneric } from './genericParser'
import type { Bureau, BureauReport } from '@/types'

export interface ParseResult {
  success: boolean
  bureau: Bureau | null
  data?: BureauReport
  error?: string
}

export function detectBureau(filename: string, text?: string): Bureau | null {
  const name = filename.toLowerCase()
  if (name.includes('transunion') || name.includes('trans union') || name.includes('tu')) return 'TransUnion'
  if (name.includes('experian')) return 'Experian'
  if (name.includes('equifax')) return 'Equifax'
  if (text) {
    if (text.includes('TransUnion') || text.includes('transunion.com')) return 'TransUnion'
    if (text.includes('Experian') || text.includes('experian.com')) return 'Experian'
    if (text.includes('Equifax') || text.includes('equifax.com')) return 'Equifax'
  }
  return null
}

export function parseReport(text: string, bureau: Bureau): BureauReport {
  const tryParsers = (parsers: Array<(text: string, bureau: Bureau) => Omit<BureauReport, 'filename'>>):
    Omit<BureauReport, 'filename'> => {
    for (const parseFn of parsers) {
      const result = parseFn(text, bureau)
      if ((result.accounts?.length ?? 0) > 0) {
        return result
      }
    }
    return parsers[parsers.length - 1](text, bureau)
  }

  switch (bureau) {
    case 'TransUnion': {
      const result = tryParsers([
        (t) => parseTransUnion(t),
        (t, b) => parseGeneric(t, b),
      ])
      return { ...result, filename: undefined } as BureauReport
    }
    case 'Experian': {
      const result = tryParsers([
        (t) => parseExperian(t),
        (t, b) => parseGeneric(t, b),
      ])
      return { ...result, filename: undefined } as BureauReport
    }
    case 'Equifax': {
      const result = tryParsers([
        (t) => parseEquifax(t),
        (t, b) => parseGeneric(t, b),
      ])
      return { ...result, filename: undefined } as BureauReport
    }
    default:
      throw new Error(`Unknown bureau: ${bureau}`)
  }
}

function readFileAsBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const result = reader.result as string
      const base64 = result.split(',')[1]
      resolve(base64)
    }
    reader.onerror = () => reject(new Error('Failed to read file'))
    reader.readAsDataURL(file)
  })
}

export async function parseFile(file: File): Promise<ParseResult> {
  try {
    const isPDF = file.type === 'application/pdf' || file.name.endsWith('.pdf')
    const fileData = await readFileAsBase64(file)
    let text: string
    let rawText: string

    if (isPDF) {
      try {
        const { extractTextFromPDF } = await import('@/lib/pdfExtractor')
        const extracted = await extractTextFromPDF(file)
        text = extracted.positionGrouped
        rawText = extracted.rawConcat
      } catch (e) {
        return { success: false, bureau: null, error: `Failed to parse PDF: ${e}` }
      }
    } else {
      text = await file.text()
      rawText = text
    }

    const bureau = detectBureau(file.name, text)
    if (!bureau) {
      return { success: false, bureau: null, error: 'Could not detect credit bureau from filename or content' }
    }

    let data = parseReport(text, bureau)
    if (data.accounts.length === 0 && rawText !== text) {
      data = parseReport(rawText, bureau)
    }

    data.fileData = fileData
    data.fileType = isPDF ? 'pdf' : 'txt'
    return { success: true, bureau, data }
  } catch (e: unknown) {
    return { success: false, bureau: null, error: e instanceof Error ? e.message : 'Unknown parse error' }
  }
}
