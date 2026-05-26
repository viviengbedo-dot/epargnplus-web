'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { CheckCircle, ArrowRight, Target, Shield, Users } from 'lucide-react'
import { clientApi } from '@/lib/client-api'

const STEPS = [
  {
    icon: CheckCircle,
    color: 'bg-green-50 text-green-600',
    title: 'Compte cree',
    desc: 'Votre compte Epargn+ est actif et securise.',
    done: true,
  },
  {
    icon: Shield,
    color: 'bg-yellow-50 text-yellow-600',
    title: 'Verifiez votre identite (KYC)',
    desc: 'Soumettez votre CNI + selfie pour augmenter vos limites.',
    route: '/dashboard/profile',
    done: false,
  },
  {
    icon: Target,
    color: 'bg-blue-50 text-blue-600',
    title: 'Creez un projet d\'epargne',
    desc: 'Definissez votre premier objectif et suivez votre progression.',
    route: '/dashboard/projects',
    done: false,
  },
  {
    icon: Users,
    color: 'bg-purple-50 text-purple-600',
    title: 'Invitez vos proches',
    desc: 'Gagnez 5 000 GNF pour chaque ami qui s\'inscrit.',
    route: '/dashboard/referral',
    done: false,
  },
]

export default function WelcomePage() {
  const router = useRouter()
  const [phone, setPhone] = useState('')

  useEffect(() => {
    clientApi.profile()
      .then((p) => setPhone(p.phone))
      .catch(() => router.push('/dashboard/login'))
  }, [router])

  return (
    <div className="flex flex-col items-center justify-center min-h-[80vh] px-2">
      {/* Success animation */}
      <div className="text-center mb-8">
        <div className="w-20 h-20 bg-lime rounded-3xl flex items-center justify-center mx-auto mb-4 shadow-lg shadow-lime/30">
          <span className="text-navy font-black text-3xl">E+</span>
        </div>
        <div className="inline-flex items-center gap-2 bg-green-50 text-green-700 text-sm font-semibold px-4 py-2 rounded-full mb-4">
          <CheckCircle size={16} />
          Votre compte est pret !
        </div>
        <h1 className="text-2xl font-black text-navy mb-2">Bienvenue sur Epargn+ !</h1>
        <p className="text-gray-500 text-sm">
          {phone && <span className="font-medium text-navy">{phone}</span>}
          {phone && ' — '}
          Votre avenir financier commence aujourd&apos;hui.
        </p>
      </div>

      {/* Checklist */}
      <div className="w-full max-w-sm space-y-3 mb-8">
        {STEPS.map(({ icon: Icon, color, title, desc, done, route }) => (
          <div key={title}
            onClick={() => route && router.push(route)}
            className={`bg-white rounded-2xl p-4 border flex items-start gap-3 shadow-sm transition-all ${
              route ? 'cursor-pointer hover:border-navy/20 active:scale-[0.98]' : ''
            } ${done ? 'border-green-100 bg-green-50/30' : 'border-gray-100'}`}
          >
            <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${color}`}>
              <Icon size={17} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold text-navy">{title}</p>
              <p className="text-xs text-gray-400 mt-0.5">{desc}</p>
            </div>
            {done
              ? <CheckCircle size={16} className="text-green-500 flex-shrink-0 mt-0.5" />
              : route && <ArrowRight size={15} className="text-gray-300 flex-shrink-0 mt-0.5" />
            }
          </div>
        ))}
      </div>

      <button
        onClick={() => router.replace('/dashboard')}
        className="w-full max-w-sm bg-navy text-white font-bold py-4 rounded-2xl hover:opacity-90 transition-opacity flex items-center justify-center gap-2 shadow-lg shadow-navy/20"
      >
        Acceder a mon Coffre <ArrowRight size={18} />
      </button>

      <p className="text-xs text-gray-400 mt-4 text-center">
        Vous pouvez completer ces etapes a tout moment depuis votre profil.
      </p>
    </div>
  )
}
