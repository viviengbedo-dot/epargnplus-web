import { ArrowRight, Shield, Smartphone } from 'lucide-react'

export default function Hero() {
  return (
    <section className="relative bg-navy min-h-screen flex items-center overflow-hidden pt-16">
      {/* Background decoration */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute -top-40 -right-40 w-96 h-96 bg-lime/10 rounded-full blur-3xl" />
        <div className="absolute -bottom-40 -left-40 w-96 h-96 bg-lime/5 rounded-full blur-3xl" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-white/2 rounded-full" />
      </div>

      <div className="relative max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
        <div className="grid lg:grid-cols-2 gap-12 items-center">
          <div>
            <div className="inline-flex items-center gap-2 bg-lime/10 border border-lime/20 rounded-full px-4 py-2 mb-6">
              <span className="w-2 h-2 bg-lime rounded-full animate-pulse" />
              <span className="text-lime text-sm font-medium">Disponible en Guinée</span>
            </div>

            <h1 className="text-5xl sm:text-6xl font-black text-white leading-tight mb-6">
              Épargnez{' '}
              <span className="text-lime">facilement</span>
              {' '}depuis votre mobile
            </h1>

            <p className="text-white/60 text-lg leading-relaxed mb-8 max-w-md">
              Déposez via Orange Money ou MTN, créez vos objectifs d&apos;épargne et suivez votre progression. Simple, sécurisé, gratuit.
            </p>

            <div className="flex flex-wrap gap-4 mb-10">
              <a
                href="#telecharger"
                className="flex items-center gap-2 bg-lime text-navy font-bold px-6 py-3 rounded-xl hover:bg-lime-300 transition-colors"
              >
                Télécharger l&apos;application
                <ArrowRight size={18} />
              </a>
              <a
                href="#comment"
                className="flex items-center gap-2 bg-white/10 text-white font-medium px-6 py-3 rounded-xl hover:bg-white/15 transition-colors border border-white/10"
              >
                Comment ça marche
              </a>
            </div>

            <div className="flex flex-wrap gap-6">
              <div className="flex items-center gap-2 text-white/50 text-sm">
                <Shield size={16} className="text-lime" />
                Données chiffrées
              </div>
              <div className="flex items-center gap-2 text-white/50 text-sm">
                <Smartphone size={16} className="text-lime" />
                iOS &amp; Android
              </div>
              <div className="flex items-center gap-2 text-white/50 text-sm">
                <span className="text-lime font-bold">0</span>
                <span>Frais d&apos;ouverture</span>
              </div>
            </div>
          </div>

          {/* Phone mockup */}
          <div className="flex justify-center lg:justify-end">
            <div className="relative">
              <div className="w-64 h-[520px] bg-gradient-to-b from-navy-700 to-navy-900 rounded-[44px] border-4 border-white/10 shadow-2xl shadow-black/50 overflow-hidden flex flex-col">
                {/* Status bar */}
                <div className="flex justify-between items-center px-6 pt-4 pb-2">
                  <span className="text-white/60 text-xs">9:41</span>
                  <div className="w-16 h-5 bg-black rounded-full" />
                  <div className="flex gap-1">
                    <div className="w-4 h-2 bg-white/40 rounded-sm" />
                  </div>
                </div>

                {/* App content preview */}
                <div className="flex-1 bg-[#F5F5F7] mx-2 rounded-3xl overflow-hidden">
                  <div className="bg-navy p-4">
                    <p className="text-white/60 text-xs">Solde disponible</p>
                    <p className="text-white font-black text-2xl mt-1">125 000 <span className="text-sm font-normal text-lime">GNF</span></p>
                    <div className="flex gap-2 mt-3">
                      <div className="flex-1 bg-lime rounded-xl py-2 text-center">
                        <span className="text-navy text-xs font-bold">Déposer</span>
                      </div>
                      <div className="flex-1 bg-white/10 rounded-xl py-2 text-center">
                        <span className="text-white text-xs">Retirer</span>
                      </div>
                    </div>
                  </div>
                  <div className="p-3 space-y-2">
                    <p className="text-[#0B1668] font-bold text-xs">Mes objectifs</p>
                    {[
                      { name: 'Maison', pct: 68, amount: '680 000' },
                      { name: 'Voiture', pct: 32, amount: '320 000' },
                    ].map((g) => (
                      <div key={g.name} className="bg-white rounded-xl p-3">
                        <div className="flex justify-between items-center mb-1">
                          <span className="text-[#0B1668] text-xs font-semibold">{g.name}</span>
                          <span className="text-[#6B7280] text-xs">{g.pct}%</span>
                        </div>
                        <div className="w-full bg-gray-100 rounded-full h-1.5">
                          <div className="bg-[#C9E000] h-1.5 rounded-full" style={{ width: `${g.pct}%` }} />
                        </div>
                        <p className="text-[#6B7280] text-xs mt-1">{g.amount} GNF</p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Floating cards */}
              <div className="absolute -left-12 top-20 bg-white rounded-2xl shadow-xl p-3 flex items-center gap-2">
                <div className="w-8 h-8 bg-lime/20 rounded-lg flex items-center justify-center">
                  <span className="text-lime font-bold text-sm">↑</span>
                </div>
                <div>
                  <p className="text-navy text-xs font-bold">+50 000 GNF</p>
                  <p className="text-gray-400 text-xs">Orange Money</p>
                </div>
              </div>

              <div className="absolute -right-8 bottom-24 bg-white rounded-2xl shadow-xl p-3 flex items-center gap-2">
                <div className="w-8 h-8 bg-navy/10 rounded-lg flex items-center justify-center">
                  <span className="text-navy font-bold text-sm">🎯</span>
                </div>
                <div>
                  <p className="text-navy text-xs font-bold">Objectif atteint</p>
                  <p className="text-gray-400 text-xs">Félicitations !</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
