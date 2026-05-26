import Image from 'next/image'

const screens = [
  { src: '/screenshots/01_onboarding.png', label: 'Bienvenue' },
  { src: '/screenshots/02_home.png',       label: 'Accueil' },
  { src: '/screenshots/03_deposit.png',    label: 'Dépôt' },
  { src: '/screenshots/04_projects.png',   label: 'Objectifs' },
  { src: '/screenshots/05_movements.png',  label: 'Mouvements' },
  { src: '/screenshots/06_profile.png',    label: 'Profil' },
]

export default function Screenshots() {
  return (
    <section className="py-24 bg-navy overflow-hidden">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-14">
          <span className="text-lime font-bold text-sm uppercase tracking-widest">Aperçu</span>
          <h2 className="text-4xl font-black text-white mt-2">
            L&apos;application en images
          </h2>
        </div>

        <div className="flex gap-4 overflow-x-auto pb-4 snap-x snap-mandatory scrollbar-hide justify-center flex-wrap md:flex-nowrap">
          {screens.map((s) => (
            <div key={s.src} className="flex-shrink-0 snap-center flex flex-col items-center gap-2">
              <div className="w-36 h-[290px] rounded-[28px] overflow-hidden border-2 border-white/10 shadow-xl shadow-black/40">
                <Image
                  src={s.src}
                  alt={s.label}
                  width={330}
                  height={660}
                  className="w-full h-full object-cover object-top"
                />
              </div>
              <span className="text-white/50 text-xs font-medium">{s.label}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
