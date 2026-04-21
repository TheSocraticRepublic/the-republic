'use client'

import { useRouter } from 'next/navigation'

interface JurisdictionOption {
  id: string
  name: string
}

const CONCERN_CATEGORIES = [
  'conservation',
  'housing',
  'transit',
  'budget',
  'environment',
  'foi',
  'procurement',
  'other',
]

interface ThreadFiltersProps {
  currentJurisdiction?: string | null
  currentCategory?: string | null
  jurisdictions: JurisdictionOption[]
}

export function ThreadFilters({
  currentJurisdiction,
  currentCategory,
  jurisdictions,
}: ThreadFiltersProps) {
  const router = useRouter()

  function handleChange(key: string, value: string) {
    const params = new URLSearchParams(window.location.search)
    if (value) {
      params.set(key, value)
    } else {
      params.delete(key)
    }
    params.delete('page') // reset to page 1 on filter change
    router.push(`/forum?${params.toString()}`)
  }

  const selectClass =
    'rounded-lg px-3 py-1.5 text-xs text-neutral-300 bg-white/[0.04] border border-white/[0.08] focus:outline-none focus:border-white/[0.20] transition-colors cursor-pointer'

  return (
    <div className="flex items-center gap-3">
      <select
        value={currentJurisdiction ?? ''}
        onChange={(e) => handleChange('jurisdiction', e.target.value)}
        className={selectClass}
        style={{ colorScheme: 'dark' }}
      >
        <option value="">All jurisdictions</option>
        {jurisdictions.map((j) => (
          <option key={j.id} value={j.id}>
            {j.name}
          </option>
        ))}
      </select>

      <select
        value={currentCategory ?? ''}
        onChange={(e) => handleChange('category', e.target.value)}
        className={selectClass}
        style={{ colorScheme: 'dark' }}
      >
        <option value="">All categories</option>
        {CONCERN_CATEGORIES.map((cat) => (
          <option key={cat} value={cat}>
            {cat.charAt(0).toUpperCase() + cat.slice(1)}
          </option>
        ))}
      </select>
    </div>
  )
}
