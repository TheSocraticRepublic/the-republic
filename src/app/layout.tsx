import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: {
    default: 'The Republic',
    template: '%s | The Republic',
  },
  description:
    'Open-source civic AI that makes institutional power legible to ordinary citizens.',
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_APP_URL || 'https://opencave.ca'
  ),
  openGraph: {
    title: 'The Republic',
    description:
      'Open-source civic AI that makes institutional power legible to ordinary citizens.',
    url: '/',
    siteName: 'The Republic',
    type: 'website',
    locale: 'en_CA',
  },
  twitter: {
    card: 'summary',
    title: 'The Republic',
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
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full bg-surface-0 text-text-primary">{children}</body>
    </html>
  )
}
