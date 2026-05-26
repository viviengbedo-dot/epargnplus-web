import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Epargn+ — Épargnez facilement depuis votre mobile',
  description: 'La première application d\'épargne mobile de Guinée. Déposez, épargnez et atteignez vos objectifs financiers avec Epargn+.',
  keywords: 'épargne, Guinée, mobile money, Orange Money, MTN, fintech',
  openGraph: {
    title: 'Epargn+ — Épargnez facilement depuis votre mobile',
    description: 'La première application d\'épargne mobile de Guinée.',
    type: 'website',
    locale: 'fr_GN',
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="fr">
      <body>{children}</body>
    </html>
  )
}
