type DocumentChangeType = 'content_changed' | 'metadata_changed' | 'deleted' | 'retracted'

interface DocumentVersion {
  id: string
  versionNumber: number
  changeType: DocumentChangeType
  diffSummary: string | null
  detectedAt: Date
}

interface DiffViewerProps {
  versions: DocumentVersion[]
}

function formatDate(date: Date): string {
  return new Intl.DateTimeFormat('en-CA', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  }).format(date)
}

const CHANGE_TYPE_LABELS: Record<DocumentChangeType, string> = {
  content_changed: 'Content changed',
  metadata_changed: 'Metadata changed',
  deleted: 'Deleted',
  retracted: 'Retracted',
}

function ChangeTypeBadge({ type }: { type: DocumentChangeType }) {
  if (type === 'deleted' || type === 'retracted') {
    return (
      <span className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-medium bg-amber-950/60 border border-amber-700/40 text-amber-400">
        <span className="opacity-70">-</span>
        {CHANGE_TYPE_LABELS[type]}
      </span>
    )
  }

  return (
    <span className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-medium bg-sky-950/60 border border-sky-700/40 text-sky-400">
      <span className="opacity-70">+</span>
      {CHANGE_TYPE_LABELS[type]}
    </span>
  )
}

export function DiffViewer({ versions }: DiffViewerProps) {
  if (versions.length === 0) {
    return (
      <p className="text-sm text-text-faint">No document versions recorded.</p>
    )
  }

  return (
    <div className="space-y-2">
      {versions.map((version) => (
        <div
          key={version.id}
          className="rounded-xl border border-border bg-surface-1 px-4 py-3"
        >
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs text-text-faint tabular-nums">
                v{version.versionNumber}
              </span>
              <ChangeTypeBadge type={version.changeType} />
            </div>
            <span className="text-[10px] text-text-faint flex-shrink-0">
              {formatDate(version.detectedAt)}
            </span>
          </div>

          {version.diffSummary && (
            <p className="mt-2 text-xs leading-relaxed text-text-muted">
              {version.diffSummary}
            </p>
          )}
        </div>
      ))}
    </div>
  )
}
