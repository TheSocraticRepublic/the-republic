import 'server-only'
import { Resend } from 'resend'

let resendClient: Resend | null = null

function getResend(): Resend {
  if (!resendClient) {
    const apiKey = process.env.RESEND_API_KEY
    if (!apiKey) throw new Error('RESEND_API_KEY is not set')
    resendClient = new Resend(apiKey)
  }
  return resendClient
}

export async function sendMagicCodeEmail(
  to: string,
  code: string
): Promise<void> {
  const fromEmail = process.env.RESEND_FROM_EMAIL ?? 'noreply@opencave.ca'
  const resend = getResend()

  const { error } = await resend.emails.send({
    from: `Open Cave <${fromEmail}>`,
    to,
    subject: 'Your sign-in code',
    html: `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 400px; margin: 0 auto; padding: 40px 20px;">
        <h2 style="color: #1c1917; margin-bottom: 24px; font-weight: 500;">Sign in to Open Cave</h2>
        <p style="color: #78716c; font-size: 16px; line-height: 1.5; margin-bottom: 24px;">
          Enter this code to complete your sign-in:
        </p>
        <div style="background: #f5f4f3; border-radius: 12px; padding: 20px; text-align: center; margin-bottom: 24px; border: 1px solid #e7e5e4;">
          <span style="font-size: 32px; font-weight: 600; letter-spacing: 6px; color: #1c1917;">${code}</span>
        </div>
        <p style="color: #a8a29e; font-size: 13px; line-height: 1.5;">
          This code expires in 10 minutes. If you didn't request this, you can safely ignore this email.
        </p>
      </div>
    `,
  })

  if (error) {
    console.error('[email] Resend error:', JSON.stringify(error))
    if (error.message?.includes('rate') || error.message?.includes('limit') || error.message?.includes('quota')) {
      throw new Error('Email service is temporarily at capacity. Please try again in a few minutes.')
    }
    throw new Error(`Failed to send email: ${error.message}`)
  }
}
