/** Copy only after a user action; return false when manual selection is needed. */
export async function copyText(text: string): Promise<boolean> {
  try {
    if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text)
      return true
    }
  } catch { /* Permission restrictions can still allow the selection-based fallback. */ }
  if (typeof document === 'undefined' || typeof document.execCommand !== 'function') return false
  const previous = document.activeElement as HTMLElement | null
  const field = document.createElement('textarea')
  field.value = text
  field.readOnly = true
  field.setAttribute('aria-hidden', 'true')
  Object.assign(field.style, { position: 'fixed', left: '-9999px', top: '0' })
  try {
    document.body.appendChild(field)
    field.focus()
    field.select()
    field.setSelectionRange(0, text.length)
    return document.execCommand('copy') === true
  } catch { return false }
  finally {
    field.remove()
    previous?.focus?.({ preventScroll: true })
  }
}
