import React from 'react'

interface ProgressProps {
  value: number
  max?: number
  variant?: 'default' | 'success' | 'warning' | 'danger'
  className?: string
  showLabel?: boolean
}

export function Progress({ value, max = 100, variant = 'default', className = '', showLabel = false }: ProgressProps) {
  const pct = Math.min(100, Math.max(0, (value / max) * 100))
  const colors = {
    default: 'bg-blue-500',
    success: 'bg-green-500',
    warning: 'bg-yellow-500',
    danger: 'bg-red-500',
  }

  return (
    <div className={`w-full ${className}`}>
      <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2.5 overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-300 ${colors[variant]}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      {showLabel && (
        <span className="text-xs text-gray-500 dark:text-gray-400 mt-1 block text-right">
          {pct.toFixed(0)}%
        </span>
      )}
    </div>
  )
}
