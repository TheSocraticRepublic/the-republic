import type { Metadata } from 'next'
import { Fraunces, Instrument_Sans, Geist_Mono, Source_Serif_4 } from 'next/font/google'
import './globals.css'

const fraunces = Fraunces({
  subsets: ['latin'],
  axes: ['SOFT', 'WONK'],
  display: 'swap',
  variable: '--font-fraunces',
})

const instrumentSans = Instrument_Sans({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  display: 'swap',
  variable: '--font-instrument-sans',
})

const geistMono = Geist_Mono({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-geist-mono',
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
    <html lang="en" className={`dark h-full antialiased ${fraunces.variable} ${instrumentSans.variable} ${geistMono.variable} ${sourceSerif4.variable}`}>
      <head />
      <body className="min-h-full bg-surface-0 text-text-primary">
        {children}
      </body>
    </html>
  )
}
