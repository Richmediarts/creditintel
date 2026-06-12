const LINE_THRESHOLD = 5
const SPACE_THRESHOLD = 2

export async function extractTextFromPDF(file: File): Promise<string> {
  const arrayBuffer = await file.arrayBuffer()
  const pdfjsLib = await import('pdfjs-dist')

  const workerUrl = new URL(
    'pdfjs-dist/build/pdf.worker.min.mjs',
    import.meta.url
  )
  pdfjsLib.GlobalWorkerOptions.workerSrc = workerUrl.toString()

  const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer })
  const pdf = await loadingTask.promise

  // ── Step 1: Try native text extraction ──
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
          parts.push(gap > SPACE_THRESHOLD ? curr.str : parts.pop()! + curr.str)
        }
        return parts.join(' ')
      })
      .join('\n')

    textPages.push(pageText)
  }

  const fullText = textPages.join('\n')

  if (fullText.replace(/\s+/g, '').length > 50) {
    return fullText
  }

  // ── Step 2: OCR fallback for scanned/image PDFs ──
  const Tesseract = await import('tesseract.js')
  const ocrPages: string[] = []

  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i)
    const viewport = page.getViewport({ scale: 2 })
    const canvas = document.createElement('canvas')
    canvas.width = viewport.width
    canvas.height = viewport.height
    const ctx = canvas.getContext('2d')!

    await page.render({ canvasContext: ctx, viewport }).promise

    const { data } = await Tesseract.recognize(canvas, 'eng', {
      logger: () => {},
    })
    ocrPages.push(data.text)
  }

  return ocrPages.join('\n')
}
