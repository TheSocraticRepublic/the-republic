'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2 } from 'lucide-react'

export function PostalCodeForm() {
  const router = useRouter()
  const [postalCode, setPostalCode] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function formatInput(value: string): string {
    const clean = value.replace(/[^a-zA-Z0-9]/g, '').toUpperCase().slice(0, 6)
    if (clean.length > 3) {
      return `${clean.slice(0, 3)} ${clean.slice(3)}`
    }
    return clean
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const normalized = postalCode.replace(/\s+/g, '').toUpperCase()

    if (!/^[A-Z]\d[A-Z]\d[A-Z]\d$/.test(normalized)) {
      setError('Enter a valid Canadian postal code (e.g., V8B 0A1)')
      return
    }

    setLoading(true)
    setError(null)

    try {
      const res = await fetch(`/api/parliament/lookup?postalCode=${normalized}`)
      if (!res.ok) {
        const data = await res.json().catch(() => ({ error: 'Lookup failed' }))
        setError(data.error || 'Could not find your MP')
        setLoading(false)
        return
      }

      const data = await res.json()
      if (data.mpId) {
        router.push(`/votes/mp/${data.mpId}`)
      } else {
        setError('No federal MP found for this postal code')
        setLoading(false)
      }
    } catch {
      setError('Something went wrong. Please try again.')
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label
          htmlFor="postal-code"
          className="block text-[10px] font-semibold uppercase tracking-widest text-neutral-500 mb-2"
        >
          Your postal code
        </label>
        <input
          id="postal-code"
          type="text"
          value={postalCode}
          onChange={(e) => {
            setPostalCode(formatInput(e.target.value))
            setError(null)
          }}
          placeholder="V8B 0A1"
          className="w-full rounded-xl border bg-transparent px-4 py-3 text-lg text-neutral-100 placeholder-neutral-700 focus:outline-none focus:border-neutral-500 tracking-wider font-mono"
          style={{ borderColor: 'rgba(255,255,255,0.10)' }}
          autoComplete="postal-code"
          maxLength={7}
        />
      </div>

      {error && (
        <p className="text-xs text-red-400">{error}</p>
      )}

      <button
        type="submit"
        disabled={loading || postalCode.replace(/\s/g, '').length < 6}
        className="w-full rounded-xl px-4 py-3 text-sm font-semibold transition-all duration-150 disabled:opacity-40"
        style={{
          color: '#D4764E',
          backgroundColor: 'rgba(212,118,78,0.10)',
          border: '1px solid rgba(212,118,78,0.25)',
        }}
      >
        {loading ? (
          <span className="inline-flex items-center gap-2">
            <Loader2 size={14} className="animate-spin" />
            Finding your MP...
          </span>
        ) : (
          'Find my MP'
        )}
      </button>
    </form>
  )
}
