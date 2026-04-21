'use client'

import { useState, useEffect } from 'react'
import { ReviewForm } from './review-form'
import { ReviewCard } from './review-card'
import { ReviewSummary } from './review-summary'

interface ReviewRow {
  id: string
  reviewerId: string
  reviewerDisplayName: string
  factualAccuracy: number
  sourceQuality: number
  missingContext: number
  strategicEffectiveness: number
  jurisdictionalAccuracy: number
  summary?: string | null
  createdAt: string
}

interface Aggregate {
  count: number
  averages: {
    factualAccuracy: number
    sourceQuality: number
    missingContext: number
    strategicEffectiveness: number
    jurisdictionalAccuracy: number
  }
}

interface ReviewSectionProps {
  investigationId: string
  isAuthor: boolean
  currentUserId: string
}

export function ReviewSection({ investigationId, isAuthor, currentUserId }: ReviewSectionProps) {
  const [reviews, setReviews] = useState<ReviewRow[]>([])
  const [aggregate, setAggregate] = useState<Aggregate | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch(`/api/investigate/${investigationId}/reviews`)
      .then((res) => (res.ok ? res.json() : { reviews: [], aggregate: null }))
      .then((data) => {
        setReviews(data.reviews ?? [])
        setAggregate(data.aggregate ?? null)
      })
      .catch(() => {
        setReviews([])
        setAggregate(null)
      })
      .finally(() => setLoading(false))
  }, [investigationId])

  const hasReviewed = reviews.some((r) => r.reviewerId === currentUserId)

  function handleSubmitted(newReview: unknown) {
    // Reload from server to get reviewer display name and proper aggregate
    fetch(`/api/investigate/${investigationId}/reviews`)
      .then((res) => (res.ok ? res.json() : { reviews: [], aggregate: null }))
      .then((data) => {
        setReviews(data.reviews ?? [])
        setAggregate(data.aggregate ?? null)
      })
      .catch(() => {})

    void newReview
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div
          className="h-4 w-4 animate-spin rounded-full border-2"
          style={{
            borderColor: 'rgba(255, 255, 255, 0.12)',
            borderTopColor: 'rgba(255, 255, 255, 0.4)',
          }}
        />
      </div>
    )
  }

  return (
    <div>
      {aggregate && <ReviewSummary count={aggregate.count} averages={aggregate.averages} />}

      {reviews.length > 0 && (
        <div className="space-y-3 mb-6">
          {reviews.map((review) => (
            <ReviewCard
              key={review.id}
              reviewerDisplayName={review.reviewerDisplayName}
              factualAccuracy={review.factualAccuracy}
              sourceQuality={review.sourceQuality}
              missingContext={review.missingContext}
              strategicEffectiveness={review.strategicEffectiveness}
              jurisdictionalAccuracy={review.jurisdictionalAccuracy}
              summary={review.summary}
              createdAt={review.createdAt}
            />
          ))}
        </div>
      )}

      {isAuthor && reviews.length === 0 && (
        <p className="text-sm text-neutral-600">
          Reviews from other citizens will appear here
        </p>
      )}

      {!isAuthor && !hasReviewed && (
        <ReviewForm investigationId={investigationId} onSubmitted={handleSubmitted} />
      )}

      {!isAuthor && hasReviewed && (
        <p className="text-sm text-neutral-500">You have reviewed this investigation</p>
      )}
    </div>
  )
}
