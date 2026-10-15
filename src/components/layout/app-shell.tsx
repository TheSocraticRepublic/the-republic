'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import * as Dialog from '@radix-ui/react-dialog'
import { CircleAlert, Menu, X } from 'lucide-react'
import { clsx } from 'clsx'
import { Sidebar, SignOutIcon } from './sidebar'
import { ErrorMark } from '@/components/ui/field'
import {
  NOTICE_LEAD,
  NOTICE_LINK,
  NOTICE_TAIL,
  useSignOut,
  useSignOutElsewhereListener,
  useSignedOutNotice,
} from '@/lib/auth/client-sign-out'

interface AppShellProps {
  children: React.ReactNode
  // No email: the shell shows the display name only, and the email is not
  // even sent to the client (app-arms P2-16, Razor N1).
  displayName?: string
  effectiveWeight?: number
  /** `onboarding`: a signed-in citizen with no profile yet, on
   *  /profile/setup. The instruments are not theirs to use until they have a
   *  name, so the shell is the wordmark and Sign out only (UI plan C3). */
  variant?: 'app' | 'onboarding'
}

const SKIP_LINK_CLASS =
  'sr-only focus:not-sr-only focus:absolute focus:z-50 focus:top-2 focus:left-2 focus:rounded-lg focus:bg-surface-2 focus:px-4 focus:py-2 focus:text-text-primary focus:ring-2 focus:ring-oracle'

/** Wordmark (R6): Fraunces, no tagline. */
function Wordmark() {
  return (
    <Link href="/" className="flex min-h-11 items-center px-2">
      <span className="font-display text-lg font-semibold tracking-[-0.01em] text-text-primary">
        Open Cave
      </span>
    </Link>
  )
}

/**
 * Shown, instead of a reload, when this tab holds unsaved text and the
 * session has ended: another tab signed out, or a save here was answered 401
 * (Razor C3 W2; Jen C3 C6, C7). Every action it names is a control on the
 * page: the link signs in again in a NEW tab, so this one keeps its text, and
 * the save then works here. It clears when the session is back.
 */
function SignedOutNotice() {
  const notice = useSignedOutNotice()
  const pathname = usePathname()
  if (!notice) return null
  // role="alert" is announced on insertion, so it mounts only when needed.
  return (
    <div
      role="alert"
      className="flex items-start gap-2 border-b border-border bg-surface-2 px-4 py-3 text-sm text-text-primary"
    >
      <CircleAlert size={14} strokeWidth={2} aria-hidden="true" className="mt-[3px] shrink-0 text-status-warning" />
      <p>
        {NOTICE_LEAD[notice]}{' '}
        <a
          href={`/login?redirect=${encodeURIComponent(pathname || '/investigate')}`}
          target="_blank"
          rel="noopener"
          className="font-medium text-text-primary underline underline-offset-2"
        >
          {NOTICE_LINK}
        </a>
        {NOTICE_TAIL}
      </p>
    </div>
  )
}

export function AppShell({ children, displayName, effectiveWeight, variant = 'app' }: AppShellProps) {
  // Every signed-in page hears a sign-out made in another tab.
  useSignOutElsewhereListener()
  if (variant === 'onboarding') return <OnboardingShell>{children}</OnboardingShell>
  return (
    <FullShell displayName={displayName} effectiveWeight={effectiveWeight}>
      {children}
    </FullShell>
  )
}

