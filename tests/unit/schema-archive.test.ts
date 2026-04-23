import { describe, it, expect } from 'vitest'
import {
  archiveRecords,
  documentVersions,
  archiveAccessLog,
  shadowAlerts,
  archiveStatusEnum,
  documentChangeTypeEnum,
  shadowAlertTypeEnum,
  archiveAccessTypeEnum,
  credentialTypeEnum,
  investigations,
} from '@/lib/db/schema'

describe('Archive schema — tables defined', () => {
  it('archiveRecords table is defined', () => {
    expect(archiveRecords).toBeDefined()
  })

  it('documentVersions table is defined', () => {
    expect(documentVersions).toBeDefined()
  })

  it('archiveAccessLog table is defined', () => {
    expect(archiveAccessLog).toBeDefined()
  })

  it('shadowAlerts table is defined', () => {
    expect(shadowAlerts).toBeDefined()
  })
})

describe('Archive schema — enum values', () => {
  it('archiveStatusEnum has expected values', () => {
    expect(archiveStatusEnum.enumValues).toEqual([
      'pending',
      'ipfs_pinned',
      'arweave_permanent',
      'failed',
    ])
  })

  it('documentChangeTypeEnum has expected values', () => {
    expect(documentChangeTypeEnum.enumValues).toEqual([
      'content_changed',
      'metadata_changed',
      'deleted',
      'retracted',
    ])
  })

  it('shadowAlertTypeEnum has expected values', () => {
    expect(shadowAlertTypeEnum.enumValues).toEqual([
      'missing_topic',
      'missing_entity',
      'missing_jurisdiction_pattern',
    ])
  })

  it('archiveAccessTypeEnum has expected values', () => {
    expect(archiveAccessTypeEnum.enumValues).toEqual([
      'ipfs_gateway',
      'arweave_direct',
      'republic_app',
    ])
  })

  it('credentialTypeEnum includes investigation_archived', () => {
    expect(credentialTypeEnum.enumValues).toContain('investigation_archived')
  })
})

describe('Archive schema — column presence', () => {
  it('archiveRecords has all required columns', () => {
    expect(archiveRecords.id).toBeDefined()
    expect(archiveRecords.investigationId).toBeDefined()
    expect(archiveRecords.userId).toBeDefined()
    expect(archiveRecords.archiveStatus).toBeDefined()
    expect(archiveRecords.ipfsCid).toBeDefined()
    expect(archiveRecords.arweaveTxId).toBeDefined()
    expect(archiveRecords.contentHash).toBeDefined()
    expect(archiveRecords.preservedAt).toBeDefined()
    expect(archiveRecords.permanenceAt).toBeDefined()
    expect(archiveRecords.metadata).toBeDefined()
    expect(archiveRecords.createdAt).toBeDefined()
    expect(archiveRecords.updatedAt).toBeDefined()
  })

  it('documentVersions has all required columns', () => {
    expect(documentVersions.id).toBeDefined()
    expect(documentVersions.documentId).toBeDefined()
    expect(documentVersions.versionNumber).toBeDefined()
    expect(documentVersions.contentHash).toBeDefined()
    expect(documentVersions.previousVersionId).toBeDefined()
    expect(documentVersions.diffSummary).toBeDefined()
    expect(documentVersions.changeType).toBeDefined()
    expect(documentVersions.detectedAt).toBeDefined()
  })

  it('archiveAccessLog has required columns and no userId', () => {
    expect(archiveAccessLog.id).toBeDefined()
    expect(archiveAccessLog.archiveRecordId).toBeDefined()
    expect(archiveAccessLog.accessType).toBeDefined()
    expect(archiveAccessLog.accessedAt).toBeDefined()
    // Privacy-respecting: no userId column
    expect((archiveAccessLog as Record<string, unknown>).userId).toBeUndefined()
  })

  it('shadowAlerts has all required columns', () => {
    expect(shadowAlerts.id).toBeDefined()
    expect(shadowAlerts.investigationId).toBeDefined()
    expect(shadowAlerts.alertType).toBeDefined()
    expect(shadowAlerts.missingTopic).toBeDefined()
    expect(shadowAlerts.referenceInvestigationIds).toBeDefined()
    expect(shadowAlerts.confidence).toBeDefined()
    expect(shadowAlerts.dismissedAt).toBeDefined()
    expect(shadowAlerts.createdAt).toBeDefined()
  })

  it('investigations has preservedAt column', () => {
    expect(investigations.preservedAt).toBeDefined()
  })
})
