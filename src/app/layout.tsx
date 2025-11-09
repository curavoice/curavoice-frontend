import type { Metadata } from 'next'
import { Montserrat, Lato } from 'next/font/google'
import './globals.css'
import { Providers } from '@/components/providers'

const montserrat = Montserrat({
  subsets: ['latin'],
  variable: '--font-montserrat',
  display: 'swap',
  weight: ['400', '700', '800'],
})

const lato = Lato({
  subsets: ['latin'],
  variable: '--font-lato',
  display: 'swap',
  weight: ['400', '700'],
})

export const metadata: Metadata = {
  title: 'CuraVoice - AI-Powered Patient Simulation Training',
  description: 'Transform healthcare education with AI-powered patient simulation training',
  keywords: ['healthcare', 'medical training', 'AI', 'patient simulation', 'education'],
  authors: [{ name: 'CuraVoice Team' }],
  robots: 'index, follow',
  openGraph: {
    type: 'website',
    locale: 'en_US',
    url: 'https://curavoice.com',
    title: 'CuraVoice - AI-Powered Patient Simulation Training',
    description: 'Transform healthcare education with AI-powered patient simulation training',
    siteName: 'CuraVoice',
  },
}

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#1A1F71',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" suppressHydrationWarning className={`${montserrat.variable} ${lato.variable}`}>
      <body className="min-h-screen antialiased">
        <Providers>
          <main id="main-content">{children}</main>
        </Providers>
      </body>
    </html>
  )
}