function OnboardingShell({ children }: { children: React.ReactNode }) {
  const { signOut, busy, error } = useSignOut()

  return (
    <div className="flex h-dvh flex-col overflow-hidden bg-surface-0">
      <a href="#main-content" className={SKIP_LINK_CLASS}>
        Skip to content
      </a>

      <header className="border-b border-border bg-surface-2 px-3 py-2 md:px-5">
        <div className="flex items-center justify-between gap-3">
          <Wordmark />
          {/* The one sign-out path (clientSignOut). On failure the citizen
              stays on the form, with what they typed, and is told plainly. */}
          <button
            type="button"
            onClick={signOut}
            aria-busy={busy || undefined}
            aria-disabled={busy || undefined}
            className={clsx(
              'flex min-h-11 items-center gap-2 rounded-lg px-3 text-sm text-text-muted transition-colors hover:bg-surface-3 hover:text-text-secondary',
              busy && 'cursor-progress',
            )}
          >
            <SignOutIcon busy={busy} />
            Sign out
          </button>
        </div>
        {error && (
          <p
            role="alert"
            className="ml-auto flex max-w-sm items-start gap-1.5 px-2 pb-1 text-left text-xs text-status-danger"
          >
            <ErrorMark />
            {error}
          </p>
        )}
      </header>

      <main id="main-content" className="flex flex-1 flex-col overflow-hidden">
        <SignedOutNotice />
        <div className="flex-1 overflow-y-auto">{children}</div>
      </main>
    </div>
  )
}

function FullShell({
  children,
  displayName,
  effectiveWeight,
}: {
  children: React.ReactNode
  displayName?: string
  effectiveWeight?: number
}) {
  const [drawerOpen, setDrawerOpen] = useState(false)

  return (
    // h-dvh, not h-screen: on iOS Safari 100vh is the toolbar-collapsed
    // height, which put the bottom of every page under the toolbar (mobile P2-13).
    <div className="flex h-dvh flex-col overflow-hidden bg-surface-0 md:flex-row">
      <a href="#main-content" className={SKIP_LINK_CLASS}>
        Skip to content
      </a>

      <Dialog.Root open={drawerOpen} onOpenChange={setDrawerOpen}>
        {/* Mobile header: a landmark, and its menu button is the dialog's own
            trigger, so it exposes aria-expanded and aria-haspopup (mobile P2-3). */}
        <header className="flex items-center justify-between border-b border-border bg-surface-2 px-3 py-2 md:hidden">
          <Dialog.Trigger asChild>
            <button
              type="button"
              aria-label="Open navigation"
              className="flex h-11 w-11 items-center justify-center rounded-lg text-text-secondary transition-colors hover:bg-surface-3 hover:text-text-primary"
            >
              <Menu size={20} strokeWidth={1.75} />
            </button>
          </Dialog.Trigger>
          <Wordmark />
          <div className="w-11" aria-hidden="true" />
        </header>

        {/* Mobile drawer. No enter/exit animation classes: the animate-in
            plugin they needed was never installed, so they did nothing
            (mobile P2-15). The drawer appears instantly. */}
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-40 bg-black/50 md:hidden" />
          <Dialog.Content
            className="fixed inset-y-0 left-0 z-50 w-72 shadow-2xl md:hidden"
            aria-label="Navigation menu"
          >
            <Dialog.Title className="sr-only">Navigation menu</Dialog.Title>
            <Dialog.Description className="sr-only">
              Site navigation and account links
            </Dialog.Description>
            {/* 44px, seated inside the sidebar's sticky 60px wordmark band (Jen C3). */}
            <Dialog.Close aria-label="Close navigation" className="absolute right-2 top-2 z-20 flex h-11 w-11 items-center justify-center rounded-lg text-text-muted transition-colors hover:bg-surface-3 hover:text-text-primary">
              <X size={16} strokeWidth={2} />
            </Dialog.Close>
            <Sidebar
              variant="drawer"
              onNavigate={() => setDrawerOpen(false)}
              displayName={displayName}
              effectiveWeight={effectiveWeight}
            />
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>

      {/* Desktop sidebar */}
      <div className="hidden md:flex md:flex-shrink-0">
        <Sidebar displayName={displayName} effectiveWeight={effectiveWeight} />
      </div>

      {/* Main content */}
      <main id="main-content" className="flex flex-1 flex-col overflow-hidden">
        <SignedOutNotice />
        <div className="flex-1 overflow-y-auto">
          {children}
        </div>
      </main>
    </div>
  )
}
