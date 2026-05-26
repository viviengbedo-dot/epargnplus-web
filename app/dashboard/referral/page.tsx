'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Users, Copy, Check, Gift, Share2, MessageCircle, Mail, ExternalLink } from 'lucide-react'
import { clientApi } from '@/lib/client-api'

interface ReferralData {
  code: string
  referralLink: string
  referralCount: number
  totalEarnings: number
}

export default function ReferralPage() {
  const router = useRouter()
  const [data, setData]     = useState<ReferralData | null>(null)
  const [loading, setLoading] = useState(true)
  const [copied, setCopied]  = useState(false)
  const [copiedLink, setCopiedLink] = useState(false)

  useEffect(() => {
    clientApi.referral()
      .then(setData)
      .catch(() => router.push('/dashboard/login'))
      .finally(() => setLoading(false))
  }, [router])

  function copyCode() {
    if (!data) return
    navigator.clipboard.writeText(data.code)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  function copyLink() {
    if (!data) return
    navigator.clipboard.writeText(data.referralLink)
    setCopiedLink(true)
    setTimeout(() => setCopiedLink(false), 2000)
  }

  function shareWhatsApp() {
    if (!data) return
    const msg = encodeURIComponent(
      `Rejoignez Epargn+ et commencez a epargner intelligemment ! Utilisez mon code ${data.code} et nous recevons chacun 5 000 GNF. Inscription : ${data.referralLink}`
    )
    window.open(`https://wa.me/?text=${msg}`, '_blank')
  }

  function shareEmail() {
    if (!data) return
    const subject = encodeURIComponent('Rejoignez Epargn+ - Bonus de 5 000 GNF')
    const body = encodeURIComponent(
      `Bonjour,\n\nJe vous invite a rejoindre Epargn+, la plateforme d'epargne mobile en Guinee.\n\nUtilisez mon code de parrainage : ${data.code}\nLien d'inscription : ${data.referralLink}\n\nNous recevrons chacun 5 000 GNF de bonus apres votre premier depot !`
    )
    window.open(`mailto:?subject=${subject}&body=${body}`, '_blank')
  }

  if (loading) return (
    <div className="flex items-center justify-center h-64 text-gray-400 text-sm animate-pulse">Chargement...</div>
  )

  return (
    <>
      {/* Hero */}
      <div className="bg-navy rounded-2xl p-6 text-white mb-4 shadow-lg relative overflow-hidden">
        <div className="absolute -top-4 -right-4 w-24 h-24 bg-lime/10 rounded-full" />
        <div className="absolute -bottom-6 -left-6 w-32 h-32 bg-white/5 rounded-full" />
        <div className="relative">
          <div className="w-12 h-12 bg-lime/20 rounded-2xl flex items-center justify-center mb-3">
            <Gift size={22} className="text-lime" />
          </div>
          <h1 className="text-xl font-black mb-1">Invitez vos proches,</h1>
          <p className="text-lime font-black text-2xl">gagnez 5 000 GNF</p>
          <p className="text-white/50 text-sm mt-2">
            Pour chaque ami qui s&apos;inscrit et effectue son premier depot, vous recevez tous les deux 5 000 GNF.
          </p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3 mb-4">
        <div className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm text-center">
          <div className="w-10 h-10 bg-navy/5 rounded-xl flex items-center justify-center mx-auto mb-2">
            <Users size={18} className="text-navy" />
          </div>
          <p className="text-2xl font-black text-navy">{data?.referralCount ?? 0}</p>
          <p className="text-xs text-gray-400">Ami{(data?.referralCount ?? 0) > 1 ? 's' : ''} parraines</p>
        </div>
        <div className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm text-center">
          <div className="w-10 h-10 bg-lime/10 rounded-xl flex items-center justify-center mx-auto mb-2">
            <Gift size={18} className="text-lime" />
          </div>
          <p className="text-2xl font-black text-navy">{(data?.totalEarnings ?? 0).toLocaleString('fr-FR')}</p>
          <p className="text-xs text-gray-400">GNF gagnes</p>
        </div>
      </div>

      {/* Code */}
      <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm mb-4">
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Votre code unique</p>
        <div className="flex items-center gap-3 mb-3">
          <div className="flex-1 bg-navy/5 rounded-xl px-4 py-3 text-center">
            <p className="font-mono font-black text-navy text-2xl tracking-[0.3em]">{data?.code}</p>
          </div>
          <button onClick={copyCode}
            className={`p-3 rounded-xl transition-colors ${copied ? 'bg-green-50 text-green-600' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}>
            {copied ? <Check size={18} /> : <Copy size={18} />}
          </button>
        </div>

        <div className="flex items-center gap-2 text-xs text-gray-400 bg-gray-50 rounded-xl px-3 py-2">
          <ExternalLink size={11} />
          <span className="flex-1 truncate">{data?.referralLink}</span>
          <button onClick={copyLink}
            className={`flex-shrink-0 font-medium ${copiedLink ? 'text-green-600' : 'text-navy hover:underline'}`}>
            {copiedLink ? 'Copie !' : 'Copier'}
          </button>
        </div>
      </div>

      {/* Share buttons */}
      <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm mb-4">
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Partager via</p>
        <div className="grid grid-cols-3 gap-3">
          <button onClick={shareWhatsApp}
            className="flex flex-col items-center gap-2 p-3 bg-green-50 rounded-2xl hover:bg-green-100 transition-colors">
            <MessageCircle size={22} className="text-green-600" />
            <span className="text-xs font-medium text-green-700">WhatsApp</span>
          </button>
          <button onClick={shareEmail}
            className="flex flex-col items-center gap-2 p-3 bg-blue-50 rounded-2xl hover:bg-blue-100 transition-colors">
            <Mail size={22} className="text-blue-600" />
            <span className="text-xs font-medium text-blue-700">Email</span>
          </button>
          <button onClick={copyLink}
            className="flex flex-col items-center gap-2 p-3 bg-gray-50 rounded-2xl hover:bg-gray-100 transition-colors">
            <Share2 size={22} className="text-gray-600" />
            <span className="text-xs font-medium text-gray-700">Autre</span>
          </button>
        </div>
      </div>

      {/* How it works */}
      <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm">
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-4">Comment ca marche ?</p>
        <div className="space-y-4">
          {[
            { step: '1', title: 'Partagez votre code', desc: 'Envoyez votre code unique a un ami via WhatsApp, SMS ou email.' },
            { step: '2', title: 'Votre ami s\'inscrit', desc: 'Il cree son compte Epargn+ avec votre code de parrainage.' },
            { step: '3', title: 'Premier depot effectue', desc: 'Des son premier depot, vous recevez tous les deux 5 000 GNF.' },
          ].map(({ step, title, desc }) => (
            <div key={step} className="flex items-start gap-3">
              <div className="w-7 h-7 bg-navy rounded-full flex items-center justify-center flex-shrink-0 text-lime font-black text-xs">
                {step}
              </div>
              <div>
                <p className="text-sm font-bold text-navy">{title}</p>
                <p className="text-xs text-gray-500 mt-0.5">{desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </>
  )
}
