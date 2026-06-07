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
  let fullText = ''

  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i)
    const content = await page.getTextContent()
    const pageText = content.items.map((item) => {
      if ('str' in item) return (item as { str: string }).str
      return ''
    }).join(' ')
    fullText += pageText + '\n'
  }

  return fullText
}
