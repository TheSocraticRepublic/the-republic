import { headers } from 'next/headers'
import { notFound } from 'next/navigation'
import { getDb } from '@/lib/db'
import { leverActions } from '@/lib/db/schema'
import { eq, and } from 'drizzle-orm'
import { FileText, ArrowLeft } from 'lucide-react'
import Link from 'next/link'
import { ActionViewer } from '@/components/lever/action-viewer'

export const metadata = {
  title: 'Lever — The Republic',
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
    <div className="mx-auto max-w-3xl px-6 py-10">
      {/* Back nav */}
      <div className="mb-6">
        <Link
          href="/lever"
          className="inline-flex items-center gap-1.5 text-xs text-neutral-500 transition-colors hover:text-neutral-300"
        >
          <ArrowLeft size={13} strokeWidth={2} />
          All actions
        </Link>
      </div>

      {/* Header */}
      <div className="mb-8 flex items-start gap-3">
        <span
          className="mt-0.5 flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl border"
          style={{
            borderColor: 'rgba(200, 91, 91, 0.25)',
            backgroundColor: 'rgba(200, 91, 91, 0.08)',
          }}
        >
          <FileText size={18} strokeWidth={1.75} style={{ color: '#C85B5B' }} />
        </span>
        <div className="flex-1 min-w-0">
          <h1
            className="text-lg font-bold tracking-tight text-neutral-100 leading-snug"
            style={{ fontFamily: '"Plus Jakarta Sans", system-ui, sans-serif' }}
          >
            {action.title}
          </h1>
          <p className="mt-0.5 text-xs text-neutral-500">{typeLabel}</p>
        </div>
      </div>

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
