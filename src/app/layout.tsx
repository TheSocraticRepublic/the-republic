import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'The Republic',
  description: 'Making institutional power legible',
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
