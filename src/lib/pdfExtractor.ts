export interface ExtractedText {
  positionGrouped: string
  rawConcat: string
}

async function loadPdf(file: File): Promise<any> {
  const arrayBuffer = await file.arrayBuffer()
  const pdfjsLib = await import('pdfjs-dist')

  const workerUrl = new URL(
    'pdfjs-dist/build/pdf.worker.min.mjs',
    import.meta.url
  )
  pdfjsLib.GlobalWorkerOptions.workerSrc = workerUrl.toString()

  const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer })
  return await loadingTask.promise
}

// Detect pdfjs text extraction artifacts that corrupt values, e.g. doubled
// glyphs ("SSaallaarryy", "6644", "33,,770099..2244") or merged columns
// ("4,636.5475.00"). Such text cannot be parsed reliably, so callers fall
// back to OCR which reads the rendered page instead.
function looksMangled(text: string): boolean {
  const tokens = text.split(/\s+/)
  let doubledCount = 0
  for (const t of tokens) {
    if (t.length >= 4 && t.length % 2 === 0 && t.replace(/(.)\1/g, '').length === 0) doubledCount++
    if (/\d[\d,]*\.\d{2}[\d,]*\.\d{2}/.test(t)) return true
  }
  return doubledCount >= 2
}

export async function extractPdfText(file: File): Promise<string> {
  const pdf = await loadPdf(file)
  try {
    const nativeText = await extractNative(pdf)
    if (nativeText.replace(/\s+/g, '').trim().length > 80) {
      if (looksMangled(nativeText)) {
        // pdfjs mangled the earnings table but native still has the clean
        // header/summary (which OCR often misses), so combine both.
        const ocr = (await extractWithOCR(pdf)).rawConcat
        // OCR sometimes drops the direct-deposit rows (e.g. the PNC line),
        // so tack the native payment section back on as well.
        return nativeHeaderAndSummary(nativeText) + '\n' + ocr + '\n' + nativeDirectDeposit(nativeText)
      }
      return nativeText
    }
  } catch {
    // Native failed, fall through to OCR
  }
  return (await extractWithOCR(pdf)).rawConcat
}

// Grabs the clean top-of-page header (company/employee/dates) plus the
// Current/YTD summary rows from the native extraction, including the net-pay
// value when pdfjs splits it onto its own line.
function nativeHeaderAndSummary(native: string): string {
  const lines = native.split('\n')
  const out: string[] = []
  let gotCurrent = false
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    const lower = line.toLowerCase()
    const money = line.match(/([\d,]+\.\d{2})/g)
    if (!gotCurrent && /^\s*current\b/i.test(lower) && money && money.length >= 5) {
      gotCurrent = true
      out.push(line)
      const next = lines[i + 1]
      if (next && /^\s*[\d,.]+/.test(next) && (next.match(/([\d,]+\.\d{2})/g) || []).length === 1) {
        out.push(next)
        i++
      }
      continue
    }
    if (gotCurrent && /^\s*ytd\b/i.test(lower) && money && money.length >= 5) {
      out.push(line)
      const next = lines[i + 1]
      if (next && /^\s*[\d,.]+/.test(next) && (next.match(/([\d,]+\.\d{2})/g) || []).length === 1) {
        out.push(next)
        i++
      }
      break
    }
    if (!gotCurrent) out.push(line)
  }
  return out.join('\n')
}

// Returns the direct-deposit / payment-information block from the native
// extraction (the "Direct Deposit"/"Payment Information" header through the
// end of the text). OCR frequently misses these rows, so callers append them
// to the merged text; the parser de-duplicates doubled glyphs it may contain.
function nativeDirectDeposit(native: string): string {
  const lines = native.split('\n')
  const start = lines.findIndex((l) => /direct deposit|payment information/i.test(l))
  if (start < 0) return ''
  return lines.slice(start).join('\n')
}

