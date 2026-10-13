import { useId, type ReactNode } from 'react'
import { clsx } from 'clsx'

/*
 * Not a 'use client' module, on purpose: the server pages (Investigate) read
 * SECTION_LABEL_CLASS, and a client module's exports reach a server component
 * as client references, so the class string arrived as a function's source
 * (measured on the harness). Nothing here needs the client: `useId` runs in
 * either environment, and the client forms that render Field bundle it as
 * their own.
 */

/**
 * One label style and one field recipe for the app's forms (app-arms P2-12).
 *
 * - **Section label**: 12px, 600, uppercase, `tracking-widest`, muted. The
 *   heading over a group of fields or a list ("Comparison parameters",
 *   "Recent Activity").
 * - **Field label**: 12px, 500, `text-text-secondary`, with an optional
 *   `(optional)` parenthetical in `text-text-faint`.
 * - **Control**: `border-border-strong`, `bg-surface-1`, `text-text-primary`,
 *   faint placeholder, and the arm's accent at 40% on the focused border.
 * - **Description**: 12px muted, under the control, always referenced by the
 *   control's `aria-describedby`.
 * - **Error**: 12px danger, under the control; while it shows, the control is
 *   `aria-invalid` and described by it as well.
 *
 * The control's font size is `text-sm`, which the unlayered phone rule in
 * globals.css raises to 16px below 768px (B1); this recipe never sets an
 * inline font size, which would beat that rule.
 */

export const SECTION_LABEL_CLASS = 'text-xs font-semibold uppercase tracking-widest text-text-muted'

export const FIELD_LABEL_CLASS = 'mb-1.5 block text-xs font-medium text-text-secondary'

export const FIELD_DESCRIPTION_CLASS = 'mt-1.5 text-xs text-text-muted'

export const FIELD_ERROR_CLASS = 'mt-1.5 text-xs text-status-danger'

/** The arm whose accent marks the focused field; `neutral` strengthens the
 *  border instead. */
export type FieldArm = 'scout' | 'oracle' | 'gadfly' | 'lever' | 'mirror' | 'votes' | 'neutral'

// Literal strings, one per arm, so Tailwind's scanner sees every class.
const FOCUS_BORDER: Record<FieldArm, string> = {
  scout: 'focus:border-[var(--accent-scout)]/40',
  oracle: 'focus:border-[var(--accent-oracle)]/40',
  gadfly: 'focus:border-[var(--accent-gadfly)]/40',
  lever: 'focus:border-[var(--accent-lever)]/40',
  mirror: 'focus:border-[var(--accent-mirror)]/40',
  votes: 'focus:border-[var(--accent-votes)]/40',
  neutral: 'focus:border-text-faint',
}

/** The control recipe. `select` adds room for the chevron and drops the UA
 *  arrow; `textarea` stops the resize handle. */
export function fieldControlClass(arm: FieldArm, kind: 'input' | 'select' | 'textarea' = 'input'): string {
  return clsx(
    'w-full rounded-lg border border-border-strong bg-surface-1 shadow-sm px-3 py-2 text-sm text-text-primary placeholder-text-faint outline-none focus:ring-0',
    'disabled:cursor-not-allowed disabled:opacity-50',
    kind === 'select' && 'appearance-none pr-8',
    kind === 'textarea' && 'resize-none',
    FOCUS_BORDER[arm]
  )
}

/** The props a field hands its control. Spread them onto the input, select
 *  or textarea the label names. */
export interface FieldControlProps {
  id: string
  'aria-describedby'?: string
  'aria-invalid'?: true
}

/** The label, alone: for a group of buttons (named by its own `aria-label`)
 *  or a control the caller wires itself. */
export function FieldLabel({
  htmlFor,
  optional,
  children,
  className,
}: {
  htmlFor?: string
  optional?: boolean
  children: ReactNode
  className?: string
}) {
  return (
    <label htmlFor={htmlFor} className={clsx(FIELD_LABEL_CLASS, className)}>
      {children}
      {optional && (
        <>
          {' '}
          <span className="text-text-faint">(optional)</span>
        </>
      )}
    </label>
  )
}

interface FieldProps {
  /** The visible label. */
  label: ReactNode
  /** Adds the faint "(optional)" parenthetical. */
  optional?: boolean
  /** The control's id. Generated when omitted. */
  id?: string
  /** A line under the control that it is always described by. */
  description?: ReactNode
  /** A refusal tied to this field. While it is set the control is
   *  `aria-invalid` and described by it. */
  error?: ReactNode
  /** Further ids the control is described by (text the caller renders
   *  elsewhere, e.g. an error slot under a whole row). */
  describedBy?: string
  className?: string
  /** Renders the control (and anything that sits with it, such as a chevron
   *  or a button beside it), given the props that wire it to the label,
   *  description and error. The second argument names the description and
   *  error ids, for a second control in the field that the error is about. */
  children: (control: FieldControlProps, ids: { descriptionId: string; errorId: string }) => ReactNode
}

export function Field({ label, optional, id, description, error, describedBy, className, children }: FieldProps) {
  const generated = useId()
  const controlId = id ?? generated
  const descriptionId = `${controlId}-description`
  const errorId = `${controlId}-error`
  const hasError = error !== undefined && error !== null && error !== false && error !== ''
  const describedByIds = [description !== undefined ? descriptionId : null, hasError ? errorId : null, describedBy || null]
    .filter(Boolean)
    .join(' ')

  return (
    <div className={className}>
      <FieldLabel htmlFor={controlId} optional={optional}>
        {label}
      </FieldLabel>
      {children({
        id: controlId,
        'aria-describedby': describedByIds || undefined,
        'aria-invalid': hasError ? true : undefined,
      }, { descriptionId, errorId })}
      {description !== undefined && (
        <p id={descriptionId} className={FIELD_DESCRIPTION_CLASS}>
          {description}
        </p>
      )}
      {hasError && (
        <p id={errorId} className={FIELD_ERROR_CLASS}>
          {error}
        </p>
      )}
    </div>
  )
}
