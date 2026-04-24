'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

interface PreserveButtonProps {
  investigationId: string
}

export function PreserveButton({ investigationId }: PreserveButtonProps) {
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  async function handlePreserve() {
    setLoading(true)
    try {
      const res = await fetch(`/api/archive/${investigationId}`, {
        method: 'POST',
      })
      if (res.ok) {
        router.refresh()
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <button
      onClick={handlePreserve}
      disabled={loading}
      className="inline-flex items-center rounded-xl px-3 py-1.5 text-xs font-medium transition-all duration-150 disabled:opacity-50"
      style={{
        backgroundColor: 'rgba(255, 255, 255, 0.06)',
        color: '#d4d4d8',
        border: '1px solid rgba(255, 255, 255, 0.10)',
      }}
    >
      {loading ? 'Preserving…' : 'Preserve to Archive'}
    </button>
  )
}
