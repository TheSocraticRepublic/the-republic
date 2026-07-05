'use client'

import Link from 'next/link'
import { type LucideIcon } from 'lucide-react'

export interface CrossArmAction {
  label: string
  href: string
  color: string
  icon: LucideIcon
}

interface CrossArmActionsProps {
  actions: CrossArmAction[]
}

export function CrossArmActions({ actions }: CrossArmActionsProps) {
  if (actions.length === 0) return null

  return (
    <div className="flex flex-wrap items-center gap-3">
      {actions.map((action) => {
        const Icon = action.icon
        // color-mix works with both hex and CSS custom properties (var(--accent-*)),
        // unlike the manual hex-parsing this replaced — that broke silently once
        // every caller migrated to token-based colors (NaN channels -> invalid rgba()).
        const borderTint = `color-mix(in srgb, ${action.color} 30%, transparent)`
        const hoverTint = `color-mix(in srgb, ${action.color} 8%, transparent)`

        return (
          <Link
            key={action.href}
            href={action.href}
            className="inline-flex items-center gap-2 rounded-lg border px-4 py-2 text-sm font-medium transition-colors duration-150"
            style={{
              borderColor: borderTint,
              color: action.color,
              backgroundColor: 'transparent',
            }}
            onMouseEnter={(e) => {
              ;(e.currentTarget as HTMLAnchorElement).style.backgroundColor = hoverTint
            }}
            onMouseLeave={(e) => {
              ;(e.currentTarget as HTMLAnchorElement).style.backgroundColor = 'transparent'
            }}
          >
            <Icon size={13} strokeWidth={2} />
            {action.label}
          </Link>
        )
      })}
    </div>
  )
}
