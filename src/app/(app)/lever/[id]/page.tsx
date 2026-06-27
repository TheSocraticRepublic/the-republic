import { headers } from 'next/headers'
import { notFound } from 'next/navigation'
import { getDb } from '@/lib/db'
import { leverActions } from '@/lib/db/schema'
import { eq, and } from 'drizzle-orm'
import { ArrowLeft, ExternalLink } from 'lucide-react'
import Link from 'next/link'
import { ArmHeader } from '@/components/layout/arm-header'
import { ActionViewer } from '@/components/lever/action-viewer'

export const metadata = {
  title: 'Lever',
}

interface PageProps {
  params: Promise<{ id: string }>
}

const ACTION_TYPE_LABELS: Record<string, string> = {
  fippa_request: 'FIPPA Request',
  public_comment: 'Public Comment',
  policy_brief: 'Policy Brief',
  legal_template: 'Legal Template',
}

export default async function LeverActionPage({ params }: PageProps) {
  const { id } = await params
  const headersList = await headers()
  const userId = headersList.get('x-user-id')!

  const db = getDb()

  const [action] = await db
    .select()
    .from(leverActions)
    .where(and(eq(leverActions.id, id), eq(leverActions.userId, userId)))
    .limit(1)

  if (!action) {
    notFound()
  }

  const typeLabel = ACTION_TYPE_LABELS[action.actionType] ?? action.actionType

  return (
    <div data-arm="lever" className="mx-auto max-w-2xl px-6 py-10">
      {/* Back nav */}
      <div className="mb-6 flex items-center gap-4">
        <Link
          href="/lever"
          className="inline-flex items-center gap-1.5 text-xs text-text-muted transition-colors hover:text-text-secondary"
        >
          <ArrowLeft size={13} strokeWidth={2} />
          All actions
        </Link>
        {action.investigationId && (
          <Link
            href={`/investigate/${action.investigationId}`}
            className="inline-flex items-center gap-1.5 text-xs text-text-muted transition-colors hover:text-text-secondary"
          >
            <ExternalLink size={11} strokeWidth={2} />
            View investigation
          </Link>
        )}
      </div>

      {/* Header */}
      <ArmHeader arm="lever" title={action.title} subtitle={typeLabel} />

      {/* Viewer */}
      <ActionViewer
        actionId={action.id}
        initialContent={action.content ?? ''}
        initialStatus={action.status}
        actionType={action.actionType}
      />
    </div>
  )
}
