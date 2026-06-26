'use client'

import { useState } from 'react'
import { useCompletion } from '@ai-sdk/react'
import { Eye, RefreshCw } from 'lucide-react'
import { AnalysisView } from './analysis-view'

interface OracleAnalysisPanelProps {
  documentId: string
  savedAnalysis: string | null
  hasSavedAnalysis: boolean
}

export function OracleAnalysisPanel({
  documentId,
  savedAnalysis,
  hasSavedAnalysis,
}: OracleAnalysisPanelProps) {
  const [hasStarted, setHasStarted] = useState(hasSavedAnalysis)

  const { completion, complete, isLoading, error } = useCompletion({
    api: '/api/oracle/analyze',
    streamProtocol: 'text',
    onFinish: () => {
      // Analysis is saved server-side via onFinish callback
    },
  })

  const handleAnalyze = async () => {
    setHasStarted(true)
    await complete('', {
      body: { documentId },
    })
  }

  // Determine what content to show
  const displayContent = completion || (hasSavedAnalysis ? savedAnalysis ?? '' : '')
  const showContent = hasStarted && displayContent.length > 0

  return (
    <div className="space-y-5">
      {/* Analyze / Re-analyze button */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Eye size={14} strokeWidth={1.75} style={{ color: '#89B4C8' }} />
          <span
            className="text-sm font-semibold"
            style={{
              color: '#89B4C8',
            }}
          >
            Oracle Analysis
          </span>
          {hasSavedAnalysis && !isLoading && !completion && (
            <span className="rounded-full border border-border bg-surface-1 px-2 py-0.5 text-[10px] text-text-muted">
              Saved
            </span>
          )}
        </div>

        <button
          onClick={handleAnalyze}
          disabled={isLoading}
          className="flex items-center gap-2 rounded-lg border border-border bg-surface-1 px-4 py-2 text-sm text-text-secondary transition-all duration-150 hover:border-[#89B4C8]/30 hover:bg-[#89B4C8]/[0.06] hover:text-text-primary disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isLoading ? (
            <>
              <RefreshCw size={13} strokeWidth={2} className="animate-spin" />
              Analyzing...
            </>
          ) : hasSavedAnalysis ? (
            <>
              <RefreshCw size={13} strokeWidth={2} />
              Re-analyze
            </>
          ) : (
            <>
              <Eye size={13} strokeWidth={2} />
              Analyze
            </>
          )}
        </button>
      </div>

      {/* Error state */}
      {error && (
        <div className="rounded-xl border border-red-500/20 bg-red-500/[0.05] px-4 py-3 text-sm text-red-300">
          Analysis failed: {error.message}. Please try again.
        </div>
      )}

      {/* Content */}
      {showContent && (
        <AnalysisView content={displayContent} isStreaming={isLoading} />
      )}

      {/* Pre-analysis state */}
      {!hasStarted && !showContent && (
        <div className="flex flex-col items-center justify-center gap-4 rounded-xl border border-border bg-surface-1 shadow-sm px-6 py-14 text-center">
          <span
            className="flex h-12 w-12 items-center justify-center rounded-xl border"
            style={{
              borderColor: 'rgba(137, 180, 200, 0.2)',
              backgroundColor: 'rgba(137, 180, 200, 0.06)',
            }}
          >
            <Eye size={20} strokeWidth={1.5} style={{ color: '#89B4C8' }} />
          </span>
          <div>
            <p className="text-sm font-medium text-text-secondary">Ready for analysis</p>
            <p className="mt-1 text-xs text-text-muted max-w-xs mx-auto leading-relaxed">
              The Oracle will produce a plain-language summary, power map, and actionable questions.
            </p>
          </div>
        </div>
      )}
    </div>
  )
}
