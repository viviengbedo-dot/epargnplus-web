import { Smartphone, Target, TrendingUp, Users, Shield, Zap } from 'lucide-react'

const features = [
  {
    icon: Smartphone,
    title: 'Dépôt Mobile Money',
    desc: 'Alimentez votre compte en quelques secondes via Orange Money ou MTN Mobile Money. Disponible 24h/24.',
    color: 'bg-orange-50 text-orange-500',
  },
  {
    icon: Target,
    title: 'Objectifs d\'Épargne',
    desc: 'Créez des projets personnalisés — maison, voiture, études. Suivez votre progression en temps réel.',
    color: 'bg-lime/10 text-navy',
  },
  {
    icon: TrendingUp,
    title: 'Suivi des Mouvements',
    desc: 'Historique complet de tous vos dépôts et retraits. Exportez et analysez vos finances facilement.',
    color: 'bg-blue-50 text-blue-500',
  },
  {
    icon: Users,
    title: 'Programme de Parrainage',
    desc: 'Invitez vos proches et gagnez des bonus pour chaque filleul actif. Développez votre épargne ensemble.',
    color: 'bg-purple-50 text-purple-500',
  },
  {
    icon: Shield,
    title: 'Sécurité Maximale',
    desc: 'PIN chiffré, authentification à deux facteurs via SMS. Vos données et votre argent sont protégés.',
    color: 'bg-green-50 text-green-600',
  },
  {
    icon: Zap,
    title: 'Retraits Rapides',
    desc: 'Récupérez votre argent en moins de 2 minutes directement sur votre numéro mobile money.',
    color: 'bg-yellow-50 text-yellow-600',
  },
]

export default function Features() {
  return (
    <section id="fonctionnalites" className="py-24 bg-white">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <span className="text-lime font-bold text-sm uppercase tracking-widest">Fonctionnalités</span>
          <h2 className="text-4xl font-black text-navy mt-2 mb-4">
            Tout ce dont vous avez besoin
          </h2>
          <p className="text-gray-500 text-lg max-w-2xl mx-auto">
            Epargn+ est conçu spécialement pour les Guinéens — simple, rapide et adapté à votre quotidien.
          </p>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {features.map((f) => (
            <div key={f.title} className="bg-[#F5F5F7] rounded-2xl p-6 hover:shadow-lg transition-shadow group">
              <div className={`w-12 h-12 rounded-xl flex items-center justify-center mb-4 ${f.color}`}>
                <f.icon size={22} />
              </div>
              <h3 className="text-navy font-bold text-lg mb-2">{f.title}</h3>
              <p className="text-gray-500 text-sm leading-relaxed">{f.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
