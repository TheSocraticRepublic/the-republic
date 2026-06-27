interface ArmHeaderProps {
  arm: string
  title: string
  subtitle: string
  action?: React.ReactNode
}

export function ArmHeader({ arm, title, subtitle, action }: ArmHeaderProps) {
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
      <div
        className="mt-6 mb-8 h-px"
        style={{ backgroundColor: 'var(--border-strong)' }}
      />
    </div>
  )
}
