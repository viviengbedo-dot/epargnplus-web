const TESTIMONIALS = [
  {
    name: 'Mamadou Diallo',
    role: 'Commerçant à Conakry',
    avatar: 'MD',
    avatarBg: 'bg-orange-500',
    text: 'J\'ai réussi à économiser 2 millions GNF en seulement 4 mois pour rénover ma boutique. L\'application est très simple et l\'argent est toujours disponible quand j\'en ai besoin.',
    stars: 5,
  },
  {
    name: 'Fatoumata Kouyaté',
    role: 'Enseignante, Kindia',
    avatar: 'FK',
    avatarBg: 'bg-purple-500',
    text: 'Grâce à Epargn+ j\'ai pu épargner pour le scolarité de mes enfants. Les rappels automatiques m\'aident à ne jamais oublier de mettre de côté chaque mois.',
    stars: 5,
  },
  {
    name: 'Ibrahim Camara',
    role: 'Entrepreneur tech, Conakry',
    avatar: 'IC',
    avatarBg: 'bg-blue-600',
    text: 'J\'utilise Epargn+ pour mes projets professionnels. Le retrait est vraiment rapide — moins de 2 minutes vers mon Orange Money. Je recommande à tous mes collègues.',
    stars: 5,
  },
  {
    name: 'Aissatou Barry',
    role: 'Fonctionnaire, Labé',
    avatar: 'AB',
    avatarBg: 'bg-green-600',
    text: 'Le programme de parrainage est fantastique. J\'ai invité toute ma famille et nous épargnons tous ensemble. Les bonus reçus m\'ont permis d\'atteindre mon objectif plus vite !',
    stars: 5,
  },
]

export default function Testimonials() {
  return (
    <section className="py-24 bg-navy overflow-hidden">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-14">
          <span className="text-lime font-bold text-sm uppercase tracking-widest">Témoignages</span>
          <h2 className="text-4xl font-black text-white mt-2 mb-3">
            Ils épargnent avec Epargn+
          </h2>
          <p className="text-white/50 text-lg">
            Des milliers de Guinéens font confiance à Epargn+ pour atteindre leurs objectifs.
          </p>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {TESTIMONIALS.map((t) => (
            <div key={t.name} className="bg-white/5 border border-white/10 rounded-2xl p-5 hover:bg-white/8 transition-colors">
              {/* Stars */}
              <div className="flex gap-0.5 mb-3">
                {Array.from({ length: t.stars }).map((_, i) => (
                  <span key={i} className="text-lime text-sm">★</span>
                ))}
              </div>
              {/* Quote */}
              <p className="text-white/70 text-sm leading-relaxed mb-4 line-clamp-4">
                &ldquo;{t.text}&rdquo;
              </p>
              {/* Author */}
              <div className="flex items-center gap-3">
                <div className={`w-9 h-9 rounded-xl flex items-center justify-center text-white font-black text-xs flex-shrink-0 ${t.avatarBg}`}>
                  {t.avatar}
                </div>
                <div>
                  <p className="text-white font-bold text-sm">{t.name}</p>
                  <p className="text-white/40 text-xs">{t.role}</p>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Trust numbers */}
        <div className="mt-14 grid grid-cols-2 md:grid-cols-4 gap-6 border-t border-white/10 pt-10">
          {[
            { value: '4.9★', label: 'Note moyenne', sub: 'sur 500+ avis' },
            { value: '10 000+', label: 'Utilisateurs', sub: 'en Guinée' },
            { value: '98%', label: 'Satisfaction', sub: 'clients actifs' },
            { value: '0 GNF', label: 'Frais d\'ouverture', sub: 'compte 100% gratuit' },
          ].map((s) => (
            <div key={s.label} className="text-center">
              <p className="text-lime font-black text-3xl">{s.value}</p>
              <p className="text-white font-bold text-sm mt-1">{s.label}</p>
              <p className="text-white/40 text-xs">{s.sub}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
