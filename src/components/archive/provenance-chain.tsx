'use client'

import { useState } from 'react'

interface ProvenanceChainProps {
  createdAt: Date
  briefingCompletedAt: Date | null
  preservedAt: Date | null
  permanenceAt: Date | null
  ipfsCid: string | null
  arweaveTxId: string | null
}

function formatDate(date: Date): string {
  return new Intl.DateTimeFormat('en-CA', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  }).format(date)
}

interface Step {
  label: string
  description: string
  completedAt: Date | null
  href?: string
  copyValue?: string
  copyLabel?: string
}

export function ProvenanceChain({
  createdAt,
  briefingCompletedAt,
  preservedAt,
  permanenceAt,
  ipfsCid,
  arweaveTxId,
}: ProvenanceChainProps) {
  const [copied, setCopied] = useState<string | null>(null)

  async function handleCopy(value: string, key: string) {
    await navigator.clipboard.writeText(value)
    setCopied(key)
    setTimeout(() => setCopied(null), 2000)
  }

  const steps: Step[] = [
    {
      label: 'Investigation opened',
      description: 'Concern recorded and briefing initiated.',
      completedAt: createdAt,
    },
    {
      label: 'Briefing completed',
      description: 'AI analysis finished. Content snapshot established.',
      completedAt: briefingCompletedAt,
    },
    {
      label: 'Preserved to IPFS',
      description: 'Content hash pinned to the distributed web.',
      completedAt: preservedAt,
      copyValue: ipfsCid ?? undefined,
      copyLabel: ipfsCid ? `${ipfsCid.slice(0, 8)}…${ipfsCid.slice(-6)}` : undefined,
    },
    {
      label: 'Permanently archived',
      description: 'Written to Arweave. Immutable and unforgeable.',
      completedAt: permanenceAt,
      href: arweaveTxId ? `https://arweave.net/${arweaveTxId}` : undefined,
      copyLabel: arweaveTxId ? `${arweaveTxId.slice(0, 8)}…${arweaveTxId.slice(-6)}` : undefined,
      copyValue: arweaveTxId ?? undefined,
    },
  ]

  return (
    <div className="space-y-0">
      {steps.map((step, i) => {
        const isComplete = step.completedAt !== null
        const isLast = i === steps.length - 1

        return (
          <div key={step.label} className="flex gap-4">
            {/* Timeline spine */}
            <div className="flex flex-col items-center">
              {/* Dot */}
              <div
                className={`mt-0.5 h-2.5 w-2.5 flex-shrink-0 rounded-full border transition-colors ${
                  isComplete
                    ? 'border-sky-500 bg-sky-500'
                    : 'border-neutral-700 bg-neutral-900'
                }`}
              />
              {/* Connector line */}
              {!isLast && (
                <div
                  className={`w-px flex-1 my-1 ${
                    isComplete ? 'bg-sky-800/60' : 'bg-neutral-800'
                  }`}
                />
              )}
            </div>

            {/* Content */}
            <div className={`pb-5 min-w-0 flex-1 ${isLast ? 'pb-0' : ''}`}>
              <div className="flex items-center gap-2 flex-wrap">
                <span
                  className={`text-sm font-medium ${
                    isComplete ? 'text-neutral-200' : 'text-neutral-600'
                  }`}
                >
                  {step.label}
                </span>
                {isComplete && step.completedAt && (
                  <span className="text-xs text-neutral-600">
                    {formatDate(step.completedAt)}
                  </span>
                )}
              </div>

              <p
                className={`mt-0.5 text-xs leading-relaxed ${
                  isComplete ? 'text-neutral-500' : 'text-neutral-700'
                }`}
              >
                {step.description}
              </p>

              {/* CID or TX display */}
              {isComplete && step.copyLabel && step.copyValue && (
                <div className="mt-1.5 flex items-center gap-2">
                  {step.href ? (
                    <a
                      href={step.href}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-mono text-[11px] text-sky-500 hover:text-sky-400 transition-colors underline underline-offset-2"
                    >
                      {step.copyLabel}
                    </a>
                  ) : (
                    <span className="font-mono text-[11px] text-neutral-500">
                      {step.copyLabel}
                    </span>
                  )}
                  <button
                    onClick={() => handleCopy(step.copyValue!, step.label)}
                    className="text-[10px] text-neutral-600 hover:text-neutral-400 transition-colors px-1.5 py-0.5 rounded border border-white/[0.06] hover:border-white/[0.12]"
                  >
                    {copied === step.label ? 'Copied' : 'Copy'}
                  </button>
                </div>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}
