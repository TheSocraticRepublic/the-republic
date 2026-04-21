'use client'

import { useState, useEffect, useCallback } from 'react'
import { ReportCard } from '@/components/forum/report-card'

interface ReportTarget {
  id: string
  status: string
  authorDisplayName: string
  content?: string
  title?: string
}

interface Report {
  id: string
  targetType: 'post' | 'thread'
  targetId: string
  reason: string
  description: string | null
  status: string
  reviewedBy: string | null
  createdAt: string
  reporterDisplayName: string
  target: ReportTarget | null
  isAppeal?: boolean
}

export function ModerationQueue() {
  const [reports, setReports] = useState<Report[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const loadReports = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/forum/reports')
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error ?? 'Failed to load reports')
      }
      const data = await res.json()
      setReports(data.reports ?? [])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load reports')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadReports()
  }, [loadReports])

  const handleActioned = useCallback((reportId: string) => {
    setReports((prev) => prev.filter((r) => r.id !== reportId))
  }, [])

  if (loading) {
    return (
      <div className="text-sm text-neutral-600 py-8 text-center">
        Loading reports...
      </div>
    )
  }

  if (error) {
    return (
      <div className="text-sm text-red-400 py-4">
        {error}
      </div>
    )
  }

  if (reports.length === 0) {
    return (
      <div
        className="rounded-xl border border-white/[0.06] bg-black/30 px-5 py-8 text-center text-sm text-neutral-600"
      >
        No pending reports. The queue is clear.
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {reports.map((report) => (
        <ReportCard
          key={report.id}
          id={report.id}
          targetType={report.targetType}
          targetId={report.targetId}
          reason={report.reason}
          description={report.description}
          status={report.status}
          reviewedBy={report.reviewedBy}
          createdAt={report.createdAt}
          reporterDisplayName={report.reporterDisplayName}
          target={report.target}
          isAppeal={report.isAppeal}
          onActioned={handleActioned}
        />
      ))}
    </div>
  )
}
