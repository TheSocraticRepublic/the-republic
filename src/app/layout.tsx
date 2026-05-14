import type { Metadata } from 'next'
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
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full bg-surface-0 text-text-primary">{children}</body>
    </html>
  )
}
