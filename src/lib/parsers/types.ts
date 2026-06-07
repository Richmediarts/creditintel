import type { Bureau, BureauReport } from '@/types'

export interface ParserResult {
  success: boolean
  bureau: Bureau | null
  data?: BureauReport
  error?: string
  warnings?: string[]
}
