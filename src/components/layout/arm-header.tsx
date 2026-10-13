import type { ReactNode } from 'react'

/**
 * The copy register each arm's landing speaks in (CLAUDE.md, "Copy register").
 * Gadfly is aphoristic everywhere and Lever on its landing only, which is the
 * only place an intro is passed; Mirror is convivial-plain; Oracle, Scout and
 * Votes are plain-instructional. The intro takes its arm's register, so a
 * landing never mixes two voices.
 */
export type ArmRegister = 'aphoristic' | 'convivial-plain' | 'plain-instructional'

export const ARM_REGISTER: Record<string, ArmRegister> = {
  scout: 'plain-instructional',
  oracle: 'plain-instructional',
  gadfly: 'aphoristic',
  lever: 'aphoristic',
  mirror: 'convivial-plain',
  votes: 'plain-instructional',
}

const INTRO_BASE = 'mt-4 text-sm leading-relaxed text-text-secondary'

interface ArmHeaderProps {
  arm: string
  title: string
  subtitle: string
  action?: React.ReactNode
  /** What the arm is for, in one or two sentences, set in the arm's register
   *  (app-arms P1-5). Every landing gets the same slot: inside the header,
   *  under the title row, before the rule. */
  intro?: ReactNode
}

export function ArmHeader({ arm, title, subtitle, action, intro }: ArmHeaderProps) {
  const register = ARM_REGISTER[arm] ?? 'plain-instructional'
  return (
    <div>
      <div className={action ? 'flex items-start justify-between' : undefined}>
        <div>
          {/* Accent bar */}
          <div
            style={{
              width: 48,
              height: 3,
              borderRadius: 2,
              marginBottom: 8,
              backgroundColor: `color-mix(in srgb, var(--accent-${arm}) 60%, transparent)`,
            }}
          />
          <h1
            className="font-display text-2xl font-bold text-text-primary"
          >
            {title}
          </h1>
          <p
            className="font-serif italic text-sm text-text-muted mt-0.5"
          >
            {subtitle}
          </p>
        </div>
        {action && (
          <div className="flex-shrink-0 mt-1">
            {action}
          </div>
        )}
      </div>
      {intro && (
        <p
          data-arm-intro
          data-register={register}
          className={register === 'aphoristic' ? `${INTRO_BASE} font-serif italic` : INTRO_BASE}
        >
          {intro}
        </p>
      )}
      <div
        className="mt-6 mb-8 h-px"
        style={{ backgroundColor: 'var(--border-strong)' }}
      />
    </div>
  )
}