export async function extractTextFromPDF(file: File): Promise<ExtractedText> {
  const pdf = await loadPdf(file)

  // Try native text extraction first (fast path)
  try {
    const nativeText = await extractNative(pdf)
    const cleaned = nativeText.replace(/\s+/g, ' ').trim()

    // Only use native if it has clear credit report content
    if (cleaned.length > 100 && hasGoodContent(cleaned)) {
      return { positionGrouped: nativeText, rawConcat: nativeText }
    }
  } catch {
    // Native failed, fall through to OCR
  }

  // OCR fallback: render each page at 3x and run tesseract
  return extractWithOCR(pdf)
}

async function extractNative(pdf: any): Promise<string> {
  const LINE_THRESHOLD = 8
  const SPACE_THRESHOLD = 2
  const textPages: string[] = []

  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i)
    const content = await page.getTextContent()

    const items: Array<{ str: string; x: number; y: number; width: number }> = []
    for (const item of content.items) {
      const obj = item as Record<string, unknown>
      if (typeof obj.str === 'string' && Array.isArray(obj.transform) && typeof obj.width === 'number') {
        items.push({ str: obj.str, x: obj.transform[4] as number, y: obj.transform[5] as number, width: obj.width })
      }
    }
    if (items.length === 0) continue

    items.sort((a, b) => b.y - a.y)

    const lines: Array<{ str: string; x: number; y: number; width: number }[]> = []
    let currentLine: { str: string; x: number; y: number; width: number }[] = [items[0]]

    for (let j = 1; j < items.length; j++) {
      const lastY = currentLine[currentLine.length - 1].y
      if (Math.abs(items[j].y - lastY) < LINE_THRESHOLD) {
        currentLine.push(items[j])
      } else {
        currentLine.sort((a, b) => a.x - b.x)
        lines.push(currentLine)
        currentLine = [items[j]]
      }
    }
    currentLine.sort((a, b) => a.x - b.x)
    lines.push(currentLine)

    const pageText = lines
      .map(line => {
        const parts: string[] = [line[0].str]
        for (let k = 1; k < line.length; k++) {
          const prev = line[k - 1]
          const curr = line[k]
          const gap = curr.x - (prev.x + prev.width)
          if (gap > SPACE_THRESHOLD) {
            const spaceCount = Math.round(gap / 5)
            parts.push(' '.repeat(Math.min(spaceCount, 3)) + curr.str)
          } else {
            parts.push(curr.str)
          }
        }
        return parts.join('')
      })
      .join('\n')

    textPages.push(pageText)
  }

  return textPages.join('\n')
}

function hasGoodContent(text: string): boolean {
  const hasDollar = /\$\s*[\d,]+\.?\d{0,2}/.test(text)
  const hasDate = /\b\d{1,2}\/\d{1,2}\/\d{4}\b/.test(text)
  const hasCreditTerms = /\b(?:account|balance|credit|payment|status|inquiry)\b/i.test(text)
  const hasBureau = /\b(?:equifax|transunion|experian)\b/i.test(text)

  const words = text.split(/\s+/).filter(Boolean)
  const good = words.filter(w => /^[A-Za-z]{2,}$/.test(w) || /^\d+$/.test(w) || /^\$[\d,]+/.test(w))
  const ratio = words.length > 0 ? good.length / words.length : 0

  // Require BOTH credit indicators AND high word quality
  return (hasDollar || hasDate || hasCreditTerms || hasBureau) && ratio > 0.5
}

async function extractWithOCR(pdf: any): Promise<ExtractedText> {
  const Tesseract = await import('tesseract.js')
  const pages: string[] = []

  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i)
    const viewport = page.getViewport({ scale: 3 })
    const canvas = document.createElement('canvas')
    canvas.width = viewport.width
    canvas.height = viewport.height
    const ctx = canvas.getContext('2d')!

    await page.render({ canvasContext: ctx, viewport }).promise

    const { data } = await Tesseract.recognize(canvas, 'eng', {
      logger: () => {},
    })
    pages.push(data.text)
  }

  const text = pages.join('\n')
  return { positionGrouped: text, rawConcat: text }
}
