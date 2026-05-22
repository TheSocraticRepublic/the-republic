'use client'

import { useState } from 'react'
import Link from 'next/link'
import * as Dialog from '@radix-ui/react-dialog'
import { Menu, X } from 'lucide-react'
import { Sidebar } from './sidebar'

interface AppShellProps {
  children: React.ReactNode
  userEmail?: string
  displayName?: string
  effectiveWeight?: number
}

export function AppShell({ children, userEmail, displayName, effectiveWeight }: AppShellProps) {
  const [drawerOpen, setDrawerOpen] = useState(false)

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-surface-0 md:flex-row">
      {/* Mobile header */}
      <div className="flex items-center justify-between border-b border-border bg-surface-2 px-4 py-3 md:hidden">
        <button
          onClick={() => setDrawerOpen(true)}
          aria-label="Open navigation"
          className="flex h-10 w-10 items-center justify-center rounded-lg text-text-secondary transition-colors hover:bg-surface-3 hover:text-text-primary"
        >
          <Menu size={20} strokeWidth={1.75} />
        </button>
        <Link href="/">
          <span
            className="text-base font-bold tracking-tight text-text-primary"
            style={{ fontFamily: '"Plus Jakarta Sans", system-ui, sans-serif' }}
          >
            Open Cave
          </span>
        </Link>
        <div className="w-10" />
      </div>

      {/* Mobile drawer */}
      <Dialog.Root open={drawerOpen} onOpenChange={setDrawerOpen}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-40 bg-black/50 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 md:hidden" />
          <Dialog.Content
            className="fixed inset-y-0 left-0 z-50 w-72 shadow-2xl data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:slide-out-to-left data-[state=open]:slide-in-from-left md:hidden"
            aria-label="Navigation menu"
          >
            <Dialog.Close className="absolute right-3 top-3 z-10 flex h-8 w-8 items-center justify-center rounded-lg text-text-muted transition-colors hover:bg-surface-3 hover:text-text-primary">
              <X size={16} strokeWidth={2} />
            </Dialog.Close>
            <Sidebar
              variant="drawer"
              onNavigate={() => setDrawerOpen(false)}
              userEmail={userEmail}
              displayName={displayName}
              effectiveWeight={effectiveWeight}
            />
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>

      {/* Desktop sidebar */}
      <div className="hidden md:flex md:flex-shrink-0">
        <Sidebar userEmail={userEmail} displayName={displayName} effectiveWeight={effectiveWeight} />
      </div>

      {/* Main content */}
      <main className="flex flex-1 flex-col overflow-hidden">
        <div className="flex-1 overflow-y-auto">
          {children}
        </div>
      </main>
    </div>
  )
}
