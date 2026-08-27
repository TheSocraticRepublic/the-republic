export default function Loading() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-3 p-8">
      <div
        className="h-5 w-5 animate-spin rounded-full border-2 border-t-transparent"
        style={{ borderColor: 'var(--accent-oracle)', borderTopColor: 'transparent' }}
      />
      <p className="text-xs" style={{ color: 'var(--accent-oracle)' }}>
        Loading investigations
      </p>
    </div>
  )
}
