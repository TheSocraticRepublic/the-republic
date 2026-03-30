import { headers } from 'next/headers'
import { AppShell } from '@/components/layout/app-shell'

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const headersList = await headers()
  const userEmail = headersList.get('x-user-email') ?? undefined

  return <AppShell userEmail={userEmail}>{children}</AppShell>
}
