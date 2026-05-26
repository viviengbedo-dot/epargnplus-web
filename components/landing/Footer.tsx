import Link from 'next/link'

export default function Footer() {
  return (
    <footer className="bg-navy border-t border-white/10">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-8 mb-10">
          <div className="lg:col-span-2">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-8 h-8 bg-lime rounded-lg flex items-center justify-center">
                <span className="text-navy font-black text-sm">E+</span>
              </div>
              <span className="text-white font-bold text-lg">Epargn+</span>
            </div>
            <p className="text-white/50 text-sm leading-relaxed max-w-xs">
              La première application d&apos;épargne mobile de Guinée. Sécurisée, simple et accessible à tous.
            </p>
          </div>

          <div>
            <h4 className="text-white font-semibold mb-4">Application</h4>
            <ul className="space-y-2">
              <li><a href="#fonctionnalites" className="text-white/50 text-sm hover:text-white transition-colors">Fonctionnalités</a></li>
              <li><a href="#comment" className="text-white/50 text-sm hover:text-white transition-colors">Comment ça marche</a></li>
              <li><a href="#telecharger" className="text-white/50 text-sm hover:text-white transition-colors">Télécharger</a></li>
            </ul>
          </div>

          <div>
            <h4 className="text-white font-semibold mb-4">Légal</h4>
            <ul className="space-y-2">
              <li><Link href="/confidentialite" className="text-white/50 text-sm hover:text-white transition-colors">Confidentialité</Link></li>
              <li><Link href="/conditions" className="text-white/50 text-sm hover:text-white transition-colors">Conditions d&apos;utilisation</Link></li>
              <li><Link href="/admin/login" className="text-white/50 text-sm hover:text-white transition-colors">Espace Admin</Link></li>
            </ul>
          </div>
        </div>

        <div className="border-t border-white/10 pt-6 flex flex-col sm:flex-row justify-between items-center gap-4">
          <p className="text-white/30 text-sm">© 2025 Epargn+. Tous droits réservés. Conakry, Guinée.</p>
          <div className="flex items-center gap-4">
            <span className="text-white/30 text-sm">contact@epargnplus.com</span>
          </div>
        </div>
      </div>
    </footer>
  )
}
