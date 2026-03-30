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
    <html lang="en" className="dark h-full antialiased">
      <body className="min-h-full bg-neutral-950 text-neutral-100">{children}</body>
    </html>
  )
}
