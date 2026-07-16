interface StatusPillProps {
  label: string
  /** Text/dot color — pass a token reference, e.g. `var(--accent-mirror)`. */
  color: string
  /** Background — pass a token-derived value, e.g.
   *  `color-mix(in srgb, var(--accent-mirror) 10%, transparent)`. */
  bg: string
  /** `pill` = fully rounded (investigation status); `tag` = rounded-md
   *  (action/document type + status badges). Purely presentational — callers
   *  own the label/color mapping. */
  variant?: 'pill' | 'tag'
  /** Renders a small animated dot before the label (e.g. "Generating…"). */
  pulse?: boolean
  ariaLabel?: string
}

export function StatusPill({
  label,
  color,
  bg,
  variant = 'tag',
  pulse,
  ariaLabel,
}: StatusPillProps) {
  const shape = variant === 'pill' ? 'rounded-full' : 'rounded-md'

  return (
    <span
      className={`inline-flex items-center ${shape} px-2 py-0.5 text-2xs font-medium`}
      style={{ backgroundColor: bg, color }}
      aria-label={ariaLabel}
    >
      {pulse && (
        <span
          className="mr-1 inline-block h-1.5 w-1.5 rounded-full bg-current animate-pulse"
          aria-hidden="true"
        />
      )}
      {label}
    </span>
  )
}
