export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    process.on('unhandledRejection', (reason: unknown) => {
      const msg = reason instanceof Error ? reason.message : String(reason)
      if (msg.includes('.next/cache')) return
      console.error('Unhandled rejection:', reason)
    })
  }
}
