import Navbar from '@/components/landing/Navbar'
import Hero from '@/components/landing/Hero'
import Features from '@/components/landing/Features'
import Screenshots from '@/components/landing/Screenshots'
import HowItWorks from '@/components/landing/HowItWorks'
import FAQ from '@/components/landing/FAQ'
import Contact from '@/components/landing/Contact'
import Footer from '@/components/landing/Footer'
import { Apple } from 'lucide-react'

export default function LandingPage() {
  return (
    <main>
      <Navbar />
      <Hero />
      <Features />
      <Screenshots />
      <HowItWorks />

      {/* Stats strip */}
      <section className="py-16 bg-[#F5F5F7]">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
            {[
              { value: '10 000+', label: 'Utilisateurs actifs' },
              { value: '2 milliards', label: 'GNF épargnés' },
              { value: '4.8★', label: 'Note App Store' },
              { value: '< 2min', label: 'Délai de retrait' },
            ].map((s) => (
              <div key={s.label}>
                <div className="text-3xl font-black text-navy mb-1">{s.value}</div>
                <div className="text-gray-500 text-sm">{s.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Download CTA */}
      <section id="telecharger" className="py-24 bg-white">
        <div className="max-w-2xl mx-auto px-4 text-center">
          <span className="text-lime font-bold text-sm uppercase tracking-widest">Disponible maintenant</span>
          <h2 className="text-4xl font-black text-navy mt-2 mb-4">
            Commencez à épargner aujourd&apos;hui
          </h2>
          <p className="text-gray-500 text-lg mb-8">
            Téléchargez Epargn+ gratuitement et rejoignez des milliers de Guinéens qui épargnent intelligemment.
          </p>
          <div className="flex flex-wrap justify-center gap-4">
            <a
              href="https://apps.apple.com"
              className="flex items-center gap-3 bg-navy text-white px-6 py-3 rounded-xl hover:bg-navy-600 transition-colors"
            >
              <Apple size={22} />
              <div className="text-left">
                <p className="text-xs text-white/60">Télécharger sur</p>
                <p className="font-bold text-sm">App Store</p>
              </div>
            </a>
            <div className="flex items-center gap-3 bg-gray-100 text-gray-400 px-6 py-3 rounded-xl cursor-not-allowed">
              <div className="w-6 h-6 flex items-center justify-center font-bold text-lg">▶</div>
              <div className="text-left">
                <p className="text-xs">Bientôt sur</p>
                <p className="font-bold text-sm">Google Play</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <FAQ />
      <Contact />
      <Footer />
    </main>
  )
}
