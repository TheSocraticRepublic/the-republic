import type { Metadata } from 'next'
import { Plus_Jakarta_Sans, Inter, Source_Serif_4 } from 'next/font/google'
import './globals.css'

const plusJakartaSans = Plus_Jakarta_Sans({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700', '800'],
  display: 'swap',
  variable: '--font-plus-jakarta',
})

const inter = Inter({
  subsets: ['latin'],
  weight: ['400', '500', '600'],
  display: 'swap',
  variable: '--font-inter',
})

const sourceSerif4 = Source_Serif_4({
  subsets: ['latin'],
  weight: ['400', '600'],
  style: ['normal', 'italic'],
  display: 'swap',
  variable: '--font-source-serif',
})

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
    <html lang="en" className={`dark h-full antialiased ${plusJakartaSans.variable} ${inter.variable} ${sourceSerif4.variable}`}>
      <head />
      <body className="min-h-full bg-surface-0 text-text-primary">
        {children}
      </body>
    </html>
  )
}
