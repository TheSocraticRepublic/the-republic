// Cross-type "pick up where you left off" merge for the Investigate landing
// page's Recent Activity column. Pure function — no I/O — so it's unit
// testable independent of the three DB queries that feed it.

export type ActivityType = 'investigation' | 'inquiry' | 'action'

export interface InvestigationActivityRow {
  id: string
  concern: string
  status: string
  createdAt: Date
}

export interface GadflyActivityRow {
  id: string
  title: string
  status: string
  createdAt: Date
}

export interface LeverActivityRow {
  id: string
  title: string
  status: string
  createdAt: Date
}

export interface ActivityItem {
  id: string
  type: ActivityType
  title: string
  status: string
  createdAt: Date
  href: string
}

/**
 * Merges investigations, gadfly sessions, and lever actions into a single
 * list sorted by recency, capped at `limit`. Each source keeps its own
 * status vocabulary — callers map `status` to a StatusPill per `type`.
 */
export function mergeRecentActivity(
  investigations: InvestigationActivityRow[],
  gadflySessions: GadflyActivityRow[],
  leverActions: LeverActivityRow[],
  limit = 8
): ActivityItem[] {
  const items: ActivityItem[] = []

  for (const inv of investigations) {
    items.push({
      id: inv.id,
      type: 'investigation',
      title: inv.concern,
      status: inv.status,
      createdAt: inv.createdAt,
      href: `/investigate/${inv.id}`,
    })
  }

  for (const session of gadflySessions) {
    items.push({
      id: session.id,
      type: 'inquiry',
      title: session.title,
      status: session.status,
      createdAt: session.createdAt,
      href: `/gadfly/${session.id}`,
    })
  }

  for (const action of leverActions) {
    items.push({
      id: action.id,
      type: 'action',
      title: action.title,
      status: action.status,
      createdAt: action.createdAt,
      href: `/lever/${action.id}`,
    })
  }

  items.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
  return items.slice(0, limit)
}
