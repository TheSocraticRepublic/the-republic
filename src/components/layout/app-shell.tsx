import { Sidebar } from './sidebar'

interface AppShellProps {
  children: React.ReactNode
  userEmail?: string
  displayName?: string
  effectiveWeight?: number
}

export function AppShell({ children, userEmail, displayName, effectiveWeight }: AppShellProps) {
  return (
    <div className="flex h-screen overflow-hidden bg-neutral-950">
      {/* Sidebar */}
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
