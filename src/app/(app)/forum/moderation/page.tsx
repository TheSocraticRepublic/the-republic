import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { checkModeratorAccess } from '@/lib/credentials/check-moderator'
import { ModerationQueue } from './moderation-queue'

export default async function ModerationPage() {
  const headersList = await headers()
  const userId = headersList.get('x-user-id')
  if (!userId) {
    redirect('/login')
  }

  const { isModerator, effectiveWeight } = await checkModeratorAccess(userId)
  if (!isModerator) {
    return (
      <div className="mx-auto max-w-2xl px-6 py-12">
        <h1
          className="text-xl font-bold tracking-tight text-neutral-100 mb-3"
          style={{ fontFamily: '"Plus Jakarta Sans", system-ui, sans-serif' }}
        >
          Moderation Queue
        </h1>
        <div
          className="rounded-xl border border-white/[0.06] bg-black/30 px-5 py-6 text-sm text-neutral-500"
        >
          <p className="mb-1 text-neutral-400">Insufficient credentials</p>
          <p>
            You need a credential weight of at least 10 to access the moderation queue. Your
            current effective weight is {effectiveWeight}.
          </p>
          <p className="mt-3">
            Earn credentials through diverse civic actions: completing investigations, filing
            access requests, sharing responses, and peer-reviewing others&apos; work.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-3xl px-6 py-10">
      <div className="mb-8">
        <h1
          className="text-xl font-bold tracking-tight text-neutral-100 mb-1"
          style={{ fontFamily: '"Plus Jakarta Sans", system-ui, sans-serif' }}
        >
          Moderation Queue
        </h1>
        <p className="text-xs text-neutral-500">
          Pending reports — oldest first. Every action requires a reason.
        </p>
      </div>
      <ModerationQueue />
    </div>
  )
}
