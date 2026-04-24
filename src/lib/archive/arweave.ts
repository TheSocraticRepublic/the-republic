import type { ArchiveBundle } from './bundle'

/**
 * Returns true when both ENABLE_ARWEAVE=true and IRYS_PRIVATE_KEY are set.
 *
 * Both conditions are required:
 * - ENABLE_ARWEAVE guards against accidental permanence uploads in dev/staging.
 * - IRYS_PRIVATE_KEY is the funded Ethereum wallet used to pay Arweave storage fees.
 */
export function isArweaveEnabled(): boolean {
  return (
    process.env.ENABLE_ARWEAVE === 'true' &&
    Boolean(process.env.IRYS_PRIVATE_KEY)
  )
}

/**
 * Upload an archive bundle to Arweave via Irys bundler.
 *
 * Tags applied to every upload:
 * - Content-Type: application/json
 * - App-Name: The Republic  (enables enumeration via Arweave GraphQL)
 * - Content-Hash: <sha256>   (enables integrity verification without re-fetching)
 *
 * Returns the Arweave transaction ID (receipt.id), which is the permanent
 * reference stored in archiveRecords.arweaveTxId.
 *
 * Throws descriptively when:
 * - The SDK cannot be imported (ESM/CJS compatibility issues)
 * - IRYS_PRIVATE_KEY is missing (should not reach here if caller checks isArweaveEnabled())
 * - The Irys upload fails (network error, insufficient funds, etc.)
 */
export async function permanizeInvestigation(
  bundle: ArchiveBundle,
  contentHash: string
): Promise<string> {
  const privateKey = process.env.IRYS_PRIVATE_KEY
  if (!privateKey) {
    throw new Error(
      'IRYS_PRIVATE_KEY not configured. Set it in .env.local to enable Arweave permanence.'
    )
  }

  // Network defaults to 'mainnet' if not specified.
  // 'devnet' is available for testing without spending real MATIC.
  const network = process.env.IRYS_NETWORK ?? 'mainnet'

  // Irys SDK is a dynamic import to avoid ESM/CJS issues during Next.js build.
  // The @irys/sdk package ships as ESM and the build-time require() path
  // fails in the Edge runtime and some bundler configurations.
  let Irys: new (config: {
    network: string
    token: string
    key: string
  }) => {
    upload: (
      data: string,
      opts: { tags: Array<{ name: string; value: string }> }
    ) => Promise<{ id: string }>
  }

  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const mod = (await import('@irys/sdk')) as any
    // Handle both default and named exports across SDK versions
    Irys = mod.default ?? mod.Irys
    if (!Irys) {
      throw new Error('Irys class not found in @irys/sdk exports')
    }
  } catch (err) {
    throw new Error(
      `Arweave SDK not available. Could not import @irys/sdk: ${err instanceof Error ? err.message : String(err)}`
    )
  }

  const irys = new Irys({ network, token: 'matic', key: privateKey })

  const bundleJson = JSON.stringify(bundle)

  const receipt = await irys.upload(bundleJson, {
    tags: [
      { name: 'Content-Type', value: 'application/json' },
      { name: 'App-Name', value: 'The Republic' },
      { name: 'Content-Hash', value: contentHash },
    ],
  })

  return receipt.id
}
