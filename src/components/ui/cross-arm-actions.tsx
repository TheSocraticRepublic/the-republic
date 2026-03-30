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
        // Parse hex to RGB for inline style (avoid Tailwind dynamic class purging)
        const hex = action.color.replace('#', '')
        const r = parseInt(hex.slice(0, 2), 16)
        const g = parseInt(hex.slice(2, 4), 16)
        const b = parseInt(hex.slice(4, 6), 16)
        const rgb = `${r}, ${g}, ${b}`

        return (
          <Link
            key={action.href}
            href={action.href}
            className="inline-flex items-center gap-2 rounded-lg border px-4 py-2 text-sm font-medium transition-colors duration-150"
            style={{
              borderColor: `rgba(${rgb}, 0.30)`,
              color: action.color,
              backgroundColor: 'transparent',
            }}
            onMouseEnter={(e) => {
              ;(e.currentTarget as HTMLAnchorElement).style.backgroundColor = `rgba(${rgb}, 0.08)`
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
