'use client'

import React from 'react'
import { Printer } from 'lucide-react'
import { Badge } from '@/components/ui/badge'

export function PrintedBadge() {
  return (
    <Badge variant="success" className="inline-flex items-center gap-1 text-xs">
      <Printer className="w-3 h-3" /> Printed
    </Badge>
  )
}
