import './globals.css'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'AI Problem Solver',
  description: 'An AI-powered problem solving application',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" className="dark">
      <body className="min-h-screen bg-background text-foreground">
        {children}
      </body>
    </html>
  )
} 