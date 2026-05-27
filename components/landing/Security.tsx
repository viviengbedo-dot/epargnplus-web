import { Shield, Lock, Eye, Smartphone, CreditCard, AlertCircle } from 'lucide-react'

const SECURITY_ITEMS = [
  {
    icon: Lock,
    title: 'PIN chiffré',
    desc: 'Votre code PIN est haché côté client avant transmission. Jamais stocké en clair.',
    color: 'text-blue-400',
  },
  {
    icon: Smartphone,
    title: 'OTP par SMS',
    desc: 'Chaque connexion nécessite un code à usage unique envoyé sur votre téléphone.',
    color: 'text-green-400',
  },
  {
    icon: Eye,
    title: 'Données chiffrées',
    desc: 'Toutes vos données financières sont chiffrées avec un standard bancaire (AES-256).',
    color: 'text-purple-400',
  },
  {
    icon: CreditCard,
    title: 'Aucune carte stockée',
    desc: 'Epargn+ utilise uniquement Mobile Money. Aucun numéro de carte bancaire n\'est requis.',
    color: 'text-lime',
  },
  {
    icon: AlertCircle,
    title: 'Alertes instantanées',
    desc: 'Notification immédiate pour chaque mouvement sur votre compte, 24h/24.',
    color: 'text-orange-400',
  },
  {
    icon: Shield,
    title: 'Conformité BCRG',
    desc: 'Epargn+ opère en conformité avec la réglementation de la Banque Centrale de Guinée.',
    color: 'text-yellow-400',
  },
]

export default function Security() {
  return (
    <section className="py-24 bg-white">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid lg:grid-cols-2 gap-16 items-center">
          {/* Left text */}
          <div>
            <span className="text-lime font-bold text-sm uppercase tracking-widest">Sécurité</span>
            <h2 className="text-4xl font-black text-navy mt-2 mb-4">
              Votre argent est<br />
              <span className="text-lime">protégé comme</span> dans<br />
              une banque
            </h2>
            <p className="text-gray-500 text-lg leading-relaxed mb-6">
              Nous appliquons les mêmes standards de sécurité que les institutions financières
              internationales pour protéger votre épargne et vos données personnelles.
            </p>
            <div className="inline-flex items-center gap-3 bg-[#F5F5F7] rounded-2xl px-5 py-3">
              <Shield size={20} className="text-navy" />
              <div>
                <p className="font-bold text-navy text-sm">Partenaire certifié</p>
                <p className="text-gray-500 text-xs">Conforme à la réglementation BCRG</p>
              </div>
            </div>
          </div>

          {/* Right grid */}
          <div className="grid sm:grid-cols-2 gap-4">
            {SECURITY_ITEMS.map(({ icon: Icon, title, desc, color }) => (
              <div key={title} className="bg-[#F5F5F7] rounded-2xl p-4 hover:shadow-md transition-shadow">
                <Icon size={20} className={`mb-3 ${color}`} />
                <p className="font-bold text-navy text-sm mb-1">{title}</p>
                <p className="text-gray-500 text-xs leading-relaxed">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}
