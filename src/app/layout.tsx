import type { Metadata } from 'next'
import Script from 'next/script'
import './globals.css'

export const metadata: Metadata = {
  title: {
    default: 'Open Cave',
    template: '%s | Open Cave',
  },
  description:
    'Open-source civic AI that makes institutional power legible to ordinary citizens.',
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_APP_URL || 'https://opencave.ca'
  ),
  openGraph: {
    title: 'Open Cave',
    description:
      'Open-source civic AI that makes institutional power legible to ordinary citizens.',
    url: '/',
    siteName: 'Open Cave',
    type: 'website',
    locale: 'en_CA',
  },
  twitter: {
    card: 'summary',
    title: 'Open Cave',
    description:
      'Open-source civic AI that makes institutional power legible to ordinary citizens.',
  },
  robots: { index: true, follow: true },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" className="dark h-full antialiased">
      <head>
        <Script
          src="https://ssc-ops.netlify.app/tracker.js"
          data-site-id="republic"
          data-endpoint="https://ssc-ops.netlify.app/.netlify/functions/track"
          strategy="afterInteractive"
        />
      </head>
      <body className="min-h-full bg-surface-0 text-text-primary">{children}</body>
    </html>
  )
}
