import { parseTransUnion } from './transunionParser'
import { parseExperian } from './experianParser'
import { parseEquifax } from './equifaxParser'
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
  switch (bureau) {
    case 'TransUnion': {
      const result = parseTransUnion(text)
      return { ...result, filename: undefined } as BureauReport
    }
    case 'Experian': {
      const result = parseExperian(text)
      return { ...result, filename: undefined } as BureauReport
    }
    case 'Equifax': {
      const result = parseEquifax(text)
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

    if (isPDF) {
      try {
        const { extractTextFromPDF } = await import('@/lib/pdfExtractor')
        text = await extractTextFromPDF(file)
      } catch (e) {
        return { success: false, bureau: null, error: `Failed to parse PDF: ${e}` }
      }
    } else {
      text = await file.text()
    }

    const bureau = detectBureau(file.name, text)
    if (!bureau) {
      return { success: false, bureau: null, error: 'Could not detect credit bureau from filename or content' }
    }

    const data = parseReport(text, bureau)
    data.fileData = fileData
    data.fileType = isPDF ? 'pdf' : 'txt'
    return { success: true, bureau, data }
  } catch (e: unknown) {
    return { success: false, bureau: null, error: e instanceof Error ? e.message : 'Unknown parse error' }
  }
}
