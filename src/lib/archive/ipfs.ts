import { PinataSDK } from 'pinata'
import type { ArchiveBundle } from './bundle'

/**
 * Returns true if the PINATA_JWT environment variable is configured.
 * Used to gate archive routes before attempting a pin.
 */
export function isPinataConfigured(): boolean {
  return Boolean(process.env.PINATA_JWT)
}

/**
 * Pin an archive bundle to IPFS via Pinata.
 * Returns the IPFS CID assigned by Pinata.
 *
 * INTENTIONAL: Archive bundles are pinned to PUBLIC IPFS. This is by design.
 * Archived investigations are civic public goods — the explicit goal is
 * permanent, censorship-resistant public access. Users who archive an
 * investigation consent to this (the archive action is voluntary and deliberate).
 * Per the Republic plan: "Archived investigations become public goods."
 *
 * Throws a clear error if PINATA_JWT is not set.
 */
export async function pinInvestigation(
  bundle: ArchiveBundle,
  contentHash: string
): Promise<string> {
  const jwt = process.env.PINATA_JWT
  if (!jwt) {
    throw new Error(
      'PINATA_JWT not configured. Set it in .env.local to enable archiving.'
    )
  }

  const gateway = process.env.PINATA_GATEWAY

  const pinata = new PinataSDK({
    pinataJwt: jwt,
    pinataGateway: gateway,
  })

  const investigationId = bundle.investigation.id
  const metadataName = `republic-investigation-${investigationId}`

  const response = await pinata.upload.public
    .json(bundle)
    .name(metadataName)
    .keyvalues({ contentHash, investigationId })

  return response.cid
}
