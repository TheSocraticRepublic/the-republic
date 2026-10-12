'use client'

import { useState } from 'react'
import Link from 'next/link'
import * as Dialog from '@radix-ui/react-dialog'
import { Menu, X } from 'lucide-react'
import { Sidebar } from './sidebar'

interface AppShellProps {
  children: React.ReactNode
  // No email: the shell shows the display name only, and the email is not
  // even sent to the client (app-arms P2-16, Razor N1).
  displayName?: string
  effectiveWeight?: number
}

export function AppShell({ children, displayName, effectiveWeight }: AppShellProps) {
  const [drawerOpen, setDrawerOpen] = useState(false)

  return (
    // h-dvh, not h-screen: on iOS Safari 100vh is the toolbar-collapsed
    // height, which put the bottom of every page under the toolbar (mobile P2-13).
    <div className="flex h-dvh flex-col overflow-hidden bg-surface-0 md:flex-row">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:z-50 focus:top-2 focus:left-2 focus:rounded-lg focus:bg-surface-2 focus:px-4 focus:py-2 focus:text-text-primary focus:ring-2 focus:ring-oracle"
      >
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
          {/* Wordmark (R6): Fraunces, no tagline. */}
          <Link href="/" className="flex min-h-11 items-center px-2">
            <span className="font-display text-lg font-semibold tracking-[-0.01em] text-text-primary">
              Open Cave
            </span>
          </Link>
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
            <Dialog.Close aria-label="Close navigation" className="absolute right-3 top-3 z-10 flex h-8 w-8 items-center justify-center rounded-lg text-text-muted transition-colors hover:bg-surface-3 hover:text-text-primary">
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
        <div className="flex-1 overflow-y-auto">
          {children}
        </div>
      </main>
    </div>
  )
}
