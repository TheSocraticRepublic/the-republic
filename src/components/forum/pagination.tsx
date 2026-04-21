import Link from 'next/link'

interface PaginationProps {
  currentPage: number
  totalPages: number
  baseUrl: string
  queryParams?: Record<string, string>
}

function buildUrl(baseUrl: string, page: number, queryParams?: Record<string, string>): string {
  const params = new URLSearchParams({ ...(queryParams ?? {}), page: String(page) })
  return `${baseUrl}?${params.toString()}`
}

export function Pagination({ currentPage, totalPages, baseUrl, queryParams }: PaginationProps) {
  if (totalPages <= 1) return null

  const pages: (number | 'ellipsis')[] = []

  if (totalPages <= 7) {
    for (let i = 1; i <= totalPages; i++) pages.push(i)
  } else {
    pages.push(1)
    if (currentPage > 3) pages.push('ellipsis')
    for (let i = Math.max(2, currentPage - 1); i <= Math.min(totalPages - 1, currentPage + 1); i++) {
      pages.push(i)
    }
    if (currentPage < totalPages - 2) pages.push('ellipsis')
    pages.push(totalPages)
  }

  return (
    <nav className="flex items-center justify-center gap-1 py-4" aria-label="Pagination">
      {currentPage > 1 ? (
        <Link
          href={buildUrl(baseUrl, currentPage - 1, queryParams)}
          className="px-3 py-1.5 text-xs text-neutral-400 hover:text-neutral-200 transition-colors rounded-lg hover:bg-white/[0.04]"
        >
          Previous
        </Link>
      ) : (
        <span className="px-3 py-1.5 text-xs text-neutral-700 cursor-not-allowed">Previous</span>
      )}

      {pages.map((page, i) =>
        page === 'ellipsis' ? (
          <span key={`ellipsis-${i}`} className="px-2 text-xs text-neutral-700">
            ...
          </span>
        ) : (
          <Link
            key={page}
            href={buildUrl(baseUrl, page, queryParams)}
            className={`px-3 py-1.5 text-xs rounded-lg transition-colors ${
              page === currentPage
                ? 'text-neutral-100 bg-white/[0.08]'
                : 'text-neutral-500 hover:text-neutral-300 hover:bg-white/[0.04]'
            }`}
          >
            {page}
          </Link>
        )
      )}

      {currentPage < totalPages ? (
        <Link
          href={buildUrl(baseUrl, currentPage + 1, queryParams)}
          className="px-3 py-1.5 text-xs text-neutral-400 hover:text-neutral-200 transition-colors rounded-lg hover:bg-white/[0.04]"
        >
          Next
        </Link>
      ) : (
        <span className="px-3 py-1.5 text-xs text-neutral-700 cursor-not-allowed">Next</span>
      )}
    </nav>
  )
}
