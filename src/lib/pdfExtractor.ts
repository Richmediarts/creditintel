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
  const pages: string[] = []

  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i)
    const content = await page.getTextContent()

    const items: Array<{ str: string; x: number; y: number; width: number }> = []
    for (const item of content.items) {
      const obj = item as Record<string, unknown>
      if (typeof obj.str === 'string' && Array.isArray(obj.transform) && typeof obj.width === 'number') {
        items.push({
          str: obj.str,
          x: obj.transform[4] as number,
          y: obj.transform[5] as number,
          width: obj.width,
        })
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
            parts.push(curr.str)
          } else {
            parts[parts.length - 1] += curr.str
          }
        }
        return parts.join(' ')
      })
      .join('\n')

    pages.push(pageText)
  }

  return pages.join('\n')
}
