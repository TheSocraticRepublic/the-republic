import { useId, type ReactNode } from 'react'
import { clsx } from 'clsx'
import { CircleAlert } from 'lucide-react'

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
 *   faint placeholder. Focus strengthens the border to a neutral faint ink on
 *   every arm: the arm's colour belongs to its action, and on Lever a red
 *   border must only ever mean wrong (Jen C2b C1). An `aria-invalid` control
 *   keeps a danger border, focused or not. Disabled is drawn in colour
 *   (recessed fill, muted ink), never opacity (Jen C2b C4).
 * - **Description**: 12px muted, under the control, always referenced by the
 *   control's `aria-describedby`.
 * - **Error**: 12px danger with an alert icon, so it never says "error" by
 *   colour alone; while it shows, the control is `aria-invalid` and described
 *   by it as well.
 * - **Toggle**: one recipe for a pressed/unpressed choice (Gadfly's mode,
 *   Lever's document type), neutral in both states, so the arm's tint sits
 *   on the form's action only (Jen C2b C2).
 * - **Reason line**: why the action is unavailable, 8px above its row.
 *
 * The control's font size is `text-sm`, which the unlayered phone rule in
 * globals.css raises to 16px below 768px (B1); this recipe never sets an
 * inline font size, which would beat that rule.
 */

export const SECTION_LABEL_CLASS = 'text-xs font-semibold uppercase tracking-widest text-text-muted'

export const FIELD_LABEL_CLASS = 'mb-1.5 block text-xs font-medium text-text-secondary'

export const FIELD_DESCRIPTION_CLASS = 'mt-1.5 text-xs text-text-muted'

export const FIELD_ERROR_CLASS = 'mt-1.5 flex items-start gap-1.5 text-xs text-status-danger'

/** Why an action is unavailable: one muted line, right-aligned, 8px above
 *  the action's row (Jen C2b C5). */
export const FIELD_REASON_CLASS = 'mb-2 text-right text-xs text-text-muted'

/** The non-colour cue on every error line: a 13px alert icon, hidden from
 *  the accessibility tree (the words carry the meaning). Put it first in a
 *  `flex items-start gap-1.5` line, as FIELD_ERROR_CLASS does. */
export function ErrorMark() {
  return <CircleAlert size={13} strokeWidth={2} aria-hidden="true" className="mt-px shrink-0" />
}

/** The control recipe. `select` adds room for the chevron and drops the UA
 *  arrow; `textarea` stops the resize handle. */
export function fieldControlClass(kind: 'input' | 'select' | 'textarea' = 'input'): string {
  return clsx(
    'w-full rounded-lg border border-border-strong bg-surface-1 shadow-sm px-3 py-2 text-sm text-text-primary placeholder-text-faint outline-none focus:ring-0',
    'focus:not-aria-invalid:border-text-faint aria-invalid:border-status-danger',
    'disabled:cursor-not-allowed disabled:border-border disabled:bg-surface-2 disabled:text-text-muted',
    kind === 'select' && 'appearance-none pr-8',
    kind === 'textarea' && 'resize-none'
  )
}

/** A pressed/unpressed choice button: neutral in both states, pressed told
 *  apart by lightness (a muted-ink border on surface-3), not hue. */
export function fieldToggleClasses(pressed: boolean): { button: string; label: string; description: string } {
  return {
    button: clsx(
      'rounded-lg border px-3 py-2.5 text-left transition-colors duration-150',
      pressed ? 'border-text-muted bg-surface-3' : 'border-border-strong bg-surface-1 hover:bg-surface-2'
    ),
    label: clsx('block text-sm font-medium', pressed ? 'text-text-primary' : 'text-text-secondary'),
    description: clsx('mt-0.5 block text-xs', pressed ? 'text-text-secondary' : 'text-text-muted'),
  }
}

/** The props a field hands its control. Spread them onto the input, select
 *  or textarea the label names. */
export interface FieldControlProps {
  id: string
  'aria-describedby'?: string
  'aria-invalid'?: true
}

/** The label, alone. With `htmlFor` it is the `<label>` of a control the
 *  caller wires itself. Without it, it names a group: it renders a `<p>` with
 *  `id`, and the group takes `aria-labelledby` that id, so its accessible
 *  name is the visible words (Jen C2b C6). */
export function FieldLabel({
  htmlFor,
  id,
  optional,
  children,
  className,
}: {
  htmlFor?: string
  id?: string
  optional?: boolean
  children: ReactNode
  className?: string
}) {
  // The space lives inside the span's own text: a separate `{' '}` node is
  // isolated by React's server-render separators, and Chromium drops it from
  // the accessible name ("Policy area(optional)", Jen C2b C7).
  const parenthetical = optional && <span className="text-text-faint">{' (optional)'}</span>
  if (htmlFor === undefined) {
    return (
      <p id={id} className={clsx(FIELD_LABEL_CLASS, className)}>
        {children}
        {parenthetical}
      </p>
    )
  }
  return (
    <label htmlFor={htmlFor} id={id} className={clsx(FIELD_LABEL_CLASS, className)}>
      {children}
      {parenthetical}
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
          <ErrorMark />
          <span>{error}</span>
        </p>
      )}
    </div>
  )
}
